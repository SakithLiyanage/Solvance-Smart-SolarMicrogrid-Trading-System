// ============================================================================
// File: ReservationService.cs
// Project: Solvance — Smart Solar Microgrid Trading System
// Author: L.T. Jayawardhana (IT23156760) & H.N. Madubashini (IT23192300)
// Course: SE4040 - Enterprise Application Development (SLIIT)
// Description: Core FAT-service enterprise logic for 7-day rule, 12-hour notice, booking limits, and QR verification.
// References & Citations:
//   - MongoDB C# Driver CRUD & Linq Filter Definition Builder:
//     https://www.mongodb.com/docs/drivers/csharp/current/fundamentals/crud/read-operations/
//   - System.Security.Cryptography HMACSHA256 & SHA256 Signature Verification:
//     https://learn.microsoft.com/en-us/dotnet/api/system.security.cryptography.hmacsha256
//   - MongoDB C# Driver FindOneAndUpdate & Concurrency Control:
//     https://www.mongodb.com/docs/drivers/csharp/current/fundamentals/crud/write-operations/modify/
// ============================================================================

using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;
using MongoDB.Driver;
using SolarMicrogridApi.Data;
using SolarMicrogridApi.Models;
using SolarMicrogridApi.Models.Config;

namespace SolarMicrogridApi.Services
{
    /// <summary>
    /// Implements enterprise business logic for power trading bookings in the "Energy Reservation" collection.
    /// </summary>
    public class ReservationService : IReservationService
    {
        private readonly MongoDbContext _context;
        private readonly ReservationSettings _settings;
        private readonly string _qrSigningSecret;

        public ReservationService(MongoDbContext context, IOptions<ReservationSettings> settings, IConfiguration configuration)
        {
            // Method: ReservationService Constructor - Injects MongoDbContext and strongly-typed ReservationSettings options.
            _context = context;
            _settings = settings?.Value ?? new ReservationSettings();
            _qrSigningSecret = configuration["QrSettings:SigningSecret"]
                ?? (!string.IsNullOrEmpty(_settings.QrSecretSalt) ? _settings.QrSecretSalt : "EnterpriseMicrogridSecretSalt2026");
        }

        // Booking days are counted in Sri Lanka time. Sri Lanka has no daylight saving, so a fixed
        // +05:30 offset is a safe fallback when the host has no time-zone database.
        private static readonly TimeZoneInfo BookingTimeZone = ResolveBookingTimeZone();

        private static TimeZoneInfo ResolveBookingTimeZone()
        {
            // Method: ResolveBookingTimeZone - Resolves Sri Lanka standard time zone with fallback.
            foreach (var zoneId in new[] { "Asia/Colombo", "Sri Lanka Standard Time" })
            {
                try
                {
                    return TimeZoneInfo.FindSystemTimeZoneById(zoneId);
                }
                catch (TimeZoneNotFoundException) { }
                catch (InvalidTimeZoneException) { }
            }
            return TimeZoneInfo.CreateCustomTimeZone("Sri Lanka", TimeSpan.FromHours(5.5), "Sri Lanka", "Sri Lanka");
        }

        /// <summary>
        /// End of the booking window (exclusive, UTC): midnight after the last allowed calendar day,
        /// Sri Lanka time. With 7 days, a booking made on the 1st can be scheduled until 23:59 on the 8th,
        /// which matches the date pickers in the web and mobile clients.
        /// </summary>
        private static DateTime GetBookingWindowEndUtc(int maxDays)
        {
            // Method: GetBookingWindowEndUtc - Calculates exclusive end boundary of the 7-day reservation window in UTC.
            var localToday = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, BookingTimeZone).Date;
            var localWindowEnd = DateTime.SpecifyKind(localToday.AddDays(maxDays + 1), DateTimeKind.Unspecified);
            return TimeZoneInfo.ConvertTimeToUtc(localWindowEnd, BookingTimeZone);
        }

        /// <summary>
        /// A drop-off needs a free battery slot at the hub. Slots are only taken when the operator completes
        /// the transfer, so approved-but-not-completed drop-offs already have a slot promised to them.
        /// </summary>
        private async Task EnsureDropOffSlotAvailableAsync(SolarStation station, string? excludeReservationId)
        {
            // Method: EnsureDropOffSlotAvailableAsync - Verifies that the hub has sufficient physical battery slot capacity for drop-off trade.
            var promisedSlots = await _context.Reservations.CountDocumentsAsync(r =>
                r.StationId == station.Id &&
                r.Status == "Approved" &&
                r.TradeType == "DropOff" &&
                r.Id != excludeReservationId);

            if (station.AvailableBatterySlots - promisedSlots <= 0)
            {
                throw new InvalidOperationException(
                    $"The solar hub '{station.Name}' has no free battery slot for this drop-off " +
                    $"({station.AvailableBatterySlots} free, {promisedSlots} already promised to approved bookings).");
            }
        }

        /// <summary>
        /// A drop-off sells energy produced by the prosumer's own panels, so one drop-off is limited to roughly a day
        /// of generation: solar capacity (kW) x peak sun hours. Skipped when no solar capacity is on record.
        /// </summary>
        private void EnsureWithinSolarCapacity(User prosumer, string tradeType, double energyKwh)
        {
            // Method: EnsureWithinSolarCapacity - Rejects drop-offs larger than the prosumer's panels can produce in a day.
            if (tradeType != "DropOff" || prosumer.SolarCapacityKw <= 0)
            {
                return;
            }

            var sunHours = _settings.PeakSunHoursPerDay > 0 ? _settings.PeakSunHoursPerDay : 5.0;
            var maxDropOffKwh = prosumer.SolarCapacityKw * sunHours;
            if (energyKwh > maxDropOffKwh)
            {
                throw new ArgumentException(
                    $"A {prosumer.SolarCapacityKw} kW solar system produces about {maxDropOffKwh:F1} kWh per day, " +
                    $"so a drop-off cannot exceed {maxDropOffKwh:F1} kWh ({energyKwh} kWh requested).");
            }
        }

        public async Task<EnergyReservation> CreateReservationAsync(CreateReservationDto dto)
        {
            // Method: CreateReservationAsync - Validates 7-day scheduling constraint, verifies prosumer/station state, and creates booking.
            var now = DateTime.UtcNow;
            var scheduledUtc = dto.ScheduledDateTime.ToUniversalTime();
            var maxDays = _settings.MaxAdvanceBookingDays > 0 ? _settings.MaxAdvanceBookingDays : 7;
            var graceMinutes = _settings.GracePeriodMinutes >= 0 ? _settings.GracePeriodMinutes : 10;

            // Business Rule: Scheduled within configurable advance days (default: 7 days, up to end of 7th calendar day, Sri Lanka time)
            var maxBookingWindowUtc = GetBookingWindowEndUtc(maxDays);
            if (scheduledUtc < now.AddMinutes(-graceMinutes) || scheduledUtc >= maxBookingWindowUtc)
            {
                throw new ArgumentException($"Power trading reservations must be scheduled within {maxDays} days from today.");
            }

            // Verify prosumer is active
            var prosumer = await _context.Users.Find(u => u.Nic == dto.ProsumerNic).FirstOrDefaultAsync();
            if (prosumer == null)
            {
                throw new KeyNotFoundException("Prosumer profile not found.");
            }
            if (prosumer.Status != "Active")
            {
                throw new InvalidOperationException($"Cannot create reservation. Account status is '{prosumer.Status}'. Only Active accounts can book.");
            }

            // Business Rule: a prosumer may hold only a limited number of upcoming reservations (default: 3).
            // Bookings whose time has already passed are not counted, so a missed booking can't lock the account out.
            var maxActive = _settings.MaxActiveReservationsPerProsumer > 0 ? _settings.MaxActiveReservationsPerProsumer : 3;
            var upcomingFromUtc = now.AddMinutes(-graceMinutes);
            var activeCount = await _context.Reservations.CountDocumentsAsync(r =>
                r.ProsumerNic == prosumer.Nic &&
                (r.Status == "Pending" || r.Status == "Approved") &&
                r.ScheduledDateTime >= upcomingFromUtc);
            if (activeCount >= maxActive)
            {
                throw new InvalidOperationException(
                    $"Booking limit reached: this account already has {activeCount} upcoming reservations (maximum {maxActive}). " +
                    "Complete or cancel one before booking another.");
            }

            // Verify solar hub is active
            var station = await _context.Stations.Find(s => s.Id == dto.StationId).FirstOrDefaultAsync();
            if (station == null)
            {
                throw new KeyNotFoundException("Microgrid solar station not found.");
            }
            if (!station.IsActive)
            {
                throw new InvalidOperationException("The requested solar hub is currently deactivated.");
            }

            // Enforce station capacity business rule: DropOff requires open battery slot
            if (dto.TradeType == "DropOff" && station.AvailableBatterySlots <= 0)
            {
                throw new InvalidOperationException($"The solar hub '{station.Name}' is currently at capacity with 0 available battery slots.");
            }

            if (dto.EnergyAmountKwh <= 0)
            {
                throw new ArgumentException("Energy quota must be greater than 0 kWh.");
            }

            if (dto.EnergyAmountKwh > station.CapacityKwh)
            {
                throw new ArgumentException($"Requested energy quota ({dto.EnergyAmountKwh} kWh) exceeds station total capacity ({station.CapacityKwh} kWh).");
            }

            // Business Rule: a drop-off cannot exceed what the prosumer's panels produce in a day
            EnsureWithinSolarCapacity(prosumer, dto.TradeType, dto.EnergyAmountKwh);

            var slotReserved = false;
            var slotId = dto.SlotId?.Trim() ?? string.Empty;

            var localScheduled = TimeZoneInfo.ConvertTimeFromUtc(scheduledUtc, BookingTimeZone);
            var dateStr = localScheduled.ToString("yyyy-MM-dd");
            var timeStr = localScheduled.ToString("HH:mm");

            // If slotId is omitted, auto-discover matching slot for this hub by date and hour window
            if (string.IsNullOrEmpty(slotId))
            {
                var matchingSlot = await _context.Slots.Find(s =>
                    s.StationId == station.Id &&
                    s.Date == dateStr &&
                    string.Compare(s.StartTime, timeStr) <= 0 &&
                    string.Compare(s.EndTime, timeStr) > 0 &&
                    s.AvailableSlots > 0 &&
                    s.Status != "Maintenance"
                ).FirstOrDefaultAsync();

                if (matchingSlot != null)
                {
                    slotId = matchingSlot.Id ?? string.Empty;
                }
            }

            if (!string.IsNullOrEmpty(slotId))
            {
                var targetSlot = await _context.Slots.Find(s => s.Id == slotId && s.StationId == station.Id).FirstOrDefaultAsync();
                if (targetSlot != null)
                {
                    if (targetSlot.Status == "Maintenance")
                    {
                        throw new InvalidOperationException("The requested energy trading slot is currently undergoing maintenance.");
                    }
                    if (targetSlot.AvailableSlots <= 0)
                    {
                        throw new InvalidOperationException("The requested energy trading slot is fully booked.");
                    }
                    if (targetSlot.SlotCapacityKwh > 0 && (targetSlot.AllocatedKwh + dto.EnergyAmountKwh) > targetSlot.SlotCapacityKwh)
                    {
                        var remainingKwh = Math.Max(0, targetSlot.SlotCapacityKwh - targetSlot.AllocatedKwh);
                        throw new InvalidOperationException($"Requested energy quota ({dto.EnergyAmountKwh} kWh) exceeds remaining capacity ({remainingKwh:F1} kWh) in this trading slot.");
                    }

                    var newAvailable = targetSlot.AvailableSlots - 1;
                    var newStatus = newAvailable <= 0 ? "Full" : "Open";

                    var slotFilter = Builders<EnergySlot>.Filter.And(
                        Builders<EnergySlot>.Filter.Eq(s => s.Id, slotId),
                        Builders<EnergySlot>.Filter.Eq(s => s.StationId, station.Id),
                        Builders<EnergySlot>.Filter.Gt(s => s.AvailableSlots, 0),
                        Builders<EnergySlot>.Filter.Ne(s => s.Status, "Maintenance"));
                    var slotUpdate = Builders<EnergySlot>.Update
                        .Inc(s => s.AvailableSlots, -1)
                        .Inc(s => s.AllocatedKwh, dto.EnergyAmountKwh)
                        .Set(s => s.Status, newStatus);
                    var slotResult = await _context.Slots.UpdateOneAsync(slotFilter, slotUpdate);
                    if (slotResult.ModifiedCount == 1)
                    {
                        slotReserved = true;
                    }
                }
            }

            var reservation = new EnergyReservation
            {
                ReservationNumber = $"RES-{Random.Shared.Next(10000000, 99999999)}",
                ProsumerNic = dto.ProsumerNic,
                StationId = station.Id!,
                StationName = station.Name,
                SlotId = slotId,
                ScheduledDateTime = scheduledUtc,
                EnergyAmountKwh = dto.EnergyAmountKwh,
                TradeType = dto.TradeType,
                Status = !string.IsNullOrEmpty(_settings.DefaultBookingStatus) ? _settings.DefaultBookingStatus : "Pending",
                QrCodeToken = string.Empty,
                SlotReserved = slotReserved,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            try
            {
                await _context.Reservations.InsertOneAsync(reservation);
            }
            catch
            {
                if (slotReserved && !string.IsNullOrEmpty(slotId))
                {
                    await _context.Slots.UpdateOneAsync(
                        s => s.Id == slotId && s.StationId == station.Id,
                        Builders<EnergySlot>.Update
                            .Inc(s => s.AvailableSlots, 1)
                            .Inc(s => s.AllocatedKwh, -dto.EnergyAmountKwh));
                }
                throw;
            }
            return reservation;
        }

        public async Task<EnergyReservation> UpdateReservationAsync(string id, string requestingNic, UpdateReservationDto dto)
        {
            // Method: UpdateReservationAsync - Enforces 12-hour modification rule and validates updated schedule within 7 days.
            var reservation = await _context.Reservations.Find(BuildIdOrResNumberFilter(id)).FirstOrDefaultAsync();
            if (reservation == null)
            {
                throw new KeyNotFoundException("Reservation not found.");
            }

            // Prosumer ownership check
            if (!string.IsNullOrEmpty(requestingNic) && reservation.ProsumerNic != requestingNic)
            {
                throw new UnauthorizedAccessException("Unauthorized to modify another user's reservation.");
            }

            if (reservation.Status == "Cancelled" || reservation.Status == "Completed")
            {
                throw new InvalidOperationException($"Cannot modify a reservation that is already {reservation.Status}.");
            }

            var modNoticeHours = _settings.ModificationNoticeHours > 0 ? _settings.ModificationNoticeHours : 12;
            var maxDays = _settings.MaxAdvanceBookingDays > 0 ? _settings.MaxAdvanceBookingDays : 7;
            var graceMinutes = _settings.GracePeriodMinutes >= 0 ? _settings.GracePeriodMinutes : 10;
            var scheduledUtc = dto.ScheduledDateTime.ToUniversalTime();
            var resScheduledUtc = reservation.ScheduledDateTime.ToUniversalTime();

            // Business Rule: Updates require at least configurable hours notice (default: 12h) prior to original scheduled time
            var hoursNotice = (resScheduledUtc - DateTime.UtcNow).TotalHours;
            if (hoursNotice < modNoticeHours)
            {
                throw new InvalidOperationException($"Modifications require at least {modNoticeHours} hours' notice. Only {hoursNotice:F1} hours remain before scheduled time.");
            }

            // Business Rule: Updated schedule must also be within the 7-day booking window
            var now = DateTime.UtcNow;
            var maxModWindowUtc = GetBookingWindowEndUtc(maxDays);
            if (scheduledUtc < now.AddMinutes(-graceMinutes) || scheduledUtc >= maxModWindowUtc)
            {
                throw new ArgumentException($"Updated reservation must be scheduled within {maxDays} days from today.");
            }

            // Business Rule: the edited booking must pass the same hub checks as a new booking
            if (dto.EnergyAmountKwh <= 0)
            {
                throw new ArgumentException("Energy quota must be greater than 0 kWh.");
            }

            var station = await _context.Stations.Find(s => s.Id == reservation.StationId).FirstOrDefaultAsync();
            if (station == null)
            {
                throw new KeyNotFoundException("Microgrid solar station not found.");
            }
            if (!station.IsActive)
            {
                throw new InvalidOperationException("The requested solar hub is currently deactivated.");
            }
            if (dto.EnergyAmountKwh > station.CapacityKwh)
            {
                throw new ArgumentException($"Requested energy quota ({dto.EnergyAmountKwh} kWh) exceeds station total capacity ({station.CapacityKwh} kWh).");
            }

            // Business Rule: a drop-off cannot exceed what the prosumer's panels produce in a day
            var prosumer = await _context.Users.Find(u => u.Nic == reservation.ProsumerNic).FirstOrDefaultAsync();
            if (prosumer != null)
            {
                EnsureWithinSolarCapacity(prosumer, dto.TradeType, dto.EnergyAmountKwh);
            }

            // Switching to a drop-off needs a free battery slot (an approved booking must also respect slots promised to others)
            if (dto.TradeType == "DropOff" && reservation.TradeType != "DropOff")
            {
                if (reservation.Status == "Approved")
                {
                    await EnsureDropOffSlotAvailableAsync(station, reservation.Id);
                }
                else if (station.AvailableBatterySlots <= 0)
                {
                    throw new InvalidOperationException($"The solar hub '{station.Name}' is currently at capacity with 0 available battery slots.");
                }
            }

            var originalEnergyKwh = reservation.EnergyAmountKwh;
            var update = Builders<EnergyReservation>.Update
                .Set(r => r.ScheduledDateTime, scheduledUtc)
                .Set(r => r.EnergyAmountKwh, dto.EnergyAmountKwh)
                .Set(r => r.TradeType, dto.TradeType)
                .Set(r => r.UpdatedAt, DateTime.UtcNow);

            reservation.ScheduledDateTime = scheduledUtc;
            reservation.EnergyAmountKwh = dto.EnergyAmountKwh;
            reservation.TradeType = dto.TradeType;

            // Only an approved booking has a QR pass. Its signature covers the schedule and energy, so it must be
            // re-issued (the prosumer's app shows the new pass after a refresh). Pending bookings get a token on approval.
            if (reservation.Status == "Approved")
            {
                var newQr = GenerateSecureQrToken(reservation);
                update = update.Set(r => r.QrCodeToken, newQr);
                reservation.QrCodeToken = newQr;
            }

            await _context.Reservations.UpdateOneAsync(r => r.Id == reservation.Id, update);

            // Check if slot migration is needed
            var targetSlotId = dto.SlotId?.Trim();
            if (string.IsNullOrEmpty(targetSlotId) && scheduledUtc != resScheduledUtc)
            {
                var localNew = TimeZoneInfo.ConvertTimeFromUtc(scheduledUtc, BookingTimeZone);
                var newDateStr = localNew.ToString("yyyy-MM-dd");
                var newTimeStr = localNew.ToString("HH:mm");
                var autoSlot = await _context.Slots.Find(s =>
                    s.StationId == reservation.StationId &&
                    s.Date == newDateStr &&
                    string.Compare(s.StartTime, newTimeStr) <= 0 &&
                    string.Compare(s.EndTime, newTimeStr) > 0 &&
                    s.AvailableSlots > 0 &&
                    s.Status != "Maintenance"
                ).FirstOrDefaultAsync();
                if (autoSlot != null)
                {
                    targetSlotId = autoSlot.Id;
                }
            }

            var slotChanged = !string.IsNullOrEmpty(targetSlotId) && targetSlotId != reservation.SlotId;

            if (slotChanged)
            {
                var newSlot = await _context.Slots.Find(s => s.Id == targetSlotId && s.StationId == reservation.StationId).FirstOrDefaultAsync();
                if (newSlot == null)
                {
                    throw new KeyNotFoundException("Target energy trading slot not found.");
                }
                if (newSlot.Status == "Maintenance")
                {
                    throw new InvalidOperationException("Target energy trading slot is under maintenance.");
                }
                if (newSlot.AvailableSlots <= 0)
                {
                    throw new InvalidOperationException("Target energy trading slot is fully booked.");
                }
                if (newSlot.SlotCapacityKwh > 0 && (newSlot.AllocatedKwh + dto.EnergyAmountKwh) > newSlot.SlotCapacityKwh)
                {
                    var rem = Math.Max(0, newSlot.SlotCapacityKwh - newSlot.AllocatedKwh);
                    throw new InvalidOperationException($"Requested energy quota exceeds target slot remaining capacity ({rem:F1} kWh).");
                }

                // Release previous slot if reserved
                if (reservation.SlotReserved && !string.IsNullOrEmpty(reservation.SlotId))
                {
                    await ReleaseSlotAsync(reservation);
                }

                // Reserve new slot
                var newAvail = newSlot.AvailableSlots - 1;
                var newStat = newAvail <= 0 ? "Full" : "Open";
                await _context.Slots.UpdateOneAsync(
                    s => s.Id == newSlot.Id,
                    Builders<EnergySlot>.Update
                        .Inc(s => s.AvailableSlots, -1)
                        .Inc(s => s.AllocatedKwh, dto.EnergyAmountKwh)
                        .Set(s => s.Status, newStat));

                reservation.SlotId = newSlot.Id!;
                reservation.SlotReserved = true;
                update = update.Set(r => r.SlotId, newSlot.Id!).Set(r => r.SlotReserved, true);
            }
            else if (reservation.SlotReserved && !string.IsNullOrEmpty(reservation.SlotId))
            {
                // Slot didn't change: update energy delta
                var energyDeltaKwh = dto.EnergyAmountKwh - originalEnergyKwh;
                if (energyDeltaKwh != 0)
                {
                    await _context.Slots.UpdateOneAsync(
                        s => s.Id == reservation.SlotId && s.StationId == reservation.StationId,
                        Builders<EnergySlot>.Update.Inc(s => s.AllocatedKwh, energyDeltaKwh));
                }
            }

            return reservation;
        }

        public async Task<bool> CancelReservationAsync(string id, string requestingNic, string userRole, string reason)
        {
            // Method: CancelReservationAsync - Enforces 12-hour cancellation notice for prosumers, with override permitted for grid operators.
            var reservation = await _context.Reservations.Find(BuildIdOrResNumberFilter(id)).FirstOrDefaultAsync();
            if (reservation == null)
            {
                throw new KeyNotFoundException("Reservation not found.");
            }

            if (reservation.Status == "Cancelled" || reservation.Status == "Completed")
            {
                throw new InvalidOperationException($"Reservation is already {reservation.Status}.");
            }

            var cancelNoticeHours = _settings.CancellationNoticeHours > 0 ? _settings.CancellationNoticeHours : 12;
            var resScheduledUtc = reservation.ScheduledDateTime.ToUniversalTime();

            // If requested by prosumer, enforce strict 12-hour rule
            if (userRole == "Prosumer" || (!string.IsNullOrEmpty(requestingNic) && userRole != "GridOperator" && userRole != "Backoffice"))
            {
                var hoursNotice = (resScheduledUtc - DateTime.UtcNow).TotalHours;
                if (hoursNotice < cancelNoticeHours)
                {
                    throw new InvalidOperationException($"Cancellations require at least {cancelNoticeHours} hours' notice. Only {hoursNotice:F1} hours remain before scheduled time.");
                }
            }

            var update = Builders<EnergyReservation>.Update
                .Set(r => r.Status, "Cancelled")
                .Set(r => r.CancellationReason, reason)
                .Set(r => r.SlotReserved, false)
                .Set(r => r.UpdatedAt, DateTime.UtcNow);

            var result = await _context.Reservations.UpdateOneAsync(r => r.Id == reservation.Id, update);
            if (result.ModifiedCount > 0)
            {
                if (reservation.SlotReserved && !string.IsNullOrEmpty(reservation.SlotId))
                {
                    await ReleaseSlotAsync(reservation);
                }
                return true;
            }
            return false;
        }

        public async Task<EnergyReservation> ApproveReservationAsync(string id)
        {
            // Method: ApproveReservationAsync - Transitions pending reservation to approved and issues QR code.
            var reservation = await _context.Reservations.Find(BuildIdOrResNumberFilter(id)).FirstOrDefaultAsync();
            if (reservation == null)
            {
                throw new KeyNotFoundException("Reservation not found.");
            }

            if (!string.Equals(reservation.Status, "Pending", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException(
                    $"Only pending reservations can be approved. Current status is '{reservation.Status}'.");
            }

            // Business Rule: an appointment that has already gone by can only be cancelled, not approved
            var graceMinutes = _settings.GracePeriodMinutes >= 0 ? _settings.GracePeriodMinutes : 10;
            if (reservation.ScheduledDateTime.ToUniversalTime() < DateTime.UtcNow.AddMinutes(-graceMinutes))
            {
                throw new InvalidOperationException("This booking's scheduled time has already passed. Cancel it instead of approving it.");
            }

            // Re-check the prosumer and the hub: either may have changed since the booking was made
            var prosumer = await _context.Users.Find(u => u.Nic == reservation.ProsumerNic).FirstOrDefaultAsync();
            if (prosumer == null || prosumer.Status != "Active")
            {
                throw new InvalidOperationException(
                    $"Cannot approve: the prosumer account is '{prosumer?.Status ?? "missing"}'. Only Active accounts can trade energy.");
            }

            var station = await _context.Stations.Find(s => s.Id == reservation.StationId).FirstOrDefaultAsync();
            if (station == null)
            {
                throw new KeyNotFoundException("Microgrid solar station not found.");
            }
            if (!station.IsActive)
            {
                throw new InvalidOperationException($"Cannot approve: the solar hub '{station.Name}' is deactivated.");
            }
            if (reservation.TradeType == "DropOff")
            {
                await EnsureDropOffSlotAvailableAsync(station, reservation.Id);
            }

            var qrToken = GenerateSecureQrToken(reservation);
            var update = Builders<EnergyReservation>.Update
                .Set(r => r.Status, "Approved")
                .Set(r => r.QrCodeToken, qrToken)
                .Set(r => r.UpdatedAt, DateTime.UtcNow);

            await _context.Reservations.UpdateOneAsync(r => r.Id == reservation.Id, update);
            reservation.Status = "Approved";
            reservation.QrCodeToken = qrToken;
            return reservation;
        }

        public async Task<EnergyReservation> VerifyAndFinalizeQrAsync(VerifyQrRequestDto dto, string operatorNic)
        {
            // Method: VerifyAndFinalizeQrAsync - Operator mode endpoint that verifies scanned QR payload and finalizes energy transfer.
            var token = dto.QrCodeToken?.Trim() ?? string.Empty;
            if (string.IsNullOrEmpty(token))
            {
                throw new ArgumentException("QR Code token is required.");
            }

            if (!IsWellFormedQrToken(token))
            {
                throw new InvalidOperationException("Invalid QR token format/signature.");
            }

            var reservation = await _context.Reservations
                .Find(r => r.QrCodeToken == token)
                .FirstOrDefaultAsync();

            if (reservation == null)
            {
                throw new KeyNotFoundException("Invalid QR Code. No matching reservation record found.");
            }

            if (!ValidateQrSignature(reservation, token))
            {
                throw new InvalidOperationException("Invalid QR token format/signature.");
            }

            if (!string.IsNullOrWhiteSpace(dto.StationId) &&
                !string.Equals(reservation.StationId, dto.StationId.Trim(), StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException("QR token does not belong to the selected station.");
            }

            if (reservation.Status != "Approved")
            {
                throw new InvalidOperationException($"Transaction cannot be finalized. Current status is '{reservation.Status}' (Expected: 'Approved').");
            }

            var now = DateTime.UtcNow;
            var opNic = !string.IsNullOrWhiteSpace(operatorNic) ? operatorNic.Trim() : "OPERATOR";
            var update = Builders<EnergyReservation>.Update
                .Set(r => r.Status, "Completed")
                .Set(r => r.CompletedAt, now)
                .Set(r => r.CompletedByOperatorNic, opNic)
                .Set(r => r.UpdatedAt, now);

            await _context.Reservations.UpdateOneAsync(r => r.Id == reservation.Id, update);
            reservation.Status = "Completed";
            reservation.CompletedAt = now;
            reservation.CompletedByOperatorNic = opNic;

            if (reservation.SlotReserved && !string.IsNullOrEmpty(reservation.SlotId))
            {
                await ReleaseSlotAsync(reservation);
            }

            // Update station available battery slot if charging/dropoff completed
            if (!string.IsNullOrEmpty(reservation.StationId))
            {
                var station = await _context.Stations.Find(s => s.Id == reservation.StationId).FirstOrDefaultAsync();
                if (station != null)
                {
                    if (reservation.TradeType == "DropOff" && station.AvailableBatterySlots > 0)
                    {
                        var slotUpdate = Builders<SolarStation>.Update.Inc(s => s.AvailableBatterySlots, -1);
                        await _context.Stations.UpdateOneAsync(s => s.Id == station.Id, slotUpdate);
                    }
                    else if (reservation.TradeType == "Charging" || reservation.TradeType == "PickUp")
                    {
                        var availableSlots = Math.Min(station.TotalBatterySlots, station.AvailableBatterySlots + 1);
                        await _context.Stations.UpdateOneAsync(s => s.Id == station.Id, Builders<SolarStation>.Update.Set(s => s.AvailableBatterySlots, availableSlots));
                    }
                }
            }

            return reservation;
        }

        private async Task ReleaseSlotAsync(EnergyReservation reservation)
        {
            // Method: ReleaseSlotAsync - Reclaims slot capacity when a reservation is cancelled or rescheduled.
            if (string.IsNullOrEmpty(reservation.SlotId)) return;
            var slotFilter = Builders<EnergySlot>.Filter.And(
                Builders<EnergySlot>.Filter.Eq(s => s.Id, reservation.SlotId),
                Builders<EnergySlot>.Filter.Eq(s => s.StationId, reservation.StationId));

            var slot = await _context.Slots.Find(slotFilter).FirstOrDefaultAsync();
            if (slot != null)
            {
                var newStatus = slot.Status == "Maintenance" ? "Maintenance" : "Open";
                var slotUpdate = Builders<EnergySlot>.Update
                    .Inc(s => s.AvailableSlots, 1)
                    .Inc(s => s.AllocatedKwh, -reservation.EnergyAmountKwh)
                    .Set(s => s.Status, newStatus);
                await _context.Slots.UpdateOneAsync(slotFilter, slotUpdate);
            }

            await _context.Reservations.UpdateOneAsync(
                r => r.Id == reservation.Id,
                Builders<EnergyReservation>.Update.Set(r => r.SlotReserved, false));
        }

        public async Task<List<EnergyReservation>> GetProsumerReservationsAsync(string nic)
        {
            // Method: GetProsumerReservationsAsync - Retrieves all booking records for a given prosumer NIC.
            return await _context.Reservations
                .Find(r => r.ProsumerNic == nic)
                .SortByDescending(r => r.ScheduledDateTime)
                .ToListAsync();
        }

        public async Task<List<EnergyReservation>> GetAllReservationsAsync(string? stationId = null, string? status = null, string? nic = null)
        {
            // Method: GetAllReservationsAsync - Searches reservations with station, status, and prosumer filters.
            var builder = Builders<EnergyReservation>.Filter;
            var filter = builder.Empty;

            if (!string.IsNullOrEmpty(stationId))
            {
                filter &= builder.Eq(r => r.StationId, stationId);
            }
            if (!string.IsNullOrEmpty(status))
            {
                filter &= builder.Eq(r => r.Status, status);
            }
            if (!string.IsNullOrEmpty(nic))
            {
                filter &= builder.Eq(r => r.ProsumerNic, nic);
            }

            return await _context.Reservations
                .Find(filter)
                .SortByDescending(r => r.ScheduledDateTime)
                .ToListAsync();
        }

        public async Task<EnergyReservation?> GetReservationByIdAsync(string id)
        {
            // Method: GetReservationByIdAsync - Fetches a single reservation by ID or ReservationNumber.
            return await _context.Reservations.Find(BuildIdOrResNumberFilter(id)).FirstOrDefaultAsync();
        }

        private static FilterDefinition<EnergyReservation> BuildIdOrResNumberFilter(string id)
        {
            // Method: BuildIdOrResNumberFilter - Resolves entity ID or human-readable ReservationNumber filter.
            if (MongoDB.Bson.ObjectId.TryParse(id, out _))
            {
                return Builders<EnergyReservation>.Filter.Or(
                    Builders<EnergyReservation>.Filter.Eq(r => r.Id, id),
                    Builders<EnergyReservation>.Filter.Eq(r => r.ReservationNumber, id)
                );
            }
            return Builders<EnergyReservation>.Filter.Eq(r => r.ReservationNumber, id);
        }

        public async Task<DashboardStatsDto> GetDashboardStatsAsync(string? nic = null)
        {
            // Method: GetDashboardStatsAsync - Computes live metrics for operational dashboard (active, pending, future counts).
            var now = DateTime.UtcNow;

            var pendingFilter = Builders<EnergyReservation>.Filter.Eq(r => r.Status, "Pending");
            var approvedFutureFilter = Builders<EnergyReservation>.Filter.And(
                Builders<EnergyReservation>.Filter.Eq(r => r.Status, "Approved"),
                Builders<EnergyReservation>.Filter.Gte(r => r.ScheduledDateTime, now)
            );
            var completedFilter = Builders<EnergyReservation>.Filter.Eq(r => r.Status, "Completed");

            if (!string.IsNullOrEmpty(nic))
            {
                pendingFilter &= Builders<EnergyReservation>.Filter.Eq(r => r.ProsumerNic, nic);
                approvedFutureFilter &= Builders<EnergyReservation>.Filter.Eq(r => r.ProsumerNic, nic);
                completedFilter &= Builders<EnergyReservation>.Filter.Eq(r => r.ProsumerNic, nic);
            }

            var pendingCount = (int)await _context.Reservations.CountDocumentsAsync(pendingFilter);
            var approvedFutureCount = (int)await _context.Reservations.CountDocumentsAsync(approvedFutureFilter);
            var completedCount = (int)await _context.Reservations.CountDocumentsAsync(completedFilter);

            var totalStations = (int)await _context.Stations.CountDocumentsAsync(s => s.IsActive);
            var activeProsumers = (int)await _context.Users.CountDocumentsAsync(u => u.Role == "Prosumer" && u.Status == "Active");
            var pendingProsumers = (int)await _context.Users.CountDocumentsAsync(u => u.Role == "Prosumer" && u.Status == "Pending");

            return new DashboardStatsDto
            {
                PendingBookingsCount = pendingCount,
                ApprovedFutureBookingsCount = approvedFutureCount,
                ActiveBookingsCount = approvedFutureCount,
                TotalCompletedBookingsCount = completedCount,
                TotalStationsCount = totalStations,
                ActiveProsumersCount = activeProsumers,
                PendingProsumersCount = pendingProsumers
            };
        }

        private string GenerateSecureQrToken(EnergyReservation reservation)
        {
            // Method: GenerateSecureQrToken - Creates tamper-resistant signed string for mobile QR rendering and operator scanning.
            var raw = $"{reservation.ReservationNumber}|{reservation.ProsumerNic}|{reservation.StationId}|{reservation.ScheduledDateTime:yyyyMMddHHmm}|{reservation.EnergyAmountKwh}";
            using var hmac = new HMACSHA256(
    Encoding.UTF8.GetBytes(_qrSigningSecret));
            var hashBytes = hmac.ComputeHash(Encoding.UTF8.GetBytes(raw));
            var sig = Convert.ToHexString(hashBytes)[..12];
            return $"SOLAR-TX:{reservation.ReservationNumber}:{sig}";
        }

        private bool ValidateQrSignature(EnergyReservation reservation, string token)
        {
            // Method: ValidateQrSignature - Authenticates QR payload cryptographic signature using constant-time equality check.
            if (!IsWellFormedQrToken(token))
            {
                return false;
            }

            var expectedToken = GenerateSecureQrToken(reservation);
            var expectedBytes = Encoding.UTF8.GetBytes(expectedToken);
            var actualBytes = Encoding.UTF8.GetBytes(token);

            return expectedBytes.Length == actualBytes.Length &&
                   CryptographicOperations.FixedTimeEquals(expectedBytes, actualBytes);
        }

        private static bool IsWellFormedQrToken(string token)
        {
            // Method: IsWellFormedQrToken - Validates format structure of incoming QR scanned token string.
            var parts = token.Split(':');
            return parts.Length == 3 &&
                   parts[0] == "SOLAR-TX" &&
                   parts[1].StartsWith("RES-", StringComparison.Ordinal) &&
                   parts[2].Length == 12 &&
                   parts[2].All(Uri.IsHexDigit);
        }
    }
}