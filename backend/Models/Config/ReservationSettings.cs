// ============================================================================
// File: ReservationSettings.cs
// Project: Solvance — Smart Solar Microgrid Trading System
// Author: L.T. Jayawardhana (IT23156760)
// Course: SE4040 - Enterprise Application Development (SLIIT)
// Description: Strongly-typed configuration POCO for 7-day window, 12-hour cancellation notice, and QR salt.
// References & Citations:
//   - Microsoft ASP.NET Core Options Pattern:
//     https://learn.microsoft.com/en-us/aspnet/core/fundamentals/configuration/options
// ============================================================================

namespace SolarMicrogridApi.Models.Config
{
    /// <summary>
    /// Strongly-typed reservation policy settings representing the "ReservationSettings" section.
    /// </summary>
    public class ReservationSettings
    {
        public int MaxAdvanceBookingDays { get; set; } = 7;
        public int CancellationNoticeHours { get; set; } = 12;
        public int ModificationNoticeHours { get; set; } = 12;
        public int GracePeriodMinutes { get; set; } = 10;
        public string QrSecretSalt { get; set; } = "EnterpriseMicrogridSecretSalt2026";
        public string DefaultBookingStatus { get; set; } = "Pending";
    }
}
