// ============================================================================
// File: SolarStation.cs
// Project: Solvance — Smart Solar Microgrid Trading System
// Author: G.L.S. Chanlaka (IT23151260)
// Course: SE4040 - Enterprise Application Development (SLIIT)
// Description: Model representing a microgrid hub stored in "SolarStationInfo" collection.
// References & Citations:
//   - MongoDB C# Driver POCO Serialization & Embedded Document Mapping:
//     https://www.mongodb.com/docs/drivers/csharp/current/fundamentals/serialization/poco/
// ============================================================================

using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace SolarMicrogridApi.Models
{
    /// <summary>
    /// Nested class representing operational hours and open days for solar hubs.
    /// </summary>
    public class OperationalSchedule
    {
        [BsonElement("openTime")]
        public string OpenTime { get; set; } = "06:00";

        [BsonElement("closeTime")]
        public string CloseTime { get; set; } = "20:00";

        [BsonElement("daysOpen")]
        public List<string> DaysOpen { get; set; } = new List<string> { "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday" };

        public OperationalSchedule()
        {
            // Method: OperationalSchedule Constructor - Sets standard 7-day operational schedule.
        }
    }

    /// <summary>
    /// Represents solar microgrid hub records in the "SolarStationInfo" MongoDB collection.
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

        /// <summary>
        /// Capacity specs in kW/h.
        /// </summary>
        [BsonElement("capacityKwh")]
        public double CapacityKwh { get; set; }

        /// <summary>
        /// Battery storage slot count.
        /// </summary>
        [BsonElement("totalBatterySlots")]
        public int TotalBatterySlots { get; set; }

        [BsonElement("availableBatterySlots")]
        public int AvailableBatterySlots { get; set; }

        [BsonElement("gridConnection")]
        public string GridConnection { get; set; } = "Three-Phase 400V AC";

        [BsonElement("storageType")]
        public string StorageType { get; set; } = "LiFePO4 BESS";

        [BsonElement("maxDischargeRateKw")]
        public double MaxDischargeRateKw { get; set; } = 150.0;

        [BsonElement("operationalSchedule")]
        public OperationalSchedule Schedule { get; set; } = new OperationalSchedule();

        [BsonElement("isActive")]
        public bool IsActive { get; set; } = true;

        [BsonElement("createdAt")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public SolarStation()
        {
            // Method: SolarStation Constructor - Initializes timestamp and initial available battery slots.
            CreatedAt = DateTime.UtcNow;
            IsActive = true;
        }
    }
}
