// ============================================================================
// File: UsersController.cs
// Project: Smart Solar Microgrid Trading System
// Author: Enterprise Application Development Team
// Description: API controller for user administration, prosumer approval, and account status updates.
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
    public class UsersController : ControllerBase
    {
        private readonly IUserService _userService;

        public UsersController(IUserService userService)
        {
            // Method: UsersController Constructor - Injects the IUserService instance.
            _userService = userService;
        }

        /// <summary>
        /// Retrieves users list, filterable by role and status (Backoffice role only).
        /// </summary>
        [HttpGet]
        [Authorize(Roles = "Backoffice")]
        public async Task<IActionResult> GetUsers([FromQuery] string? role, [FromQuery] string? status)
        {
            // Method: GetUsers - Queries user records based on optional role and status parameters.
            var users = await _userService.GetUsersAsync(role, status);
            var result = users.Select(u => new
            {
                u.Id,
                u.Nic,
                u.FullName,
                u.Email,
                u.Phone,
                u.Role,
                u.Status,
                u.CreatedAt,
                u.UpdatedAt
            });
            return Ok(result);
        }

        /// <summary>
        /// Retrieves pending prosumer registrations awaiting Backoffice review.
        /// </summary>
        [HttpGet("pending-prosumers")]
        [Authorize(Roles = "Backoffice")]
        public async Task<IActionResult> GetPendingProsumers()
        {
            // Method: GetPendingProsumers - Gets list of prosumer accounts awaiting approval.
            var prosumers = await _userService.GetPendingProsumersAsync();
            var result = prosumers.Select(u => new
            {
                u.Id,
                u.Nic,
                u.FullName,
                u.Email,
                u.Phone,
                u.Role,
                u.Status,
                u.CreatedAt
            });
            return Ok(result);
        }

        /// <summary>
        /// Gets a user profile by NIC (Backoffice or account owner).
        /// </summary>
        [HttpGet("{nic}")]
        [Authorize]
        public async Task<IActionResult> GetUserByNic(string nic)
        {
            // Method: GetUserByNic - Retrieves specific profile information by NIC.
            var currentRole = User.FindFirstValue(ClaimTypes.Role);
            var currentNic = User.FindFirstValue(ClaimTypes.NameIdentifier);

            if (currentRole != "Backoffice" && currentNic != nic)
            {
                return Forbid();
            }

            var user = await _userService.GetUserByNicAsync(nic);
            if (user == null)
            {
                return NotFound(new { message = "User not found." });
            }

            return Ok(new
            {
                user.Id,
                user.Nic,
                user.FullName,
                user.Email,
                user.Phone,
                user.Role,
                user.Status,
                user.CreatedAt,
                user.UpdatedAt
            });
        }

        /// <summary>
        /// Updates prosumer/user status: "Active", "Deactivated" (Backoffice only).
        /// </summary>
        [HttpPut("{nic}/status")]
        [Authorize(Roles = "Backoffice")]
        public async Task<IActionResult> UpdateStatus(string nic, [FromBody] UpdateStatusDto dto)
        {
            // Method: UpdateStatus - Backoffice action to approve, deactivate, or reactivate user accounts.
            var currentRole = User.FindFirstValue(ClaimTypes.Role) ?? "Backoffice";

            try
            {
                var success = await _userService.UpdateUserStatusAsync(nic, dto.Status, currentRole);
                if (!success)
                {
                    return NotFound(new { message = $"User with NIC '{nic}' not found." });
                }

                return Ok(new { message = $"Account '{nic}' status successfully changed to '{dto.Status}'." });
            }
            catch (UnauthorizedAccessException ex)
            {
                return Forbid(ex.Message);
            }
        }

        /// <summary>
        /// Updates the authenticated user's personal profile information.
        /// </summary>
        [HttpPut("profile")]
        [Authorize]
        public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileDto dto)
        {
            // Method: UpdateProfile - Allows authenticated users to update their personal contact data.
            var nic = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(nic))
            {
                return Unauthorized();
            }

            var success = await _userService.UpdateProfileAsync(nic, dto);
            if (!success)
            {
                return NotFound(new { message = "User not found." });
            }

            return Ok(new { message = "Profile updated successfully." });
        }

        /// <summary>
        /// Prosumer self-service action to request account deactivation.
        /// </summary>
        [HttpPost("deactivate-self")]
        [Authorize(Roles = "Prosumer")]
        public async Task<IActionResult> DeactivateSelf()
        {
            // Method: DeactivateSelf - Marks prosumer account as deactivated. Reactivation requires Backoffice officer.
            var nic = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(nic))
            {
                return Unauthorized();
            }

            var success = await _userService.RequestDeactivationAsync(nic);
            if (!success)
            {
                return NotFound(new { message = "User not found." });
            }

            return Ok(new { message = "Your account has been deactivated. Contact Backoffice for reactivation." });
        }
    }

    public class UpdateStatusDto
    {
        public string Status { get; set; } = "Active"; // "Active" or "Deactivated"
    }
}
