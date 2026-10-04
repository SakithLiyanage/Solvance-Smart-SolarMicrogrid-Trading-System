// ============================================================================
// File: StationService.cs
// Project: Solvance — Smart Solar Microgrid Trading System
// Author: G.L.S. Chanlaka (IT23151260)
// Course: SE4040 - Enterprise Application Development (SLIIT)
// Description: Implements microgrid node CRUD, GPS locations, and active reservation deactivation blocker.
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
                GridConnection = !string.IsNullOrWhiteSpace(dto.GridConnection) ? dto.GridConnection : "Three-Phase 400V AC",
                StorageType = !string.IsNullOrWhiteSpace(dto.StorageType) ? dto.StorageType : "LiFePO4 BESS",
                MaxDischargeRateKw = dto.MaxDischargeRateKw > 0 ? dto.MaxDischargeRateKw : 150.0,
                Schedule = dto.Schedule,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };

            await _context.Stations.InsertOneAsync(station);

            if (dto.AutoGenerateSlots && !string.IsNullOrEmpty(station.Id))
            {
                await GenerateHourlySlotsAsync(station.Id, 7);
            }

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
                .Set(s => s.GridConnection, !string.IsNullOrWhiteSpace(dto.GridConnection) ? dto.GridConnection : "Three-Phase 400V AC")
                .Set(s => s.StorageType, !string.IsNullOrWhiteSpace(dto.StorageType) ? dto.StorageType : "LiFePO4 BESS")
                .Set(s => s.MaxDischargeRateKw, dto.MaxDischargeRateKw > 0 ? dto.MaxDischargeRateKw : 150.0)
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

        public async Task<StationTelemetryDto?> GetTelemetryAsync(string id)
        {
            var station = await GetStationByIdAsync(id);
            if (station == null)
            {
                return null;
            }

            var pending = await _context.Reservations.CountDocumentsAsync(r => r.StationId == id && r.Status == "Pending");
            var approved = await _context.Reservations.CountDocumentsAsync(r => r.StationId == id && r.Status == "Approved");
            var completed = await _context.Reservations.CountDocumentsAsync(r => r.StationId == id && r.Status == "Completed");
            var occupied = Math.Max(0, station.TotalBatterySlots - station.AvailableBatterySlots);

            return new StationTelemetryDto
            {
                StationId = station.Id ?? id,
                StationCode = station.StationCode,
                StationName = station.Name,
                IsActive = station.IsActive,
                TotalBatterySlots = station.TotalBatterySlots,
                AvailableBatterySlots = station.AvailableBatterySlots,
                OccupiedBatterySlots = occupied,
                BatteryOccupancyPercent = station.TotalBatterySlots == 0 ? 0 : occupied * 100d / station.TotalBatterySlots,
                PendingReservations = (int)pending,
                ApprovedReservations = (int)approved,
                CompletedReservations = (int)completed,
                CapturedAt = DateTime.UtcNow
            };
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

        public async Task<bool> DeleteStationAsync(string id)
        {
            // Method: DeleteStationAsync - Permanently deletes station and associated slots after checking for active reservations.
            var activeReservationsCount = await _context.Reservations.CountDocumentsAsync(r =>
                r.StationId == id &&
                (r.Status == "Pending" || r.Status == "Approved") &&
                r.ScheduledDateTime >= DateTime.UtcNow
            );

            if (activeReservationsCount > 0)
            {
                throw new InvalidOperationException($"Cannot delete station '{id}'. There are {activeReservationsCount} active or pending energy reservations.");
            }

            // Clean up related slots
            await _context.Slots.DeleteManyAsync(s => s.StationId == id);
            var result = await _context.Stations.DeleteOneAsync(s => s.Id == id);
            return result.DeletedCount > 0;
        }

        public async Task<int> GenerateHourlySlotsAsync(string id, int daysAhead = 7)
        {
            // Method: GenerateHourlySlotsAsync - Automatically provisions 1-hour energy trading slots based on operational schedule and days open.
            var station = await GetStationByIdAsync(id);
            if (station == null)
            {
                throw new KeyNotFoundException($"Station '{id}' not found.");
            }

            var openTimeStr = !string.IsNullOrWhiteSpace(station.Schedule?.OpenTime) ? station.Schedule.OpenTime : "06:00";
            var closeTimeStr = !string.IsNullOrWhiteSpace(station.Schedule?.CloseTime) ? station.Schedule.CloseTime : "20:00";

            int openHour = 6;
            int closeHour = 20;

            if (TimeSpan.TryParse(openTimeStr, out var openTs))
            {
                openHour = openTs.Hours;
            }
            if (TimeSpan.TryParse(closeTimeStr, out var closeTs))
            {
                closeHour = closeTs.Hours;
            }

            if (closeHour <= openHour)
            {
                closeHour = 20;
                openHour = 6;
            }

            var operatingHoursCount = Math.Max(1, closeHour - openHour);
            var hourlyCapacityKwh = Math.Round(station.CapacityKwh / operatingHoursCount, 2);

            var daysOpen = station.Schedule?.DaysOpen != null && station.Schedule.DaysOpen.Count > 0
                ? new HashSet<string>(station.Schedule.DaysOpen, StringComparer.OrdinalIgnoreCase)
                : new HashSet<string>(new[] { "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday" }, StringComparer.OrdinalIgnoreCase);

            var newSlots = new List<EnergySlot>();
            var nowUtc = DateTime.UtcNow;

            for (int d = 0; d < Math.Max(1, Math.Min(daysAhead, 14)); d++)
            {
                var targetDate = nowUtc.Date.AddDays(d);
                var dayName = targetDate.DayOfWeek.ToString();

                if (!daysOpen.Contains(dayName))
                {
                    continue;
                }

                var dateStr = targetDate.ToString("yyyy-MM-dd");

                var existingSlots = await _context.Slots.Find(s => s.StationId == id && s.Date == dateStr).ToListAsync();
                var existingStartTimes = new HashSet<string>(existingSlots.Select(s => s.StartTime));

                for (int h = openHour; h < closeHour; h++)
                {
                    var startTime = $"{h:D2}:00";
                    var endTime = $"{h + 1:D2}:00";

                    if (!existingStartTimes.Contains(startTime))
                    {
                        newSlots.Add(new EnergySlot
                        {
                            StationId = id,
                            Date = dateStr,
                            StartTime = startTime,
                            EndTime = endTime,
                            SlotCapacityKwh = hourlyCapacityKwh > 0 ? hourlyCapacityKwh : 50.0,
                            AllocatedKwh = 0,
                            AvailableSlots = station.TotalBatterySlots > 0 ? station.TotalBatterySlots : 20,
                            Status = "Open",
                            CreatedAt = DateTime.UtcNow
                        });
                    }
                }
            }

            if (newSlots.Count > 0)
            {
                await _context.Slots.InsertManyAsync(newSlots);
            }

            return newSlots.Count;
        }
    }
}