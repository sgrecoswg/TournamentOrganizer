using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using TournamentOrganizer.Api.Data;

namespace TournamentOrganizer.Tests;

// ── Test factory ──────────────────────────────────────────────────────────────

/// <summary>
/// Boots the real ASP.NET Core pipeline with an InMemory database and a
/// known JWT key so we can verify authorization policies end-to-end.
/// </summary>
public class TournamentOrganizerFactory : WebApplicationFactory<Program>
{
    internal const string JwtKey      = "test-super-secret-key-for-policy-tests-only!!"; // ≥32 chars
    internal const string JwtIssuer   = "test-issuer";
    internal const string JwtAudience = "test-audience";

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        // Override app configuration with test-safe values
        builder.ConfigureAppConfiguration((_, cfg) =>
        {
            cfg.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Key"]                            = JwtKey,
                ["Jwt:Issuer"]                         = JwtIssuer,
                ["Jwt:Audience"]                       = JwtAudience,
                ["Jwt:ExpiryMinutes"]                  = "60",
                ["Google:ClientId"]                    = "test-google-client-id",
                ["Google:ClientSecret"]                = "test-google-client-secret",
                ["ConnectionStrings:DefaultConnection"] = "Server=unused;Database=unused",
            });
        });

        // Replace SQL Server DbContext with InMemory
        builder.ConfigureServices(services =>
        {
            var descriptor = services.SingleOrDefault(
                d => d.ServiceType == typeof(DbContextOptions<AppDbContext>));
            if (descriptor != null) services.Remove(descriptor);

            services.AddDbContext<AppDbContext>(opts =>
                opts.UseInMemoryDatabase("PolicyTestsDb"));
        });
    }

    /// <summary>Creates a signed JWT for the given role, with optional storeId / playerId claims.</summary>
    public string MakeToken(string role, int? storeId = null, int? playerId = null)
    {
        var key   = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(JwtKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub,   "1"),
            new(JwtRegisteredClaimNames.Email, "test@example.com"),
            new(JwtRegisteredClaimNames.Name,  "Test User"),
            new("role", role),
        };
        if (storeId.HasValue)  claims.Add(new("storeId",  storeId.Value.ToString()));
        if (playerId.HasValue) claims.Add(new("playerId", playerId.Value.ToString()));

        var token = new JwtSecurityToken(
            issuer:             JwtIssuer,
            audience:           JwtAudience,
            claims:             claims,
            expires:            DateTime.UtcNow.AddHours(1),
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    /// <summary>Returns an HttpClient with a Bearer token for the specified role.</summary>
    public HttpClient ClientAs(string role, int? storeId = null, int? playerId = null)
    {
        var client = CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", MakeToken(role, storeId, playerId));
        return client;
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

/// <summary>
/// Verifies that ASP.NET Core authorization policies block the correct roles
/// and allow the correct ones, using the real middleware pipeline.
///
/// "Allows" assertions check for anything other than 401/403 — the exact
/// status (200, 400, 404) depends on whether the service layer finds data,
/// which is irrelevant for policy enforcement tests.
/// </summary>
public class AuthorizationPolicyTests(TournamentOrganizerFactory factory)
    : IClassFixture<TournamentOrganizerFactory>
{
    // ── Helpers ───────────────────────────────────────────────────────────────

    private static void AssertAllowed(HttpResponseMessage response) =>
        Assert.True(
            response.StatusCode != HttpStatusCode.Unauthorized &&
            response.StatusCode != HttpStatusCode.Forbidden,
            $"Expected allowed (not 401/403) but got {(int)response.StatusCode}");

    private static void AssertForbidden(HttpResponseMessage response) =>
        Assert.True(
            response.StatusCode == HttpStatusCode.Forbidden,
            $"Expected 403 Forbidden but got {(int)response.StatusCode}");

    private static void AssertUnauthorized(HttpResponseMessage response) =>
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);

    // ══════════════════════════════════════════════════════════════════════════
    // Unauthenticated → 401 on any [Authorize] endpoint
    // ══════════════════════════════════════════════════════════════════════════

    [Fact]
    public async Task Unauthenticated_AuthMe_Returns401()
    {
        var client = factory.CreateClient();
        var response = await client.GetAsync("/api/auth/me");
        AssertUnauthorized(response);
    }

    [Fact]
    public async Task Unauthenticated_CreateEvent_Returns401()
    {
        var client = factory.CreateClient();
        var response = await client.PostAsJsonAsync("/api/events", new { name = "test" });
        AssertUnauthorized(response);
    }

    [Fact]
    public async Task Unauthenticated_CreateStore_Returns401()
    {
        var client = factory.CreateClient();
        var response = await client.PostAsJsonAsync("/api/stores", new { name = "test" });
        AssertUnauthorized(response);
    }

    [Fact]
    public async Task Unauthenticated_GetAllUsers_Returns401()
    {
        var client = factory.CreateClient();
        var response = await client.GetAsync("/api/users");
        AssertUnauthorized(response);
    }

    [Fact]
    public async Task Unauthenticated_UpdateUserRole_Returns401()
    {
        var client = factory.CreateClient();
        var response = await client.PutAsJsonAsync("/api/users/1/role", new { role = "Player" });
        AssertUnauthorized(response);
    }

    [Fact]
    public async Task Unauthenticated_GetStoreEmployees_Returns401()
    {
        var client = factory.CreateClient();
        var response = await client.GetAsync("/api/stores/1/employees");
        AssertUnauthorized(response);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // StoreEmployee policy — requires StoreEmployee | StoreManager | Administrator
    // ══════════════════════════════════════════════════════════════════════════

    [Fact]
    public async Task Player_CreateEvent_Returns403()
    {
        var client = factory.ClientAs("Player");
        var response = await client.PostAsJsonAsync("/api/events", new { name = "test" });
        AssertForbidden(response);
    }

    [Fact]
    public async Task StoreEmployee_CreateEvent_IsAllowed()
    {
        var client = factory.ClientAs("StoreEmployee", storeId: 1);
        var response = await client.PostAsJsonAsync("/api/events",
            new { name = "Test Event", storeId = 1, date = DateTime.UtcNow });
        AssertAllowed(response);
    }

    [Fact]
    public async Task StoreManager_CreateEvent_IsAllowed()
    {
        var client = factory.ClientAs("StoreManager", storeId: 1);
        var response = await client.PostAsJsonAsync("/api/events",
            new { name = "Test Event", storeId = 1, date = DateTime.UtcNow });
        AssertAllowed(response);
    }

    [Fact]
    public async Task Administrator_CreateEvent_IsAllowed()
    {
        var client = factory.ClientAs("Administrator");
        var response = await client.PostAsJsonAsync("/api/events",
            new { name = "Test Event", storeId = 1, date = DateTime.UtcNow });
        AssertAllowed(response);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // StoreManager policy — requires StoreManager | Administrator
    // ══════════════════════════════════════════════════════════════════════════

    [Fact]
    public async Task Player_UpdateStore_Returns403()
    {
        var client = factory.ClientAs("Player");
        var response = await client.PutAsJsonAsync("/api/stores/1", new { name = "test" });
        AssertForbidden(response);
    }

    [Fact]
    public async Task StoreEmployee_UpdateStore_Returns403()
    {
        var client = factory.ClientAs("StoreEmployee", storeId: 1);
        var response = await client.PutAsJsonAsync("/api/stores/1", new { name = "test" });
        AssertForbidden(response);
    }

    [Fact]
    public async Task StoreManager_UpdateOwnStore_IsAllowed()
    {
        var client = factory.ClientAs("StoreManager", storeId: 1);
        var response = await client.PutAsJsonAsync("/api/stores/1", new { name = "test" });
        AssertAllowed(response);
    }

    [Fact]
    public async Task Administrator_UpdateStore_IsAllowed()
    {
        var client = factory.ClientAs("Administrator");
        var response = await client.PutAsJsonAsync("/api/stores/1", new { name = "test" });
        AssertAllowed(response);
    }

    [Fact]
    public async Task Player_GetStoreEmployees_Returns403()
    {
        var client = factory.ClientAs("Player");
        var response = await client.GetAsync("/api/stores/1/employees");
        AssertForbidden(response);
    }

    [Fact]
    public async Task StoreEmployee_GetStoreEmployees_Returns403()
    {
        var client = factory.ClientAs("StoreEmployee", storeId: 1);
        var response = await client.GetAsync("/api/stores/1/employees");
        AssertForbidden(response);
    }

    [Fact]
    public async Task StoreManager_GetOwnStoreEmployees_IsAllowed()
    {
        var client = factory.ClientAs("StoreManager", storeId: 1);
        var response = await client.GetAsync("/api/stores/1/employees");
        AssertAllowed(response);
    }

    [Fact]
    public async Task Administrator_GetStoreEmployees_IsAllowed()
    {
        var client = factory.ClientAs("Administrator");
        var response = await client.GetAsync("/api/stores/1/employees");
        AssertAllowed(response);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Administrator policy — requires Administrator only
    // ══════════════════════════════════════════════════════════════════════════

    [Fact]
    public async Task Player_GetAllUsers_Returns403()
    {
        var client = factory.ClientAs("Player");
        var response = await client.GetAsync("/api/users");
        AssertForbidden(response);
    }

    [Fact]
    public async Task StoreEmployee_GetAllUsers_Returns403()
    {
        var client = factory.ClientAs("StoreEmployee", storeId: 1);
        var response = await client.GetAsync("/api/users");
        AssertForbidden(response);
    }

    [Fact]
    public async Task StoreManager_GetAllUsers_Returns403()
    {
        var client = factory.ClientAs("StoreManager", storeId: 1);
        var response = await client.GetAsync("/api/users");
        AssertForbidden(response);
    }

    [Fact]
    public async Task Administrator_GetAllUsers_IsAllowed()
    {
        var client = factory.ClientAs("Administrator");
        var response = await client.GetAsync("/api/users");
        AssertAllowed(response);
    }

    [Fact]
    public async Task Player_UpdateUserRole_Returns403()
    {
        var client = factory.ClientAs("Player");
        var response = await client.PutAsJsonAsync("/api/users/1/role", new { role = "Player" });
        AssertForbidden(response);
    }

    [Fact]
    public async Task StoreEmployee_UpdateUserRole_Returns403()
    {
        var client = factory.ClientAs("StoreEmployee", storeId: 1);
        var response = await client.PutAsJsonAsync("/api/users/1/role", new { role = "Player" });
        AssertForbidden(response);
    }

    [Fact]
    public async Task StoreManager_UpdateUserRole_Returns403()
    {
        var client = factory.ClientAs("StoreManager", storeId: 1);
        var response = await client.PutAsJsonAsync("/api/users/1/role", new { role = "Player" });
        AssertForbidden(response);
    }

    [Fact]
    public async Task Administrator_UpdateUserRole_IsAllowed()
    {
        var client = factory.ClientAs("Administrator");
        var response = await client.PutAsJsonAsync("/api/users/1/role", new { role = "Player" });
        AssertAllowed(response);
    }

    [Fact]
    public async Task Player_CreateStore_Returns403()
    {
        var client = factory.ClientAs("Player");
        var response = await client.PostAsJsonAsync("/api/stores", new { name = "test" });
        AssertForbidden(response);
    }

    [Fact]
    public async Task StoreEmployee_CreateStore_Returns403()
    {
        var client = factory.ClientAs("StoreEmployee", storeId: 1);
        var response = await client.PostAsJsonAsync("/api/stores", new { name = "test" });
        AssertForbidden(response);
    }

    [Fact]
    public async Task StoreManager_CreateStore_Returns403()
    {
        var client = factory.ClientAs("StoreManager", storeId: 1);
        var response = await client.PostAsJsonAsync("/api/stores", new { name = "test" });
        AssertForbidden(response);
    }

    [Fact]
    public async Task Administrator_CreateStore_IsAllowed()
    {
        var client = factory.ClientAs("Administrator");
        var response = await client.PostAsJsonAsync("/api/stores", new { name = "Test Store" });
        AssertAllowed(response);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // [Authorize] (no policy) — any authenticated user
    // ══════════════════════════════════════════════════════════════════════════

    [Fact]
    public async Task Player_AuthMe_IsAllowed()
    {
        var client = factory.ClientAs("Player", playerId: 1);
        var response = await client.GetAsync("/api/auth/me");
        AssertAllowed(response);
    }

    [Fact]
    public async Task StoreEmployee_AuthMe_IsAllowed()
    {
        var client = factory.ClientAs("StoreEmployee", storeId: 1);
        var response = await client.GetAsync("/api/auth/me");
        AssertAllowed(response);
    }

    [Fact]
    public async Task Administrator_AuthMe_IsAllowed()
    {
        var client = factory.ClientAs("Administrator");
        var response = await client.GetAsync("/api/auth/me");
        AssertAllowed(response);
    }
}
