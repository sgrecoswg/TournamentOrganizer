using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using TournamentOrganizer.Api.DTOs;
using TournamentOrganizer.Api.Helpers;
using TournamentOrganizer.Api.Repositories.Interfaces;
using TournamentOrganizer.Api.Services.Interfaces;

namespace TournamentOrganizer.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class EventsController : ControllerBase
{
    private static readonly HashSet<string> _allowedBgExtensions = [".png", ".jpg", ".jpeg"];
    private const long MaxBgFileSizeBytes = 5 * 1024 * 1024; // 5 MB

    private readonly IEventService _eventService;
    private readonly IStoreEventRepository _storeEventRepo;
    private readonly IWebHostEnvironment _env;
    private readonly ILogger<EventsController> _logger;

    public EventsController(IEventService eventService, IStoreEventRepository storeEventRepo, IWebHostEnvironment env, ILogger<EventsController> logger)
    {
        _eventService = eventService;
        _storeEventRepo = storeEventRepo;
        _env = env;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<List<EventDto>>> GetAll([FromQuery] int? storeId = null)
    {
        var events = await _eventService.GetAllAsync(storeId);
        return Ok(events);
    }

    [HttpPost]
    [Authorize(Policy = "StoreEmployee")]
    public async Task<ActionResult<EventDto>> Create(CreateEventDto dto)
    {
        var role = User.FindFirstValue("role");
        if (role != "Administrator")
        {
            var jwtStoreId = int.TryParse(User.FindFirstValue("storeId"), out var s) ? s : 0;
            if (jwtStoreId == 0)
                return BadRequest(new { error = "Your account is not assigned to a store." });
            dto = dto with { StoreId = jwtStoreId };
        }
        else if (dto.StoreId is null or <= 0)
        {
            return BadRequest(new { error = "Administrators must select a store when creating an event." });
        }
        var evt = await _eventService.CreateAsync(dto);
        return CreatedAtAction(nameof(GetById), new { id = evt.Id }, evt);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<EventDto>> GetById(int id)
    {
        var evt = await _eventService.GetByIdAsync(id);
        return evt == null ? NotFound() : Ok(evt);
    }

    [HttpPost("{id}/register")]
    [Authorize]
    public async Task<IActionResult> RegisterPlayer(int id, RegisterPlayerDto dto)
    {
        var role = User.FindFirstValue("role");
        bool isEmployee = role is "StoreEmployee" or "StoreManager" or "Administrator";

        if (isEmployee)
        {
            if (!await UserCanManageEvent(id)) return Forbid();
        }
        else
        {
            var jwtPlayerId = int.TryParse(User.FindFirstValue("playerId"), out var pid) ? pid : 0;
            if (jwtPlayerId == 0 || jwtPlayerId != dto.PlayerId) return Forbid();
        }

        try
        {
            await _eventService.RegisterPlayerAsync(id, dto.PlayerId, dto.DecklistUrl, dto.Commanders);
            return Ok(new { message = "Player registered successfully." });
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Domain rule violation.");
            return BadRequest(new { error = "Operation not permitted." });
        }
    }

    [HttpPut("{id}/status")]
    [Authorize(Policy = "StoreEmployee")]
    public async Task<ActionResult<EventDto>> UpdateStatus(int id, UpdateEventStatusDto dto)
    {
        if (!await UserCanManageEvent(id)) return Forbid();
        try
        {
            var evt = await _eventService.UpdateStatusAsync(id, dto.Status, dto.PlannedRounds);
            return evt == null ? NotFound() : Ok(evt);
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Domain rule violation.");
            return BadRequest(new { error = "Operation not permitted." });
        }
    }

    [HttpGet("{id}/players")]
    public async Task<ActionResult<List<EventPlayerDto>>> GetPlayers(int id)
    {
        var players = await _eventService.GetEventPlayersAsync(id);
        return Ok(players);
    }

    [HttpDelete("{id}/players/{playerId}")]
    [Authorize]
    public async Task<IActionResult> DropPlayer(int id, int playerId)
    {
        var role = User.FindFirstValue("role");
        bool isEmployee = role is "StoreEmployee" or "StoreManager" or "Administrator";
        var jwtPlayerId = int.TryParse(User.FindFirstValue("playerId"), out var pid) ? pid : 0;
        bool isSelf = jwtPlayerId != 0 && jwtPlayerId == playerId;

        if (!isSelf && !(isEmployee && await UserCanManageEvent(id))) return Forbid();

        try
        {
            await _eventService.DropPlayerAsync(id, playerId);
            return Ok(new { message = "Player dropped from event." });
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Domain rule violation.");
            return BadRequest(new { error = "Operation not permitted." });
        }
    }

    [HttpPost("{id}/players/{playerId}/disqualify")]
    [Authorize(Policy = "StoreEmployee")]
    public async Task<IActionResult> DisqualifyPlayer(int id, int playerId)
    {
        if (!await UserCanManageEvent(id)) return Forbid();
        try
        {
            await _eventService.DisqualifyPlayerAsync(id, playerId);
            return Ok(new { message = "Player disqualified." });
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Domain rule violation.");
            return BadRequest(new { error = "Operation not permitted." });
        }
    }

    [HttpGet("{id}/rounds")]
    public async Task<ActionResult<List<RoundDto>>> GetRounds(int id)
    {
        var rounds = await _eventService.GetRoundsAsync(id);
        return Ok(rounds);
    }

    [HttpPost("{id}/rounds")]
    [Authorize(Policy = "StoreEmployee")]
    public async Task<ActionResult<RoundDto>> GenerateNextRound(int id)
    {
        if (!await UserCanManageEvent(id)) return Forbid();
        try
        {
            var round = await _eventService.GenerateNextRoundAsync(id);
            return Ok(round);
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Domain rule violation.");
            return BadRequest(new { error = "Operation not permitted." });
        }
    }

    [HttpDelete("{id}")]
    [Authorize(Policy = "StoreEmployee")]
    public async Task<IActionResult> Remove(int id)
    {
        if (!await UserCanManageEvent(id)) return Forbid();
        try
        {
            await _eventService.RemoveAsync(id);
            return Ok(new { message = "Event removed." });
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Domain rule violation.");
            return BadRequest(new { error = "Operation not permitted." });
        }
    }

    [HttpGet("{id}/standings")]
    public async Task<ActionResult<List<StandingsEntryDto>>> GetStandings(int id)
    {
        try
        {
            var standings = await _eventService.GetStandingsAsync(id);
            return Ok(standings);
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Domain rule violation.");
            return NotFound(new { error = "Resource not found." });
        }
    }

    [HttpPut("{id}/players/{playerId}/drop")]
    [Authorize]
    public async Task<ActionResult<EventPlayerDto>> SetDropped(int id, int playerId, DropPlayerDto dto)
    {
        if (!await UserCanDropPlayer(id, playerId, dto.IsDropped)) return Forbid();
        try
        {
            var result = await _eventService.SetDroppedAsync(id, playerId, dto.IsDropped);
            return Ok(result);
        }
        catch (KeyNotFoundException) { return NotFound(); }
        catch (InvalidOperationException ex) { _logger.LogWarning(ex, "Domain rule violation."); return BadRequest(new { error = "Operation not permitted." }); }
    }

    [HttpPost("{id}/players/{playerId}/promote")]
    [Authorize(Policy = "StoreEmployee")]
    public async Task<ActionResult<EventPlayerDto>> PromoteFromWaitlist(int id, int playerId)
    {
        if (!await UserCanManageEvent(id)) return Forbid();
        try
        {
            var result = await _eventService.ManualPromoteAsync(id, playerId);
            return Ok(result);
        }
        catch (KeyNotFoundException) { return NotFound(); }
        catch (InvalidOperationException ex) { _logger.LogWarning(ex, "Domain rule violation."); return BadRequest(new { error = "Operation not permitted." }); }
    }

    [HttpPut("{id}/players/{playerId}/checkin")]
    [Authorize]
    public async Task<ActionResult<EventPlayerDto>> SetCheckIn(int id, int playerId, CheckInDto dto)
    {
        if (!await UserCanManageCheckIn(id, playerId)) return Forbid();
        try
        {
            var result = await _eventService.SetCheckInAsync(id, playerId, dto.IsCheckedIn);
            return Ok(result);
        }
        catch (KeyNotFoundException) { return NotFound(); }
        catch (InvalidOperationException ex) { _logger.LogWarning(ex, "Domain rule violation."); return BadRequest(new { error = "Operation not permitted." }); }
    }

    [HttpGet("{id}/pairings")]
    [AllowAnonymous]
    public async Task<ActionResult<PairingsDto>> GetPairings(int id)
    {
        var result = await _eventService.GetPairingsAsync(id);
        return result == null ? NotFound() : Ok(result);
    }

    [HttpPut("{id}/players/{playerId}/commander")]
    [Authorize]
    public async Task<ActionResult<EventPlayerDto>> DeclareCommander(int id, int playerId, DeclareCommanderDto dto)
    {
        if (!await UserCanDeclareCommander(id, playerId)) return Forbid();
        try
        {
            var result = await _eventService.DeclareCommanderAsync(id, playerId, dto);
            return Ok(result);
        }
        catch (KeyNotFoundException) { return NotFound(); }
        catch (InvalidOperationException ex) { _logger.LogWarning(ex, "Domain rule violation."); return BadRequest(new { error = "Operation not permitted." }); }
    }

    [HttpPost("{id}/bulkregister/confirm")]
    [Authorize]
    public async Task<ActionResult<BulkRegisterResultDto>> BulkRegisterConfirm(int id, BulkRegisterConfirmDto dto)
    {
        if (!await UserCanManageEvent(id)) return Forbid();
        return Ok(await _eventService.BulkRegisterConfirmAsync(id, dto));
    }

    [HttpPost("checkin/{token}")]
    [Authorize]
    public async Task<ActionResult<CheckInResponseDto>> CheckInByToken(string token)
    {
        var email = User.FindFirstValue(System.Security.Claims.ClaimTypes.Email)
                 ?? User.FindFirstValue("email");
        if (string.IsNullOrEmpty(email)) return Unauthorized();
        try
        {
            var result = await _eventService.CheckInByTokenAsync(token, email);
            return Ok(result);
        }
        catch (KeyNotFoundException ex) { _logger.LogWarning(ex, "Resource not found."); return NotFound(new { error = "Resource not found." }); }
        catch (InvalidOperationException ex) { _logger.LogWarning(ex, "Domain rule violation."); return BadRequest(new { error = "Operation not permitted." }); }
    }

    private async Task<bool> UserCanManageEvent(int eventId)
    {
        if (User.HasClaim("role", "Administrator")) return true;
        var eventStoreId = await _storeEventRepo.GetStoreIdForEventAsync(eventId);
        var jwtStoreId = int.TryParse(User.FindFirstValue("storeId"), out var s) ? s : (int?)null;
        return jwtStoreId.HasValue && jwtStoreId == eventStoreId;
    }

    private async Task<bool> UserCanDropPlayer(int eventId, int targetPlayerId, bool isDropping)
    {
        var role = User.FindFirstValue("role");
        if (role is "Administrator") return true;
        if (role is "StoreEmployee" or "StoreManager")
            return await UserCanManageEvent(eventId);
        // Players can withdraw themselves (drop = true) but cannot un-drop
        if (!isDropping) return false;
        var jwtPlayerId = int.TryParse(User.FindFirstValue("playerId"), out var pid) ? pid : 0;
        return jwtPlayerId != 0 && jwtPlayerId == targetPlayerId;
    }

    private async Task<bool> UserCanManageCheckIn(int eventId, int targetPlayerId)
    {
        var role = User.FindFirstValue("role");
        if (role is "Administrator") return true;
        if (role is "StoreEmployee" or "StoreManager")
            return await UserCanManageEvent(eventId);
        // Player can only check themselves in
        var jwtPlayerId = int.TryParse(User.FindFirstValue("playerId"), out var pid) ? pid : 0;
        return jwtPlayerId != 0 && jwtPlayerId == targetPlayerId;
    }

    private async Task<bool> UserCanDeclareCommander(int eventId, int targetPlayerId)
    {
        var role = User.FindFirstValue("role");
        if (role is "Administrator") return true;
        if (role is "StoreEmployee" or "StoreManager")
            return await UserCanManageEvent(eventId);
        // Players can only declare for their own registration
        var jwtPlayerId = int.TryParse(User.FindFirstValue("playerId"), out var pid) ? pid : 0;
        return jwtPlayerId != 0 && jwtPlayerId == targetPlayerId;
    }

    [HttpPost("{id}/background")]
    [Authorize(Policy = "StoreEmployee")]
    [RequestFormLimits(MultipartBodyLengthLimit = 5_242_880)]
    [RequestSizeLimit(5_242_880)]
    public async Task<ActionResult<EventDto>> UploadBackground(int id, IFormFile background)
    {
        if (!await UserCanManageEvent(id))
            return Forbid();

        var ext = Path.GetExtension(background.FileName).ToLowerInvariant();
        if (!_allowedBgExtensions.Contains(ext))
            return BadRequest("Invalid file type. Allowed: .png, .jpg, .jpeg");

        if (background.Length > MaxBgFileSizeBytes)
            return BadRequest("File exceeds 5 MB limit.");

        if (!await ImageMagicBytesValidator.IsValidImageAsync(background))
            return BadRequest("File content does not match an allowed image type.");

        var webRoot = _env.WebRootPath ?? Path.Combine(_env.ContentRootPath, "wwwroot");
        var bgDir = Path.Combine(webRoot, "backgrounds");
        Directory.CreateDirectory(bgDir);

        var filePath = Path.Combine(bgDir, $"event_{id}{ext}");
        await using var stream = new FileStream(filePath, FileMode.Create);
        await background.CopyToAsync(stream);

        var bgUrl = $"/backgrounds/event_{id}{ext}";
        var updated = await _eventService.UpdateBackgroundImageUrlAsync(id, bgUrl);
        return updated == null ? NotFound() : Ok(updated);
    }
}
