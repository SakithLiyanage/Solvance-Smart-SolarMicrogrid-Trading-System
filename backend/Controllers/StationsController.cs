// ============================================================================
// File: StationsController.cs
// Project: Smart Solar Microgrid Trading System
// Author: Enterprise Application Development Team
// Description: API controller for microgrid station management, schedules, and battery slot monitoring.
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
        /// Retrieves all microgrid hub nodes, optionally filtered by active status.
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> GetStations([FromQuery] bool activeOnly = false)
        {
            // Method: GetStations - Queries station catalog for web administration and mobile map view.
            var stations = await _stationService.GetStationsAsync(activeOnly);
            return Ok(stations);
        }

        /// <summary>
        /// Retrieves details of a specific microgrid hub by ID.
        /// </summary>
        [HttpGet("{id}")]
        public async Task<IActionResult> GetStationById(string id)
        {
            // Method: GetStationById - Fetches single station entity by identifier.
            var station = await _stationService.GetStationByIdAsync(id);
            if (station == null)
            {
                return NotFound(new { message = $"Station with ID '{id}' not found." });
            }
            return Ok(station);
        }

        /// <summary>
        /// Creates a new microgrid hub station (Backoffice role only).
        /// </summary>
        [HttpPost]
        [Authorize(Roles = "Backoffice")]
        public async Task<IActionResult> CreateStation([FromBody] SolarStationDto dto)
        {
            // Method: CreateStation - Provisions new solar hub node with GPS location and capacity specs.
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var created = await _stationService.CreateStationAsync(dto);
                return CreatedAtAction(nameof(GetStationById), new { id = created.Id }, created);
            }
            catch (InvalidOperationException ex)
            {
                return Conflict(new { message = ex.Message });
            }
        }

        /// <summary>
        /// Updates station configuration, schedules, and capacity (Backoffice role only).
        /// </summary>
        [HttpPut("{id}")]
        [Authorize(Roles = "Backoffice")]
        public async Task<IActionResult> UpdateStation(string id, [FromBody] SolarStationDto dto)
        {
            // Method: UpdateStation - Updates station properties in MongoDB.
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var success = await _stationService.UpdateStationAsync(id, dto);
            if (!success)
            {
                return NotFound(new { message = $"Station with ID '{id}' not found." });
            }

            return Ok(new { message = "Station specifications updated successfully." });
        }

        /// <summary>
        /// Updates available battery storage slots in real-time (Backoffice or Grid Operator).
        /// </summary>
        [HttpPut("{id}/battery-slots")]
        [Authorize(Roles = "Backoffice,GridOperator")]
        public async Task<IActionResult> UpdateBatterySlots(string id, [FromBody] UpdateBatterySlotsDto dto)
        {
            // Method: UpdateBatterySlots - Grid Operator operational action to adjust battery slot count.
            try
            {
                var success = await _stationService.UpdateBatterySlotsAsync(id, dto.AvailableBatterySlots);
                if (!success)
                {
                    return NotFound(new { message = $"Station with ID '{id}' not found." });
                }

                return Ok(new { message = "Battery slot capacity updated successfully." });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        /// <summary>
        /// Deactivates a microgrid hub. Enforces check blocking deactivation if active reservations exist (Backoffice only).
        /// </summary>
        [HttpPut("{id}/deactivate")]
        [Authorize(Roles = "Backoffice")]
        public async Task<IActionResult> DeactivateStation(string id)
        {
            // Method: DeactivateStation - Handles station deactivation with active booking guard.
            try
            {
                var success = await _stationService.DeactivateStationAsync(id);
                if (!success)
                {
                    return NotFound(new { message = $"Station with ID '{id}' not found." });
                }

                return Ok(new { message = "Station deactivated successfully." });
            }
            catch (InvalidOperationException ex)
            {
                return Conflict(new { message = ex.Message });
            }
        }

        /// <summary>
        /// Reactivates a dormant microgrid hub (Backoffice only).
        /// </summary>
        [HttpPut("{id}/reactivate")]
        [Authorize(Roles = "Backoffice")]
        public async Task<IActionResult> ReactivateStation(string id)
        {
            // Method: ReactivateStation - Reactivates station node for trading.
            var success = await _stationService.ReactivateStationAsync(id);
            if (!success)
            {
                return NotFound(new { message = $"Station with ID '{id}' not found." });
            }

            return Ok(new { message = "Station reactivated successfully." });
        }

        /// <summary>
        /// Deletes a station permanently if no reservations exist (Backoffice only).
        /// </summary>
        [HttpDelete("{id}")]
        [Authorize(Roles = "Backoffice")]
        public async Task<IActionResult> DeleteStation(string id)
        {
            // Method: DeleteStation - Permanently removes station record.
            try
            {
                var success = await _stationService.DeleteStationAsync(id);
                if (!success)
                {
                    return NotFound(new { message = $"Station with ID '{id}' not found." });
                }

                return Ok(new { message = "Station deleted successfully." });
            }
            catch (InvalidOperationException ex)
            {
                return Conflict(new { message = ex.Message });
            }
        }
    }

    public class UpdateBatterySlotsDto
    {
        public int AvailableBatterySlots { get; set; }
    }
}
