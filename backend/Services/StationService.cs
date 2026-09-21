// ============================================================================
// File: StationService.cs
// Project: Smart Solar Microgrid Trading System
// Author: Enterprise Application Development Team
// Description: Service implementing business rules for microgrid hub nodes, capacity, and battery slots.
// ============================================================================

using MongoDB.Driver;
using SolarMicrogridApi.Data;
using SolarMicrogridApi.Models;

namespace SolarMicrogridApi.Services
{
    /// <summary>
    /// Service managing Microgrid Hub Node lifecycle, GPS mapping coordinates, and slot capacity.
    /// Strictly enforces the FAT service pattern with conflict checks before node deactivation.
    /// </summary>
    public class StationService : IStationService
    {
        private readonly MongoDbContext _context;

        public StationService(MongoDbContext context)
        {
            // Method: StationService Constructor - Injects MongoDbContext instance.
            _context = context;
        }

        public async Task<List<SolarStation>> GetStationsAsync(bool activeOnly = false)
        {
            // Method: GetStationsAsync - Retrieves list of solar hubs, optionally filtered by active status.
            if (activeOnly)
            {
                return await _context.Stations.Find(s => s.IsActive).ToListAsync();
            }
            return await _context.Stations.Find(_ => true).ToListAsync();
        }

        public async Task<SolarStation?> GetStationByIdAsync(string id)
        {
            // Method: GetStationByIdAsync - Retrieves a specific microgrid station by its MongoDB ObjectId.
            return await _context.Stations.Find(s => s.Id == id).FirstOrDefaultAsync();
        }

        public async Task<SolarStation?> GetStationByCodeAsync(string stationCode)
        {
            // Method: GetStationByCodeAsync - Looks up microgrid station using unique natural station code.
            return await _context.Stations.Find(s => s.StationCode == stationCode).FirstOrDefaultAsync();
        }

        public async Task<SolarStation> CreateStationAsync(SolarStationDto dto)
        {
            // Method: CreateStationAsync - Registers new solar grid hub with GPS location and battery slots.
            var existing = await _context.Stations.Find(s => s.StationCode == dto.StationCode).FirstOrDefaultAsync();
            if (existing != null)
            {
                throw new InvalidOperationException($"Microgrid node with code '{dto.StationCode}' already exists.");
            }

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
                Schedule = dto.Schedule ?? new OperationalSchedule(),
                IsActive = dto.IsActive,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            await _context.Stations.InsertOneAsync(station);
            return station;
        }

        public async Task<bool> UpdateStationAsync(string id, SolarStationDto dto)
        {
            // Method: UpdateStationAsync - Updates station attributes, capacities, and operational schedules.
            var update = Builders<SolarStation>.Update
                .Set(s => s.Name, dto.Name.Trim())
                .Set(s => s.Latitude, dto.Latitude)
                .Set(s => s.Longitude, dto.Longitude)
                .Set(s => s.Address, dto.Address.Trim())
                .Set(s => s.CapacityKwh, dto.CapacityKwh)
                .Set(s => s.TotalBatterySlots, dto.TotalBatterySlots)
                .Set(s => s.AvailableBatterySlots, dto.AvailableBatterySlots)
                .Set(s => s.Schedule, dto.Schedule ?? new OperationalSchedule())
                .Set(s => s.IsActive, dto.IsActive)
                .Set(s => s.UpdatedAt, DateTime.UtcNow);

            var result = await _context.Stations.UpdateOneAsync(s => s.Id == id, update);
            return result.ModifiedCount > 0;
        }

        public async Task<bool> UpdateBatterySlotsAsync(string id, int availableSlots)
        {
            // Method: UpdateBatterySlotsAsync - Allows Grid Operators to adjust available battery storage slots in real-time.
            var station = await _context.Stations.Find(s => s.Id == id).FirstOrDefaultAsync();
            if (station == null)
            {
                return false;
            }

            if (availableSlots < 0 || availableSlots > station.TotalBatterySlots)
            {
                throw new ArgumentException($"Available slots must be between 0 and total capacity ({station.TotalBatterySlots}).");
            }

            var update = Builders<SolarStation>.Update
                .Set(s => s.AvailableBatterySlots, availableSlots)
                .Set(s => s.UpdatedAt, DateTime.UtcNow);

            var result = await _context.Stations.UpdateOneAsync(s => s.Id == id, update);
            return result.ModifiedCount > 0;
        }

        public async Task<bool> DeactivateStationAsync(string id)
        {
            // Method: DeactivateStationAsync - Deactivates station node. Enforces business rule blocking deactivation if active reservations exist.
            var station = await _context.Stations.Find(s => s.Id == id).FirstOrDefaultAsync();
            if (station == null)
            {
                return false;
            }

            // FAT Service Rule: Check for active or approved future reservations on this station
            var activeReservationsCount = await _context.Reservations.CountDocumentsAsync(r => 
                (r.StationId == id || r.StationId == station.StationCode) && 
                (r.Status == "Approved" || r.Status == "Pending") && 
                r.ScheduledDateTime >= DateTime.UtcNow
            );

            if (activeReservationsCount > 0)
            {
                throw new InvalidOperationException($"Cannot deactivate station '{station.Name}'. There are {activeReservationsCount} active or pending energy reservations associated with this node.");
            }

            var update = Builders<SolarStation>.Update
                .Set(s => s.IsActive, false)
                .Set(s => s.UpdatedAt, DateTime.UtcNow);

            var result = await _context.Stations.UpdateOneAsync(s => s.Id == id, update);
            return result.ModifiedCount > 0;
        }

        public async Task<bool> ReactivateStationAsync(string id)
        {
            // Method: ReactivateStationAsync - Reactivates a dormant microgrid node for power trading.
            var update = Builders<SolarStation>.Update
                .Set(s => s.IsActive, true)
                .Set(s => s.UpdatedAt, DateTime.UtcNow);

            var result = await _context.Stations.UpdateOneAsync(s => s.Id == id, update);
            return result.ModifiedCount > 0;
        }

        public async Task<bool> DeleteStationAsync(string id)
        {
            // Method: DeleteStationAsync - Permanently removes a microgrid node if no reservations exist.
            var station = await _context.Stations.Find(s => s.Id == id).FirstOrDefaultAsync();
            if (station == null)
            {
                return false;
            }

            var activeReservationsCount = await _context.Reservations.CountDocumentsAsync(r => 
                (r.StationId == id || r.StationId == station.StationCode) && 
                (r.Status == "Approved" || r.Status == "Pending")
            );

            if (activeReservationsCount > 0)
            {
                throw new InvalidOperationException($"Cannot delete station '{station.Name}' with active energy reservations.");
            }

            var result = await _context.Stations.DeleteOneAsync(s => s.Id == id);
            return result.DeletedCount > 0;
        }
    }
}
