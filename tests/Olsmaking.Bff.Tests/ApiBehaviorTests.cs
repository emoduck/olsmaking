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

        Assert.Equal(HttpStatusCode.ServiceUnavailable, loginResponse.StatusCode);
        Assert.Equal(HttpStatusCode.ServiceUnavailable, meResponse.StatusCode);
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
