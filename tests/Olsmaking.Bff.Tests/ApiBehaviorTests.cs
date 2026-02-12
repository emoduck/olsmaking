using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
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
