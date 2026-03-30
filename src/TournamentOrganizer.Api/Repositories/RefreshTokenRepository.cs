using Microsoft.EntityFrameworkCore;
using TournamentOrganizer.Api.Data;
using TournamentOrganizer.Api.Models;
using TournamentOrganizer.Api.Repositories.Interfaces;

namespace TournamentOrganizer.Api.Repositories;

public class RefreshTokenRepository(AppDbContext db) : IRefreshTokenRepository
{
    public Task<RefreshToken?> GetByTokenAsync(string token) =>
        db.RefreshTokens.Include(t => t.AppUser)
                        .FirstOrDefaultAsync(t => t.Token == token);

    public async Task<RefreshToken> CreateAsync(RefreshToken token)
    {
        db.RefreshTokens.Add(token);
        await db.SaveChangesAsync();
        return token;
    }

    public async Task RevokeAsync(RefreshToken token)
    {
        token.RevokedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
    }
}
