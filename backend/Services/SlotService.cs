// ============================================================================
// File: SlotService.cs
// Project: Smart Solar Microgrid Trading System
// Author: Enterprise Application Development Team
// Description: Implements slot queries, creation, and availability tracking.
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
            // Method: GetSlotsByStationAsync - Retrieves available booking slots for a designated microgrid station.
            var builder = Builders<EnergySlot>.Filter;
            var filter = builder.Eq(s => s.StationId, stationId);

            if (!string.IsNullOrEmpty(date))
            {
                filter &= builder.Eq(s => s.Date, date);
            }

            return await _context.Slots.Find(filter).ToListAsync();
        }

        public async Task<EnergySlot?> GetSlotByIdAsync(string id)
        {
            // Method: GetSlotByIdAsync - Finds a single slot record by its unique identifier.
            return await _context.Slots.Find(s => s.Id == id).FirstOrDefaultAsync();
        }

        public async Task<EnergySlot> CreateSlotAsync(EnergySlot slot)
        {
            // Method: CreateSlotAsync - Creates a new trading slot for prosumer reservations.
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
            var status = availableSlots <= 0 ? "Full" : "Open";
            var update = Builders<EnergySlot>.Update
                .Set(s => s.AvailableSlots, availableSlots)
                .Set(s => s.AllocatedKwh, allocatedKwh)
                .Set(s => s.Status, status);

            var result = await _context.Slots.UpdateOneAsync(s => s.Id == slotId, update);
            return result.ModifiedCount > 0;
        }
    }
}
