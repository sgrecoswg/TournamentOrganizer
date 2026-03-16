using Microsoft.EntityFrameworkCore;
using TournamentOrganizer.Api.Data;
using TournamentOrganizer.Api.Models;
using TournamentOrganizer.Api.Repositories.Interfaces;

namespace TournamentOrganizer.Api.Repositories;

public class AppUserRepository : IAppUserRepository
{
    private readonly AppDbContext _db;

    public AppUserRepository(AppDbContext db) => _db = db;

    public async Task<AppUser?> GetByEmailAsync(string email)
        => await _db.AppUsers.FirstOrDefaultAsync(u => u.Email == email);

    public async Task<AppUser?> GetByIdAsync(int id)
        => await _db.AppUsers.FindAsync(id);

    public async Task<List<AppUser>> GetByStoreAsync(int storeId)
        => await _db.AppUsers.Where(u => u.StoreId == storeId && u.IsActive).ToListAsync();

    public async Task<List<AppUser>> GetAllAsync()
        => await _db.AppUsers.OrderBy(u => u.Name).ToListAsync();

    public async Task<AppUser> CreateAsync(AppUser user)
    {
        _db.AppUsers.Add(user);
        await _db.SaveChangesAsync();
        return user;
    }

    public async Task<AppUser> UpdateAsync(AppUser user)
    {
        _db.AppUsers.Update(user);
        await _db.SaveChangesAsync();
        return user;
    }
}
