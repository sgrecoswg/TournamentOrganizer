using TournamentOrganizer.Api.Constants;
using TournamentOrganizer.Api.DTOs;
using TournamentOrganizer.Api.Models;
using TournamentOrganizer.Api.Repositories.Interfaces;
using TournamentOrganizer.Api.Services;
using TournamentOrganizer.Api.Services.Interfaces;

namespace TournamentOrganizer.Tests;

/// <summary>
/// TDD tests for Free Tier Player Cap enforcement in EventService.
/// Written BEFORE implementation — they fail until the service changes are in place.
/// </summary>
public class EventServiceTests
{
    // ── Fakes ─────────────────────────────────────────────────────────────

    private sealed class FakeEventRepo : IEventRepository
    {
        public List<Event> Events { get; } = [];
        public List<EventRegistration> Registrations { get; } = [];

        public Task<Event?> GetByIdAsync(int id) =>
            Task.FromResult(Events.FirstOrDefault(e => e.Id == id));

        public Task<Event> CreateAsync(Event evt)
        {
            evt.Id = Events.Count + 1;
            Events.Add(evt);
            return Task.FromResult(evt);
        }

        public Task<bool> IsPlayerRegisteredAsync(int eid, int pid) =>
            Task.FromResult(Registrations.Any(r => r.EventId == eid && r.PlayerId == pid && !r.IsDropped && !r.IsDisqualified));

        public Task<EventRegistration?> GetRegistrationAsync(int eid, int pid) =>
            Task.FromResult(Registrations.FirstOrDefault(r => r.EventId == eid && r.PlayerId == pid));

        public Task<List<EventRegistration>> GetRegistrationsWithPlayersAsync(int eid) =>
            Task.FromResult(Registrations.Where(r => r.EventId == eid).ToList());

        public Task<EventRegistration> RegisterPlayerAsync(EventRegistration r)
        {
            Registrations.Add(r);
            return Task.FromResult(r);
        }

        public Task UpdateRegistrationAsync(EventRegistration r) => Task.CompletedTask;
        public Task<List<Event>> GetAllAsync() => Task.FromResult(new List<Event>());
        public Task<List<Event>> GetAllWithStoreAsync(int? storeId = null) => Task.FromResult(new List<Event>());
        public Task<Event?> GetWithDetailsAsync(int id) => Task.FromResult<Event?>(null);
        public Task UpdateAsync(Event evt) => Task.CompletedTask;
        public Task<Round> CreateRoundAsync(Round r) => throw new NotImplementedException();
        public Task<Round?> GetLatestRoundWithPairingsAsync(int eid) => Task.FromResult<Round?>(null);
        public Task<Round?> GetLatestRoundAsync(int eid) => Task.FromResult<Round?>(null);
        public Task<Round?> GetRoundWithDetailsAsync(int rid) => Task.FromResult<Round?>(null);
        public Task<List<Round>> GetRoundsForEventAsync(int eid) => Task.FromResult(new List<Round>());
        public Task RemoveRegistrationAsync(EventRegistration r) => Task.CompletedTask;
        public Task<Event?> GetByCheckInTokenAsync(string token) => Task.FromResult<Event?>(null);
        public Task<List<Player>> GetRegisteredPlayersAsync(int eid) => Task.FromResult(new List<Player>());
    }

    private sealed class FakeStoreEventRepo : IStoreEventRepository
    {
        private readonly int? _storeId;
        public FakeStoreEventRepo(int storeId) => _storeId = storeId;
        public Task AddAsync(StoreEvent se) => Task.CompletedTask;
        public Task<int?> GetStoreIdForEventAsync(int eventId) => Task.FromResult(_storeId);
        public Task<(int? StoreId, string? StoreName)> GetStoreInfoForEventAsync(int eventId) =>
            Task.FromResult<(int?, string?)>((_storeId, null));
        public Task<List<StoreEvent>> GetByStoreIdAsync(int storeId) => Task.FromResult(new List<StoreEvent>());
    }

    private sealed class FakeLicenseTierService : ILicenseTierService
    {
        private readonly LicenseTier _tier;
        public FakeLicenseTierService(LicenseTier tier) => _tier = tier;
        public Task<LicenseTier> GetEffectiveTierAsync(int storeId) => Task.FromResult(_tier);
        public Task<(bool IsInTrial, DateTime? TrialExpiresDate)> GetTrialStatusAsync(int storeId) =>
            Task.FromResult((false, (DateTime?)null));
        public Task<(bool IsInGracePeriod, DateTime? GracePeriodEndsDate)> GetGracePeriodStatusAsync(int storeId) =>
            Task.FromResult((false, (DateTime?)null));
    }

    private sealed class StubPlayerRepo : IPlayerRepository
    {
        private readonly List<Player> _players = [];
        public void Add(Player p) => _players.Add(p);
        public Task<Player?> GetByIdAsync(int id) => Task.FromResult(_players.FirstOrDefault(p => p.Id == id));
        public Task<Player?> GetByEmailAsync(string e) => Task.FromResult<Player?>(null);
        public Task<List<Player>> GetLeaderboardAsync() => Task.FromResult(new List<Player>());
        public Task<List<Player>> GetAllAsync() => Task.FromResult(new List<Player>());
        public Task<Player> CreateAsync(Player p) => Task.FromResult(p);
        public Task UpdateAsync(Player p) => Task.CompletedTask;
        public Task UpdateRangeAsync(IEnumerable<Player> ps) => Task.CompletedTask;
        public Task<List<Player>> GetByIdsAsync(IEnumerable<int> ids) => Task.FromResult(new List<Player>());
        public Task<List<EventRegistration>> GetPlayerEventRegistrationsAsync(int pid) => Task.FromResult(new List<EventRegistration>());
    }

    private sealed class StubGameRepo : IGameRepository
    {
        public Task<Game?> GetByIdAsync(int id) => Task.FromResult<Game?>(null);
        public Task<Game?> GetWithResultsAsync(int id) => Task.FromResult<Game?>(null);
        public Task<Game> CreateAsync(Game g) => Task.FromResult(g);
        public Task UpdateAsync(Game g) => Task.CompletedTask;
        public Task AddResultsAsync(IEnumerable<GameResult> r) => Task.CompletedTask;
        public Task DeleteResultsAsync(int gameId) => Task.CompletedTask;
        public Task<List<GameResult>> GetPlayerResultsAsync(int pid) => Task.FromResult(new List<GameResult>());
        public Task<List<GameResult>> GetPlayerGamesWithOpponentsAsync(int pid) => Task.FromResult(new List<GameResult>());
        public Task<List<int>> GetPreviousOpponentIdsAsync(int eid, int pid) => Task.FromResult(new List<int>());
        public Task<List<GameResult>> GetStoreGameResultsAsync(int storeId, DateTime? since) => Task.FromResult(new List<GameResult>());
        public Task<List<GameResult>> GetPlayerGamesForRatingReplayAsync(int pid) => Task.FromResult(new List<GameResult>());
    }

    private sealed class StubPodService : IPodService
    {
        public List<List<Player>> GenerateRound1Pods(List<Player> players) => [players];
        public List<List<Player>> GenerateNextRoundPods(Round previousRound, List<Player> activePlayers) => [activePlayers];
    }

    private sealed class StubTrueSkillService : ITrueSkillService
    {
        public Task UpdateRatingsAsync(Game game) => Task.CompletedTask;
        public Task UpdateRatingsFromEventStandingsAsync(List<(int PlayerId, int Rank, int GamesPlayed)> rankings) => Task.CompletedTask;
    }

    private sealed class StubDiscordService : IDiscordWebhookService
    {
        public Task PostRoundResultsAsync(int eventId, int roundNumber) => Task.CompletedTask;
        public Task PostEventCompletedAsync(int eventId) => Task.CompletedTask;
        public Task PostPlayerRankedAsync(int playerId, int eventId) => Task.CompletedTask;
        public Task PostTestMessageAsync(int storeId) => Task.CompletedTask;
    }

    private sealed class StubBadgeService : IBadgeService
    {
        public Task CheckAndAwardAsync(int playerId, BadgeTrigger trigger, int? eventId = null) => Task.CompletedTask;
        public Task<List<PlayerBadgeDto>> GetBadgesAsync(int playerId) => Task.FromResult(new List<PlayerBadgeDto>());
    }

    // ── Helper ────────────────────────────────────────────────────────────

    private static EventService BuildService(
        FakeEventRepo eventRepo,
        StubPlayerRepo playerRepo,
        FakeStoreEventRepo storeEventRepo,
        ILicenseTierService licenseTierService) =>
        new(eventRepo, playerRepo, new StubGameRepo(), new StubPodService(),
            new StubTrueSkillService(), storeEventRepo, new StubDiscordService(),
            new StubBadgeService(), licenseTierService);

    private static Player MakePlayer(int id) =>
        new() { Id = id, Name = $"P{id}", Mu = 25, Sigma = 8.333 };

    // ── Tests ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task CreateEvent_FreeTier_ClampsMaxPlayersTo16()
    {
        var repo = new FakeEventRepo();
        var storeEventRepo = new FakeStoreEventRepo(storeId: 1);
        var tierService = new FakeLicenseTierService(LicenseTier.Free);
        var svc = BuildService(repo, new StubPlayerRepo(), storeEventRepo, tierService);

        var dto = new CreateEventDto("Test", DateTime.UtcNow, StoreId: 1, MaxPlayers: null);
        var result = await svc.CreateAsync(dto);

        Assert.Equal(LicenseLimits.FreeMaxPlayersPerEvent, result.MaxPlayers);
    }

    [Fact]
    public async Task RegisterPlayer_FreeTier_AtCapacity_Throws()
    {
        var playerRepo = new StubPlayerRepo();
        var repo = new FakeEventRepo();
        // Create event with no maxPlayers limit (so the standard cap doesn't fire)
        repo.Events.Add(new Event { Id = 1, Status = EventStatus.Registration, MaxPlayers = null });

        // Pre-fill 16 active registrations
        for (int i = 1; i <= LicenseLimits.FreeMaxPlayersPerEvent; i++)
        {
            var p = MakePlayer(i);
            playerRepo.Add(p);
            repo.Registrations.Add(new EventRegistration { EventId = 1, PlayerId = i, Player = p });
        }

        // Player 17 attempts to register
        var player17 = MakePlayer(17);
        playerRepo.Add(player17);

        var storeEventRepo = new FakeStoreEventRepo(storeId: 1);
        var tierService = new FakeLicenseTierService(LicenseTier.Free);
        var svc = BuildService(repo, playerRepo, storeEventRepo, tierService);

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.RegisterPlayerAsync(1, 17));
        Assert.Contains("Free tier", ex.Message);
    }

    [Fact]
    public async Task RegisterPlayer_FreeTier_BelowCap_Succeeds()
    {
        var playerRepo = new StubPlayerRepo();
        var repo = new FakeEventRepo();
        repo.Events.Add(new Event { Id = 1, Status = EventStatus.Registration, MaxPlayers = null });

        // 15 active registrations — one below cap
        for (int i = 1; i < LicenseLimits.FreeMaxPlayersPerEvent; i++)
        {
            var p = MakePlayer(i);
            playerRepo.Add(p);
            repo.Registrations.Add(new EventRegistration { EventId = 1, PlayerId = i, Player = p });
        }

        var player16 = MakePlayer(LicenseLimits.FreeMaxPlayersPerEvent);
        playerRepo.Add(player16);

        var storeEventRepo = new FakeStoreEventRepo(storeId: 1);
        var tierService = new FakeLicenseTierService(LicenseTier.Free);
        var svc = BuildService(repo, playerRepo, storeEventRepo, tierService);

        // Should not throw
        await svc.RegisterPlayerAsync(1, LicenseLimits.FreeMaxPlayersPerEvent);
        Assert.Equal(LicenseLimits.FreeMaxPlayersPerEvent, repo.Registrations.Count);
    }

    [Fact]
    public async Task RegisterPlayer_Tier1_BeyondFreeCap_Succeeds()
    {
        var playerRepo = new StubPlayerRepo();
        var repo = new FakeEventRepo();
        repo.Events.Add(new Event { Id = 1, Status = EventStatus.Registration, MaxPlayers = null });

        // 16 active registrations (at the Free cap)
        for (int i = 1; i <= LicenseLimits.FreeMaxPlayersPerEvent; i++)
        {
            var p = MakePlayer(i);
            playerRepo.Add(p);
            repo.Registrations.Add(new EventRegistration { EventId = 1, PlayerId = i, Player = p });
        }

        var player17 = MakePlayer(17);
        playerRepo.Add(player17);

        var storeEventRepo = new FakeStoreEventRepo(storeId: 1);
        var tierService = new FakeLicenseTierService(LicenseTier.Tier1);   // Tier1 — no cap
        var svc = BuildService(repo, playerRepo, storeEventRepo, tierService);

        // Should not throw
        await svc.RegisterPlayerAsync(1, 17);
        Assert.Equal(LicenseLimits.FreeMaxPlayersPerEvent + 1, repo.Registrations.Count);
    }
}
