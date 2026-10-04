// ============================================================================
// File: User.cs
// Project: Solvance — Smart Solar Microgrid Trading System
// Author: M.L. Booso (IT23452916)
// Course: SE4040 - Enterprise Application Development (SLIIT)
// Description: Model representing a system user stored in "User's detail" collection.
// ============================================================================

using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace SolarMicrogridApi.Models
{
    /// <summary>
    /// Represents user accounts in the "User's detail" MongoDB collection.
    /// Supports roles: Backoffice, GridOperator, Prosumer.
    /// Supports statuses: Pending, Active, Deactivated.
    /// </summary>
    public class User
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string? Id { get; set; }

        /// <summary>
        /// National Identity Card number for Prosumers or primary natural key.
        /// </summary>
        [BsonElement("nic")]
        public string Nic { get; set; } = string.Empty;

        /// <summary>
        /// Dedicated Staff ID for Backoffice and Grid Operator employees.
        /// </summary>
        [BsonElement("staffId")]
        public string? StaffId { get; set; }

        [BsonElement("username")]
        public string Username { get; set; } = string.Empty;

        [BsonElement("fullName")]
        public string FullName { get; set; } = string.Empty;

        [BsonElement("email")]
        public string Email { get; set; } = string.Empty;

        [BsonElement("phone")]
        public string Phone { get; set; } = string.Empty;

        [BsonElement("address")]
        public string Address { get; set; } = string.Empty;

        [BsonElement("passwordHash")]
        public string PasswordHash { get; set; } = string.Empty;

        /// <summary>
        /// Roles: "Backoffice", "GridOperator", "Prosumer"
        /// </summary>
        [BsonElement("role")]
        public string Role { get; set; } = "Prosumer";

        /// <summary>
        /// Statuses: "Pending", "Active", "Deactivated"
        /// </summary>
        [BsonElement("status")]
        public string Status { get; set; } = "Pending";

        /// <summary>
        /// Solar array specs for prosumers (capacity in kW).
        /// </summary>
        [BsonElement("solarCapacityKw")]
        public double SolarCapacityKw { get; set; } = 0.0;

        /// <summary>
        /// Solar inverter hardware serial number.
        /// </summary>
        [BsonElement("inverterSerial")]
        public string InverterSerial { get; set; } = string.Empty;

        [BsonElement("nicDocumentBase64")]
        public string? NicDocumentBase64 { get; set; }

        [BsonElement("nicBackDocumentBase64")]
        public string? NicBackDocumentBase64 { get; set; }

        [BsonElement("utilityBillBase64")]
        public string? UtilityBillBase64 { get; set; }

        [BsonElement("kycTrustScore")]
        public int KycTrustScore { get; set; } = 95;

        [BsonElement("kycRiskLevel")]
        public string KycRiskLevel { get; set; } = "Low"; // "Low", "Medium", "High"

        [BsonElement("kycNotes")]
        public string? KycNotes { get; set; }

        [BsonElement("registeredAt")]
        public DateTime RegisteredAt { get; set; } = DateTime.UtcNow;

        [BsonElement("activatedAt")]
        public DateTime? ActivatedAt { get; set; }

        [BsonElement("approvedBy")]
        public string? ApprovedBy { get; set; }

        [BsonElement("failedLoginAttempts")]
        public int FailedLoginAttempts { get; set; } = 0;

        [BsonElement("lockoutEnd")]
        public DateTime? LockoutEnd { get; set; }

        /// <summary>
        /// Flag set by administrator forcing user to update credentials upon subsequent login.
        /// </summary>
        [BsonElement("mustChangePassword")]
        public bool MustChangePassword { get; set; } = false;

        [BsonElement("createdAt")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [BsonElement("updatedAt")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        /// <summary>
        /// Helper constructor method.
        /// </summary>
        public User()
        {
            // Method: User Constructor - Initializes default UTC timestamps for user record.
            RegisteredAt = DateTime.UtcNow;
            CreatedAt = DateTime.UtcNow;
            UpdatedAt = DateTime.UtcNow;
        }
    }
}
