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
using MongoDB.Driver;
using SolarMicrogridApi.Data;
using SolarMicrogridApi.Models;

namespace SolarMicrogridApi.Services
{
    /// <summary>
    /// Implements enterprise business logic for power trading bookings in the "Energy Reservation" collection.
    /// </summary>
    public class ReservationService : IReservationService
    {
        private readonly MongoDbContext _context;
        private readonly string _qrSigningSecret;

        public ReservationService(MongoDbContext context, IConfiguration configuration)
        {
            // Method: ReservationService Constructor - Injects MongoDbContext.
            _context = context;
            _qrSigningSecret = configuration["QrSettings:SigningSecret"] ?? string.Empty;
        }

        public async Task<EnergyReservation> CreateReservationAsync(CreateReservationDto dto)
        {
            // Method: CreateReservationAsync - Validates 7-day scheduling constraint, verifies prosumer/station state, and creates booking.
            var now = DateTime.UtcNow;

            // Business Rule: Scheduled within 7 days
            if (dto.ScheduledDateTime < now.AddMinutes(-10) || dto.ScheduledDateTime > now.AddDays(7))
            {
                throw new ArgumentException("Power trading reservations must be scheduled within 7 days from today.");
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

            var slotReserved = false;
            var slotId = dto.SlotId?.Trim() ?? string.Empty;
            if (!string.IsNullOrEmpty(slotId))
            {
                var slotFilter = Builders<EnergySlot>.Filter.And(
                    Builders<EnergySlot>.Filter.Eq(s => s.Id, slotId),
                    Builders<EnergySlot>.Filter.Eq(s => s.StationId, station.Id),
                    Builders<EnergySlot>.Filter.Gt(s => s.AvailableSlots, 0),
                    Builders<EnergySlot>.Filter.Ne(s => s.Status, "Maintenance"));
                var slotUpdate = Builders<EnergySlot>.Update
                    .Inc(s => s.AvailableSlots, -1)
                    .Inc(s => s.AllocatedKwh, dto.EnergyAmountKwh);
                var slotResult = await _context.Slots.UpdateOneAsync(slotFilter, slotUpdate);
                if (slotResult.ModifiedCount != 1)
                {
                    throw new InvalidOperationException("The selected energy slot is unavailable.");
                }

                slotReserved = true;
            }

            var reservation = new EnergyReservation
            {
                ReservationNumber = $"RES-{Random.Shared.Next(10000000, 99999999)}",
                ProsumerNic = dto.ProsumerNic,
                StationId = station.Id!,
                StationName = station.Name,
                SlotId = slotId,
                ScheduledDateTime = dto.ScheduledDateTime,
                EnergyAmountKwh = dto.EnergyAmountKwh,
                TradeType = dto.TradeType,
                Status = "Pending", // Set as Pending until approved by Backoffice/Operator
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
                if (slotReserved)
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

            // Business Rule: Updates require at least 12 hours' notice prior to original scheduled time
            var hoursNotice = (reservation.ScheduledDateTime - DateTime.UtcNow).TotalHours;
            if (hoursNotice < 12)
            {
                throw new InvalidOperationException($"Modifications require at least 12 hours' notice. Only {hoursNotice:F1} hours remain before scheduled time.");
            }

            // Business Rule: Updated schedule must also be within 7 days from now
            var now = DateTime.UtcNow;
            if (dto.ScheduledDateTime < now.AddMinutes(-10) || dto.ScheduledDateTime > now.AddDays(7))
            {
                throw new ArgumentException("Updated reservation must be scheduled within 7 days from today.");
            }

            var update = Builders<EnergyReservation>.Update
                .Set(r => r.ScheduledDateTime, dto.ScheduledDateTime)
                .Set(r => r.EnergyAmountKwh, dto.EnergyAmountKwh)
                .Set(r => r.TradeType, dto.TradeType)
                .Set(r => r.UpdatedAt, DateTime.UtcNow);

            // Refresh QR code token with new schedule
            reservation.ScheduledDateTime = dto.ScheduledDateTime;
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

            // If requested by prosumer, enforce strict 12-hour rule
            if (userRole == "Prosumer" || (!string.IsNullOrEmpty(requestingNic) && userRole != "GridOperator" && userRole != "Backoffice"))
            {
                var hoursNotice = (reservation.ScheduledDateTime - DateTime.UtcNow).TotalHours;
                if (hoursNotice < 12)
                {
                    throw new InvalidOperationException($"Cancellations require at least 12 hours' notice. Only {hoursNotice:F1} hours remain before scheduled time.");
                }
            }

            var update = Builders<EnergyReservation>.Update
                .Set(r => r.Status, "Cancelled")
                .Set(r => r.CancellationReason, reason)
                .Set(r => r.SlotReserved, false)
                .Set(r => r.UpdatedAt, DateTime.UtcNow);

            var result = await _context.Reservations.UpdateOneAsync(
                Builders<EnergyReservation>.Filter.And(
                    Builders<EnergyReservation>.Filter.Eq(r => r.Id, reservation.Id),
                    Builders<EnergyReservation>.Filter.In(r => r.Status, new[] { "Pending", "Approved" })),
                update);
            if (result.ModifiedCount != 1)
            {
                return false;
            }

            if (reservation.SlotReserved && !string.IsNullOrEmpty(reservation.SlotId))
            {
                await ReleaseSlotAsync(reservation);
            }

            return true;
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
            if (string.IsNullOrWhiteSpace(operatorNic))
            {
                throw new UnauthorizedAccessException("Authenticated operator identity is required.");
            }

            var token = dto.QrCodeToken.Trim();
            if (!IsWellFormedQrToken(token))
            {
                throw new InvalidOperationException("Invalid QR token format.");
            }

            var reservation = await _context.Reservations
                .Find(Builders<EnergyReservation>.Filter.Eq(r => r.QrCodeToken, token))
                .FirstOrDefaultAsync();
            if (reservation == null)
            {
                throw new KeyNotFoundException("Invalid QR Code. No matching reservation record found.");
            }

            if (!ValidateQrSignature(reservation, token))
            {
                throw new InvalidOperationException("Invalid QR token signature.");
            }

            if (!string.IsNullOrWhiteSpace(dto.StationId) &&
                !string.Equals(reservation.StationId, dto.StationId.Trim(), StringComparison.Ordinal))
            {
                throw new InvalidOperationException("QR token does not belong to the selected station.");
            }

            if (reservation.Status != "Approved")
            {
                throw new InvalidOperationException($"Transaction cannot be finalized. Current status is '{reservation.Status}' (Expected: 'Approved').");
            }

            var now = DateTime.UtcNow;
            var update = Builders<EnergyReservation>.Update
                .Set(r => r.Status, "Completed")
                .Set(r => r.CompletedAt, now)
                .Set(r => r.CompletedByOperatorNic, operatorNic.Trim())
                .Set(r => r.UpdatedAt, now);

            var completionFilter = Builders<EnergyReservation>.Filter.And(
                Builders<EnergyReservation>.Filter.Eq(r => r.Id, reservation.Id),
                Builders<EnergyReservation>.Filter.Eq(r => r.QrCodeToken, token),
                Builders<EnergyReservation>.Filter.Eq(r => r.Status, "Approved"));
            var completionResult = await _context.Reservations.UpdateOneAsync(completionFilter, update);
            if (completionResult.ModifiedCount != 1)
            {
                throw new InvalidOperationException("Transaction could not be finalized because it is no longer approved.");
            }

            reservation.Status = "Completed";
            reservation.CompletedAt = now;
            reservation.CompletedByOperatorNic = operatorNic.Trim();

            if (reservation.SlotReserved && !string.IsNullOrEmpty(reservation.SlotId))
            {
                await ReleaseSlotAsync(reservation);
            }

            if (reservation.TradeType == "DropOff" && !string.IsNullOrEmpty(reservation.StationId))
            {
                var station = await _context.Stations.Find(s => s.Id == reservation.StationId).FirstOrDefaultAsync();
                if (station != null)
                {
                    var availableSlots = Math.Min(station.TotalBatterySlots, station.AvailableBatterySlots + 1);
                    await _context.Stations.UpdateOneAsync(
                        s => s.Id == station.Id,
                        Builders<SolarStation>.Update.Set(s => s.AvailableBatterySlots, availableSlots));
                }
            }

            return reservation;
        }

        private async Task ReleaseSlotAsync(EnergyReservation reservation)
        {
            var slotFilter = Builders<EnergySlot>.Filter.And(
                Builders<EnergySlot>.Filter.Eq(s => s.Id, reservation.SlotId),
                Builders<EnergySlot>.Filter.Eq(s => s.StationId, reservation.StationId));
            var slotUpdate = Builders<EnergySlot>.Update
                .Inc(s => s.AvailableSlots, 1)
                .Inc(s => s.AllocatedKwh, -reservation.EnergyAmountKwh)
                .Set(s => s.Status, "Open");
            await _context.Slots.UpdateOneAsync(slotFilter, slotUpdate);
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
            if (string.IsNullOrWhiteSpace(_qrSigningSecret))
            {
                throw new InvalidOperationException("QR signing secret is not configured.");
            }

            var raw = $"{reservation.ReservationNumber}|{reservation.ProsumerNic}|{reservation.StationId}|{reservation.ScheduledDateTime:yyyyMMddHHmm}|{reservation.EnergyAmountKwh}";
            using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(_qrSigningSecret));
            var sig = Convert.ToHexString(hmac.ComputeHash(Encoding.UTF8.GetBytes(raw)))[..12];
            return $"SOLAR-TX:{reservation.ReservationNumber}:{sig}";
        }

        private bool ValidateQrSignature(EnergyReservation reservation, string token)
        {
            var expectedToken = GenerateSecureQrToken(reservation);
            return CryptographicOperations.FixedTimeEquals(
                Encoding.UTF8.GetBytes(expectedToken),
                Encoding.UTF8.GetBytes(token));
        }

        private static bool IsWellFormedQrToken(string token)
        {
            var parts = token.Split(':');
            return parts.Length == 3 &&
                   parts[0] == "SOLAR-TX" &&
                   parts[1].StartsWith("RES-", StringComparison.Ordinal) &&
                   parts[2].Length == 12 &&
                   parts[2].All(Uri.IsHexDigit);
        }
    }
}
