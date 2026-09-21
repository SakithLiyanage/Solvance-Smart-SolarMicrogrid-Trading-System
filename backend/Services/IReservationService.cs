// ============================================================================
// File: IReservationService.cs
// Project: Smart Solar Microgrid Trading System
// Author: Enterprise Application Development Team
// Description: Interface defining power trading reservation lifecycle and FAT business rules.
// ============================================================================

using SolarMicrogridApi.Models;

namespace SolarMicrogridApi.Services
{
    public interface IReservationService
    {
        Task<List<EnergyReservation>> GetAllReservationsAsync(string? status = null, string? prosumerNic = null, string? stationId = null);
        Task<List<EnergyReservation>> GetProsumerReservationsAsync(string prosumerNic);
        Task<EnergyReservation?> GetReservationByIdAsync(string id);
        Task<EnergyReservation?> GetReservationByQrTokenAsync(string qrToken);
        Task<EnergyReservation> CreateReservationAsync(CreateReservationDto dto);
        Task<bool> UpdateReservationAsync(string id, UpdateReservationDto dto, string requesterNic, string requesterRole);
        Task<bool> CancelReservationAsync(string id, string reason, string requesterNic, string requesterRole);
        Task<bool> VerifyAndCompleteJobAsync(VerifyQrRequestDto dto, string operatorNic);
        Task<DashboardStatsDto> GetDashboardStatsAsync(string? prosumerNic = null);
    }
}
