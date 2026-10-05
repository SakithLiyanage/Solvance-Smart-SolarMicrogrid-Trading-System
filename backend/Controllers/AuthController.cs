// ============================================================================
// File: AuthController.cs
// Project: Solvance — Smart Solar Microgrid Trading System
// Author: M.L. Booso (IT23452916)
// Course: SE4040 - Enterprise Application Development (SLIIT)
// Description: API controller handling authentication, prosumer registration, and staff onboarding.
// References & Citations:
//   - Microsoft ASP.NET Core Web API Controllers & Action Return Types:
//     https://learn.microsoft.com/en-us/aspnet/core/web-api/action-return-types
//   - Microsoft ASP.NET Core JWT Bearer Claims & ClaimsPrincipal:
//     https://learn.microsoft.com/en-us/dotnet/api/system.security.claims.claimsprincipal
//   - Microsoft ASP.NET Core Authorization Attributes ([AllowAnonymous], [Authorize]):
//     https://learn.microsoft.com/en-us/aspnet/core/security/authorization/simple
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
                    staffId = user.StaffId ?? user.Nic,
                    nic = user.Nic,
                    fullName = user.FullName,
                    role = user.Role
                });
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return Conflict(new { message = ex.Message });
            }
        }

        /// <summary>
        /// Highly secure initial bootstrap endpoint to create system administrator when no admin exists.
        /// Rejects if an administrator already exists or if master setup key is invalid.
        /// </summary>
        [HttpPost("bootstrap-admin")]
        [AllowAnonymous]
        public async Task<IActionResult> BootstrapAdmin([FromBody] BootstrapAdminDto dto)
        {
            // Method: BootstrapAdmin - Seeds the initial Backoffice administrator using a pre-shared master key.
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var admin = await _userService.BootstrapInitialAdminAsync(dto);
                return Created($"/api/users/{admin.Nic}", new
                {
                    message = "System Administrator successfully initialized.",
                    staffId = admin.StaffId ?? admin.Nic,
                    nic = admin.Nic,
                    fullName = admin.FullName,
                    role = admin.Role,
                    status = admin.Status
                });
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = ex.Message });
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

        /// <summary>
        /// Initiates secure multi-step password reset by dispatching a cryptographically random 6-digit OTP code.
        /// </summary>
        [HttpPost("forgot-password/request")]
        [AllowAnonymous]
        public async Task<IActionResult> RequestPasswordReset([FromBody] PasswordResetRequestDto dto)
        {
            // Method: RequestPasswordReset - Dispatches a secure 6-digit OTP code to user's registered email.
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var result = await _userService.RequestPasswordResetOtpAsync(dto);
                return Ok(result);
            }
            catch (InvalidOperationException ex)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = ex.Message });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        /// <summary>
        /// Verifies 6-digit OTP code and updates account password.
        /// </summary>
        [HttpPost("forgot-password/verify")]
        [HttpPost("forgot-password/reset")]
        [AllowAnonymous]
        public async Task<IActionResult> VerifyPasswordReset([FromBody] PasswordResetVerifyDto dto)
        {
            // Method: VerifyPasswordReset - Validates OTP code and resets user password.
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var success = await _userService.VerifyPasswordResetOtpAsync(dto);
                if (!success)
                {
                    return BadRequest(new { message = "Unable to reset password. Please check your verification code." });
                }

                return Ok(new { message = "Password reset successfully. You can now sign in with your new password." });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = ex.Message });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        /// <summary>
        /// Self-service password recovery for prosumers using registered Sri Lankan NIC and Email (Direct/Legacy).
        /// </summary>
        [HttpPost("forgot-password")]
        [AllowAnonymous]
        public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordDto dto)
        {
            // Method: ForgotPassword - Authenticates prosumer identity via NIC & Email and resets their password.
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var success = await _userService.ForgotPasswordAsync(dto);
                if (!success)
                {
                    return NotFound(new { message = "Unable to reset password. Please check your credentials." });
                }

                return Ok(new { message = "Password reset successfully. You can now sign in with your new password." });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = ex.Message });
            }
        }
    }
}
