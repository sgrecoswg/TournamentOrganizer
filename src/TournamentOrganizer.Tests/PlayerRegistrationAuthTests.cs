using System.Net;
using System.Net.Http.Json;

namespace TournamentOrganizer.Tests;

/// <summary>
/// Verifies that POST /api/players requires authentication.
/// Before the fix the endpoint had [AllowAnonymous], allowing mass account creation
/// by unauthenticated callers (OWASP A01 — Broken Access Control).
/// </summary>
public class PlayerRegistrationAuthTests(TournamentOrganizerFactory factory)
    : IClassFixture<TournamentOrganizerFactory>
{
    [Fact]
    public async Task Register_Returns401_WhenNoAuthToken()
    {
        var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/players",
            new { name = "Bot", email = "bot@attacker.com" });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Register_IsAllowed_WhenAuthenticated()
    {
        // Any authenticated user (e.g. a store employee) should be permitted
        // to create a player account — authentication is the only gate.
        var client = factory.ClientAs("StoreEmployee");

        var response = await client.PostAsJsonAsync("/api/players",
            new { name = "Valid Player", email = "valid@example.com" });

        Assert.True(
            response.StatusCode != HttpStatusCode.Unauthorized &&
            response.StatusCode != HttpStatusCode.Forbidden,
            $"Expected authenticated request to be allowed, got {(int)response.StatusCode}");
    }
}
