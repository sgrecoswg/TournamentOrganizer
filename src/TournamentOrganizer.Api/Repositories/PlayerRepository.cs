using Microsoft.EntityFrameworkCore;
using TournamentOrganizer.Api.Data;
using TournamentOrganizer.Api.Models;
using TournamentOrganizer.Api.Repositories.Interfaces;

namespace TournamentOrganizer.Api.Repositories;

public class PlayerRepository : IPlayerRepository
{
    private readonly AppDbContext _db;

    public PlayerRepository(AppDbContext db) => _db = db;

    public async Task<Player?> GetByIdAsync(int id)
        => await _db.Players.FindAsync(id);

    public async Task<Player?> GetByEmailAsync(string email)
        => await _db.Players.FirstOrDefaultAsync(p => p.Email == email);

    public async Task<List<Player>> GetLeaderboardAsync()
        => await _db.Players
            .Where(p => p.PlacementGamesLeft <= 0)
            .OrderByDescending(p => p.Mu - 3 * p.Sigma)
            .ToListAsync();

    public async Task<List<Player>> GetAllAsync()
        => await _db.Players.OrderBy(p => p.Name).ToListAsync();

    public async Task<Player> CreateAsync(Player player)
    {
        _db.Players.Add(player);
        await _db.SaveChangesAsync();
        return player;
    }

    public async Task UpdateAsync(Player player)
    {
        _db.Players.Update(player);
        await _db.SaveChangesAsync();
    }

    public async Task UpdateRangeAsync(IEnumerable<Player> players)
    {
        _db.Players.UpdateRange(players);
        await _db.SaveChangesAsync();
    }

    public async Task<List<Player>> GetByIdsAsync(IEnumerable<int> ids)
        => await _db.Players.Where(p => ids.Contains(p.Id)).ToListAsync();

    public async Task<List<EventRegistration>> GetPlayerEventRegistrationsAsync(int playerId)
        => await _db.EventRegistrations
            .Include(er => er.Event)
                .ThenInclude(e => e.StoreEvent!)
                    .ThenInclude(se => se.Store)
            .Where(er => er.PlayerId == playerId)
            .OrderByDescending(er => er.Event.Date)
            .ToListAsync();
}
