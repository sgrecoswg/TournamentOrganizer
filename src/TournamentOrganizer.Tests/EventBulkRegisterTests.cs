using TournamentOrganizer.Api.DTOs;
using TournamentOrganizer.Api.Models;
using TournamentOrganizer.Api.Repositories.Interfaces;
using TournamentOrganizer.Api.Services;
using TournamentOrganizer.Api.Services.Interfaces;

namespace TournamentOrganizer.Tests;

/// <summary>
/// TDD tests for the BulkRegisterConfirmAsync feature.
/// </summary>
public class EventBulkRegisterTests
{
    // ── Fake repositories ────────────────────────────────────────────────

    private sealed class FakeEventRepository : IEventRepository
    {
        public List<Event> Events { get; } = [];
        public List<EventRegistration> Registrations { get; } = [];

        public Task<Event?> GetByIdAsync(int id) =>
            Task.FromResult(Events.FirstOrDefault(e => e.Id == id));
        public Task<EventRegistration?> GetRegistrationAsync(int eid, int pid) =>
            Task.FromResult(Registrations.FirstOrDefault(r => r.EventId == eid && r.PlayerId == pid));
        public Task<bool> IsPlayerRegisteredAsync(int eventId, int playerId) =>
            Task.FromResult(Registrations.Any(r => r.EventId == eventId && r.PlayerId == playerId && !r.IsDropped && !r.IsDisqualified));
        public Task<EventRegistration> RegisterPlayerAsync(EventRegistration r)
        {
            Registrations.Add(r);
            return Task.FromResult(r);
        }
        public Task<List<EventRegistration>> GetRegistrationsWithPlayersAsync(int eventId) =>
            Task.FromResult(Registrations.Where(r => r.EventId == eventId).ToList());
        public Task UpdateRegistrationAsync(EventRegistration r)
        {
            var idx = Registrations.FindIndex(x => x.EventId == r.EventId && x.PlayerId == r.PlayerId);
            if (idx >= 0) Registrations[idx] = r;
            return Task.CompletedTask;
        }

        // stubs
        public Task<Event?> GetByCheckInTokenAsync(string token)                        => Task.FromResult<Event?>(null);
        public Task<Round?> GetLatestRoundAsync(int eventId)                            => Task.FromResult<Round?>(null);
        public Task<List<Player>> GetRegisteredPlayersAsync(int eventId)                => Task.FromResult(new List<Player>());
        public Task<Event?> GetWithDetailsAsync(int id)                                 => Task.FromResult<Event?>(null);
        public Task<List<Event>> GetAllAsync()                                          => Task.FromResult(new List<Event>());
        public Task<List<Event>> GetAllWithStoreAsync(int? storeId = null)              => Task.FromResult(new List<Event>());
        public Task<Event> CreateAsync(Event evt)                                       => Task.FromResult(evt);
        public Task UpdateAsync(Event evt)                                              => Task.CompletedTask;
        public Task<Round> CreateRoundAsync(Round round)                                => Task.FromResult(round);
        public Task<Round?> GetLatestRoundWithPairingsAsync(int eventId)                => Task.FromResult<Round?>(null);
        public Task<Round?> GetRoundWithDetailsAsync(int roundId)                       => Task.FromResult<Round?>(null);
        public Task<List<Round>> GetRoundsForEventAsync(int eventId)                    => Task.FromResult(new List<Round>());
        public Task RemoveRegistrationAsync(EventRegistration r)                        => Task.CompletedTask;
    }

    private sealed class FakePlayerRepository : IPlayerRepository
    {
        private readonly List<Player> _players = [];
        private int _nextId = 100;

        public void Seed(Player p) => _players.Add(p);

        public Task<Player?> GetByIdAsync(int id) =>
            Task.FromResult(_players.FirstOrDefault(p => p.Id == id));
        public Task<Player?> GetByEmailAsync(string email) =>
            Task.FromResult(_players.FirstOrDefault(p =>
                string.Equals(p.Email, email, StringComparison.OrdinalIgnoreCase)));
        public Task<Player> CreateAsync(Player p)
        {
            if (p.Id == 0) p.Id = _nextId++;
            _players.Add(p);
            return Task.FromResult(p);
        }
        public Task UpdateAsync(Player p) => Task.CompletedTask;
        public Task UpdateRangeAsync(IEnumerable<Player> ps) => Task.CompletedTask;

        // stubs
        public Task<List<Player>> GetLeaderboardAsync()                                 => Task.FromResult(new List<Player>());
        public Task<List<Player>> GetAllAsync()                                         => Task.FromResult(new List<Player>());
        public Task<List<Player>> GetByIdsAsync(IEnumerable<int> ids)                  => Task.FromResult(new List<Player>());
        public Task<List<EventRegistration>> GetPlayerEventRegistrationsAsync(int pid) => Task.FromResult(new List<EventRegistration>());
    }

    private sealed class StubGameRepo : IGameRepository
    {
        public Task<Game?> GetByIdAsync(int id)                                            => Task.FromResult<Game?>(null);
        public Task<Game?> GetWithResultsAsync(int id)                                     => Task.FromResult<Game?>(null);
        public Task<Game> CreateAsync(Game g)                                              => Task.FromResult(g);
        public Task UpdateAsync(Game g)                                                    => Task.CompletedTask;
        public Task AddResultsAsync(IEnumerable<GameResult> r)                             => Task.CompletedTask;
        public Task DeleteResultsAsync(int gameId)                                         => Task.CompletedTask;
        public Task<List<GameResult>> GetPlayerResultsAsync(int pid)                       => Task.FromResult(new List<GameResult>());
        public Task<List<GameResult>> GetPlayerGamesWithOpponentsAsync(int pid)            => Task.FromResult(new List<GameResult>());
        public Task<List<int>> GetPreviousOpponentIdsAsync(int eid, int pid)               => Task.FromResult(new List<int>());
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

    private sealed class StubDiscordWebhookService : IDiscordWebhookService
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

    private sealed class StubStoreEventRepo : IStoreEventRepository
    {
        public Task AddAsync(StoreEvent se) => Task.CompletedTask;
        public Task<int?> GetStoreIdForEventAsync(int eventId) => Task.FromResult<int?>(null);
        public Task<(int? StoreId, string? StoreName)> GetStoreInfoForEventAsync(int eventId) => Task.FromResult<(int?, string?)>((null, null));
        public Task<List<StoreEvent>> GetByStoreIdAsync(int storeId) => Task.FromResult(new List<StoreEvent>());
    }

    private sealed class StubLicenseTierService : ILicenseTierService
    {
        public Task<TournamentOrganizer.Api.Models.LicenseTier> GetEffectiveTierAsync(int storeId) =>
            Task.FromResult(TournamentOrganizer.Api.Models.LicenseTier.Tier1);
        public Task<(bool IsInTrial, DateTime? TrialExpiresDate)> GetTrialStatusAsync(int storeId) =>
            Task.FromResult((false, (DateTime?)null));
        public Task<(bool IsInGracePeriod, DateTime? GracePeriodEndsDate)> GetGracePeriodStatusAsync(int storeId) =>
            Task.FromResult((false, (DateTime?)null));
    }

    private static EventService BuildService(FakeEventRepository eventRepo, FakePlayerRepository playerRepo) =>
        new(eventRepo, playerRepo, new StubGameRepo(), new StubPodService(), new StubTrueSkillService(), new StubStoreEventRepo(), new StubDiscordWebhookService(), new StubBadgeService(), new StubLicenseTierService());

    private static Player MakePlayer(int id, string email) =>
        new() { Id = id, Name = $"Player{id}", Email = email, Mu = 25, Sigma = 8.333 };

    // ── Tests ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task BulkRegisterConfirmAsync_RegistersExistingPlayer()
    {
        var eventRepo = new FakeEventRepository();
        eventRepo.Events.Add(new Event { Id = 1, Status = EventStatus.Registration });

        var playerRepo = new FakePlayerRepository();
        playerRepo.Seed(MakePlayer(10, "alice@example.com"));

        var svc = BuildService(eventRepo, playerRepo);
        var dto = new BulkRegisterConfirmDto([
            new BulkRegisterConfirmItemDto(10, "alice@example.com", null)
        ]);

        var result = await svc.BulkRegisterConfirmAsync(1, dto);

        Assert.Equal(1, result.Registered);
        Assert.Equal(0, result.Created);
        Assert.Empty(result.Errors);
        Assert.Single(eventRepo.Registrations, r => r.PlayerId == 10);
    }

    [Fact]
    public async Task BulkRegisterConfirmAsync_CreatesNewPlayerForUnknownEmail()
    {
        var eventRepo = new FakeEventRepository();
        eventRepo.Events.Add(new Event { Id = 1, Status = EventStatus.Registration });

        var playerRepo = new FakePlayerRepository();

        var svc = BuildService(eventRepo, playerRepo);
        var dto = new BulkRegisterConfirmDto([
            new BulkRegisterConfirmItemDto(null, "new@example.com", "New Player")
        ]);

        var result = await svc.BulkRegisterConfirmAsync(1, dto);

        Assert.Equal(1, result.Registered);
        Assert.Equal(1, result.Created);
        Assert.Empty(result.Errors);
        // Exactly one registration should have been created
        Assert.Single(eventRepo.Registrations);
    }

    [Fact]
    public async Task BulkRegisterConfirmAsync_SkipsAlreadyRegistered_ReturnsError()
    {
        var eventRepo = new FakeEventRepository();
        eventRepo.Events.Add(new Event { Id = 1, Status = EventStatus.Registration });
        eventRepo.Registrations.Add(new EventRegistration { EventId = 1, PlayerId = 10 });

        var playerRepo = new FakePlayerRepository();
        playerRepo.Seed(MakePlayer(10, "alice@example.com"));

        var svc = BuildService(eventRepo, playerRepo);
        var dto = new BulkRegisterConfirmDto([
            new BulkRegisterConfirmItemDto(10, "alice@example.com", null)
        ]);

        var result = await svc.BulkRegisterConfirmAsync(1, dto);

        Assert.Equal(0, result.Registered);
        Assert.Equal(0, result.Created);
        Assert.Single(result.Errors);
        Assert.Equal("alice@example.com", result.Errors[0].Email);
    }

    [Fact]
    public async Task BulkRegisterConfirmAsync_MissingNameForNewPlayer_ReturnsError()
    {
        var eventRepo = new FakeEventRepository();
        eventRepo.Events.Add(new Event { Id = 1, Status = EventStatus.Registration });

        var playerRepo = new FakePlayerRepository();

        var svc = BuildService(eventRepo, playerRepo);
        var dto = new BulkRegisterConfirmDto([
            new BulkRegisterConfirmItemDto(null, "nameless@example.com", null) // no name
        ]);

        var result = await svc.BulkRegisterConfirmAsync(1, dto);

        Assert.Equal(0, result.Registered);
        Assert.Equal(0, result.Created);
        Assert.Single(result.Errors);
        Assert.Equal("nameless@example.com", result.Errors[0].Email);
    }

    [Fact]
    public async Task BulkRegisterConfirmAsync_PartialSuccess_ReturnsCountsAndErrors()
    {
        var eventRepo = new FakeEventRepository();
        eventRepo.Events.Add(new Event { Id = 1, Status = EventStatus.Registration });
        // Player 10 already registered
        eventRepo.Registrations.Add(new EventRegistration { EventId = 1, PlayerId = 10 });

        var playerRepo = new FakePlayerRepository();
        playerRepo.Seed(MakePlayer(10, "alice@example.com")); // already registered → error
        playerRepo.Seed(MakePlayer(11, "bob@example.com"));   // not registered → success

        var svc = BuildService(eventRepo, playerRepo);
        var dto = new BulkRegisterConfirmDto([
            new BulkRegisterConfirmItemDto(10, "alice@example.com", null),    // will error
            new BulkRegisterConfirmItemDto(11, "bob@example.com", null),      // will succeed
            new BulkRegisterConfirmItemDto(null, "new@example.com", "New"),   // create + register
        ]);

        var result = await svc.BulkRegisterConfirmAsync(1, dto);

        Assert.Equal(2, result.Registered);
        Assert.Equal(1, result.Created);
        Assert.Single(result.Errors);
        Assert.Equal("alice@example.com", result.Errors[0].Email);
    }
}
