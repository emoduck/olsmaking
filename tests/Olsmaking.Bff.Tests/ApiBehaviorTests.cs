using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Olsmaking.Bff.Data;
using Olsmaking.Bff.Domain;
using Olsmaking.Bff.Tests.Infrastructure;
using Xunit;

namespace Olsmaking.Bff.Tests;

public sealed class ApiBehaviorTests
{
    [Fact]
    public async Task Health_ReturnsOk()
    {
        using var factory = new OlsmakingApiFactory(auth0Configured: false);
        using var client = factory.CreateClient();

        using var response = await client.GetAsync("/api/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task AuthEndpoints_Return503_WhenAuth0IsUnconfigured()
    {
        using var factory = new OlsmakingApiFactory(auth0Configured: false);
        using var client = factory.CreateClient();

        using var loginResponse = await client.GetAsync("/api/auth/login");
        using var meResponse = await client.GetAsync("/api/users/me");
        using var myEventsResponse = await client.GetAsync("/api/events/mine");
        using var openEventsResponse = await client.GetAsync("/api/events/open");

        Assert.Equal(HttpStatusCode.ServiceUnavailable, loginResponse.StatusCode);
        Assert.Equal(HttpStatusCode.ServiceUnavailable, meResponse.StatusCode);
        Assert.Equal(HttpStatusCode.ServiceUnavailable, myEventsResponse.StatusCode);
        Assert.Equal(HttpStatusCode.ServiceUnavailable, openEventsResponse.StatusCode);
    }

    [Fact]
    public async Task FavoritesMine_Returns503_WhenAuth0IsUnconfigured()
    {
        using var factory = new OlsmakingApiFactory(auth0Configured: false);
        using var client = factory.CreateClient();

        using var myFavoritesResponse = await client.GetAsync("/api/favorites/mine");

        Assert.Equal(HttpStatusCode.ServiceUnavailable, myFavoritesResponse.StatusCode);
    }

    [Fact]
    public async Task PatchMe_Returns503_WhenAuth0IsUnconfigured()
    {
        using var factory = new OlsmakingApiFactory(auth0Configured: false);
        using var client = factory.CreateClient();

        using var response = await client.PatchAsJsonAsync(
            "/api/users/me",
            new
            {
                nickname = "Updated Name",
            });

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
    }

    [Fact]
    public async Task PatchMe_UpdatesNickname_AndReturnsCurrentUser()
    {
        using var factory = new OlsmakingApiFactory(auth0Configured: true);
        using var client = factory.CreateClient();

        using var getMeResponse = await SendAsUserAsync(
            client,
            HttpMethod.Get,
            "/api/users/me",
            "profile-sub");

        Assert.Equal(HttpStatusCode.OK, getMeResponse.StatusCode);
        var mePayload = await getMeResponse.Content.ReadFromJsonAsync<JsonElement>();
        var userId = mePayload.GetProperty("id").GetGuid();

        var baselineLastSeenUtc = new DateTimeOffset(2020, 01, 01, 00, 00, 00, TimeSpan.Zero);

        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<OlsmakingDbContext>();
            var appUser = await dbContext.AppUsers.SingleAsync(x => x.Id == userId);
            appUser.LastSeenUtc = baselineLastSeenUtc;
            await dbContext.SaveChangesAsync();
        }

        using var patchResponse = await SendAsUserAsync(
            client,
            HttpMethod.Patch,
            "/api/users/me",
            "profile-sub",
            new
            {
                nickname = "  Updated Nickname  ",
            });

        Assert.Equal(HttpStatusCode.OK, patchResponse.StatusCode);
        var patchPayload = await patchResponse.Content.ReadFromJsonAsync<JsonElement>();

        Assert.Equal(userId, patchPayload.GetProperty("id").GetGuid());
        Assert.Equal("profile-sub@example.com", patchPayload.GetProperty("email").GetString());
        Assert.Equal("Updated Nickname", patchPayload.GetProperty("nickname").GetString());

        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<OlsmakingDbContext>();
            var appUser = await dbContext.AppUsers.SingleAsync(x => x.Id == userId);

            Assert.Equal("Updated Nickname", appUser.Nickname);
            Assert.True(appUser.LastSeenUtc > baselineLastSeenUtc);
        }
    }

    [Fact]
    public async Task PatchMe_Returns400_ForInvalidNickname()
    {
        using var factory = new OlsmakingApiFactory(auth0Configured: true);
        using var client = factory.CreateClient();

        using var emptyNicknameResponse = await SendAsUserAsync(
            client,
            HttpMethod.Patch,
            "/api/users/me",
            "invalid-profile-sub",
            new
            {
                nickname = "   ",
            });

        Assert.Equal(HttpStatusCode.BadRequest, emptyNicknameResponse.StatusCode);

        using var tooLongNicknameResponse = await SendAsUserAsync(
            client,
            HttpMethod.Patch,
            "/api/users/me",
            "invalid-profile-sub",
            new
            {
                nickname = new string('n', 101),
            });

        Assert.Equal(HttpStatusCode.BadRequest, tooLongNicknameResponse.StatusCode);
    }

    [Fact]
    public async Task EventsMine_ReturnsOwnedEvents_ForAuthenticatedUser()
    {
        using var factory = new OlsmakingApiFactory(auth0Configured: true);
        using var client = factory.CreateClient();

        using var firstCreateResponse = await SendAsUserAsync(
            client,
            HttpMethod.Post,
            "/api/events",
            "owner-sub",
            new
            {
                name = "Older event",
            });

        Assert.Equal(HttpStatusCode.Created, firstCreateResponse.StatusCode);
        var firstEvent = await firstCreateResponse.Content.ReadFromJsonAsync<JsonElement>();

        using var secondCreateResponse = await SendAsUserAsync(
            client,
            HttpMethod.Post,
            "/api/events",
            "owner-sub",
            new
            {
                name = "Newer event",
            });

        Assert.Equal(HttpStatusCode.Created, secondCreateResponse.StatusCode);
        var secondEvent = await secondCreateResponse.Content.ReadFromJsonAsync<JsonElement>();

        using var myEventsResponse = await SendAsUserAsync(
            client,
            HttpMethod.Get,
            "/api/events/mine",
            "owner-sub");

        Assert.Equal(HttpStatusCode.OK, myEventsResponse.StatusCode);
        var events = await myEventsResponse.Content.ReadFromJsonAsync<JsonElement>();

        Assert.Equal(JsonValueKind.Array, events.ValueKind);
        Assert.Equal(2, events.GetArrayLength());

        var newest = events[0];
        var older = events[1];

        Assert.Equal(secondEvent.GetProperty("id").GetGuid(), newest.GetProperty("id").GetGuid());
        Assert.Equal(firstEvent.GetProperty("id").GetGuid(), older.GetProperty("id").GetGuid());

        Assert.Equal("Newer event", newest.GetProperty("name").GetString());
        Assert.True(newest.TryGetProperty("status", out _));
        Assert.True(newest.TryGetProperty("visibility", out _));
        Assert.True(newest.TryGetProperty("isListed", out _));
        Assert.True(newest.TryGetProperty("ownerUserId", out _));
        Assert.True(newest.TryGetProperty("updatedUtc", out _));
        Assert.True(newest.TryGetProperty("createdUtc", out _));
        Assert.False(newest.TryGetProperty("joinCode", out _));
    }

    [Fact]
    public async Task EventsOpen_ReturnsListedOpenEvents_ForAuthenticatedUser()
    {
        using var factory = new OlsmakingApiFactory(auth0Configured: true);
        using var client = factory.CreateClient();

        using var createOpenListedEventResponse = await SendAsUserAsync(
            client,
            HttpMethod.Post,
            "/api/events",
            "owner-sub",
            new
            {
                name = "Discoverable Event",
                visibility = EventVisibility.Open,
                isListed = true,
            });

        Assert.Equal(HttpStatusCode.Created, createOpenListedEventResponse.StatusCode);
        var createdEvent = await createOpenListedEventResponse.Content.ReadFromJsonAsync<JsonElement>();
        var createdEventId = createdEvent.GetProperty("id").GetGuid();

        using var openEventsResponse = await SendAsUserAsync(
            client,
            HttpMethod.Get,
            "/api/events/open",
            "seeker-sub");

        Assert.Equal(HttpStatusCode.OK, openEventsResponse.StatusCode);
        var events = await openEventsResponse.Content.ReadFromJsonAsync<JsonElement>();

        Assert.Equal(JsonValueKind.Array, events.ValueKind);
        Assert.Single(events.EnumerateArray());

        var discoverableEvent = events[0];
        Assert.Equal(createdEventId, discoverableEvent.GetProperty("id").GetGuid());
        Assert.Equal("Discoverable Event", discoverableEvent.GetProperty("name").GetString());
        Assert.Equal((int)EventStatus.Open, discoverableEvent.GetProperty("status").GetInt32());
        Assert.Equal((int)EventVisibility.Open, discoverableEvent.GetProperty("visibility").GetInt32());
        Assert.True(discoverableEvent.GetProperty("isListed").GetBoolean());
        Assert.True(discoverableEvent.TryGetProperty("ownerUserId", out _));
        Assert.True(discoverableEvent.TryGetProperty("updatedUtc", out _));
        Assert.True(discoverableEvent.TryGetProperty("createdUtc", out _));
        Assert.False(discoverableEvent.TryGetProperty("joinCode", out _));
    }

    [Fact]
    public async Task EventsOpen_ExcludesPrivateAndUnlistedEvents()
    {
        using var factory = new OlsmakingApiFactory(auth0Configured: true);
        using var client = factory.CreateClient();

        using var createListedOpenEventResponse = await SendAsUserAsync(
            client,
            HttpMethod.Post,
            "/api/events",
            "owner-sub",
            new
            {
                name = "Listed Open Event",
                visibility = EventVisibility.Open,
                isListed = true,
            });

        Assert.Equal(HttpStatusCode.Created, createListedOpenEventResponse.StatusCode);
        var listedOpenEvent = await createListedOpenEventResponse.Content.ReadFromJsonAsync<JsonElement>();
        var listedOpenEventId = listedOpenEvent.GetProperty("id").GetGuid();

        using var createPrivateEventResponse = await SendAsUserAsync(
            client,
            HttpMethod.Post,
            "/api/events",
            "owner-sub",
            new
            {
                name = "Private Event",
            });

        Assert.Equal(HttpStatusCode.Created, createPrivateEventResponse.StatusCode);

        using var createOpenUnlistedEventResponse = await SendAsUserAsync(
            client,
            HttpMethod.Post,
            "/api/events",
            "owner-sub",
            new
            {
                name = "Open Unlisted Event",
                visibility = EventVisibility.Open,
                isListed = false,
            });

        Assert.Equal(HttpStatusCode.Created, createOpenUnlistedEventResponse.StatusCode);

        using var openEventsResponse = await SendAsUserAsync(
            client,
            HttpMethod.Get,
            "/api/events/open",
            "seeker-sub");

        Assert.Equal(HttpStatusCode.OK, openEventsResponse.StatusCode);
        var events = await openEventsResponse.Content.ReadFromJsonAsync<JsonElement>();

        Assert.Equal(JsonValueKind.Array, events.ValueKind);
        Assert.Single(events.EnumerateArray());
        Assert.Equal(listedOpenEventId, events[0].GetProperty("id").GetGuid());
    }

    [Fact]
    public async Task EventsOpen_ExcludesEventsWhereCurrentUserWasRemoved()
    {
        using var factory = new OlsmakingApiFactory(auth0Configured: true);
        using var client = factory.CreateClient();

        using var createEventResponse = await SendAsUserAsync(
            client,
            HttpMethod.Post,
            "/api/events",
            "owner-sub",
            new
            {
                name = "Removed Participant Event",
                visibility = EventVisibility.Open,
                isListed = true,
            });

        Assert.Equal(HttpStatusCode.Created, createEventResponse.StatusCode);
        var eventPayload = await createEventResponse.Content.ReadFromJsonAsync<JsonElement>();
        var eventId = eventPayload.GetProperty("id").GetGuid();
        var joinCode = eventPayload.GetProperty("joinCode").GetString();

        Assert.False(string.IsNullOrWhiteSpace(joinCode));

        using var seekerMeResponse = await SendAsUserAsync(
            client,
            HttpMethod.Get,
            "/api/users/me",
            "seeker-sub");

        Assert.Equal(HttpStatusCode.OK, seekerMeResponse.StatusCode);
        var seekerPayload = await seekerMeResponse.Content.ReadFromJsonAsync<JsonElement>();
        var seekerUserId = seekerPayload.GetProperty("id").GetGuid();

        using var joinResponse = await SendAsUserAsync(
            client,
            HttpMethod.Post,
            $"/api/events/{eventId}/join",
            "seeker-sub",
            new
            {
                joinCode,
            });

        Assert.Equal(HttpStatusCode.OK, joinResponse.StatusCode);

        using var removeParticipantResponse = await SendAsUserAsync(
            client,
            HttpMethod.Delete,
            $"/api/events/{eventId}/participants/{seekerUserId}",
            "owner-sub");

        Assert.Equal(HttpStatusCode.NoContent, removeParticipantResponse.StatusCode);

        using var openEventsResponse = await SendAsUserAsync(
            client,
            HttpMethod.Get,
            "/api/events/open",
            "seeker-sub");

        Assert.Equal(HttpStatusCode.OK, openEventsResponse.StatusCode);
        var events = await openEventsResponse.Content.ReadFromJsonAsync<JsonElement>();

        Assert.Equal(JsonValueKind.Array, events.ValueKind);
        Assert.Empty(events.EnumerateArray());
    }

    [Fact]
    public async Task Owner_CanCloseAndReopenEvent()
    {
        using var factory = new OlsmakingApiFactory(auth0Configured: true);
        using var client = factory.CreateClient();

        using var createEventResponse = await SendAsUserAsync(
            client,
            HttpMethod.Post,
            "/api/events",
            "owner-sub",
            new
            {
                name = "Status Flow Event",
            });

        Assert.Equal(HttpStatusCode.Created, createEventResponse.StatusCode);
        var createEventPayload = await createEventResponse.Content.ReadFromJsonAsync<JsonElement>();
        var eventId = createEventPayload.GetProperty("id").GetGuid();

        using var closeEventResponse = await SendAsUserAsync(
            client,
            HttpMethod.Patch,
            $"/api/events/{eventId}/status",
            "owner-sub",
            new
            {
                status = "closed",
            });

        Assert.Equal(HttpStatusCode.OK, closeEventResponse.StatusCode);
        var closePayload = await closeEventResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal((int)EventStatus.Closed, closePayload.GetProperty("status").GetInt32());

        using var reopenEventResponse = await SendAsUserAsync(
            client,
            HttpMethod.Patch,
            $"/api/events/{eventId}/status",
            "owner-sub",
            new
            {
                status = "OPEN",
            });

        Assert.Equal(HttpStatusCode.OK, reopenEventResponse.StatusCode);
        var reopenPayload = await reopenEventResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal((int)EventStatus.Open, reopenPayload.GetProperty("status").GetInt32());
    }

    [Fact]
    public async Task NonOwner_CannotChangeEventStatus()
    {
        using var factory = new OlsmakingApiFactory(auth0Configured: true);
        using var client = factory.CreateClient();

        using var createEventResponse = await SendAsUserAsync(
            client,
            HttpMethod.Post,
            "/api/events",
            "owner-sub",
            new
            {
                name = "Forbidden Status Event",
            });

        Assert.Equal(HttpStatusCode.Created, createEventResponse.StatusCode);
        var createEventPayload = await createEventResponse.Content.ReadFromJsonAsync<JsonElement>();
        var eventId = createEventPayload.GetProperty("id").GetGuid();

        using var updateStatusResponse = await SendAsUserAsync(
            client,
            HttpMethod.Patch,
            $"/api/events/{eventId}/status",
            "member-sub",
            new
            {
                status = "closed",
            });

        Assert.Equal(HttpStatusCode.Forbidden, updateStatusResponse.StatusCode);
    }

    [Fact]
    public async Task RestoreParticipant_AllowsAccessAndMakesJoinIdempotent_AfterRemoval()
    {
        using var factory = new OlsmakingApiFactory(auth0Configured: true);
        using var client = factory.CreateClient();

        using var createEventResponse = await SendAsUserAsync(
            client,
            HttpMethod.Post,
            "/api/events",
            "owner-sub",
            new
            {
                name = "Restore Flow Event",
            });

        Assert.Equal(HttpStatusCode.Created, createEventResponse.StatusCode);
        var eventPayload = await createEventResponse.Content.ReadFromJsonAsync<JsonElement>();
        var eventId = eventPayload.GetProperty("id").GetGuid();
        var joinCode = eventPayload.GetProperty("joinCode").GetString();

        using var memberMeResponse = await SendAsUserAsync(
            client,
            HttpMethod.Get,
            "/api/users/me",
            "member-sub");

        Assert.Equal(HttpStatusCode.OK, memberMeResponse.StatusCode);
        var memberPayload = await memberMeResponse.Content.ReadFromJsonAsync<JsonElement>();
        var memberUserId = memberPayload.GetProperty("id").GetGuid();

        using var initialJoinResponse = await SendAsUserAsync(
            client,
            HttpMethod.Post,
            $"/api/events/{eventId}/join",
            "member-sub",
            new
            {
                joinCode,
            });

        Assert.Equal(HttpStatusCode.OK, initialJoinResponse.StatusCode);
        var initialJoinPayload = await initialJoinResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(initialJoinPayload.GetProperty("joined").GetBoolean());

        using var removeParticipantResponse = await SendAsUserAsync(
            client,
            HttpMethod.Delete,
            $"/api/events/{eventId}/participants/{memberUserId}",
            "owner-sub");

        Assert.Equal(HttpStatusCode.NoContent, removeParticipantResponse.StatusCode);

        using var blockedJoinResponse = await SendAsUserAsync(
            client,
            HttpMethod.Post,
            $"/api/events/{eventId}/join",
            "member-sub",
            new
            {
                joinCode,
            });

        Assert.Equal(HttpStatusCode.Forbidden, blockedJoinResponse.StatusCode);

        using var restoreParticipantResponse = await SendAsUserAsync(
            client,
            HttpMethod.Post,
            $"/api/events/{eventId}/participants/{memberUserId}/restore",
            "owner-sub");

        Assert.Equal(HttpStatusCode.NoContent, restoreParticipantResponse.StatusCode);

        using var joinAfterRestoreResponse = await SendAsUserAsync(
            client,
            HttpMethod.Post,
            $"/api/events/{eventId}/join",
            "member-sub",
            new
            {
                joinCode,
            });

        Assert.Equal(HttpStatusCode.OK, joinAfterRestoreResponse.StatusCode);
        var joinAfterRestorePayload = await joinAfterRestoreResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.False(joinAfterRestorePayload.GetProperty("joined").GetBoolean());

        using var eventDetailsResponse = await SendAsUserAsync(
            client,
            HttpMethod.Get,
            $"/api/events/{eventId}",
            "member-sub");

        Assert.Equal(HttpStatusCode.OK, eventDetailsResponse.StatusCode);
    }

    [Fact]
    public async Task Authenticated_EventJoinAndReviewFlow_EnforcesBasicGuards()
    {
        using var factory = new OlsmakingApiFactory(auth0Configured: true);
        using var client = factory.CreateClient();

        using var createEventResponse = await SendAsUserAsync(
            client,
            HttpMethod.Post,
            "/api/events",
            "owner-sub",
            new
            {
                name = "Friday Tasting",
            });

        Assert.Equal(HttpStatusCode.Created, createEventResponse.StatusCode);
        var createEventPayload = await createEventResponse.Content.ReadFromJsonAsync<JsonElement>();
        var eventId = createEventPayload.GetProperty("id").GetGuid();
        var joinCode = createEventPayload.GetProperty("joinCode").GetString();

        Assert.False(string.IsNullOrWhiteSpace(joinCode));

        using var addBeerBeforeJoinResponse = await SendAsUserAsync(
            client,
            HttpMethod.Post,
            $"/api/events/{eventId}/beers",
            "member-sub",
            new
            {
                name = "Should Fail",
            });

        Assert.Equal(HttpStatusCode.Forbidden, addBeerBeforeJoinResponse.StatusCode);

        using var addBeerResponse = await SendAsUserAsync(
            client,
            HttpMethod.Post,
            $"/api/events/{eventId}/beers",
            "owner-sub",
            new
            {
                name = "Pilsner",
                brewery = "Brewery",
                style = "Pilsner",
                abv = 5.2m,
            });

        Assert.Equal(HttpStatusCode.Created, addBeerResponse.StatusCode);
        var addBeerPayload = await addBeerResponse.Content.ReadFromJsonAsync<JsonElement>();
        var beerId = addBeerPayload.GetProperty("id").GetGuid();

        using var reviewBeforeJoinResponse = await SendAsUserAsync(
            client,
            HttpMethod.Post,
            $"/api/events/{eventId}/beers/{beerId}/reviews",
            "member-sub",
            new
            {
                rating = 5,
                notes = "Blocked before join",
            });

        Assert.Equal(HttpStatusCode.Forbidden, reviewBeforeJoinResponse.StatusCode);

        using var actualJoinResponse = await SendAsUserAsync(
            client,
            HttpMethod.Post,
            $"/api/events/{eventId}/join",
            "member-sub",
            new
            {
                joinCode,
            });

        Assert.Equal(HttpStatusCode.OK, actualJoinResponse.StatusCode);

        using var invalidReviewResponse = await SendAsUserAsync(
            client,
            HttpMethod.Post,
            $"/api/events/{eventId}/beers/{beerId}/reviews",
            "member-sub",
            new
            {
                rating = 0,
                notes = "Invalid rating",
            });

        Assert.Equal(HttpStatusCode.BadRequest, invalidReviewResponse.StatusCode);
    }

    [Fact]
    public async Task Favorites_AddRemoveAndRead_AreIdempotent_AndGuardedByMembership()
    {
        using var factory = new OlsmakingApiFactory(auth0Configured: true);
        using var client = factory.CreateClient();

        using var createEventResponse = await SendAsUserAsync(
            client,
            HttpMethod.Post,
            "/api/events",
            "owner-sub",
            new
            {
                name = "Favorites Event",
            });

        Assert.Equal(HttpStatusCode.Created, createEventResponse.StatusCode);
        var createEventPayload = await createEventResponse.Content.ReadFromJsonAsync<JsonElement>();
        var eventId = createEventPayload.GetProperty("id").GetGuid();
        var joinCode = createEventPayload.GetProperty("joinCode").GetString();

        using var addBeerResponse = await SendAsUserAsync(
            client,
            HttpMethod.Post,
            $"/api/events/{eventId}/beers",
            "owner-sub",
            new
            {
                name = "Favorite Candidate",
            });

        Assert.Equal(HttpStatusCode.Created, addBeerResponse.StatusCode);
        var addBeerPayload = await addBeerResponse.Content.ReadFromJsonAsync<JsonElement>();
        var beerId = addBeerPayload.GetProperty("id").GetGuid();

        using var favoriteBeforeJoinResponse = await SendAsUserAsync(
            client,
            HttpMethod.Post,
            $"/api/events/{eventId}/beers/{beerId}/favorite",
            "member-sub");

        Assert.Equal(HttpStatusCode.Forbidden, favoriteBeforeJoinResponse.StatusCode);

        using var joinResponse = await SendAsUserAsync(
            client,
            HttpMethod.Post,
            $"/api/events/{eventId}/join",
            "member-sub",
            new
            {
                joinCode,
            });

        Assert.Equal(HttpStatusCode.OK, joinResponse.StatusCode);

        using var initialGetFavoritesResponse = await SendAsUserAsync(
            client,
            HttpMethod.Get,
            $"/api/events/{eventId}/favorites/me",
            "member-sub");

        Assert.Equal(HttpStatusCode.OK, initialGetFavoritesResponse.StatusCode);
        var initialFavorites = await initialGetFavoritesResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(JsonValueKind.Array, initialFavorites.ValueKind);
        Assert.Empty(initialFavorites.EnumerateArray());

        using var firstFavoriteResponse = await SendAsUserAsync(
            client,
            HttpMethod.Post,
            $"/api/events/{eventId}/beers/{beerId}/favorite",
            "member-sub");

        Assert.Equal(HttpStatusCode.NoContent, firstFavoriteResponse.StatusCode);

        using var secondFavoriteResponse = await SendAsUserAsync(
            client,
            HttpMethod.Post,
            $"/api/events/{eventId}/beers/{beerId}/favorite",
            "member-sub");

        Assert.Equal(HttpStatusCode.NoContent, secondFavoriteResponse.StatusCode);

        using var getFavoritesAfterAddResponse = await SendAsUserAsync(
            client,
            HttpMethod.Get,
            $"/api/events/{eventId}/favorites/me",
            "member-sub");

        Assert.Equal(HttpStatusCode.OK, getFavoritesAfterAddResponse.StatusCode);
        var favoritesAfterAdd = await getFavoritesAfterAddResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(1, favoritesAfterAdd.GetArrayLength());
        Assert.Equal(beerId, favoritesAfterAdd[0].GetGuid());

        using var firstDeleteFavoriteResponse = await SendAsUserAsync(
            client,
            HttpMethod.Delete,
            $"/api/events/{eventId}/beers/{beerId}/favorite",
            "member-sub");

        Assert.Equal(HttpStatusCode.NoContent, firstDeleteFavoriteResponse.StatusCode);

        using var secondDeleteFavoriteResponse = await SendAsUserAsync(
            client,
            HttpMethod.Delete,
            $"/api/events/{eventId}/beers/{beerId}/favorite",
            "member-sub");

        Assert.Equal(HttpStatusCode.NoContent, secondDeleteFavoriteResponse.StatusCode);

        using var getFavoritesAfterDeleteResponse = await SendAsUserAsync(
            client,
            HttpMethod.Get,
            $"/api/events/{eventId}/favorites/me",
            "member-sub");

        Assert.Equal(HttpStatusCode.OK, getFavoritesAfterDeleteResponse.StatusCode);
        var favoritesAfterDelete = await getFavoritesAfterDeleteResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(JsonValueKind.Array, favoritesAfterDelete.ValueKind);
        Assert.Empty(favoritesAfterDelete.EnumerateArray());
    }

    [Fact]
    public async Task FavoriteEndpoints_ReturnNotFound_WhenBeerIsNotInEvent()
    {
        using var factory = new OlsmakingApiFactory(auth0Configured: true);
        using var client = factory.CreateClient();

        using var createFirstEventResponse = await SendAsUserAsync(
            client,
            HttpMethod.Post,
            "/api/events",
            "owner-sub",
            new
            {
                name = "Event One",
            });

        Assert.Equal(HttpStatusCode.Created, createFirstEventResponse.StatusCode);
        var firstEventPayload = await createFirstEventResponse.Content.ReadFromJsonAsync<JsonElement>();
        var firstEventId = firstEventPayload.GetProperty("id").GetGuid();

        using var createSecondEventResponse = await SendAsUserAsync(
            client,
            HttpMethod.Post,
            "/api/events",
            "owner-sub",
            new
            {
                name = "Event Two",
            });

        Assert.Equal(HttpStatusCode.Created, createSecondEventResponse.StatusCode);
        var secondEventPayload = await createSecondEventResponse.Content.ReadFromJsonAsync<JsonElement>();
        var secondEventId = secondEventPayload.GetProperty("id").GetGuid();

        using var addBeerResponse = await SendAsUserAsync(
            client,
            HttpMethod.Post,
            $"/api/events/{firstEventId}/beers",
            "owner-sub",
            new
            {
                name = "Cross Event Beer",
            });

        Assert.Equal(HttpStatusCode.Created, addBeerResponse.StatusCode);
        var beerPayload = await addBeerResponse.Content.ReadFromJsonAsync<JsonElement>();
        var beerId = beerPayload.GetProperty("id").GetGuid();

        using var addFavoriteWrongEventResponse = await SendAsUserAsync(
            client,
            HttpMethod.Post,
            $"/api/events/{secondEventId}/beers/{beerId}/favorite",
            "owner-sub");

        Assert.Equal(HttpStatusCode.NotFound, addFavoriteWrongEventResponse.StatusCode);

        using var removeFavoriteWrongEventResponse = await SendAsUserAsync(
            client,
            HttpMethod.Delete,
            $"/api/events/{secondEventId}/beers/{beerId}/favorite",
            "owner-sub");

        Assert.Equal(HttpStatusCode.NotFound, removeFavoriteWrongEventResponse.StatusCode);
    }

    [Fact]
    public async Task FavoritesMine_ReturnsCurrentUsersFavorites_InDescendingFavoriteOrder()
    {
        using var factory = new OlsmakingApiFactory(auth0Configured: true);
        using var client = factory.CreateClient();

        using var createFirstEventResponse = await SendAsUserAsync(
            client,
            HttpMethod.Post,
            "/api/events",
            "first-owner-sub",
            new
            {
                name = "First Favorites Event",
            });

        Assert.Equal(HttpStatusCode.Created, createFirstEventResponse.StatusCode);
        var firstEventPayload = await createFirstEventResponse.Content.ReadFromJsonAsync<JsonElement>();
        var firstEventId = firstEventPayload.GetProperty("id").GetGuid();
        var firstJoinCode = firstEventPayload.GetProperty("joinCode").GetString();

        using var createSecondEventResponse = await SendAsUserAsync(
            client,
            HttpMethod.Post,
            "/api/events",
            "second-owner-sub",
            new
            {
                name = "Second Favorites Event",
            });

        Assert.Equal(HttpStatusCode.Created, createSecondEventResponse.StatusCode);
        var secondEventPayload = await createSecondEventResponse.Content.ReadFromJsonAsync<JsonElement>();
        var secondEventId = secondEventPayload.GetProperty("id").GetGuid();
        var secondJoinCode = secondEventPayload.GetProperty("joinCode").GetString();

        using var memberMeResponse = await SendAsUserAsync(
            client,
            HttpMethod.Get,
            "/api/users/me",
            "member-sub");

        Assert.Equal(HttpStatusCode.OK, memberMeResponse.StatusCode);
        var memberPayload = await memberMeResponse.Content.ReadFromJsonAsync<JsonElement>();
        var memberUserId = memberPayload.GetProperty("id").GetGuid();

        using var joinFirstEventResponse = await SendAsUserAsync(
            client,
            HttpMethod.Post,
            $"/api/events/{firstEventId}/join",
            "member-sub",
            new
            {
                joinCode = firstJoinCode,
            });

        Assert.Equal(HttpStatusCode.OK, joinFirstEventResponse.StatusCode);

        using var joinSecondEventResponse = await SendAsUserAsync(
            client,
            HttpMethod.Post,
            $"/api/events/{secondEventId}/join",
            "member-sub",
            new
            {
                joinCode = secondJoinCode,
            });

        Assert.Equal(HttpStatusCode.OK, joinSecondEventResponse.StatusCode);

        using var addFirstBeerResponse = await SendAsUserAsync(
            client,
            HttpMethod.Post,
            $"/api/events/{firstEventId}/beers",
            "first-owner-sub",
            new
            {
                name = "First Beer",
                brewery = "North Brewery",
                style = "Pale Ale",
                abv = 5.4m,
            });

        Assert.Equal(HttpStatusCode.Created, addFirstBeerResponse.StatusCode);
        var firstBeerPayload = await addFirstBeerResponse.Content.ReadFromJsonAsync<JsonElement>();
        var firstBeerId = firstBeerPayload.GetProperty("id").GetGuid();

        using var addSecondBeerResponse = await SendAsUserAsync(
            client,
            HttpMethod.Post,
            $"/api/events/{secondEventId}/beers",
            "second-owner-sub",
            new
            {
                name = "Second Beer",
                brewery = "South Brewery",
                style = "Stout",
                abv = 7.1m,
            });

        Assert.Equal(HttpStatusCode.Created, addSecondBeerResponse.StatusCode);
        var secondBeerPayload = await addSecondBeerResponse.Content.ReadFromJsonAsync<JsonElement>();
        var secondBeerId = secondBeerPayload.GetProperty("id").GetGuid();

        using var addFirstFavoriteResponse = await SendAsUserAsync(
            client,
            HttpMethod.Post,
            $"/api/events/{firstEventId}/beers/{firstBeerId}/favorite",
            "member-sub");

        Assert.Equal(HttpStatusCode.NoContent, addFirstFavoriteResponse.StatusCode);

        using var addSecondFavoriteResponse = await SendAsUserAsync(
            client,
            HttpMethod.Post,
            $"/api/events/{secondEventId}/beers/{secondBeerId}/favorite",
            "member-sub");

        Assert.Equal(HttpStatusCode.NoContent, addSecondFavoriteResponse.StatusCode);

        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<OlsmakingDbContext>();
            var olderFavoriteUtc = new DateTimeOffset(2025, 01, 01, 10, 00, 00, TimeSpan.Zero);
            var newerFavoriteUtc = new DateTimeOffset(2025, 01, 01, 12, 00, 00, TimeSpan.Zero);

            await dbContext.Database.ExecuteSqlInterpolatedAsync($"""
                UPDATE BeerFavorites
                SET CreatedUtc = {olderFavoriteUtc}
                WHERE EventId = {firstEventId} AND BeerId = {firstBeerId} AND UserId = {memberUserId}
                """);

            await dbContext.Database.ExecuteSqlInterpolatedAsync($"""
                UPDATE BeerFavorites
                SET CreatedUtc = {newerFavoriteUtc}
                WHERE EventId = {secondEventId} AND BeerId = {secondBeerId} AND UserId = {memberUserId}
                """);
        }

        using var myFavoritesResponse = await SendAsUserAsync(
            client,
            HttpMethod.Get,
            "/api/favorites/mine",
            "member-sub");

        Assert.Equal(HttpStatusCode.OK, myFavoritesResponse.StatusCode);
        var favorites = await myFavoritesResponse.Content.ReadFromJsonAsync<JsonElement>();

        Assert.Equal(JsonValueKind.Array, favorites.ValueKind);
        Assert.Equal(2, favorites.GetArrayLength());

        var newestFavorite = favorites[0];
        var olderFavorite = favorites[1];

        Assert.Equal(secondEventId, newestFavorite.GetProperty("eventId").GetGuid());
        Assert.Equal("Second Favorites Event", newestFavorite.GetProperty("eventName").GetString());
        Assert.Equal(secondBeerId, newestFavorite.GetProperty("beerId").GetGuid());
        Assert.Equal("Second Beer", newestFavorite.GetProperty("beerName").GetString());
        Assert.Equal("South Brewery", newestFavorite.GetProperty("brewery").GetString());
        Assert.Equal("Stout", newestFavorite.GetProperty("style").GetString());
        Assert.Equal(7.1m, newestFavorite.GetProperty("abv").GetDecimal());
        Assert.Equal((int)EventStatus.Open, newestFavorite.GetProperty("eventStatus").GetInt32());
        Assert.True(newestFavorite.TryGetProperty("favoritedUtc", out _));

        Assert.Equal(firstEventId, olderFavorite.GetProperty("eventId").GetGuid());
        Assert.Equal(firstBeerId, olderFavorite.GetProperty("beerId").GetGuid());
    }

    [Fact]
    public async Task FavoritesMine_HidesFavorites_WhenUserIsRemovedFromEvent()
    {
        using var factory = new OlsmakingApiFactory(auth0Configured: true);
        using var client = factory.CreateClient();

        using var createEventResponse = await SendAsUserAsync(
            client,
            HttpMethod.Post,
            "/api/events",
            "owner-sub",
            new
            {
                name = "Removed Access Favorites Event",
            });

        Assert.Equal(HttpStatusCode.Created, createEventResponse.StatusCode);
        var eventPayload = await createEventResponse.Content.ReadFromJsonAsync<JsonElement>();
        var eventId = eventPayload.GetProperty("id").GetGuid();
        var joinCode = eventPayload.GetProperty("joinCode").GetString();

        using var memberMeResponse = await SendAsUserAsync(
            client,
            HttpMethod.Get,
            "/api/users/me",
            "member-sub");

        Assert.Equal(HttpStatusCode.OK, memberMeResponse.StatusCode);
        var memberPayload = await memberMeResponse.Content.ReadFromJsonAsync<JsonElement>();
        var memberUserId = memberPayload.GetProperty("id").GetGuid();

        using var joinResponse = await SendAsUserAsync(
            client,
            HttpMethod.Post,
            $"/api/events/{eventId}/join",
            "member-sub",
            new
            {
                joinCode,
            });

        Assert.Equal(HttpStatusCode.OK, joinResponse.StatusCode);

        using var addBeerResponse = await SendAsUserAsync(
            client,
            HttpMethod.Post,
            $"/api/events/{eventId}/beers",
            "owner-sub",
            new
            {
                name = "Hidden Favorite Beer",
            });

        Assert.Equal(HttpStatusCode.Created, addBeerResponse.StatusCode);
        var addBeerPayload = await addBeerResponse.Content.ReadFromJsonAsync<JsonElement>();
        var beerId = addBeerPayload.GetProperty("id").GetGuid();

        using var addFavoriteResponse = await SendAsUserAsync(
            client,
            HttpMethod.Post,
            $"/api/events/{eventId}/beers/{beerId}/favorite",
            "member-sub");

        Assert.Equal(HttpStatusCode.NoContent, addFavoriteResponse.StatusCode);

        using var removeMemberResponse = await SendAsUserAsync(
            client,
            HttpMethod.Delete,
            $"/api/events/{eventId}/participants/{memberUserId}",
            "owner-sub");

        Assert.Equal(HttpStatusCode.NoContent, removeMemberResponse.StatusCode);

        using var myFavoritesResponse = await SendAsUserAsync(
            client,
            HttpMethod.Get,
            "/api/favorites/mine",
            "member-sub");

        Assert.Equal(HttpStatusCode.OK, myFavoritesResponse.StatusCode);
        var favorites = await myFavoritesResponse.Content.ReadFromJsonAsync<JsonElement>();

        Assert.Equal(JsonValueKind.Array, favorites.ValueKind);
        Assert.Empty(favorites.EnumerateArray());
    }

    [Fact]
    public async Task ReviewMe_Get_ReturnsCurrentUserReview_WhenItExists()
    {
        using var factory = new OlsmakingApiFactory(auth0Configured: true);
        using var client = factory.CreateClient();

        using var createEventResponse = await SendAsUserAsync(
            client,
            HttpMethod.Post,
            "/api/events",
            "owner-sub",
            new
            {
                name = "Review Lookup Event",
            });

        Assert.Equal(HttpStatusCode.Created, createEventResponse.StatusCode);
        var createEventPayload = await createEventResponse.Content.ReadFromJsonAsync<JsonElement>();
        var eventId = createEventPayload.GetProperty("id").GetGuid();

        using var addBeerResponse = await SendAsUserAsync(
            client,
            HttpMethod.Post,
            $"/api/events/{eventId}/beers",
            "owner-sub",
            new
            {
                name = "Lookup Lager",
            });

        Assert.Equal(HttpStatusCode.Created, addBeerResponse.StatusCode);
        var addBeerPayload = await addBeerResponse.Content.ReadFromJsonAsync<JsonElement>();
        var beerId = addBeerPayload.GetProperty("id").GetGuid();

        using var getCurrentUserResponse = await SendAsUserAsync(
            client,
            HttpMethod.Get,
            "/api/users/me",
            "owner-sub");

        Assert.Equal(HttpStatusCode.OK, getCurrentUserResponse.StatusCode);
        var currentUserPayload = await getCurrentUserResponse.Content.ReadFromJsonAsync<JsonElement>();
        var ownerUserId = currentUserPayload.GetProperty("id").GetGuid();

        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<OlsmakingDbContext>();
            var now = DateTimeOffset.UtcNow;
            var reviewId = Guid.NewGuid();

            await dbContext.Database.ExecuteSqlInterpolatedAsync($"""
                INSERT INTO BeerReviews
                (Id, EventId, BeerId, UserId, Rating, Notes, AromaNotes, AppearanceNotes, FlavorNotes, CreatedUtc, UpdatedUtc, RowVersion)
                VALUES
                ({reviewId}, {eventId}, {beerId}, {ownerUserId}, {5}, {"Fresh and crisp"}, {null}, {null}, {null}, {now}, {now}, X'01')
                """);
        }

        using var getReviewResponse = await SendAsUserAsync(
            client,
            HttpMethod.Get,
            $"/api/events/{eventId}/beers/{beerId}/reviews/me",
            "owner-sub");

        Assert.Equal(HttpStatusCode.OK, getReviewResponse.StatusCode);
        var reviewPayload = await getReviewResponse.Content.ReadFromJsonAsync<JsonElement>();

        Assert.Equal(eventId, reviewPayload.GetProperty("eventId").GetGuid());
        Assert.Equal(beerId, reviewPayload.GetProperty("beerId").GetGuid());
        Assert.Equal(5, reviewPayload.GetProperty("rating").GetInt32());
        Assert.Equal("Fresh and crisp", reviewPayload.GetProperty("notes").GetString());
        Assert.True(reviewPayload.TryGetProperty("id", out _));
        Assert.True(reviewPayload.TryGetProperty("userId", out _));
        Assert.True(reviewPayload.TryGetProperty("createdUtc", out _));
        Assert.True(reviewPayload.TryGetProperty("updatedUtc", out _));
    }

    [Fact]
    public async Task ReviewMe_Get_ReturnsNotFound_WhenCurrentUserHasNoReview()
    {
        using var factory = new OlsmakingApiFactory(auth0Configured: true);
        using var client = factory.CreateClient();

        using var createEventResponse = await SendAsUserAsync(
            client,
            HttpMethod.Post,
            "/api/events",
            "owner-sub",
            new
            {
                name = "Review Missing Event",
            });

        Assert.Equal(HttpStatusCode.Created, createEventResponse.StatusCode);
        var createEventPayload = await createEventResponse.Content.ReadFromJsonAsync<JsonElement>();
        var eventId = createEventPayload.GetProperty("id").GetGuid();

        using var addBeerResponse = await SendAsUserAsync(
            client,
            HttpMethod.Post,
            $"/api/events/{eventId}/beers",
            "owner-sub",
            new
            {
                name = "No Review Stout",
            });

        Assert.Equal(HttpStatusCode.Created, addBeerResponse.StatusCode);
        var addBeerPayload = await addBeerResponse.Content.ReadFromJsonAsync<JsonElement>();
        var beerId = addBeerPayload.GetProperty("id").GetGuid();

        using var getMissingReviewResponse = await SendAsUserAsync(
            client,
            HttpMethod.Get,
            $"/api/events/{eventId}/beers/{beerId}/reviews/me",
            "owner-sub");

        Assert.Equal(HttpStatusCode.NotFound, getMissingReviewResponse.StatusCode);
    }

    private static Task<HttpResponseMessage> SendAsUserAsync(
        HttpClient client,
        HttpMethod method,
        string requestUri,
        string subject,
        object? body = null,
        string? scopes = null)
    {
        var request = new HttpRequestMessage(method, requestUri);
        request.Headers.TryAddWithoutValidation("X-Test-Auth-Sub", subject);
        request.Headers.TryAddWithoutValidation("X-Test-Auth-Email", $"{subject}@example.com");
        request.Headers.TryAddWithoutValidation("X-Test-Auth-Nickname", subject);

        if (!string.IsNullOrWhiteSpace(scopes))
        {
            request.Headers.TryAddWithoutValidation("X-Test-Auth-Scopes", scopes);
        }

        if (body is not null)
        {
            var json = JsonSerializer.Serialize(body);
            request.Content = new StringContent(json, Encoding.UTF8, "application/json");
        }

        return client.SendAsync(request);
    }
}
