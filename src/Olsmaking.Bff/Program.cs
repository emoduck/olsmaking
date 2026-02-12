using System.Security.Claims;
using System.Security.Cryptography;
using System.Text.Json;
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
                if (context.Request.Path.StartsWithSegments("/api")
                    && !context.Request.Path.StartsWithSegments("/api/auth/login"))
                {
                    context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                    context.HandleResponse();
                    return Task.CompletedTask;
                }

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
var eventsGroup = app.MapGroup("/api/events");
var favoritesGroup = app.MapGroup("/api/favorites");

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
            appUser.LastSeenUtc = now;
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        return Results.Ok(CreateCurrentUserResponse(appUser, user));
    }).RequireAuthorization();

    usersGroup.MapPatch("/me", async (JsonElement requestBody, ClaimsPrincipal user, OlsmakingDbContext dbContext, CancellationToken cancellationToken) =>
    {
        if (requestBody.ValueKind != JsonValueKind.Object)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["requestBody"] = ["Request body must be a JSON object."],
            });
        }

        var currentUserResult = await GetCurrentAppUserAsync(user, dbContext, cancellationToken);

        if (currentUserResult.Error is not null)
        {
            return currentUserResult.Error;
        }

        var appUser = currentUserResult.User!;
        var errors = new Dictionary<string, string[]>();

        if (requestBody.TryGetProperty("nickname", out var nicknameElement))
        {
            if (nicknameElement.ValueKind != JsonValueKind.String)
            {
                errors["nickname"] = ["Nickname must be a string."];
            }
            else
            {
                var normalizedNickname = nicknameElement.GetString()?.Trim();

                if (string.IsNullOrWhiteSpace(normalizedNickname))
                {
                    errors["nickname"] = ["Nickname is required."];
                }
                else if (normalizedNickname.Length > 100)
                {
                    errors["nickname"] = ["Nickname must be 100 characters or fewer."];
                }
                else
                {
                    appUser.Nickname = normalizedNickname;
                }
            }
        }

        if (errors.Count > 0)
        {
            return Results.ValidationProblem(errors);
        }

        appUser.LastSeenUtc = DateTimeOffset.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);

        return Results.Ok(CreateCurrentUserResponse(appUser, user));
    }).RequireAuthorization();
}
else
{
    usersGroup.MapGet("/me", AuthUnavailable);
    usersGroup.MapPatch("/me", AuthUnavailable);
}

if (auth0Settings.IsConfigured)
{
    eventsGroup.MapPost("", async (CreateEventRequest request, ClaimsPrincipal user, OlsmakingDbContext dbContext, CancellationToken cancellationToken) =>
    {
        var currentUserResult = await GetCurrentAppUserAsync(user, dbContext, cancellationToken);

        if (currentUserResult.Error is not null)
        {
            return currentUserResult.Error;
        }

        var currentUser = currentUserResult.User!;

        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["name"] = ["Name is required."],
            });
        }

        var name = request.Name.Trim();

        if (name.Length > 200)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["name"] = ["Name must be 200 characters or fewer."],
            });
        }

        var visibility = request.Visibility ?? EventVisibility.Private;
        var isListed = request.IsListed ?? false;

        if (visibility == EventVisibility.Private && isListed)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["isListed"] = ["Private events cannot be listed."],
            });
        }

        var now = DateTimeOffset.UtcNow;
        var @event = new Event
        {
            Id = Guid.NewGuid(),
            OwnerUserId = currentUser.Id,
            Name = name,
            Status = EventStatus.Open,
            Visibility = visibility,
            IsListed = isListed,
            JoinCode = await GenerateUniqueJoinCodeAsync(dbContext, cancellationToken),
            CreatedUtc = now,
            UpdatedUtc = now,
        };

        dbContext.Events.Add(@event);
        dbContext.EventParticipants.Add(new EventParticipant
        {
            Id = Guid.NewGuid(),
            EventId = @event.Id,
            UserId = currentUser.Id,
            Role = EventParticipantRole.Owner,
            Status = EventParticipantStatus.Active,
            JoinedUtc = now,
        });

        await dbContext.SaveChangesAsync(cancellationToken);

        return Results.Created($"/api/events/{@event.Id}", new
        {
            Id = @event.Id,
            Name = @event.Name,
            Status = @event.Status,
            Visibility = @event.Visibility,
            IsListed = @event.IsListed,
            JoinCode = @event.JoinCode,
            OwnerUserId = @event.OwnerUserId,
            CreatedUtc = @event.CreatedUtc,
            UpdatedUtc = @event.UpdatedUtc,
        });
    }).RequireAuthorization();

    eventsGroup.MapGet("/mine", async (ClaimsPrincipal user, OlsmakingDbContext dbContext, CancellationToken cancellationToken) =>
    {
        var currentUserResult = await GetCurrentAppUserAsync(user, dbContext, cancellationToken);

        if (currentUserResult.Error is not null)
        {
            return currentUserResult.Error;
        }

        var currentUser = currentUserResult.User!;

        var events = await dbContext.Events
            .AsNoTracking()
            .Where(x => x.OwnerUserId == currentUser.Id
                || x.Participants.Any(p => p.UserId == currentUser.Id && p.Status == EventParticipantStatus.Active))
            .Select(x => new
            {
                Id = x.Id,
                Name = x.Name,
                Status = x.Status,
                Visibility = x.Visibility,
                IsListed = x.IsListed,
                OwnerUserId = x.OwnerUserId,
                UpdatedUtc = x.UpdatedUtc,
                CreatedUtc = x.CreatedUtc,
            })
            .ToListAsync(cancellationToken);

        events = events
            .OrderByDescending(x => x.UpdatedUtc)
            .ToList();

        return Results.Ok(events);
    }).RequireAuthorization();

    eventsGroup.MapGet("/open", async (ClaimsPrincipal user, OlsmakingDbContext dbContext, CancellationToken cancellationToken) =>
    {
        var currentUserResult = await GetCurrentAppUserAsync(user, dbContext, cancellationToken);

        if (currentUserResult.Error is not null)
        {
            return currentUserResult.Error;
        }

        var currentUser = currentUserResult.User!;

        var events = await dbContext.Events
            .AsNoTracking()
            .Where(x => x.Visibility == EventVisibility.Open
                && x.IsListed
                && x.Status == EventStatus.Open
                && !x.Participants.Any(p => p.UserId == currentUser.Id && p.Status == EventParticipantStatus.Removed))
            .Select(x => new
            {
                Id = x.Id,
                Name = x.Name,
                Status = x.Status,
                Visibility = x.Visibility,
                IsListed = x.IsListed,
                OwnerUserId = x.OwnerUserId,
                UpdatedUtc = x.UpdatedUtc,
                CreatedUtc = x.CreatedUtc,
            })
            .ToListAsync(cancellationToken);

        events = events
            .OrderByDescending(x => x.UpdatedUtc)
            .ToList();

        return Results.Ok(events);
    }).RequireAuthorization();

    eventsGroup.MapGet("/{eventId:guid}", async (Guid eventId, ClaimsPrincipal user, OlsmakingDbContext dbContext, CancellationToken cancellationToken) =>
    {
        var currentUserResult = await GetCurrentAppUserAsync(user, dbContext, cancellationToken);

        if (currentUserResult.Error is not null)
        {
            return currentUserResult.Error;
        }

        var currentUser = currentUserResult.User!;
        var @event = await dbContext.Events
            .AsNoTracking()
            .Include(x => x.Participants)
            .ThenInclude(x => x.User)
            .SingleOrDefaultAsync(x => x.Id == eventId, cancellationToken);

        if (@event is null)
        {
            return Results.NotFound();
        }

        var isAdmin = user.HasAdminScope();
        var isOwner = @event.OwnerUserId == currentUser.Id;
        var hasMemberAccess = @event.Participants.Any(x => x.UserId == currentUser.Id && x.Status == EventParticipantStatus.Active);

        if (!isAdmin && !isOwner && !hasMemberAccess)
        {
            return Results.Forbid();
        }

        return Results.Ok(new
        {
            Id = @event.Id,
            Name = @event.Name,
            Status = @event.Status,
            Visibility = @event.Visibility,
            IsListed = @event.IsListed,
            JoinCode = @event.JoinCode,
            OwnerUserId = @event.OwnerUserId,
            CreatedUtc = @event.CreatedUtc,
            UpdatedUtc = @event.UpdatedUtc,
            CurrentUserRole = isAdmin
                ? "admin"
                : isOwner
                    ? "owner"
                    : "member",
            Participants = @event.Participants
                .OrderBy(x => x.JoinedUtc)
                .Select(x => new
                {
                    x.UserId,
                    x.Role,
                    x.Status,
                    x.JoinedUtc,
                    x.RemovedUtc,
                    x.User.Nickname,
                }),
        });
    }).RequireAuthorization();

    eventsGroup.MapPost("/{eventId:guid}/beers", async (Guid eventId, CreateEventBeerRequest request, ClaimsPrincipal user, OlsmakingDbContext dbContext, CancellationToken cancellationToken) =>
    {
        var currentUserResult = await GetCurrentAppUserAsync(user, dbContext, cancellationToken);

        if (currentUserResult.Error is not null)
        {
            return currentUserResult.Error;
        }

        var currentUser = currentUserResult.User!;
        var eventAccessResult = await GetEventAccessAsync(eventId, currentUser.Id, user.HasAdminScope(), dbContext, cancellationToken);

        if (eventAccessResult.Error is not null)
        {
            return eventAccessResult.Error;
        }

        var errors = new Dictionary<string, string[]>();

        if (string.IsNullOrWhiteSpace(request.Name))
        {
            errors["name"] = ["Name is required."];
        }

        var name = request.Name?.Trim();

        if (!string.IsNullOrWhiteSpace(name) && name.Length > 200)
        {
            errors["name"] = ["Name must be 200 characters or fewer."];
        }

        var brewery = NormalizeOptionalText(request.Brewery);

        if (brewery is not null && brewery.Length > 200)
        {
            errors["brewery"] = ["Brewery must be 200 characters or fewer."];
        }

        var style = NormalizeOptionalText(request.Style);

        if (style is not null && style.Length > 100)
        {
            errors["style"] = ["Style must be 100 characters or fewer."];
        }

        if (request.Abv is < 0 or > 99.99m)
        {
            errors["abv"] = ["ABV must be between 0 and 99.99."];
        }

        if (errors.Count > 0)
        {
            return Results.ValidationProblem(errors);
        }

        var now = DateTimeOffset.UtcNow;
        var eventBeer = new EventBeer
        {
            Id = Guid.NewGuid(),
            EventId = eventAccessResult.Event!.Id,
            Name = name!,
            Brewery = brewery,
            Style = style,
            Abv = request.Abv,
            CreatedUtc = now,
        };

        eventAccessResult.Event.UpdatedUtc = now;
        dbContext.EventBeers.Add(eventBeer);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Results.Created($"/api/events/{eventBeer.EventId}/beers/{eventBeer.Id}", new
        {
            Id = eventBeer.Id,
            EventId = eventBeer.EventId,
            Name = eventBeer.Name,
            Brewery = eventBeer.Brewery,
            Style = eventBeer.Style,
            Abv = eventBeer.Abv,
            CreatedUtc = eventBeer.CreatedUtc,
        });
    }).RequireAuthorization();

    eventsGroup.MapGet("/{eventId:guid}/beers", async (Guid eventId, ClaimsPrincipal user, OlsmakingDbContext dbContext, CancellationToken cancellationToken) =>
    {
        var currentUserResult = await GetCurrentAppUserAsync(user, dbContext, cancellationToken);

        if (currentUserResult.Error is not null)
        {
            return currentUserResult.Error;
        }

        var currentUser = currentUserResult.User!;
        var eventAccessResult = await GetEventAccessAsync(eventId, currentUser.Id, user.HasAdminScope(), dbContext, cancellationToken);

        if (eventAccessResult.Error is not null)
        {
            return eventAccessResult.Error;
        }

        var beers = await dbContext.EventBeers
            .AsNoTracking()
            .Where(x => x.EventId == eventId)
            .OrderBy(x => x.CreatedUtc)
            .Select(x => new
            {
                Id = x.Id,
                EventId = x.EventId,
                Name = x.Name,
                Brewery = x.Brewery,
                Style = x.Style,
                Abv = x.Abv,
                CreatedUtc = x.CreatedUtc,
            })
            .ToListAsync(cancellationToken);

        return Results.Ok(beers);
    }).RequireAuthorization();

    eventsGroup.MapGet("/{eventId:guid}/favorites/me", async (Guid eventId, ClaimsPrincipal user, OlsmakingDbContext dbContext, CancellationToken cancellationToken) =>
    {
        var currentUserResult = await GetCurrentAppUserAsync(user, dbContext, cancellationToken);

        if (currentUserResult.Error is not null)
        {
            return currentUserResult.Error;
        }

        var currentUser = currentUserResult.User!;
        var eventAccessResult = await GetEventAccessAsync(eventId, currentUser.Id, user.HasAdminScope(), dbContext, cancellationToken);

        if (eventAccessResult.Error is not null)
        {
            return eventAccessResult.Error;
        }

        var favoriteBeerIds = await dbContext.BeerFavorites
            .AsNoTracking()
            .Where(x => x.EventId == eventId && x.UserId == currentUser.Id)
            .OrderBy(x => x.BeerId)
            .Select(x => x.BeerId)
            .ToListAsync(cancellationToken);

        return Results.Ok(favoriteBeerIds);
    }).RequireAuthorization();

    favoritesGroup.MapGet("/mine", async (ClaimsPrincipal user, OlsmakingDbContext dbContext, CancellationToken cancellationToken) =>
    {
        var currentUserResult = await GetCurrentAppUserAsync(user, dbContext, cancellationToken);

        if (currentUserResult.Error is not null)
        {
            return currentUserResult.Error;
        }

        var currentUser = currentUserResult.User!;
        var isAdmin = user.HasAdminScope();

        var favorites = await dbContext.BeerFavorites
            .AsNoTracking()
            .Where(x => x.UserId == currentUser.Id
                && (isAdmin
                    || x.Event.OwnerUserId == currentUser.Id
                    || x.Event.Participants.Any(p => p.UserId == currentUser.Id && p.Status == EventParticipantStatus.Active)))
            .Select(x => new
            {
                EventId = x.EventId,
                EventName = x.Event.Name,
                BeerId = x.BeerId,
                BeerName = x.Beer.Name,
                Brewery = x.Beer.Brewery,
                Style = x.Beer.Style,
                Abv = x.Beer.Abv,
                FavoritedUtc = x.CreatedUtc,
                EventStatus = x.Event.Status,
            })
            .ToListAsync(cancellationToken);

        favorites = favorites
            .OrderByDescending(x => x.FavoritedUtc)
            .ToList();

        return Results.Ok(favorites);
    }).RequireAuthorization();

    eventsGroup.MapPost("/{eventId:guid}/beers/{beerId:guid}/favorite", async (Guid eventId, Guid beerId, ClaimsPrincipal user, OlsmakingDbContext dbContext, CancellationToken cancellationToken) =>
    {
        var currentUserResult = await GetCurrentAppUserAsync(user, dbContext, cancellationToken);

        if (currentUserResult.Error is not null)
        {
            return currentUserResult.Error;
        }

        var currentUser = currentUserResult.User!;
        var eventAccessResult = await GetEventAccessAsync(eventId, currentUser.Id, user.HasAdminScope(), dbContext, cancellationToken);

        if (eventAccessResult.Error is not null)
        {
            return eventAccessResult.Error;
        }

        var beerExists = await dbContext.EventBeers
            .AsNoTracking()
            .AnyAsync(x => x.Id == beerId && x.EventId == eventId, cancellationToken);

        if (!beerExists)
        {
            return Results.NotFound();
        }

        var favorite = new BeerFavorite
        {
            Id = Guid.NewGuid(),
            EventId = eventId,
            BeerId = beerId,
            UserId = currentUser.Id,
            CreatedUtc = DateTimeOffset.UtcNow,
        };

        dbContext.BeerFavorites.Add(favorite);

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            var existingFavorite = await dbContext.BeerFavorites
                .AsNoTracking()
                .AnyAsync(x => x.UserId == currentUser.Id && x.BeerId == beerId, cancellationToken);

            if (!existingFavorite)
            {
                throw;
            }
        }

        return Results.NoContent();
    }).RequireAuthorization();

    eventsGroup.MapDelete("/{eventId:guid}/beers/{beerId:guid}/favorite", async (Guid eventId, Guid beerId, ClaimsPrincipal user, OlsmakingDbContext dbContext, CancellationToken cancellationToken) =>
    {
        var currentUserResult = await GetCurrentAppUserAsync(user, dbContext, cancellationToken);

        if (currentUserResult.Error is not null)
        {
            return currentUserResult.Error;
        }

        var currentUser = currentUserResult.User!;
        var eventAccessResult = await GetEventAccessAsync(eventId, currentUser.Id, user.HasAdminScope(), dbContext, cancellationToken);

        if (eventAccessResult.Error is not null)
        {
            return eventAccessResult.Error;
        }

        var beerExists = await dbContext.EventBeers
            .AsNoTracking()
            .AnyAsync(x => x.Id == beerId && x.EventId == eventId, cancellationToken);

        if (!beerExists)
        {
            return Results.NotFound();
        }

        var favorite = await dbContext.BeerFavorites
            .SingleOrDefaultAsync(x => x.EventId == eventId && x.BeerId == beerId && x.UserId == currentUser.Id, cancellationToken);

        if (favorite is null)
        {
            return Results.NoContent();
        }

        dbContext.BeerFavorites.Remove(favorite);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Results.NoContent();
    }).RequireAuthorization();

    eventsGroup.MapPost("/{eventId:guid}/beers/{beerId:guid}/reviews", async (Guid eventId, Guid beerId, CreateBeerReviewRequest request, ClaimsPrincipal user, OlsmakingDbContext dbContext, CancellationToken cancellationToken) =>
    {
        var currentUserResult = await GetCurrentAppUserAsync(user, dbContext, cancellationToken);

        if (currentUserResult.Error is not null)
        {
            return currentUserResult.Error;
        }

        var currentUser = currentUserResult.User!;
        var eventAccessResult = await GetEventAccessAsync(eventId, currentUser.Id, user.HasAdminScope(), dbContext, cancellationToken);

        if (eventAccessResult.Error is not null)
        {
            return eventAccessResult.Error;
        }

        if (eventAccessResult.Event!.Status == EventStatus.Closed && !eventAccessResult.IsAdminOrOwner)
        {
            return Results.Problem(
                statusCode: StatusCodes.Status409Conflict,
                title: "Review updates are blocked",
                detail: "This event is closed, so members cannot create or update reviews.");
        }

        if (request.Rating is null or < 1 or > 6)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["rating"] = ["Rating must be an integer between 1 and 6."],
            });
        }

        var beerExists = await dbContext.EventBeers
            .AsNoTracking()
            .AnyAsync(x => x.Id == beerId && x.EventId == eventId, cancellationToken);

        if (!beerExists)
        {
            return Results.NotFound();
        }

        var review = new BeerReview
        {
            Id = Guid.NewGuid(),
            EventId = eventId,
            BeerId = beerId,
            UserId = currentUser.Id,
            Rating = request.Rating.Value,
            Notes = NormalizeOptionalText(request.Notes),
            AromaNotes = NormalizeOptionalText(request.AromaNotes),
            AppearanceNotes = NormalizeOptionalText(request.AppearanceNotes),
            FlavorNotes = NormalizeOptionalText(request.FlavorNotes),
            CreatedUtc = DateTimeOffset.UtcNow,
            UpdatedUtc = DateTimeOffset.UtcNow,
        };

        dbContext.BeerReviews.Add(review);

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            var existingReview = await dbContext.BeerReviews
                .AsNoTracking()
                .AnyAsync(x => x.EventId == eventId && x.BeerId == beerId && x.UserId == currentUser.Id, cancellationToken);

            if (existingReview)
            {
                return Results.Problem(
                    statusCode: StatusCodes.Status409Conflict,
                    title: "Review already exists",
                    detail: "Only one review per user, beer, and event is allowed.");
            }

            throw;
        }

        return Results.Created($"/api/events/{eventId}/beers/{beerId}/reviews/me", new
        {
            Id = review.Id,
            EventId = review.EventId,
            BeerId = review.BeerId,
            UserId = review.UserId,
            Rating = review.Rating,
            Notes = review.Notes,
            AromaNotes = review.AromaNotes,
            AppearanceNotes = review.AppearanceNotes,
            FlavorNotes = review.FlavorNotes,
            CreatedUtc = review.CreatedUtc,
            UpdatedUtc = review.UpdatedUtc,
        });
    }).RequireAuthorization();

    eventsGroup.MapGet("/{eventId:guid}/beers/{beerId:guid}/reviews/me", async (Guid eventId, Guid beerId, ClaimsPrincipal user, OlsmakingDbContext dbContext, CancellationToken cancellationToken) =>
    {
        var currentUserResult = await GetCurrentAppUserAsync(user, dbContext, cancellationToken);

        if (currentUserResult.Error is not null)
        {
            return currentUserResult.Error;
        }

        var currentUser = currentUserResult.User!;
        var eventAccessResult = await GetEventAccessAsync(eventId, currentUser.Id, user.HasAdminScope(), dbContext, cancellationToken);

        if (eventAccessResult.Error is not null)
        {
            return eventAccessResult.Error;
        }

        var beerExists = await dbContext.EventBeers
            .AsNoTracking()
            .AnyAsync(x => x.Id == beerId && x.EventId == eventId, cancellationToken);

        if (!beerExists)
        {
            return Results.NotFound();
        }

        var review = await dbContext.BeerReviews
            .AsNoTracking()
            .SingleOrDefaultAsync(x => x.EventId == eventId && x.BeerId == beerId && x.UserId == currentUser.Id, cancellationToken);

        if (review is null)
        {
            return Results.NotFound();
        }

        return Results.Ok(new
        {
            Id = review.Id,
            EventId = review.EventId,
            BeerId = review.BeerId,
            UserId = review.UserId,
            Rating = review.Rating,
            Notes = review.Notes,
            AromaNotes = review.AromaNotes,
            AppearanceNotes = review.AppearanceNotes,
            FlavorNotes = review.FlavorNotes,
            CreatedUtc = review.CreatedUtc,
            UpdatedUtc = review.UpdatedUtc,
        });
    }).RequireAuthorization();

    eventsGroup.MapPatch("/{eventId:guid}/beers/{beerId:guid}/reviews/me", async (Guid eventId, Guid beerId, JsonElement requestBody, ClaimsPrincipal user, OlsmakingDbContext dbContext, CancellationToken cancellationToken) =>
    {
        var currentUserResult = await GetCurrentAppUserAsync(user, dbContext, cancellationToken);

        if (currentUserResult.Error is not null)
        {
            return currentUserResult.Error;
        }

        var currentUser = currentUserResult.User!;
        var eventAccessResult = await GetEventAccessAsync(eventId, currentUser.Id, user.HasAdminScope(), dbContext, cancellationToken);

        if (eventAccessResult.Error is not null)
        {
            return eventAccessResult.Error;
        }

        if (eventAccessResult.Event!.Status == EventStatus.Closed && !eventAccessResult.IsAdminOrOwner)
        {
            return Results.Problem(
                statusCode: StatusCodes.Status409Conflict,
                title: "Review updates are blocked",
                detail: "This event is closed, so members cannot create or update reviews.");
        }

        var beerExists = await dbContext.EventBeers
            .AsNoTracking()
            .AnyAsync(x => x.Id == beerId && x.EventId == eventId, cancellationToken);

        if (!beerExists)
        {
            return Results.NotFound();
        }

        var review = await dbContext.BeerReviews
            .SingleOrDefaultAsync(x => x.EventId == eventId && x.BeerId == beerId && x.UserId == currentUser.Id, cancellationToken);

        if (review is null)
        {
            return Results.NotFound();
        }

        if (requestBody.ValueKind != JsonValueKind.Object)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["requestBody"] = ["Request body must be a JSON object."],
            });
        }

        var errors = new Dictionary<string, string[]>();
        var changed = false;

        if (requestBody.TryGetProperty("rating", out var ratingElement))
        {
            if (ratingElement.ValueKind == JsonValueKind.Null)
            {
                errors["rating"] = ["Rating must be an integer between 1 and 6."];
            }
            else if (!ratingElement.TryGetInt32(out var rating) || rating is < 1 or > 6)
            {
                errors["rating"] = ["Rating must be an integer between 1 and 6."];
            }
            else if (review.Rating != rating)
            {
                review.Rating = rating;
                changed = true;
            }
        }

        changed |= TryApplyNullableTextPatch(requestBody, "notes", value => review.Notes = value, review.Notes, errors);
        changed |= TryApplyNullableTextPatch(requestBody, "aromaNotes", value => review.AromaNotes = value, review.AromaNotes, errors);
        changed |= TryApplyNullableTextPatch(requestBody, "appearanceNotes", value => review.AppearanceNotes = value, review.AppearanceNotes, errors);
        changed |= TryApplyNullableTextPatch(requestBody, "flavorNotes", value => review.FlavorNotes = value, review.FlavorNotes, errors);

        if (errors.Count > 0)
        {
            return Results.ValidationProblem(errors);
        }

        if (changed)
        {
            review.UpdatedUtc = DateTimeOffset.UtcNow;
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        return Results.Ok(new
        {
            Id = review.Id,
            EventId = review.EventId,
            BeerId = review.BeerId,
            UserId = review.UserId,
            Rating = review.Rating,
            Notes = review.Notes,
            AromaNotes = review.AromaNotes,
            AppearanceNotes = review.AppearanceNotes,
            FlavorNotes = review.FlavorNotes,
            CreatedUtc = review.CreatedUtc,
            UpdatedUtc = review.UpdatedUtc,
        });
    }).RequireAuthorization();

    eventsGroup.MapPost("/{eventId:guid}/join", async (Guid eventId, JoinEventRequest? request, ClaimsPrincipal user, OlsmakingDbContext dbContext, CancellationToken cancellationToken) =>
    {
        var currentUserResult = await GetCurrentAppUserAsync(user, dbContext, cancellationToken);

        if (currentUserResult.Error is not null)
        {
            return currentUserResult.Error;
        }

        var currentUser = currentUserResult.User!;
        var @event = await dbContext.Events.SingleOrDefaultAsync(x => x.Id == eventId, cancellationToken);

        if (@event is null)
        {
            return Results.NotFound();
        }

        if (@event.Status != EventStatus.Open)
        {
            return Results.Problem(
                statusCode: StatusCodes.Status409Conflict,
                title: "Joining is not allowed",
                detail: "This event is not open for joining.");
        }

        var existingParticipant = await dbContext.EventParticipants
            .SingleOrDefaultAsync(x => x.EventId == eventId && x.UserId == currentUser.Id, cancellationToken);

        if (existingParticipant is not null)
        {
            if (existingParticipant.Status == EventParticipantStatus.Removed)
            {
                return Results.Forbid();
            }

            return Results.Ok(new
            {
                EventId = @event.Id,
                UserId = currentUser.Id,
                Joined = false,
            });
        }

        if (string.IsNullOrWhiteSpace(request?.JoinCode))
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["joinCode"] = ["Join code is required."],
            });
        }

        var providedJoinCode = request.JoinCode.Trim();

        if (!string.Equals(@event.JoinCode, providedJoinCode, StringComparison.OrdinalIgnoreCase))
        {
            return Results.Problem(
                statusCode: StatusCodes.Status403Forbidden,
                title: "Invalid join code",
                detail: "The supplied join code is not valid for this event.");
        }

        dbContext.EventParticipants.Add(new EventParticipant
        {
            Id = Guid.NewGuid(),
            EventId = @event.Id,
            UserId = currentUser.Id,
            Role = EventParticipantRole.Member,
            Status = EventParticipantStatus.Active,
            JoinedUtc = DateTimeOffset.UtcNow,
        });

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            var participantAfterConflict = await dbContext.EventParticipants
                .AsNoTracking()
                .SingleOrDefaultAsync(x => x.EventId == @event.Id && x.UserId == currentUser.Id, cancellationToken);

            if (participantAfterConflict?.Status == EventParticipantStatus.Active)
            {
                return Results.Ok(new
                {
                    EventId = @event.Id,
                    UserId = currentUser.Id,
                    Joined = false,
                });
            }

            throw;
        }

        return Results.Ok(new
        {
            EventId = @event.Id,
            UserId = currentUser.Id,
            Joined = true,
        });
    }).RequireAuthorization();

    eventsGroup.MapPost("/{eventId:guid}/regenerate-code", async (Guid eventId, ClaimsPrincipal user, OlsmakingDbContext dbContext, CancellationToken cancellationToken) =>
    {
        var currentUserResult = await GetCurrentAppUserAsync(user, dbContext, cancellationToken);

        if (currentUserResult.Error is not null)
        {
            return currentUserResult.Error;
        }

        var currentUser = currentUserResult.User!;
        var @event = await dbContext.Events.SingleOrDefaultAsync(x => x.Id == eventId, cancellationToken);

        if (@event is null)
        {
            return Results.NotFound();
        }

        if (!user.HasAdminScope() && @event.OwnerUserId != currentUser.Id)
        {
            return Results.Forbid();
        }

        @event.JoinCode = await GenerateUniqueJoinCodeAsync(dbContext, cancellationToken);
        @event.UpdatedUtc = DateTimeOffset.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);

        return Results.Ok(new
        {
            EventId = @event.Id,
            JoinCode = @event.JoinCode,
        });
    }).RequireAuthorization();

    eventsGroup.MapPatch("/{eventId:guid}/status", async (Guid eventId, UpdateEventStatusRequest request, ClaimsPrincipal user, OlsmakingDbContext dbContext, CancellationToken cancellationToken) =>
    {
        var currentUserResult = await GetCurrentAppUserAsync(user, dbContext, cancellationToken);

        if (currentUserResult.Error is not null)
        {
            return currentUserResult.Error;
        }

        var currentUser = currentUserResult.User!;
        var @event = await dbContext.Events.SingleOrDefaultAsync(x => x.Id == eventId, cancellationToken);

        if (@event is null)
        {
            return Results.NotFound();
        }

        if (!user.HasAdminScope() && @event.OwnerUserId != currentUser.Id)
        {
            return Results.Forbid();
        }

        if (!Enum.TryParse<EventStatus>(request.Status, ignoreCase: true, out var requestedStatus)
            || (requestedStatus != EventStatus.Open && requestedStatus != EventStatus.Closed))
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["status"] = ["Status must be either 'open' or 'closed'."],
            });
        }

        if (@event.Status != EventStatus.Open && @event.Status != EventStatus.Closed)
        {
            return Results.Problem(
                statusCode: StatusCodes.Status409Conflict,
                title: "Status transition is not allowed",
                detail: "This event status cannot be changed through the MVP status endpoint.");
        }

        if (@event.Status != requestedStatus)
        {
            @event.Status = requestedStatus;
            @event.UpdatedUtc = DateTimeOffset.UtcNow;
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        return Results.Ok(new
        {
            EventId = @event.Id,
            Status = @event.Status,
            UpdatedUtc = @event.UpdatedUtc,
        });
    }).RequireAuthorization();

    eventsGroup.MapPost("/{eventId:guid}/participants/{userId:guid}/restore", async (Guid eventId, Guid userId, ClaimsPrincipal user, OlsmakingDbContext dbContext, CancellationToken cancellationToken) =>
    {
        var currentUserResult = await GetCurrentAppUserAsync(user, dbContext, cancellationToken);

        if (currentUserResult.Error is not null)
        {
            return currentUserResult.Error;
        }

        var currentUser = currentUserResult.User!;
        var @event = await dbContext.Events.SingleOrDefaultAsync(x => x.Id == eventId, cancellationToken);

        if (@event is null)
        {
            return Results.NotFound();
        }

        if (!user.HasAdminScope() && @event.OwnerUserId != currentUser.Id)
        {
            return Results.Forbid();
        }

        if (userId == @event.OwnerUserId)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["userId"] = ["Owner cannot be restored through this endpoint."],
            });
        }

        var participant = await dbContext.EventParticipants
            .SingleOrDefaultAsync(x => x.EventId == @event.Id && x.UserId == userId, cancellationToken);

        if (participant is null)
        {
            return Results.NotFound();
        }

        if (participant.Status != EventParticipantStatus.Removed)
        {
            return Results.Problem(
                statusCode: StatusCodes.Status409Conflict,
                title: "Participant is not removed",
                detail: "Only removed participants can be restored.");
        }

        participant.Status = EventParticipantStatus.Active;
        participant.RemovedUtc = null;
        @event.UpdatedUtc = DateTimeOffset.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);

        return Results.NoContent();
    }).RequireAuthorization();

    eventsGroup.MapDelete("/{eventId:guid}/participants/{userId:guid}", async (Guid eventId, Guid userId, ClaimsPrincipal user, OlsmakingDbContext dbContext, CancellationToken cancellationToken) =>
    {
        var currentUserResult = await GetCurrentAppUserAsync(user, dbContext, cancellationToken);

        if (currentUserResult.Error is not null)
        {
            return currentUserResult.Error;
        }

        var currentUser = currentUserResult.User!;
        var @event = await dbContext.Events.SingleOrDefaultAsync(x => x.Id == eventId, cancellationToken);

        if (@event is null)
        {
            return Results.NotFound();
        }

        if (!user.HasAdminScope() && @event.OwnerUserId != currentUser.Id)
        {
            return Results.Forbid();
        }

        if (userId == @event.OwnerUserId)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["userId"] = ["Owner cannot be removed from the event."],
            });
        }

        var participant = await dbContext.EventParticipants
            .SingleOrDefaultAsync(x => x.EventId == @event.Id && x.UserId == userId, cancellationToken);

        if (participant is null)
        {
            return Results.NotFound();
        }

        if (participant.Status == EventParticipantStatus.Removed)
        {
            return Results.NoContent();
        }

        participant.Status = EventParticipantStatus.Removed;
        participant.RemovedUtc = DateTimeOffset.UtcNow;
        @event.UpdatedUtc = DateTimeOffset.UtcNow;

        await dbContext.SaveChangesAsync(cancellationToken);

        return Results.NoContent();
    }).RequireAuthorization();
}
else
{
    eventsGroup.MapPost("", AuthUnavailable);
    eventsGroup.MapGet("/mine", AuthUnavailable);
    eventsGroup.MapGet("/open", AuthUnavailable);
    eventsGroup.MapGet("/{eventId:guid}", AuthUnavailable);
    eventsGroup.MapPost("/{eventId:guid}/beers", AuthUnavailable);
    eventsGroup.MapGet("/{eventId:guid}/beers", AuthUnavailable);
    eventsGroup.MapGet("/{eventId:guid}/favorites/me", AuthUnavailable);
    favoritesGroup.MapGet("/mine", AuthUnavailable);
    eventsGroup.MapPost("/{eventId:guid}/beers/{beerId:guid}/favorite", AuthUnavailable);
    eventsGroup.MapDelete("/{eventId:guid}/beers/{beerId:guid}/favorite", AuthUnavailable);
    eventsGroup.MapPost("/{eventId:guid}/beers/{beerId:guid}/reviews", AuthUnavailable);
    eventsGroup.MapGet("/{eventId:guid}/beers/{beerId:guid}/reviews/me", AuthUnavailable);
    eventsGroup.MapPatch("/{eventId:guid}/beers/{beerId:guid}/reviews/me", AuthUnavailable);
    eventsGroup.MapPost("/{eventId:guid}/join", AuthUnavailable);
    eventsGroup.MapPost("/{eventId:guid}/regenerate-code", AuthUnavailable);
    eventsGroup.MapPatch("/{eventId:guid}/status", AuthUnavailable);
    eventsGroup.MapPost("/{eventId:guid}/participants/{userId:guid}/restore", AuthUnavailable);
    eventsGroup.MapDelete("/{eventId:guid}/participants/{userId:guid}", AuthUnavailable);
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

static async Task<(AppUser? User, IResult? Error)> GetCurrentAppUserAsync(
    ClaimsPrincipal user,
    OlsmakingDbContext dbContext,
    CancellationToken cancellationToken)
{
    var subject = user.FindFirst("sub")?.Value ?? user.FindFirst(ClaimTypes.NameIdentifier)?.Value;

    if (string.IsNullOrWhiteSpace(subject))
    {
        return (
            null,
            Results.Problem(
                statusCode: StatusCodes.Status401Unauthorized,
                title: "Missing subject claim",
                detail: "Authenticated principal does not contain an Auth0 subject claim."));
    }

    var appUser = await dbContext.AppUsers
        .SingleOrDefaultAsync(x => x.Auth0Subject == subject, cancellationToken);

    if (appUser is not null)
    {
        return (appUser, null);
    }

    var now = DateTimeOffset.UtcNow;
    appUser = new AppUser
    {
        Id = Guid.NewGuid(),
        Auth0Subject = subject,
        Email = user.FindFirst("email")?.Value,
        Nickname = user.FindFirst("nickname")?.Value ?? user.Identity?.Name,
        CreatedUtc = now,
        LastSeenUtc = now,
    };

    dbContext.AppUsers.Add(appUser);
    await dbContext.SaveChangesAsync(cancellationToken);

    return (appUser, null);
}

static async Task<string> GenerateUniqueJoinCodeAsync(OlsmakingDbContext dbContext, CancellationToken cancellationToken)
{
    const string alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    for (var attempt = 0; attempt < 10; attempt++)
    {
        var joinCode = RandomNumberGenerator.GetString(alphabet, 8);
        var exists = await dbContext.Events.AnyAsync(x => x.JoinCode == joinCode, cancellationToken);

        if (!exists)
        {
            return joinCode;
        }
    }

    throw new InvalidOperationException("Unable to generate a unique join code.");
}

static async Task<(Event? Event, bool IsAdminOrOwner, IResult? Error)> GetEventAccessAsync(
    Guid eventId,
    Guid currentUserId,
    bool isAdmin,
    OlsmakingDbContext dbContext,
    CancellationToken cancellationToken)
{
    var @event = await dbContext.Events
        .SingleOrDefaultAsync(x => x.Id == eventId, cancellationToken);

    if (@event is null)
    {
        return (null, false, Results.NotFound());
    }

    var isOwner = @event.OwnerUserId == currentUserId;

    if (isAdmin || isOwner)
    {
        return (@event, true, null);
    }

    var participant = await dbContext.EventParticipants
        .AsNoTracking()
        .SingleOrDefaultAsync(x => x.EventId == eventId && x.UserId == currentUserId, cancellationToken);

    if (participant is null || participant.Status != EventParticipantStatus.Active)
    {
        return (null, false, Results.Forbid());
    }

    return (@event, false, null);
}

static string? NormalizeOptionalText(string? value)
{
    return string.IsNullOrWhiteSpace(value)
        ? null
        : value.Trim();
}

static bool TryApplyNullableTextPatch(
    JsonElement requestBody,
    string propertyName,
    Action<string?> assign,
    string? currentValue,
    Dictionary<string, string[]> errors)
{
    if (!requestBody.TryGetProperty(propertyName, out var propertyValue))
    {
        return false;
    }

    if (propertyValue.ValueKind != JsonValueKind.Null && propertyValue.ValueKind != JsonValueKind.String)
    {
        errors[propertyName] = ["Must be a string or null."];
        return false;
    }

    var nextValue = propertyValue.ValueKind == JsonValueKind.Null
        ? null
        : NormalizeOptionalText(propertyValue.GetString());

    if (string.Equals(nextValue, currentValue, StringComparison.Ordinal))
    {
        return false;
    }

    assign(nextValue);
    return true;
}

static object CreateCurrentUserResponse(AppUser appUser, ClaimsPrincipal user)
{
    return new
    {
        Id = appUser.Id,
        Subject = appUser.Auth0Subject,
        Email = appUser.Email,
        Nickname = appUser.Nickname,
        IsAdmin = user.HasAdminScope(),
    };
}

internal sealed record CreateEventRequest(string? Name, EventVisibility? Visibility, bool? IsListed);

internal sealed record JoinEventRequest(string? JoinCode);

internal sealed record CreateEventBeerRequest(string? Name, string? Brewery, string? Style, decimal? Abv);

internal sealed record CreateBeerReviewRequest(int? Rating, string? Notes, string? AromaNotes, string? AppearanceNotes, string? FlavorNotes);

internal sealed record UpdateEventStatusRequest(string? Status);

public partial class Program
{
}
