using System.Net;
using System.Text;
using Microsoft.Extensions.Caching.Memory;
using TournamentOrganizer.Api.Services;
using Xunit;

namespace TournamentOrganizer.Tests;

public class CardPriceServiceTests
{
    private static CardPriceService BuildService(HttpResponseMessage response, out int callCount)
    {
        int count = 0;
        var handler = new MockHttpHandler(_ =>
        {
            count++;
            return response;
        });
        callCount = 0; // will be stale; use the ref pattern below
        var http = new HttpClient(handler) { BaseAddress = new Uri("https://api.scryfall.com/") };
        var cache = new MemoryCache(new MemoryCacheOptions());
        return new CardPriceService(http, cache);
    }

    private static (CardPriceService service, Func<int> getCallCount) BuildServiceTracked(Func<HttpRequestMessage, HttpResponseMessage> respond)
    {
        int count = 0;
        var handler = new MockHttpHandler(req => { count++; return respond(req); });
        var http = new HttpClient(handler) { BaseAddress = new Uri("https://api.scryfall.com/") };
        var cache = new MemoryCache(new MemoryCacheOptions());
        return (new CardPriceService(http, cache), () => count);
    }

    [Fact]
    public async Task GetPriceAsync_ValidResponse_ReturnsParsedPrice()
    {
        var json = """{"prices":{"usd":"2.91","usd_foil":null}}""";
        var (svc, _) = BuildServiceTracked(_ =>
            new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json")
            });

        var price = await svc.GetPriceAsync("Lightning Bolt");

        Assert.Equal(2.91m, price);
    }

    [Fact]
    public async Task GetPriceAsync_CardNotFound_ReturnsNull()
    {
        var (svc, _) = BuildServiceTracked(_ =>
            new HttpResponseMessage(HttpStatusCode.NotFound)
            {
                Content = new StringContent("{}", Encoding.UTF8, "application/json")
            });

        var price = await svc.GetPriceAsync("NonexistentCardXYZ");

        Assert.Null(price);
    }

    [Fact]
    public async Task GetPriceAsync_NullUsdPrice_ReturnsNull()
    {
        var json = """{"prices":{"usd":null,"usd_foil":null}}""";
        var (svc, _) = BuildServiceTracked(_ =>
            new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json")
            });

        var price = await svc.GetPriceAsync("Some Expensive Card");

        Assert.Null(price);
    }

    [Fact]
    public async Task GetPriceAsync_SecondCall_UsesCache()
    {
        var json = """{"prices":{"usd":"5.00"}}""";
        var (svc, getCount) = BuildServiceTracked(_ =>
            new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json")
            });

        await svc.GetPriceAsync("Sol Ring");
        await svc.GetPriceAsync("Sol Ring");

        Assert.Equal(1, getCount()); // HTTP called only once
    }

    private sealed class MockHttpHandler : HttpMessageHandler
    {
        private readonly Func<HttpRequestMessage, HttpResponseMessage> _respond;
        public MockHttpHandler(Func<HttpRequestMessage, HttpResponseMessage> respond) => _respond = respond;
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
            => Task.FromResult(_respond(request));
    }
}
