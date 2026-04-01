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
            var client = _httpFactory.CreateClient("Moxfield");
            var response = await client.GetAsync($"https://api2.moxfield.com/v2/decks/all/{deckId}");
            if (!response.IsSuccessStatusCode) return Ok(Array.Empty<string>());

            using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            var commanders = new List<string>();

            if (doc.RootElement.TryGetProperty("boards", out var boards) &&
                boards.TryGetProperty("commanders", out var commandersBoard) &&
                commandersBoard.TryGetProperty("cards", out var cards))
            {
                foreach (var entry in cards.EnumerateObject())
                {
                    if (entry.Value.TryGetProperty("card", out var card) &&
                        card.TryGetProperty("name", out var name))
                    {
                        commanders.Add(name.GetString()!);
                    }
                }
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
