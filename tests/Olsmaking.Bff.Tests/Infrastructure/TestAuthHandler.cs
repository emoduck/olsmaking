using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Olsmaking.Bff.Tests.Infrastructure;

internal sealed class TestAuthHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder)
    : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    public const string SchemeName = "TestAuth";

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var subject = Request.Headers["X-Test-Auth-Sub"].FirstOrDefault() ?? "test-subject";
        var email = Request.Headers["X-Test-Auth-Email"].FirstOrDefault() ?? "test@example.com";
        var nickname = Request.Headers["X-Test-Auth-Nickname"].FirstOrDefault() ?? "test-user";
        var scopes = Request.Headers["X-Test-Auth-Scopes"].FirstOrDefault();

        var claims = new List<Claim>
        {
            new("sub", subject),
            new(ClaimTypes.NameIdentifier, subject),
            new("email", email),
            new("nickname", nickname),
        };

        if (!string.IsNullOrWhiteSpace(scopes))
        {
            claims.Add(new Claim("scope", scopes));
        }

        var identity = new ClaimsIdentity(claims, SchemeName);
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, SchemeName);

        return Task.FromResult(AuthenticateResult.Success(ticket));
    }
}
