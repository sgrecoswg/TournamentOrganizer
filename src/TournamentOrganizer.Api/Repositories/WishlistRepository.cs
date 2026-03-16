using Microsoft.EntityFrameworkCore;
using TournamentOrganizer.Api.Data;
using TournamentOrganizer.Api.Models;
using TournamentOrganizer.Api.Repositories.Interfaces;

namespace TournamentOrganizer.Api.Repositories;

public class WishlistRepository : IWishlistRepository
{
    private readonly AppDbContext _db;

    public WishlistRepository(AppDbContext db) => _db = db;

    public async Task<List<WishlistEntry>> GetAllAsync()
        => await _db.WishlistEntries.ToListAsync();

    public async Task<List<WishlistEntry>> GetByPlayerAsync(int playerId)
        => await _db.WishlistEntries.Where(w => w.PlayerId == playerId).ToListAsync();

    public async Task<WishlistEntry?> GetByIdAsync(int id)
        => await _db.WishlistEntries.FindAsync(id);

    public async Task<WishlistEntry> AddAsync(WishlistEntry entry)
    {
        _db.WishlistEntries.Add(entry);
        await _db.SaveChangesAsync();
        return entry;
    }

    public async Task<bool> DeleteAsync(int id)
    {
        var entry = await _db.WishlistEntries.FindAsync(id);
        if (entry == null) return false;
        _db.WishlistEntries.Remove(entry);
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task DeleteAllByPlayerAsync(int playerId)
        => await _db.WishlistEntries.Where(w => w.PlayerId == playerId).ExecuteDeleteAsync();
}
