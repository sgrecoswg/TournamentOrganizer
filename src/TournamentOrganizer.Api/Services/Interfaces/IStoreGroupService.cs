using TournamentOrganizer.Api.DTOs;

namespace TournamentOrganizer.Api.Services.Interfaces;

public interface IStoreGroupService
{
    Task<List<StoreGroupDto>> GetAllAsync();
    Task<StoreGroupDto> CreateAsync(CreateStoreGroupDto dto);
    Task<StoreGroupDto?> UpdateAsync(int id, UpdateStoreGroupDto dto);
    Task<bool> DeleteAsync(int id);
    Task AssignStoreAsync(int groupId, int storeId);
    Task UnassignStoreAsync(int storeId);
}
