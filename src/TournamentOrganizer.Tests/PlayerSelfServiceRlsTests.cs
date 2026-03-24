using System.Net;
using System.Net.Http.Json;
using System.Text;

namespace TournamentOrganizer.Tests;

/// <summary>
/// Verifies that a Player can only act on their own data and cannot access
/// or modify other players' records.
///
/// Uses <see cref="TournamentOrganizerFactory"/> (InMemory DB, test JWT).
/// </summary>
public class PlayerSelfServiceRlsTests(TournamentOrganizerFactory factory)
    : IClassFixture<TournamentOrganizerFactory>
{
    private static void AssertForbidden(HttpResponseMessage response) =>
        Assert.True(
            response.StatusCode == HttpStatusCode.Forbidden,
            $"Expected 403 Forbidden but got {(int)response.StatusCode}");

    private static void AssertAllowed(HttpResponseMessage response) =>
        Assert.True(
            response.StatusCode != HttpStatusCode.Unauthorized &&
            response.StatusCode != HttpStatusCode.Forbidden,
            $"Expected allowed (not 401/403) but got {(int)response.StatusCode}");

    private static MultipartFormDataContent FakeAvatarFile() =>
        new() { { new ByteArrayContent([0x89, 0x50]), "avatar", "avatar.png" } };

    // ══════════════════════════════════════════════════════════════════════════
    // POST /api/players/{id}/avatar
    // [Authorize] + UserCanManagePlayerAsync
    // ══════════════════════════════════════════════════════════════════════════

    [Fact]
    public async Task Player_UploadAvatar_OtherPlayer_Returns403()
    {
        // Player with playerId=1 (email won't match player 2) tries to upload for player 2
        var client = factory.ClientAs("Player", playerId: 1);
        var response = await client.PostAsync("/api/players/2/avatar", FakeAvatarFile());
        AssertForbidden(response);
    }

    [Fact]
    public async Task Administrator_UploadAvatar_AnyPlayer_IsAllowed()
    {
        var client = factory.ClientAs("Administrator");
        // Admin is allowed (ownership check passes); may fail at file processing — that's fine
        var response = await client.PostAsync("/api/players/1/avatar", FakeAvatarFile());
        AssertAllowed(response);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // DELETE /api/players/{id}/avatar
    // [Authorize] + UserCanManagePlayerAsync
    // ══════════════════════════════════════════════════════════════════════════

    [Fact]
    public async Task Player_RemoveAvatar_OtherPlayer_Returns403()
    {
        var client = factory.ClientAs("Player", playerId: 1);
        var response = await client.DeleteAsync("/api/players/2/avatar");
        AssertForbidden(response);
    }

    [Fact]
    public async Task Administrator_RemoveAvatar_AnyPlayer_IsAllowed()
    {
        var client = factory.ClientAs("Administrator");
        var response = await client.DeleteAsync("/api/players/1/avatar");
        AssertAllowed(response);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PUT /api/players/{id}
    // Requires [Authorize] + ownership check (currently missing — tests drive the fix)
    // ══════════════════════════════════════════════════════════════════════════

    [Fact]
    public async Task Unauthenticated_UpdatePlayer_Returns401()
    {
        var client = factory.CreateClient(); // no JWT
        var body = new StringContent("""{"name":"Hacker","email":"hack@test.com"}""",
            Encoding.UTF8, "application/json");
        var response = await client.PutAsync("/api/players/1", body);
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Player_UpdateOtherPlayer_Returns403()
    {
        // Player with playerId=1 tries to update player 2
        var client = factory.ClientAs("Player", playerId: 1);
        var body = new StringContent("""{"name":"Hacker","email":"hack@test.com"}""",
            Encoding.UTF8, "application/json");
        var response = await client.PutAsync("/api/players/2", body);
        AssertForbidden(response);
    }

    [Fact]
    public async Task Administrator_UpdateAnyPlayer_IsAllowed()
    {
        var client = factory.ClientAs("Administrator");
        var body = new StringContent("""{"name":"Admin Update","email":"admin@test.com"}""",
            Encoding.UTF8, "application/json");
        var response = await client.PutAsync("/api/players/1", body);
        AssertAllowed(response);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // GET /api/players/{id}/profile
    // Public read — no auth required; verify endpoint is accessible
    // ══════════════════════════════════════════════════════════════════════════

    [Fact]
    public async Task GetProfile_Unauthenticated_IsAllowed()
    {
        var client = factory.CreateClient(); // no JWT
        var response = await client.GetAsync("/api/players/1/profile");
        // 404 is fine (no seed data) — just not 401/403
        AssertAllowed(response);
    }
}
