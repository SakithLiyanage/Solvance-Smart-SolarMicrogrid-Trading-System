// ============================================================================
// File: SolarStation.cs
// Project: Smart Solar Microgrid Trading System
// Author: Enterprise Application Development Team
// Description: Model representing a microgrid hub stored in "SolarStationInfo" collection.
// ============================================================================

using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace SolarMicrogridApi.Models
{
    /// <summary>
    /// Represents solar microgrid hub nodes in the "SolarStationInfo" MongoDB collection.
    /// Tracks location, capacity specs (kW/h), and battery slot availability.
    /// </summary>
    public class SolarStation
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string? Id { get; set; }

        [BsonElement("stationCode")]
        public string StationCode { get; set; } = string.Empty;

        [BsonElement("name")]
        public string Name { get; set; } = string.Empty;

        [BsonElement("latitude")]
        public double Latitude { get; set; }

        [BsonElement("longitude")]
        public double Longitude { get; set; }

        [BsonElement("address")]
        public string Address { get; set; } = string.Empty;

        [BsonElement("capacityKwh")]
        public double CapacityKwh { get; set; }

        [BsonElement("totalBatterySlots")]
        public int TotalBatterySlots { get; set; }

        [BsonElement("availableBatterySlots")]
        public int AvailableBatterySlots { get; set; }

        [BsonElement("schedule")]
        public OperationalSchedule Schedule { get; set; } = new OperationalSchedule();

        [BsonElement("isActive")]
        public bool IsActive { get; set; } = true;

        [BsonElement("createdAt")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [BsonElement("updatedAt")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        public SolarStation()
        {
            // Method: SolarStation Constructor - Initializes default UTC timestamps and state.
            CreatedAt = DateTime.UtcNow;
            UpdatedAt = DateTime.UtcNow;
            IsActive = true;
        }
    }

    /// <summary>
    /// Operating schedule configuration for a solar microgrid station.
    /// </summary>
    public class OperationalSchedule
    {
        [BsonElement("openTime")]
        public string OpenTime { get; set; } = "06:00";

        [BsonElement("closeTime")]
        public string CloseTime { get; set; } = "18:00";

        [BsonElement("operatingDays")]
        public List<string> OperatingDays { get; set; } = new List<string>
        {
            "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"
        };
    }
}
