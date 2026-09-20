// ============================================================================
// File: DbSeeder.cs
// Project: Solvance — Smart Solar Microgrid Trading System
// Author: Enterprise Application Development Team
// Course: SE4040 - Enterprise Application Development (SLIIT)
// Description: Seeds initial required mock data for Backoffice, Operators, Stations, and Slots.
// References & Citations:
//   - MongoDB.Driver .NET CRUD (InsertManyAsync, CountDocumentsAsync):
//     https://www.mongodb.com/docs/drivers/csharp/
// ============================================================================

using MongoDB.Driver;
using SolarMicrogridApi.Models;

namespace SolarMicrogridApi.Data
{
    /// <summary>
    /// Utility class to seed initial collections with operational sample data.
    /// </summary>
    public static class DbSeeder
    {
        /// <summary>
        /// Seeds system users, stations, and sample reservations if collections are empty.
        /// </summary>
        public static async Task SeedAsync(MongoDbContext context)
        {
            // Method: SeedAsync - Populates default admin, operator, sample prosumers, and solar hubs.
            var usersCount = await context.Users.CountDocumentsAsync(Builders<User>.Filter.Empty);
            if (usersCount == 0)
            {
                var sampleUsers = new List<User>
                {
                    new User
                    {
                        Nic = "ADMIN001",
                        FullName = "System Administrator",
                        Email = "admin@solarmicrogrid.lk",
                        Phone = "+94771234567",
                        PasswordHash = BCrypt.Net.BCrypt.HashPassword("Admin@123"),
                        Role = "Backoffice",
                        Status = "Active",
                        CreatedAt = DateTime.UtcNow
                    },
                    new User
                    {
                        Nic = "OPERATOR001",
                        FullName = "Nuwan Perera",
                        Email = "operator@solarmicrogrid.lk",
                        Phone = "+94777654321",
                        PasswordHash = BCrypt.Net.BCrypt.HashPassword("Operator@123"),
                        Role = "GridOperator",
                        Status = "Active",
                        CreatedAt = DateTime.UtcNow
                    },
                    new User
                    {
                        Nic = "200012345678",
                        FullName = "Sunil Shantha",
                        Email = "sunil@gmail.com",
                        Phone = "+94712345678",
                        PasswordHash = BCrypt.Net.BCrypt.HashPassword("Prosumer@123"),
                        Role = "Prosumer",
                        Status = "Active",
                        CreatedAt = DateTime.UtcNow
                    },
                    new User
                    {
                        Nic = "199987654321",
                        FullName = "Kamal Gunaratne",
                        Email = "kamal@gmail.com",
                        Phone = "+94723456789",
                        PasswordHash = BCrypt.Net.BCrypt.HashPassword("Prosumer@123"),
                        Role = "Prosumer",
                        Status = "Pending", // For testing backoffice approval workflow
                        CreatedAt = DateTime.UtcNow
                    }
                };

                await context.Users.InsertManyAsync(sampleUsers);
            }

            var stationsCount = await context.Stations.CountDocumentsAsync(Builders<SolarStation>.Filter.Empty);
            if (stationsCount == 0)
            {
                var sampleStations = new List<SolarStation>
                {
                    new SolarStation
                    {
                        StationCode = "HUB-CMB-01",
                        Name = "Colombo Central Solar Hub",
                        Latitude = 6.9271,
                        Longitude = 79.8612,
                        Address = "No. 45, Galle Road, Colombo 03",
                        CapacityKwh = 500.0,
                        TotalBatterySlots = 20,
                        AvailableBatterySlots = 14,
                        Schedule = new OperationalSchedule
                        {
                            OpenTime = "06:00",
                            CloseTime = "22:00",
                            DaysOpen = new List<string> { "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday" }
                        },
                        IsActive = true,
                        CreatedAt = DateTime.UtcNow
                    },
                    new SolarStation
                    {
                        StationCode = "HUB-KND-01",
                        Name = "Kandy Hills Microgrid Station",
                        Latitude = 7.2906,
                        Longitude = 80.6337,
                        Address = "Peradeniya Road, Kandy",
                        CapacityKwh = 350.0,
                        TotalBatterySlots = 15,
                        AvailableBatterySlots = 9,
                        Schedule = new OperationalSchedule
                        {
                            OpenTime = "07:00",
                            CloseTime = "20:00",
                            DaysOpen = new List<string> { "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday" }
                        },
                        IsActive = true,
                        CreatedAt = DateTime.UtcNow
                    },
                    new SolarStation
                    {
                        StationCode = "HUB-GAL-01",
                        Name = "Galle Coastal Solar Grid",
                        Latitude = 6.0328,
                        Longitude = 80.2170,
                        Address = "Fort Promenade, Galle",
                        CapacityKwh = 400.0,
                        TotalBatterySlots = 18,
                        AvailableBatterySlots = 12,
                        Schedule = new OperationalSchedule
                        {
                            OpenTime = "06:00",
                            CloseTime = "21:00",
                            DaysOpen = new List<string> { "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday" }
                        },
                        IsActive = true,
                        CreatedAt = DateTime.UtcNow
                    }
                };

                await context.Stations.InsertManyAsync(sampleStations);

                // Create initial slots and reservation
                var colomboStation = sampleStations[0];
                var sampleSlot = new EnergySlot
                {
                    StationId = colomboStation.Id!,
                    Date = DateTime.UtcNow.AddDays(2).ToString("yyyy-MM-dd"),
                    StartTime = "10:00",
                    EndTime = "12:00",
                    SlotCapacityKwh = 50.0,
                    AllocatedKwh = 15.0,
                    AvailableSlots = 3,
                    Status = "Open",
                    CreatedAt = DateTime.UtcNow
                };
                await context.Slots.InsertOneAsync(sampleSlot);

                var sampleReservation = new EnergyReservation
                {
                    ReservationNumber = "RES-INIT-101",
                    ProsumerNic = "200012345678",
                    StationId = colomboStation.Id!,
                    StationName = colomboStation.Name,
                    SlotId = sampleSlot.Id!,
                    ScheduledDateTime = DateTime.UtcNow.AddDays(2).Date.AddHours(10),
                    EnergyAmountKwh = 15.0,
                    TradeType = "DropOff",
                    Status = "Approved",
                    QrCodeToken = "RES-INIT-101|200012345678|" + colomboStation.Id + "|APPROVED",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                await context.Reservations.InsertOneAsync(sampleReservation);
            }
        }
    }
}
