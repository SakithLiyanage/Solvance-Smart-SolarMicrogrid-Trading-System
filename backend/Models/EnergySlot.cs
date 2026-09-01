// ============================================================================
// File: EnergySlot.cs
// Project: Smart Solar Microgrid Trading System
// Author: Enterprise Application Development Team
// Description: Model representing time/energy windows in "EnergyBookingSlots" collection.
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
