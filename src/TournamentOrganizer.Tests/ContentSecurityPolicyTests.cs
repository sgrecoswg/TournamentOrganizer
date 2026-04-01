using System.Net;

namespace TournamentOrganizer.Tests;

/// <summary>
/// Verifies that a Content-Security-Policy header is present on all API responses.
/// OWASP A05:2021 — Security Misconfiguration.
/// </summary>
public class ContentSecurityPolicyTests(TournamentOrganizerFactory factory)
    : IClassFixture<TournamentOrganizerFactory>
{
    [Fact]
    public async Task ApiResponse_ContainsCspHeader()
    {
        // Arrange
        var client = factory.CreateClient();

        // Act: hit any endpoint — CSP header should be on every response
        var response = await client.GetAsync("/api/players");

        // Assert: CSP header is present (status code irrelevant for this check)
        Assert.True(
            response.Headers.Contains("Content-Security-Policy"),
            "Expected a Content-Security-Policy response header on every API response.");
    }

    [Fact]
    public async Task CspHeader_ContainsDefaultSrcSelf()
    {
        // Arrange
        var client = factory.CreateClient();

        // Act
        var response = await client.GetAsync("/api/players");

        // Assert: at minimum, default-src 'self' must be present
        var csp = response.Headers.GetValues("Content-Security-Policy").FirstOrDefault() ?? "";
        Assert.Contains("default-src 'self'", csp);
    }
}
