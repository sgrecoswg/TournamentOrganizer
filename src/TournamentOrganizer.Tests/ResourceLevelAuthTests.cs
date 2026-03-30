using System.Net;
using System.Net.Http.Json;
using System.Text;

namespace TournamentOrganizer.Tests;

/// <summary>
/// Verifies the manual resource-level authorization checks inside controllers —
/// logic beyond policy attributes (e.g. "Player can only register themselves",
/// "StoreManager can only update their own store").
///
/// Uses <see cref="TournamentOrganizerFactory"/> (InMemory DB, test JWT).
/// "Allowed" means any status except 401/403 — the exact code (200/400/404)
/// depends on whether the service layer finds data, which is irrelevant here.
/// </summary>
public class ResourceLevelAuthTests(TournamentOrganizerFactory factory)
    : IClassFixture<TournamentOrganizerFactory>
{
    private static StringContent Json(string json) =>
        new(json, Encoding.UTF8, "application/json");

    private static void AssertAllowed(HttpResponseMessage response) =>
        Assert.True(
            response.StatusCode != HttpStatusCode.Unauthorized &&
            response.StatusCode != HttpStatusCode.Forbidden,
            $"Expected allowed (not 401/403) but got {(int)response.StatusCode}");

    private static void AssertForbidden(HttpResponseMessage response) =>
        Assert.True(
            response.StatusCode == HttpStatusCode.Forbidden,
            $"Expected 403 Forbidden but got {(int)response.StatusCode}");

    // ══════════════════════════════════════════════════════════════════════════
    // EventsController — POST /api/events/{id}/register
    // [Authorize] (no policy) + manual playerId equality check for Player role
    // ══════════════════════════════════════════════════════════════════════════

    [Fact]
    public async Task Player_RegisterSelf_IsAllowed()
    {
        // Player with playerId=1 registers themselves for event 99
        // Auth check passes; service may return 400/404 — that's acceptable.
        var client = factory.ClientAs("Player", playerId: 1);
        var response = await client.PostAsJsonAsync("/api/events/99/register",
            new { playerId = 1, decklistUrl = (string?)null, commanders = (string?)null });
        AssertAllowed(response);
    }

    [Fact]
    public async Task Player_RegisterDifferentPlayer_Returns403()
    {
        // Player with playerId=1 tries to register playerId=2 → ownership check fails
        var client = factory.ClientAs("Player", playerId: 1);
        var response = await client.PostAsJsonAsync("/api/events/99/register",
            new { playerId = 2, decklistUrl = (string?)null, commanders = (string?)null });
        AssertForbidden(response);
    }

    [Fact]
    public async Task Administrator_RegisterAnyPlayer_IsAllowed()
    {
        // Admin bypasses UserCanManageEvent; may fail at service layer (404) — that's fine
        var client = factory.ClientAs("Administrator");
        var response = await client.PostAsJsonAsync("/api/events/99/register",
            new { playerId = 2, decklistUrl = (string?)null, commanders = (string?)null });
        AssertAllowed(response);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // StoresController — PUT /api/stores/{id}
    // [StoreManager + Tier1Required] + explicit storeId ownership check
    // Happy-path: StoreManager updating their OWN store (already covered for 403 cross-store)
    // ══════════════════════════════════════════════════════════════════════════

    [Fact]
    public async Task StoreManager_UpdateOwnStore_IsAllowed()
    {
        var client = factory.ClientAs("StoreManager", storeId: 1, licenseTier: "Tier1");
        var response = await client.PutAsync("/api/stores/1",
            Json("""{"storeName":"My Store","allowableTradeDifferential":0.0}"""));
        AssertAllowed(response);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // StoresController — GET /api/stores/{id}/meta
    // [StoreEmployee] + explicit storeId ownership check
    // Happy-path: Employee reading their OWN store's meta
    // ══════════════════════════════════════════════════════════════════════════

    [Fact]
    public async Task StoreEmployee_GetOwnMeta_IsAllowed()
    {
        var client = factory.ClientAs("StoreEmployee", storeId: 1);
        var response = await client.GetAsync("/api/stores/1/meta");
        AssertAllowed(response);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // AppUsersController — PUT /api/users/{userId}/role
    // [Administrator only] — StoreManager gets 403 from policy layer
    // ══════════════════════════════════════════════════════════════════════════

    [Fact]
    public async Task Administrator_UpdateUserRole_IsAllowed()
    {
        // Admin reaches the service layer; user 99 doesn't exist → 400/404, not 403
        var client = factory.ClientAs("Administrator");
        var response = await client.PutAsJsonAsync("/api/users/99/role",
            new { role = "Player" });
        AssertAllowed(response);
    }

    [Fact]
    public async Task StoreManager_UpdateUserRole_Returns403()
    {
        // UpdateRole requires Administrator policy — StoreManager cannot escalate roles
        var client = factory.ClientAs("StoreManager", storeId: 1);
        var response = await client.PutAsJsonAsync("/api/users/99/role",
            new { role = "Administrator" });
        AssertForbidden(response);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // StoreAnalyticsController — GET /api/stores/{storeId}/analytics
    // [Tier3Required] + ownership guard (Issue #86)
    // ══════════════════════════════════════════════════════════════════════════

    [Fact]
    public async Task Tier3StoreEmployee_GetOwnAnalytics_IsAllowed()
    {
        // StoreEmployee with storeId=1 and Tier3 license reads their own analytics
        var client = factory.ClientAs("StoreEmployee", storeId: 1, licenseTier: "Tier3");
        var response = await client.GetAsync("/api/stores/1/analytics");
        AssertAllowed(response);
    }

    [Fact]
    public async Task Tier3StoreEmployee_GetOtherStoreAnalytics_Returns403()
    {
        // IDOR: StoreEmployee with storeId=1 attempts to read store 2's analytics
        var client = factory.ClientAs("StoreEmployee", storeId: 1, licenseTier: "Tier3");
        var response = await client.GetAsync("/api/stores/2/analytics");
        AssertForbidden(response);
    }

    [Fact]
    public async Task Administrator_GetAnyStoreAnalytics_IsAllowed()
    {
        // Administrators bypass the ownership check
        var client = factory.ClientAs("Administrator");
        var response = await client.GetAsync("/api/stores/2/analytics");
        AssertAllowed(response);
    }
}
