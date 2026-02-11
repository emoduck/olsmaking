using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.EntityFrameworkCore;
using Olsmaking.Bff.Auth;
using Olsmaking.Bff.Data;
using Olsmaking.Bff.Domain;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();
var defaultConnection = builder.Configuration.GetConnectionString("DefaultConnection");

if (string.IsNullOrWhiteSpace(defaultConnection))
{
    throw new InvalidOperationException(
        "ConnectionStrings:DefaultConnection is required. Configure LocalDB for development and Azure SQL for hosted environments.");
}

builder.Services.AddDbContext<OlsmakingDbContext>(options =>
    options.UseSqlServer(defaultConnection));

builder.Services.AddOptions<Auth0Settings>()
    .BindConfiguration(Auth0Settings.SectionName);

var auth0Settings = builder.Configuration
    .GetSection(Auth0Settings.SectionName)
    .Get<Auth0Settings>() ?? new Auth0Settings();

if (auth0Settings.IsConfigured)
{
    builder.Services
        .AddAuthentication(options =>
        {
            options.DefaultScheme = CookieAuthenticationDefaults.AuthenticationScheme;
            options.DefaultChallengeScheme = OpenIdConnectDefaults.AuthenticationScheme;
        })
        .AddCookie(options =>
        {
            options.Events.OnRedirectToLogin = context =>
            {
                if (context.Request.Path.StartsWithSegments("/api"))
                {
                    context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                    return Task.CompletedTask;
                }

                context.Response.Redirect(context.RedirectUri);
                return Task.CompletedTask;
            };
        })
        .AddOpenIdConnect(options =>
        {
            options.Authority = $"https://{auth0Settings.Domain}/";
            options.ClientId = auth0Settings.ClientId;
            options.ClientSecret = auth0Settings.ClientSecret;
            options.ResponseType = "code";
            options.MapInboundClaims = false;
            options.GetClaimsFromUserInfoEndpoint = true;
            options.SaveTokens = false;
            options.CallbackPath = auth0Settings.CallbackPath;
            options.SignedOutCallbackPath = auth0Settings.SignedOutCallbackPath;
            options.Scope.Clear();
            options.Scope.Add("openid");
            options.Scope.Add("profile");
            options.Scope.Add("email");

            options.Events.OnRedirectToIdentityProvider = context =>
            {
                if (!string.IsNullOrWhiteSpace(auth0Settings.Audience))
                {
                    context.ProtocolMessage.SetParameter("audience", auth0Settings.Audience);
                }

                return Task.CompletedTask;
            };
        });
}
else
{
    builder.Services
        .AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
        .AddCookie(options =>
        {
            options.Events.OnRedirectToLogin = context =>
            {
                context.Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
                return Task.CompletedTask;
            };
        });
}

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("AdminPolicy", policy =>
        policy.RequireAssertion(context => context.User.HasAdminScope()));
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();
app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/api/health", () => Results.Ok(new
{
    Status = "ok",
    TimestampUtc = DateTimeOffset.UtcNow,
}));

var authGroup = app.MapGroup("/api/auth");

if (auth0Settings.IsConfigured)
{
    authGroup.MapGet("/login", (string? returnUrl) =>
    {
        return Results.Challenge(
            new AuthenticationProperties
            {
                RedirectUri = GetSafeReturnUrl(returnUrl),
            },
            authenticationSchemes: [OpenIdConnectDefaults.AuthenticationScheme]);
    });

    authGroup.MapPost("/logout", (string? returnUrl) =>
    {
        return Results.SignOut(
            new AuthenticationProperties
            {
                RedirectUri = GetSafeReturnUrl(returnUrl),
            },
            authenticationSchemes:
            [
                CookieAuthenticationDefaults.AuthenticationScheme,
                OpenIdConnectDefaults.AuthenticationScheme,
            ]);
    });
}
else
{
    authGroup.MapGet("/login", AuthUnavailable);
    authGroup.MapPost("/logout", AuthUnavailable);
}

var usersGroup = app.MapGroup("/api/users");

if (auth0Settings.IsConfigured)
{
    usersGroup.MapGet("/me", async (ClaimsPrincipal user, OlsmakingDbContext dbContext, CancellationToken cancellationToken) =>
    {
        var subject = user.FindFirst("sub")?.Value ?? user.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        if (string.IsNullOrWhiteSpace(subject))
        {
            return Results.Problem(
                statusCode: StatusCodes.Status401Unauthorized,
                title: "Missing subject claim",
                detail: "Authenticated principal does not contain an Auth0 subject claim.");
        }

        var email = user.FindFirst("email")?.Value;
        var nickname = user.FindFirst("nickname")?.Value ?? user.Identity?.Name;
        var now = DateTimeOffset.UtcNow;

        var appUser = await dbContext.AppUsers
            .SingleOrDefaultAsync(x => x.Auth0Subject == subject, cancellationToken);

        if (appUser is null)
        {
            appUser = new AppUser
            {
                Id = Guid.NewGuid(),
                Auth0Subject = subject,
                Email = email,
                Nickname = nickname,
                CreatedUtc = now,
                LastSeenUtc = now,
            };

            dbContext.AppUsers.Add(appUser);
        }
        else
        {
            appUser.Email = email;
            appUser.Nickname = nickname;
            appUser.LastSeenUtc = now;
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        return Results.Ok(new
        {
            Id = appUser.Id,
            Subject = appUser.Auth0Subject,
            Email = appUser.Email,
            Nickname = appUser.Nickname,
            IsAdmin = user.HasAdminScope(),
        });
    }).RequireAuthorization();
}
else
{
    usersGroup.MapGet("/me", AuthUnavailable);
}

app.UseDefaultFiles();
app.UseStaticFiles();

app.MapFallbackToFile("index.html");

app.Run();

static string GetSafeReturnUrl(string? returnUrl)
{
    return string.IsNullOrWhiteSpace(returnUrl)
        || !returnUrl.StartsWith('/')
        || returnUrl.StartsWith("//")
        || returnUrl.StartsWith("/\\")
        ? "/"
        : returnUrl;
}

static IResult AuthUnavailable()
{
    return Results.Problem(
        statusCode: StatusCodes.Status503ServiceUnavailable,
        title: "Authentication is not configured",
        detail: "Set Auth0 settings to enable login, logout, and current-user endpoints.");
}
