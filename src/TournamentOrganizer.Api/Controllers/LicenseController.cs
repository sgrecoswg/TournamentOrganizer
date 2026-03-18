using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TournamentOrganizer.Api.DTOs;
using TournamentOrganizer.Api.Models;
using TournamentOrganizer.Api.Repositories.Interfaces;

namespace TournamentOrganizer.Api.Controllers;

[ApiController]
[Route("api/stores/{storeId}/license")]
public class LicenseController : ControllerBase
{
    private readonly ILicenseRepository _licenseRepo;

    public LicenseController(ILicenseRepository licenseRepo) => _licenseRepo = licenseRepo;

    [HttpGet]
    [Authorize(Policy = "StoreManager")]
    public async Task<ActionResult<LicenseDto>> GetByStore(int storeId)
    {
        if (!CanAccessStore(storeId)) return Forbid();
        var license = await _licenseRepo.GetByStoreAsync(storeId);
        return license == null ? NotFound() : Ok(ToDto(license));
    }

    [HttpPost]
    [Authorize(Policy = "Administrator")]
    public async Task<ActionResult<LicenseDto>> Create(int storeId, CreateLicenseDto dto)
    {
        var license = new License
        {
            StoreId = storeId,
            AppKey = dto.AppKey,
            IsActive = true,
            AvailableDate = dto.AvailableDate,
            ExpiresDate = dto.ExpiresDate,
            Tier = dto.Tier,
            CreatedOn = DateTime.UtcNow,
            UpdatedOn = DateTime.UtcNow,
            CreatedBy = User.FindFirstValue(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Email) ?? "admin",
            UpdatedBy = User.FindFirstValue(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Email) ?? "admin",
        };
        var created = await _licenseRepo.CreateAsync(license);
        return CreatedAtAction(nameof(GetByStore), new { storeId }, ToDto(created));
    }

    [HttpPut("{licenseId}")]
    [Authorize(Policy = "Administrator")]
    public async Task<ActionResult<LicenseDto>> Update(int storeId, int licenseId, UpdateLicenseDto dto)
    {
        var updated = await _licenseRepo.UpdateAsync(new License
        {
            Id = licenseId,
            StoreId = storeId,
            AppKey = dto.AppKey,
            IsActive = dto.IsActive,
            AvailableDate = dto.AvailableDate,
            ExpiresDate = dto.ExpiresDate,
            Tier = dto.Tier,
        });
        return updated == null ? NotFound() : Ok(ToDto(updated));
    }

    private bool CanAccessStore(int storeId)
    {
        if (User.HasClaim("role", "Administrator")) return true;
        var jwtStoreId = int.TryParse(User.FindFirstValue("storeId"), out var s) ? s : 0;
        return jwtStoreId == storeId;
    }

    private static LicenseDto ToDto(License l) =>
        new(l.Id, l.StoreId, l.AppKey, l.IsActive, l.AvailableDate, l.ExpiresDate, l.Tier);
}
