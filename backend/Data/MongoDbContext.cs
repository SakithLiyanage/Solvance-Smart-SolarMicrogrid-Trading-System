// ============================================================================
// File: MongoDbContext.cs
// Project: Smart Solar Microgrid Trading System
// Author: Enterprise Application Development Team
// Description: Central database context managing connections and indexes for MongoDB collections.
// ============================================================================

using Microsoft.Extensions.Configuration;
using MongoDB.Driver;
using SolarMicrogridApi.Models;

namespace SolarMicrogridApi.Data
{
    /// <summary>
    /// Encapsulates MongoDB client connection and exposes collections for all enterprise domain models.
    /// Manages unique and compound index initialization.
    /// </summary>
    public class MongoDbContext
    {
        private readonly IMongoDatabase _database;
        private readonly IConfiguration _configuration;

        public MongoDbContext(IConfiguration configuration)
        {
            // Method: MongoDbContext Constructor - Establishes MongoDB connection and binds collections.
            _configuration = configuration;
            var connectionString = _configuration["MongoDbSettings:ConnectionString"] 
                ?? "mongodb://localhost:27017";
            var databaseName = _configuration["MongoDbSettings:DatabaseName"] 
                ?? "SolarMicrogridDb";

            var client = new MongoClient(connectionString);
            _database = client.GetDatabase(databaseName);

            InitializeIndexes();
        }

        public IMongoCollection<User> Users =>
            _database.GetCollection<User>(_configuration["MongoDbSettings:UsersCollectionName"] ?? "User's detail");

        public IMongoCollection<SolarStation> Stations =>
            _database.GetCollection<SolarStation>(_configuration["MongoDbSettings:StationsCollectionName"] ?? "SolarStationInfo");

        public IMongoCollection<EnergyBookingSlot> BookingSlots =>
            _database.GetCollection<EnergyBookingSlot>(_configuration["MongoDbSettings:SlotsCollectionName"] ?? "EnergyBookingSlots");

        public IMongoCollection<EnergyReservation> Reservations =>
            _database.GetCollection<EnergyReservation>(_configuration["MongoDbSettings:ReservationsCollectionName"] ?? "Energy Reservation");

        private void InitializeIndexes()
        {
            // Method: InitializeIndexes - Configures unique and query optimization indexes across all 4 collections.
            try
            {
                // 1. User's detail: Unique NIC and sparse unique Email
                var userIndexKeys = Builders<User>.IndexKeys.Ascending(u => u.Nic);
                Users.Indexes.CreateOne(new CreateIndexModel<User>(userIndexKeys, new CreateIndexOptions { Unique = true }));

                var userEmailKeys = Builders<User>.IndexKeys.Ascending(u => u.Email);
                Users.Indexes.CreateOne(new CreateIndexModel<User>(userEmailKeys, new CreateIndexOptions { Unique = true, Sparse = true }));

                // 2. SolarStationInfo: Unique StationCode
                var stationIndexKeys = Builders<SolarStation>.IndexKeys.Ascending(s => s.StationCode);
                Stations.Indexes.CreateOne(new CreateIndexModel<SolarStation>(stationIndexKeys, new CreateIndexOptions { Unique = true }));

                // 3. Energy Reservation: Compound index on ProsumerNic + Status, and StationId + Status
                var reservationProsumerKeys = Builders<EnergyReservation>.IndexKeys
                    .Ascending(r => r.ProsumerNic)
                    .Ascending(r => r.Status);
                Reservations.Indexes.CreateOne(new CreateIndexModel<EnergyReservation>(reservationProsumerKeys));

                var reservationStationKeys = Builders<EnergyReservation>.IndexKeys
                    .Ascending(r => r.StationId)
                    .Ascending(r => r.Status);
                Reservations.Indexes.CreateOne(new CreateIndexModel<EnergyReservation>(reservationStationKeys));
            }
            catch
            {
                // Suppress index creation warnings if index already exists in remote MongoDB cluster
            }
        }
    }
}
