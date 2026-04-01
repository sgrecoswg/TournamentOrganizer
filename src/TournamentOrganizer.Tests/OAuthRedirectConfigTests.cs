using System.Net;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;

namespace TournamentOrganizer.Tests;

/// <summary>
/// Verifies that the OAuth callback does NOT hardcode http://localhost:4200.
/// The Frontend:Origin config key must be respected for all redirect paths
/// (success and error). OWASP A02:2021 — Cryptographic Failures.
/// </summary>
public class OAuthRedirectConfigTests
{
    /// <summary>
    /// Factory that overrides Frontend:Origin to a custom sentinel value so we
    /// can detect whether the controller uses config or the hardcoded string.
    /// </summary>
    private class CustomFrontendFactory : TournamentOrganizerFactory
    {
        internal const string CustomOrigin = "https://custom.example.com";

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            base.ConfigureWebHost(builder);
            builder.ConfigureAppConfiguration((_, cfg) =>
            {
                cfg.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["Frontend:Origin"] = CustomOrigin,
                });
            });
        }
    }

    [Fact]
    public async Task GoogleCallback_ErrorRedirect_UsesConfiguredBaseUrl_NotHardcodedLocalhost()
    {
        // Arrange — call the callback without a valid Google auth cookie so it
        // hits the error path: Redirect("{Frontend:Origin}/auth/callback?error=1")
        using var factory = new CustomFrontendFactory();
        var client = factory.CreateClient(
            new Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactoryClientOptions
            {
                AllowAutoRedirect = false,   // capture the redirect rather than following it
            });

        // Act — GET /api/auth/google-callback with no cookie will fail authentication
        var response = await client.GetAsync("/api/auth/google-callback");

        // Assert — should redirect to the configured origin, NOT http://localhost:4200
        Assert.True(
            response.StatusCode == HttpStatusCode.Redirect ||
            response.StatusCode == HttpStatusCode.Found ||
            response.StatusCode == HttpStatusCode.MovedPermanently,
            $"Expected a redirect but got {(int)response.StatusCode}");

        var location = response.Headers.Location?.ToString() ?? "";
        Assert.Contains(CustomFrontendFactory.CustomOrigin, location);
        Assert.DoesNotContain("http://localhost:4200", location);

        // Also verify opaque numeric error code is used
        Assert.Contains("error=", location);
        Assert.DoesNotContain("auth_failed", location);
        Assert.DoesNotContain("missing_claims", location);
    }
}
