// ============================================================================
// File: SecuritySettings.cs
// Project: Solvance — Smart Solar Microgrid Trading System
// Author: M.L. Booso (IT23452916)
// Course: SE4040 - Enterprise Application Development (SLIIT)
// Description: Strongly-typed configuration POCO for BCrypt security, lockout, and KYC rules.
// References & Citations:
//   - Microsoft ASP.NET Core Options Pattern:
//     https://learn.microsoft.com/en-us/aspnet/core/fundamentals/configuration/options
// ============================================================================

namespace SolarMicrogridApi.Models.Config
{
    /// <summary>
    /// Strongly-typed security configuration representing the "SecuritySettings" section.
    /// </summary>
    public class SecuritySettings
    {
        public int BcryptWorkFactor { get; set; } = 11;
        public int MaxFailedLoginAttempts { get; set; } = 5;
        public int LockoutDurationMinutes { get; set; } = 15;
        public bool RequireKycApproval { get; set; } = true;
        public string DefaultProsumerStatus { get; set; } = "Pending";
        public string SetupMasterKey { get; set; } = "SolvanceMasterBootstrap2026!#UltraSecure";
    }
}
