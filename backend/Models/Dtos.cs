// ============================================================================
// File: Dtos.cs
// Project: Solvance — Smart Solar Microgrid Trading System
// Author: Enterprise Application Development Team
// Description: Data Transfer Objects (DTOs) for API request validation and response mapping.
// ============================================================================

using System.ComponentModel.DataAnnotations;

namespace SolarMicrogridApi.Models
{
    // --- AUTHENTICATION DTOS ---

    public class LoginRequestDto
    {
        [Required]
        public string UsernameOrNic { get; set; } = string.Empty;

        [Required]
        public string Password { get; set; } = string.Empty;
    }

    public class AuthResponseDto
    {
        public string Token { get; set; } = string.Empty;
        public string Nic { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Phone { get; set; } = string.Empty;
        public string Address { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public double SolarCapacityKw { get; set; } = 0.0;
        public string InverterSerial { get; set; } = string.Empty;
    }

    public class AuthErrorResponseDto
    {
        public string Code { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
    }

    public class ProsumerRegisterDto
    {
        [Required]
        [RegularExpression(@"^([0-9]{9}[vVxX]|[0-9]{12})$", ErrorMessage = "Invalid National Identity Card (NIC) format. Must be 9 digits with V/X or 12 numeric digits.")]
        public string Nic { get; set; } = string.Empty;

        [Required]
        public string FullName { get; set; } = string.Empty;

        [Required]
        [EmailAddress]
        public string Email { get; set; } = string.Empty;

        [Required]
        public string Phone { get; set; } = string.Empty;

        public string Address { get; set; } = string.Empty;

        [Range(0, 100000)]
        public double SolarCapacityKw { get; set; } = 0.0;

        public string InverterSerial { get; set; } = string.Empty;

        public string? NicDocumentBase64 { get; set; }

        public string? NicBackDocumentBase64 { get; set; }

        public string? UtilityBillBase64 { get; set; }

        [Required]
        [MinLength(6)]
        public string Password { get; set; } = string.Empty;
    }

    public class CreateStaffUserDto
    {
        [Required]
        [RegularExpression(@"^([0-9]{9}[vVxX]|[0-9]{12}|(ADMIN|OPERATOR)[0-9]{3,})$", ErrorMessage = "Invalid Staff Identifier or NIC format.")]
        public string Nic { get; set; } = string.Empty;

        [Required]
        public string FullName { get; set; } = string.Empty;

        [Required]
        [EmailAddress]
        public string Email { get; set; } = string.Empty;

        [Required]
        public string Phone { get; set; } = string.Empty;

        public string Address { get; set; } = string.Empty;

        [Required]
        public string Password { get; set; } = string.Empty;

        [Required]
        public string Role { get; set; } = "GridOperator"; // "Backoffice" or "GridOperator"
    }

    public class UpdateProfileDto
    {
        public string FullName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Phone { get; set; } = string.Empty;
        public string Address { get; set; } = string.Empty;
        public double SolarCapacityKw { get; set; }
        public string InverterSerial { get; set; } = string.Empty;
        public string? NicDocumentBase64 { get; set; }
        public string? NicBackDocumentBase64 { get; set; }
        public string? UtilityBillBase64 { get; set; }
    }

    // --- SOLAR STATION DTOS ---

    public class SolarStationDto
    {
        [Required]
        public string StationCode { get; set; } = string.Empty;

        [Required]
        public string Name { get; set; } = string.Empty;

        [Required]
        public double Latitude { get; set; }

        [Required]
        public double Longitude { get; set; }

        [Required]
        public string Address { get; set; } = string.Empty;

        [Range(1, 100000)]
        public double CapacityKwh { get; set; }

        [Range(1, 1000)]
        public int TotalBatterySlots { get; set; }

        public int AvailableBatterySlots { get; set; }

        public OperationalSchedule Schedule { get; set; } = new OperationalSchedule();

        public bool IsActive { get; set; } = true;
    }

    // --- RESERVATION DTOS ---

    public class CreateReservationDto
    {
        [Required]
        public string ProsumerNic { get; set; } = string.Empty;

        [Required]
        public string StationId { get; set; } = string.Empty;

        public string SlotId { get; set; } = string.Empty;

        [Required]
        public DateTime ScheduledDateTime { get; set; }

        [Range(0.1, 10000)]
        public double EnergyAmountKwh { get; set; }

        public string TradeType { get; set; } = "DropOff"; // "DropOff" or "Charging"
    }

    public class UpdateReservationDto
    {
        [Required]
        public DateTime ScheduledDateTime { get; set; }

        [Range(0.1, 10000)]
        public double EnergyAmountKwh { get; set; }

        public string TradeType { get; set; } = "DropOff";
    }

    public class CancelReservationDto
    {
        public string Reason { get; set; } = "Cancelled by user";
    }

    public class VerifyQrRequestDto
    {
        [Required]
        public string QrCodeToken { get; set; } = string.Empty;

        public string? StationId { get; set; }
    }

    public class DashboardStatsDto
    {
        public int ActiveBookingsCount { get; set; }
        public int PendingBookingsCount { get; set; }
        public int ApprovedFutureBookingsCount { get; set; }
        public int TotalCompletedBookingsCount { get; set; }
        public int TotalStationsCount { get; set; }
        public int ActiveProsumersCount { get; set; }
        public int PendingProsumersCount { get; set; }
    }

    public class StationTelemetryDto
    {
        public string StationId { get; set; } = string.Empty;
        public string StationCode { get; set; } = string.Empty;
        public string StationName { get; set; } = string.Empty;
        public bool IsActive { get; set; }
        public int TotalBatterySlots { get; set; }
        public int AvailableBatterySlots { get; set; }
        public int OccupiedBatterySlots { get; set; }
        public double BatteryOccupancyPercent { get; set; }
        public int PendingReservations { get; set; }
        public int ApprovedReservations { get; set; }
        public int CompletedReservations { get; set; }
        public DateTime CapturedAt { get; set; }
    }
}