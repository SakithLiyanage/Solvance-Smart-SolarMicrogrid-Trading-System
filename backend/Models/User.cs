// ============================================================================
// File: User.cs
// Project: Smart Solar Microgrid Trading System
// Author: Enterprise Application Development Team
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
        /// National Identity Card number. Acts as natural key for prosumers.
        /// </summary>
        [BsonElement("nic")]
        public string Nic { get; set; } = string.Empty;

        [BsonElement("fullName")]
        public string FullName { get; set; } = string.Empty;

        [BsonElement("email")]
        public string Email { get; set; } = string.Empty;

        [BsonElement("phone")]
        public string Phone { get; set; } = string.Empty;

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
            CreatedAt = DateTime.UtcNow;
            UpdatedAt = DateTime.UtcNow;
        }
    }
}
