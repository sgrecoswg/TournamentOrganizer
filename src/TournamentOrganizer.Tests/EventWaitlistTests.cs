using TournamentOrganizer.Api.DTOs;
using TournamentOrganizer.Api.Models;
using TournamentOrganizer.Api.Repositories.Interfaces;
using TournamentOrganizer.Api.Services;
using TournamentOrganizer.Api.Services.Interfaces;

namespace TournamentOrganizer.Tests;

/// <summary>
/// TDD tests for the Event Waitlist feature.
/// </summary>
public class EventWaitlistTests
{
    // ── Fake EventRepository ─────────────────────────────────────────────

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

    // ── Helpers ──────────────────────────────────────────────────────────

    private static Player MakePlayer(int id) =>
        new() { Id = id, Name = $"Player{id}", Mu = 25, Sigma = 8.333 };

    // ── Tests ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task RegisterPlayerAsync_WhenNotFull_AddsNormally()
    {
        var player1 = MakePlayer(1);
        var player2 = MakePlayer(2);
        var playerRepo = new StubPlayerRepo();
        playerRepo.Add(player1);
        playerRepo.Add(player2);
        var repo = new FakeEventRepository();
        repo.Events.Add(new Event { Id = 1, Status = EventStatus.Registration, MaxPlayers = 4 });
        repo.Registrations.Add(new EventRegistration { EventId = 1, PlayerId = 1, Player = player1 });

        var svc = BuildService(repo, playerRepo);
        await svc.RegisterPlayerAsync(1, 2);

        var reg = repo.Registrations.First(r => r.PlayerId == 2);
        Assert.False(reg.IsWaitlisted);
        Assert.Null(reg.WaitlistPosition);
    }

    [Fact]
    public async Task RegisterPlayerAsync_WhenFull_AddsToWaitlist()
    {
        var player1 = MakePlayer(1);
        var player2 = MakePlayer(2);
        var player3 = MakePlayer(3);
        var playerRepo = new StubPlayerRepo();
        playerRepo.Add(player1);
        playerRepo.Add(player2);
        playerRepo.Add(player3);
        var repo = new FakeEventRepository();
        repo.Events.Add(new Event { Id = 1, Status = EventStatus.Registration, MaxPlayers = 2 });
        repo.Registrations.Add(new EventRegistration { EventId = 1, PlayerId = 1, Player = player1 });
        repo.Registrations.Add(new EventRegistration { EventId = 1, PlayerId = 2, Player = player2 });

        var svc = BuildService(repo, playerRepo);
        await svc.RegisterPlayerAsync(1, 3);

        var reg = repo.Registrations.First(r => r.PlayerId == 3);
        Assert.True(reg.IsWaitlisted);
        Assert.Equal(1, reg.WaitlistPosition);
    }

    [Fact]
    public async Task RegisterPlayerAsync_WhenFull_SecondWaitlistPlayer_GetsPosition2()
    {
        var players = Enumerable.Range(1, 4).Select(MakePlayer).ToList();
        var playerRepo = new StubPlayerRepo();
        players.ForEach(playerRepo.Add);
        var repo = new FakeEventRepository();
        repo.Events.Add(new Event { Id = 1, Status = EventStatus.Registration, MaxPlayers = 2 });
        repo.Registrations.Add(new EventRegistration { EventId = 1, PlayerId = 1, Player = players[0] });
        repo.Registrations.Add(new EventRegistration { EventId = 1, PlayerId = 2, Player = players[1] });
        repo.Registrations.Add(new EventRegistration { EventId = 1, PlayerId = 3, Player = players[2], IsWaitlisted = true, WaitlistPosition = 1 });

        var svc = BuildService(repo, playerRepo);
        await svc.RegisterPlayerAsync(1, 4);

        var reg = repo.Registrations.First(r => r.PlayerId == 4);
        Assert.True(reg.IsWaitlisted);
        Assert.Equal(2, reg.WaitlistPosition);
    }

    [Fact]
    public async Task PromoteFromWaitlistAsync_PromotesLowestPosition()
    {
        var player3 = MakePlayer(3);
        var player4 = MakePlayer(4);
        var repo = new FakeEventRepository();
        repo.Events.Add(new Event { Id = 1, Status = EventStatus.Registration, MaxPlayers = 2 });
        repo.Registrations.Add(new EventRegistration { EventId = 1, PlayerId = 3, Player = player3, IsWaitlisted = true, WaitlistPosition = 1 });
        repo.Registrations.Add(new EventRegistration { EventId = 1, PlayerId = 4, Player = player4, IsWaitlisted = true, WaitlistPosition = 2 });

        var svc = BuildService(repo);
        await svc.PromoteFromWaitlistAsync(1);

        var promoted = repo.Registrations.First(r => r.PlayerId == 3);
        Assert.False(promoted.IsWaitlisted);
        Assert.Null(promoted.WaitlistPosition);
    }

    [Fact]
    public async Task PromoteFromWaitlistAsync_RecomputesRemainingPositions()
    {
        var player3 = MakePlayer(3);
        var player4 = MakePlayer(4);
        var player5 = MakePlayer(5);
        var repo = new FakeEventRepository();
        repo.Events.Add(new Event { Id = 1, Status = EventStatus.Registration, MaxPlayers = 2 });
        repo.Registrations.Add(new EventRegistration { EventId = 1, PlayerId = 3, Player = player3, IsWaitlisted = true, WaitlistPosition = 1 });
        repo.Registrations.Add(new EventRegistration { EventId = 1, PlayerId = 4, Player = player4, IsWaitlisted = true, WaitlistPosition = 2 });
        repo.Registrations.Add(new EventRegistration { EventId = 1, PlayerId = 5, Player = player5, IsWaitlisted = true, WaitlistPosition = 3 });

        var svc = BuildService(repo);
        await svc.PromoteFromWaitlistAsync(1);

        // Position 2 becomes 1, position 3 becomes 2
        Assert.Equal(1, repo.Registrations.First(r => r.PlayerId == 4).WaitlistPosition);
        Assert.Equal(2, repo.Registrations.First(r => r.PlayerId == 5).WaitlistPosition);
    }

    [Fact]
    public async Task DropPlayer_TriggersAutoPromotion()
    {
        var player1 = MakePlayer(1);
        var player2 = MakePlayer(2);
        var player3 = MakePlayer(3);
        var repo = new FakeEventRepository();
        repo.Events.Add(new Event { Id = 1, Status = EventStatus.InProgress });
        repo.Registrations.Add(new EventRegistration { EventId = 1, PlayerId = 1, Player = player1, IsDropped = false });
        repo.Registrations.Add(new EventRegistration { EventId = 1, PlayerId = 2, Player = player2, IsDropped = false });
        repo.Registrations.Add(new EventRegistration { EventId = 1, PlayerId = 3, Player = player3, IsWaitlisted = true, WaitlistPosition = 1 });

        var svc = BuildService(repo);
        await svc.SetDroppedAsync(1, 1, true);

        var promoted = repo.Registrations.First(r => r.PlayerId == 3);
        Assert.False(promoted.IsWaitlisted);
        Assert.Null(promoted.WaitlistPosition);
    }

    [Fact]
    public async Task ManualPromoteAsync_PromotesSpecificPlayer()
    {
        var player3 = MakePlayer(3);
        var player4 = MakePlayer(4);
        var repo = new FakeEventRepository();
        repo.Events.Add(new Event { Id = 1, Status = EventStatus.Registration, MaxPlayers = 2 });
        repo.Registrations.Add(new EventRegistration { EventId = 1, PlayerId = 3, Player = player3, IsWaitlisted = true, WaitlistPosition = 1 });
        repo.Registrations.Add(new EventRegistration { EventId = 1, PlayerId = 4, Player = player4, IsWaitlisted = true, WaitlistPosition = 2 });

        var svc = BuildService(repo);
        var result = await svc.ManualPromoteAsync(1, 4);

        Assert.Equal(4, result.PlayerId);
        Assert.False(result.IsWaitlisted);
        Assert.Null(result.WaitlistPosition);
    }

    [Fact]
    public async Task ManualPromoteAsync_PlayerNotWaitlisted_ThrowsInvalidOperationException()
    {
        var player1 = MakePlayer(1);
        var repo = new FakeEventRepository();
        repo.Events.Add(new Event { Id = 1, Status = EventStatus.Registration, MaxPlayers = 2 });
        repo.Registrations.Add(new EventRegistration { EventId = 1, PlayerId = 1, Player = player1, IsWaitlisted = false });

        var svc = BuildService(repo);
        await Assert.ThrowsAsync<InvalidOperationException>(() => svc.ManualPromoteAsync(1, 1));
    }
}
