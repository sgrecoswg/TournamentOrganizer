using TournamentOrganizer.Api.Models;

namespace TournamentOrganizer.Api.Repositories.Interfaces;

public interface IStoreEventRepository
{
    Task AddAsync(StoreEvent storeEvent);
    Task<int?> GetStoreIdForEventAsync(int eventId);
    Task<(int? StoreId, string? StoreName, string? StoreBackgroundImageUrl)> GetStoreInfoForEventAsync(int eventId);
    Task<List<StoreEvent>> GetByStoreIdAsync(int storeId);
}
