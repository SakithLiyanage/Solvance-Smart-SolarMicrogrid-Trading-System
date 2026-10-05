// ============================================================================
// File: MongoDbContext.cs
// Project: Solvance — Smart Solar Microgrid Trading System
// Authors:
//   - G.L.S. Chanlaka (IT23151260) - Database connection & collection setup
//   - M.L. Booso (IT23452916) - Indexing & schema integration
// Course: SE4040 - Enterprise Application Development (SLIIT)
// Description: MongoDB database context establishing resilient connection to 4 required collections.
// References & Citations:
//   - MongoDB C# Driver MongoClient & Connection Lifecycle:
//     https://www.mongodb.com/docs/drivers/csharp/current/fundamentals/connection/
//   - MongoDB C# Driver IMongoCollection & Index Management:
//     https://www.mongodb.com/docs/drivers/csharp/current/fundamentals/indexes/
// ============================================================================

using System;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;
using MongoDB.Bson;
using MongoDB.Driver;
using SolarMicrogridApi.Models;
using SolarMicrogridApi.Models.Config;

namespace SolarMicrogridApi.Data
{
    /// <summary>
    /// Context providing access to MongoDB collections per assignment specifications.
    /// </summary>
    public class MongoDbContext
    {
        private readonly IMongoClient _client;
        private readonly IMongoDatabase _database;
        private readonly MongoDbSettings _settings;

        /// <summary>
        /// Initializes the MongoDB client with strongly-typed IOptions settings.
        /// </summary>
        public MongoDbContext(IOptions<MongoDbSettings> options, IConfiguration configuration)
        {
            // Method: MongoDbContext Constructor - Connects to MongoDB server and sets database reference.
            _settings = options?.Value ?? new MongoDbSettings();

            var connectionString = !string.IsNullOrEmpty(_settings.ConnectionString)
                ? _settings.ConnectionString
                : (configuration["MongoDbSettings:ConnectionString"] ?? "mongodb://localhost:27017");

            var databaseName = !string.IsNullOrEmpty(_settings.DatabaseName)
                ? _settings.DatabaseName
                : (configuration["MongoDbSettings:DatabaseName"] ?? "SolarMicrogridDb");

            IMongoDatabase? targetDb = null;
            IMongoClient? targetClient = null;

            try
            {
                var settings = MongoClientSettings.FromConnectionString(connectionString);
                settings.ServerSelectionTimeout = TimeSpan.FromSeconds(25);
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
                targetClient = client;
                targetDb = testDb;
            }
            catch
            {
                var fallbackSettings = MongoClientSettings.FromConnectionString(connectionString);
                fallbackSettings.ServerSelectionTimeout = TimeSpan.FromSeconds(30);
                if (fallbackSettings.UseTls)
                {
                    fallbackSettings.SslSettings = new SslSettings
                    {
                        CheckCertificateRevocation = false,
                        ServerCertificateValidationCallback = (sender, certificate, chain, sslPolicyErrors) => true
                    };
                }
                var defaultClient = new MongoClient(fallbackSettings);
                targetClient = defaultClient;
                targetDb = defaultClient.GetDatabase(databaseName);
            }

            _client = targetClient!;
            _database = targetDb;

            EnsureIndexesCreated();
        }

        public IMongoClient Client => _client;

        /// <summary>
        /// Collection 1: "User's detail" per specification.
        /// </summary>
        public IMongoCollection<User> Users =>
            _database.GetCollection<User>(_settings.EffectiveUsersCollection);

        /// <summary>
        /// Collection 2: "SolarStationInfo" per specification.
        /// </summary>
        public IMongoCollection<SolarStation> Stations =>
            _database.GetCollection<SolarStation>(_settings.EffectiveStationsCollection);

        /// <summary>
        /// Collection 3: "EnergyBookingSlots" per specification.
        /// </summary>
        public IMongoCollection<EnergySlot> Slots =>
            _database.GetCollection<EnergySlot>(_settings.EffectiveSlotsCollection);

        /// <summary>
        /// Collection 4: "Energy Reservation" per specification.
        /// </summary>
        public IMongoCollection<EnergyReservation> Reservations =>
            _database.GetCollection<EnergyReservation>(_settings.EffectiveReservationsCollection);

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