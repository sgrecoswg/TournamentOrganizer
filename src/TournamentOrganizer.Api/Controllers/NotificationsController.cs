using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TournamentOrganizer.Api.DTOs;
using TournamentOrganizer.Api.Services.Interfaces;

namespace TournamentOrganizer.Api.Controllers;

[ApiController]
[Route("api/notifications")]
[Authorize]
public class NotificationsController : ControllerBase
{
    private readonly INotificationService _service;

    public NotificationsController(INotificationService service) => _service = service;

    [HttpGet]
    public async Task<ActionResult<List<NotificationDto>>> GetForPlayer()
    {
        var playerId = GetPlayerId();
        if (playerId == 0) return Unauthorized();
        return Ok(await _service.GetForPlayerAsync(playerId));
    }

    [HttpGet("count")]
    public async Task<ActionResult<NotificationCountDto>> GetCount()
    {
        var playerId = GetPlayerId();
        if (playerId == 0) return Unauthorized();
        return Ok(await _service.GetUnreadCountAsync(playerId));
    }

    [HttpPut("{id:int}/read")]
    public async Task<IActionResult> MarkRead(int id)
    {
        var playerId = GetPlayerId();
        if (playerId == 0) return Unauthorized();
        await _service.MarkReadAsync(id, playerId);
        return NoContent();
    }

    [HttpPut("readall")]
    public async Task<IActionResult> MarkAllRead()
    {
        var playerId = GetPlayerId();
        if (playerId == 0) return Unauthorized();
        await _service.MarkAllReadAsync(playerId);
        return NoContent();
    }

    private int GetPlayerId() =>
        int.TryParse(User.FindFirst("playerId")?.Value, out var id) ? id : 0;
}
