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
        private readonly ILogger<UserService> _logger;
        private readonly IEmailService _emailService;

        public UserService(
            MongoDbContext context, 
            IConfiguration configuration,
            IOptions<JwtSettings> jwtOptions,
            IOptions<SecuritySettings> securityOptions,
            ILogger<UserService> logger,
            IEmailService emailService)
        {
            // Method: UserService Constructor - Injects database context, logger, email service, and strongly-typed configuration settings.
            _context = context;
            _configuration = configuration;
            _jwtSettings = jwtOptions?.Value ?? new JwtSettings();
            _securitySettings = securityOptions?.Value ?? new SecuritySettings();
            _logger = logger;
            _emailService = emailService;
        }

        public async Task<AuthResponseDto?> AuthenticateAsync(LoginRequestDto request)
        {
            // Method: AuthenticateAsync - Validates credentials against User's detail, enforces status guards, tracks lockout, and generates JWT.
            var identifier = request.UsernameOrNic.Trim();
            var identifierUpper = identifier.ToUpperInvariant();
            var identifierLower = identifier.ToLowerInvariant();

            var filter = Builders<User>.Filter.Or(
                Builders<User>.Filter.Eq(u => u.StaffId, identifier),
                Builders<User>.Filter.Eq(u => u.StaffId, identifierUpper),
                Builders<User>.Filter.Eq(u => u.Nic, identifier),
                Builders<User>.Filter.Eq(u => u.Nic, identifierUpper),
                Builders<User>.Filter.Eq(u => u.Username, identifier),
                Builders<User>.Filter.Eq(u => u.Username, identifierUpper),
                Builders<User>.Filter.Eq(u => u.Email, identifierLower)
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
                StaffId = user.StaffId ?? (user.Role != "Prosumer" ? user.Nic : null),
                FullName = user.FullName,
                Email = user.Email,
                Phone = user.Phone,
                Address = user.Address,
                Role = user.Role,
                Status = user.Status,
                MustChangePassword = user.MustChangePassword,
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
                NicBackDocumentBase64 = dto.NicBackDocumentBase64,
                UtilityBillBase64 = dto.UtilityBillBase64,
                KycTrustScore = (!string.IsNullOrEmpty(dto.NicDocumentBase64) && !string.IsNullOrEmpty(dto.NicBackDocumentBase64)) ? 99 : (!string.IsNullOrEmpty(dto.NicDocumentBase64) ? 95 : 85),
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
            // Security Policy: Administrators cannot create other Backoffice Administrators
            if (dto.Role == "Backoffice")
            {
                throw new UnauthorizedAccessException("Security policy violation: Administrators cannot create additional Backoffice Administrators. Only Grid Operators can be provisioned.");
            }

            var staffIdRaw = !string.IsNullOrWhiteSpace(dto.StaffId) ? dto.StaffId : dto.Nic;
            if (string.IsNullOrWhiteSpace(staffIdRaw))
            {
                throw new ArgumentException("Staff ID is required.");
            }
            var staffId = staffIdRaw.Trim();
            var staffIdUpper = staffId.ToUpperInvariant();
            var emailLower = dto.Email.Trim().ToLowerInvariant();

            var existingUser = await _context.Users.Find(u => 
                u.StaffId == staffId || u.StaffId == staffIdUpper ||
                u.Nic == staffId || u.Nic == staffIdUpper || 
                u.Username == staffId || u.Username == staffIdUpper ||
                u.Email == emailLower).FirstOrDefaultAsync();

            if (existingUser != null)
            {
                throw new InvalidOperationException("User with this Staff ID or Email already exists.");
            }

            var staffUser = new User
            {
                StaffId = staffIdUpper,
                Nic = staffIdUpper,
                Username = staffIdUpper,
                FullName = dto.FullName.Trim(),
                Email = emailLower,
                Phone = dto.Phone.Trim(),
                Address = dto.Address.Trim(),
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
                Role = "GridOperator",
                Status = "Active",
                RegisteredAt = DateTime.UtcNow,
                ActivatedAt = DateTime.UtcNow,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            await _context.Users.InsertOneAsync(staffUser);
            return staffUser;
        }

        public async Task<User> BootstrapInitialAdminAsync(BootstrapAdminDto dto)
        {
            // 1. Verify Setup Key
            var expectedKey = !string.IsNullOrEmpty(_securitySettings.SetupMasterKey)
                ? _securitySettings.SetupMasterKey
                : (_configuration["SecuritySettings:SetupMasterKey"] ?? "SolvanceMasterBootstrap2026!#UltraSecure");

            if (string.IsNullOrWhiteSpace(dto.SetupKey) || dto.SetupKey != expectedKey)
            {
                throw new UnauthorizedAccessException("Invalid bootstrap security key.");
            }

            // 2. Strict Singleton Check: Reject if any Backoffice admin already exists in the system
            var existingAdminCount = await _context.Users.CountDocumentsAsync(u => u.Role == "Backoffice");
            if (existingAdminCount > 0)
            {
                throw new InvalidOperationException("Bootstrap disabled: An administrator account already exists. No additional admin accounts can be created.");
            }

            // 3. Resolve Admin Identifier (defaults to StaffId, Nic, or email prefix)
            var adminIdRaw = !string.IsNullOrWhiteSpace(dto.StaffId)
                ? dto.StaffId
                : (!string.IsNullOrWhiteSpace(dto.Nic)
                    ? dto.Nic
                    : (dto.Email.Contains('@') ? dto.Email.Split('@')[0] : "ADMIN"));
            var adminId = adminIdRaw.Trim();
            var adminIdUpper = adminId.ToUpperInvariant();
            var emailLower = dto.Email.Trim().ToLowerInvariant();

            // Reject if ID or Email exists
            var existingUser = await _context.Users.Find(u => 
                u.StaffId == adminId || u.StaffId == adminIdUpper ||
                u.Nic == adminId || u.Nic == adminIdUpper || 
                u.Username == adminId || u.Username == adminIdUpper ||
                u.Email == emailLower).FirstOrDefaultAsync();

            if (existingUser != null)
            {
                throw new InvalidOperationException($"User with identifier '{adminId}' or email '{dto.Email}' already exists.");
            }

            // 4. Create single master Backoffice Admin
            var adminUser = new User
            {
                StaffId = adminIdUpper,
                Nic = adminIdUpper,
                Username = adminIdUpper,
                FullName = dto.FullName.Trim(),
                Email = emailLower,
                Phone = dto.Phone.Trim(),
                Address = string.IsNullOrWhiteSpace(dto.Address) ? "National Operations Command — Colombo" : dto.Address.Trim(),
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
                Role = "Backoffice",
                Status = "Active",
                RegisteredAt = DateTime.UtcNow,
                ActivatedAt = DateTime.UtcNow,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            await _context.Users.InsertOneAsync(adminUser);
            return adminUser;
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
            // Method: GetUserByNicAsync - Looks up user profile by National Identity Card number, Staff ID, or username.
            var trimmed = nic.Trim();
            var upper = trimmed.ToUpperInvariant();
            return await _context.Users.Find(u => 
                u.StaffId == trimmed || u.StaffId == upper ||
                u.Nic == trimmed || u.Nic == upper || 
                u.Username == trimmed || u.Username == upper).FirstOrDefaultAsync();
        }

        public async Task<bool> UpdateUserStatusAsync(string nic, string newStatus, string operatorRole, string? operatorNic = null)
        {
            // Method: UpdateUserStatusAsync - Updates account status (Activate/Deactivate/Reactivate) enforcing Backoffice rule and audit fields.
            if (operatorRole != "Backoffice")
            {
                throw new UnauthorizedAccessException("Only Backoffice officers have permission to activate or reactivate accounts.");
            }

            var cleanNic = nic.Trim().ToUpperInvariant();

            // If deactivating a prosumer, verify no active/pending reservations exist
            if (newStatus == "Deactivated")
            {
                var activeCount = await _context.Reservations.CountDocumentsAsync(r =>
                    (r.ProsumerNic == cleanNic || r.ProsumerNic == nic.Trim()) &&
                    (r.Status == "Pending" || r.Status == "Approved") &&
                    r.ScheduledDateTime >= DateTime.UtcNow
                );

                if (activeCount > 0)
                {
                    throw new InvalidOperationException($"Cannot deactivate prosumer '{cleanNic}'. User has {activeCount} active or pending energy reservations.");
                }
            }

            var updateBuilder = Builders<User>.Update
                .Set(u => u.Status, newStatus)
                .Set(u => u.UpdatedAt, DateTime.UtcNow);

            if (newStatus == "Active")
            {
                updateBuilder = updateBuilder
                    .Set(u => u.ActivatedAt, DateTime.UtcNow)
                    .Set(u => u.ApprovedBy, !string.IsNullOrWhiteSpace(operatorNic) ? operatorNic : "Backoffice");
            }

            var result = await _context.Users.UpdateOneAsync(u => u.Nic == cleanNic || u.Nic == nic.Trim(), updateBuilder);
            return result.ModifiedCount > 0;
        }

        public async Task<bool> UpdateProfileAsync(string nic, UpdateProfileDto dto)
        {
            // Method: UpdateProfileAsync - Enables users to edit their own contact and solar capacity details.
            var cleanNic = nic.Trim().ToUpperInvariant();
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
            if (!string.IsNullOrEmpty(dto.NicBackDocumentBase64))
            {
                update = update.Set(u => u.NicBackDocumentBase64, dto.NicBackDocumentBase64);
            }
            if (!string.IsNullOrEmpty(dto.UtilityBillBase64))
            {
                update = update.Set(u => u.UtilityBillBase64, dto.UtilityBillBase64);
            }

            var result = await _context.Users.UpdateOneAsync(u => u.Nic == cleanNic || u.Nic == nic.Trim(), update);
            return result.ModifiedCount > 0;
        }

        public async Task<bool> RequestDeactivationAsync(string nic)
        {
            // Method: RequestDeactivationAsync - Prosumer self-service action to deactivate account with active booking check.
            var cleanNic = nic.Trim().ToUpperInvariant();
            var activeCount = await _context.Reservations.CountDocumentsAsync(r =>
                (r.ProsumerNic == cleanNic || r.ProsumerNic == nic.Trim()) &&
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

            var result = await _context.Users.UpdateOneAsync(u => u.Nic == cleanNic || u.Nic == nic.Trim(), update);
            return result.ModifiedCount > 0;
        }

        public async Task<bool> ResetPasswordAsync(string nic, string newPassword, string requesterRole, string requesterNic, bool requirePasswordChange = false)
        {
            // Method: ResetPasswordAsync - Securely updates user password hash with authorization safeguard and mandatory reset flag.
            var cleanNic = nic.Trim().ToUpperInvariant();
            var user = await _context.Users.Find(u => u.Nic == cleanNic || u.Nic == nic.Trim()).FirstOrDefaultAsync();
            if (user == null)
            {
                return false;
            }

            // Security Rule: Backoffice officers cannot reset passwords for other Backoffice officers
            if (user.Role == "Backoffice" && user.Nic != requesterNic)
            {
                throw new UnauthorizedAccessException("Security policy violation: Administrators cannot reset credentials of other Backoffice Administrators.");
            }

            if (string.IsNullOrWhiteSpace(newPassword) || newPassword.Length < 8)
            {
                throw new ArgumentException("Password must contain at least 8 characters.");
            }

            if (!newPassword.Any(char.IsLetter) || !newPassword.Any(char.IsDigit))
            {
                throw new ArgumentException("Password must contain at least one letter and one number.");
            }

            var filter = Builders<User>.Filter.Or(
                Builders<User>.Filter.Eq(u => u.Nic, cleanNic),
                Builders<User>.Filter.Eq(u => u.Nic, nic.Trim())
            );
            var update = Builders<User>.Update
                .Set(u => u.PasswordHash, BCrypt.Net.BCrypt.HashPassword(newPassword))
                .Set(u => u.MustChangePassword, requirePasswordChange)
                .Set(u => u.FailedLoginAttempts, 0)
                .Set(u => u.LockoutEnd, null)
                .Set(u => u.UpdatedAt, DateTime.UtcNow);

            var result = await _context.Users.UpdateOneAsync(filter, update);
            return result.ModifiedCount > 0;
        }

        public async Task<bool> ChangePasswordAsync(string nic, string currentPassword, string newPassword)
        {
            // Method: ChangePasswordAsync - Verifies active credentials and updates to new user-chosen password, clearing MustChangePassword flag.
            var cleanNic = nic.Trim().ToUpperInvariant();
            var user = await _context.Users.Find(u => u.Nic == cleanNic || u.Nic == nic.Trim()).FirstOrDefaultAsync();
            if (user == null) return false;

            if (!BCrypt.Net.BCrypt.Verify(currentPassword, user.PasswordHash))
            {
                return false;
            }

            if (string.IsNullOrWhiteSpace(newPassword) || newPassword.Length < 8)
            {
                throw new ArgumentException("Password must contain at least 8 characters.");
            }

            if (!newPassword.Any(char.IsLetter) || !newPassword.Any(char.IsDigit))
            {
                throw new ArgumentException("Password must contain at least one letter and one number.");
            }

            var filter = Builders<User>.Filter.Or(
                Builders<User>.Filter.Eq(u => u.Nic, cleanNic),
                Builders<User>.Filter.Eq(u => u.Nic, nic.Trim())
            );
            var update = Builders<User>.Update
                .Set(u => u.PasswordHash, BCrypt.Net.BCrypt.HashPassword(newPassword))
                .Set(u => u.MustChangePassword, false)
                .Set(u => u.FailedLoginAttempts, 0)
                .Set(u => u.LockoutEnd, null)
                .Set(u => u.UpdatedAt, DateTime.UtcNow);

            var result = await _context.Users.UpdateOneAsync(filter, update);
            return result.ModifiedCount > 0;
        }

        public async Task<bool> ForgotPasswordAsync(ForgotPasswordDto dto)
        {
            // Method: ForgotPasswordAsync - Authenticates prosumer identity via registered NIC and Email, then securely updates password hash.
            var cleanNic = dto.Nic.Trim().ToUpperInvariant();
            var cleanEmail = dto.Email.Trim().ToLowerInvariant();

            var user = await _context.Users.Find(u => 
                (u.Nic == cleanNic || u.Nic == dto.Nic.Trim()) && 
                u.Email == cleanEmail
            ).FirstOrDefaultAsync();

            if (user == null)
            {
                throw new ArgumentException("No account found matching the provided National ID (NIC) and Email address.");
            }

            if (user.Status == "Deactivated")
            {
                throw new InvalidOperationException("Account is currently deactivated. Please contact Backoffice administration for account recovery.");
            }

            if (!string.IsNullOrEmpty(dto.ConfirmPassword) && dto.NewPassword != dto.ConfirmPassword)
            {
                throw new ArgumentException("New password and confirm password do not match.");
            }

            if (string.IsNullOrWhiteSpace(dto.NewPassword) || dto.NewPassword.Length < 6)
            {
                throw new ArgumentException("Password must be at least 6 characters.");
            }

            var filter = Builders<User>.Filter.Eq(u => u.Id, user.Id);
            var update = Builders<User>.Update
                .Set(u => u.PasswordHash, BCrypt.Net.BCrypt.HashPassword(dto.NewPassword))
                .Set(u => u.MustChangePassword, false)
                .Set(u => u.FailedLoginAttempts, 0)
                .Set(u => u.LockoutEnd, null)
                .Set(u => u.UpdatedAt, DateTime.UtcNow);

            var result = await _context.Users.UpdateOneAsync(filter, update);
            return result.ModifiedCount > 0;
        }

        public async Task<PasswordResetRequestResponseDto> RequestPasswordResetOtpAsync(PasswordResetRequestDto dto)
        {
            var raw = dto.Identifier.Trim();
            var cleanUpper = raw.ToUpperInvariant();
            var cleanLower = raw.ToLowerInvariant();

            var user = await _context.Users.Find(u =>
                u.Nic == cleanUpper ||
                u.Nic == raw ||
                u.Email.ToLower() == cleanLower ||
                u.Username.ToLower() == cleanLower
            ).FirstOrDefaultAsync();

            if (user == null)
            {
                return new PasswordResetRequestResponseDto
                {
                    Message = "If this account is registered in the grid, a 6-digit verification code has been dispatched.",
                    MaskedRecipient = "registered contact",
                    ExpiresInMinutes = 15
                };
            }

            if (user.Status == "Deactivated")
            {
                throw new InvalidOperationException("This account is currently deactivated. Please contact grid backoffice support.");
            }

            // Cryptographically secure 6-digit random code
            var codeNumber = System.Security.Cryptography.RandomNumberGenerator.GetInt32(100000, 999999);
            var otpCode = codeNumber.ToString();
            var expiry = DateTime.UtcNow.AddMinutes(15);

            var filter = Builders<User>.Filter.Eq(u => u.Id, user.Id);
            var update = Builders<User>.Update
                .Set(u => u.PasswordResetOtp, otpCode)
                .Set(u => u.PasswordResetOtpExpiry, expiry)
                .Set(u => u.PasswordResetOtpAttempts, 0)
                .Set(u => u.UpdatedAt, DateTime.UtcNow);

            await _context.Users.UpdateOneAsync(filter, update);

            _logger.LogWarning("[SECURITY DISPATCH] Password Reset OTP for {Email} (NIC: {Nic}): {OtpCode} (Expires: {Expiry} UTC)", 
                user.Email, user.Nic, otpCode, expiry);

            // Real SMTP Email Dispatch
            _ = Task.Run(async () =>
            {
                try
                {
                    await _emailService.SendPasswordResetEmailAsync(user.Email, user.FullName, otpCode, 15);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning("[EMAIL DISPATCH] Background email dispatch failed: {Message}", ex.Message);
                }
            });

            string masked = MaskEmail(user.Email);

            return new PasswordResetRequestResponseDto
            {
                Message = $"A 6-digit verification code has been dispatched to {masked}. Valid for 15 minutes.",
                MaskedRecipient = masked,
                ExpiresInMinutes = 15
            };
        }

        private static string MaskEmail(string email)
        {
            if (string.IsNullOrWhiteSpace(email) || !email.Contains('@')) return "registered email";
            var parts = email.Split('@');
            var name = parts[0];
            var domain = parts[1];
            var maskedName = name.Length > 2 
                ? name.Substring(0, 1) + new string('*', Math.Min(name.Length - 2, 4)) + name.Substring(name.Length - 1) 
                : name + "***";
            return $"{maskedName}@{domain}";
        }

        public async Task<bool> VerifyPasswordResetOtpAsync(PasswordResetVerifyDto dto)
        {
            var raw = dto.Identifier.Trim();
            var cleanUpper = raw.ToUpperInvariant();
            var cleanLower = raw.ToLowerInvariant();

            var user = await _context.Users.Find(u =>
                u.Nic == cleanUpper ||
                u.Nic == raw ||
                u.Email.ToLower() == cleanLower ||
                u.Username.ToLower() == cleanLower
            ).FirstOrDefaultAsync();

            if (user == null)
            {
                throw new ArgumentException("No matching account found for the provided identifier.");
            }

            if (user.Status == "Deactivated")
            {
                throw new InvalidOperationException("Account is currently deactivated.");
            }

            if (string.IsNullOrWhiteSpace(user.PasswordResetOtp) || user.PasswordResetOtpExpiry == null)
            {
                throw new InvalidOperationException("No active password reset request found. Please request a new verification code.");
            }

            if (DateTime.UtcNow > user.PasswordResetOtpExpiry.Value)
            {
                await _context.Users.UpdateOneAsync(
                    Builders<User>.Filter.Eq(u => u.Id, user.Id),
                    Builders<User>.Update.Unset(u => u.PasswordResetOtp).Unset(u => u.PasswordResetOtpExpiry)
                );
                throw new InvalidOperationException("Verification code has expired. Please request a new code.");
            }

            if (user.PasswordResetOtpAttempts >= 5)
            {
                await _context.Users.UpdateOneAsync(
                    Builders<User>.Filter.Eq(u => u.Id, user.Id),
                    Builders<User>.Update.Unset(u => u.PasswordResetOtp).Unset(u => u.PasswordResetOtpExpiry)
                );
                throw new InvalidOperationException("Too many incorrect attempts. For security reasons, this code has been revoked. Please request a new code.");
            }

            if (user.PasswordResetOtp.Trim() != dto.OtpCode.Trim())
            {
                var newAttempts = user.PasswordResetOtpAttempts + 1;
                await _context.Users.UpdateOneAsync(
                    Builders<User>.Filter.Eq(u => u.Id, user.Id),
                    Builders<User>.Update.Set(u => u.PasswordResetOtpAttempts, newAttempts)
                );
                var remaining = Math.Max(0, 5 - newAttempts);
                throw new ArgumentException($"Invalid verification code. {remaining} attempt(s) remaining.");
            }

            if (!string.IsNullOrEmpty(dto.ConfirmPassword) && dto.NewPassword != dto.ConfirmPassword)
            {
                throw new ArgumentException("New password and confirm password do not match.");
            }

            if (string.IsNullOrWhiteSpace(dto.NewPassword) || dto.NewPassword.Length < 6)
            {
                throw new ArgumentException("Password must be at least 6 characters.");
            }

            var filter = Builders<User>.Filter.Eq(u => u.Id, user.Id);
            var update = Builders<User>.Update
                .Set(u => u.PasswordHash, BCrypt.Net.BCrypt.HashPassword(dto.NewPassword))
                .Set(u => u.MustChangePassword, false)
                .Set(u => u.FailedLoginAttempts, 0)
                .Set(u => u.LockoutEnd, null)
                .Unset(u => u.PasswordResetOtp)
                .Unset(u => u.PasswordResetOtpExpiry)
                .Set(u => u.PasswordResetOtpAttempts, 0)
                .Set(u => u.UpdatedAt, DateTime.UtcNow);

            var updateResult = await _context.Users.UpdateOneAsync(filter, update);
            return updateResult.ModifiedCount > 0;
        }

        public async Task<bool> DeleteUserAsync(string nic)
        {
            // Method: DeleteUserAsync - Removes staff or prosumer account with Backoffice administrator safeguards and active booking verification.
            var cleanNic = nic.Trim().ToUpperInvariant();
            var user = await GetUserByNicAsync(cleanNic);
            if (user == null) return false;

            if (user.Role == "Backoffice")
            {
                throw new InvalidOperationException("Security policy violation: Backoffice administrator accounts cannot be deleted.");
            }

            // Check if user has active reservations
            var activeCount = await _context.Reservations.CountDocumentsAsync(r =>
                (r.ProsumerNic == cleanNic || r.ProsumerNic == nic.Trim()) &&
                (r.Status == "Pending" || r.Status == "Approved") &&
                r.ScheduledDateTime >= DateTime.UtcNow
            );

            if (activeCount > 0)
            {
                throw new InvalidOperationException($"Cannot delete user '{cleanNic}'. User has {activeCount} active or pending energy reservations.");
            }

            var filter = Builders<User>.Filter.Or(
                Builders<User>.Filter.Eq(u => u.Nic, cleanNic),
                Builders<User>.Filter.Eq(u => u.Nic, nic.Trim())
            );
            var result = await _context.Users.DeleteOneAsync(filter);
            return result.DeletedCount > 0;
        }
    }
}
