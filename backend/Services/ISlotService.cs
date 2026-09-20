// ============================================================================
// File: ISlotService.cs
// Project: Smart Solar Microgrid Trading System
// Author: Enterprise Application Development Team
// Description: Contract for managing energy trading slots within the EnergyBookingSlots collection.
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
    }
}
