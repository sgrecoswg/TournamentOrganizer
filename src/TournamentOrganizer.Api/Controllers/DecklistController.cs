using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;

namespace TournamentOrganizer.Api.Controllers;

[ApiController]
[Route("api/decklist")]
public class DecklistController : ControllerBase
{
    private readonly IHttpClientFactory _httpFactory;
    private readonly IMemoryCache _cache;
    private static readonly TimeSpan CacheDuration = TimeSpan.FromHours(24);
    private static readonly Regex MoxfieldDeckId = new(@"moxfield\.com/decks/([A-Za-z0-9_-]+)", RegexOptions.Compiled);

    public DecklistController(IHttpClientFactory httpFactory, IMemoryCache cache)
    {
        _httpFactory = httpFactory;
        _cache = cache;
    }

    [HttpGet("commanders")]
    [AllowAnonymous]
    public async Task<ActionResult<List<string>>> GetCommanders([FromQuery] string url)
    {
        if (string.IsNullOrWhiteSpace(url))
            return BadRequest(new { error = "url is required" });

        var match = MoxfieldDeckId.Match(url);
        if (!match.Success) return Ok(Array.Empty<string>());

        var deckId = match.Groups[1].Value;
        var cacheKey = $"moxfield:commanders:{deckId}";

        if (_cache.TryGetValue(cacheKey, out List<string>? cached))
            return Ok(cached);

        try
        {
            //var client = _httpFactory.CreateClient("Moxfield");
            ////var request = new HttpRequestMessage(HttpMethod.Get, $"v2/decks/all/{deckId}");
            ////request.Headers.Referrer = new Uri($"https://moxfield.com/decks/{deckId}");
            ////request.Headers.TryAddWithoutValidation("Origin", "https://moxfield.com");
            //var response = await client.GetAsync($"https://api2.moxfield.com/v2/decks/all/{deckId}");
            //if (!response.IsSuccessStatusCode) return Ok(Array.Empty<string>());

            //using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            var commanders = new List<string>();

            //if (doc.RootElement.TryGetProperty("boards", out var boards) &&
            //    boards.TryGetProperty("commanders", out var commandersBoard) &&
            //    commandersBoard.TryGetProperty("cards", out var cards))
            //{
            //    foreach (var entry in cards.EnumerateObject())
            //    {
            //        if (entry.Value.TryGetProperty("card", out var card) &&
            //            card.TryGetProperty("name", out var name))
            //        {
            //            commanders.Add(name.GetString()!);
            //        }
            //    }
            //}
            using (var client = new HttpClient())
            {
                // Add the User-Agent header
                client.DefaultRequestHeaders.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/999.0.9999.999 Safari/537.36");

                // Add other headers as needed (e.g., API key if required)
                // client.DefaultRequestHeaders.Add("Authorization", "Bearer your-token");

                var response = await client.GetAsync("https://api2.moxfield.com/v2/decks/all/JHjwO92ZUEyNdPzE7D5d7A");
                response.EnsureSuccessStatusCode();
                var content = await response.Content.ReadAsStringAsync();
                // Process content...
            }

            _cache.Set(cacheKey, commanders, CacheDuration);
            return Ok(commanders);
        }
        catch
        {
            return Ok(Array.Empty<string>());
        }
    }
}
