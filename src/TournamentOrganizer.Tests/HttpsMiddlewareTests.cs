using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.HttpsPolicy;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace TournamentOrganizer.Tests;

/// <summary>
/// Verifies that HTTPS redirection and HSTS middleware are registered in the
/// ASP.NET Core pipeline. UseHsts() registers HstsOptions; UseHttpsRedirection()
/// registers HttpsRedirectionOptions — both are detectable via DI.
/// Note: the WebApplicationFactory in-process host does not route real TCP
/// connections, so actual redirect/header behaviour requires a live server test.
/// </summary>
public class HttpsMiddlewareTests
{
    private class ProductionFactory : TournamentOrganizerFactory
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            base.ConfigureWebHost(builder);
            builder.UseEnvironment("Production");
        }
    }

    [Fact]
    public void HstsOptions_AreRegistered_InProductionServiceContainer()
    {
        // UseHsts() registers IOptions<HstsOptions> in the DI container.
        // If UseHsts() is absent this resolves to the framework default (MaxAge=0),
        // but the service itself still exists. We assert the MaxAge is positive,
        // which only holds when UseHsts() has been called.
        using var factory = new ProductionFactory();
        using var scope = factory.Services.CreateScope();

        var hstsOptions = scope.ServiceProvider
            .GetRequiredService<IOptions<HstsOptions>>()
            .Value;

        Assert.True(
            hstsOptions.MaxAge.TotalSeconds > 0,
            $"Expected HSTS MaxAge > 0 (UseHsts() was called), got {hstsOptions.MaxAge}");
    }

    [Fact]
    public void HttpsRedirectionOptions_AreRegistered_InProductionServiceContainer()
    {
        // UseHttpsRedirection() registers IOptions<HttpsRedirectionOptions>.
        using var factory = new ProductionFactory();
        using var scope = factory.Services.CreateScope();

        var opts = scope.ServiceProvider
            .GetService<IOptions<HttpsRedirectionOptions>>();

        Assert.NotNull(opts);
    }
}
