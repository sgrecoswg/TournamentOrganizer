using TournamentOrganizer.Api.DTOs;
using TournamentOrganizer.Api.Models;
using TournamentOrganizer.Api.Repositories.Interfaces;
using TournamentOrganizer.Api.Services;
using TournamentOrganizer.Api.Services.Interfaces;

namespace TournamentOrganizer.Tests;

/// <summary>
/// TDD tests for the Commander Declaration feature.
/// </summary>
public class CommanderDeclarationTests
{
    // ── Fakes ─────────────────────────────────────────────────────────────

    private sealed class FakeEventRepository : IEventRepository
    {
        public List<Event> Events { get; } = [];
        public List<EventRegistration> Registrations { get; } = [];
        public List<Round> Rounds { get; } = [];

        public Task<Event?> GetByIdAsync(int id) =>
            Task.FromResult(Events.FirstOrDefault(e => e.Id == id));
        public Task<Event?> GetByCheckInTokenAsync(string token) =>
            Task.FromResult(Events.FirstOrDefault(e => e.CheckInToken == token));
        public Task<List<EventRegistration>> GetRegistrationsWithPlayersAsync(int eventId) =>
            Task.FromResult(Registrations.Where(r => r.EventId == eventId).ToList());
        public Task<EventRegistration?> GetRegistrationAsync(int eid, int pid) =>
            Task.FromResult(Registrations.FirstOrDefault(r => r.EventId == eid && r.PlayerId == pid));
        public Task UpdateRegistrationAsync(EventRegistration r)
        {
            var idx = Registrations.FindIndex(x => x.EventId == r.EventId && x.PlayerId == r.PlayerId);
            if (idx >= 0) Registrations[idx] = r;
            return Task.CompletedTask;
        }
        public Task<Round?> GetLatestRoundAsync(int eventId)
        {
            var round = Rounds.Where(r => r.EventId == eventId).OrderByDescending(r => r.RoundNumber).FirstOrDefault();
            return Task.FromResult<Round?>(round);
        }
        public Task<EventRegistration> RegisterPlayerAsync(EventRegistration r)
        {
            Registrations.Add(r);
            return Task.FromResult(r);
        }
        public Task<List<Player>> GetRegisteredPlayersAsync(int eventId) =>
            Task.FromResult(Registrations
                .Where(r => r.EventId == eventId && !r.IsDropped && !r.IsDisqualified && !r.IsWaitlisted)
                .Select(r => r.Player)
                .ToList());
        public Task<bool> IsPlayerRegisteredAsync(int eventId, int playerId) =>
            Task.FromResult(Registrations.Any(r => r.EventId == eventId && r.PlayerId == playerId && !r.IsDropped && !r.IsDisqualified));

        // stubs
        public Task<Event?> GetWithDetailsAsync(int id)                    => Task.FromResult<Event?>(null);
        public Task<List<Event>> GetAllAsync()                             => Task.FromResult(new List<Event>());
        public Task<List<Event>> GetAllWithStoreAsync(int? storeId = null) => Task.FromResult(new List<Event>());
        public Task<Event> CreateAsync(Event evt)                          => Task.FromResult(evt);
        public Task UpdateAsync(Event evt)                                 => Task.CompletedTask;
        public Task<Round> CreateRoundAsync(Round round)                   => Task.FromResult(round);
        public Task<Round?> GetLatestRoundWithPairingsAsync(int eventId)   => Task.FromResult<Round?>(null);
        public Task<Round?> GetRoundWithDetailsAsync(int roundId)          => Task.FromResult<Round?>(null);
        public Task<List<Round>> GetRoundsForEventAsync(int eventId)       => Task.FromResult(new List<Round>());
        public Task RemoveRegistrationAsync(EventRegistration r)
        {
            Registrations.Remove(r);
            return Task.CompletedTask;
        }
    }

    private sealed class StubPlayerRepo : IPlayerRepository
    {
        private readonly List<Player> _players = [];
        public void Add(Player p) => _players.Add(p);
        public Task<Player?> GetByIdAsync(int id)                                           => Task.FromResult(_players.FirstOrDefault(p => p.Id == id));
        public Task<Player?> GetByEmailAsync(string email)                                  => Task.FromResult<Player?>(null);
        public Task<List<Player>> GetLeaderboardAsync()                                     => Task.FromResult(new List<Player>());
        public Task<List<Player>> GetAllAsync()                                             => Task.FromResult(new List<Player>());
        public Task<Player> CreateAsync(Player p)                                           => Task.FromResult(p);
        public Task UpdateAsync(Player p)                                                   => Task.CompletedTask;
        public Task UpdateRangeAsync(IEnumerable<Player> ps)                               => Task.CompletedTask;
        public Task<List<Player>> GetByIdsAsync(IEnumerable<int> ids)                      => Task.FromResult(new List<Player>());
        public Task<List<EventRegistration>> GetPlayerEventRegistrationsAsync(int pid)     => Task.FromResult(new List<EventRegistration>());
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
        public Task<(int? StoreId, string? StoreName, string? StoreBackgroundImageUrl)> GetStoreInfoForEventAsync(int eventId) => Task.FromResult<(int?, string?, string?)>((null, null, null));
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

    private static EventService BuildService(FakeEventRepository repo, StubPlayerRepo? playerRepo = null) =>
        new(repo, playerRepo ?? new StubPlayerRepo(), new StubGameRepo(), new StubPodService(), new StubTrueSkillService(), new StubStoreEventRepo(), new StubDiscordWebhookService(), new StubBadgeService(), new StubLicenseTierService());

    private static Player MakePlayer(int id) =>
        new() { Id = id, Name = $"Player{id}", Mu = 25, Sigma = 8.333 };

    // ── Tests ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task DeclareCommanderAsync_ValidRegistration_UpdatesAndReturnsDto()
    {
        var player = MakePlayer(1);
        var repo = new FakeEventRepository();
        repo.Events.Add(new Event { Id = 1, Status = EventStatus.Registration });
        repo.Registrations.Add(new EventRegistration { EventId = 1, PlayerId = 1, Player = player });
        var svc = BuildService(repo);

        var result = await svc.DeclareCommanderAsync(1, 1, new DeclareCommanderDto("Atraxa, Praetors' Voice", null));

        Assert.Equal("Atraxa, Praetors' Voice", result.Commanders);
        Assert.Equal(1, result.PlayerId);
    }

    [Fact]
    public async Task DeclareCommanderAsync_EventNotFound_ThrowsKeyNotFoundException()
    {
        var repo = new FakeEventRepository();
        var svc = BuildService(repo);

        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            svc.DeclareCommanderAsync(99, 1, new DeclareCommanderDto("Atraxa", null)));
    }

    [Fact]
    public async Task DeclareCommanderAsync_PlayerNotRegistered_ThrowsKeyNotFoundException()
    {
        var repo = new FakeEventRepository();
        repo.Events.Add(new Event { Id = 1, Status = EventStatus.Registration });
        var svc = BuildService(repo);

        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            svc.DeclareCommanderAsync(1, 99, new DeclareCommanderDto("Atraxa", null)));
    }

    [Fact]
    public async Task DeclareCommanderAsync_EventCompleted_ThrowsInvalidOperationException()
    {
        var player = MakePlayer(1);
        var repo = new FakeEventRepository();
        repo.Events.Add(new Event { Id = 1, Status = EventStatus.Completed });
        repo.Registrations.Add(new EventRegistration { EventId = 1, PlayerId = 1, Player = player });
        var svc = BuildService(repo);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            svc.DeclareCommanderAsync(1, 1, new DeclareCommanderDto("Atraxa", null)));
    }

    [Fact]
    public async Task DeclareCommanderAsync_ClearsCommanderName_WhenNullPassed()
    {
        var player = MakePlayer(1);
        var repo = new FakeEventRepository();
        repo.Events.Add(new Event { Id = 1, Status = EventStatus.InProgress });
        repo.Registrations.Add(new EventRegistration
        {
            EventId = 1, PlayerId = 1, Player = player, Commanders = "Old Commander"
        });
        var svc = BuildService(repo);

        var result = await svc.DeclareCommanderAsync(1, 1, new DeclareCommanderDto(null, null));

        Assert.Null(result.Commanders);
    }
}
