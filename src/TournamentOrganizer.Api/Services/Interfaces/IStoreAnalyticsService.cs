using TournamentOrganizer.Api.DTOs;

namespace TournamentOrganizer.Api.Services.Interfaces;

public interface IStoreAnalyticsService
{
    Task<StoreAnalyticsDto> GetAnalyticsAsync(int storeId);
}
