// ============================================================================
// File: IReservationService.cs
// Project: Solvance — Smart Solar Microgrid Trading System
// Authors:
//   - L.T. Jayawardhana (IT23156760) - Reservation lifecycle contracts
//   - H.N. Madubashini (IT23192300) - Operator verification & telemetry contracts
// Course: SE4040 - Enterprise Application Development (SLIIT)
// Description: Contract for power trading reservations, 7-day rule, 12-hour rule, and QR verification.
// References & Citations:
//   - Microsoft .NET Task-based Asynchronous Pattern (TAP):
//     https://learn.microsoft.com/en-us/dotnet/standard/asynchronous-programming-patterns/task-based-asynchronous-pattern-tap
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
