// ============================================================================
// File: Program.cs
// Project: Smart Solar Microgrid Trading System
// Author: Enterprise Application Development Team
// Description: Application entry point, dependency injection container, JWT setup, and MongoDB initialization.
// ============================================================================

using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using MongoDB.Driver;
using SolarMicrogridApi.Data;
using SolarMicrogridApi.Models;
using SolarMicrogridApi.Services;

var builder = WebApplication.CreateBuilder(args);

// 1. Dependency Injection - Database Context & Business Services (FAT Service Pattern)
builder.Services.AddSingleton<MongoDbContext>();
builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddScoped<IStationService, StationService>();
builder.Services.AddScoped<IReservationService, ReservationService>();

// 2. CORS Policy for Web Application and Android Emulator integration
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

// 3. JWT Authentication Setup
var jwtSecretKey = builder.Configuration["JwtSettings:SecretKey"] 
    ?? "EnterpriseSolarMicrogridTradingSystemSecretKey2026!#Security";
var jwtIssuer = builder.Configuration["JwtSettings:Issuer"] ?? "SolarMicrogridApi";
var jwtAudience = builder.Configuration["JwtSettings:Audience"] ?? "SolarMicrogridClients";

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.RequireHttpsMetadata = false;
    options.SaveToken = true;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecretKey)),
        ValidateIssuer = true,
        ValidIssuer = jwtIssuer,
        ValidateAudience = true,
        ValidAudience = jwtAudience,
        ValidateLifetime = true,
        ClockSkew = TimeSpan.Zero
    };
});

builder.Services.AddAuthorization();
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

var app = builder.Build();

// 4. Seed Initial Accounts & Microgrid Nodes if empty
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<MongoDbContext>();
    SeedDatabase(context);
}

// 5. Middleware Pipeline
app.UseCors("AllowAll");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();

/// <summary>
/// Seeds essential Backoffice Admin, Grid Operator, and initial Solar Stations for Viva demonstration.
/// </summary>
void SeedDatabase(MongoDbContext context)
{
    try
    {
        // Seed Admin Account
        var adminExists = context.Users.Find(u => u.Nic == "ADMIN001").Any();
        if (!adminExists)
        {
            context.Users.InsertOne(new User
            {
                Nic = "ADMIN001",
                FullName = "System Administrator",
                Email = "admin@solvance.energy",
                Phone = "+94771234567",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("Admin@123"),
                Role = "Backoffice",
                Status = "Active",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            });
        }

        // Seed Grid Operator Account
        var opExists = context.Users.Find(u => u.Nic == "OPERATOR001").Any();
        if (!opExists)
        {
            context.Users.InsertOne(new User
            {
                Nic = "OPERATOR001",
                FullName = "Grid Operator Central",
                Email = "operator@solvance.energy",
                Phone = "+94777654321",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("Operator@123"),
                Role = "GridOperator",
                Status = "Active",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            });
        }

        // Seed Sample Microgrid Stations
        if (!context.Stations.Find(_ => true).Any())
        {
            context.Stations.InsertMany(new List<SolarStation>
            {
                new SolarStation
                {
                    StationCode = "ST-CMB-01",
                    Name = "Colombo Central Solar Hub",
                    Latitude = 6.9271,
                    Longitude = 79.8612,
                    Address = "No 100, Galle Road, Colombo 03",
                    CapacityKwh = 500.0,
                    TotalBatterySlots = 20,
                    AvailableBatterySlots = 14,
                    IsActive = true,
                    Schedule = new OperationalSchedule
                    {
                        OpenTime = "06:00",
                        CloseTime = "20:00",
                        OperatingDays = new List<string> { "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday" }
                    }
                },
                new SolarStation
                {
                    StationCode = "ST-KDY-02",
                    Name = "Kandy Highland Microgrid",
                    Latitude = 7.2906,
                    Longitude = 80.6337,
                    Address = "No 45, Peradeniya Road, Kandy",
                    CapacityKwh = 350.0,
                    TotalBatterySlots = 15,
                    AvailableBatterySlots = 9,
                    IsActive = true,
                    Schedule = new OperationalSchedule
                    {
                        OpenTime = "06:30",
                        CloseTime = "18:30",
                        OperatingDays = new List<string> { "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday" }
                    }
                },
                new SolarStation
                {
                    StationCode = "ST-GAL-03",
                    Name = "Galle Coastal Solar Terminal",
                    Latitude = 6.0535,
                    Longitude = 80.2210,
                    Address = "No 12, Fort Marine Drive, Galle",
                    CapacityKwh = 420.0,
                    TotalBatterySlots = 18,
                    AvailableBatterySlots = 12,
                    IsActive = true,
                    Schedule = new OperationalSchedule
                    {
                        OpenTime = "07:00",
                        CloseTime = "19:00",
                        OperatingDays = new List<string> { "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday" }
                    }
                }
            });
        }
    }
    catch
    {
        // Fail-safe seed handling for remote clusters
    }
}
