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
                u.NicBackDocumentBase64,
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
                u.NicBackDocumentBase64,
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
                user.NicBackDocumentBase64,
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

            var targetUser = await _userService.GetUserByNicAsync(nic);
            if (targetUser == null)
            {
                return NotFound(new { message = $"User with NIC '{nic}' not found." });
            }

            // Security Rule: Administrators cannot alter status of other Backoffice Administrators
            if (targetUser.Role == "Backoffice" && targetUser.Nic != operatorNic)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = "Security policy violation: Administrators cannot alter status of other Backoffice Administrators." });
            }

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
                return StatusCode(StatusCodes.Status403Forbidden, new { message = ex.Message });
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
            var requesterNic = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var targetUser = await _userService.GetUserByNicAsync(nic);
            if (targetUser == null)
            {
                return NotFound(new { message = $"User with NIC '{nic}' not found." });
            }

            // Security Rule: Administrators cannot edit other Backoffice Administrators
            if (targetUser.Role == "Backoffice" && targetUser.Nic != requesterNic)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = "Security policy violation: Administrators cannot edit profile details of other Backoffice Administrators." });
            }

            var success = await _userService.UpdateProfileAsync(nic, dto);
            if (!success)
            {
                return NotFound(new { message = $"User with NIC '{nic}' not found." });
            }

            return Ok(new { message = $"Profile for '{nic}' updated successfully." });
        }

        /// <summary>
        /// Resets a staff member or user password (Backoffice only; self or non-admin staff).
        /// </summary>
        [HttpPost("{nic}/reset-password")]
        [Authorize(Roles = "Backoffice")]
        public async Task<IActionResult> ResetPassword(string nic, [FromBody] ResetPasswordDto dto)
        {
            // Method: ResetPassword - Allows Backoffice officers to reset credentials for staff and prosumers.
            var requesterRole = User.FindFirstValue(ClaimTypes.Role) ?? "Backoffice";
            var requesterNic = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "";

            if (string.IsNullOrWhiteSpace(dto.NewPassword))
            {
                return BadRequest(new { message = "Password cannot be empty." });
            }

            if (!string.IsNullOrEmpty(dto.ConfirmPassword) && dto.NewPassword != dto.ConfirmPassword)
            {
                return BadRequest(new { message = "New password and confirm password do not match." });
            }

            try
            {
                var success = await _userService.ResetPasswordAsync(nic, dto.NewPassword, requesterRole, requesterNic, dto.RequirePasswordChange);
                if (!success)
                {
                    return NotFound(new { message = $"User with NIC '{nic}' not found." });
                }

                return Ok(new { message = $"Password for account '{nic}' successfully updated." });
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = ex.Message });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
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

    public class ResetPasswordDto
    {
        public string NewPassword { get; set; } = string.Empty;
        public string ConfirmPassword { get; set; } = string.Empty;
        public bool RequirePasswordChange { get; set; } = false;
    }
}
