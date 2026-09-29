// ============================================================================
// File: AuthController.cs
// Project: Solvance — Smart Solar Microgrid Trading System
// Author: M.L. Booso (IT23452916)
// Course: SE4040 - Enterprise Application Development (SLIIT)
// Description: API controller handling authentication, prosumer registration, and staff onboarding.
// References & Citations:
//   - Microsoft ASP.NET Core Identity & JWT Authentication:
//     https://learn.microsoft.com/en-us/aspnet/core/security/authentication/
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
    public class AuthController : ControllerBase
    {
        private readonly IUserService _userService;

        public AuthController(IUserService userService)
        {
            // Method: AuthController Constructor - Injects the IUserService instance.
            _userService = userService;
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequestDto request)
        {
            // Method: Login - Validates user credentials, enforces status checks, and issues signed JWT bearer token.
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var response = await _userService.AuthenticateAsync(request);
                if (response == null)
                {
                    return Unauthorized(new AuthErrorResponseDto
                    {
                        Code = "INVALID_CREDENTIALS",
                        Message = "Invalid National Identity Card / Email or password."
                    });
                }

                return Ok(response);
            }
            catch (AccountPendingException ex)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new AuthErrorResponseDto
                {
                    Code = "ACCOUNT_PENDING",
                    Message = ex.Message,
                    Status = "Pending"
                });
            }
            catch (AccountDeactivatedException ex)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new AuthErrorResponseDto
                {
                    Code = "ACCOUNT_DEACTIVATED",
                    Message = ex.Message,
                    Status = "Deactivated"
                });
            }
            catch (AccountLockedException ex)
            {
                return StatusCode(StatusCodes.Status423Locked, new AuthErrorResponseDto
                {
                    Code = "ACCOUNT_LOCKED",
                    Message = ex.Message,
                    Status = "Locked"
                });
            }
        }

        /// <summary>
        /// Registers a new Solar Prosumer (account starts in Pending state).
        /// </summary>
        [HttpPost("register-prosumer")]
        public async Task<IActionResult> RegisterProsumer([FromBody] ProsumerRegisterDto dto)
        {
            // Method: RegisterProsumer - Onboards solar prosumer using NIC as primary key.
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var user = await _userService.RegisterProsumerAsync(dto);
                return Created($"/api/users/{user.Nic}", new
                {
                    message = "Prosumer registered successfully. Account is pending Backoffice approval.",
                    nic = user.Nic,
                    fullName = user.FullName,
                    status = user.Status
                });
            }
            catch (InvalidOperationException ex)
            {
                return Conflict(new { message = ex.Message });
            }
        }

        /// <summary>
        /// Creates Backoffice or Grid Operator staff accounts (Backoffice role only).
        /// </summary>
        [HttpPost("register-staff")]
        [Authorize(Roles = "Backoffice")]
        public async Task<IActionResult> RegisterStaff([FromBody] CreateStaffUserDto dto)
        {
            // Method: RegisterStaff - Allows Backoffice officers to create operational and administration users.
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var user = await _userService.CreateStaffUserAsync(dto);
                return Ok(new
                {
                    message = $"{user.Role} account created successfully.",
                    nic = user.Nic,
                    fullName = user.FullName,
                    role = user.Role
                });
            }
            catch (InvalidOperationException ex)
            {
                return Conflict(new { message = ex.Message });
            }
        }

        /// <summary>
        /// Gets current authenticated user details from claims.
        /// </summary>
        [HttpGet("me")]
        [Authorize]
        public async Task<IActionResult> GetCurrentUser()
        {
            // Method: GetCurrentUser - Retrieves profile information for the authenticated token subject.
            var nic = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(nic))
            {
                return Unauthorized();
            }

            var user = await _userService.GetUserByNicAsync(nic);
            if (user == null)
            {
                return NotFound(new { message = "User not found." });
            }

            return Ok(new
            {
                nic = user.Nic,
                fullName = user.FullName,
                email = user.Email,
                phone = user.Phone,
                address = user.Address,
                role = user.Role,
                status = user.Status,
                solarCapacityKw = user.SolarCapacityKw,
                inverterSerial = user.InverterSerial,
                registeredAt = user.RegisteredAt,
                activatedAt = user.ActivatedAt
            });
        }

        /// <summary>
        /// Updates the authenticated user's personal password and clears mandatory reset flag.
        /// </summary>
        [HttpPost("change-password")]
        [Authorize]
        public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordDto dto)
        {
            // Method: ChangePassword - Updates credentials when user sets personal password or satisfies mandatory change flag.
            var userNic = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userNic))
            {
                return Unauthorized();
            }

            if (!string.IsNullOrEmpty(dto.ConfirmPassword) && dto.NewPassword != dto.ConfirmPassword)
            {
                return BadRequest(new { message = "New password and confirmation password do not match." });
            }

            try
            {
                var success = await _userService.ChangePasswordAsync(userNic, dto.CurrentPassword, dto.NewPassword);
                if (!success)
                {
                    return BadRequest(new { message = "Incorrect current password." });
                }

                return Ok(new { message = "Password updated successfully." });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }
    }
}
