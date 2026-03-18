using TournamentOrganizer.Api.DTOs;
using TournamentOrganizer.Api.Models;
using TournamentOrganizer.Api.Repositories.Interfaces;
using TournamentOrganizer.Api.Services;

namespace TournamentOrganizer.Tests;

/// <summary>
/// TDD tests for Store Public Page (Issue #22).
/// Written BEFORE implementation — they fail until the corresponding
/// DTO/repository/service changes are in place.
/// </summary>
public class StorePublicPageTests
{
    // ── Fakes ──────────────────────────────────────────────────────────────

    private sealed class FakeStoreRepository : IStoreRepository
    {
        private readonly List<Store> _stores;
        private readonly HashSet<string> _slugs;

        public FakeStoreRepository(List<Store> stores)
        {
            _stores = stores;
            _slugs = stores.Where(s => s.Slug != null).Select(s => s.Slug!).ToHashSet();
        }

        public Task<Store?> GetBySlugAsync(string slug) =>
            Task.FromResult(_stores.FirstOrDefault(s => s.Slug == slug));

        public Task<bool> SlugExistsAsync(string slug, int? excludeStoreId = null) =>
            Task.FromResult(_stores.Any(s =>
                s.Slug == slug &&
                (excludeStoreId == null || s.Id != excludeStoreId)));

        public Task<List<Store>> GetAllAsync() => Task.FromResult(_stores.ToList());
        public Task<Store?> GetByIdWithSettingsAsync(int id) =>
            Task.FromResult(_stores.FirstOrDefault(s => s.Id == id));
        public Task<Store?> GetByIdWithEventsAsync(int id) =>
            Task.FromResult(_stores.FirstOrDefault(s => s.Id == id));
        public Task<Store> AddAsync(Store store)
        {
            store.Id = _stores.Count + 1;
            _stores.Add(store);
            if (store.Slug != null) _slugs.Add(store.Slug);
            return Task.FromResult(store);
        }
        public Task UpdateAsync(Store store) => Task.CompletedTask;
    }

    private sealed class StubStoreSettingsRepository : IStoreSettingsRepository
    {
        public Task<StoreSettings?> GetByStoreAsync(int storeId) => Task.FromResult<StoreSettings?>(null);
        public Task<StoreSettings> UpsertAsync(StoreSettings settings) => Task.FromResult(settings);
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    private static StoresService BuildService(List<Store> stores) =>
        new(new FakeStoreRepository(stores), new StubStoreSettingsRepository());

    private static Store MakeStore(int id, string slug, string name = "Test Store") => new()
    {
        Id = id,
        StoreName = name,
        Slug = slug,
        Location = "123 Main St",
        LogoUrl = null,
        StoreEvents = new List<StoreEvent>()
    };

    private static StoreEvent MakeStoreEvent(Store store, Event evt) => new()
    {
        Id = 1,
        StoreId = store.Id,
        EventId = evt.Id,
        IsActive = true,
        Store = store,
        Event = evt
    };

    private static Event MakeEvent(int id, EventStatus status, DateTime? date = null) => new()
    {
        Id = id,
        Name = $"Event {id}",
        Status = status,
        Date = date ?? DateTime.UtcNow.AddDays(id),
        Registrations = new List<EventRegistration>()
    };

    private static Player MakePlayer(int id, double mu, double sigma, bool ranked = true) => new()
    {
        Id = id,
        Name = $"Player {id}",
        Email = $"player{id}@test.com",
        Mu = mu,
        Sigma = sigma,
        PlacementGamesLeft = ranked ? 0 : 5
    };

    // ── GetPublicPageAsync ─────────────────────────────────────────────────

    [Fact]
    public async Task GetPublicPageAsync_ValidSlug_ReturnsStorePublicDto()
    {
        var store = MakeStore(1, "test-store");
        var svc = BuildService([store]);

        var result = await svc.GetPublicPageAsync("test-store");

        Assert.NotNull(result);
        Assert.Equal(1, result.Id);
        Assert.Equal("Test Store", result.StoreName);
        Assert.Equal("test-store", result.Slug);
        Assert.Equal("123 Main St", result.Location);
    }

    [Fact]
    public async Task GetPublicPageAsync_UnknownSlug_ReturnsNull()
    {
        var store = MakeStore(1, "test-store");
        var svc = BuildService([store]);

        var result = await svc.GetPublicPageAsync("not-a-store");

        Assert.Null(result);
    }

    [Fact]
    public async Task GetPublicPageAsync_UpcomingEvents_OnlyRegistrationStatus()
    {
        var store = MakeStore(1, "test-store");
        var regEvent = MakeEvent(1, EventStatus.Registration, DateTime.UtcNow.AddDays(5));
        var inProgressEvent = MakeEvent(2, EventStatus.InProgress);
        var completedEvent = MakeEvent(3, EventStatus.Completed);

        store.StoreEvents =
        [
            MakeStoreEvent(store, regEvent),
            MakeStoreEvent(store, inProgressEvent),
            MakeStoreEvent(store, completedEvent)
        ];

        var svc = BuildService([store]);
        var result = await svc.GetPublicPageAsync("test-store");

        Assert.NotNull(result);
        Assert.Single(result.UpcomingEvents);
        Assert.Equal("Event 1", result.UpcomingEvents[0].EventName);
    }

    [Fact]
    public async Task GetPublicPageAsync_RecentEvents_OnlyCompletedLastThree()
    {
        var store = MakeStore(1, "test-store");
        var events = Enumerable.Range(1, 5)
            .Select(i => MakeEvent(i, EventStatus.Completed, DateTime.UtcNow.AddDays(-i)))
            .ToList();

        store.StoreEvents = events.Select(e => MakeStoreEvent(store, e)).ToList();

        var svc = BuildService([store]);
        var result = await svc.GetPublicPageAsync("test-store");

        Assert.NotNull(result);
        Assert.Equal(3, result.RecentEvents.Count);
        // Most recent first (smallest negative day offset = most recent)
        Assert.Equal("Event 1", result.RecentEvents[0].EventName);
    }

    [Fact]
    public async Task GetPublicPageAsync_TopPlayers_OnlyRanked_OrderedByConservativeScore_Top10()
    {
        var store = MakeStore(1, "test-store");

        // Create 12 ranked players with varying scores + 1 unranked
        var evt = MakeEvent(1, EventStatus.Completed);
        var players = Enumerable.Range(1, 12)
            .Select(i => MakePlayer(i, mu: 20 + i, sigma: 2.0, ranked: true))
            .Append(MakePlayer(99, mu: 30, sigma: 2.0, ranked: false))
            .ToList();

        evt.Registrations = players
            .Select(p => new EventRegistration { PlayerId = p.Id, EventId = evt.Id, Player = p, Event = evt })
            .ToList();

        store.StoreEvents = [MakeStoreEvent(store, evt)];

        var svc = BuildService([store]);
        var result = await svc.GetPublicPageAsync("test-store");

        Assert.NotNull(result);
        Assert.Equal(10, result.TopPlayers.Count);
        // Unranked player not included
        Assert.DoesNotContain(result.TopPlayers, p => p.PlayerId == 99);
        // Sorted by ConservativeScore desc (Mu - 3*Sigma; highest Mu wins since Sigma is equal)
        Assert.True(result.TopPlayers[0].ConservativeScore >= result.TopPlayers[9].ConservativeScore);
    }

    // ── Slug generation via CreateAsync ────────────────────────────────────

    [Fact]
    public async Task CreateAsync_AutoGeneratesSlug_FromStoreName()
    {
        var svc = BuildService([]);

        var result = await svc.CreateAsync(new CreateStoreDto("Top Deck Games"));

        Assert.Equal("top-deck-games", result.Slug);
    }

    [Fact]
    public async Task CreateAsync_SlugCollision_AppendsNumericSuffix()
    {
        var existing = MakeStore(1, "top-deck-games");
        var svc = BuildService([existing]);

        var result = await svc.CreateAsync(new CreateStoreDto("Top Deck Games"));

        Assert.Equal("top-deck-games-2", result.Slug);
    }

    [Fact]
    public async Task CreateAsync_SlugStripsSpecialChars()
    {
        var svc = BuildService([]);

        var result = await svc.CreateAsync(new CreateStoreDto("Bob's Cards & More!"));

        Assert.Equal("bobs-cards-more", result.Slug);
    }

    // ── Slug preservation via UpdateAsync ──────────────────────────────────

    [Fact]
    public async Task UpdateAsync_SlugNotRegeneratedIfAlreadySet()
    {
        var store = MakeStore(1, "original-slug", "Original Name");
        var svc = BuildService([store]);

        await svc.UpdateAsync(1, new UpdateStoreDto("New Name", 10m));

        // Slug must remain unchanged
        Assert.Equal("original-slug", store.Slug);
    }

    [Fact]
    public async Task UpdateAsync_SlugGeneratedIfNullOnFirstUpdate()
    {
        var store = MakeStore(1, null!, "My Store");
        store.Slug = null;
        var svc = BuildService([store]);

        var result = await svc.UpdateAsync(1, new UpdateStoreDto("My Store", 10m));

        Assert.NotNull(result);
        Assert.Equal("my-store", result.Slug);
    }
}
