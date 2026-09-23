// ============================================================================
// File: IReservationService.cs
// Project: Smart Solar Microgrid Trading System
// Author: Enterprise Application Development Team
// Description: Contract for power trading reservations, 7-day rule, 12-hour rule, and QR verification.
// ============================================================================

using SolarMicrogridApi.Models;

namespace SolarMicrogridApi.Services
{
    public interface IReservationService
    {
        Task<EnergyReservation> CreateReservationAsync(CreateReservationDto dto);
        Task<EnergyReservation> UpdateReservationAsync(string id, string requestingNic, UpdateReservationDto dto);
        Task<bool> CancelReservationAsync(string id, string requestingNic, string userRole, string reason);
        Task<EnergyReservation> ApproveReservationAsync(string id);
        Task<EnergyReservation> VerifyAndFinalizeQrAsync(VerifyQrRequestDto dto, string operatorNic);
        Task<List<EnergyReservation>> GetProsumerReservationsAsync(string nic);
        Task<List<EnergyReservation>> GetAllReservationsAsync(string? stationId = null, string? status = null, string? nic = null);
        Task<EnergyReservation?> GetReservationByIdAsync(string id);
        Task<DashboardStatsDto> GetDashboardStatsAsync(string? nic = null);
    }
}
