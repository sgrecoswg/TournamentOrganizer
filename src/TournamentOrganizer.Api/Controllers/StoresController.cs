using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using TournamentOrganizer.Api.DTOs;
using TournamentOrganizer.Api.Services.Interfaces;

namespace TournamentOrganizer.Api.Controllers;

[ApiController]
[Route("api/stores")]
public class StoresController : ControllerBase
{
    private static readonly HashSet<string> _allowedExtensions = [".png", ".jpg", ".jpeg", ".gif"];
    private const long MaxFileSizeBytes = 2 * 1024 * 1024; // 2 MB

    private readonly IStoresService _service;
    private readonly IWebHostEnvironment _env;

    public StoresController(IStoresService service, IWebHostEnvironment env)
    {
        _service = service;
        _env = env;
    }

    [HttpGet]
    public async Task<ActionResult<List<StoreDto>>> GetAll()
        => Ok(await _service.GetAllAsync());

    [HttpGet("{id}")]
    public async Task<ActionResult<StoreDetailDto>> GetById(int id)
    {
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
}
