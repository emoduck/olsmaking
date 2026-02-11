namespace Olsmaking.Bff.Auth;

internal sealed class Auth0Settings
{
    public const string SectionName = "Auth0";

    public string? Domain { get; set; }

    public string? ClientId { get; set; }

    public string? ClientSecret { get; set; }

    public string? Audience { get; set; }

    public string CallbackPath { get; set; } = "/signin-oidc";

    public string SignedOutCallbackPath { get; set; } = "/signout-callback-oidc";

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(Domain) &&
        !string.IsNullOrWhiteSpace(ClientId) &&
        !string.IsNullOrWhiteSpace(ClientSecret);
}
