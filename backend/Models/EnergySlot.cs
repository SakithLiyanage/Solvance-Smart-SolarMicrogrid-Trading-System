// ============================================================================
// File: EnergySlot.cs
// Project: Solvance — Smart Solar Microgrid Trading System
// Authors:
//   - G.L.S. Chanlaka (IT23151260) - Slot entity design & capacity attributes
//   - L.T. Jayawardhana (IT23156760) - Booking window & station relationship
// Course: SE4040 - Enterprise Application Development (SLIIT)
// Description: Model representing time/energy windows in "EnergyBookingSlots" collection.
// References & Citations:
//   - MongoDB C# Driver POCO Serialization & Custom Attribute Mapping:
//     https://www.mongodb.com/docs/drivers/csharp/current/fundamentals/serialization/poco/
// ============================================================================

using System;
using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using SolarMicrogridApi.Data;

namespace SolarMicrogridApi.Models
{
    /// <summary>
    /// Represents energy trading slots in the "EnergyBookingSlots" MongoDB collection.
    /// </summary>
    public class EnergySlot
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string? Id { get; set; }

        [BsonElement("stationId")]
        [BsonSerializer(typeof(StringOrObjectIdSerializer))]
        public string StationId { get; set; } = string.Empty;

        [BsonElement("date")]
        public string Date { get; set; } = string.Empty; // Format: YYYY-MM-DD

        [BsonElement("startTime")]
        public string StartTime { get; set; } = string.Empty; // Format: HH:mm

        [BsonElement("endTime")]
        public string EndTime { get; set; } = string.Empty; // Format: HH:mm

        [BsonElement("slotCapacityKwh")]
        public double SlotCapacityKwh { get; set; }

        [BsonElement("allocatedKwh")]
        public double AllocatedKwh { get; set; }

        [BsonElement("availableSlots")]
        public int AvailableSlots { get; set; }

        /// <summary>
        /// Status: "Open", "Full", "Maintenance"
        /// </summary>
        [BsonElement("status")]
        public string Status { get; set; } = "Open";

        [BsonElement("createdAt")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public EnergySlot()
        {
            // Method: EnergySlot Constructor - Initializes slot creation date and default open status.
            CreatedAt = DateTime.UtcNow;
            Status = "Open";
        }
    }
}
