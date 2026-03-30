using System.Net;

namespace TournamentOrganizer.Tests;

/// <summary>
/// Verifies that GET /api/players/{playerId}/trades/suggestions and
/// GET /api/players/{playerId}/trades/demand enforce ownership —
/// a Tier2 player cannot read another player's trade data (IDOR).
/// OWASP A01:2021 — Broken Access Control.
/// </summary>
public class IdorTradeSuggestionsTests(TournamentOrganizerFactory factory)
    : IClassFixture<TournamentOrganizerFactory>
{
    // Player 1 is the caller; player 2 is the victim.
    private const int OwnPlayerId   = 1;
    private const int OtherPlayerId = 2;

    // ── /trades/suggestions ──────────────────────────────────────────────────

    [Fact]
    public async Task GetSuggestions_Returns403_WhenTier2PlayerRequestsOtherPlayersData()
    {
        var client = factory.ClientAs("Player", playerId: OwnPlayerId, licenseTier: "Tier2");

        var response = await client.GetAsync($"/api/players/{OtherPlayerId}/trades/suggestions");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task GetSuggestions_IsAllowed_WhenPlayerRequestsOwnData()
    {
        var client = factory.ClientAs("Player", playerId: OwnPlayerId, licenseTier: "Tier2");

        var response = await client.GetAsync($"/api/players/{OwnPlayerId}/trades/suggestions");

        Assert.True(
            response.StatusCode != HttpStatusCode.Unauthorized &&
            response.StatusCode != HttpStatusCode.Forbidden,
            $"Expected own data to be accessible, got {(int)response.StatusCode}");
    }

    [Fact]
    public async Task GetSuggestions_IsAllowed_WhenAdministratorRequestsAnyPlayersData()
    {
        var client = factory.ClientAs("Administrator");

        var response = await client.GetAsync($"/api/players/{OtherPlayerId}/trades/suggestions");

        Assert.True(
            response.StatusCode != HttpStatusCode.Unauthorized &&
            response.StatusCode != HttpStatusCode.Forbidden,
            $"Expected Administrator to access any player's data, got {(int)response.StatusCode}");
    }

    // ── /trades/demand ───────────────────────────────────────────────────────

    [Fact]
    public async Task GetDemand_Returns403_WhenTier2PlayerRequestsOtherPlayersData()
    {
        var client = factory.ClientAs("Player", playerId: OwnPlayerId, licenseTier: "Tier2");

        var response = await client.GetAsync($"/api/players/{OtherPlayerId}/trades/demand");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task GetDemand_IsAllowed_WhenPlayerRequestsOwnData()
    {
        var client = factory.ClientAs("Player", playerId: OwnPlayerId, licenseTier: "Tier2");

        var response = await client.GetAsync($"/api/players/{OwnPlayerId}/trades/demand");

        Assert.True(
            response.StatusCode != HttpStatusCode.Unauthorized &&
            response.StatusCode != HttpStatusCode.Forbidden,
            $"Expected own data to be accessible, got {(int)response.StatusCode}");
    }

    [Fact]
    public async Task GetDemand_IsAllowed_WhenAdministratorRequestsAnyPlayersData()
    {
        var client = factory.ClientAs("Administrator");

        var response = await client.GetAsync($"/api/players/{OtherPlayerId}/trades/demand");

        Assert.True(
            response.StatusCode != HttpStatusCode.Unauthorized &&
            response.StatusCode != HttpStatusCode.Forbidden,
            $"Expected Administrator to access any player's data, got {(int)response.StatusCode}");
    }
}
