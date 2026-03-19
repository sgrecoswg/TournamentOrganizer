using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TournamentOrganizer.Api.Services.Interfaces;

namespace TournamentOrganizer.Api.Controllers;

[ApiController]
[Route("api/players/{playerId}/trades")]
public class SuggestedTradeController : ControllerBase
{
    private readonly ISuggestedTradeService _service;

    public SuggestedTradeController(ISuggestedTradeService service) => _service = service;

    [HttpGet("suggestions")]
    [Authorize(Policy = "Tier2Required")]
    public async Task<IActionResult> GetSuggestions(int playerId)
    {
        var result = await _service.GetSuggestionsAsync(playerId);
        return Ok(result);
    }

    [HttpGet("demand")]
    [Authorize(Policy = "Tier2Required")]
    public async Task<IActionResult> GetDemand(int playerId)
    {
        var result = await _service.GetDemandAsync(playerId);
        return Ok(result);
    }
}
