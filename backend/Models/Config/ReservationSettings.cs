// ============================================================================
// File: ReservationSettings.cs
// Project: Solvance — Smart Solar Microgrid Trading System
// Author: L.T. Jayawardhana (IT23156760)
// Course: SE4040 - Enterprise Application Development (SLIIT)
// Description: Strongly-typed configuration POCO for 7-day window, 12-hour cancellation notice, booking limits, and QR salt.
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

        /// <summary>
        /// Most upcoming (Pending or Approved) reservations one prosumer may hold at once, so a single
        /// account can't block hub slots that other prosumers need.
        /// </summary>
        public int MaxActiveReservationsPerProsumer { get; set; } = 3;

        /// <summary>
        /// Average full-output sun hours per day in Sri Lanka. A drop-off may not exceed the prosumer's
        /// solar capacity (kW) multiplied by this value, i.e. roughly one day of generation.
        /// </summary>
        public double PeakSunHoursPerDay { get; set; } = 5.0;
    }
}
