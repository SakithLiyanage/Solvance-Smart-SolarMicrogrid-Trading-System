// ============================================================================
// File: StationsController.cs
// Project: Solvance — Smart Solar Microgrid Trading System
// Author: G.L.S. Chanlaka (IT23151260)
// Course: SE4040 - Enterprise Application Development (SLIIT)
// Description: API controller for microgrid hubs, GPS positioning, battery slot updates, and deactivation blocker.
// References & Citations:
//   - Microsoft ASP.NET Core Routing to Controller Actions ([Route], [HttpGet], [HttpPost]):
//     https://learn.microsoft.com/en-us/aspnet/core/mvc/controllers/routing
//   - Microsoft ASP.NET Core Action Return Types (Ok, BadRequest, NotFound):
//     https://learn.microsoft.com/en-us/aspnet/core/web-api/action-return-types
//   - Microsoft.AspNetCore.Authorization Role-Based Authorization:
//     https://learn.microsoft.com/en-us/aspnet/core/security/authorization/roles
// ============================================================================

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SolarMicrogridApi.Models;
using SolarMicrogridApi.Services;

namespace SolarMicrogridApi.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class StationsController : ControllerBase
    {
        private readonly IStationService _stationService;

        public StationsController(IStationService stationService)
        {
            // Method: StationsController Constructor - Injects IStationService instance.
            _stationService = stationService;
        }

        /// <summary>
        /// Retrieves all microgrid stations (optionally filtered to active hubs for map rendering).
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> GetAll([FromQuery] bool activeOnly = false)
        {
            // Method: GetAll - Retrieves list of solar microgrid hubs with coordinates and battery stats.
            var stations = await _stationService.GetAllStationsAsync(activeOnly);
            return Ok(stations);
        }

        /// <summary>
        /// Retrieves a specific solar microgrid station by unique ID.
        /// </summary>
        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(string id)
        {
            // Method: GetById - Looks up solar hub specifications by ID.
            var station = await _stationService.GetStationByIdAsync(id);
            if (station == null)
            {
                return NotFound(new { message = "Solar station not found." });
            }
            return Ok(station);
        }

        [HttpGet("{id}/telemetry")]
        [Authorize(Roles = "Backoffice,GridOperator")]
        public async Task<IActionResult> GetTelemetry(string id)
        {
            // Method: GetTelemetry - Retrieves real-time battery and power metrics for the specified solar station.
            var telemetry = await _stationService.GetTelemetryAsync(id);
            return telemetry == null
                ? NotFound(new { message = "Station not found." })
                : Ok(telemetry);
        }
        /// <summary>
        /// Registers a new solar microgrid hub (Backoffice role only).
        /// </summary>
        [HttpPost]
        [Authorize(Roles = "Backoffice")]
        public async Task<IActionResult> Create([FromBody] SolarStationDto dto)
        {
            // Method: Create - Registers new solar hub with GPS location, capacity, and operational schedule.
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var created = await _stationService.CreateStationAsync(dto);
            return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
        }

        /// <summary>
        /// Updates solar hub specifications and schedule (Backoffice role only).
        /// </summary>
        [HttpPut("{id}")]
        [Authorize(Roles = "Backoffice")]
        public async Task<IActionResult> Update(string id, [FromBody] SolarStationDto dto)
        {
            // Method: Update - Modifies station metadata, schedule, and technical specifications.
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var success = await _stationService.UpdateStationAsync(id, dto);
            if (!success)
            {
                return NotFound(new { message = "Station not found." });
            }

            return Ok(new { message = "Solar station updated successfully." });
        }

        /// <summary>
        /// Updates available battery storage slots (Backoffice or Grid Operator).
        /// </summary>
        [HttpPatch("{id}/battery-slots")]
        [HttpPut("{id}/battery-slots")]
        [Authorize(Roles = "Backoffice,GridOperator")]
        public async Task<IActionResult> UpdateBatterySlots(string id, [FromBody] UpdateBatterySlotsDto dto)
        {
            // Method: UpdateBatterySlots - Operational tool enabling grid operators to adjust available battery slots.
            try
            {
                var success = await _stationService.UpdateBatterySlotsAsync(id, dto.AvailableSlots);
                if (!success)
                {
                    return NotFound(new { message = "Station not found." });
                }

                return Ok(new { message = "Battery slot availability updated successfully." });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        /// <summary>
        /// Deactivates a solar hub (Backoffice only). Blocked if active energy reservations exist.
        /// </summary>
        [HttpPost("{id}/deactivate")]
        [Authorize(Roles = "Backoffice")]
        public async Task<IActionResult> Deactivate(string id)
        {
            // Method: Deactivate - Deactivates node ensuring no pending or approved reservations are blocked or stranded.
            try
            {
                var success = await _stationService.DeactivateStationAsync(id);
                if (!success)
                {
                    return NotFound(new { message = "Station not found." });
                }

                return Ok(new { message = "Solar station deactivated successfully." });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        /// <summary>
        /// Reactivates an existing solar station (Backoffice only).
        /// </summary>
        [HttpPost("{id}/reactivate")]
        [Authorize(Roles = "Backoffice")]
        public async Task<IActionResult> Reactivate(string id)
        {
            // Method: Reactivate - Restores inactive solar hub to active operational service.
            var success = await _stationService.ReactivateStationAsync(id);
            if (!success)
            {
                return NotFound(new { message = "Station not found." });
            }

            return Ok(new { message = "Solar station reactivated successfully." });
        }

        /// <summary>
        /// Generates hourly booking slots for the station across operational days (Backoffice only).
        /// </summary>
        [HttpPost("{id}/generate-slots")]
        [Authorize(Roles = "Backoffice")]
        public async Task<IActionResult> GenerateSlots(string id, [FromQuery] int days = 7)
        {
            // Method: GenerateSlots - Generates operational hourly energy slots for specified station over given day range.
            try
            {
                var count = await _stationService.GenerateHourlySlotsAsync(id, days);
                return Ok(new { message = $"Generated {count} hourly operational slots.", slotsGenerated = count });
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        /// <summary>
        /// Permanently deletes a solar station (Backoffice only). Blocked if active reservations exist.
        /// </summary>
        [HttpDelete("{id}")]
        [Authorize(Roles = "Backoffice")]
        public async Task<IActionResult> Delete(string id)
        {
            // Method: Delete - Deletes solar hub and associated slots, strictly blocking if active reservations exist.
            try
            {
                var success = await _stationService.DeleteStationAsync(id);
                if (!success)
                {
                    return NotFound(new { message = "Station not found." });
                }

                return Ok(new { message = "Solar station and associated slots deleted successfully." });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }
    }

    public class UpdateBatterySlotsDto
    {
        public int AvailableSlots { get; set; }
    }
}
