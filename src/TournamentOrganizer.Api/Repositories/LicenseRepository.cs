using Microsoft.EntityFrameworkCore;
using TournamentOrganizer.Api.Data;
using TournamentOrganizer.Api.Models;
using TournamentOrganizer.Api.Repositories.Interfaces;

namespace TournamentOrganizer.Api.Repositories;

public class LicenseRepository : ILicenseRepository
{
    private readonly AppDbContext _db;

    public LicenseRepository(AppDbContext db) => _db = db;

    public async Task<License?> GetByStoreAsync(int storeId)
        => await _db.Licenses.FirstOrDefaultAsync(l => l.StoreId == storeId);

    public async Task<List<License>> GetAllAsync()
        => await _db.Licenses.OrderBy(l => l.StoreId).ToListAsync();

    public async Task<License> CreateAsync(License license)
    {
        _db.Licenses.Add(license);
        await _db.SaveChangesAsync();
        return license;
    }

    public async Task<License?> UpdateAsync(License license)
    {
        var existing = await _db.Licenses.FindAsync(license.Id);
        if (existing == null) return null;
        existing.AppKey = license.AppKey;
        existing.IsActive = license.IsActive;
        existing.AvailableDate = license.AvailableDate;
        existing.ExpiresDate = license.ExpiresDate;
        existing.UpdatedOn = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return existing;
    }
}
