using TournamentOrganizer.Api.DTOs;
using TournamentOrganizer.Api.Models;
using TournamentOrganizer.Api.Repositories.Interfaces;
using TournamentOrganizer.Api.Services.Interfaces;

namespace TournamentOrganizer.Api.Services;

public class StoreGroupService : IStoreGroupService
{
    private readonly IStoreGroupRepository _groupRepo;
    private readonly IStoreRepository _storeRepo;

    public StoreGroupService(IStoreGroupRepository groupRepo, IStoreRepository storeRepo)
    {
        _groupRepo = groupRepo;
        _storeRepo = storeRepo;
    }

    public async Task<List<StoreGroupDto>> GetAllAsync()
    {
        var groups = await _groupRepo.GetAllWithStoresAsync();
        return groups.Select(g => new StoreGroupDto(g.Id, g.Name, g.LogoUrl, g.Stores.Count)).ToList();
    }

    public async Task<StoreGroupDto> CreateAsync(CreateStoreGroupDto dto)
    {
        var group = new StoreGroup { Name = dto.Name.Trim() };
        await _groupRepo.AddAsync(group);
        return new StoreGroupDto(group.Id, group.Name, group.LogoUrl, 0);
    }

    public async Task<StoreGroupDto?> UpdateAsync(int id, UpdateStoreGroupDto dto)
    {
        var group = await _groupRepo.GetByIdAsync(id);
        if (group == null) return null;
        group.Name = dto.Name.Trim();
        group.LogoUrl = dto.LogoUrl;
        await _groupRepo.UpdateAsync(group);
        return new StoreGroupDto(group.Id, group.Name, group.LogoUrl, group.Stores.Count);
    }

    public async Task<bool> DeleteAsync(int id)
    {
        var group = await _groupRepo.GetByIdAsync(id);
        if (group == null) return false;

        foreach (var store in group.Stores)
        {
            store.StoreGroupId = null;
            await _storeRepo.UpdateAsync(store);
        }

        await _groupRepo.DeleteAsync(id);
        return true;
    }

    public async Task AssignStoreAsync(int groupId, int storeId)
    {
        var store = await _storeRepo.GetByIdWithSettingsAsync(storeId);
        if (store == null) return;
        store.StoreGroupId = groupId;
        await _storeRepo.UpdateAsync(store);
    }

    public async Task UnassignStoreAsync(int storeId)
    {
        var store = await _storeRepo.GetByIdWithSettingsAsync(storeId);
        if (store == null) return;
        store.StoreGroupId = null;
        await _storeRepo.UpdateAsync(store);
    }
}
