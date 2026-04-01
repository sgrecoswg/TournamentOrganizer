using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using TournamentOrganizer.Api.Data;

namespace TournamentOrganizer.Tests;

/// <summary>
/// Verifies that the CORS policy only permits localhost:4200 in Development,
/// and uses a configured origin in Production.
/// OWASP A05:2021 — Security Misconfiguration.
/// </summary>
public class CorsEnvironmentGatingTests
{
    private static HttpClient CreateClientForEnvironment(string environment, Dictionary<string, string?> extraConfig)
    {
        var factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(b =>
            {
                b.UseEnvironment(environment);
                b.ConfigureAppConfiguration((_, cfg) =>
                {
                    var merged = new Dictionary<string, string?>
                    {
                        ["Jwt:Key"]                            = TournamentOrganizerFactory.JwtKey,
                        ["Jwt:Issuer"]                         = TournamentOrganizerFactory.JwtIssuer,
                        ["Jwt:Audience"]                       = TournamentOrganizerFactory.JwtAudience,
                        ["Jwt:ExpiryMinutes"]                  = "60",
                        ["Google:ClientId"]                    = "test-google-client-id",
                        ["Google:ClientSecret"]                = "test-google-client-secret",
                        ["ConnectionStrings:DefaultConnection"] = "Server=unused;Database=unused",
                    };
                    foreach (var kv in extraConfig) merged[kv.Key] = kv.Value;
                    cfg.AddInMemoryCollection(merged);
                });
                b.ConfigureServices(services =>
                {
                    var toRemove = services
                        .Where(d =>
                            d.ServiceType == typeof(DbContextOptions<AppDbContext>) ||
                            d.ServiceType == typeof(DbContextOptions) ||
                            d.ServiceType == typeof(AppDbContext) ||
                            d.ServiceType == typeof(IDbContextOptionsConfiguration<AppDbContext>))
                        .ToList();
                    foreach (var d in toRemove) services.Remove(d);
                    services.AddDbContext<AppDbContext>(opts =>
                        opts.UseInMemoryDatabase("CorsTestsDb_" + environment));
                });
            });

        return factory.CreateClient();
    }

    [Fact]
    public async Task Development_LocalhostOrigin_IsPermitted()
    {
        var client = CreateClientForEnvironment("Development", new Dictionary<string, string?>());
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/players");
        request.Headers.Add("Origin", "http://localhost:4200");

        var response = await client.SendAsync(request);

        Assert.True(
            response.Headers.Contains("Access-Control-Allow-Origin"),
            "Expected CORS header to be present for localhost:4200 in Development.");

        var allowedOrigin = response.Headers.GetValues("Access-Control-Allow-Origin").FirstOrDefault();
        Assert.Equal("http://localhost:4200", allowedOrigin);
    }

    [Fact]
    public async Task Production_LocalhostOrigin_IsNotPermitted()
    {
        var client = CreateClientForEnvironment("Production", new Dictionary<string, string?>
        {
            ["Cors:AllowedOrigin"] = "https://app.example.com",
        });
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/players");
        request.Headers.Add("Origin", "http://localhost:4200");

        var response = await client.SendAsync(request);

        // When origin is not allowed, the ACAO header should be absent or not match localhost
        if (response.Headers.Contains("Access-Control-Allow-Origin"))
        {
            var allowedOrigin = response.Headers.GetValues("Access-Control-Allow-Origin").FirstOrDefault();
            Assert.NotEqual("http://localhost:4200", allowedOrigin);
        }
        // If no header at all, the assertion passes implicitly
    }

    [Fact]
    public async Task Production_ConfiguredOrigin_IsPermitted()
    {
        var client = CreateClientForEnvironment("Production", new Dictionary<string, string?>
        {
            ["Cors:AllowedOrigin"] = "https://app.example.com",
        });
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/players");
        request.Headers.Add("Origin", "https://app.example.com");

        var response = await client.SendAsync(request);

        Assert.True(
            response.Headers.Contains("Access-Control-Allow-Origin"),
            "Expected CORS header to allow the configured production origin.");

        var allowedOrigin = response.Headers.GetValues("Access-Control-Allow-Origin").FirstOrDefault();
        Assert.Equal("https://app.example.com", allowedOrigin);
    }
}
