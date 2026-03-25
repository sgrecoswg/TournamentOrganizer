using Microsoft.EntityFrameworkCore;
using TournamentOrganizer.Api.Data;
using TournamentOrganizer.Api.Models;
using TournamentOrganizer.Api.Repositories.Interfaces;

namespace TournamentOrganizer.Api.Repositories;

public class StoreGroupRepository : IStoreGroupRepository
{
    private readonly AppDbContext _db;

    public StoreGroupRepository(AppDbContext db) => _db = db;

    public async Task<List<StoreGroup>> GetAllWithStoresAsync()
        => await _db.StoreGroups.Include(g => g.Stores).ToListAsync();

    public async Task<StoreGroup?> GetByIdAsync(int id)
        => await _db.StoreGroups.Include(g => g.Stores).FirstOrDefaultAsync(g => g.Id == id);

    public async Task<StoreGroup> AddAsync(StoreGroup group)
    {
        _db.StoreGroups.Add(group);
        await _db.SaveChangesAsync();
        return group;
    }

    public async Task UpdateAsync(StoreGroup group)
    {
        _db.StoreGroups.Update(group);
        await _db.SaveChangesAsync();
    }

    public async Task DeleteAsync(int id)
    {
        var group = await _db.StoreGroups.FindAsync(id);
        if (group != null)
        {
            _db.StoreGroups.Remove(group);
            await _db.SaveChangesAsync();
        }
    }
}
