using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TournamentOrganizer.Api.DTOs;
using TournamentOrganizer.Api.Services.Interfaces;

namespace TournamentOrganizer.Api.Controllers;

[ApiController]
[Route("api/players/{playerId}/trades")]
public class TradeController : ControllerBase
{
    private readonly ITradeService _service;

    public TradeController(ITradeService service) => _service = service;

    [HttpGet]
    public async Task<ActionResult<List<TradeEntryDto>>> GetAll(int playerId)
        => Ok(await _service.GetByPlayerAsync(playerId));

    [HttpPost]
    [Authorize(Policy = "Tier2Required")]
    public async Task<ActionResult<TradeEntryDto>> Add(int playerId, CreateCardEntryDto dto)
    {
        if (!OwnsPlayer(playerId)) return Forbid();
        var entry = await _service.AddAsync(playerId, dto);
        return CreatedAtAction(nameof(GetAll), new { playerId }, entry);
    }

    [HttpDelete("{id}")]
    [Authorize(Policy = "Tier2Required")]
    public async Task<IActionResult> Delete(int playerId, int id)
    {
        if (!OwnsPlayer(playerId)) return Forbid();
        var deleted = await _service.DeleteAsync(id);
        return deleted ? NoContent() : NotFound();
    }

    [HttpPost("bulkupload")]
    [Authorize(Policy = "Tier2Required")]
    public async Task<ActionResult<BulkUploadResultDto>> BulkUpload(int playerId, IFormFile file)
    {
        if (!OwnsPlayer(playerId)) return Forbid();
        if (file == null || file.Length == 0)
            return BadRequest(new { error = "No file provided." });
        return Ok(await _service.BulkAddAsync(playerId, file));
    }

    [HttpDelete("removeall")]
    [Authorize(Policy = "Tier2Required")]
    public async Task<IActionResult> RemoveAll(int playerId)
    {
        if (!OwnsPlayer(playerId)) return Forbid();
        await _service.DeleteAllByPlayerAsync(playerId);
        return NoContent();
    }

    private bool OwnsPlayer(int playerId)
    {
        if (User.HasClaim("role", "Administrator")) return true;
        var jwtPlayerId = int.TryParse(User.FindFirstValue("playerId"), out var pid) ? pid : 0;
        return jwtPlayerId == playerId;
    }
}
