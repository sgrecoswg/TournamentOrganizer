using TournamentOrganizer.Api.DTOs;
using TournamentOrganizer.Api.Models;
using TournamentOrganizer.Api.Repositories.Interfaces;
using TournamentOrganizer.Api.Services;

namespace TournamentOrganizer.Tests;

/// <summary>
/// TDD tests for Store Tier Badges — verifies GetAllAsync populates Tier in StoreDto.
/// Written BEFORE implementation — they fail until StoresService.GetAllAsync computes the tier.
/// </summary>
public class StoresServiceTests
{
    // ── Fakes ─────────────────────────────────────────────────────────────

    private sealed class FakeStoreRepository : IStoreRepository
    {
        private readonly List<Store> _stores;
        public FakeStoreRepository(List<Store> stores) => _stores = stores;

        public Task<List<Store>> GetAllAsync() => Task.FromResult(_stores.ToList());
        public Task<Store?> GetByIdWithSettingsAsync(int id) =>
            Task.FromResult(_stores.FirstOrDefault(s => s.Id == id));
        public Task<Store?> GetByIdWithEventsAsync(int id) =>
            Task.FromResult(_stores.FirstOrDefault(s => s.Id == id));
        public Task<Store> AddAsync(Store store) { _stores.Add(store); return Task.FromResult(store); }
        public Task UpdateAsync(Store store) => Task.CompletedTask;
        public Task<Store?> GetBySlugAsync(string slug) => Task.FromResult<Store?>(null);
        public Task<bool> SlugExistsAsync(string slug, int? excludeStoreId = null) =>
            Task.FromResult(false);
    }

    private sealed class StubStoreSettingsRepository : IStoreSettingsRepository
    {
        public Task<StoreSettings?> GetByStoreAsync(int storeId) => Task.FromResult<StoreSettings?>(null);
        public Task<StoreSettings> UpsertAsync(StoreSettings settings) => Task.FromResult(settings);
    }

    private static StoresService Build(List<Store> stores) =>
        new(new FakeStoreRepository(stores), new StubStoreSettingsRepository());

    private static License ActiveLicense(LicenseTier tier) => new()
    {
        Id = 1, StoreId = 1, AppKey = "key", IsActive = true,
        Tier = tier,
        ExpiresDate = DateTime.UtcNow.AddYears(1),
        AvailableDate = DateTime.UtcNow.AddYears(-1),
    };

    private static License ExpiredLicense() => new()
    {
        Id = 2, StoreId = 1, AppKey = "key", IsActive = true,
        Tier = LicenseTier.Tier1,
        ExpiresDate = DateTime.UtcNow.AddDays(-30),
        AvailableDate = DateTime.UtcNow.AddYears(-1),
        GracePeriodDays = 0,
    };

    // ── Tests ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetAllAsync_PopulatesTierFromLicense()
    {
        var store = new Store { Id = 1, StoreName = "Test", License = ActiveLicense(LicenseTier.Tier1) };
        var svc = Build([store]);

        var result = await svc.GetAllAsync();

        Assert.Single(result);
        Assert.Equal(LicenseTier.Tier1, result[0].Tier);
    }

    [Fact]
    public async Task GetAllAsync_StoreWithNoLicense_TierIsFree()
    {
        var store = new Store { Id = 1, StoreName = "NoLicense", License = null };
        var svc = Build([store]);

        var result = await svc.GetAllAsync();

        Assert.Single(result);
        Assert.Equal(LicenseTier.Free, result[0].Tier);
    }

    [Fact]
    public async Task GetAllAsync_StoreWithExpiredLicense_TierIsFree()
    {
        var store = new Store { Id = 1, StoreName = "Expired", License = ExpiredLicense() };
        var svc = Build([store]);

        var result = await svc.GetAllAsync();

        Assert.Single(result);
        Assert.Equal(LicenseTier.Free, result[0].Tier);
    }

    [Fact]
    public async Task CreateAsync_WithStoreGroupId_SetsGroupOnStore()
    {
        var stores = new List<Store>();
        var svc = Build(stores);

        var result = await svc.CreateAsync(new CreateStoreDto("New Store", StoreGroupId: 7));

        Assert.Equal(7, stores[0].StoreGroupId);
        Assert.Equal(7, result.StoreGroupId);
    }

    [Fact]
    public async Task CreateAsync_WithoutStoreGroupId_GroupIdIsNull()
    {
        var stores = new List<Store>();
        var svc = Build(stores);

        var result = await svc.CreateAsync(new CreateStoreDto("New Store"));

        Assert.Null(stores[0].StoreGroupId);
        Assert.Null(result.StoreGroupId);
    }
}
