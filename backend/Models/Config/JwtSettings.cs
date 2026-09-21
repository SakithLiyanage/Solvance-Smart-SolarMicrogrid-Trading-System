// ============================================================================
// File: JwtSettings.cs
// Project: Solvance — Smart Solar Microgrid Trading System
// Author: M.L. Booso (IT23452916)
// Course: SE4040 - Enterprise Application Development (SLIIT)
// Description: Strongly-typed configuration POCO for JWT authentication parameters.
// References & Citations:
//   - Microsoft ASP.NET Core Strongly Typed Configuration (IOptions<T>):
//     https://learn.microsoft.com/en-us/aspnet/core/fundamentals/configuration/options
// ============================================================================

namespace SolarMicrogridApi.Models.Config
{
    /// <summary>
    /// Strongly-typed settings model representing the "JwtSettings" section of appsettings.json.
    /// </summary>
    public class JwtSettings
    {
        public string Secret { get; set; } = string.Empty;
        public string SecretKey { get; set; } = string.Empty;
        public string Issuer { get; set; } = string.Empty;
        public string Audience { get; set; } = string.Empty;
        public int AccessTokenExpiryMinutes { get; set; } = 120;
        public int RefreshTokenExpiryDays { get; set; } = 7;
        public int ExpiryDays { get; set; } = 7;

        /// <summary>
        /// Resolves effective secret key prioritizing modern "Secret" over fallback "SecretKey".
        /// </summary>
        public string EffectiveSecret => !string.IsNullOrEmpty(Secret) ? Secret : SecretKey;
    }
}
