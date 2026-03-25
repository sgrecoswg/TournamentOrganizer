using TournamentOrganizer.Api.DTOs;
using TournamentOrganizer.Api.Models;
using TournamentOrganizer.Api.Repositories.Interfaces;
using TournamentOrganizer.Api.Services;
using TournamentOrganizer.Api.Services.Interfaces;

namespace TournamentOrganizer.Tests;

public class EventPairingsTests
{
    // ── Fake EventRepository ──────────────────────────────────────────────

    private sealed class FakeEventRepository : IEventRepository
    {
        public List<Event>             Events        { get; } = [];
        public List<EventRegistration> Registrations { get; } = [];
        public Round?                  LatestRound   { get; set; }

        public Task<Event?> GetByIdAsync(int id) =>
            Task.FromResult(Events.FirstOrDefault(e => e.Id == id));

        public Task<Round?> GetLatestRoundWithPairingsAsync(int eventId) =>
            Task.FromResult(LatestRound?.EventId == eventId ? LatestRound : null);

        public Task<List<EventRegistration>> GetRegistrationsWithPlayersAsync(int eventId) =>
            Task.FromResult(Registrations.Where(r => r.EventId == eventId).ToList());

        // ── Unused stubs ──────────────────────────────────────────────────
        public Task<Round?> GetLatestRoundAsync(int eventId)               => Task.FromResult(LatestRound);
        public Task<List<Event>> GetAllWithStoreAsync(int? storeId = null) => throw new NotImplementedException();
        public Task<Event?> GetWithDetailsAsync(int id)                    => throw new NotImplementedException();
        public Task<List<Event>> GetAllAsync()                             => throw new NotImplementedException();
        public Task<Event> CreateAsync(Event evt)                          => throw new NotImplementedException();
        public Task UpdateAsync(Event evt)                                 => Task.CompletedTask;
        public Task<EventRegistration> RegisterPlayerAsync(EventRegistration r) => throw new NotImplementedException();
        public Task<bool> IsPlayerRegisteredAsync(int eid, int pid)        => throw new NotImplementedException();
        public Task<Round> CreateRoundAsync(Round round)                   => throw new NotImplementedException();
        public Task<Round?> GetRoundWithDetailsAsync(int rid)              => throw new NotImplementedException();
        public Task<List<Round>> GetRoundsForEventAsync(int eid)           => Task.FromResult(new List<Round>());
        public Task<EventRegistration?> GetRegistrationAsync(int eid, int pid) => throw new NotImplementedException();
        public Task RemoveRegistrationAsync(EventRegistration r)           => Task.CompletedTask;
        public Task UpdateRegistrationAsync(EventRegistration r)           => Task.CompletedTask;
        public Task<List<Player>> GetRegisteredPlayersAsync(int eventId)   => Task.FromResult(new List<Player>());
        public Task<Event?> GetByCheckInTokenAsync(string token)           => Task.FromResult<Event?>(null);
    }

    // ── Stubs ─────────────────────────────────────────────────────────────

    private sealed class StubPlayerRepository : IPlayerRepository
    {
        public Task<Player?> GetByIdAsync(int id)                                         => Task.FromResult<Player?>(null);
        public Task<Player?> GetByEmailAsync(string e)                                    => throw new NotImplementedException();
        public Task<List<Player>> GetLeaderboardAsync()                                   => throw new NotImplementedException();
        public Task<List<Player>> GetAllAsync()                                           => Task.FromResult(new List<Player>());
        public Task<Player> CreateAsync(Player p)                                         => throw new NotImplementedException();
        public Task UpdateAsync(Player p)                                                 => Task.CompletedTask;
        public Task UpdateRangeAsync(IEnumerable<Player> ps)                             => Task.CompletedTask;
        public Task<List<Player>> GetByIdsAsync(IEnumerable<int> ids)                   => throw new NotImplementedException();
        public Task<List<EventRegistration>> GetPlayerEventRegistrationsAsync(int pid)  => throw new NotImplementedException();
    }

    private sealed class StubGameRepository : IGameRepository
    {
        public Task<Game?> GetByIdAsync(int id)                            => throw new NotImplementedException();
        public Task<Game?> GetWithResultsAsync(int id)                     => throw new NotImplementedException();
        public Task<Game> CreateAsync(Game g)                              => throw new NotImplementedException();
        public Task UpdateAsync(Game g)                                    => throw new NotImplementedException();
        public Task AddResultsAsync(IEnumerable<GameResult> r)            => throw new NotImplementedException();
        public Task DeleteResultsAsync(int gameId)                        => throw new NotImplementedException();
        public Task<List<GameResult>> GetPlayerResultsAsync(int pid)      => throw new NotImplementedException();
        public Task<List<GameResult>> GetPlayerGamesWithOpponentsAsync(int pid) => throw new NotImplementedException();
        public Task<List<int>> GetPreviousOpponentIdsAsync(int eid, int pid) => throw new NotImplementedException();
        public Task<List<GameResult>> GetStoreGameResultsAsync(int storeId, DateTime? since) => Task.FromResult(new List<GameResult>());
        public Task<List<GameResult>> GetPlayerGamesForRatingReplayAsync(int pid) => Task.FromResult(new List<GameResult>());
    }

    private sealed class StubPodService : IPodService
    {
        public List<List<Player>> GenerateRound1Pods(List<Player> players) => [players];
        public List<List<Player>> GenerateNextRoundPods(Round prev, List<Player> active) => [active];
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

    private sealed class StubStoreEventRepository : IStoreEventRepository
    {
        public Task AddAsync(StoreEvent se) => Task.CompletedTask;
        public Task<int?> GetStoreIdForEventAsync(int eventId) => Task.FromResult<int?>(1);
        public Task<(int? StoreId, string? StoreName, string? StoreBackgroundImageUrl)> GetStoreInfoForEventAsync(int eventId) =>
            Task.FromResult<(int?, string?, string?)>((1, "Test Store", null));
        public Task<List<StoreEvent>> GetByStoreIdAsync(int storeId) => Task.FromResult(new List<StoreEvent>());
    }

    // ── Helpers ───────────────────────────────────────────────────────────

    private static Player MakePlayer(int id, string name) => new()
        { Id = id, Name = name, Email = $"p{id}@test.com", Mu = 25, Sigma = 8.333 };

    private sealed class StubLicenseTierService : ILicenseTierService
    {
        public Task<TournamentOrganizer.Api.Models.LicenseTier> GetEffectiveTierAsync(int storeId) =>
            Task.FromResult(TournamentOrganizer.Api.Models.LicenseTier.Tier1);
        public Task<(bool IsInTrial, DateTime? TrialExpiresDate)> GetTrialStatusAsync(int storeId) =>
            Task.FromResult((false, (DateTime?)null));
        public Task<(bool IsInGracePeriod, DateTime? GracePeriodEndsDate)> GetGracePeriodStatusAsync(int storeId) =>
            Task.FromResult((false, (DateTime?)null));
    }

    private static EventService BuildService(FakeEventRepository eventRepo) =>
        new(eventRepo, new StubPlayerRepository(), new StubGameRepository(),
            new StubPodService(), new StubTrueSkillService(), new StubStoreEventRepository(), new StubDiscordWebhookService(), new StubBadgeService(), new StubLicenseTierService());

    private static Round MakeRound(int eventId, int roundNumber, List<(Player Player, string? Commander)> players)
    {
        var round = new Round { Id = roundNumber, EventId = eventId, RoundNumber = roundNumber };
        var pod = new Pod { Id = 1, PodNumber = 1, RoundId = round.Id };
        pod.PodPlayers = players.Select((t, i) => new PodPlayer
        {
            PlayerId  = t.Player.Id,
            Player    = t.Player,
            SeatOrder = i + 1,
        }).ToList();
        round.Pods = [pod];
        return round;
    }

    // ── Tests ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetPairingsAsync_ActiveRound_ReturnsPods()
    {
        var p1 = MakePlayer(1, "Alice");
        var p2 = MakePlayer(2, "Bob");
        var eventRepo = new FakeEventRepository();
        eventRepo.Events.Add(new Event { Id = 10, Name = "Finals", Status = EventStatus.InProgress });
        eventRepo.LatestRound = MakeRound(10, 1, [(p1, null), (p2, null)]);

        var svc = BuildService(eventRepo);
        var result = await svc.GetPairingsAsync(10);

        Assert.NotNull(result);
        Assert.Equal(10,      result!.EventId);
        Assert.Equal("Finals", result.EventName);
        Assert.Equal(1,       result.CurrentRound);
        Assert.Single(result.Pods);
        Assert.Equal(2, result.Pods[0].Players.Count);
        Assert.Contains(result.Pods[0].Players, p => p.Name == "Alice");
        Assert.Contains(result.Pods[0].Players, p => p.Name == "Bob");
    }

    [Fact]
    public async Task GetPairingsAsync_NoActiveRound_ReturnsEmptyPods()
    {
        var eventRepo = new FakeEventRepository();
        eventRepo.Events.Add(new Event { Id = 10, Name = "Draft", Status = EventStatus.Registration });
        // No LatestRound

        var svc = BuildService(eventRepo);
        var result = await svc.GetPairingsAsync(10);

        Assert.NotNull(result);
        Assert.Null(result!.CurrentRound);
        Assert.Empty(result.Pods);
    }

    [Fact]
    public async Task GetPairingsAsync_EventNotFound_ReturnsNull()
    {
        var eventRepo = new FakeEventRepository();
        // No events added

        var svc = BuildService(eventRepo);
        var result = await svc.GetPairingsAsync(99);

        Assert.Null(result);
    }

    [Fact]
    public async Task GetPairingsAsync_IncludesCommanderNameWhenDeclared()
    {
        var p1 = MakePlayer(1, "Alice");
        var eventRepo = new FakeEventRepository();
        eventRepo.Events.Add(new Event { Id = 10, Name = "Draft", Status = EventStatus.InProgress });
        eventRepo.LatestRound = MakeRound(10, 1, [(p1, "Atraxa")]);
        eventRepo.Registrations.Add(new EventRegistration
        {
            Id = 1, EventId = 10, PlayerId = 1, Player = p1, Commanders = "Atraxa"
        });

        var svc = BuildService(eventRepo);
        var result = await svc.GetPairingsAsync(10);

        Assert.NotNull(result);
        var player = result!.Pods[0].Players[0];
        Assert.Equal("Atraxa", player.CommanderName);
    }
}
