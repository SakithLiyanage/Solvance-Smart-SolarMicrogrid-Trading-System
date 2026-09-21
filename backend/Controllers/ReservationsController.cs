// ============================================================================
// File: ReservationsController.cs
// Project: Smart Solar Microgrid Trading System
// Author: Enterprise Application Development Team
// Description: API controller for energy slot bookings, 7-day schedule window, 12-hour rules, and QR dispatch.
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
        /// Retrieves all reservations with optional filters (role authorized).
        /// </summary>
        [HttpGet]
        [Authorize]
        public async Task<IActionResult> GetAllReservations([FromQuery] string? status, [FromQuery] string? prosumerNic, [FromQuery] string? stationId)
        {
            // Method: GetAllReservations - Retrieves power trading bookings.
            var requesterRole = User.FindFirstValue(ClaimTypes.Role);
            var requesterNic = User.FindFirstValue(ClaimTypes.NameIdentifier);

            // If Prosumer, restrict query to own bookings
            if (requesterRole == "Prosumer")
            {
                prosumerNic = requesterNic;
            }

            var reservations = await _reservationService.GetAllReservationsAsync(status, prosumerNic, stationId);
            return Ok(reservations);
        }

        /// <summary>
        /// Retrieves complete booking history and pending requests for a specific prosumer.
        /// </summary>
        [HttpGet("prosumer/{nic}")]
        [Authorize]
        public async Task<IActionResult> GetProsumerReservations(string nic)
        {
            // Method: GetProsumerReservations - Gets personal reservation list for mobile prosumer.
            var requesterRole = User.FindFirstValue(ClaimTypes.Role);
            var requesterNic = User.FindFirstValue(ClaimTypes.NameIdentifier);

            if (requesterRole == "Prosumer" && requesterNic != nic)
            {
                return Forbid();
            }

            var reservations = await _reservationService.GetProsumerReservationsAsync(nic);
            return Ok(reservations);
        }

        /// <summary>
        /// Retrieves single reservation details by ID.
        /// </summary>
        [HttpGet("{id}")]
        [Authorize]
        public async Task<IActionResult> GetReservationById(string id)
        {
            // Method: GetReservationById - Looks up reservation details.
            var reservation = await _reservationService.GetReservationByIdAsync(id);
            if (reservation == null)
            {
                return NotFound(new { message = $"Reservation with ID '{id}' not found." });
            }

            var requesterRole = User.FindFirstValue(ClaimTypes.Role);
            var requesterNic = User.FindFirstValue(ClaimTypes.NameIdentifier);

            if (requesterRole == "Prosumer" && reservation.ProsumerNic != requesterNic)
            {
                return Forbid();
            }

            return Ok(reservation);
        }

        /// <summary>
        /// Computes live dashboard metrics (active, pending, approved future reservations).
        /// </summary>
        [HttpGet("dashboard-stats")]
        [Authorize]
        public async Task<IActionResult> GetDashboardStats([FromQuery] string? nic)
        {
            // Method: GetDashboardStats - Real-time operational counters for web and mobile dashboards.
            var requesterRole = User.FindFirstValue(ClaimTypes.Role);
            var requesterNic = User.FindFirstValue(ClaimTypes.NameIdentifier);

            if (requesterRole == "Prosumer")
            {
                nic = requesterNic;
            }

            var stats = await _reservationService.GetDashboardStatsAsync(nic);
            return Ok(stats);
        }

        /// <summary>
        /// Creates a new energy trading reservation (enforces 7-day future booking limit).
        /// </summary>
        [HttpPost]
        [Authorize]
        public async Task<IActionResult> CreateReservation([FromBody] CreateReservationDto dto)
        {
            // Method: CreateReservation - Submits energy booking slot request.
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var requesterRole = User.FindFirstValue(ClaimTypes.Role);
            var requesterNic = User.FindFirstValue(ClaimTypes.NameIdentifier);

            if (requesterRole == "Prosumer" && !string.IsNullOrEmpty(requesterNic))
            {
                dto.ProsumerNic = requesterNic;
            }

            try
            {
                var created = await _reservationService.CreateReservationAsync(dto);
                return CreatedAtAction(nameof(GetReservationById), new { id = created.Id }, created);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return Conflict(new { message = ex.Message });
            }
        }

        /// <summary>
        /// Modifies an existing reservation (enforces 12-hour notice rule).
        /// </summary>
        [HttpPut("{id}")]
        [Authorize]
        public async Task<IActionResult> UpdateReservation(string id, [FromBody] UpdateReservationDto dto)
        {
            // Method: UpdateReservation - Updates slot schedule or energy amount with 12-hour guard.
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var requesterRole = User.FindFirstValue(ClaimTypes.Role) ?? "";
            var requesterNic = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "";

            try
            {
                var success = await _reservationService.UpdateReservationAsync(id, dto, requesterNic, requesterRole);
                if (!success)
                {
                    return NotFound(new { message = $"Reservation with ID '{id}' not found." });
                }

                return Ok(new { message = "Reservation updated successfully." });
            }
            catch (UnauthorizedAccessException ex)
            {
                return Forbid(ex.Message);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return Conflict(new { message = ex.Message });
            }
        }

        /// <summary>
        /// Cancels a power trading reservation (enforces 12-hour notice rule for prosumers).
        /// </summary>
        [HttpPost("{id}/cancel")]
        [Authorize]
        public async Task<IActionResult> CancelReservation(string id, [FromBody] CancelReservationDto dto)
        {
            // Method: CancelReservation - Cancels booking with 12-hour notice check.
            var requesterRole = User.FindFirstValue(ClaimTypes.Role) ?? "";
            var requesterNic = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "";

            try
            {
                var success = await _reservationService.CancelReservationAsync(id, dto.Reason, requesterNic, requesterRole);
                if (!success)
                {
                    return NotFound(new { message = $"Reservation with ID '{id}' not found." });
                }

                return Ok(new { message = "Reservation cancelled successfully." });
            }
            catch (UnauthorizedAccessException ex)
            {
                return Forbid(ex.Message);
            }
            catch (InvalidOperationException ex)
            {
                return Conflict(new { message = ex.Message });
            }
        }

        /// <summary>
        /// Operator mode: Scans QR code, verifies token against server, and finalizes transfer as Completed.
        /// </summary>
        [HttpPost("verify-qr")]
        [Authorize(Roles = "GridOperator,Backoffice")]
        public async Task<IActionResult> VerifyQr([FromBody] VerifyQrRequestDto dto)
        {
            // Method: VerifyQr - Finalizes power exchange job upon scanning prosumer QR code.
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var operatorNic = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "GRID_OPERATOR";

            try
            {
                var success = await _reservationService.VerifyAndCompleteJobAsync(dto, operatorNic);
                if (!success)
                {
                    return NotFound(new { message = "Unable to complete reservation." });
                }

                return Ok(new { message = "QR code validated successfully. Energy trading job marked as COMPLETED." });
            }
            catch (InvalidOperationException ex)
            {
                return Conflict(new { message = ex.Message });
            }
        }
    }
}
