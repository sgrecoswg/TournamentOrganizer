using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TournamentOrganizer.Api.DTOs;
using TournamentOrganizer.Api.Models;
using TournamentOrganizer.Api.Repositories.Interfaces;

namespace TournamentOrganizer.Api.Controllers;

[ApiController]
public class AppUsersController : ControllerBase
{
    private readonly IAppUserRepository _userRepo;

    public AppUsersController(IAppUserRepository userRepo) => _userRepo = userRepo;

    // ── Store employee management (StoreManager / Administrator) ─────────────

    [HttpGet("api/stores/{storeId}/employees")]
    [Authorize(Policy = "StoreManager")]
    [Authorize(Policy = "Tier1Required")]
    public async Task<ActionResult<List<AppUserDto>>> GetStoreEmployees(int storeId)
    {
        if (!CanAccessStore(storeId)) return Forbid();
        var users = await _userRepo.GetByStoreAsync(storeId);
        return Ok(users.Select(ToDto).ToList());
    }

    [HttpPost("api/stores/{storeId}/employees")]
    [Authorize(Policy = "StoreManager")]
    [Authorize(Policy = "Tier1Required")]
    public async Task<ActionResult<AppUserDto>> AddStoreEmployee(int storeId, AssignEmployeeDto dto)
    {
        if (!CanAccessStore(storeId)) return Forbid();

        var validRoles = new[] { "StoreEmployee", "StoreManager" };
        if (!validRoles.Contains(dto.Role))
            return BadRequest(new { error = "Role must be StoreEmployee or StoreManager." });

        var user = await _userRepo.GetByEmailAsync(dto.Email);
        if (user == null)
        {
            // User hasn't logged in yet — pre-create the account so the role
            // and store are set the moment they first authenticate with Google.
            user = await _userRepo.CreateAsync(new AppUser
            {
                Email   = dto.Email,
                Name    = string.IsNullOrWhiteSpace(dto.Name) ? dto.Email : dto.Name.Trim(),
                Role    = Enum.Parse<AppUserRole>(dto.Role),
                StoreId = storeId
            });
            return Ok(ToDto(user));
        }

        user.IsActive = true;
        user.Role = Enum.Parse<AppUserRole>(dto.Role);
        user.StoreId = storeId;
        await _userRepo.UpdateAsync(user);
        return Ok(ToDto(user));
    }

    [HttpDelete("api/stores/{storeId}/employees/{userId}")]
    [Authorize(Policy = "StoreManager")]
    [Authorize(Policy = "Tier1Required")]
    public async Task<IActionResult> RemoveStoreEmployee(int storeId, int userId)
    {
        if (!CanAccessStore(storeId)) return Forbid();

        var user = await _userRepo.GetByIdAsync(userId);
        if (user == null || user.StoreId != storeId) return NotFound();

        user.Role = AppUserRole.Player;
        user.StoreId = null;
        user.IsActive = false;
        await _userRepo.UpdateAsync(user);
        return NoContent();
    }

    // ── Admin-only user management ────────────────────────────────────────────

    [HttpGet("api/users")]
    [Authorize(Policy = "Administrator")]
    public async Task<ActionResult<List<AppUserDto>>> GetAll()
    {
        var users = await _userRepo.GetAllAsync();
        return Ok(users.Select(ToDto).ToList());
    }

    [HttpPut("api/users/{userId}/role")]
    [Authorize(Policy = "Administrator")]
    public async Task<ActionResult<AppUserDto>> UpdateRole(int userId, [FromBody] UpdateRoleDto dto)
    {
        if (!Enum.TryParse<AppUserRole>(dto.Role, out var role))
            return BadRequest(new { error = "Invalid role." });

        var user = await _userRepo.GetByIdAsync(userId);
        if (user == null) return NotFound();

        user.Role = role;
        await _userRepo.UpdateAsync(user);
        return Ok(ToDto(user));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private bool CanAccessStore(int storeId)
    {
        if (User.HasClaim("role", "Administrator")) return true;
        var jwtStoreId = int.TryParse(User.FindFirstValue("storeId"), out var s) ? s : 0;
        return jwtStoreId == storeId;
    }

    private static AppUserDto ToDto(AppUser u) =>
        new(u.Id, u.Email, u.Name, u.Role.ToString(), u.PlayerId, u.StoreId);
}

public record UpdateRoleDto(string Role);
