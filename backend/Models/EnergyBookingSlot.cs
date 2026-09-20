// ============================================================================
// File: EnergyBookingSlot.cs
// Project: Smart Solar Microgrid Trading System
// Author: Enterprise Application Development Team
// Description: Model representing time window slots stored in "EnergyBookingSlots" collection.
// ============================================================================

using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace SolarMicrogridApi.Models
{
    /// <summary>
    /// Represents granular energy trading slots in the "EnergyBookingSlots" MongoDB collection.
    /// Manages charging/drop-off capacity windows per microgrid node.
    /// </summary>
    public class EnergyBookingSlot
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string? Id { get; set; }

        [BsonElement("stationId")]
        public string StationId { get; set; } = string.Empty;

        [BsonElement("slotName")]
        public string SlotName { get; set; } = string.Empty;

        [BsonElement("startTime")]
        public string StartTime { get; set; } = string.Empty; // e.g. "08:00"

        [BsonElement("endTime")]
        public string EndTime { get; set; } = string.Empty; // e.g. "10:00"

        [BsonElement("maxCapacityKwh")]
        public double MaxCapacityKwh { get; set; }

        [BsonElement("isAvailable")]
        public bool IsAvailable { get; set; } = true;

        [BsonElement("createdAt")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public EnergyBookingSlot()
        {
            // Method: EnergyBookingSlot Constructor - Initializes default UTC timestamp.
            CreatedAt = DateTime.UtcNow;
            IsAvailable = true;
        }
    }
}
