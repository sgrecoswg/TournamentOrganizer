using System.Net;
using System.Net.Http.Json;
using Microsoft.Extensions.DependencyInjection;
using TournamentOrganizer.Api.Data;
using TournamentOrganizer.Api.Models;

namespace TournamentOrganizer.Tests;

/// <summary>
/// Integration tests for the JWT refresh-token rotation flow (Issue #98).
/// Verifies that POST /api/auth/refresh validates tokens, rotates them,
/// and that POST /api/auth/logout revokes them.
/// </summary>
public class RefreshTokenTests(TournamentOrganizerFactory factory)
    : IClassFixture<TournamentOrganizerFactory>
{
    private const string RefreshCookieName = "refresh_token";

    // ── Helpers ───────────────────────────────────────────────────────────────

    /// <summary>Seeds an AppUser and a matching RefreshToken directly into the in-memory DB.</summary>
    private async Task<(AppUser user, RefreshToken token)> SeedActiveTokenAsync(
        DateTime? expiresAt = null)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var user = new AppUser
        {
            Email    = $"user{Guid.NewGuid():N}@test.com",
            Name     = "Test User",
            GoogleId = Guid.NewGuid().ToString(),
            Role     = AppUserRole.Player,
        };
        db.AppUsers.Add(user);
        await db.SaveChangesAsync();

        var token = new RefreshToken
        {
            Token      = Convert.ToHexString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(32)).ToLower(),
            AppUserId  = user.Id,
            ExpiresAt  = expiresAt ?? DateTime.UtcNow.AddDays(30),
            CreatedAt  = DateTime.UtcNow,
        };
        db.RefreshTokens.Add(token);
        await db.SaveChangesAsync();

        return (user, token);
    }

    private static HttpClient ClientWithCookie(TournamentOrganizerFactory f, string cookieValue)
    {
        var client = f.CreateClient(new Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactoryClientOptions
        {
            HandleCookies = true,
        });
        client.DefaultRequestHeaders.Add("Cookie", $"{RefreshCookieName}={cookieValue}");
        return client;
    }

    // ── Tests ─────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Refresh_Returns401_WhenNoCookiePresent()
    {
        var client = factory.CreateClient();

        var response = await client.PostAsync("/api/auth/refresh", null);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Refresh_Returns401_WhenTokenIsInvalid()
    {
        var client = ClientWithCookie(factory, "not-a-real-token");

        var response = await client.PostAsync("/api/auth/refresh", null);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Refresh_Returns200WithNewJwt_WhenTokenIsValid()
    {
        var (_, token) = await SeedActiveTokenAsync();
        var client = ClientWithCookie(factory, token.Token);

        var response = await client.PostAsync("/api/auth/refresh", null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<RefreshResponseDto>();
        Assert.False(string.IsNullOrEmpty(body?.Token));
    }

    [Fact]
    public async Task Refresh_RotatesToken_OldTokenNoLongerWorks()
    {
        var (_, token) = await SeedActiveTokenAsync();
        var client = ClientWithCookie(factory, token.Token);

        // First refresh succeeds
        var first = await client.PostAsync("/api/auth/refresh", null);
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);

        // Second refresh with the same (now revoked) token must fail
        var second = await client.PostAsync("/api/auth/refresh", null);
        Assert.Equal(HttpStatusCode.Unauthorized, second.StatusCode);
    }

    [Fact]
    public async Task Logout_RevokesToken_RefreshNoLongerWorks()
    {
        var (_, token) = await SeedActiveTokenAsync();
        var client = ClientWithCookie(factory, token.Token);

        var logoutResponse = await client.PostAsync("/api/auth/logout", null);
        Assert.Equal(HttpStatusCode.NoContent, logoutResponse.StatusCode);

        var refreshResponse = await client.PostAsync("/api/auth/refresh", null);
        Assert.Equal(HttpStatusCode.Unauthorized, refreshResponse.StatusCode);
    }

    // local DTO for deserialising the refresh response body
    private sealed record RefreshResponseDto(string Token);
}
