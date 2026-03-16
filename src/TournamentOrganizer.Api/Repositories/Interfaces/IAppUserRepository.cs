using TournamentOrganizer.Api.Models;

namespace TournamentOrganizer.Api.Repositories.Interfaces;

public interface IAppUserRepository
{
    Task<AppUser?> GetByEmailAsync(string email);
    Task<AppUser?> GetByIdAsync(int id);
    Task<List<AppUser>> GetByStoreAsync(int storeId);
    Task<List<AppUser>> GetAllAsync();
    Task<AppUser> CreateAsync(AppUser user);
    Task<AppUser> UpdateAsync(AppUser user);
}
