using Microsoft.EntityFrameworkCore;
using TournamentOrganizer.Api.Data;
using TournamentOrganizer.Api.Models;
using TournamentOrganizer.Api.Repositories.Interfaces;

namespace TournamentOrganizer.Api.Repositories;

public class StoreSettingsRepository : IStoreSettingsRepository
{
    private readonly AppDbContext _db;

    public StoreSettingsRepository(AppDbContext db) => _db = db;

    public async Task<StoreSettings?> GetByStoreAsync(int storeId)
        => await _db.StoreSettings.FirstOrDefaultAsync(ss => ss.StoreId == storeId);

    public async Task<StoreSettings> UpsertAsync(StoreSettings settings)
    {
        var existing = await _db.StoreSettings.FirstOrDefaultAsync(ss => ss.StoreId == settings.StoreId);
        if (existing == null)
        {
            _db.StoreSettings.Add(settings);
        }
        else
        {
            existing.AllowableTradeDifferential = settings.AllowableTradeDifferential;
            existing.ThemeId = settings.ThemeId;
            existing.UpdatedOn = DateTime.UtcNow;
        }
        await _db.SaveChangesAsync();
        return existing ?? settings;
    }
}
