using TournamentOrganizer.Api.DTOs;
using TournamentOrganizer.Api.Models;
using TournamentOrganizer.Api.Repositories.Interfaces;
using TournamentOrganizer.Api.Services;
using TournamentOrganizer.Api.Services.Interfaces;

namespace TournamentOrganizer.Tests;

/// <summary>
/// TDD tests for the soft-drop / withdraw feature (SetDroppedAsync).
/// </summary>
public class PlayerDropTests
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

        // stubs
        public Task<Event?> GetWithDetailsAsync(int id)                    => Task.FromResult<Event?>(null);
        public Task<List<Event>> GetAllAsync()                             => Task.FromResult(new List<Event>());
        public Task<List<Event>> GetAllWithStoreAsync(int? storeId = null) => Task.FromResult(new List<Event>());
        public Task<Event> CreateAsync(Event evt)                          => Task.FromResult(evt);
        public Task UpdateAsync(Event evt)                                 => Task.CompletedTask;
        public Task<EventRegistration> RegisterPlayerAsync(EventRegistration r) => Task.FromResult(r);
        public Task<List<Player>> GetRegisteredPlayersAsync(int eventId) =>
            Task.FromResult(Registrations
                .Where(r => r.EventId == eventId && !r.IsDropped && !r.IsDisqualified)
                .Select(r => r.Player)
                .ToList());
        public Task<bool> IsPlayerRegisteredAsync(int eventId, int playerId) => Task.FromResult(false);
        public Task<Round> CreateRoundAsync(Round round)                   => Task.FromResult(round);
        public Task<Round?> GetLatestRoundWithPairingsAsync(int eventId)   => Task.FromResult<Round?>(null);
        public Task<Round?> GetRoundWithDetailsAsync(int roundId)          => Task.FromResult<Round?>(null);
        public Task<List<Round>> GetRoundsForEventAsync(int eventId)       => Task.FromResult(new List<Round>());
        public Task RemoveRegistrationAsync(EventRegistration r)           => Task.CompletedTask;
    }

    private sealed class StubPlayerRepo : IPlayerRepository
    {
        public Task<Player?> GetByIdAsync(int id)                                           => Task.FromResult<Player?>(null);
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

    private static EventService BuildService(FakeEventRepository repo) =>
        new(repo, new StubPlayerRepo(), new StubGameRepo(), new StubPodService(), new StubTrueSkillService(), new StubStoreEventRepo(), new StubDiscordWebhookService(), new StubBadgeService(), new StubLicenseTierService());

    // ── Tests ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task SetDroppedAsync_DropsPlayer_SetsIsDroppedAndDroppedAfterRound()
    {
        var player5 = new Player { Id = 5, Name = "Eve", Mu = 25, Sigma = 8.333 };
        var repo = new FakeEventRepository();
        repo.Events.Add(new Event { Id = 1, Status = EventStatus.InProgress });
        repo.Rounds.Add(new Round { Id = 10, EventId = 1, RoundNumber = 2 });
        repo.Registrations.Add(new EventRegistration { EventId = 1, PlayerId = 5, IsDropped = false, Player = player5 });

        var svc = BuildService(repo);
        var result = await svc.SetDroppedAsync(1, 5, dropped: true);

        Assert.True(result.IsDropped);
        Assert.Equal(2, result.DroppedAfterRound);

        var stored = repo.Registrations.Single(r => r.PlayerId == 5);
        Assert.True(stored.IsDropped);
        Assert.Equal(2, stored.DroppedAfterRound);
    }

    [Fact]
    public async Task SetDroppedAsync_DropsPlayer_WithNoRounds_SetsDroppedAfterRoundZero()
    {
        var player5 = new Player { Id = 5, Name = "Eve", Mu = 25, Sigma = 8.333 };
        var repo = new FakeEventRepository();
        repo.Events.Add(new Event { Id = 1, Status = EventStatus.InProgress });
        // No rounds yet
        repo.Registrations.Add(new EventRegistration { EventId = 1, PlayerId = 5, IsDropped = false, Player = player5 });

        var svc = BuildService(repo);
        var result = await svc.SetDroppedAsync(1, 5, dropped: true);

        Assert.True(result.IsDropped);
        Assert.Equal(0, result.DroppedAfterRound);
    }

    [Fact]
    public async Task SetDroppedAsync_UndropsPlayer_ClearsDroppedAfterRound()
    {
        var player5 = new Player { Id = 5, Name = "Eve", Mu = 25, Sigma = 8.333 };
        var repo = new FakeEventRepository();
        repo.Events.Add(new Event { Id = 1, Status = EventStatus.InProgress });
        repo.Rounds.Add(new Round { Id = 10, EventId = 1, RoundNumber = 1 });
        repo.Registrations.Add(new EventRegistration
        {
            EventId = 1, PlayerId = 5, IsDropped = true, DroppedAfterRound = 1, Player = player5
        });

        var svc = BuildService(repo);
        var result = await svc.SetDroppedAsync(1, 5, dropped: false);

        Assert.False(result.IsDropped);
        Assert.Null(result.DroppedAfterRound);

        var stored = repo.Registrations.Single(r => r.PlayerId == 5);
        Assert.False(stored.IsDropped);
        Assert.Null(stored.DroppedAfterRound);
    }

    [Fact]
    public async Task SetDroppedAsync_PlayerNotRegistered_ThrowsKeyNotFoundException()
    {
        var repo = new FakeEventRepository();
        repo.Events.Add(new Event { Id = 1, Status = EventStatus.InProgress });

        var svc = BuildService(repo);
        await Assert.ThrowsAsync<KeyNotFoundException>(() => svc.SetDroppedAsync(1, 99, dropped: true));
    }

    [Fact]
    public async Task SetDroppedAsync_EventNotInProgress_ThrowsInvalidOperationException()
    {
        var repo = new FakeEventRepository();
        repo.Events.Add(new Event { Id = 1, Status = EventStatus.Registration });
        repo.Registrations.Add(new EventRegistration { EventId = 1, PlayerId = 5 });

        var svc = BuildService(repo);
        await Assert.ThrowsAsync<InvalidOperationException>(() => svc.SetDroppedAsync(1, 5, dropped: true));
    }

    [Fact]
    public async Task PodSeeding_ExcludesDroppedPlayers()
    {
        // GenerateNextRoundAsync should only pass non-dropped registrations to pod service.
        // We verify this by checking how many players are included in pod generation
        // by observing the round's pods count vs player count.
        var repo = new FakeEventRepository();
        var evt = new Event { Id = 1, Status = EventStatus.InProgress, PlannedRounds = 10 };
        repo.Events.Add(evt);

        // 5 players: 4 active, 1 dropped — need ≥4 active to pass GenerateNextRoundAsync's minimum check
        var alice   = new Player { Id = 1, Name = "Alice",   Mu = 25, Sigma = 8.333 };
        var bob     = new Player { Id = 2, Name = "Bob",     Mu = 25, Sigma = 8.333 };
        var charlie = new Player { Id = 3, Name = "Charlie", Mu = 25, Sigma = 8.333 };
        var dave    = new Player { Id = 4, Name = "Dave",    Mu = 25, Sigma = 8.333 };
        var eve     = new Player { Id = 5, Name = "Eve",     Mu = 25, Sigma = 8.333 };

        repo.Registrations.AddRange([
            new EventRegistration { EventId = 1, PlayerId = 1, IsCheckedIn = true, IsDropped = false, Player = alice },
            new EventRegistration { EventId = 1, PlayerId = 2, IsCheckedIn = true, IsDropped = false, Player = bob },
            new EventRegistration { EventId = 1, PlayerId = 3, IsCheckedIn = true, IsDropped = true,  Player = charlie },
            new EventRegistration { EventId = 1, PlayerId = 4, IsCheckedIn = true, IsDropped = false, Player = dave },
            new EventRegistration { EventId = 1, PlayerId = 5, IsCheckedIn = true, IsDropped = false, Player = eve },
        ]);

        // Provide a previous round (round 1) so GenerateNextRoundAsync uses finish-group seeding
        var prevRound = new Round
        {
            Id = 10, EventId = 1, RoundNumber = 1,
            Pods = [new Pod
            {
                Id = 1, PodNumber = 1, FinishGroup = null,
                Game = new Game
                {
                    Status = GameStatus.Completed,
                    Results = [
                        new GameResult { PlayerId = 1, FinishPosition = 1, Player = alice },
                        new GameResult { PlayerId = 2, FinishPosition = 2, Player = bob },
                        new GameResult { PlayerId = 3, FinishPosition = 3, Player = charlie },
                        new GameResult { PlayerId = 4, FinishPosition = 4, Player = dave },
                        new GameResult { PlayerId = 5, FinishPosition = 4, Player = eve },
                    ]
                },
                PodPlayers = [
                    new PodPlayer { PlayerId = 1, Player = alice,   SeatOrder = 1 },
                    new PodPlayer { PlayerId = 2, Player = bob,     SeatOrder = 2 },
                    new PodPlayer { PlayerId = 3, Player = charlie, SeatOrder = 3 },
                    new PodPlayer { PlayerId = 4, Player = dave,    SeatOrder = 4 },
                    new PodPlayer { PlayerId = 5, Player = eve,     SeatOrder = 5 },
                ]
            }]
        };
        repo.Rounds.Add(prevRound);

        var svc = BuildService(repo);
        var round = await svc.GenerateNextRoundAsync(1);

        // 4 active players (charlie dropped); all pods combined should contain exactly 4 players
        var totalPlayers = round.Pods.Sum(p => p.Players.Count);
        Assert.Equal(4, totalPlayers);
        Assert.DoesNotContain(round.Pods.SelectMany(p => p.Players), p => p.PlayerId == 3);
    }
}
