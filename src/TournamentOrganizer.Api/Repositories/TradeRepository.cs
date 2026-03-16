using Microsoft.EntityFrameworkCore;
using TournamentOrganizer.Api.Data;
using TournamentOrganizer.Api.Models;
using TournamentOrganizer.Api.Repositories.Interfaces;

namespace TournamentOrganizer.Api.Repositories;

public class TradeRepository : ITradeRepository
{
    private readonly AppDbContext _db;

    public TradeRepository(AppDbContext db) => _db = db;

    public async Task<List<TradeEntry>> GetAllAsync()
        => await _db.TradeEntries.ToListAsync();

    public async Task<List<TradeEntry>> GetByPlayerAsync(int playerId)
        => await _db.TradeEntries.Where(t => t.PlayerId == playerId).ToListAsync();

    public async Task<TradeEntry?> GetByIdAsync(int id)
        => await _db.TradeEntries.FindAsync(id);

    public async Task<TradeEntry> AddAsync(TradeEntry entry)
    {
        _db.TradeEntries.Add(entry);
        await _db.SaveChangesAsync();
        return entry;
    }

    public async Task<bool> DeleteAsync(int id)
    {
        var entry = await _db.TradeEntries.FindAsync(id);
        if (entry == null) return false;
        _db.TradeEntries.Remove(entry);
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task DeleteAllByPlayerAsync(int playerId)
        => await _db.TradeEntries.Where(t => t.PlayerId == playerId).ExecuteDeleteAsync();

    public async Task<List<TradeEntry>> GetByCardNamesAsync(IEnumerable<string> cardNames, int excludePlayerId)
    {
        var lowerNames = cardNames.Select(n => n.ToLower()).ToList();
        return await _db.TradeEntries
            .Include(t => t.Player)
            .Where(t => t.PlayerId != excludePlayerId && lowerNames.Contains(t.CardName.ToLower()))
            .ToListAsync();
    }
}
