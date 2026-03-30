using System.Security.Claims;
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
        if (!OwnsPlayer(playerId)) return Forbid();
        var result = await _service.GetSuggestionsAsync(playerId);
        return Ok(result);
    }

    [HttpGet("demand")]
    [Authorize(Policy = "Tier2Required")]
    public async Task<IActionResult> GetDemand(int playerId)
    {
        if (!OwnsPlayer(playerId)) return Forbid();
        var result = await _service.GetDemandAsync(playerId);
        return Ok(result);
    }

    private bool OwnsPlayer(int playerId)
    {
        if (User.HasClaim("role", "Administrator")) return true;
        var jwtPlayerId = int.TryParse(User.FindFirstValue("playerId"), out var pid) ? pid : 0;
        return jwtPlayerId == playerId;
    }
}
