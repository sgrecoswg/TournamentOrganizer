using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;
using TournamentOrganizer.Api.Services.Interfaces;

namespace TournamentOrganizer.Api.Services;

public class CardPriceService : ICardPriceService
{
    private readonly HttpClient _http;
    private readonly IMemoryCache _cache;
    private static readonly TimeSpan CacheDuration = TimeSpan.FromHours(1);

    public CardPriceService(HttpClient http, IMemoryCache cache)
    {
        _http = http;
        _cache = cache;
    }

    public async Task<decimal?> GetPriceAsync(string cardName)
    {
        var key = $"price:{cardName.ToLowerInvariant()}";
        if (_cache.TryGetValue(key, out decimal? cached))
            return cached;

        try
        {
            var url = $"cards/named?fuzzy={Uri.EscapeDataString(cardName)}&format=json";
            var response = await _http.GetAsync(url);

            if (!response.IsSuccessStatusCode)
            {
                _cache.Set(key, (decimal?)null, CacheDuration);
                return null;
            }

            var json = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(json);

            decimal? price = null;
            if (doc.RootElement.TryGetProperty("prices", out var prices) &&
                prices.TryGetProperty("usd", out var usd) &&
                usd.ValueKind == JsonValueKind.String &&
                decimal.TryParse(usd.GetString(), System.Globalization.NumberStyles.Any,
                    System.Globalization.CultureInfo.InvariantCulture, out var parsed))
            {
                price = parsed;
            }

            _cache.Set(key, price, CacheDuration);
            return price;
        }
        catch
        {
            return null;
        }
    }
}
