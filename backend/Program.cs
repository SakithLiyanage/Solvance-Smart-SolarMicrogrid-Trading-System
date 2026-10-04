// ============================================================================
// File: Program.cs
// Project: Solvance — Smart Solar Microgrid Trading System
// Authors:
//   - M.L. Booso (IT23452916) - Identity & Security Lead
//   - G.L.S. Chanlaka (IT23151260) - Microgrid Stations & Maps Lead
//   - L.T. Jayawardhana (IT23156760) - Reservations & Rules Lead
//   - H.N. Madubashini (IT23192300) - Operator & QR Telemetry Lead
// Course: SE4040 - Enterprise Application Development (SLIIT)
// Description: Application entry point configuring dependency injection, JWT auth, and CORS.
// References & Citations:
//   - Microsoft ASP.NET Core 8 Web API & Security (JWT Bearer Authentication):
//     https://learn.microsoft.com/en-us/aspnet/core/security/authentication/
//   - MongoDB.Driver .NET API (Official Mongo Driver):
//     https://www.mongodb.com/docs/drivers/csharp/
// ============================================================================

using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using SolarMicrogridApi.Data;
using SolarMicrogridApi.Models.Config;
using SolarMicrogridApi.Services;

var builder = WebApplication.CreateBuilder(args);

var qrSigningSecret = Environment.GetEnvironmentVariable("QrSettings__SigningSecret")
    ?? Environment.GetEnvironmentVariable("QR_SIGNING_SECRET")
    ?? builder.Configuration["QrSettings:SigningSecret"]
    ?? builder.Configuration["QrSettings__SigningSecret"];

if (string.IsNullOrWhiteSpace(qrSigningSecret) ||
    qrSigningSecret == "CHANGE-ME-USE-A-SECRET-VIA-ENVIRONMENT-VARIABLE")
{
    throw new InvalidOperationException(
        "QrSettings:SigningSecret must be configured with a non-placeholder secret. " +
        "Use the QrSettings__SigningSecret environment variable or dotnet user-secrets.");
}

// Method: ConfigureServices - Registers controllers, MongoDB context, enterprise services, and JWT.
builder.Services.AddControllers();
builder.Services.AddOpenApi();

// Register strongly-typed configuration options (IOptions<T>)
builder.Services.Configure<JwtSettings>(builder.Configuration.GetSection("JwtSettings"));
builder.Services.Configure<SecuritySettings>(builder.Configuration.GetSection("SecuritySettings"));
builder.Services.Configure<MongoDbSettings>(builder.Configuration.GetSection("MongoDbSettings"));
builder.Services.Configure<ReservationSettings>(builder.Configuration.GetSection("ReservationSettings"));
builder.Services.Configure<EmailSettings>(builder.Configuration.GetSection("EmailSettings"));

// Register MongoDB Context
builder.Services.AddSingleton<MongoDbContext>();

// Register Enterprise Services (FAT Service Architecture)
builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddScoped<IEmailService, EmailService>();
builder.Services.AddScoped<IStationService, StationService>();
builder.Services.AddScoped<ISlotService, SlotService>();
builder.Services.AddScoped<IReservationService, ReservationService>();

// Configure CORS for Web Client and Native Mobile App
builder.Services.AddCors(options =>
{
    // Method: ConfigureCors - Sets permissive CORS policy for web dashboard and mobile API access.
    options.AddPolicy("AllowAllClients", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

// Configure JWT Authentication
var jwtSettings = builder.Configuration.GetSection("JwtSettings").Get<JwtSettings>() ?? new JwtSettings();
var jwtSecret = Environment.GetEnvironmentVariable("JwtSettings__Secret")
    ?? Environment.GetEnvironmentVariable("JwtSettings__SecretKey")
    ?? Environment.GetEnvironmentVariable("JWT_SECRET")
    ?? (!string.IsNullOrEmpty(jwtSettings.EffectiveSecret)
        ? jwtSettings.EffectiveSecret
        : (builder.Configuration["JwtSettings:SecretKey"] ?? "EnterpriseSolarMicrogridTradingSystemSecretKey2026!#Security"));
var key = Encoding.UTF8.GetBytes(jwtSecret);

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    // Method: ConfigureJwtBearer - Enforces token signing key, lifetime, and audience validation.
    options.RequireHttpsMetadata = false;
    options.SaveToken = true;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(key),
        ValidateIssuer = true,
        ValidIssuer = !string.IsNullOrEmpty(jwtSettings.Issuer) ? jwtSettings.Issuer : (builder.Configuration["JwtSettings:Issuer"] ?? "SolarMicrogridApi"),
        ValidateAudience = true,
        ValidAudience = !string.IsNullOrEmpty(jwtSettings.Audience) ? jwtSettings.Audience : (builder.Configuration["JwtSettings:Audience"] ?? "SolarMicrogridClients"),
        ClockSkew = TimeSpan.Zero
    };
});

builder.Services.AddAuthorization();

var app = builder.Build();

// Method: ConfigurePipeline - Configures HTTP middleware pipeline, CORS, routing, and DB seeder.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors("AllowAllClients");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
