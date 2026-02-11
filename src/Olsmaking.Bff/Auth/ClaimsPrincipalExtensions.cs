using System.Security.Claims;

namespace Olsmaking.Bff.Auth;

internal static class ClaimsPrincipalExtensions
{
    private const string AdminScope = "admin-scope";

    public static bool HasAdminScope(this ClaimsPrincipal principal)
    {
        return HasClaimWithExactValue(principal, "permissions", AdminScope)
            || HasClaimWithDelimitedValue(principal, "scope", AdminScope)
            || HasClaimWithDelimitedValue(principal, "scp", AdminScope);
    }

    private static bool HasClaimWithExactValue(ClaimsPrincipal principal, string claimType, string expectedValue)
    {
        return principal.Claims.Any(claim =>
            string.Equals(claim.Type, claimType, StringComparison.OrdinalIgnoreCase)
            && string.Equals(claim.Value, expectedValue, StringComparison.Ordinal));
    }

    private static bool HasClaimWithDelimitedValue(ClaimsPrincipal principal, string claimType, string expectedValue)
    {
        return principal.Claims
            .Where(claim => string.Equals(claim.Type, claimType, StringComparison.OrdinalIgnoreCase))
            .SelectMany(claim => claim.Value.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            .Any(scope => string.Equals(scope, expectedValue, StringComparison.Ordinal));
    }
}
