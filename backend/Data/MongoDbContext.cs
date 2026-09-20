// ============================================================================
// File: MongoDbContext.cs
// Project: Solvance — Smart Solar Microgrid Trading System
// Author: Enterprise Application Development Team
// Course: SE4040 - Enterprise Application Development (SLIIT)
// Description: MongoDB database context establishing resilient connection to 4 required collections.
// References & Citations:
//   - MongoDB.Driver MongoClient & IMongoDatabase:
//     https://www.mongodb.com/docs/drivers/csharp/
// ============================================================================

using System;
using Microsoft.Extensions.Configuration;
using MongoDB.Bson;
using MongoDB.Driver;
using SolarMicrogridApi.Models;

namespace SolarMicrogridApi.Data
{
    /// <summary>
    /// Context providing access to MongoDB collections per assignment specifications.
    /// </summary>
    public class MongoDbContext
    {
        private readonly IMongoDatabase _database;
        private readonly IConfiguration _configuration;

        /// <summary>
        /// Initializes the MongoDB client and accesses the target database with resilient connection settings.
        /// </summary>
        public MongoDbContext(IConfiguration configuration)
        {
            // Method: MongoDbContext Constructor - Connects to MongoDB server and sets database reference.
            _configuration = configuration;
            var connectionString = _configuration["MongoDbSettings:ConnectionString"] ?? "mongodb://localhost:27017";
            var databaseName = _configuration["MongoDbSettings:DatabaseName"] ?? "SolarMicrogridDb";

            IMongoDatabase targetDb = null;

            try
            {
                var settings = MongoClientSettings.FromConnectionString(connectionString);
                settings.ServerSelectionTimeout = TimeSpan.FromSeconds(6);
                if (settings.UseTls)
                {
                    settings.SslSettings = new SslSettings
                    {
                        CheckCertificateRevocation = false,
                        ServerCertificateValidationCallback = (sender, certificate, chain, sslPolicyErrors) => true
                    };
                }

                var client = new MongoClient(settings);
                var testDb = client.GetDatabase(databaseName);
                testDb.RunCommandAsync((Command<BsonDocument>)"{ping:1}").GetAwaiter().GetResult();
                targetDb = testDb;
            }
            catch
            {
                // Fallback to local MongoDB instance if cloud TLS or network encounters transient issues
                try
                {
                    var fallbackSettings = MongoClientSettings.FromConnectionString("mongodb://localhost:27017");
                    fallbackSettings.ServerSelectionTimeout = TimeSpan.FromSeconds(5);
                    var fallbackClient = new MongoClient(fallbackSettings);
                    targetDb = fallbackClient.GetDatabase(databaseName);
                }
                catch
                {
                    // Fallback to default client
                    var defaultClient = new MongoClient(connectionString);
                    targetDb = defaultClient.GetDatabase(databaseName);
                }
            }

            _database = targetDb;

            EnsureIndexesCreated();
        }

        /// <summary>
        /// Collection 1: "User's detail" per specification.
        /// </summary>
        public IMongoCollection<User> Users =>
            _database.GetCollection<User>(_configuration["MongoDbSettings:UsersCollectionName"] ?? "User's detail");

        /// <summary>
        /// Collection 2: "SolarStationInfo" per specification.
        /// </summary>
        public IMongoCollection<SolarStation> Stations =>
            _database.GetCollection<SolarStation>(_configuration["MongoDbSettings:StationsCollectionName"] ?? "SolarStationInfo");

        /// <summary>
        /// Collection 3: "EnergyBookingSlots" per specification.
        /// </summary>
        public IMongoCollection<EnergySlot> Slots =>
            _database.GetCollection<EnergySlot>(_configuration["MongoDbSettings:SlotsCollectionName"] ?? "EnergyBookingSlots");

        /// <summary>
        /// Collection 4: "Energy Reservation" per specification.
        /// </summary>
        public IMongoCollection<EnergyReservation> Reservations =>
            _database.GetCollection<EnergyReservation>(_configuration["MongoDbSettings:ReservationsCollectionName"] ?? "Energy Reservation");

        /// <summary>
        /// Ensures unique indexes on critical natural keys like NIC.
        /// </summary>
        private void EnsureIndexesCreated()
        {
            // Method: EnsureIndexesCreated - Enforces unique constraint index on NIC field in User's detail.
            try
            {
                var userIndexKeys = Builders<User>.IndexKeys.Ascending(u => u.Nic);
                var indexOptions = new CreateIndexOptions { Unique = true, Sparse = false };
                Users.Indexes.CreateOne(new CreateIndexModel<User>(userIndexKeys, indexOptions));
            }
            catch
            {
                // Ignore if index exists already.
            }
        }
    }
}
