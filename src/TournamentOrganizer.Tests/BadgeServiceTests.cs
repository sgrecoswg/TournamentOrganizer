using Microsoft.EntityFrameworkCore;
using TournamentOrganizer.Api.DTOs;
using TournamentOrganizer.Api.Models;
using TournamentOrganizer.Api.Repositories.Interfaces;
using TournamentOrganizer.Api.Services;
using TournamentOrganizer.Api.Services.Interfaces;

namespace TournamentOrganizer.Tests;

/// <summary>
/// TDD tests for BadgeService.
/// Written BEFORE wiring up the service — confirm red, then green.
/// </summary>
public class BadgeServiceTests
{
    // ── Fake IBadgeRepository ─────────────────────────────────────────────

    private sealed class FakeBadgeRepository : IBadgeRepository
    {
        public List<PlayerBadge> Awarded { get; } = [];
        private int _eventCount;
        private int _gameCount;
        private bool _hasWin;
        private readonly List<PlayerBadge> _eventWins;

        public FakeBadgeRepository(
            int eventCount = 0,
            int gameCount = 0,
            bool hasWin = false,
            List<PlayerBadge>? eventWins = null)
        {
            _eventCount = eventCount;
            _gameCount  = gameCount;
            _hasWin     = hasWin;
            _eventWins  = eventWins ?? [];
        }

        public Task<List<PlayerBadge>> GetByPlayerIdAsync(int playerId)
            => Task.FromResult(Awarded.Where(b => b.PlayerId == playerId).ToList());

        public Task<bool> ExistsAsync(int playerId, string badgeKey)
            => Task.FromResult(Awarded.Any(b => b.PlayerId == playerId && b.BadgeKey == badgeKey));

        public Task AddAsync(PlayerBadge badge)
        {
            Awarded.Add(badge);
            return Task.CompletedTask;
        }

        public Task<List<PlayerBadge>> GetEventWinsForPlayerAsync(int playerId, int eventId)
            => Task.FromResult(_eventWins.ToList());

        public Task<int> GetEventCountForPlayerAsync(int playerId)
            => Task.FromResult(_eventCount);

        public Task<int> GetGameCountForPlayerAsync(int playerId)
            => Task.FromResult(_gameCount);
    }

    // ── Fake IPlayerRepository ────────────────────────────────────────────

    private sealed class FakePlayerRepository : IPlayerRepository
    {
        private readonly Player _player;

        public FakePlayerRepository(Player player) => _player = player;

        public Task<Player?> GetByIdAsync(int id)        => Task.FromResult<Player?>(_player);
        public Task<Player?> GetByEmailAsync(string e)   => throw new NotImplementedException();
        public Task<List<Player>> GetLeaderboardAsync()  => throw new NotImplementedException();
        public Task<List<Player>> GetAllAsync()          => throw new NotImplementedException();
        public Task<Player> CreateAsync(Player p)        => throw new NotImplementedException();
        public Task UpdateAsync(Player p)                => Task.CompletedTask;
        public Task UpdateRangeAsync(IEnumerable<Player> ps) => Task.CompletedTask;
        public Task<List<Player>> GetByIdsAsync(IEnumerable<int> ids) => throw new NotImplementedException();
        public Task<List<EventRegistration>> GetPlayerEventRegistrationsAsync(int pid) => throw new NotImplementedException();
    }

    // ── Fake IGameRepository ──────────────────────────────────────────────

    private sealed class FakeGameRepository : IGameRepository
    {
        public Task<Game?> GetByIdAsync(int id) => throw new NotImplementedException();
        public Task<Game?> GetWithResultsAsync(int id) => throw new NotImplementedException();
        public Task<Game> CreateAsync(Game g) => throw new NotImplementedException();
        public Task UpdateAsync(Game g) => throw new NotImplementedException();
        public Task AddResultsAsync(IEnumerable<GameResult> r) => throw new NotImplementedException();
        public Task<List<GameResult>> GetPlayerResultsAsync(int pid) => Task.FromResult(new List<GameResult>());
        public Task<List<GameResult>> GetPlayerGamesWithOpponentsAsync(int pid) => Task.FromResult(new List<GameResult>());
        public Task<List<int>> GetPreviousOpponentIdsAsync(int eid, int pid) => Task.FromResult(new List<int>());
        public Task<List<GameResult>> GetStoreGameResultsAsync(int storeId, DateTime? since) => Task.FromResult(new List<GameResult>());
        public Task<List<GameResult>> GetPlayerGamesForRatingReplayAsync(int pid) => Task.FromResult(new List<GameResult>());
        public Task DeleteResultsAsync(int gameId) => throw new NotImplementedException();
    }

    // ── InMemory AppDbContext helper ───────────────────────────────────────

    private static TournamentOrganizer.Api.Data.AppDbContext CreateInMemoryDb(string dbName)
    {
        var options = new Microsoft.EntityFrameworkCore.DbContextOptionsBuilder<TournamentOrganizer.Api.Data.AppDbContext>()
            .UseInMemoryDatabase(databaseName: dbName)
            .Options;
        return new TournamentOrganizer.Api.Data.AppDbContext(options);
    }

    // ── Helper to build BadgeService with InMemory DB ─────────────────────

    private static (BadgeService service, TournamentOrganizer.Api.Data.AppDbContext db, FakeBadgeRepository badgeRepo) BuildService(
        string dbName,
        Player? player = null,
        int eventCount = 0,
        int gameCount = 0)
    {
        var db = CreateInMemoryDb(dbName);
        var badgeRepo = new FakeBadgeRepository(eventCount, gameCount);
        var playerRepo = new FakePlayerRepository(player ?? new Player { Id = 1, PlacementGamesLeft = 0 });
        var gameRepo = new FakeGameRepository();
        var service = new BadgeService(badgeRepo, playerRepo, gameRepo, db);
        return (service, db, badgeRepo);
    }

    // ── Tests ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task CheckAndAward_FirstWin_AwardsBadge()
    {
        var dbName = nameof(CheckAndAward_FirstWin_AwardsBadge);
        using var db = CreateInMemoryDb(dbName);

        // Seed a completed game result with FinishPosition == 1
        var player = new Player { Id = 1, Name = "Alice", Email = "a@b.com" };
        var evt    = new Event  { Id = 1, Name = "E1" };
        var round  = new Round  { Id = 1, EventId = 1, RoundNumber = 1, Event = evt };
        var pod    = new Pod    { Id = 1, RoundId = 1, PodNumber = 1, Round = round };
        var game   = new Game   { Id = 1, PodId = 1, Status = GameStatus.Completed, Pod = pod };
        var result = new GameResult { Id = 1, GameId = 1, PlayerId = 1, FinishPosition = 1, Game = game };

        db.Players.Add(player);
        db.Events.Add(evt);
        db.Rounds.Add(round);
        db.Pods.Add(pod);
        db.Games.Add(game);
        db.GameResults.Add(result);
        await db.SaveChangesAsync();

        var badgeRepo  = new FakeBadgeRepository();
        var playerRepo = new FakePlayerRepository(player);
        var gameRepo   = new FakeGameRepository();
        var service    = new BadgeService(badgeRepo, playerRepo, gameRepo, db);

        await service.CheckAndAwardAsync(1, BadgeTrigger.GameResultRecorded, eventId: 1);

        Assert.Single(badgeRepo.Awarded);
        Assert.Equal("first_win", badgeRepo.Awarded[0].BadgeKey);
    }

    [Fact]
    public async Task CheckAndAward_FirstWin_AlreadyHasBadge_NoDuplicate()
    {
        var dbName = nameof(CheckAndAward_FirstWin_AlreadyHasBadge_NoDuplicate);
        using var db = CreateInMemoryDb(dbName);

        var player = new Player { Id = 1, Name = "Alice", Email = "a@b.com" };
        var evt    = new Event  { Id = 1, Name = "E1" };
        var round  = new Round  { Id = 1, EventId = 1, RoundNumber = 1, Event = evt };
        var pod    = new Pod    { Id = 1, RoundId = 1, PodNumber = 1, Round = round };
        var game   = new Game   { Id = 1, PodId = 1, Status = GameStatus.Completed, Pod = pod };
        var result = new GameResult { Id = 1, GameId = 1, PlayerId = 1, FinishPosition = 1, Game = game };

        db.Players.Add(player);
        db.Events.Add(evt);
        db.Rounds.Add(round);
        db.Pods.Add(pod);
        db.Games.Add(game);
        db.GameResults.Add(result);
        await db.SaveChangesAsync();

        // Pre-award the badge so it already exists
        var existingBadge = new PlayerBadge { PlayerId = 1, BadgeKey = "first_win" };
        var badgeRepo  = new FakeBadgeRepository();
        badgeRepo.Awarded.Add(existingBadge);
        var playerRepo = new FakePlayerRepository(player);
        var gameRepo   = new FakeGameRepository();
        var service    = new BadgeService(badgeRepo, playerRepo, gameRepo, db);

        await service.CheckAndAwardAsync(1, BadgeTrigger.GameResultRecorded, eventId: 1);

        // Still only 1 badge (no duplicate added)
        Assert.Single(badgeRepo.Awarded);
    }

    [Fact]
    public async Task CheckAndAward_PlacementComplete_AwardsBadge()
    {
        var dbName = nameof(CheckAndAward_PlacementComplete_AwardsBadge);
        using var db = CreateInMemoryDb(dbName);

        // Player with PlacementGamesLeft == 0 (just ranked)
        var player = new Player { Id = 1, Name = "Alice", Email = "a@b.com", PlacementGamesLeft = 0 };
        var badgeRepo  = new FakeBadgeRepository();
        var playerRepo = new FakePlayerRepository(player);
        var gameRepo   = new FakeGameRepository();
        var service    = new BadgeService(badgeRepo, playerRepo, gameRepo, db);

        await service.CheckAndAwardAsync(1, BadgeTrigger.PlacementComplete, eventId: 1);

        Assert.Single(badgeRepo.Awarded);
        Assert.Equal("placement_complete", badgeRepo.Awarded[0].BadgeKey);
    }

    [Fact]
    public async Task CheckAndAward_TournamentWinner_AwardsBadge()
    {
        var dbName = nameof(CheckAndAward_TournamentWinner_AwardsBadge);
        using var db = CreateInMemoryDb(dbName);

        var player = new Player { Id = 1, Name = "Alice", Email = "a@b.com" };
        var badgeRepo  = new FakeBadgeRepository();
        var playerRepo = new FakePlayerRepository(player);
        var gameRepo   = new FakeGameRepository();
        var service    = new BadgeService(badgeRepo, playerRepo, gameRepo, db);

        await service.CheckAndAwardAsync(1, BadgeTrigger.TournamentWinner, eventId: 5);

        // TournamentWinner badge should be awarded (caller is responsible for only calling for winner)
        var tournamentBadge = badgeRepo.Awarded.FirstOrDefault(b => b.BadgeKey == "tournament_winner");
        Assert.NotNull(tournamentBadge);
        Assert.Equal(5, tournamentBadge.EventId);
    }

    [Fact]
    public async Task CheckAndAward_Veteran_10Events_AwardsBadge()
    {
        var dbName = nameof(CheckAndAward_Veteran_10Events_AwardsBadge);
        using var db = CreateInMemoryDb(dbName);

        var player = new Player { Id = 1, Name = "Alice", Email = "a@b.com" };
        var badgeRepo  = new FakeBadgeRepository(eventCount: 10);
        var playerRepo = new FakePlayerRepository(player);
        var gameRepo   = new FakeGameRepository();
        var service    = new BadgeService(badgeRepo, playerRepo, gameRepo, db);

        await service.CheckAndAwardAsync(1, BadgeTrigger.EventCompleted, eventId: 10);

        Assert.Contains(badgeRepo.Awarded, b => b.BadgeKey == "veteran");
    }

    [Fact]
    public async Task CheckAndAward_Veteran_9Events_DoesNotAward()
    {
        var dbName = nameof(CheckAndAward_Veteran_9Events_DoesNotAward);
        using var db = CreateInMemoryDb(dbName);

        var player = new Player { Id = 1, Name = "Alice", Email = "a@b.com" };
        var badgeRepo  = new FakeBadgeRepository(eventCount: 9);
        var playerRepo = new FakePlayerRepository(player);
        var gameRepo   = new FakeGameRepository();
        var service    = new BadgeService(badgeRepo, playerRepo, gameRepo, db);

        await service.CheckAndAwardAsync(1, BadgeTrigger.EventCompleted, eventId: 9);

        Assert.DoesNotContain(badgeRepo.Awarded, b => b.BadgeKey == "veteran");
    }

    [Fact]
    public async Task CheckAndAward_UndefeatedSwiss_AllPodsWon_AwardsBadge()
    {
        var dbName = nameof(CheckAndAward_UndefeatedSwiss_AllPodsWon_AwardsBadge);
        using var db = CreateInMemoryDb(dbName);

        // Seed an event with 2 rounds, player wins both
        var player = new Player { Id = 1, Name = "Alice", Email = "a@b.com" };
        var evt    = new Event  { Id = 1, Name = "E1" };

        var round1 = new Round { Id = 1, EventId = 1, RoundNumber = 1, Event = evt };
        var round2 = new Round { Id = 2, EventId = 1, RoundNumber = 2, Event = evt };
        var pod1   = new Pod   { Id = 1, RoundId = 1, PodNumber = 1, Round = round1 };
        var pod2   = new Pod   { Id = 2, RoundId = 2, PodNumber = 1, Round = round2 };
        var game1  = new Game  { Id = 1, PodId = 1, Status = GameStatus.Completed, Pod = pod1 };
        var game2  = new Game  { Id = 2, PodId = 2, Status = GameStatus.Completed, Pod = pod2 };

        // Player wins both games (FinishPosition == 1)
        var result1 = new GameResult { Id = 1, GameId = 1, PlayerId = 1, FinishPosition = 1, Game = game1 };
        var result2 = new GameResult { Id = 2, GameId = 2, PlayerId = 1, FinishPosition = 1, Game = game2 };

        db.Players.Add(player);
        db.Events.Add(evt);
        db.Rounds.AddRange(round1, round2);
        db.Pods.AddRange(pod1, pod2);
        db.Games.AddRange(game1, game2);
        db.GameResults.AddRange(result1, result2);
        await db.SaveChangesAsync();

        var badgeRepo  = new FakeBadgeRepository();
        var playerRepo = new FakePlayerRepository(player);
        var gameRepo   = new FakeGameRepository();
        var service    = new BadgeService(badgeRepo, playerRepo, gameRepo, db);

        await service.CheckAndAwardAsync(1, BadgeTrigger.EventCompleted, eventId: 1);

        Assert.Contains(badgeRepo.Awarded, b => b.BadgeKey == "undefeated_swiss");
    }

    [Fact]
    public async Task CheckAndAward_UndefeatedSwiss_OneNonWin_DoesNotAward()
    {
        var dbName = nameof(CheckAndAward_UndefeatedSwiss_OneNonWin_DoesNotAward);
        using var db = CreateInMemoryDb(dbName);

        var player = new Player { Id = 1, Name = "Alice", Email = "a@b.com" };
        var evt    = new Event  { Id = 1, Name = "E1" };

        var round1 = new Round { Id = 1, EventId = 1, RoundNumber = 1, Event = evt };
        var round2 = new Round { Id = 2, EventId = 1, RoundNumber = 2, Event = evt };
        var pod1   = new Pod   { Id = 1, RoundId = 1, PodNumber = 1, Round = round1 };
        var pod2   = new Pod   { Id = 2, RoundId = 2, PodNumber = 1, Round = round2 };
        var game1  = new Game  { Id = 1, PodId = 1, Status = GameStatus.Completed, Pod = pod1 };
        var game2  = new Game  { Id = 2, PodId = 2, Status = GameStatus.Completed, Pod = pod2 };

        // Player wins round 1 but comes 2nd in round 2
        var result1 = new GameResult { Id = 1, GameId = 1, PlayerId = 1, FinishPosition = 1, Game = game1 };
        var result2 = new GameResult { Id = 2, GameId = 2, PlayerId = 1, FinishPosition = 2, Game = game2 };

        db.Players.Add(player);
        db.Events.Add(evt);
        db.Rounds.AddRange(round1, round2);
        db.Pods.AddRange(pod1, pod2);
        db.Games.AddRange(game1, game2);
        db.GameResults.AddRange(result1, result2);
        await db.SaveChangesAsync();

        var badgeRepo  = new FakeBadgeRepository();
        var playerRepo = new FakePlayerRepository(player);
        var gameRepo   = new FakeGameRepository();
        var service    = new BadgeService(badgeRepo, playerRepo, gameRepo, db);

        await service.CheckAndAwardAsync(1, BadgeTrigger.EventCompleted, eventId: 1);

        Assert.DoesNotContain(badgeRepo.Awarded, b => b.BadgeKey == "undefeated_swiss");
    }
}
