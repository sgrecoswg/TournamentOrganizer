using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using TournamentOrganizer.Api.Models;
using TournamentOrganizer.Api.Repositories.Interfaces;
using TournamentOrganizer.Api.Services.Interfaces;

namespace TournamentOrganizer.Api.Services;

public class AuthService : IAuthService
{
    private readonly IAppUserRepository _userRepo;
    private readonly IPlayerRepository _playerRepo;
    private readonly IConfiguration _config;
    private readonly ILicenseTierService _licenseTierService;

    public AuthService(
        IAppUserRepository userRepo,
        IPlayerRepository playerRepo,
        IConfiguration config,
        ILicenseTierService licenseTierService)
    {
        _userRepo = userRepo;
        _playerRepo = playerRepo;
        _config = config;
        _licenseTierService = licenseTierService;
    }

    public async Task<AppUser> FindOrCreateUserAsync(string email, string name, string googleId)
    {
        var existing = await _userRepo.GetByEmailAsync(email);

        if (existing != null)
        {
            bool dirty = false;

            // Link Google account on first login
            if (existing.GoogleId == null)
            {
                existing.GoogleId = googleId;
                dirty = true;
            }

            // Replace email-placeholder name with real name from Google profile
            if (existing.Name == existing.Email)
            {
                existing.Name = name;
                dirty = true;
            }

            // Pre-created accounts have no Player record — create one now
            if (!existing.PlayerId.HasValue)
            {
                var linkedPlayer = await _playerRepo.GetByEmailAsync(email)
                    ?? await _playerRepo.CreateAsync(new Player { Name = name, Email = email });
                existing.PlayerId = linkedPlayer.Id;
                dirty = true;
            }

            if (dirty) await _userRepo.UpdateAsync(existing);
            return existing;
        }

        // New user — link to existing Player by email if one exists
        var player = await _playerRepo.GetByEmailAsync(email);

        if (player == null)
        {
            player = await _playerRepo.CreateAsync(new Player { Name = name, Email = email });
        }

        var newUser = new AppUser
        {
            Email = email,
            Name = name,
            GoogleId = googleId,
            Role = AppUserRole.Player,
            PlayerId = player.Id
        };

        return await _userRepo.CreateAsync(newUser);
    }

    public async Task<string> GenerateJwtAsync(AppUser user)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:Key"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var expiry = DateTime.UtcNow.AddMinutes(double.Parse(_config["Jwt:ExpiryMinutes"] ?? "480"));

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(JwtRegisteredClaimNames.Email, user.Email),
            new(JwtRegisteredClaimNames.Name, user.Name),
            new("role", user.Role.ToString()),
        };

        if (user.PlayerId.HasValue)
            claims.Add(new Claim("playerId", user.PlayerId.Value.ToString()));

        if (user.StoreId.HasValue)
            claims.Add(new Claim("storeId", user.StoreId.Value.ToString()));

        // Embed licenseTier claim for store employees/managers (not for Admins — they always bypass)
        if (user.StoreId.HasValue &&
            (user.Role == AppUserRole.StoreEmployee || user.Role == AppUserRole.StoreManager))
        {
            var tier = await _licenseTierService.GetEffectiveTierAsync(user.StoreId.Value);
            claims.Add(new Claim("licenseTier", tier.ToString()));
        }

        var token = new JwtSecurityToken(
            issuer: _config["Jwt:Issuer"],
            audience: _config["Jwt:Audience"],
            claims: claims,
            expires: expiry,
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
