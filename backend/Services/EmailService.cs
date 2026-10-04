// ============================================================================
// File: EmailService.cs
// Project: Solvance — Smart Solar Microgrid Trading System
// Author: M.L. Booso (IT23452916)
// Course: SE4040 - Enterprise Application Development (SLIIT)
// Description: Automated SMTP email service for OTP verification codes and security dispatches.
// References & Citations:
//   - System.Net.Mail SmtpClient & MailMessage:
//     https://learn.microsoft.com/en-us/dotnet/api/system.net.mail.smtpclient
// ============================================================================

using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Options;
using SolarMicrogridApi.Models.Config;

namespace SolarMicrogridApi.Services
{
    public class EmailService : IEmailService
    {
        private readonly EmailSettings _settings;
        private readonly ILogger<EmailService> _logger;

        public EmailService(IOptions<EmailSettings> options, ILogger<EmailService> logger)
        {
            _settings = options?.Value ?? new EmailSettings();
            _logger = logger;
        }

        public async Task<bool> SendPasswordResetEmailAsync(string recipientEmail, string recipientName, string otpCode, int expiryMinutes = 15)
        {
            if (string.IsNullOrWhiteSpace(recipientEmail))
            {
                return false;
            }

            var subject = $"Solvance Security: {otpCode} is your Password Reset Code";
            var displayName = !string.IsNullOrWhiteSpace(recipientName) ? recipientName : "Solar Prosumer";

            var bodyHtml = $@"
<!DOCTYPE html>
<html>
<head>
    <meta charset='utf-8'>
    <title>Solvance Password Reset</title>
</head>
<body style='margin:0; padding:0; background-color:#0B1120; font-family:-apple-system, BlinkMacSystemFont, ""Segoe UI"", Roboto, Helvetica, Arial, sans-serif; color:#F8FAFC;'>
    <table width='100%' border='0' cellspacing='0' cellpadding='0' style='background-color:#0B1120; padding:40px 20px;'>
        <tr>
            <td align='center'>
                <table width='100%' max-width='560' style='max-width:560px; background-color:#111827; border-radius:18px; border:1px solid #1E293B; overflow:hidden; box-shadow:0 20px 25px -5px rgba(0,0,0,0.5);'>
                    <!-- Brand Header -->
                    <tr>
                        <td style='background:linear-gradient(135deg, #064E3B 0%, #065F46 100%); padding:28px 32px; text-align:left;'>
                            <div style='display:inline-block; font-size:22px; font-weight:800; color:#FFFFFF; letter-spacing:1px;'>SOLVANCE</div>
                            <div style='color:#A7F3D0; font-size:12px; margin-top:4px;'>Smart Solar Microgrid Energy Trading Platform</div>
                        </td>
                    </tr>
                    <!-- Body Content -->
                    <tr>
                        <td style='padding:32px;'>
                            <h2 style='margin:0 0 12px 0; font-size:20px; font-weight:700; color:#F8FAFC;'>Password Recovery Request</h2>
                            <p style='margin:0 0 20px 0; font-size:14px; line-height:22px; color:#94A3B8;'>
                                Hello <strong style='color:#F8FAFC;'>{WebUtility.HtmlEncode(displayName)}</strong>,<br>
                                We received a request to reset your Solvance account password. Use the verification code below to complete your account recovery:
                            </p>

                            <!-- OTP Box -->
                            <div style='background-color:#0F172A; border:1.5px solid #10B981; border-radius:12px; padding:20px; text-align:center; margin:24px 0;'>
                                <div style='font-size:11px; text-transform:uppercase; letter-spacing:2px; color:#10B981; font-weight:700; margin-bottom:8px;'>6-Digit One-Time Code</div>
                                <div style='font-size:36px; font-weight:800; letter-spacing:12px; color:#FFFFFF; font-family:monospace; margin-left:12px;'>{otpCode}</div>
                                <div style='font-size:12px; color:#64748B; margin-top:8px;'>Expires in {expiryMinutes} minutes</div>
                            </div>

                            <p style='font-size:13px; line-height:20px; color:#94A3B8; margin:20px 0 0 0;'>
                                ⚠️ <strong style='color:#F59E0B;'>Security Notice:</strong> Never share this code with anyone. Solvance grid administrators and technical operators will never ask for your verification code.
                            </p>
                            <p style='font-size:12px; line-height:18px; color:#64748B; margin:16px 0 0 0;'>
                                If you did not request this password reset, your credentials are still secure and you can safely ignore this email.
                            </p>
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td style='background-color:#0B0F19; padding:20px 32px; border-top:1px solid #1E293B; text-align:center;'>
                            <div style='font-size:11px; color:#64748B;'>
                                © {DateTime.UtcNow.Year} Solvance Clean Energy Microgrid. All rights reserved.<br>
                                Automated Notification Service • Do not reply directly to this email.
                            </div>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>";

            // If DropFolder is configured, write email file for offline inspection
            if (!string.IsNullOrWhiteSpace(_settings.DropFolder))
            {
                try
                {
                    Directory.CreateDirectory(_settings.DropFolder);
                    var filePath = Path.Combine(_settings.DropFolder, $"ResetOtp_{DateTime.UtcNow:yyyyMMdd_HHmmss}_{otpCode}.html");
                    await File.WriteAllTextAsync(filePath, bodyHtml);
                    _logger.LogInformation("[EMAIL DISPATCH] Stored offline reset email to {FilePath}", filePath);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning("[EMAIL DISPATCH] Could not write to drop folder: {Message}", ex.Message);
                }
            }

            // Real SMTP Dispatch
            try
            {
                using var message = new MailMessage();
                message.From = new MailAddress(_settings.SenderEmail, _settings.SenderName);
                message.To.Add(new MailAddress(recipientEmail, displayName));
                message.Subject = subject;
                message.Body = bodyHtml;
                message.IsBodyHtml = true;

                using var client = new SmtpClient(_settings.SmtpHost, _settings.SmtpPort);
                client.EnableSsl = _settings.EnableSsl;
                client.DeliveryMethod = SmtpDeliveryMethod.Network;
                client.Timeout = 10000;

                if (!string.IsNullOrWhiteSpace(_settings.Username) && !string.IsNullOrWhiteSpace(_settings.Password))
                {
                    client.UseDefaultCredentials = false;
                    client.Credentials = new NetworkCredential(_settings.Username, _settings.Password);
                }

                await client.SendMailAsync(message);
                _logger.LogInformation("[EMAIL DISPATCH] Successfully sent password reset email via SMTP to {Recipient}", recipientEmail);
                return true;
            }
            catch (Exception ex)
            {
                // Graceful fallback: log to console with exact OTP so development / offline testing is never blocked
                _logger.LogWarning("[EMAIL DISPATCH NOTICE] SMTP dispatch to {Recipient} failed ({Error}). Fallback: Security OTP code is {OtpCode}", 
                    recipientEmail, ex.Message, otpCode);
                return false;
            }
        }
    }
}
