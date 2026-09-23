// ============================================================================
// File: ReservationService.cs
// Project: Solvance — Smart Solar Microgrid Trading System
// Author: L.T. Jayawardhana (IT23156760)
// Course: SE4040 - Enterprise Application Development (SLIIT)
// Description: Core FAT-service enterprise logic for 7-day rule, 12-hour notice, and QR verification.
// References & Citations:
//   - MongoDB.Driver LINQ & Filter Definition Builder:
//     https://www.mongodb.com/docs/drivers/csharp/current/fundamentals/crud/read-operations/
//   - System.Security.Cryptography HMAC / SHA256 Token Signing:
//     https://learn.microsoft.com/en-us/dotnet/api/system.security.cryptography
// ============================================================================

using System.Security.Cryptography;
using System.Text;
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

        public ReservationService(MongoDbContext context, IOptions<ReservationSettings> settings)
        {
            // Method: ReservationService Constructor - Injects MongoDbContext and strongly-typed ReservationSettings options.
            _context = context;
            _settings = settings?.Value ?? new ReservationSettings();
        }

        public async Task<EnergyReservation> CreateReservationAsync(CreateReservationDto dto)
        {
            // Method: CreateReservationAsync - Validates 7-day scheduling constraint, verifies prosumer/station state, and creates booking.
            var now = DateTime.UtcNow;
            var scheduledUtc = dto.ScheduledDateTime.ToUniversalTime();
            var maxDays = _settings.MaxAdvanceBookingDays > 0 ? _settings.MaxAdvanceBookingDays : 7;
            var graceMinutes = _settings.GracePeriodMinutes >= 0 ? _settings.GracePeriodMinutes : 10;

            // Business Rule: Scheduled within configurable advance days (default: 7 days, up to end of 7th calendar day)
            var maxBookingWindowUtc = now.Date.AddDays(maxDays + 1).AddHours(14);
            if (scheduledUtc < now.AddMinutes(-graceMinutes) || scheduledUtc > maxBookingWindowUtc)
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

            var reservation = new EnergyReservation
            {
                ReservationNumber = $"RES-{Random.Shared.Next(10000000, 99999999)}",
                ProsumerNic = dto.ProsumerNic,
                StationId = station.Id!,
                StationName = station.Name,
                SlotId = dto.SlotId ?? string.Empty,
                ScheduledDateTime = scheduledUtc,
                EnergyAmountKwh = dto.EnergyAmountKwh,
                TradeType = dto.TradeType,
                Status = !string.IsNullOrEmpty(_settings.DefaultBookingStatus) ? _settings.DefaultBookingStatus : "Pending",
                QrCodeToken = string.Empty,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            await _context.Reservations.InsertOneAsync(reservation);
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

            // Business Rule: Updated schedule must also be within 7 days from now
            var now = DateTime.UtcNow;
            var maxModWindowUtc = now.Date.AddDays(maxDays + 1).AddHours(14);
            if (scheduledUtc < now.AddMinutes(-graceMinutes) || scheduledUtc > maxModWindowUtc)
            {
                throw new ArgumentException($"Updated reservation must be scheduled within {maxDays} days from today.");
            }

            var update = Builders<EnergyReservation>.Update
                .Set(r => r.ScheduledDateTime, scheduledUtc)
                .Set(r => r.EnergyAmountKwh, dto.EnergyAmountKwh)
                .Set(r => r.TradeType, dto.TradeType)
                .Set(r => r.UpdatedAt, DateTime.UtcNow);

            // Refresh QR code token with new schedule
            reservation.ScheduledDateTime = scheduledUtc;
            reservation.EnergyAmountKwh = dto.EnergyAmountKwh;
            reservation.TradeType = dto.TradeType;
            var newQr = GenerateSecureQrToken(reservation);
            update = update.Set(r => r.QrCodeToken, newQr);

            await _context.Reservations.UpdateOneAsync(r => r.Id == reservation.Id, update);
            reservation.QrCodeToken = newQr;
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
                .Set(r => r.UpdatedAt, DateTime.UtcNow);

            var result = await _context.Reservations.UpdateOneAsync(r => r.Id == reservation.Id, update);
            return result.ModifiedCount > 0;
        }

        public async Task<EnergyReservation> ApproveReservationAsync(string id)
        {
            // Method: ApproveReservationAsync - Transitions pending reservation to approved and issues QR code.
            var reservation = await _context.Reservations.Find(BuildIdOrResNumberFilter(id)).FirstOrDefaultAsync();
            if (reservation == null)
            {
                throw new KeyNotFoundException("Reservation not found.");
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
            var filter = Builders<EnergyReservation>.Filter.Or(
                Builders<EnergyReservation>.Filter.Eq(r => r.QrCodeToken, dto.QrCodeToken.Trim()),
                Builders<EnergyReservation>.Filter.Eq(r => r.ReservationNumber, dto.QrCodeToken.Trim())
            );

            var reservation = await _context.Reservations.Find(filter).FirstOrDefaultAsync();
            if (reservation == null)
            {
                throw new KeyNotFoundException("Invalid QR Code. No matching reservation record found.");
            }

            if (reservation.Status != "Approved")
            {
                throw new InvalidOperationException($"Transaction cannot be finalized. Current status is '{reservation.Status}' (Expected: 'Approved').");
            }

            var now = DateTime.UtcNow;
            var update = Builders<EnergyReservation>.Update
                .Set(r => r.Status, "Completed")
                .Set(r => r.CompletedAt, now)
                .Set(r => r.UpdatedAt, now);

            await _context.Reservations.UpdateOneAsync(r => r.Id == reservation.Id, update);
            reservation.Status = "Completed";
            reservation.CompletedAt = now;

            // Update station available battery slot if charging/dropoff completed
            if (!string.IsNullOrEmpty(reservation.StationId))
            {
                var station = await _context.Stations.Find(s => s.Id == reservation.StationId).FirstOrDefaultAsync();
                if (station != null && station.AvailableBatterySlots > 0 && reservation.TradeType == "DropOff")
                {
                    var slotUpdate = Builders<SolarStation>.Update.Inc(s => s.AvailableBatterySlots, -1);
                    await _context.Stations.UpdateOneAsync(s => s.Id == station.Id, slotUpdate);
                }
            }

            return reservation;
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
            var salt = !string.IsNullOrEmpty(_settings.QrSecretSalt) ? _settings.QrSecretSalt : "EnterpriseMicrogridSecretSalt2026";
            using var sha = SHA256.Create();
            var hashBytes = sha.ComputeHash(Encoding.UTF8.GetBytes(raw + salt));
            var sig = Convert.ToHexString(hashBytes)[..12];
            return $"SOLAR-TX:{reservation.ReservationNumber}:{sig}";
        }
    }
}
