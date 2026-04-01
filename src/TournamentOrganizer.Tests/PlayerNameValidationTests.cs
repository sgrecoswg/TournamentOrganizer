using System.Net;
using System.Net.Http.Json;

namespace TournamentOrganizer.Tests;

/// <summary>
/// Verifies that POST /api/players rejects empty and whitespace-only names.
/// Found by /fuzz on 2026-03-27. Issue #115.
/// </summary>
public class PlayerNameValidationTests(TournamentOrganizerFactory factory)
    : IClassFixture<TournamentOrganizerFactory>
{
    [Theory]
    [InlineData("")]
    [InlineData(" ")]
    [InlineData("\t")]
    [InlineData("   ")]
    public async Task PostPlayer_EmptyOrWhitespaceName_Returns400(string invalidName)
    {
        var client = factory.ClientAs("Player");
        var response = await client.PostAsJsonAsync("/api/players",
            new { name = invalidName, email = $"valid-{Guid.NewGuid()}@example.com" });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PostPlayer_ValidName_Returns201()
    {
        var client = factory.ClientAs("Player");
        var response = await client.PostAsJsonAsync("/api/players",
            new { name = "Alice", email = $"valid-{Guid.NewGuid()}@example.com" });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }
}
