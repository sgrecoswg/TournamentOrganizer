using Microsoft.EntityFrameworkCore;
using TournamentOrganizer.Api.Data;
using TournamentOrganizer.Api.Models;
using TournamentOrganizer.Api.Repositories.Interfaces;

namespace TournamentOrganizer.Api.Repositories;

public class StoreRepository : IStoreRepository
{
    private readonly AppDbContext _db;

    public StoreRepository(AppDbContext db) => _db = db;

    public async Task<List<Store>> GetAllAsync()
        => await _db.Stores.AsNoTracking().ToListAsync();

    public async Task<Store?> GetByIdWithSettingsAsync(int id)
        => await _db.Stores
            .Include(s => s.Settings)
            .FirstOrDefaultAsync(s => s.Id == id);

    public async Task<Store?> GetByIdWithEventsAsync(int id)
        => await _db.Stores
            .Include(s => s.Settings)
                .ThenInclude(ss => ss!.Theme)
            .Include(s => s.License)
            .Include(s => s.StoreEvents)
                .ThenInclude(se => se.Event)
            .FirstOrDefaultAsync(s => s.Id == id);

    public async Task<Store> AddAsync(Store store)
    {
        _db.Stores.Add(store);
        await _db.SaveChangesAsync();
        return store;
    }

    public async Task UpdateAsync(Store store)
    {
        _db.Stores.Update(store);
        await _db.SaveChangesAsync();
    }

    public async Task<Store?> GetBySlugAsync(string slug)
        => await _db.Stores
            .Include(s => s.StoreEvents)
                .ThenInclude(se => se.Event)
                    .ThenInclude(e => e.Registrations)
                        .ThenInclude(er => er.Player)
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Slug == slug);

    public async Task<bool> SlugExistsAsync(string slug, int? excludeStoreId = null)
        => await _db.Stores.AnyAsync(s =>
               s.Slug == slug &&
               (excludeStoreId == null || s.Id != excludeStoreId));
}
