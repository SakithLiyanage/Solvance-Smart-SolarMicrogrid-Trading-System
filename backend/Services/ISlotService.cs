// ============================================================================
// File: ISlotService.cs
// Project: Solvance — Smart Solar Microgrid Trading System
// Author: G.L.S. Chanlaka (IT23151260)
// Course: SE4040 - Enterprise Application Development (SLIIT)
// Description: Contract for managing energy trading slots within the EnergyBookingSlots collection.
// References & Citations:
//   - Microsoft .NET Task-based Asynchronous Pattern (TAP):
//     https://learn.microsoft.com/en-us/dotnet/standard/asynchronous-programming-patterns/task-based-asynchronous-pattern-tap
// ============================================================================

using SolarMicrogridApi.Models;

namespace SolarMicrogridApi.Services
{
    public interface ISlotService
    {
        Task<List<EnergySlot>> GetSlotsByStationAsync(string stationId, string? date = null);
        Task<EnergySlot?> GetSlotByIdAsync(string id);
        Task<EnergySlot> CreateSlotAsync(EnergySlot slot);
        Task<bool> UpdateSlotAvailabilityAsync(string slotId, int availableSlots, double allocatedKwh);
        Task<bool> DeleteSlotAsync(string id);
    }
}
