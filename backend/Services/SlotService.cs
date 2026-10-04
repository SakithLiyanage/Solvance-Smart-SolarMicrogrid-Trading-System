// ============================================================================
// File: SlotService.cs
// Project: Solvance — Smart Solar Microgrid Trading System
// Author: G.L.S. Chanlaka (IT23151260)
// Course: SE4040 - Enterprise Application Development (SLIIT)
// Description: Implements slot queries, creation, and availability tracking.
// References & Citations:
//   - MongoDB.Driver .NET CRUD Operations:
//     https://www.mongodb.com/docs/drivers/csharp/current/fundamentals/crud/
// ============================================================================

using MongoDB.Driver;
using SolarMicrogridApi.Data;
using SolarMicrogridApi.Models;

namespace SolarMicrogridApi.Services
{
    /// <summary>
    /// Service managing trading time windows in the "EnergyBookingSlots" collection.
    /// </summary>
    public class SlotService : ISlotService
    {
        private readonly MongoDbContext _context;

        public SlotService(MongoDbContext context)
        {
            // Method: SlotService Constructor - Injects MongoDbContext.
            _context = context;
        }

        public async Task<List<EnergySlot>> GetSlotsByStationAsync(string stationId, string? date = null)
        {
            // Method: GetSlotsByStationAsync - Retrieves available booking slots for a designated microgrid station, ordered by date and start time.
            var builder = Builders<EnergySlot>.Filter;
            var filter = builder.Eq(s => s.StationId, stationId);

            if (!string.IsNullOrEmpty(date))
            {
                filter &= builder.Eq(s => s.Date, date);
            }

            return await _context.Slots.Find(filter)
                .SortBy(s => s.Date)
                .ThenBy(s => s.StartTime)
                .ToListAsync();
        }

        public async Task<EnergySlot?> GetSlotByIdAsync(string id)
        {
            // Method: GetSlotByIdAsync - Finds a single slot record by its unique identifier.
            return await _context.Slots.Find(s => s.Id == id).FirstOrDefaultAsync();
        }

        public async Task<EnergySlot> CreateSlotAsync(EnergySlot slot)
        {
            // Method: CreateSlotAsync - Creates a new trading slot for prosumer reservations with validation and overlap check.
            if (string.IsNullOrWhiteSpace(slot.StationId))
            {
                throw new ArgumentException("Station ID is required.");
            }
            if (string.IsNullOrWhiteSpace(slot.Date))
            {
                throw new ArgumentException("Date (YYYY-MM-DD) is required.");
            }
            if (string.IsNullOrWhiteSpace(slot.StartTime) || string.IsNullOrWhiteSpace(slot.EndTime))
            {
                throw new ArgumentException("Start time and end time are required.");
            }
            if (string.Compare(slot.EndTime, slot.StartTime, StringComparison.Ordinal) <= 0)
            {
                throw new ArgumentException("End time must be strictly after start time.");
            }
            if (slot.SlotCapacityKwh <= 0)
            {
                throw new ArgumentException("Slot capacity must be greater than 0 kWh.");
            }
            if (slot.AvailableSlots <= 0)
            {
                throw new ArgumentException("Available reservation slots must be greater than 0.");
            }

            var station = await _context.Stations.Find(s => s.Id == slot.StationId).FirstOrDefaultAsync();
            if (station == null)
            {
                throw new KeyNotFoundException($"Microgrid solar station '{slot.StationId}' not found.");
            }

            // Enforce hub operational hours if defined
            if (station.Schedule != null && !string.IsNullOrWhiteSpace(station.Schedule.OpenTime) && !string.IsNullOrWhiteSpace(station.Schedule.CloseTime))
            {
                if (string.Compare(slot.StartTime, station.Schedule.OpenTime, StringComparison.Ordinal) < 0 ||
                    string.Compare(slot.EndTime, station.Schedule.CloseTime, StringComparison.Ordinal) > 0)
                {
                    throw new InvalidOperationException($"Trading slot hours ({slot.StartTime} - {slot.EndTime}) must be within hub operating schedule ({station.Schedule.OpenTime} - {station.Schedule.CloseTime}).");
                }
            }

            // Backend Overlap Protection: check if any existing slot for this station and date collides with the time interval
            var clash = await _context.Slots.Find(s =>
                s.StationId == slot.StationId &&
                s.Date == slot.Date &&
                string.Compare(s.StartTime, slot.EndTime) < 0 &&
                string.Compare(s.EndTime, slot.StartTime) > 0
            ).FirstOrDefaultAsync();

            if (clash != null)
            {
                throw new InvalidOperationException($"An overlapping trading slot ({clash.StartTime} - {clash.EndTime}) already exists on {slot.Date}.");
            }

            slot.CreatedAt = DateTime.UtcNow;
            if (string.IsNullOrEmpty(slot.Status))
            {
                slot.Status = "Open";
            }

            await _context.Slots.InsertOneAsync(slot);
            return slot;
        }

        public async Task<bool> UpdateSlotAvailabilityAsync(string slotId, int availableSlots, double allocatedKwh)
        {
            // Method: UpdateSlotAvailabilityAsync - Adjusts available slot count and updates status when capacity reached.
            var existing = await _context.Slots.Find(s => s.Id == slotId).FirstOrDefaultAsync();
            if (existing == null)
            {
                return false;
            }

            var status = availableSlots <= 0 ? "Full" : (existing.Status == "Full" ? "Open" : existing.Status);
            var update = Builders<EnergySlot>.Update
                .Set(s => s.AvailableSlots, availableSlots)
                .Set(s => s.AllocatedKwh, allocatedKwh)
                .Set(s => s.Status, status);

            var result = await _context.Slots.UpdateOneAsync(s => s.Id == slotId, update);
            return result.MatchedCount > 0;
        }

        public async Task<bool> DeleteSlotAsync(string id)
        {
            // Method: DeleteSlotAsync - Deletes an energy trading slot, blocking if active or pending reservations exist.
            var activeReservationsCount = await _context.Reservations.CountDocumentsAsync(r =>
                r.SlotId == id &&
                (r.Status == "Pending" || r.Status == "Approved") &&
                r.ScheduledDateTime >= DateTime.UtcNow
            );

            if (activeReservationsCount > 0)
            {
                throw new InvalidOperationException($"Cannot delete slot '{id}'. There are {activeReservationsCount} active or pending energy reservations linked to it.");
            }

            var result = await _context.Slots.DeleteOneAsync(s => s.Id == id);
            return result.DeletedCount > 0;
        }
    }
}
