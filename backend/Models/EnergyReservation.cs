// ============================================================================
// File: EnergyReservation.cs
// Project: Smart Solar Microgrid Trading System
// Author: Enterprise Application Development Team
// Description: Model representing power trade requests in "Energy Reservation" collection.
// ============================================================================

using System;
using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using SolarMicrogridApi.Data;

namespace SolarMicrogridApi.Models
{
    /// <summary>
    /// Represents energy reservation transactions in the "Energy Reservation" MongoDB collection.
    /// </summary>
    public class EnergyReservation
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string? Id { get; set; }

        [BsonElement("reservationNumber")]
        public string ReservationNumber { get; set; } = string.Empty;

        /// <summary>
        /// Prosumer's National Identity Card number.
        /// </summary>
        [BsonElement("prosumerNic")]
        public string ProsumerNic { get; set; } = string.Empty;

        [BsonElement("stationId")]
        [BsonSerializer(typeof(StringOrObjectIdSerializer))]
        public string StationId { get; set; } = string.Empty;

        [BsonElement("stationName")]
        public string StationName { get; set; } = string.Empty;

        [BsonElement("slotId")]
        [BsonSerializer(typeof(StringOrObjectIdSerializer))]
        public string SlotId { get; set; } = string.Empty;

        [BsonElement("scheduledDateTime")]
        public DateTime ScheduledDateTime { get; set; }

        [BsonElement("energyAmountKwh")]
        public double EnergyAmountKwh { get; set; }

        /// <summary>
        /// Transaction type: "DropOff" (feeding into grid) or "Charging" (drawing from grid)
        /// </summary>
        [BsonElement("tradeType")]
        public string TradeType { get; set; } = "DropOff";

        /// <summary>
        /// Status: "Pending", "Approved", "Completed", "Cancelled"
        /// </summary>
        [BsonElement("status")]
        public string Status { get; set; } = "Pending";

        /// <summary>
        /// Secure payload token or string encoded into QR code for grid operators.
        /// </summary>
        [BsonElement("qrCodeToken")]
        public string QrCodeToken { get; set; } = string.Empty;

        [BsonElement("cancellationReason")]
        public string? CancellationReason { get; set; }

        [BsonElement("createdAt")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [BsonElement("updatedAt")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        [BsonElement("completedAt")]
        public DateTime? CompletedAt { get; set; }

        [BsonElement("completedByOperatorNic")]
        public string? CompletedByOperatorNic { get; set; }

        [BsonElement("slotReserved")]
        public bool SlotReserved { get; set; }
        public EnergyReservation()
        {
            // Method: EnergyReservation Constructor - Initializes timestamps and unique reservation identifier.
            CreatedAt = DateTime.UtcNow;
            UpdatedAt = DateTime.UtcNow;
            Status = "Pending";
            ReservationNumber = "RES-" + DateTime.UtcNow.Ticks.ToString()[^8..];
        }
    }
}
