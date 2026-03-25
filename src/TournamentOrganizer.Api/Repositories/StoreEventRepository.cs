using Microsoft.EntityFrameworkCore;
using TournamentOrganizer.Api.Data;
using TournamentOrganizer.Api.Models;
using TournamentOrganizer.Api.Repositories.Interfaces;

namespace TournamentOrganizer.Api.Repositories;

public class StoreEventRepository : IStoreEventRepository
{
    private readonly AppDbContext _db;

    public StoreEventRepository(AppDbContext db) => _db = db;

    public async Task AddAsync(StoreEvent storeEvent)
    {
        _db.StoreEvents.Add(storeEvent);
        await _db.SaveChangesAsync();
    }

    public async Task<int?> GetStoreIdForEventAsync(int eventId)
    {
        var se = await _db.StoreEvents.FirstOrDefaultAsync(se => se.EventId == eventId);
        return se?.StoreId;
    }

    public async Task<(int? StoreId, string? StoreName, string? StoreBackgroundImageUrl)> GetStoreInfoForEventAsync(int eventId)
    {
        var se = await _db.StoreEvents
            .Include(se => se.Store)
            .FirstOrDefaultAsync(se => se.EventId == eventId);
        return (se?.StoreId, se?.Store?.StoreName, se?.Store?.BackgroundImageUrl);
    }

    public async Task<List<StoreEvent>> GetByStoreIdAsync(int storeId)
        => await _db.StoreEvents
            .Where(se => se.StoreId == storeId)
            .ToListAsync();
}
