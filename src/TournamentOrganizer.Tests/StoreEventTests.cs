using TournamentOrganizer.Api.DTOs;
using TournamentOrganizer.Api.Models;
using TournamentOrganizer.Api.Repositories.Interfaces;
using TournamentOrganizer.Api.Services;
using TournamentOrganizer.Api.Services.Interfaces;

namespace TournamentOrganizer.Tests;

/// <summary>
/// TDD tests for the StoreEvent feature.
/// Written BEFORE implementation — they fail until the corresponding
/// repository/service changes are in place.
/// </summary>
public class StoreEventTests
{
    // ── Fake EventRepository ─────────────────────────────────────────────

    private sealed class FakeEventRepository : IEventRepository
    {
        private readonly List<Event> _events;
        private readonly List<StoreEvent> _storeEvents;

        public FakeEventRepository(List<Event> events, List<StoreEvent>? storeEvents = null)
        {
            _events = events;
            _storeEvents = storeEvents ?? [];
        }

        public Task<List<Event>> GetAllWithStoreAsync(int? storeId = null)
        {
            var query = _events.Where(e => e.Status != EventStatus.Removed);
            if (storeId.HasValue)
                query = query.Where(e =>
                    _storeEvents.Any(se => se.EventId == e.Id && se.StoreId == storeId.Value));

            var result = query.Select(e =>
            {
                e.StoreEvent = _storeEvents.FirstOrDefault(se => se.EventId == e.Id);
                return e;
            }).ToList();

            return Task.FromResult(result);
        }

        public Task<Event?> GetByIdAsync(int id) =>
            Task.FromResult(_events.FirstOrDefault(e => e.Id == id));

        public Task<Event> CreateAsync(Event evt)
        {
            evt.Id = _events.Count + 1;
            _events.Add(evt);
            return Task.FromResult(evt);
        }

        public Task<List<Player>> GetRegisteredPlayersAsync(int eventId) =>
            Task.FromResult(new List<Player>());

        public Task<List<Event>> GetAllAsync() => throw new NotImplementedException();
        public Task<Event?> GetWithDetailsAsync(int id) => throw new NotImplementedException();
        public Task UpdateAsync(Event evt) => Task.CompletedTask;
        public Task<EventRegistration> RegisterPlayerAsync(EventRegistration r) => throw new NotImplementedException();
        public Task<bool> IsPlayerRegisteredAsync(int eid, int pid) => Task.FromResult(false);
        public Task<Round> CreateRoundAsync(Round r) => throw new NotImplementedException();
        public Task<Round?> GetLatestRoundWithPairingsAsync(int eid) => Task.FromResult<Round?>(null);
        public Task<Round?> GetLatestRoundAsync(int eid) => Task.FromResult<Round?>(null);
        public Task<Round?> GetRoundWithDetailsAsync(int rid) => throw new NotImplementedException();
        public Task<List<Round>> GetRoundsForEventAsync(int eid) => Task.FromResult(new List<Round>());
        public Task<EventRegistration?> GetRegistrationAsync(int eid, int pid) => Task.FromResult<EventRegistration?>(null);
        public Task<List<EventRegistration>> GetRegistrationsWithPlayersAsync(int eid) => Task.FromResult(new List<EventRegistration>());
        public Task RemoveRegistrationAsync(EventRegistration r) => Task.CompletedTask;
        public Task UpdateRegistrationAsync(EventRegistration r) => Task.CompletedTask;
        public Task<Event?> GetByCheckInTokenAsync(string token) => Task.FromResult<Event?>(null);
    }

    // ── Fake StoreEventRepository ────────────────────────────────────────

    private sealed class FakeStoreEventRepository : IStoreEventRepository
    {
        public List<StoreEvent> Created { get; } = [];

        public Task AddAsync(StoreEvent se)
        {
            Created.Add(se);
            return Task.CompletedTask;
        }

        public Task<int?> GetStoreIdForEventAsync(int eventId) =>
            Task.FromResult(Created.FirstOrDefault(se => se.EventId == eventId)?.StoreId);

        public Task<(int? StoreId, string? StoreName)> GetStoreInfoForEventAsync(int eventId)
        {
            var se = Created.FirstOrDefault(s => s.EventId == eventId);
            return Task.FromResult<(int?, string?)>((se?.StoreId, null));
        }

        public Task<List<StoreEvent>> GetByStoreIdAsync(int storeId) =>
            Task.FromResult(Created.Where(se => se.StoreId == storeId).ToList());
    }

    // ── Stubs for unused EventService dependencies ───────────────────────

    private sealed class StubPlayerRepository : IPlayerRepository
    {
        public Task<Player?> GetByIdAsync(int id) => Task.FromResult<Player?>(null);
        public Task<Player?> GetByEmailAsync(string e) => throw new NotImplementedException();
        public Task<List<Player>> GetLeaderboardAsync() => throw new NotImplementedException();
        public Task<List<Player>> GetAllAsync() => Task.FromResult(new List<Player>());
        public Task<Player> CreateAsync(Player p) => throw new NotImplementedException();
        public Task UpdateAsync(Player p) => Task.CompletedTask;
        public Task UpdateRangeAsync(IEnumerable<Player> ps) => Task.CompletedTask;
        public Task<List<Player>> GetByIdsAsync(IEnumerable<int> ids) => throw new NotImplementedException();
        public Task<List<EventRegistration>> GetPlayerEventRegistrationsAsync(int pid) => throw new NotImplementedException();
    }

    private sealed class StubGameRepository : IGameRepository
    {
        public Task<Game?> GetByIdAsync(int id) => throw new NotImplementedException();
        public Task<Game?> GetWithResultsAsync(int id) => throw new NotImplementedException();
        public Task<Game> CreateAsync(Game g) => throw new NotImplementedException();
        public Task UpdateAsync(Game g) => throw new NotImplementedException();
        public Task AddResultsAsync(IEnumerable<GameResult> r) => throw new NotImplementedException();
        public Task<List<GameResult>> GetPlayerResultsAsync(int pid) => throw new NotImplementedException();
        public Task<List<GameResult>> GetPlayerGamesWithOpponentsAsync(int pid) => throw new NotImplementedException();
        public Task<List<int>> GetPreviousOpponentIdsAsync(int eid, int pid) => throw new NotImplementedException();
        public Task<List<GameResult>> GetStoreGameResultsAsync(int storeId, DateTime? since) => Task.FromResult(new List<GameResult>());
        public Task DeleteResultsAsync(int gameId) => throw new NotImplementedException();
    }

    private sealed class StubPodService : IPodService
    {
        public List<List<Player>> GenerateRound1Pods(List<Player> players) => throw new NotImplementedException();
        public List<List<Player>> GenerateNextRoundPods(Round previousRound, List<Player> activePlayers) => throw new NotImplementedException();
    }

    private sealed class StubTrueSkillService : ITrueSkillService
    {
        public Task UpdateRatingsAsync(Game game) => Task.CompletedTask;
        public Task UpdateRatingsFromEventStandingsAsync(List<(int PlayerId, int Rank, int GamesPlayed)> rankings) => Task.CompletedTask;
    }

    private sealed class StubDiscordWebhookService : IDiscordWebhookService
    {
        public Task PostRoundResultsAsync(int eventId, int roundNumber) => Task.CompletedTask;
        public Task PostEventCompletedAsync(int eventId) => Task.CompletedTask;
        public Task PostPlayerRankedAsync(int playerId, int eventId) => Task.CompletedTask;
        public Task PostTestMessageAsync(int storeId) => Task.CompletedTask;
    }

    // ── Fake StoreRepository for StoresService tests ─────────────────────

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
    }

    private sealed class StubStoreSettingsRepository : IStoreSettingsRepository
    {
        public Task<StoreSettings?> GetByStoreAsync(int storeId) => Task.FromResult<StoreSettings?>(null);
        public Task<StoreSettings> UpsertAsync(StoreSettings settings) => Task.FromResult(settings);
    }

    // ── Helper ───────────────────────────────────────────────────────────

    private static EventService BuildEventService(
        List<Event> events,
        List<StoreEvent> storeEvents,
        FakeStoreEventRepository? storeEventRepo = null) =>
        new(
            new FakeEventRepository(events, storeEvents),
            new StubPlayerRepository(),
            new StubGameRepository(),
            new StubPodService(),
            new StubTrueSkillService(),
            storeEventRepo ?? new FakeStoreEventRepository(),
            new StubDiscordWebhookService());

    // ── Tests ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetAllAsync_NoFilter_ReturnsAllNonRemovedEvents()
    {
        var events = new List<Event>
        {
            new() { Id = 1, Name = "A", Status = EventStatus.Registration },
            new() { Id = 2, Name = "B", Status = EventStatus.InProgress },
            new() { Id = 3, Name = "C", Status = EventStatus.Removed },
        };
        var storeEvents = new List<StoreEvent>
        {
            new() { Id = 1, StoreId = 1, EventId = 1 },
            new() { Id = 2, StoreId = 1, EventId = 2 },
        };
        var service = BuildEventService(events, storeEvents);

        var result = await service.GetAllAsync();

        Assert.Equal(2, result.Count);
        Assert.DoesNotContain(result, e => e.Id == 3);
    }

    [Fact]
    public async Task GetAllAsync_WithStoreIdFilter_ReturnsOnlyEventsForThatStore()
    {
        var events = new List<Event>
        {
            new() { Id = 1, Name = "Store1 Event", Status = EventStatus.Registration },
            new() { Id = 2, Name = "Store2 Event", Status = EventStatus.Registration },
        };
        var storeEvents = new List<StoreEvent>
        {
            new() { Id = 1, StoreId = 1, EventId = 1 },
            new() { Id = 2, StoreId = 2, EventId = 2 },
        };
        var service = BuildEventService(events, storeEvents);

        var result = await service.GetAllAsync(storeId: 1);

        Assert.Single(result);
        Assert.Equal(1, result[0].Id);
        Assert.Equal(1, result[0].StoreId);
    }

    [Fact]
    public async Task CreateAsync_WithStoreId_CreatesStoreEventLinkage()
    {
        var events = new List<Event>();
        var storeEventRepo = new FakeStoreEventRepository();
        var service = BuildEventService(events, [], storeEventRepo);

        var dto = new CreateEventDto("Test Event", DateTime.UtcNow, StoreId: 7);

        var result = await service.CreateAsync(dto);

        Assert.Single(storeEventRepo.Created);
        Assert.Equal(7, storeEventRepo.Created[0].StoreId);
        Assert.Equal(result.Id, storeEventRepo.Created[0].EventId);
        Assert.Equal(7, result.StoreId);
    }

    [Fact]
    public async Task StoresService_GetByIdAsync_IncludesAssociatedEvents()
    {
        var store = new Store
        {
            Id = 1,
            StoreName = "Test Store",
            IsActive = true,
            Settings = new StoreSettings { StoreId = 1, AllowableTradeDifferential = 10m },
            StoreEvents =
            [
                new StoreEvent
                {
                    Id = 1, StoreId = 1, EventId = 10, IsActive = true,
                    Event = new Event
                    {
                        Id = 10,
                        Name = "Store Event",
                        Date = DateTime.UtcNow,
                        Status = EventStatus.Registration
                    }
                }
            ]
        };
        var service = new StoresService(
            new FakeStoreRepository([store]),
            new StubStoreSettingsRepository());

        var result = await service.GetByIdAsync(1);

        Assert.NotNull(result);
        Assert.Single(result.Events);
        Assert.Equal(10, result.Events[0].EventId);
        Assert.Equal("Store Event", result.Events[0].EventName);
    }
}
