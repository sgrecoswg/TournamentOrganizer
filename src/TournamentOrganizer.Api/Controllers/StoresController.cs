using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using TournamentOrganizer.Api.DTOs;
using TournamentOrganizer.Api.Models;
using TournamentOrganizer.Api.Services.Interfaces;

namespace TournamentOrganizer.Api.Controllers;

[ApiController]
[Route("api/stores")]
public class StoresController : ControllerBase
{
    private static readonly HashSet<string> _allowedExtensions = [".png", ".jpg", ".jpeg", ".gif"];
    private static readonly HashSet<string> _allowedBackgroundExtensions = [".png", ".jpg", ".jpeg"];
    private const long MaxFileSizeBytes = 2 * 1024 * 1024; // 2 MB
    private const long MaxBackgroundFileSizeBytes = 5 * 1024 * 1024; // 5 MB

    private readonly IStoresService _service;
    private readonly IWebHostEnvironment _env;
    private readonly ICommanderMetaService _commanderMetaService;
    private readonly IDiscordWebhookService _discordService;
    private readonly ILicenseTierService _licenseTierService;

    public StoresController(IStoresService service, IWebHostEnvironment env, ICommanderMetaService commanderMetaService, IDiscordWebhookService discordService, ILicenseTierService licenseTierService)
    {
        _service = service;
        _env = env;
        _commanderMetaService = commanderMetaService;
        _discordService = discordService;
        _licenseTierService = licenseTierService;
    }

    [HttpGet]
    public async Task<ActionResult<List<StoreDto>>> GetAll()
        => Ok(await _service.GetAllAsync());

    [HttpGet("{id}")]
    [Authorize(Policy = "StoreEmployee")]
    public async Task<ActionResult<StoreDetailDto>> GetById(int id)
    {
        // Admin can read any store; StoreEmployee/Manager can only read their own.
        if (!User.HasClaim("role", "Administrator"))
        {
            var jwtStoreId = int.TryParse(User.FindFirstValue("storeId"), out var s) ? s : 0;
            if (jwtStoreId != id) return Forbid();
        }
        var store = await _service.GetByIdAsync(id);
        return store == null ? NotFound() : Ok(store);
    }

    [HttpPost]
    [Authorize(Policy = "Administrator")]
    public async Task<ActionResult<StoreDto>> Create(CreateStoreDto dto)
    {
        var store = await _service.CreateAsync(dto);
        return CreatedAtAction(nameof(GetById), new { id = store.Id }, store);
    }

    [HttpPut("{id}")]
    [Authorize(Policy = "StoreManager")]
    [Authorize(Policy = "Tier1Required")]
    public async Task<ActionResult<StoreDetailDto>> Update(int id, UpdateStoreDto dto)
    {
        // Admin can update any store; StoreManager can only update their own.
        if (!User.HasClaim("role", "Administrator"))
        {
            var jwtStoreId = int.TryParse(User.FindFirstValue("storeId"), out var s) ? s : 0;
            if (jwtStoreId != id) return Forbid();
        }
        var store = await _service.UpdateAsync(id, dto);
        return store == null ? NotFound() : Ok(store);
    }

    [HttpPost("{id}/logo")]
    [Authorize(Policy = "StoreEmployee")]
    [Authorize(Policy = "Tier1Required")]
    public async Task<ActionResult<StoreDto>> UploadLogo(int id, IFormFile logo)
    {
        // Ownership check: Admin can update any store; StoreEmployee/Manager can only update their own.
        if (!User.HasClaim("role", "Administrator"))
        {
            var jwtStoreId = int.TryParse(User.FindFirstValue("storeId"), out var s) ? s : 0;
            if (jwtStoreId != id) return Forbid();
        }

        var ext = Path.GetExtension(logo.FileName).ToLowerInvariant();
        if (!_allowedExtensions.Contains(ext))
            return BadRequest("Invalid file type. Allowed: .png, .jpg, .jpeg, .gif");

        if (logo.Length > MaxFileSizeBytes)
            return BadRequest("File exceeds 2 MB limit.");

        var webRoot = _env.WebRootPath ?? Path.Combine(_env.ContentRootPath, "wwwroot");
        var logosDir = Path.Combine(webRoot, "logos");
        Directory.CreateDirectory(logosDir);

        var filePath = Path.Combine(logosDir, $"{id}{ext}");
        await using var stream = new FileStream(filePath, FileMode.Create);
        await logo.CopyToAsync(stream);

        var logoUrl = $"/logos/{id}{ext}";
        var updated = await _service.UpdateLogoUrlAsync(id, logoUrl);
        return Ok(updated);
    }

    [HttpPost("{id}/background")]
    [Authorize(Policy = "StoreEmployee")]
    public async Task<ActionResult<StoreDto>> UploadBackground(int id, IFormFile background)
    {
        // Ownership check: Admin can update any store; StoreEmployee/Manager can only update their own.
        if (!User.HasClaim("role", "Administrator"))
        {
            var jwtStoreId = int.TryParse(User.FindFirstValue("storeId"), out var s) ? s : 0;
            if (jwtStoreId != id) return Forbid();
        }

        var ext = Path.GetExtension(background.FileName).ToLowerInvariant();
        if (!_allowedBackgroundExtensions.Contains(ext))
            return BadRequest("Invalid file type. Allowed: .png, .jpg, .jpeg");

        if (background.Length > MaxBackgroundFileSizeBytes)
            return BadRequest("File exceeds 5 MB limit.");

        var webRoot = _env.WebRootPath ?? Path.Combine(_env.ContentRootPath, "wwwroot");
        var bgDir = Path.Combine(webRoot, "backgrounds");
        Directory.CreateDirectory(bgDir);

        var filePath = Path.Combine(bgDir, $"{id}{ext}");
        await using var stream = new FileStream(filePath, FileMode.Create);
        await background.CopyToAsync(stream);

        var backgroundUrl = $"/backgrounds/{id}{ext}";
        var updated = await _service.UpdateBackgroundImageUrlAsync(id, backgroundUrl);
        return Ok(updated);
    }

    [HttpPost("{id}/discord/test")]
    [Authorize(Policy = "StoreManager")]
    public async Task<IActionResult> TestDiscordWebhook(int id)
    {
        if (!User.HasClaim("role", "Administrator"))
        {
            var jwtStoreId = int.TryParse(User.FindFirstValue("storeId"), out var s) ? s : 0;
            if (jwtStoreId != id) return Forbid();
        }
        await _discordService.PostTestMessageAsync(id);
        return NoContent();
    }

    [HttpGet("{id}/meta")]
    [Authorize(Policy = "StoreEmployee")]
    public async Task<ActionResult<CommanderMetaReportDto>> GetMeta(int id, [FromQuery] string period = "30d")
    {
        if (!User.HasClaim("role", "Administrator"))
        {
            var jwtStoreId = int.TryParse(User.FindFirstValue("storeId"), out var s) ? s : 0;
            if (jwtStoreId != id) return Forbid();
        }
        return Ok(await _commanderMetaService.GetStoreMetaAsync(id, period));
    }

    [HttpGet("public/{slug}")]
    [AllowAnonymous]
    public async Task<ActionResult<StorePublicDto>> GetPublicPage(string slug)
    {
        var page = await _service.GetPublicPageAsync(slug);
        return page == null ? NotFound() : Ok(page);
    }

    [HttpGet("{storeId}/tier")]
    [AllowAnonymous]
    public async Task<ActionResult<StoreTierDto>> GetStoreTier(int storeId)
    {
        var tier = await _licenseTierService.GetEffectiveTierAsync(storeId);
        var (isInTrial, trialExpiresDate) = await _licenseTierService.GetTrialStatusAsync(storeId);
        var (isInGracePeriod, gracePeriodEndsDate) = await _licenseTierService.GetGracePeriodStatusAsync(storeId);
        return Ok(new StoreTierDto(storeId, tier, tier != LicenseTier.Free, null, isInTrial, trialExpiresDate, isInGracePeriod, gracePeriodEndsDate));
    }
}
