// ============================================================================
// File: Exceptions.cs
// Project: Solvance — Smart Solar Microgrid Trading System
// Authors:
//   - M.L. Booso (IT23452916) - Authentication & authorization exception types
//   - L.T. Jayawardhana (IT23156760) - Reservation lifecycle & booking violation exceptions
// Course: SE4040 - Enterprise Application Development (SLIIT)
// Description: Domain-specific exceptions for authentication guards and lifecycle business rules.
// References & Citations:
//   - Microsoft .NET Standard Exception Design Guidelines & Custom Exception Best Practices:
//     https://learn.microsoft.com/en-us/dotnet/standard/design-guidelines/exceptions-and-performance
// ============================================================================

using System;

namespace SolarMicrogridApi.Models
{
    /// <summary>
    /// Thrown when an unapproved prosumer attempts to access system endpoints.
    /// </summary>
    public class AccountPendingException : Exception
    {
        public AccountPendingException(string message = "Your account is pending Backoffice KYC review.")
            : base(message) { }
    }

    /// <summary>
    /// Thrown when a deactivated account attempts authentication.
    /// </summary>
    public class AccountDeactivatedException : Exception
    {
        public AccountDeactivatedException(string message = "Account deactivated. Contact Backoffice support for reactivation.")
            : base(message) { }
    }

    /// <summary>
    /// Thrown when an account is temporarily locked due to excessive failed login attempts.
    /// </summary>
    public class AccountLockedException : Exception
    {
        public DateTime? LockoutEnd { get; }

        public AccountLockedException(string message, DateTime? lockoutEnd = null)
            : base(message)
        {
            LockoutEnd = lockoutEnd;
        }
    }
}
