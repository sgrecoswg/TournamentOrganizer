using Microsoft.AspNetCore.Mvc;
using TournamentOrganizer.Api.DTOs;
using TournamentOrganizer.Api.Services.Interfaces;

namespace TournamentOrganizer.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PlayersController : ControllerBase
{
    private readonly IPlayerService _playerService;

    public PlayersController(IPlayerService playerService) => _playerService = playerService;

    [HttpGet]
    public async Task<ActionResult<List<PlayerDto>>> GetAll()
    {
        var players = await _playerService.GetAllAsync();
        return Ok(players);
    }

    [HttpPost]
    public async Task<ActionResult<PlayerDto>> Register(CreatePlayerDto dto)
    {
        try
        {
            var player = await _playerService.RegisterAsync(dto);
            return CreatedAtAction(nameof(GetProfile), new { id = player.Id }, player);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { error = ex.Message });
        }
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<PlayerDto>> Update(int id, UpdatePlayerDto dto)
    {
        var player = await _playerService.UpdateAsync(id, dto);
        return player == null ? NotFound() : Ok(player);
    }

    [HttpGet("{id}/profile")]
    public async Task<ActionResult<PlayerProfileDto>> GetProfile(int id)
    {
        var profile = await _playerService.GetProfileAsync(id);
        return profile == null ? NotFound() : Ok(profile);
    }

    [HttpGet("{id}/head-to-head")]
    public async Task<ActionResult<List<HeadToHeadEntryDto>>> GetHeadToHead(int id)
    {
        var records = await _playerService.GetHeadToHeadAsync(id);
        return records == null ? NotFound() : Ok(records);
    }
}
