// ============================================================================
// File: UserService.cs
// Project: Smart Solar Microgrid Trading System
// Author: Enterprise Application Development Team
// Description: Implements user authentication, JWT generation, and account role verification.
// ============================================================================

using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using MongoDB.Driver;
using SolarMicrogridApi.Data;
using SolarMicrogridApi.Models;

namespace SolarMicrogridApi.Services
{
    /// <summary>
    /// Service implementing business rules for User Management, Prosumer lifecycle, and JWT authorization.
    /// </summary>
    public class UserService : IUserService
    {
        private readonly MongoDbContext _context;
        private readonly IConfiguration _configuration;

        public UserService(MongoDbContext context, IConfiguration configuration)
        {
            // Method: UserService Constructor - Injects database context and configuration settings.
            _context = context;
            _configuration = configuration;
        }

        public async Task<AuthResponseDto?> AuthenticateAsync(LoginRequestDto request)
        {
            // Method: AuthenticateAsync - Validates credentials against User's detail and generates JWT token.
            var filter = Builders<User>.Filter.Or(
                Builders<User>.Filter.Eq(u => u.Nic, request.UsernameOrNic),
                Builders<User>.Filter.Eq(u => u.Email, request.UsernameOrNic)
            );

            var user = await _context.Users.Find(filter).FirstOrDefaultAsync();
            if (user == null)
            {
                return null;
            }

            // Verify password using BCrypt
            bool passwordValid = BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash);
            if (!passwordValid)
            {
                return null;
            }

            // Generate JWT Token
            var tokenHandler = new JwtSecurityTokenHandler();
            var secretKey = _configuration["JwtSettings:SecretKey"] ?? "EnterpriseSolarMicrogridTradingSystemSecretKey2026!#Security";
            var key = Encoding.UTF8.GetBytes(secretKey);

            var tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(new[]
                {
                    new Claim(ClaimTypes.NameIdentifier, user.Nic),
                    new Claim(ClaimTypes.Name, user.FullName),
                    new Claim(ClaimTypes.Email, user.Email),
                    new Claim(ClaimTypes.Role, user.Role),
                    new Claim("Status", user.Status)
                }),
                Expires = DateTime.UtcNow.AddDays(7),
                Issuer = _configuration["JwtSettings:Issuer"] ?? "SolarMicrogridApi",
                Audience = _configuration["JwtSettings:Audience"] ?? "SolarMicrogridClients",
                SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
            };

            var token = tokenHandler.CreateToken(tokenDescriptor);

            return new AuthResponseDto
            {
                Token = tokenHandler.WriteToken(token),
                Nic = user.Nic,
                FullName = user.FullName,
                Email = user.Email,
                Role = user.Role,
                Status = user.Status
            };
        }

        public async Task<User> RegisterProsumerAsync(ProsumerRegisterDto dto)
        {
            // Method: RegisterProsumerAsync - Creates new Prosumer account with initial "Pending" status requiring Backoffice approval.
            var existingUser = await _context.Users.Find(u => u.Nic == dto.Nic || u.Email == dto.Email).FirstOrDefaultAsync();
            if (existingUser != null)
            {
                throw new InvalidOperationException("User with this NIC or Email already registered.");
            }

            var prosumer = new User
            {
                Nic = dto.Nic.Trim().ToUpper(),
                FullName = dto.FullName.Trim(),
                Email = dto.Email.Trim().ToLower(),
                Phone = dto.Phone.Trim(),
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
                Role = "Prosumer",
                Status = "Pending", // Requires backoffice activation
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            await _context.Users.InsertOneAsync(prosumer);
            return prosumer;
        }

        public async Task<User> CreateStaffUserAsync(CreateStaffUserDto dto)
        {
            // Method: CreateStaffUserAsync - Backoffice feature to provision Backoffice or GridOperator accounts.
            var existingUser = await _context.Users.Find(u => u.Nic == dto.Nic || u.Email == dto.Email).FirstOrDefaultAsync();
            if (existingUser != null)
            {
                throw new InvalidOperationException("User with this NIC or Email already exists.");
            }

            var staffUser = new User
            {
                Nic = dto.Nic.Trim().ToUpper(),
                FullName = dto.FullName.Trim(),
                Email = dto.Email.Trim().ToLower(),
                Phone = dto.Phone.Trim(),
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
                Role = dto.Role == "Backoffice" ? "Backoffice" : "GridOperator",
                Status = "Active",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            await _context.Users.InsertOneAsync(staffUser);
            return staffUser;
        }

        public async Task<List<User>> GetUsersAsync(string? role = null, string? status = null)
        {
            // Method: GetUsersAsync - Retrieves filtered users list for administration and audit.
            var builder = Builders<User>.Filter;
            var filter = builder.Empty;

            if (!string.IsNullOrEmpty(role))
            {
                filter &= builder.Eq(u => u.Role, role);
            }
            if (!string.IsNullOrEmpty(status))
            {
                filter &= builder.Eq(u => u.Status, status);
            }

            return await _context.Users.Find(filter).ToListAsync();
        }

        public async Task<List<User>> GetPendingProsumersAsync()
        {
            // Method: GetPendingProsumersAsync - Queries all prosumer accounts awaiting Backoffice activation.
            return await _context.Users.Find(u => u.Role == "Prosumer" && u.Status == "Pending").ToListAsync();
        }

        public async Task<User?> GetUserByNicAsync(string nic)
        {
            // Method: GetUserByNicAsync - Looks up user profile by National Identity Card number.
            return await _context.Users.Find(u => u.Nic == nic).FirstOrDefaultAsync();
        }

        public async Task<bool> UpdateUserStatusAsync(string nic, string newStatus, string operatorRole)
        {
            // Method: UpdateUserStatusAsync - Updates account status (Activate/Deactivate/Reactivate) enforcing Backoffice rule and reservation checks.
            if (operatorRole != "Backoffice")
            {
                throw new UnauthorizedAccessException("Only Backoffice officers have permission to activate or reactivate accounts.");
            }

            if (newStatus == "Deactivated")
            {
                // FAT Service Rule: Check for active reservations before deactivation
                var activeCount = await _context.Reservations.CountDocumentsAsync(r => 
                    r.ProsumerNic == nic && 
                    (r.Status == "Approved" || r.Status == "Pending") && 
                    r.ScheduledDateTime >= DateTime.UtcNow
                );

                if (activeCount > 0)
                {
                    throw new InvalidOperationException($"Cannot deactivate account '{nic}'. There are {activeCount} active or confirmed future energy trading reservations.");
                }
            }

            var update = Builders<User>.Update
                .Set(u => u.Status, newStatus)
                .Set(u => u.UpdatedAt, DateTime.UtcNow);

            var result = await _context.Users.UpdateOneAsync(u => u.Nic == nic, update);
            return result.ModifiedCount > 0;
        }

        public async Task<bool> UpdateProfileAsync(string nic, UpdateProfileDto dto)
        {
            // Method: UpdateProfileAsync - Enables users to edit their own contact details.
            var update = Builders<User>.Update
                .Set(u => u.FullName, dto.FullName)
                .Set(u => u.Email, dto.Email)
                .Set(u => u.Phone, dto.Phone)
                .Set(u => u.UpdatedAt, DateTime.UtcNow);

            var result = await _context.Users.UpdateOneAsync(u => u.Nic == nic, update);
            return result.ModifiedCount > 0;
        }

        public async Task<bool> RequestDeactivationAsync(string nic)
        {
            // Method: RequestDeactivationAsync - Prosumer self-service action to deactivate account. Blocks if active bookings exist.
            var activeCount = await _context.Reservations.CountDocumentsAsync(r => 
                r.ProsumerNic == nic && 
                (r.Status == "Approved" || r.Status == "Pending") && 
                r.ScheduledDateTime >= DateTime.UtcNow
            );

            if (activeCount > 0)
            {
                throw new InvalidOperationException($"Cannot deactivate account. You have {activeCount} active or confirmed energy trading reservations. Please complete or cancel them with 12 hours notice first.");
            }

            var update = Builders<User>.Update
                .Set(u => u.Status, "Deactivated")
                .Set(u => u.UpdatedAt, DateTime.UtcNow);

            var result = await _context.Users.UpdateOneAsync(u => u.Nic == nic, update);
            return result.ModifiedCount > 0;
        }
    }
}
