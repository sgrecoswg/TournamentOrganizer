using System.Net;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using TournamentOrganizer.Api.Data;

namespace TournamentOrganizer.Tests;

/// <summary>
/// Verifies that the global exception handler is environment-gated:
/// Production uses UseExceptionHandler("/error") → ErrorController (ProblemDetails),
/// Development uses UseDeveloperExceptionPage.
/// OWASP A05:2021 — Security Misconfiguration.
/// </summary>
public class GlobalExceptionHandlerTests
{
    private static HttpClient CreateClientForEnvironment(string environment)
    {
        var factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(b =>
            {
                b.UseEnvironment(environment);
                b.ConfigureAppConfiguration((_, cfg) =>
                {
                    cfg.AddInMemoryCollection(new Dictionary<string, string?>
                    {
                        ["Jwt:Key"]                            = TournamentOrganizerFactory.JwtKey,
                        ["Jwt:Issuer"]                         = TournamentOrganizerFactory.JwtIssuer,
                        ["Jwt:Audience"]                       = TournamentOrganizerFactory.JwtAudience,
                        ["Jwt:ExpiryMinutes"]                  = "60",
                        ["Google:ClientId"]                    = "test-google-client-id",
                        ["Google:ClientSecret"]                = "test-google-client-secret",
                        ["ConnectionStrings:DefaultConnection"] = "Server=unused;Database=unused",
                        ["Cors:AllowedOrigin"]                 = "https://app.example.com",
                    });
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
                        opts.UseInMemoryDatabase("ExceptionHandlerTestsDb_" + environment));
                });
            });

        return factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
        });
    }

    /// <summary>
    /// GET /error in Production must return HTTP 500 with a ProblemDetails JSON body.
    /// This verifies ErrorController is wired up and returns the correct shape.
    /// </summary>
    [Fact]
    public async Task Production_ErrorRoute_Returns500WithProblemDetails()
    {
        var client = CreateClientForEnvironment("Production");
        var response = await client.GetAsync("/error");

        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);

        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains("\"status\":500", body);
        Assert.Contains("An unexpected error occurred.", body);
    }

    /// <summary>
    /// GET /error in Production must NOT expose internal details (stack traces, exception type names).
    /// </summary>
    [Fact]
    public async Task Production_ErrorRoute_DoesNotLeakInternalDetails()
    {
        var client = CreateClientForEnvironment("Production");
        var response = await client.GetAsync("/error");

        var body = await response.Content.ReadAsStringAsync();
        Assert.DoesNotContain("Exception", body);
        Assert.DoesNotContain("   at ", body);
        Assert.DoesNotContain("StackTrace", body);
    }

    /// <summary>
    /// GET /error in Development must also return a safe response (ErrorController still handles it
    /// in Dev since UseDeveloperExceptionPage only activates on unhandled exceptions, not the /error route).
    /// Primarily verifies the route exists in both environments.
    /// </summary>
    [Fact]
    public async Task Development_ErrorRoute_Returns500()
    {
        var client = CreateClientForEnvironment("Development");
        var response = await client.GetAsync("/error");

        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
    }
}
