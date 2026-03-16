using Microsoft.AspNetCore.Mvc;
using TournamentOrganizer.Api.DTOs;
using TournamentOrganizer.Api.Services.Interfaces;

namespace TournamentOrganizer.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class LeaderboardController : ControllerBase
{
    private readonly IPlayerService _playerService;

    public LeaderboardController(IPlayerService playerService) => _playerService = playerService;

    [HttpGet]
    public async Task<ActionResult<List<LeaderboardEntryDto>>> GetLeaderboard()
    {
        var leaderboard = await _playerService.GetLeaderboardAsync();
        return Ok(leaderboard);
    }
}
