using TournamentOrganizer.Api.DTOs;

namespace TournamentOrganizer.Api.Services.Interfaces;

public interface IStoresService
{
    Task<List<StoreDto>> GetAllAsync();
    Task<StoreDetailDto?> GetByIdAsync(int id);
    Task<StoreDto> CreateAsync(CreateStoreDto dto);
    Task<StoreDetailDto?> UpdateAsync(int id, UpdateStoreDto dto);
    Task<StoreDto> UpdateLogoUrlAsync(int storeId, string? logoUrl);
}
