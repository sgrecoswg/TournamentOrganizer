using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TournamentOrganizer.Api.DTOs;
using TournamentOrganizer.Api.Helpers;
using TournamentOrganizer.Api.Services.Interfaces;

namespace TournamentOrganizer.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class PlayersController : ControllerBase
{
    private readonly IPlayerService _playerService;
    private readonly IWebHostEnvironment _env;
    private readonly IBadgeService _badgeService;

    public PlayersController(IPlayerService playerService, IWebHostEnvironment env, IBadgeService badgeService)
    {
        _playerService = playerService;
        _env = env;
        _badgeService = badgeService;
    }

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
    [Authorize]
    public async Task<ActionResult<PlayerDto>> Update(int id, UpdatePlayerDto dto)
    {
        if (!await UserCanManagePlayerAsync(id)) return Forbid();
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

    [HttpGet("{id}/commanderstats")]
    [AllowAnonymous]
    public async Task<ActionResult<PlayerCommanderStatsDto>> GetCommanderStats(int id)
    {
        var result = await _playerService.GetCommanderStatsAsync(id);
        if (result == null) return NotFound();
        return Ok(result);
    }

    [HttpPost("{id}/avatar")]
    [Authorize]
    public async Task<ActionResult<PlayerDto>> UploadAvatar(int id, IFormFile avatar)
    {
        if (!await UserCanManagePlayerAsync(id)) return Forbid();
        if (avatar == null || avatar.Length == 0) return BadRequest("No file provided.");
        if (avatar.Length > 2097152) return BadRequest("File exceeds 2 MB limit.");

        var ext = Path.GetExtension(avatar.FileName).ToLowerInvariant();
        if (!new[] { ".png", ".jpg", ".jpeg", ".gif", ".webp" }.Contains(ext))
            return BadRequest("Invalid file type.");

        if (!await ImageMagicBytesValidator.IsValidImageAsync(avatar))
            return BadRequest("File content does not match an allowed image type.");

        var webRoot = _env.WebRootPath ?? Path.Combine(_env.ContentRootPath, "wwwroot");
        Directory.CreateDirectory(Path.Combine(webRoot, "avatars"));
        var fileName = $"{id}{ext}";
        var filePath = Path.Combine(webRoot, "avatars", fileName);
        using (var stream = new FileStream(filePath, FileMode.Create))
            await avatar.CopyToAsync(stream);

        var url = $"/avatars/{fileName}";
        var dto = await _playerService.UpdateAvatarUrlAsync(id, url);
        return Ok(dto);
    }

    [HttpDelete("{id}/avatar")]
    [Authorize]
    public async Task<ActionResult<PlayerDto>> RemoveAvatar(int id)
    {
        if (!await UserCanManagePlayerAsync(id)) return Forbid();

        var player = await _playerService.GetByIdAsync(id);
        if (player == null) return NotFound();

        if (player.AvatarUrl != null)
        {
            var webRoot = _env.WebRootPath ?? Path.Combine(_env.ContentRootPath, "wwwroot");
            var avatarsDir = Path.GetFullPath(Path.Combine(webRoot, "avatars"));
            var filePath = Path.GetFullPath(Path.Combine(webRoot,
                player.AvatarUrl.TrimStart('/').Replace('/', Path.DirectorySeparatorChar)));

            if (!filePath.StartsWith(avatarsDir + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase))
                return BadRequest("Invalid avatar path.");

            if (System.IO.File.Exists(filePath)) System.IO.File.Delete(filePath);
        }

        var dto = await _playerService.UpdateAvatarUrlAsync(id, null);
        return Ok(dto);
    }

    private async Task<bool> UserCanManagePlayerAsync(int playerId)
    {
        if (User.HasClaim("role", "Administrator")) return true;
        if (User.HasClaim("role", "StoreManager"))
        {
            var storeId = int.Parse(User.FindFirstValue("storeId") ?? "0");
            return await _playerService.IsPlayerAtStoreAsync(playerId, storeId);
        }
        var playerEmail = User.FindFirstValue(ClaimTypes.Email)
                       ?? User.FindFirstValue("email");
        return await _playerService.IsPlayerEmailAsync(playerId, playerEmail);
    }

    [HttpGet("{id}/ratinghistory")]
    [AllowAnonymous]
    public async Task<ActionResult<RatingHistoryDto>> GetRatingHistory(int id)
    {
        var result = await _playerService.GetRatingHistoryAsync(id);
        if (result == null) return NotFound();
        return Ok(result);
    }

    [HttpGet("{id}/badges")]
    [AllowAnonymous]
    public async Task<ActionResult<List<PlayerBadgeDto>>> GetBadges(int id)
    {
        var badges = await _badgeService.GetBadgesAsync(id);
        return Ok(badges);
    }
}
