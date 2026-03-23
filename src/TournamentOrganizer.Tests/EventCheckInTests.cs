using TournamentOrganizer.Api.DTOs;
using TournamentOrganizer.Api.Models;
using TournamentOrganizer.Api.Repositories.Interfaces;
using TournamentOrganizer.Api.Services;
using TournamentOrganizer.Api.Services.Interfaces;

namespace TournamentOrganizer.Tests;

/// <summary>
/// TDD tests for the Event Check-In feature.
/// Written BEFORE implementation — they fail until the corresponding changes are in place.
/// </summary>
public class EventCheckInTests
{
    // ── Fake EventRepository ─────────────────────────────────────────────

    private sealed class FakeEventRepository : IEventRepository
    {
        public List<Event> Events { get; } = [];
        public List<EventRegistration> Registrations { get; } = [];
        public Round? PreviousRound { get; set; }

        public Task<Event?> GetByIdAsync(int id) =>
            Task.FromResult(Events.FirstOrDefault(e => e.Id == id));

        public Task<EventRegistration?> GetRegistrationAsync(int eventId, int playerId) =>
            Task.FromResult(Registrations.FirstOrDefault(r => r.EventId == eventId && r.PlayerId == playerId));

        public Task UpdateRegistrationAsync(EventRegistration updated)
        {
            var existing = Registrations.FirstOrDefault(r => r.Id == updated.Id);
            if (existing != null)
            {
                existing.IsCheckedIn    = updated.IsCheckedIn;
                existing.IsDropped      = updated.IsDropped;
                existing.IsDisqualified = updated.IsDisqualified;
            }
            return Task.CompletedTask;
        }

        public Task<List<EventRegistration>> GetRegistrationsWithPlayersAsync(int eventId) =>
            Task.FromResult(Registrations.Where(r => r.EventId == eventId).ToList());

        public Task<Round?> GetLatestRoundWithPairingsAsync(int eventId) => Task.FromResult(PreviousRound);
        public Task<Round?> GetLatestRoundAsync(int eventId) =>
            Task.FromResult(PreviousRound);

        public Task<Round> CreateRoundAsync(Round round)
        {
            round.Id = 1;
            int podId = 1;
            foreach (var pod in round.Pods)
            {
                pod.Id   = podId;
                pod.Game = new Game { Id = podId, Status = GameStatus.Pending };
                podId++;
            }
            return Task.FromResult(round);
        }

        public Task<List<Player>> GetRegisteredPlayersAsync(int eventId) =>
            Task.FromResult(Registrations.Where(r => r.EventId == eventId).Select(r => r.Player).ToList());

        public Task UpdateAsync(Event evt) => Task.CompletedTask;

        // Unused stubs
        public Task<List<Event>> GetAllWithStoreAsync(int? storeId = null) => throw new NotImplementedException();
        public Task<Event?> GetWithDetailsAsync(int id)                    => throw new NotImplementedException();
        public Task<List<Event>> GetAllAsync()                             => throw new NotImplementedException();
        public Task<Event> CreateAsync(Event evt)                          => throw new NotImplementedException();
        public Task<EventRegistration> RegisterPlayerAsync(EventRegistration r) => throw new NotImplementedException();
        public Task<bool> IsPlayerRegisteredAsync(int eid, int pid)        => throw new NotImplementedException();
        public Task<Round?> GetRoundWithDetailsAsync(int rid)              => throw new NotImplementedException();
        public Task<List<Round>> GetRoundsForEventAsync(int eid)           => Task.FromResult(new List<Round>());
        public Task RemoveRegistrationAsync(EventRegistration r)           => Task.CompletedTask;
        public Task<Event?> GetByCheckInTokenAsync(string token)            => Task.FromResult<Event?>(null);
    }

    // ── Fake PlayerRepository ────────────────────────────────────────────

    private sealed class FakePlayerRepository : IPlayerRepository
    {
        private readonly List<Player> _players;
        public FakePlayerRepository(List<Player> players) => _players = players;

        public Task<Player?> GetByIdAsync(int id) =>
            Task.FromResult(_players.FirstOrDefault(p => p.Id == id));

        public Task<Player?> GetByEmailAsync(string e)                                 => throw new NotImplementedException();
        public Task<List<Player>> GetLeaderboardAsync()                                 => throw new NotImplementedException();
        public Task<List<Player>> GetAllAsync()                                         => Task.FromResult(new List<Player>());
        public Task<Player> CreateAsync(Player p)                                       => throw new NotImplementedException();
        public Task UpdateAsync(Player p)                                               => Task.CompletedTask;
        public Task UpdateRangeAsync(IEnumerable<Player> ps)                            => Task.CompletedTask;
        public Task<List<Player>> GetByIdsAsync(IEnumerable<int> ids)                  => throw new NotImplementedException();
        public Task<List<EventRegistration>> GetPlayerEventRegistrationsAsync(int pid) => throw new NotImplementedException();
    }

    // ── Capturing PodService ─────────────────────────────────────────────

    private sealed class CapturingPodService : IPodService
    {
        public List<Player>? CapturedRound1Players { get; private set; }
        public List<Player>? CapturedRound2Players { get; private set; }

        public List<List<Player>> GenerateRound1Pods(List<Player> players)
        {
            CapturedRound1Players = players;
            return [players]; // one pod with all players — enough for DTO construction
        }

        public List<List<Player>> GenerateNextRoundPods(Round previousRound, List<Player> activePlayers)
        {
            CapturedRound2Players = activePlayers;
            return [activePlayers];
        }
    }

    // ── Stubs ────────────────────────────────────────────────────────────

    private sealed class StubGameRepository : IGameRepository
    {
        public Task<Game?> GetByIdAsync(int id)                            => throw new NotImplementedException();
        public Task<Game?> GetWithResultsAsync(int id)                     => throw new NotImplementedException();
        public Task<Game> CreateAsync(Game g)                              => throw new NotImplementedException();
        public Task UpdateAsync(Game g)                                    => throw new NotImplementedException();
        public Task AddResultsAsync(IEnumerable<GameResult> r)             => throw new NotImplementedException();
        public Task DeleteResultsAsync(int gameId)                         => throw new NotImplementedException();
        public Task<List<GameResult>> GetPlayerResultsAsync(int pid)       => throw new NotImplementedException();
        public Task<List<GameResult>> GetPlayerGamesWithOpponentsAsync(int pid) => throw new NotImplementedException();
        public Task<List<int>> GetPreviousOpponentIdsAsync(int eid, int pid) => throw new NotImplementedException();
        public Task<List<GameResult>> GetStoreGameResultsAsync(int storeId, DateTime? since) => Task.FromResult(new List<GameResult>());
        public Task<List<GameResult>> GetPlayerGamesForRatingReplayAsync(int pid) => Task.FromResult(new List<GameResult>());
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
        public Task<(int? StoreId, string? StoreName)> GetStoreInfoForEventAsync(int eventId) =>
            Task.FromResult<(int?, string?)>((1, "Test Store"));
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

    // ── Helpers ──────────────────────────────────────────────────────────

    private static Player MakePlayer(int id, string name = "Player") => new()
    {
        Id = id, Name = name, Email = $"p{id}@test.com",
        Mu = 25, Sigma = 8.333
    };

    private static EventRegistration MakeRegistration(int eventId, Player player, bool isCheckedIn = false) => new()
    {
        Id = player.Id,
        EventId = eventId,
        PlayerId = player.Id,
        Player = player,
        IsCheckedIn = isCheckedIn
    };

    private static EventService BuildService(
        FakeEventRepository eventRepo,
        FakePlayerRepository? playerRepo = null,
        CapturingPodService? podService = null)
    {
        var players = eventRepo.Registrations.Select(r => r.Player).ToList();
        return new EventService(
            eventRepo,
            playerRepo ?? new FakePlayerRepository(players),
            new StubGameRepository(),
            podService ?? new CapturingPodService(),
            new StubTrueSkillService(),
            new StubStoreEventRepository(),
            new StubDiscordWebhookService(),
            new StubBadgeService(),
            new StubLicenseTierService());
    }

    // ── SetCheckInAsync tests ─────────────────────────────────────────────

    [Fact]
    public async Task SetCheckInAsync_ChecksInPlayer_ReturnsUpdatedDto()
    {
        var player = MakePlayer(1);
        var eventRepo = new FakeEventRepository();
        eventRepo.Events.Add(new Event { Id = 10, Status = EventStatus.Registration });
        eventRepo.Registrations.Add(MakeRegistration(10, player, isCheckedIn: false));

        var svc = BuildService(eventRepo);

        var result = await svc.SetCheckInAsync(10, 1, true);

        Assert.True(result.IsCheckedIn);
        Assert.Equal(1, result.PlayerId);
        Assert.True(eventRepo.Registrations.First().IsCheckedIn); // persisted
    }

    [Fact]
    public async Task SetCheckInAsync_UnchecksPlayer_ReturnsUpdatedDto()
    {
        var player = MakePlayer(1);
        var eventRepo = new FakeEventRepository();
        eventRepo.Events.Add(new Event { Id = 10, Status = EventStatus.Registration });
        eventRepo.Registrations.Add(MakeRegistration(10, player, isCheckedIn: true));

        var svc = BuildService(eventRepo);

        var result = await svc.SetCheckInAsync(10, 1, false);

        Assert.False(result.IsCheckedIn);
        Assert.False(eventRepo.Registrations.First().IsCheckedIn);
    }

    [Fact]
    public async Task SetCheckInAsync_PlayerNotRegistered_ThrowsKeyNotFoundException()
    {
        var eventRepo = new FakeEventRepository();
        eventRepo.Events.Add(new Event { Id = 10, Status = EventStatus.Registration });
        // No registration for player 99

        var svc = BuildService(eventRepo);

        await Assert.ThrowsAsync<KeyNotFoundException>(() => svc.SetCheckInAsync(10, 99, true));
    }

    [Fact]
    public async Task SetCheckInAsync_EventNotInRegistration_ThrowsInvalidOperationException()
    {
        var player = MakePlayer(1);
        var eventRepo = new FakeEventRepository();
        eventRepo.Events.Add(new Event { Id = 10, Status = EventStatus.InProgress });
        eventRepo.Registrations.Add(MakeRegistration(10, player, isCheckedIn: false));

        var svc = BuildService(eventRepo);

        await Assert.ThrowsAsync<InvalidOperationException>(() => svc.SetCheckInAsync(10, 1, true));
    }

    // ── GenerateNextRoundAsync tests ─────────────────────────────────────

    [Fact]
    public async Task GenerateRound1_OnlyCheckedInPlayersSeeded()
    {
        var checkedIn  = Enumerable.Range(1, 4).Select(i => MakePlayer(i)).ToList();
        var notChecked = Enumerable.Range(5, 2).Select(i => MakePlayer(i)).ToList();

        var eventRepo = new FakeEventRepository();
        eventRepo.Events.Add(new Event { Id = 10, Name = "T", Date = DateTime.UtcNow, Status = EventStatus.Registration });
        checkedIn.ForEach(p  => eventRepo.Registrations.Add(MakeRegistration(10, p, isCheckedIn: true)));
        notChecked.ForEach(p => eventRepo.Registrations.Add(MakeRegistration(10, p, isCheckedIn: false)));

        var podService = new CapturingPodService();
        var svc = BuildService(eventRepo, podService: podService);

        await svc.GenerateNextRoundAsync(10);

        Assert.NotNull(podService.CapturedRound1Players);
        Assert.Equal(4, podService.CapturedRound1Players!.Count);
        Assert.All(podService.CapturedRound1Players, p => Assert.Contains(p, checkedIn));
    }

    [Fact]
    public async Task GenerateRound1_NoCheckedInPlayers_ThrowsInvalidOperationException()
    {
        var players = Enumerable.Range(1, 4).Select(i => MakePlayer(i)).ToList();

        var eventRepo = new FakeEventRepository();
        eventRepo.Events.Add(new Event { Id = 10, Name = "T", Date = DateTime.UtcNow, Status = EventStatus.Registration });
        players.ForEach(p => eventRepo.Registrations.Add(MakeRegistration(10, p, isCheckedIn: false)));

        var svc = BuildService(eventRepo);

        await Assert.ThrowsAsync<InvalidOperationException>(() => svc.GenerateNextRoundAsync(10));
    }

    [Fact]
    public async Task GenerateRound2_UsesAllActivePlayersRegardlessOfCheckedIn()
    {
        // Round 2: players who were NOT checked in for round 1 but are still active should be seeded
        var players = Enumerable.Range(1, 4).Select(i => MakePlayer(i)).ToList();

        var eventRepo = new FakeEventRepository();
        eventRepo.Events.Add(new Event { Id = 10, Name = "T", Date = DateTime.UtcNow, Status = EventStatus.InProgress });
        // None are checked in — but that shouldn't matter for round 2+
        players.ForEach(p => eventRepo.Registrations.Add(MakeRegistration(10, p, isCheckedIn: false)));

        // Provide a completed previous round so GenerateNextRoundAsync generates round 2
        eventRepo.PreviousRound = new Round
        {
            Id = 1, EventId = 10, RoundNumber = 1,
            Pods = [new Pod
            {
                Id = 1, PodNumber = 1,
                Game = new Game { Id = 1, Status = GameStatus.Completed },
                PodPlayers = players.Select((p, i) => new PodPlayer { PlayerId = p.Id, SeatOrder = i + 1 }).ToList()
            }]
        };

        var podService = new CapturingPodService();
        var svc = BuildService(eventRepo, podService: podService);

        await svc.GenerateNextRoundAsync(10);

        Assert.NotNull(podService.CapturedRound2Players);
        Assert.Equal(4, podService.CapturedRound2Players!.Count); // all 4 active, regardless of IsCheckedIn
    }
}
