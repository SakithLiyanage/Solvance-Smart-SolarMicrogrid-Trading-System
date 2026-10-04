// ============================================================================
// File: IStationService.cs
// Project: Smart Solar Microgrid Trading System
// Author: Enterprise Application Development Team
// Description: Contract for solar microgrid station (hub) management and deactivation rules.
// ============================================================================

using SolarMicrogridApi.Models;

namespace SolarMicrogridApi.Services
{
    public interface IStationService
    {
        Task<List<SolarStation>> GetAllStationsAsync(bool activeOnly = false);
        Task<SolarStation?> GetStationByIdAsync(string id);
        Task<SolarStation> CreateStationAsync(SolarStationDto dto);
        Task<bool> UpdateStationAsync(string id, SolarStationDto dto);
        Task<bool> UpdateBatterySlotsAsync(string id, int availableSlots);
        Task<StationTelemetryDto?> GetTelemetryAsync(string id);
        Task<bool> DeactivateStationAsync(string id);
        Task<bool> ReactivateStationAsync(string id);
        Task<bool> DeleteStationAsync(string id);
        Task<int> GenerateHourlySlotsAsync(string id, int daysAhead = 7);
    }
}
