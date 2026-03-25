using System.Net;
using System.Net.Http.Json;
using System.Text;

namespace TournamentOrganizer.Tests;

/// <summary>
/// Verifies that a store employee/manager of store A cannot read or mutate
/// store B's data. All isolation is done manually in controllers via JWT
/// storeId claim comparisons — these tests confirm those checks hold.
///
/// Uses <see cref="TournamentOrganizerFactory"/> (InMemory DB, test JWT).
///
/// "Allowed" assertions accept any status except 401/403 — the exact code
/// (200, 400, 404) depends on whether the service layer finds data, which
/// is irrelevant for cross-store access enforcement tests.
/// </summary>
public class CrossStoreAccessTests(TournamentOrganizerFactory factory)
    : IClassFixture<TournamentOrganizerFactory>
{
    // ── Helpers ───────────────────────────────────────────────────────────────

    /// <summary>Builds a JSON StringContent, bypassing any anonymous-type serialization edge cases.</summary>
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
    // StoresController — GET /api/stores/{id}
    // StoreEmployee policy + explicit storeId ownership check
    // ══════════════════════════════════════════════════════════════════════════

    [Fact]
    public async Task Player_GetStore_Returns403()
    {
        // Player role does not satisfy StoreEmployee policy.
        var client = factory.ClientAs("Player", playerId: 1);
        var response = await client.GetAsync("/api/stores/1");
        AssertForbidden(response);
    }

    [Fact]
    public async Task Unauthenticated_GetStore_Returns401()
    {
        var client = factory.CreateClient(); // no JWT
        var response = await client.GetAsync("/api/stores/1");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task StoreEmployee_Store1_GetStore2_Returns403()
    {
        var client = factory.ClientAs("StoreEmployee", storeId: 1);
        var response = await client.GetAsync("/api/stores/2");
        AssertForbidden(response);
    }

    [Fact]
    public async Task StoreEmployee_GetOwnStore_IsAllowed()
    {
        var client = factory.ClientAs("StoreEmployee", storeId: 1);
        var response = await client.GetAsync("/api/stores/1");
        AssertAllowed(response);
    }

    [Fact]
    public async Task Administrator_GetAnyStore_IsAllowed()
    {
        var client = factory.ClientAs("Administrator");
        var response = await client.GetAsync("/api/stores/2");
        AssertAllowed(response);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // StoresController — PUT /api/stores/{id}
    // StoreManager policy + explicit storeId ownership check
    // ══════════════════════════════════════════════════════════════════════════

    [Fact]
    public async Task StoreManager_Store1_UpdateStore2_Returns403()
    {
        var client = factory.ClientAs("StoreManager", storeId: 1);
        // Send required DTO fields explicitly so model validation passes and
        // the ownership check (jwtStoreId != id → Forbid) is reached.
        var response = await client.PutAsync("/api/stores/2",
            Json("""{"storeName":"Hack","allowableTradeDifferential":0.0}"""));
        AssertForbidden(response);
    }

    [Fact]
    public async Task StoreEmployee_Store1_UpdateStore2_Returns403()
    {
        // StoreEmployee lacks the StoreManager policy — 403 from policy layer.
        var client = factory.ClientAs("StoreEmployee", storeId: 1);
        var response = await client.PutAsync("/api/stores/2",
            Json("""{"storeName":"Hack","allowableTradeDifferential":0.0}"""));
        AssertForbidden(response);
    }

    [Fact]
    public async Task Administrator_UpdateAnyStore_IsAllowed()
    {
        var client = factory.ClientAs("Administrator");
        var response = await client.PutAsync("/api/stores/2",
            Json("""{"storeName":"Admin Update","allowableTradeDifferential":0.0}"""));
        AssertAllowed(response);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // StoresController — GET /api/stores/{id}/meta
    // StoreEmployee policy + explicit storeId ownership check
    // ══════════════════════════════════════════════════════════════════════════

    [Fact]
    public async Task StoreEmployee_Store1_GetMeta_Store2_Returns403()
    {
        var client = factory.ClientAs("StoreEmployee", storeId: 1);
        var response = await client.GetAsync("/api/stores/2/meta");
        AssertForbidden(response);
    }

    [Fact]
    public async Task StoreManager_Store1_GetMeta_Store2_Returns403()
    {
        var client = factory.ClientAs("StoreManager", storeId: 1);
        var response = await client.GetAsync("/api/stores/2/meta");
        AssertForbidden(response);
    }

    [Fact]
    public async Task Administrator_GetMeta_AnyStore_IsAllowed()
    {
        var client = factory.ClientAs("Administrator");
        var response = await client.GetAsync("/api/stores/2/meta");
        AssertAllowed(response);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // StoresController — POST /api/stores/{id}/discord/test
    // StoreManager policy + explicit storeId ownership check
    // ══════════════════════════════════════════════════════════════════════════

    [Fact]
    public async Task StoreManager_Store1_TestDiscord_Store2_Returns403()
    {
        var client = factory.ClientAs("StoreManager", storeId: 1);
        var response = await client.PostAsync("/api/stores/2/discord/test", null);
        AssertForbidden(response);
    }

    [Fact]
    public async Task Administrator_TestDiscord_AnyStore_IsAllowed()
    {
        var client = factory.ClientAs("Administrator");
        var response = await client.PostAsync("/api/stores/2/discord/test", null);
        AssertAllowed(response);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // AppUsersController — GET /api/stores/{storeId}/employees
    // StoreManager policy + CanAccessStore check
    // ══════════════════════════════════════════════════════════════════════════

    [Fact]
    public async Task StoreManager_Store1_GetEmployees_Store2_Returns403()
    {
        var client = factory.ClientAs("StoreManager", storeId: 1);
        var response = await client.GetAsync("/api/stores/2/employees");
        AssertForbidden(response);
    }

    [Fact]
    public async Task StoreManager_Store1_GetOwnEmployees_IsAllowed()
    {
        var client = factory.ClientAs("StoreManager", storeId: 1, licenseTier: "Tier1");
        var response = await client.GetAsync("/api/stores/1/employees");
        AssertAllowed(response);
    }

    [Fact]
    public async Task Administrator_GetEmployees_AnyStore_IsAllowed()
    {
        var client = factory.ClientAs("Administrator");
        var response = await client.GetAsync("/api/stores/2/employees");
        AssertAllowed(response);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // AppUsersController — POST /api/stores/{storeId}/employees
    // StoreManager policy + CanAccessStore check
    // ══════════════════════════════════════════════════════════════════════════

    [Fact]
    public async Task StoreManager_Store1_AddEmployee_Store2_Returns403()
    {
        var client = factory.ClientAs("StoreManager", storeId: 1);
        var response = await client.PostAsJsonAsync("/api/stores/2/employees",
            new { email = "new@example.com", role = "StoreEmployee" });
        AssertForbidden(response);
    }

    [Fact]
    public async Task StoreManager_Store1_AddEmployee_OwnStore_IsAllowed()
    {
        var client = factory.ClientAs("StoreManager", storeId: 1, licenseTier: "Tier1");
        var response = await client.PostAsJsonAsync("/api/stores/1/employees",
            new { email = "new@example.com", role = "StoreEmployee" });
        AssertAllowed(response);
    }

    [Fact]
    public async Task Administrator_AddEmployee_AnyStore_IsAllowed()
    {
        var client = factory.ClientAs("Administrator");
        var response = await client.PostAsJsonAsync("/api/stores/2/employees",
            new { email = "new@example.com", role = "StoreEmployee" });
        AssertAllowed(response);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // AppUsersController — DELETE /api/stores/{storeId}/employees/{userId}
    // StoreManager policy + CanAccessStore check
    // ══════════════════════════════════════════════════════════════════════════

    [Fact]
    public async Task StoreManager_Store1_RemoveEmployee_Store2_Returns403()
    {
        var client = factory.ClientAs("StoreManager", storeId: 1);
        var response = await client.DeleteAsync("/api/stores/2/employees/99");
        AssertForbidden(response);
    }

    [Fact]
    public async Task Administrator_RemoveEmployee_AnyStore_IsAllowed()
    {
        // Admin passes CanAccessStore; user 99 doesn't exist → 404, not 403.
        var client = factory.ClientAs("Administrator");
        var response = await client.DeleteAsync("/api/stores/2/employees/99");
        AssertAllowed(response);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // EventsController — cross-store event management
    // UserCanManageEvent: returns false when event's storeId ≠ JWT storeId.
    // With an empty InMemory DB, GetStoreIdForEventAsync returns null, so the
    // check evaluates to false for any non-admin — same as a cross-store event.
    // ══════════════════════════════════════════════════════════════════════════

    [Fact]
    public async Task StoreEmployee_Store1_UpdateStatusForStore2Event_Returns403()
    {
        // Event 99 belongs to store 2 (or doesn't exist) — either way,
        // UserCanManageEvent returns false for store-1 employee.
        var client = factory.ClientAs("StoreEmployee", storeId: 1);
        var response = await client.PutAsJsonAsync("/api/events/99/status",
            new { status = "InProgress" });
        AssertForbidden(response);
    }

    [Fact]
    public async Task Administrator_UpdateStatus_AnyEvent_IsAllowed()
    {
        // Admin bypasses UserCanManageEvent → reaches service → 404 (no data).
        var client = factory.ClientAs("Administrator");
        var response = await client.PutAsJsonAsync("/api/events/99/status",
            new { status = "InProgress" });
        AssertAllowed(response);
    }

    [Fact]
    public async Task StoreEmployee_Store1_GenerateRound_Store2Event_Returns403()
    {
        var client = factory.ClientAs("StoreEmployee", storeId: 1);
        var response = await client.PostAsync("/api/events/99/rounds", null);
        AssertForbidden(response);
    }

    [Fact]
    public async Task Administrator_GenerateRound_AnyEvent_IsAllowed()
    {
        var client = factory.ClientAs("Administrator");
        var response = await client.PostAsync("/api/events/99/rounds", null);
        AssertAllowed(response);
    }

    [Fact]
    public async Task StoreEmployee_Store1_DisqualifyPlayer_Store2Event_Returns403()
    {
        var client = factory.ClientAs("StoreEmployee", storeId: 1);
        var response = await client.PostAsync("/api/events/99/players/1/disqualify", null);
        AssertForbidden(response);
    }

    [Fact]
    public async Task Administrator_DisqualifyPlayer_AnyEvent_IsAllowed()
    {
        var client = factory.ClientAs("Administrator");
        var response = await client.PostAsync("/api/events/99/players/1/disqualify", null);
        AssertAllowed(response);
    }

    [Fact]
    public async Task StoreEmployee_Store1_DeleteEvent_Store2_Returns403()
    {
        var client = factory.ClientAs("StoreEmployee", storeId: 1);
        var response = await client.DeleteAsync("/api/events/99");
        AssertForbidden(response);
    }

    [Fact]
    public async Task Administrator_DeleteEvent_AnyStore_IsAllowed()
    {
        var client = factory.ClientAs("Administrator");
        var response = await client.DeleteAsync("/api/events/99");
        AssertAllowed(response);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // EventsController — POST /api/events (create)
    // StoreEmployee policy: controller ignores requested storeId and forces
    // the JWT storeId, so a cross-store create attempt is silently rewritten —
    // not a 403 but the body storeId is overridden. Verify the override fires
    // by confirming the request is accepted (not 401/403) and that requesting
    // a different store does NOT result in a 403 (the guard is not a Forbid,
    // it's a silent override enforced by the service layer).
    // ══════════════════════════════════════════════════════════════════════════

    [Fact]
    public async Task StoreEmployee_Store1_CreateEvent_BodyStoreId2_IsAccepted()
    {
        // The controller overwrites dto.StoreId with the JWT storeId (1),
        // ignoring the requested storeId=2. Result: service is called with
        // storeId=1 — not a 403. Service may fail with DB error; we just
        // verify the policy/ownership layer doesn't Forbid the request.
        var client = factory.ClientAs("StoreEmployee", storeId: 1);
        var response = await client.PostAsJsonAsync("/api/events",
            new { name = "Test Event", storeId = 2, date = DateTime.UtcNow, format = "Commander" });
        AssertAllowed(response);
    }
}
