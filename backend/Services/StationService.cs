// ============================================================================
// File: StationService.cs
// Project: Smart Solar Microgrid Trading System
// Author: Enterprise Application Development Team
// Description: Implements microgrid node CRUD, GPS locations, and active reservation deactivation blocker.
// ============================================================================

using MongoDB.Driver;
using SolarMicrogridApi.Data;
using SolarMicrogridApi.Models;

namespace SolarMicrogridApi.Services
{
    /// <summary>
    /// Service implementing business rules for Solar Station hubs in the "SolarStationInfo" collection.
    /// </summary>
    public class StationService : IStationService
    {
        private readonly MongoDbContext _context;

        public StationService(MongoDbContext context)
        {
            // Method: StationService Constructor - Injects database context.
            _context = context;
        }

        public async Task<List<SolarStation>> GetAllStationsAsync(bool activeOnly = false)
        {
            // Method: GetAllStationsAsync - Returns list of solar hubs, optionally filtered by active state.
            if (activeOnly)
            {
                return await _context.Stations.Find(s => s.IsActive).ToListAsync();
            }
            return await _context.Stations.Find(Builders<SolarStation>.Filter.Empty).ToListAsync();
        }

        public async Task<SolarStation?> GetStationByIdAsync(string id)
        {
            // Method: GetStationByIdAsync - Retrieves a specific microgrid station by unique identifier.
            return await _context.Stations.Find(s => s.Id == id).FirstOrDefaultAsync();
        }

        public async Task<SolarStation> CreateStationAsync(SolarStationDto dto)
        {
            // Method: CreateStationAsync - Registers a new solar microgrid hub with GPS coordinates and battery specs.
            var station = new SolarStation
            {
                StationCode = dto.StationCode.Trim().ToUpper(),
                Name = dto.Name.Trim(),
                Latitude = dto.Latitude,
                Longitude = dto.Longitude,
                Address = dto.Address.Trim(),
                CapacityKwh = dto.CapacityKwh,
                TotalBatterySlots = dto.TotalBatterySlots,
                AvailableBatterySlots = dto.AvailableBatterySlots > 0 ? dto.AvailableBatterySlots : dto.TotalBatterySlots,
                Schedule = dto.Schedule,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };

            await _context.Stations.InsertOneAsync(station);
            return station;
        }

        public async Task<bool> UpdateStationAsync(string id, SolarStationDto dto)
        {
            // Method: UpdateStationAsync - Updates solar hub specifications, operational hours, and metadata.
            var update = Builders<SolarStation>.Update
                .Set(s => s.StationCode, dto.StationCode.Trim().ToUpper())
                .Set(s => s.Name, dto.Name.Trim())
                .Set(s => s.Latitude, dto.Latitude)
                .Set(s => s.Longitude, dto.Longitude)
                .Set(s => s.Address, dto.Address.Trim())
                .Set(s => s.CapacityKwh, dto.CapacityKwh)
                .Set(s => s.TotalBatterySlots, dto.TotalBatterySlots)
                .Set(s => s.AvailableBatterySlots, dto.AvailableBatterySlots)
                .Set(s => s.Schedule, dto.Schedule)
                .Set(s => s.IsActive, dto.IsActive);

            var result = await _context.Stations.UpdateOneAsync(s => s.Id == id, update);
            return result.ModifiedCount > 0;
        }

        public async Task<bool> UpdateBatterySlotsAsync(string id, int availableSlots)
        {
            // Method: UpdateBatterySlotsAsync - Operator operational tool to adjust available battery storage slots.
            var station = await GetStationByIdAsync(id);
            if (station == null)
            {
                return false;
            }

            if (availableSlots < 0 || availableSlots > station.TotalBatterySlots)
            {
                throw new ArgumentException($"Available slots must be between 0 and total capacity ({station.TotalBatterySlots}).");
            }

            var update = Builders<SolarStation>.Update.Set(s => s.AvailableBatterySlots, availableSlots);
            var result = await _context.Stations.UpdateOneAsync(s => s.Id == id, update);
            return result.MatchedCount > 0;
        }

        public async Task<bool> DeactivateStationAsync(string id)
        {
            // Method: DeactivateStationAsync - Deactivates station while strictly blocking if active energy reservations exist.
            var activeReservationsCount = await _context.Reservations.CountDocumentsAsync(r =>
                r.StationId == id &&
                (r.Status == "Pending" || r.Status == "Approved") &&
                r.ScheduledDateTime >= DateTime.UtcNow
            );

            if (activeReservationsCount > 0)
            {
                throw new InvalidOperationException($"Cannot deactivate station '{id}'. There are {activeReservationsCount} active or pending energy reservations.");
            }

            var update = Builders<SolarStation>.Update.Set(s => s.IsActive, false);
            var result = await _context.Stations.UpdateOneAsync(s => s.Id == id, update);
            return result.ModifiedCount > 0;
        }

        public async Task<bool> ReactivateStationAsync(string id)
        {
            // Method: ReactivateStationAsync - Reactivates previously deactivated microgrid node.
            var update = Builders<SolarStation>.Update.Set(s => s.IsActive, true);
            var result = await _context.Stations.UpdateOneAsync(s => s.Id == id, update);
            return result.ModifiedCount > 0;
        }
    }
}
