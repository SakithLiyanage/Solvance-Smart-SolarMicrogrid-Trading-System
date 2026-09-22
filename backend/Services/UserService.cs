// ============================================================================
// File: UserService.cs
// Project: Solvance — Smart Solar Microgrid Trading System
// Author: M.L. Booso (IT23452916)
// Course: SE4040 - Enterprise Application Development (SLIIT)
// Description: Implements user authentication, JWT generation, and account role verification.
// References & Citations:
//   - System.IdentityModel.Tokens.Jwt (Microsoft JSON Web Token Handler):
//     https://learn.microsoft.com/en-us/dotnet/api/system.identitymodel.tokens.jwt
//   - BCrypt.Net Cryptographic Password Hashing:
//     https://github.com/BcryptNet/bcrypt.net
// ============================================================================

using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using MongoDB.Driver;
using SolarMicrogridApi.Data;
using SolarMicrogridApi.Models;
using SolarMicrogridApi.Models.Config;

namespace SolarMicrogridApi.Services
{
    /// <summary>
    /// Service implementing business rules for User Management, Prosumer lifecycle, and JWT authorization.
    /// </summary>
    public class UserService : IUserService
    {
        private readonly MongoDbContext _context;
        private readonly IConfiguration _configuration;
        private readonly JwtSettings _jwtSettings;
        private readonly SecuritySettings _securitySettings;

        public UserService(
            MongoDbContext context, 
            IConfiguration configuration,
            IOptions<JwtSettings> jwtOptions,
            IOptions<SecuritySettings> securityOptions)
        {
            // Method: UserService Constructor - Injects database context and strongly-typed configuration settings.
            _context = context;
            _configuration = configuration;
            _jwtSettings = jwtOptions?.Value ?? new JwtSettings();
            _securitySettings = securityOptions?.Value ?? new SecuritySettings();
        }

        public async Task<AuthResponseDto?> AuthenticateAsync(LoginRequestDto request)
        {
            // Method: AuthenticateAsync - Validates credentials against User's detail, enforces status guards, tracks lockout, and generates JWT.
            var filter = Builders<User>.Filter.Or(
                Builders<User>.Filter.Eq(u => u.Nic, request.UsernameOrNic.Trim()),
                Builders<User>.Filter.Eq(u => u.Username, request.UsernameOrNic.Trim()),
                Builders<User>.Filter.Eq(u => u.Email, request.UsernameOrNic.Trim().ToLower())
            );

            var user = await _context.Users.Find(filter).FirstOrDefaultAsync();
            if (user == null)
            {
                return null;
            }

            // Check if account is temporarily locked out
            if (user.LockoutEnd.HasValue && user.LockoutEnd.Value > DateTime.UtcNow)
            {
                var remainingMinutes = Math.Ceiling((user.LockoutEnd.Value - DateTime.UtcNow).TotalMinutes);
                throw new AccountLockedException($"Account is temporarily locked due to excessive failed attempts. Try again in {remainingMinutes} minutes.", user.LockoutEnd);
            }

            // Verify password using BCrypt
            bool passwordValid = BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash);
            if (!passwordValid)
            {
                // Increment failed attempts and trigger lockout if limit reached
                int newAttempts = user.FailedLoginAttempts + 1;
                DateTime? newLockout = null;

                if (newAttempts >= _securitySettings.MaxFailedLoginAttempts)
                {
                    newLockout = DateTime.UtcNow.AddMinutes(_securitySettings.LockoutDurationMinutes);
                }

                var failedUpdate = Builders<User>.Update
                    .Set(u => u.FailedLoginAttempts, newAttempts)
                    .Set(u => u.LockoutEnd, newLockout)
                    .Set(u => u.UpdatedAt, DateTime.UtcNow);

                await _context.Users.UpdateOneAsync(u => u.Id == user.Id, failedUpdate);

                if (newLockout.HasValue)
                {
                    throw new AccountLockedException($"Account locked for {_securitySettings.LockoutDurationMinutes} minutes due to {newAttempts} failed login attempts.", newLockout);
                }

                return null;
            }

            // Enforce account status lifecycle guards
            if (user.Status == "Pending")
            {
                throw new AccountPendingException("Your account registration is currently pending Backoffice KYC approval.");
            }

            if (user.Status == "Deactivated")
            {
                throw new AccountDeactivatedException("Your account has been deactivated. Contact Backoffice support for reactivation.");
            }

            // Reset failed login attempts on successful authentication
            if (user.FailedLoginAttempts > 0 || user.LockoutEnd != null)
            {
                var resetUpdate = Builders<User>.Update
                    .Set(u => u.FailedLoginAttempts, 0)
                    .Set(u => u.LockoutEnd, null)
                    .Set(u => u.UpdatedAt, DateTime.UtcNow);
                await _context.Users.UpdateOneAsync(u => u.Id == user.Id, resetUpdate);
            }

            // Generate JWT Token
            var tokenHandler = new JwtSecurityTokenHandler();
            var secretKey = !string.IsNullOrEmpty(_jwtSettings.EffectiveSecret)
                ? _jwtSettings.EffectiveSecret
                : (_configuration["JwtSettings:SecretKey"] ?? "EnterpriseSolarMicrogridTradingSystemSecretKey2026!#Security");
            var key = Encoding.UTF8.GetBytes(secretKey);

            var issuer = !string.IsNullOrEmpty(_jwtSettings.Issuer) ? _jwtSettings.Issuer : (_configuration["JwtSettings:Issuer"] ?? "SolarMicrogridApi");
            var audience = !string.IsNullOrEmpty(_jwtSettings.Audience) ? _jwtSettings.Audience : (_configuration["JwtSettings:Audience"] ?? "SolarMicrogridClients");

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
                Expires = DateTime.UtcNow.AddMinutes(_jwtSettings.AccessTokenExpiryMinutes > 0 ? _jwtSettings.AccessTokenExpiryMinutes : 10080),
                Issuer = issuer,
                Audience = audience,
                SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
            };

            var token = tokenHandler.CreateToken(tokenDescriptor);

            return new AuthResponseDto
            {
                Token = tokenHandler.WriteToken(token),
                Nic = user.Nic,
                FullName = user.FullName,
                Email = user.Email,
                Phone = user.Phone,
                Address = user.Address,
                Role = user.Role,
                Status = user.Status,
                SolarCapacityKw = user.SolarCapacityKw,
                InverterSerial = user.InverterSerial
            };
        }

        public async Task<User> RegisterProsumerAsync(ProsumerRegisterDto dto)
        {
            // Method: RegisterProsumerAsync - Creates new Prosumer account with initial "Pending" status and hardware solar specs.
            var existingUser = await _context.Users.Find(u => u.Nic == dto.Nic || u.Email == dto.Email).FirstOrDefaultAsync();
            if (existingUser != null)
            {
                throw new InvalidOperationException("User with this NIC or Email already registered.");
            }

            var prosumer = new User
            {
                Nic = dto.Nic.Trim().ToUpper(),
                Username = dto.Nic.Trim().ToUpper(),
                FullName = dto.FullName.Trim(),
                Email = dto.Email.Trim().ToLower(),
                Phone = dto.Phone.Trim(),
                Address = dto.Address.Trim(),
                SolarCapacityKw = dto.SolarCapacityKw,
                InverterSerial = dto.InverterSerial.Trim(),
                NicDocumentBase64 = dto.NicDocumentBase64,
                UtilityBillBase64 = dto.UtilityBillBase64,
                KycTrustScore = !string.IsNullOrEmpty(dto.NicDocumentBase64) ? 98 : 90,
                KycRiskLevel = "Low",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
                Role = "Prosumer",
                Status = _securitySettings.DefaultProsumerStatus ?? "Pending",
                RegisteredAt = DateTime.UtcNow,
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
                Username = dto.Nic.Trim().ToUpper(),
                FullName = dto.FullName.Trim(),
                Email = dto.Email.Trim().ToLower(),
                Phone = dto.Phone.Trim(),
                Address = dto.Address.Trim(),
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
                Role = dto.Role == "Backoffice" ? "Backoffice" : "GridOperator",
                Status = "Active",
                RegisteredAt = DateTime.UtcNow,
                ActivatedAt = DateTime.UtcNow,
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
            // Method: GetUserByNicAsync - Looks up user profile by National Identity Card number or username.
            return await _context.Users.Find(u => u.Nic == nic || u.Username == nic).FirstOrDefaultAsync();
        }

        public async Task<bool> UpdateUserStatusAsync(string nic, string newStatus, string operatorRole, string? operatorNic = null)
        {
            // Method: UpdateUserStatusAsync - Updates account status (Activate/Deactivate/Reactivate) enforcing Backoffice rule and audit fields.
            if (operatorRole != "Backoffice")
            {
                throw new UnauthorizedAccessException("Only Backoffice officers have permission to activate or reactivate accounts.");
            }

            // If deactivating a prosumer, verify no active/pending reservations exist
            if (newStatus == "Deactivated")
            {
                var activeCount = await _context.Reservations.CountDocumentsAsync(r =>
                    r.ProsumerNic == nic &&
                    (r.Status == "Pending" || r.Status == "Approved") &&
                    r.ScheduledDateTime >= DateTime.UtcNow
                );

                if (activeCount > 0)
                {
                    throw new InvalidOperationException($"Cannot deactivate prosumer '{nic}'. User has {activeCount} active or pending energy reservations.");
                }
            }

            var updateBuilder = Builders<User>.Update
                .Set(u => u.Status, newStatus)
                .Set(u => u.UpdatedAt, DateTime.UtcNow);

            if (newStatus == "Active")
            {
                updateBuilder = updateBuilder
                    .Set(u => u.ActivatedAt, DateTime.UtcNow)
                    .Set(u => u.ApprovedBy, operatorNic ?? "ADMIN001");
            }

            var result = await _context.Users.UpdateOneAsync(u => u.Nic == nic, updateBuilder);
            return result.ModifiedCount > 0;
        }

        public async Task<bool> UpdateProfileAsync(string nic, UpdateProfileDto dto)
        {
            // Method: UpdateProfileAsync - Enables users to edit their own contact and solar capacity details.
            var update = Builders<User>.Update
                .Set(u => u.FullName, dto.FullName)
                .Set(u => u.Email, dto.Email)
                .Set(u => u.Phone, dto.Phone)
                .Set(u => u.Address, dto.Address)
                .Set(u => u.SolarCapacityKw, dto.SolarCapacityKw)
                .Set(u => u.InverterSerial, dto.InverterSerial)
                .Set(u => u.UpdatedAt, DateTime.UtcNow);

            if (!string.IsNullOrEmpty(dto.NicDocumentBase64))
            {
                update = update.Set(u => u.NicDocumentBase64, dto.NicDocumentBase64);
            }
            if (!string.IsNullOrEmpty(dto.UtilityBillBase64))
            {
                update = update.Set(u => u.UtilityBillBase64, dto.UtilityBillBase64);
            }

            var result = await _context.Users.UpdateOneAsync(u => u.Nic == nic, update);
            return result.ModifiedCount > 0;
        }

        public async Task<bool> RequestDeactivationAsync(string nic)
        {
            // Method: RequestDeactivationAsync - Prosumer self-service action to deactivate account with active booking check.
            var activeCount = await _context.Reservations.CountDocumentsAsync(r =>
                r.ProsumerNic == nic &&
                (r.Status == "Pending" || r.Status == "Approved") &&
                r.ScheduledDateTime >= DateTime.UtcNow
            );

            if (activeCount > 0)
            {
                throw new InvalidOperationException($"Cannot deactivate account. You have {activeCount} active or pending energy reservations. Please cancel bookings first.");
            }

            var update = Builders<User>.Update
                .Set(u => u.Status, "Deactivated")
                .Set(u => u.UpdatedAt, DateTime.UtcNow);

            var result = await _context.Users.UpdateOneAsync(u => u.Nic == nic, update);
            return result.ModifiedCount > 0;
        }
    }
}
