using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Olsmaking.Bff.Data;
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

        Assert.Equal(HttpStatusCode.ServiceUnavailable, loginResponse.StatusCode);
        Assert.Equal(HttpStatusCode.ServiceUnavailable, meResponse.StatusCode);
        Assert.Equal(HttpStatusCode.ServiceUnavailable, myEventsResponse.StatusCode);
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
        object? body = null)
    {
        var request = new HttpRequestMessage(method, requestUri);
        request.Headers.TryAddWithoutValidation("X-Test-Auth-Sub", subject);
        request.Headers.TryAddWithoutValidation("X-Test-Auth-Email", $"{subject}@example.com");
        request.Headers.TryAddWithoutValidation("X-Test-Auth-Nickname", subject);

        if (body is not null)
        {
            var json = JsonSerializer.Serialize(body);
            request.Content = new StringContent(json, Encoding.UTF8, "application/json");
        }

        return client.SendAsync(request);
    }
}
