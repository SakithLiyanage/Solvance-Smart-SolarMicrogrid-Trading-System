// ============================================================================
// File: IStationService.cs
// Project: Smart Solar Microgrid Trading System
// Author: Enterprise Application Development Team
// Description: Interface defining contract for Solar Microgrid Node management and slot availability.
// ============================================================================

using SolarMicrogridApi.Models;

namespace SolarMicrogridApi.Services
{
    public interface IStationService
    {
        Task<List<SolarStation>> GetStationsAsync(bool activeOnly = false);
        Task<SolarStation?> GetStationByIdAsync(string id);
        Task<SolarStation?> GetStationByCodeAsync(string stationCode);
        Task<SolarStation> CreateStationAsync(SolarStationDto dto);
        Task<bool> UpdateStationAsync(string id, SolarStationDto dto);
        Task<bool> UpdateBatterySlotsAsync(string id, int availableSlots);
        Task<bool> DeactivateStationAsync(string id);
        Task<bool> ReactivateStationAsync(string id);
        Task<bool> DeleteStationAsync(string id);
    }
}
