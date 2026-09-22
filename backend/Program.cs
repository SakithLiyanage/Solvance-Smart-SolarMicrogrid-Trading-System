// ============================================================================
// File: Program.cs
// Project: Smart Solar Microgrid Trading System
// Author: Enterprise Application Development Team
// Description: Application entry point configuring dependency injection, JWT auth, and CORS.
// ============================================================================

using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using SolarMicrogridApi.Data;
using SolarMicrogridApi.Services;

var builder = WebApplication.CreateBuilder(args);

var qrSigningSecret = builder.Configuration["QrSettings:SigningSecret"];
if (string.IsNullOrWhiteSpace(qrSigningSecret) ||
    qrSigningSecret == "CHANGE-ME-USE-A-SECRET-VIA-ENVIRONMENT-VARIABLE")
{
    throw new InvalidOperationException(
        "QrSettings:SigningSecret must be configured with a non-placeholder secret. " +
        "Use the QrSettings__SigningSecret environment variable or user secrets.");
}

// Method: ConfigureServices - Registers controllers, MongoDB context, enterprise services, and JWT.
builder.Services.AddControllers();
builder.Services.AddOpenApi();

// Register MongoDB Context
builder.Services.AddSingleton<MongoDbContext>();

// Register Enterprise Services (FAT Service Architecture)
builder.Services.AddScoped<IUserService, UserService>();
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
var jwtSecret = builder.Configuration["JwtSettings:SecretKey"] ?? "EnterpriseSolarMicrogridTradingSystemSecretKey2026!#Security";
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
        ValidIssuer = builder.Configuration["JwtSettings:Issuer"] ?? "SolarMicrogridApi",
        ValidateAudience = true,
        ValidAudience = builder.Configuration["JwtSettings:Audience"] ?? "SolarMicrogridClients",
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

// Auto-seed initial system database
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<MongoDbContext>();
    await DbSeeder.SeedAsync(context, builder.Configuration);
}

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
