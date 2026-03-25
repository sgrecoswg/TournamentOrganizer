using TournamentOrganizer.Api.DTOs;
using TournamentOrganizer.Api.Models;
using TournamentOrganizer.Api.Repositories.Interfaces;
using TournamentOrganizer.Api.Services;

namespace TournamentOrganizer.Tests;

/// <summary>
/// TDD tests for StoreGroupService — written BEFORE implementation.
/// Tests fail until the service and repository are implemented.
/// </summary>
public class StoreGroupServiceTests
{
    // ── Fakes ─────────────────────────────────────────────────────────────

    private sealed class FakeStoreGroupRepository : IStoreGroupRepository
    {
        public List<StoreGroup> Groups { get; } = new();

        public Task<List<StoreGroup>> GetAllWithStoresAsync() =>
            Task.FromResult(Groups.ToList());

        public Task<StoreGroup?> GetByIdAsync(int id) =>
            Task.FromResult(Groups.FirstOrDefault(g => g.Id == id));

        public Task<StoreGroup> AddAsync(StoreGroup group)
        {
            if (group.Id == 0) group.Id = Groups.Count + 1;
            Groups.Add(group);
            return Task.FromResult(group);
        }

        public Task UpdateAsync(StoreGroup group) => Task.CompletedTask;

        public Task DeleteAsync(int id)
        {
            Groups.RemoveAll(g => g.Id == id);
            return Task.CompletedTask;
        }
    }

    private sealed class FakeStoreRepository : IStoreRepository
    {
        public List<Store> Stores { get; } = new();

        public Task<List<Store>> GetAllAsync() => Task.FromResult(Stores.ToList());
        public Task<Store?> GetByIdWithSettingsAsync(int id) =>
            Task.FromResult(Stores.FirstOrDefault(s => s.Id == id));
        public Task<Store?> GetByIdWithEventsAsync(int id) =>
            Task.FromResult(Stores.FirstOrDefault(s => s.Id == id));
        public Task<Store> AddAsync(Store store) { Stores.Add(store); return Task.FromResult(store); }
        public Task UpdateAsync(Store store)
        {
            var idx = Stores.FindIndex(s => s.Id == store.Id);
            if (idx >= 0) Stores[idx] = store;
            return Task.CompletedTask;
        }
        public Task<Store?> GetBySlugAsync(string slug) => Task.FromResult<Store?>(null);
        public Task<bool> SlugExistsAsync(string slug, int? excludeStoreId = null) =>
            Task.FromResult(false);
    }

    private static StoreGroupService Build(
        FakeStoreGroupRepository groupRepo, FakeStoreRepository storeRepo) =>
        new(groupRepo, storeRepo);

    // ── Tests ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task CreateAsync_CreatesGroupAndReturnsDto()
    {
        var groupRepo = new FakeStoreGroupRepository();
        var storeRepo = new FakeStoreRepository();
        var svc = Build(groupRepo, storeRepo);

        var result = await svc.CreateAsync(new CreateStoreGroupDto("Top Deck Chain"));

        Assert.Equal("Top Deck Chain", result.Name);
        Assert.Single(groupRepo.Groups);
    }

    [Fact]
    public async Task GetAllAsync_IncludesStoreCount()
    {
        var groupRepo = new FakeStoreGroupRepository();
        var group = new StoreGroup { Id = 1, Name = "Top Deck" };
        group.Stores.Add(new Store { Id = 1, StoreName = "Loc 1" });
        group.Stores.Add(new Store { Id = 2, StoreName = "Loc 2" });
        groupRepo.Groups.Add(group);
        var storeRepo = new FakeStoreRepository();
        var svc = Build(groupRepo, storeRepo);

        var result = await svc.GetAllAsync();

        Assert.Single(result);
        Assert.Equal(2, result[0].StoreCount);
    }

    [Fact]
    public async Task AssignStoreAsync_SetsStoreGroupId()
    {
        var groupRepo = new FakeStoreGroupRepository();
        groupRepo.Groups.Add(new StoreGroup { Id = 1, Name = "Top Deck" });
        var storeRepo = new FakeStoreRepository();
        storeRepo.Stores.Add(new Store { Id = 10, StoreName = "Location 1" });
        var svc = Build(groupRepo, storeRepo);

        await svc.AssignStoreAsync(1, 10);

        Assert.Equal(1, storeRepo.Stores[0].StoreGroupId);
    }

    [Fact]
    public async Task UnassignStoreAsync_ClearsStoreGroupId()
    {
        var groupRepo = new FakeStoreGroupRepository();
        var storeRepo = new FakeStoreRepository();
        storeRepo.Stores.Add(new Store { Id = 10, StoreName = "Location 1", StoreGroupId = 1 });
        var svc = Build(groupRepo, storeRepo);

        await svc.UnassignStoreAsync(10);

        Assert.Null(storeRepo.Stores[0].StoreGroupId);
    }

    [Fact]
    public async Task DeleteAsync_GroupWithStores_UnassignsStoresThenDeletes()
    {
        var groupRepo = new FakeStoreGroupRepository();
        var store1 = new Store { Id = 10, StoreName = "Loc1", StoreGroupId = 1 };
        var store2 = new Store { Id = 11, StoreName = "Loc2", StoreGroupId = 1 };
        var group = new StoreGroup { Id = 1, Name = "Top Deck" };
        group.Stores.Add(store1);
        group.Stores.Add(store2);
        groupRepo.Groups.Add(group);
        var storeRepo = new FakeStoreRepository();
        storeRepo.Stores.Add(store1);
        storeRepo.Stores.Add(store2);
        var svc = Build(groupRepo, storeRepo);

        var result = await svc.DeleteAsync(1);

        Assert.True(result);
        Assert.Empty(groupRepo.Groups);
        Assert.All(storeRepo.Stores, s => Assert.Null(s.StoreGroupId));
    }
}
