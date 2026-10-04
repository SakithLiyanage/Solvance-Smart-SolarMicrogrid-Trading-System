// ============================================================================
// File: EmailSettings.cs
// Project: Solvance — Smart Solar Microgrid Trading System
// Author: M.L. Booso (IT23452916)
// Course: SE4040 - Enterprise Application Development (SLIIT)
// Description: Strongly-typed configuration options for SMTP email dispatch.
// ============================================================================

namespace SolarMicrogridApi.Models.Config
{
    public class EmailSettings
    {
        public string SmtpHost { get; set; } = "smtp.gmail.com";
        public int SmtpPort { get; set; } = 587;
        public bool EnableSsl { get; set; } = true;
        public string SenderEmail { get; set; } = "no-reply@solvance.lk";
        public string SenderName { get; set; } = "Solvance Smart Solar Microgrid";
        public string Username { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
        public string? DropFolder { get; set; }
    }
}
