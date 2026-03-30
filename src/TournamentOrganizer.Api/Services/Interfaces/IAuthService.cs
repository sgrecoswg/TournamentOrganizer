using TournamentOrganizer.Api.Models;

namespace TournamentOrganizer.Api.Services.Interfaces;

public interface IAuthService
{
    Task<AppUser> FindOrCreateUserAsync(string email, string name, string googleId);
    Task<string> GenerateJwtAsync(AppUser user);
    Task<RefreshToken> GenerateRefreshTokenAsync(int appUserId);
    Task<(string jwt, RefreshToken refreshToken)?> RefreshAsync(string rawToken);
}
