// ============================================================================
// File: ReservationService.cs
// Project: Smart Solar Microgrid Trading System
// Author: Enterprise Application Development Team
// Description: Implements FAT business rules for energy reservations (7-day window, 12-hour notice, QR verification).
// ============================================================================

using MongoDB.Driver;
using SolarMicrogridApi.Data;
using SolarMicrogridApi.Models;

namespace SolarMicrogridApi.Services
{
    /// <summary>
    /// Core FAT Service implementing domain business logic for microgrid trading bookings.
    /// Strictly validates:
    ///  1. 7-Day Maximum Future Booking Schedule Window.
    ///  2. 12-Hour Minimum Notice on Modifications and Cancellations.
    ///  3. QR Code generation, Operator validation, and job completion.
    /// </summary>
    public class ReservationService : IReservationService
    {
        private readonly MongoDbContext _context;

        public ReservationService(MongoDbContext context)
        {
            // Method: ReservationService Constructor - Injects database context.
            _context = context;
        }

        public async Task<List<EnergyReservation>> GetAllReservationsAsync(string? status = null, string? prosumerNic = null, string? stationId = null)
        {
            // Method: GetAllReservationsAsync - Queries all energy slot bookings with multi-parameter filtering.
            var builder = Builders<EnergyReservation>.Filter;
            var filter = builder.Empty;

            if (!string.IsNullOrEmpty(status))
            {
                filter &= builder.Eq(r => r.Status, status);
            }
            if (!string.IsNullOrEmpty(prosumerNic))
            {
                filter &= builder.Eq(r => r.ProsumerNic, prosumerNic);
            }
            if (!string.IsNullOrEmpty(stationId))
            {
                filter &= builder.Eq(r => r.StationId, stationId);
            }

            return await _context.Reservations.Find(filter)
                .SortByDescending(r => r.ScheduledDateTime)
                .ToListAsync();
        }

        public async Task<List<EnergyReservation>> GetProsumerReservationsAsync(string prosumerNic)
        {
            // Method: GetProsumerReservationsAsync - Fetches complete booking history and pending slots for a specific prosumer.
            return await _context.Reservations.Find(r => r.ProsumerNic == prosumerNic)
                .SortByDescending(r => r.ScheduledDateTime)
                .ToListAsync();
        }

        public async Task<EnergyReservation?> GetReservationByIdAsync(string id)
        {
            // Method: GetReservationByIdAsync - Fetches a single reservation by MongoDB ObjectId.
            return await _context.Reservations.Find(r => r.Id == id).FirstOrDefaultAsync();
        }

        public async Task<EnergyReservation?> GetReservationByQrTokenAsync(string qrToken)
        {
            // Method: GetReservationByQrTokenAsync - Looks up booking record by cryptographic QR token.
            return await _context.Reservations.Find(r => r.QrCodeToken == qrToken).FirstOrDefaultAsync();
        }

        public async Task<EnergyReservation> CreateReservationAsync(CreateReservationDto dto)
        {
            // Method: CreateReservationAsync - Books a power trading slot. Enforces 7-Day Future Limit Rule and Prosumer status.
            var now = DateTime.UtcNow;

            // 1. Validate Prosumer account exists and is Active
            var prosumer = await _context.Users.Find(u => u.Nic == dto.ProsumerNic).FirstOrDefaultAsync();
            if (prosumer == null)
            {
                throw new InvalidOperationException($"Prosumer with NIC '{dto.ProsumerNic}' not found.");
            }
            if (prosumer.Status != "Active")
            {
                throw new InvalidOperationException($"Prosumer account '{dto.ProsumerNic}' is {prosumer.Status}. Only Active accounts can reserve energy trading slots.");
            }

            // 2. Validate Microgrid Station exists and is Active
            var station = await _context.Stations.Find(s => s.Id == dto.StationId || s.StationCode == dto.StationId).FirstOrDefaultAsync();
            if (station == null)
            {
                throw new InvalidOperationException($"Microgrid node '{dto.StationId}' not found.");
            }
            if (!station.IsActive)
            {
                throw new InvalidOperationException($"Microgrid node '{station.Name}' is currently inactive.");
            }

            // 3. FAT Rule 1: Energy trading reservations must be scheduled within 7 days
            var scheduleUtc = dto.ScheduledDateTime.ToUniversalTime();
            var maxAllowedDate = now.AddDays(7);

            if (scheduleUtc < now.AddMinutes(-10)) // Allow small clock skew
            {
                throw new ArgumentException("Reservation schedule cannot be in the past.");
            }

            if (scheduleUtc > maxAllowedDate)
            {
                throw new ArgumentException($"Reservations must be scheduled within 7 days (maximum allowed: {maxAllowedDate:yyyy-MM-dd HH:mm} UTC).");
            }

            // Generate unique human-readable reservation number and secure QR token
            var randomSuffix = new Random().Next(1000, 9999);
            var reservationNumber = $"RES-{DateTime.UtcNow:yyMMdd}-{randomSuffix}";
            var qrToken = $"SLV-{Guid.NewGuid():N}".ToUpper();

            var reservation = new EnergyReservation
            {
                ReservationNumber = reservationNumber,
                ProsumerNic = dto.ProsumerNic.Trim().ToUpper(),
                StationId = station.Id ?? station.StationCode,
                StationName = station.Name,
                SlotId = dto.SlotId ?? "STANDARD-SLOT",
                ScheduledDateTime = scheduleUtc,
                EnergyAmountKwh = dto.EnergyAmountKwh,
                TradeType = dto.TradeType == "Charging" ? "Charging" : "DropOff",
                Status = "Approved",
                QrCodeToken = qrToken,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            await _context.Reservations.InsertOneAsync(reservation);
            return reservation;
        }

        public async Task<bool> UpdateReservationAsync(string id, UpdateReservationDto dto, string requesterNic, string requesterRole)
        {
            // Method: UpdateReservationAsync - Modifies existing booking. Enforces 12-Hour Notice Rule and 7-Day Limit.
            var reservation = await _context.Reservations.Find(r => r.Id == id).FirstOrDefaultAsync();
            if (reservation == null)
            {
                return false;
            }

            // Verify permission
            if (requesterRole != "Backoffice" && requesterRole != "GridOperator" && reservation.ProsumerNic != requesterNic)
            {
                throw new UnauthorizedAccessException("You are not authorized to modify this reservation.");
            }

            if (reservation.Status != "Approved" && reservation.Status != "Pending")
            {
                throw new InvalidOperationException($"Cannot modify reservation in '{reservation.Status}' status.");
            }

            var now = DateTime.UtcNow;

            // FAT Rule 2: Updates require at least 12 hours' notice
            var hoursRemaining = (reservation.ScheduledDateTime - now).TotalHours;
            if (hoursRemaining < 12)
            {
                throw new InvalidOperationException($"Updates require at least 12 hours' notice. Only {hoursRemaining:F1} hours remaining until the scheduled time.");
            }

            // Validate new schedule time is within 7 days
            var newScheduleUtc = dto.ScheduledDateTime.ToUniversalTime();
            var maxAllowedDate = now.AddDays(7);
            if (newScheduleUtc < now.AddMinutes(5))
            {
                throw new ArgumentException("New scheduled time cannot be in the past.");
            }
            if (newScheduleUtc > maxAllowedDate)
            {
                throw new ArgumentException($"Updated reservation must be scheduled within 7 days (maximum allowed: {maxAllowedDate:yyyy-MM-dd HH:mm} UTC).");
            }

            var update = Builders<EnergyReservation>.Update
                .Set(r => r.ScheduledDateTime, newScheduleUtc)
                .Set(r => r.EnergyAmountKwh, dto.EnergyAmountKwh)
                .Set(r => r.TradeType, dto.TradeType == "Charging" ? "Charging" : "DropOff")
                .Set(r => r.UpdatedAt, DateTime.UtcNow);

            var result = await _context.Reservations.UpdateOneAsync(r => r.Id == id, update);
            return result.ModifiedCount > 0;
        }

        public async Task<bool> CancelReservationAsync(string id, string reason, string requesterNic, string requesterRole)
        {
            // Method: CancelReservationAsync - Cancels power trading booking. Enforces 12-Hour Notice Rule unless performed by Grid Operator/Admin.
            var reservation = await _context.Reservations.Find(r => r.Id == id).FirstOrDefaultAsync();
            if (reservation == null)
            {
                return false;
            }

            if (requesterRole != "Backoffice" && requesterRole != "GridOperator" && reservation.ProsumerNic != requesterNic)
            {
                throw new UnauthorizedAccessException("You are not authorized to cancel this reservation.");
            }

            if (reservation.Status == "Cancelled" || reservation.Status == "Completed")
            {
                throw new InvalidOperationException($"Reservation is already '{reservation.Status}'.");
            }

            var now = DateTime.UtcNow;

            // Prosumers must provide at least 12 hours notice (Operators/Backoffice can assist/override in emergencies)
            if (requesterRole == "Prosumer")
            {
                var hoursRemaining = (reservation.ScheduledDateTime - now).TotalHours;
                if (hoursRemaining < 12)
                {
                    throw new InvalidOperationException($"Cancellations require at least 12 hours' notice. Only {hoursRemaining:F1} hours remaining. Please contact a Grid Operator for emergency assistance.");
                }
            }

            var update = Builders<EnergyReservation>.Update
                .Set(r => r.Status, "Cancelled")
                .Set(r => r.CancellationReason, reason)
                .Set(r => r.UpdatedAt, DateTime.UtcNow);

            var result = await _context.Reservations.UpdateOneAsync(r => r.Id == id, update);
            return result.ModifiedCount > 0;
        }

        public async Task<bool> VerifyAndCompleteJobAsync(VerifyQrRequestDto dto, string operatorNic)
        {
            // Method: VerifyAndCompleteJobAsync - Scans prosumer QR code, validates booking on server, and finalizes transfer as Completed.
            var reservation = await _context.Reservations.Find(r => r.QrCodeToken == dto.QrCodeToken).FirstOrDefaultAsync();
            if (reservation == null)
            {
                throw new InvalidOperationException("Invalid or unrecognized QR verification token.");
            }

            if (reservation.Status == "Completed")
            {
                throw new InvalidOperationException($"This reservation ({reservation.ReservationNumber}) has already been completed.");
            }

            if (reservation.Status == "Cancelled")
            {
                throw new InvalidOperationException($"Cannot complete a cancelled reservation ({reservation.ReservationNumber}).");
            }

            var update = Builders<EnergyReservation>.Update
                .Set(r => r.Status, "Completed")
                .Set(r => r.CompletedByOperatorNic, operatorNic)
                .Set(r => r.CompletedAt, DateTime.UtcNow)
                .Set(r => r.UpdatedAt, DateTime.UtcNow);

            var result = await _context.Reservations.UpdateOneAsync(r => r.Id == reservation.Id, update);
            return result.ModifiedCount > 0;
        }

        public async Task<DashboardStatsDto> GetDashboardStatsAsync(string? prosumerNic = null)
        {
            // Method: GetDashboardStatsAsync - Computes live analytics: active, pending, and approved future reservations.
            var now = DateTime.UtcNow;

            FilterDefinition<EnergyReservation> filter = Builders<EnergyReservation>.Filter.Empty;
            if (!string.IsNullOrEmpty(prosumerNic))
            {
                filter = Builders<EnergyReservation>.Filter.Eq(r => r.ProsumerNic, prosumerNic);
            }

            var allReservations = await _context.Reservations.Find(filter).ToListAsync();

            var activeCount = allReservations.Count(r => r.Status == "Approved");
            var pendingCount = allReservations.Count(r => r.Status == "Pending");
            var approvedFutureCount = allReservations.Count(r => r.Status == "Approved" && r.ScheduledDateTime >= now);
            var completedCount = allReservations.Count(r => r.Status == "Completed");

            var totalStations = (int)await _context.Stations.CountDocumentsAsync(_ => true);
            var activeProsumers = (int)await _context.Users.CountDocumentsAsync(u => u.Role == "Prosumer" && u.Status == "Active");
            var pendingProsumers = (int)await _context.Users.CountDocumentsAsync(u => u.Role == "Prosumer" && u.Status == "Pending");

            return new DashboardStatsDto
            {
                ActiveBookingsCount = activeCount,
                PendingBookingsCount = pendingCount,
                ApprovedFutureBookingsCount = approvedFutureCount,
                TotalCompletedBookingsCount = completedCount,
                TotalStationsCount = totalStations,
                ActiveProsumersCount = activeProsumers,
                PendingProsumersCount = pendingProsumers
            };
        }
    }
}
