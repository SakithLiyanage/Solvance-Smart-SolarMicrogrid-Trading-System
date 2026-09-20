// ============================================================================
// File: AuthController.cs
// Project: Smart Solar Microgrid Trading System
// Author: Enterprise Application Development Team
// Description: API controller handling authentication, prosumer registration, and staff onboarding.
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

        /// <summary>
        /// Authenticates user and returns JWT token along with role details.
        /// </summary>
        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequestDto request)
        {
            // Method: Login - Validates user credentials and issues signed JWT bearer token.
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var response = await _userService.AuthenticateAsync(request);
            if (response == null)
            {
                return Unauthorized(new { message = "Invalid National Identity Card / Email or password." });
            }

            return Ok(response);
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
                role = user.Role,
                status = user.Status
            });
        }
    }
}
