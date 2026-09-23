// ============================================================================
// File: SlotsController.cs
// Project: Solvance — Smart Solar Microgrid Trading System
// Author: G.L.S. Chanlaka (IT23151260)
// Course: SE4040 - Enterprise Application Development (SLIIT)
// Description: API controller managing battery swapping/charging slots within solar hubs.
// References & Citations:
//   - Microsoft ASP.NET Core Routing & Controller Conventions:
//     https://learn.microsoft.com/en-us/aspnet/core/web-api/
// ============================================================================

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SolarMicrogridApi.Models;
using SolarMicrogridApi.Services;

namespace SolarMicrogridApi.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class SlotsController : ControllerBase
    {
        private readonly ISlotService _slotService;

        public SlotsController(ISlotService slotService)
        {
            // Method: SlotsController Constructor - Injects ISlotService instance.
            _slotService = slotService;
        }

        /// <summary>
        /// Retrieves trading slots configured for a specific solar hub and date.
        /// </summary>
        [HttpGet("station/{stationId}")]
        public async Task<IActionResult> GetByStation(string stationId, [FromQuery] string? date)
        {
            // Method: GetByStation - Retrieves all time slots matching station ID and optional date.
            var slots = await _slotService.GetSlotsByStationAsync(stationId, date);
            return Ok(slots);
        }

        /// <summary>
        /// Creates a new energy trading time slot for a station (Backoffice or Grid Operator).
        /// </summary>
        [HttpPost]
        [Authorize(Roles = "Backoffice,GridOperator")]
        public async Task<IActionResult> Create([FromBody] EnergySlot slot)
        {
            // Method: Create - Inserts a new booking slot into EnergyBookingSlots collection.
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var created = await _slotService.CreateSlotAsync(slot);
            return Created($"/api/slots/{created.Id}", created);
        }

        /// <summary>
        /// Adjusts slot capacity allocation and remaining available booking slots.
        /// </summary>
        [HttpPut("{id}/availability")]
        [Authorize(Roles = "Backoffice,GridOperator")]
        public async Task<IActionResult> UpdateAvailability(string id, [FromBody] UpdateSlotAvailabilityDto dto)
        {
            // Method: UpdateAvailability - Modifies slot capacity status and remaining slots.
            var success = await _slotService.UpdateSlotAvailabilityAsync(id, dto.AvailableSlots, dto.AllocatedKwh);
            if (!success)
            {
                return NotFound(new { message = "Slot not found." });
            }

            return Ok(new { message = "Slot availability updated successfully." });
        }
    }

    public class UpdateSlotAvailabilityDto
    {
        public int AvailableSlots { get; set; }
        public double AllocatedKwh { get; set; }
    }
}
