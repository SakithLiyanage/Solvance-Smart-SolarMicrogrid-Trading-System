// ============================================================================
// File: ReservationsController.cs
// Project: Solvance — Smart Solar Microgrid Trading System
// Author: L.T. Jayawardhana (IT23156760)
// Course: SE4040 - Enterprise Application Development (SLIIT)
// Description: API controller executing 7-day and 12-hour business rules, QR generation and scanner verification.
// References & Citations:
//   - Microsoft ASP.NET Core Controllers & Action Results:
//     https://learn.microsoft.com/en-us/aspnet/core/web-api/
//   - Microsoft.AspNetCore.Authorization (Role-based policies):
//     https://learn.microsoft.com/en-us/aspnet/core/security/authorization/roles
// ============================================================================

using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SolarMicrogridApi.Models;
using SolarMicrogridApi.Services;

namespace SolarMicrogridApi.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ReservationsController : ControllerBase
    {
        private readonly IReservationService _reservationService;

        public ReservationsController(IReservationService reservationService)
        {
            // Method: ReservationsController Constructor - Injects IReservationService instance.
            _reservationService = reservationService;
        }

        /// <summary>
        /// Creates a new energy reservation enforcing 7-day window rule.
        /// </summary>
        [HttpPost]
        [Authorize]
        public async Task<IActionResult> Create([FromBody] CreateReservationDto dto)
        {
            // Method: Create - Enforces FAT service 7-day booking validation rule and issues booking summary.
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var currentNic = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var currentRole = User.FindFirstValue(ClaimTypes.Role);

            // Prosumers can only create reservations for their own NIC
            if (currentRole == "Prosumer" && !string.IsNullOrEmpty(currentNic) && currentNic != dto.ProsumerNic)
            {
                return Forbid("Cannot create reservation on behalf of another prosumer.");
            }

            try
            {
                var reservation = await _reservationService.CreateReservationAsync(dto);
                return CreatedAtAction(nameof(GetById), new { id = reservation.Id }, new
                {
                    message = "Energy reservation confirmed successfully.",
                    reservation,
                    summary = new
                    {
                        reservation.ReservationNumber,
                        reservation.StationName,
                        reservation.ScheduledDateTime,
                        reservation.EnergyAmountKwh,
                        reservation.TradeType,
                        reservation.Status,
                        reservation.QrCodeToken
                    }
                });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { message = ex.Message });
            }
        }

        /// <summary>
        /// Modifies an existing energy reservation enforcing the strict 12-hour notice rule.
        /// </summary>
        [HttpPut("{id}")]
        [Authorize]
        public async Task<IActionResult> Update(string id, [FromBody] UpdateReservationDto dto)
        {
            // Method: Update - Modifies booking schedule while validating 12-hour advance notice requirement.
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var currentNic = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? string.Empty;
            var currentRole = User.FindFirstValue(ClaimTypes.Role) ?? string.Empty;

            try
            {
                var requestingNic = currentRole == "Prosumer" ? currentNic : string.Empty;
                var updated = await _reservationService.UpdateReservationAsync(id, requestingNic, dto);

                return Ok(new
                {
                    message = "Reservation updated successfully.",
                    reservation = updated,
                    summary = new
                    {
                        updated.ReservationNumber,
                        updated.StationName,
                        updated.ScheduledDateTime,
                        updated.EnergyAmountKwh,
                        updated.TradeType,
                        updated.Status,
                        updated.QrCodeToken
                    }
                });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (UnauthorizedAccessException ex)
            {
                return Forbid(ex.Message);
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { message = ex.Message });
            }
        }

        /// <summary>
        /// Approves a pending reservation and generates the cryptographically signed QR code pass.
        /// </summary>
        [HttpPost("{id}/approve")]
        [Authorize(Roles = "Backoffice,GridOperator")]
        public async Task<IActionResult> Approve(string id)
        {
            // Method: Approve - Transitions reservation from Pending to Approved and issues cryptographic QR code pass.
            try
            {
                var approved = await _reservationService.ApproveReservationAsync(id);
                return Ok(new
                {
                    message = "Reservation approved successfully. Cryptographic QR pass generated.",
                    reservation = approved
                });
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        /// <summary>
        /// Cancels a reservation enforcing 12-hour notice rule for prosumers.
        /// </summary>
        [HttpPost("{id}/cancel")]
        [Authorize]
        public async Task<IActionResult> Cancel(string id, [FromBody] CancelReservationDto dto)
        {
            // Method: Cancel - Enforces 12-hour cancellation notice rule, with Grid Operator assistance support.
            var currentNic = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? string.Empty;
            var currentRole = User.FindFirstValue(ClaimTypes.Role) ?? string.Empty;

            try
            {
                var success = await _reservationService.CancelReservationAsync(id, currentNic, currentRole, dto.Reason);
                if (!success)
                {
                    return NotFound(new { message = "Reservation not found." });
                }

                return Ok(new
                {
                    message = "Reservation cancelled successfully.",
                    summary = new
                    {
                        reservationId = id,
                        status = "Cancelled",
                        reason = dto.Reason,
                        cancelledAt = DateTime.UtcNow
                    }
                });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { message = ex.Message });
            }
        }

        /// <summary>
        /// Operator Mode endpoint: Scans and verifies prosumer transaction QR code and completes job.
        /// </summary>
        [HttpPost("verify-qr")]
        [Authorize(Roles = "GridOperator,Backoffice")]
        public async Task<IActionResult> VerifyQr([FromBody] VerifyQrRequestDto dto)
        {
            // Method: VerifyQr - Scans prosumer QR payload, checks server state, and finalizes energy transfer.
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var operatorNic = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrWhiteSpace(operatorNic))
            {
                return Unauthorized(new { message = "Authenticated operator identity is required." });
            }

            try
            {
                var completed = await _reservationService.VerifyAndFinalizeQrAsync(dto, operatorNic);
                return Ok(new
                {
                    message = "Energy transfer verified and job completed successfully.",
                    reservation = completed,
                    summary = new
                    {
                        completed.ReservationNumber,
                        completed.ProsumerNic,
                        completed.StationName,
                        completed.EnergyAmountKwh,
                        completed.TradeType,
                        completed.Status,
                        completed.CompletedAt
                    }
                });
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (UnauthorizedAccessException ex)
            {
                return Unauthorized(new { message = ex.Message });
            }
        }

        /// <summary>
        /// Retrieves reservations for a specific prosumer NIC.
        /// </summary>
        [HttpGet("prosumer/{nic}")]
        [Authorize]
        public async Task<IActionResult> GetByProsumer(string nic)
        {
            // Method: GetByProsumer - Fetches all reservation history and pending records for prosumer dashboard.
            var currentNic = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var currentRole = User.FindFirstValue(ClaimTypes.Role);

            if (currentRole == "Prosumer" && currentNic != nic)
            {
                return Forbid();
            }

            var reservations = await _reservationService.GetProsumerReservationsAsync(nic);
            return Ok(reservations);
        }

        /// <summary>
        /// Searches and filters reservations across stations, statuses, and NICs (Operator & Backoffice).
        /// </summary>
        [HttpGet]
        [Authorize(Roles = "Backoffice,GridOperator")]
        public async Task<IActionResult> GetAll([FromQuery] string? stationId, [FromQuery] string? status, [FromQuery] string? nic)
        {
            // Method: GetAll - Administrative and operational search filter for power trading reservations.
            var reservations = await _reservationService.GetAllReservationsAsync(stationId, status, nic);
            return Ok(reservations);
        }

        /// <summary>
        /// Retrieves single reservation details by ID.
        /// </summary>
        [HttpGet("{id}")]
        [Authorize]
        public async Task<IActionResult> GetById(string id)
        {
            // Method: GetById - Returns single reservation record including QR code token.
            var reservation = await _reservationService.GetReservationByIdAsync(id);
            if (reservation == null)
            {
                return NotFound(new { message = "Reservation not found." });
            }
            return Ok(reservation);
        }

        /// <summary>
        /// Provides live count metrics for prosumer and operational dashboards.
        /// </summary>
        [HttpGet("dashboard-stats")]
        [Authorize]
        public async Task<IActionResult> GetDashboardStats([FromQuery] string? nic)
        {
            // Method: GetDashboardStats - Calculates live counts for active, pending, and approved future reservations.
            var currentNic = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var currentRole = User.FindFirstValue(ClaimTypes.Role);

            // If prosumer, enforce their own NIC
            var targetNic = currentRole == "Prosumer" ? currentNic : nic;
            var stats = await _reservationService.GetDashboardStatsAsync(targetNic);
            return Ok(stats);
        }
    }
}
