// ============================================================================
// File: IEmailService.cs
// Project: Solvance — Smart Solar Microgrid Trading System
// Author: M.L. Booso (IT23452916)
// Course: SE4040 - Enterprise Application Development (SLIIT)
// Description: Contract for automated SMTP notification and OTP security dispatch.
// ============================================================================

namespace SolarMicrogridApi.Services
{
    public interface IEmailService
    {
        Task<bool> SendPasswordResetEmailAsync(string recipientEmail, string recipientName, string otpCode, int expiryMinutes = 15);
    }
}
