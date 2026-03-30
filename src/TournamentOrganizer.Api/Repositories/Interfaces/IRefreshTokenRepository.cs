using TournamentOrganizer.Api.Models;

namespace TournamentOrganizer.Api.Repositories.Interfaces;

public interface IRefreshTokenRepository
{
    Task<RefreshToken?> GetByTokenAsync(string token);
    Task<RefreshToken> CreateAsync(RefreshToken token);
    Task RevokeAsync(RefreshToken token);
}
