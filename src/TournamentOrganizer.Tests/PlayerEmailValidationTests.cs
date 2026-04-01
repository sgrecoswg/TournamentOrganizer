using System.Net;
using System.Net.Http.Json;

namespace TournamentOrganizer.Tests;

/// <summary>
/// Verifies that POST /api/players enforces email format validation (RFC 5321).
/// Invalid email strings must be rejected with HTTP 400 before reaching the service layer.
/// Found by /fuzz on 2026-03-27.
/// </summary>
public class PlayerEmailValidationTests(TournamentOrganizerFactory factory)
    : IClassFixture<TournamentOrganizerFactory>
{
    [Theory]
    [InlineData("not-an-email")]
    [InlineData("' OR '1'='1")]
    [InlineData("<script>alert(1)</script>")]
    [InlineData("../../../etc/passwd")]
    [InlineData("@nodomain")]
    [InlineData("missing-at-sign")]
    public async Task PostPlayer_InvalidEmail_Returns400(string invalidEmail)
    {
        var client = factory.ClientAs("Player");

        var response = await client.PostAsJsonAsync("/api/players",
            new { name = "Test Player", email = invalidEmail });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PostPlayer_EmailExceeding254Chars_Returns400()
    {
        var client = factory.ClientAs("Player");
        var longEmail = new string('a', 250) + "@b.com"; // 256 chars

        var response = await client.PostAsJsonAsync("/api/players",
            new { name = "Test Player", email = longEmail });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PostPlayer_ValidEmail_Returns201()
    {
        var client = factory.ClientAs("Player");
        var uniqueEmail = $"valid-{Guid.NewGuid()}@example.com";

        var response = await client.PostAsJsonAsync("/api/players",
            new { name = "Valid Player", email = uniqueEmail });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }
}
