// ============================================================================
// File: UsersController.cs
// Project: Solvance — Smart Solar Microgrid Trading System
// Author: M.L. Booso (IT23452916)
// Course: SE4040 - Enterprise Application Development (SLIIT)
// Description: API controller for user administration, prosumer approval, and account status updates.
// References & Citations:
//   - Microsoft ASP.NET Core Authorization & Security Policies:
//     https://learn.microsoft.com/en-us/aspnet/core/security/authorization/
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
                u.Username,
                u.FullName,
                u.Email,
                u.Phone,
                u.Address,
                u.Role,
                u.Status,
                u.SolarCapacityKw,
                u.InverterSerial,
                u.NicDocumentBase64,
                u.UtilityBillBase64,
                u.KycTrustScore,
                u.KycRiskLevel,
                u.KycNotes,
                u.RegisteredAt,
                u.ActivatedAt,
                u.ApprovedBy,
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
                u.Username,
                u.FullName,
                u.Email,
                u.Phone,
                u.Address,
                u.Role,
                u.Status,
                u.SolarCapacityKw,
                u.InverterSerial,
                u.NicDocumentBase64,
                u.UtilityBillBase64,
                u.KycTrustScore,
                u.KycRiskLevel,
                u.KycNotes,
                u.RegisteredAt,
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
                user.Username,
                user.FullName,
                user.Email,
                user.Phone,
                user.Address,
                user.Role,
                user.Status,
                user.SolarCapacityKw,
                user.InverterSerial,
                user.NicDocumentBase64,
                user.UtilityBillBase64,
                user.KycTrustScore,
                user.KycRiskLevel,
                user.KycNotes,
                user.RegisteredAt,
                user.ActivatedAt,
                user.ApprovedBy,
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
            var operatorNic = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "ADMIN001";

            try
            {
                var success = await _userService.UpdateUserStatusAsync(nic, dto.Status, currentRole, operatorNic);
                if (!success)
                {
                    return NotFound(new { message = $"User with NIC '{nic}' not found." });
                }

                return Ok(new { message = $"Account '{nic}' status successfully changed to '{dto.Status}'." });
            }
            catch (InvalidOperationException ex)
            {
                return Conflict(new { message = ex.Message });
            }
            catch (UnauthorizedAccessException ex)
            {
                return Forbid(ex.Message);
            }
        }

        /// <summary>
        /// Updates a prosumer or user profile by NIC (Backoffice only).
        /// </summary>
        [HttpPut("{nic}")]
        [Authorize(Roles = "Backoffice")]
        public async Task<IActionResult> UpdateUserByNic(string nic, [FromBody] UpdateProfileDto dto)
        {
            // Method: UpdateUserByNic - Allows Backoffice officers to update user profile information and solar hardware specs.
            var success = await _userService.UpdateProfileAsync(nic, dto);
            if (!success)
            {
                return NotFound(new { message = $"User with NIC '{nic}' not found." });
            }

            return Ok(new { message = $"Profile for '{nic}' updated successfully." });
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
            // Method: DeactivateSelf - Marks prosumer account as deactivated with active reservations check.
            var nic = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(nic))
            {
                return Unauthorized();
            }

            try
            {
                var success = await _userService.RequestDeactivationAsync(nic);
                if (!success)
                {
                    return NotFound(new { message = "User not found." });
                }

                return Ok(new { message = "Your account has been deactivated. Contact Backoffice for reactivation." });
            }
            catch (InvalidOperationException ex)
            {
                return Conflict(new { message = ex.Message });
            }
        }
    }

    public class UpdateStatusDto
    {
        public string Status { get; set; } = "Active"; // "Active" or "Deactivated"
    }
}
