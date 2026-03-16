using TournamentOrganizer.Api.Models;

namespace TournamentOrganizer.Api.Repositories.Interfaces;

public interface IStoreSettingsRepository
{
    Task<StoreSettings?> GetByStoreAsync(int storeId);
    Task<StoreSettings> UpsertAsync(StoreSettings settings);
}
