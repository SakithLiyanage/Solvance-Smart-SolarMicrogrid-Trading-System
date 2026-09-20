// ============================================================================
// File: EnergyReservation.cs
// Project: Smart Solar Microgrid Trading System
// Author: Enterprise Application Development Team
// Description: Model representing power trading bookings stored in "Energy Reservation" collection.
// ============================================================================

using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace SolarMicrogridApi.Models
{
    /// <summary>
    /// Represents energy slot transactions in the "Energy Reservation" MongoDB collection.
    /// Tracks prosumer trading requests, QR dispatch tokens, and execution lifecycle.
    /// </summary>
    public class EnergyReservation
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string? Id { get; set; }

        [BsonElement("reservationNumber")]
        public string ReservationNumber { get; set; } = string.Empty;

        [BsonElement("prosumerNic")]
        public string ProsumerNic { get; set; } = string.Empty;

        [BsonElement("stationId")]
        public string StationId { get; set; } = string.Empty;

        [BsonElement("stationName")]
        public string StationName { get; set; } = string.Empty;

        [BsonElement("slotId")]
        public string SlotId { get; set; } = string.Empty;

        [BsonElement("scheduledDateTime")]
        public DateTime ScheduledDateTime { get; set; }

        [BsonElement("energyAmountKwh")]
        public double EnergyAmountKwh { get; set; }

        /// <summary>
        /// Trade Type: "DropOff" (Prosumer feeds solar to grid) or "Charging" (Prosumer draws power)
        /// </summary>
        [BsonElement("tradeType")]
        public string TradeType { get; set; } = "DropOff";

        /// <summary>
        /// Lifecycle Status: "Pending", "Approved", "Completed", "Cancelled"
        /// </summary>
        [BsonElement("status")]
        public string Status { get; set; } = "Approved";

        [BsonElement("qrCodeToken")]
        public string QrCodeToken { get; set; } = string.Empty;

        [BsonElement("cancellationReason")]
        public string? CancellationReason { get; set; }

        [BsonElement("completedByOperatorNic")]
        public string? CompletedByOperatorNic { get; set; }

        [BsonElement("completedAt")]
        public DateTime? CompletedAt { get; set; }

        [BsonElement("createdAt")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [BsonElement("updatedAt")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        public EnergyReservation()
        {
            // Method: EnergyReservation Constructor - Sets default UTC timestamps and status.
            CreatedAt = DateTime.UtcNow;
            UpdatedAt = DateTime.UtcNow;
            Status = "Approved";
        }
    }
}
