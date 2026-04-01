using System.Net;

namespace TournamentOrganizer.Tests;

/// <summary>
/// Verifies that OAuth error redirects use opaque numeric codes and the configured
/// frontend origin, never hardcoded localhost or string error details.
/// OWASP A02:2021 — Cryptographic Failures.
/// </summary>
public class OAuthErrorRedirectTests(TournamentOrganizerFactory factory)
    : IClassFixture<TournamentOrganizerFactory>
{
    [Fact]
    public async Task GoogleCallback_OnAuthFailure_RedirectsToConfiguredFrontendOrigin()
    {
        // Hit the callback endpoint without a valid code — triggers auth failure path
        var client = factory.CreateClient(new Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
        });

        var response = await client.GetAsync("/api/auth/google-callback?error=access_denied");

        Assert.Equal(HttpStatusCode.Redirect, response.StatusCode);
        var location = response.Headers.Location?.ToString() ?? "";

        // Must not contain the string error code "auth_failed"
        Assert.DoesNotContain("auth_failed", location);
        Assert.DoesNotContain("missing_claims", location);

        // Must use opaque numeric error code
        Assert.Contains("error=1", location);

        // Must use Frontend:Origin config value (test default is http://localhost:4200)
        Assert.Contains("http://localhost:4200/auth/callback", location);
    }
}
