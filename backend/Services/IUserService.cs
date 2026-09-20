// ============================================================================
// File: IUserService.cs
// Project: Smart Solar Microgrid Trading System
// Author: Enterprise Application Development Team
// Description: Contract for user authentication, account control, and lifecycle operations.
// ============================================================================

using SolarMicrogridApi.Models;

namespace SolarMicrogridApi.Services
{
    public interface IUserService
    {
        Task<AuthResponseDto?> AuthenticateAsync(LoginRequestDto request);
        Task<User> RegisterProsumerAsync(ProsumerRegisterDto dto);
        Task<User> CreateStaffUserAsync(CreateStaffUserDto dto);
        Task<List<User>> GetUsersAsync(string? role = null, string? status = null);
        Task<List<User>> GetPendingProsumersAsync();
        Task<User?> GetUserByNicAsync(string nic);
        Task<bool> UpdateUserStatusAsync(string nic, string newStatus, string operatorRole);
        Task<bool> UpdateProfileAsync(string nic, UpdateProfileDto dto);
        Task<bool> RequestDeactivationAsync(string nic);
    }
}
