// ============================================================================
// File: IStationService.cs
// Project: Solvance — Smart Solar Microgrid Trading System
// Author: G.L.S. Chanlaka (IT23151260)
// Course: SE4040 - Enterprise Application Development (SLIIT)
// Description: Contract for solar microgrid station (hub) management and deactivation rules.
// References & Citations:
//   - Microsoft .NET Task-based Asynchronous Pattern (TAP):
//     https://learn.microsoft.com/en-us/dotnet/standard/asynchronous-programming-patterns/task-based-asynchronous-pattern-tap
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
