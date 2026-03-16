using Microsoft.EntityFrameworkCore;
using TournamentOrganizer.Api.Data;
using TournamentOrganizer.Api.Models;
using TournamentOrganizer.Api.Repositories.Interfaces;

namespace TournamentOrganizer.Api.Repositories;

public class GameRepository : IGameRepository
{
    private readonly AppDbContext _db;

    public GameRepository(AppDbContext db) => _db = db;

    public async Task<Game?> GetByIdAsync(int id)
        => await _db.Games.FindAsync(id);

    public async Task<Game?> GetWithResultsAsync(int id)
        => await _db.Games
            .Include(g => g.Results).ThenInclude(r => r.Player)
            .Include(g => g.Pod).ThenInclude(p => p.Round).ThenInclude(r => r.Event)
            .FirstOrDefaultAsync(g => g.Id == id);

    public async Task<Game> CreateAsync(Game game)
    {
        _db.Games.Add(game);
        await _db.SaveChangesAsync();
        return game;
    }

    public async Task UpdateAsync(Game game)
    {
        _db.Games.Update(game);
        await _db.SaveChangesAsync();
    }

    public async Task AddResultsAsync(IEnumerable<GameResult> results)
    {
        _db.GameResults.AddRange(results);
        await _db.SaveChangesAsync();
    }

    public async Task DeleteResultsAsync(int gameId)
    {
        var results = await _db.GameResults.Where(r => r.GameId == gameId).ToListAsync();
        _db.GameResults.RemoveRange(results);
        await _db.SaveChangesAsync();
    }

    public async Task<List<GameResult>> GetPlayerResultsAsync(int playerId)
        => await _db.GameResults
            .Include(gr => gr.Game).ThenInclude(g => g.Pod).ThenInclude(p => p.Round).ThenInclude(r => r.Event)
            .Where(gr => gr.PlayerId == playerId)
            .OrderByDescending(gr => gr.Game.Pod.Round.RoundNumber)
            .ToListAsync();

    public async Task<List<GameResult>> GetPlayerGamesWithOpponentsAsync(int playerId)
    {
        // Get the game IDs this player participated in
        var gameIds = await _db.GameResults
            .Where(gr => gr.PlayerId == playerId)
            .Select(gr => gr.GameId)
            .Distinct()
            .ToListAsync();

        // For each of those games, get this player's result with the full game + all opponents loaded
        return await _db.GameResults
            .Include(gr => gr.Game).ThenInclude(g => g.Results).ThenInclude(r => r.Player)
            .Where(gr => gr.PlayerId == playerId && gameIds.Contains(gr.GameId))
            .ToListAsync();
    }

    public async Task<List<int>> GetPreviousOpponentIdsAsync(int eventId, int playerId)
        => await _db.GameResults
            .Where(gr => gr.Game.Pod.Round.EventId == eventId && gr.PlayerId != playerId)
            .Where(gr => _db.GameResults
                .Where(gr2 => gr2.GameId == gr.GameId && gr2.PlayerId == playerId)
                .Any())
            .Select(gr => gr.PlayerId)
            .Distinct()
            .ToListAsync();
}
