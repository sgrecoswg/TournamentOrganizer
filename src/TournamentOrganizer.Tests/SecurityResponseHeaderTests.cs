namespace TournamentOrganizer.Tests;

/// <summary>
/// Verifies that security response headers are present on all API responses.
/// OWASP A05:2021 — Security Misconfiguration.
/// </summary>
public class SecurityResponseHeaderTests(TournamentOrganizerFactory factory)
    : IClassFixture<TournamentOrganizerFactory>
{
    [Fact]
    public async Task ApiResponse_ContainsXContentTypeOptionsHeader()
    {
        var client = factory.CreateClient();
        var response = await client.GetAsync("/api/players");

        Assert.True(
            response.Headers.Contains("X-Content-Type-Options"),
            "Expected X-Content-Type-Options response header on every API response.");
    }

    [Fact]
    public async Task XContentTypeOptions_IsNosniff()
    {
        var client = factory.CreateClient();
        var response = await client.GetAsync("/api/players");

        var value = response.Headers.GetValues("X-Content-Type-Options").FirstOrDefault() ?? "";
        Assert.Equal("nosniff", value);
    }

    [Fact]
    public async Task ApiResponse_ContainsXFrameOptionsHeader()
    {
        var client = factory.CreateClient();
        var response = await client.GetAsync("/api/players");

        Assert.True(
            response.Headers.Contains("X-Frame-Options"),
            "Expected X-Frame-Options response header on every API response.");
    }

    [Fact]
    public async Task XFrameOptions_IsDeny()
    {
        var client = factory.CreateClient();
        var response = await client.GetAsync("/api/players");

        var value = response.Headers.GetValues("X-Frame-Options").FirstOrDefault() ?? "";
        Assert.Equal("DENY", value);
    }

    [Fact]
    public async Task ApiResponse_ContainsReferrerPolicyHeader()
    {
        var client = factory.CreateClient();
        var response = await client.GetAsync("/api/players");

        Assert.True(
            response.Headers.Contains("Referrer-Policy"),
            "Expected Referrer-Policy response header on every API response.");
    }

    [Fact]
    public async Task ReferrerPolicy_IsStrictOriginWhenCrossOrigin()
    {
        var client = factory.CreateClient();
        var response = await client.GetAsync("/api/players");

        var value = response.Headers.GetValues("Referrer-Policy").FirstOrDefault() ?? "";
        Assert.Equal("strict-origin-when-cross-origin", value);
    }
}
