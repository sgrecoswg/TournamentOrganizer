using TournamentOrganizer.Api.Models;

namespace TournamentOrganizer.Api.Repositories.Interfaces;

public interface IStoreRepository
{
    Task<List<Store>> GetAllAsync();
    Task<Store?> GetByIdWithSettingsAsync(int id);
    Task<Store?> GetByIdWithEventsAsync(int id);
    Task<Store> AddAsync(Store store);
    Task UpdateAsync(Store store);
}
