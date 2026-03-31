using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TournamentOrganizer.Api.DTOs;
using TournamentOrganizer.Api.Services.Interfaces;

namespace TournamentOrganizer.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class GamesController : ControllerBase
{
    private readonly IEventService _eventService;
    private readonly ILogger<GamesController> _logger;

    public GamesController(IEventService eventService, ILogger<GamesController> logger)
    {
        _eventService = eventService;
        _logger = logger;
    }

    [HttpPost("{id}/result")]
    [Authorize(Policy = "StoreEmployee")]
    public async Task<IActionResult> SubmitResult(int id, List<GameResultSubmitDto> results)
    {
        try
        {
            await _eventService.SubmitGameResultAsync(id, results);
            return Ok(new { message = "Game results submitted and ratings updated." });
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Domain rule violation.");
            return BadRequest(new { error = "Operation not permitted." });
        }
    }

    [HttpDelete("{id}/result")]
    [Authorize(Policy = "StoreEmployee")]
    public async Task<IActionResult> RevertResult(int id)
    {
        try
        {
            await _eventService.RevertGameResultAsync(id);
            return Ok(new { message = "Game result reverted." });
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Domain rule violation.");
            return BadRequest(new { error = "Operation not permitted." });
        }
    }
}
