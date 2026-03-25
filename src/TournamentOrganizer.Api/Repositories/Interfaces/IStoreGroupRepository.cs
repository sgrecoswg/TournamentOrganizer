using TournamentOrganizer.Api.Models;

namespace TournamentOrganizer.Api.Repositories.Interfaces;

public interface IStoreGroupRepository
{
    Task<List<StoreGroup>> GetAllWithStoresAsync();
    Task<StoreGroup?> GetByIdAsync(int id);
    Task<StoreGroup> AddAsync(StoreGroup group);
    Task UpdateAsync(StoreGroup group);
    Task DeleteAsync(int id);
}
