using Microsoft.Extensions.Configuration;

namespace TournamentOrganizer.Tests;

/// <summary>
/// Verifies that AllowedHosts is not a wildcard in Production configuration.
/// OWASP A05:2021 — Security Misconfiguration.
/// </summary>
public class AllowedHostsConfigTests
{
    [Fact]
    public void Production_AllowedHosts_IsNotWildcard()
    {
        var config = new ConfigurationBuilder()
            .SetBasePath(Path.Combine(Directory.GetCurrentDirectory(), "..", "..", "..", "..", "TournamentOrganizer.Api"))
            .AddJsonFile("appsettings.json", optional: false)
            .AddJsonFile("appsettings.Production.json", optional: false)
            .Build();

        var allowedHosts = config["AllowedHosts"];

        Assert.NotNull(allowedHosts);
        Assert.NotEqual("*", allowedHosts);
    }

    [Fact]
    public void Development_AllowedHosts_IsWildcard()
    {
        var config = new ConfigurationBuilder()
            .SetBasePath(Path.Combine(Directory.GetCurrentDirectory(), "..", "..", "..", "..", "TournamentOrganizer.Api"))
            .AddJsonFile("appsettings.json", optional: false)
            .Build();

        var allowedHosts = config["AllowedHosts"];

        // Base config keeps wildcard for Development flexibility
        Assert.Equal("*", allowedHosts);
    }
}
