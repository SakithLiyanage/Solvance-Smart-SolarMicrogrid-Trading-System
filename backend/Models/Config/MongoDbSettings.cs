// ============================================================================
// File: MongoDbSettings.cs
// Project: Solvance — Smart Solar Microgrid Trading System
// Author: G.L.S. Chanlaka (IT23151260)
// Course: SE4040 - Enterprise Application Development (SLIIT)
// Description: Strongly-typed configuration POCO for MongoDB connection and collection names.
// References & Citations:
//   - Microsoft ASP.NET Core IOptions Pattern:
//     https://learn.microsoft.com/en-us/aspnet/core/fundamentals/configuration/options
// ============================================================================

namespace SolarMicrogridApi.Models.Config
{
    /// <summary>
    /// Strongly-typed MongoDB configuration representing the "MongoDbSettings" section.
    /// </summary>
    public class MongoDbSettings
    {
        public string ConnectionString { get; set; } = "mongodb://localhost:27017";
        public string DatabaseName { get; set; } = "SolarMicrogridDb";
        public MongoDbCollections Collections { get; set; } = new();

        // Fallback flat collection name properties
        public string UsersCollectionName { get; set; } = "User's detail";
        public string StationsCollectionName { get; set; } = "SolarStationInfo";
        public string SlotsCollectionName { get; set; } = "EnergyBookingSlots";
        public string ReservationsCollectionName { get; set; } = "Energy Reservation";

        public string EffectiveUsersCollection => !string.IsNullOrEmpty(Collections?.Users) ? Collections.Users : UsersCollectionName;
        public string EffectiveStationsCollection => !string.IsNullOrEmpty(Collections?.Stations) ? Collections.Stations : StationsCollectionName;
        public string EffectiveSlotsCollection => !string.IsNullOrEmpty(Collections?.Slots) ? Collections.Slots : SlotsCollectionName;
        public string EffectiveReservationsCollection => !string.IsNullOrEmpty(Collections?.Reservations) ? Collections.Reservations : ReservationsCollectionName;
    }

    /// <summary>
    /// Nested collection name mappings within MongoDbSettings.
    /// </summary>
    public class MongoDbCollections
    {
        public string Users { get; set; } = "User's detail";
        public string Stations { get; set; } = "SolarStationInfo";
        public string Slots { get; set; } = "EnergyBookingSlots";
        public string Reservations { get; set; } = "Energy Reservation";
    }
}
