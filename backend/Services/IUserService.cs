// ============================================================================
// File: IUserService.cs
// Project: Solvance — Smart Solar Microgrid Trading System
// Author: M.L. Booso (IT23452916)
// Course: SE4040 - Enterprise Application Development (SLIIT)
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
        Task<bool> UpdateUserStatusAsync(string nic, string newStatus, string operatorRole, string? operatorNic = null);
        Task<bool> UpdateProfileAsync(string nic, UpdateProfileDto dto);
        Task<bool> RequestDeactivationAsync(string nic);
    }
}
