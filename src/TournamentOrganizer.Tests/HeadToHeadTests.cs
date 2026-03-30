using TournamentOrganizer.Api.DTOs;
using TournamentOrganizer.Api.Models;
using TournamentOrganizer.Api.Repositories.Interfaces;
using TournamentOrganizer.Api.Services;

namespace TournamentOrganizer.Tests;

/// <summary>
/// TDD tests for GetHeadToHeadAsync — written BEFORE implementation.
/// </summary>
public class HeadToHeadTests
{
    // ── Fake IGameRepository ─────────────────────────────────────────────────

    private sealed class FakeGameRepository : IGameRepository
    {
        private readonly List<GameResult> _results;
        public FakeGameRepository(List<GameResult> results) => _results = results;

        public Task<List<GameResult>> GetPlayerGamesWithOpponentsAsync(int playerId)
        {
            var mine = _results.Where(r => r.PlayerId == playerId).ToList();
            return Task.FromResult(mine);
        }

        // unused for these tests
        public Task<Game?> GetByIdAsync(int id) => throw new NotImplementedException();
        public Task<Game?> GetWithResultsAsync(int id) => throw new NotImplementedException();
        public Task<Game> CreateAsync(Game game) => throw new NotImplementedException();
        public Task UpdateAsync(Game game) => throw new NotImplementedException();
        public Task AddResultsAsync(IEnumerable<GameResult> results) => throw new NotImplementedException();
        public Task DeleteResultsAsync(int gameId) => throw new NotImplementedException();
        public Task<List<GameResult>> GetPlayerResultsAsync(int playerId) => throw new NotImplementedException();
        public Task<List<int>> GetPreviousOpponentIdsAsync(int eventId, int playerId) => throw new NotImplementedException();
        public Task<List<GameResult>> GetStoreGameResultsAsync(int storeId, DateTime? since) => Task.FromResult(new List<GameResult>());
        public Task<List<GameResult>> GetPlayerGamesForRatingReplayAsync(int pid) => Task.FromResult(new List<GameResult>());
    }

    private sealed class FakePlayerRepository : IPlayerRepository
    {
        private readonly List<Player> _players;
        public FakePlayerRepository(List<Player> players) => _players = players;

        public Task<Player?> GetByIdAsync(int id) => Task.FromResult(_players.FirstOrDefault(p => p.Id == id));
        public Task<Player?> GetByEmailAsync(string email) => throw new NotImplementedException();
        public Task<Player> CreateAsync(Player player) => throw new NotImplementedException();
        public Task UpdateAsync(Player player) => throw new NotImplementedException();
        public Task UpdateRangeAsync(IEnumerable<Player> players) => throw new NotImplementedException();
        public Task<List<Player>> GetByIdsAsync(IEnumerable<int> ids) => throw new NotImplementedException();
        public Task<List<Player>> GetAllAsync() => throw new NotImplementedException();
        public Task<List<Player>> GetLeaderboardAsync() => throw new NotImplementedException();
        public Task<List<EventRegistration>> GetPlayerEventRegistrationsAsync(int playerId) => throw new NotImplementedException();
    }

    private sealed class StubBadgeService : Api.Services.Interfaces.IBadgeService
    {
        public Task CheckAndAwardAsync(int playerId, Api.Services.Interfaces.BadgeTrigger trigger, int? eventId = null) => Task.CompletedTask;
        public Task<List<Api.DTOs.PlayerBadgeDto>> GetBadgesAsync(int playerId) => Task.FromResult(new List<Api.DTOs.PlayerBadgeDto>());
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    /// <summary>
    /// Builds a Game with the given results already linked so the navigation
    /// properties work correctly in-memory.
    /// </summary>
    private static Game MakeGame(int gameId, params (int PlayerId, string Name, int Finish)[] participants)
    {
        var game = new Game { Id = gameId };
        game.Results = participants.Select(p => new GameResult
        {
            GameId = gameId,
            Game = game,
            PlayerId = p.PlayerId,
            Player = new Player { Id = p.PlayerId, Name = p.Name },
            FinishPosition = p.Finish
        }).ToList();
        return game;
    }

    // ── Tests ─────────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetHeadToHeadAsync_TwoPlayersSharedPod_ReturnsCorrectWinsLosses()
    {
        // Alice (1) finished 1st, Bob (2) finished 2nd in one game → Alice wins
        var game = MakeGame(1, (1, "Alice", 1), (2, "Bob", 2), (3, "Charlie", 3), (4, "Dave", 4));
        var repo = new FakeGameRepository(game.Results.ToList());
        var playerRepo = new FakePlayerRepository([new Player { Id = 1, Name = "Alice" }]);
        var svc = new PlayerService(playerRepo, repo, new StubBadgeService());

        var result = await svc.GetHeadToHeadAsync(1);

        var bob = result!.First(e => e.OpponentId == 2);
        Assert.Equal(1, bob.Wins);
        Assert.Equal(0, bob.Losses);
        Assert.Equal(1, bob.Games);
    }

    [Fact]
    public async Task GetHeadToHeadAsync_MultipleGames_AccumulatesRecord()
    {
        // Game 1: Alice 1st, Bob 2nd → Alice wins
        var g1 = MakeGame(1, (1, "Alice", 1), (2, "Bob", 2));
        // Game 2: Alice 3rd, Bob 1st → Alice loses
        var g2 = MakeGame(2, (1, "Alice", 3), (2, "Bob", 1));

        var allResults = g1.Results.Concat(g2.Results).ToList();
        var repo = new FakeGameRepository(allResults);
        var playerRepo = new FakePlayerRepository([new Player { Id = 1, Name = "Alice" }]);
        var svc = new PlayerService(playerRepo, repo, new StubBadgeService());

        var result = await svc.GetHeadToHeadAsync(1);

        var bob = result!.First(e => e.OpponentId == 2);
        Assert.Equal(1, bob.Wins);
        Assert.Equal(1, bob.Losses);
        Assert.Equal(2, bob.Games);
    }

    [Fact]
    public async Task GetHeadToHeadAsync_NoSharedGames_ReturnsEmpty()
    {
        // Alice has never played against anyone
        var repo = new FakeGameRepository([]);
        var playerRepo = new FakePlayerRepository([new Player { Id = 1, Name = "Alice" }]);
        var svc = new PlayerService(playerRepo, repo, new StubBadgeService());

        var result = await svc.GetHeadToHeadAsync(1);

        Assert.Empty(result!);
    }

    [Fact]
    public async Task GetHeadToHeadAsync_MultipleOpponents_GroupedSeparately()
    {
        var game = MakeGame(1, (1, "Alice", 1), (2, "Bob", 2), (3, "Charlie", 3));
        var repo = new FakeGameRepository(game.Results.ToList());
        var playerRepo = new FakePlayerRepository([new Player { Id = 1, Name = "Alice" }]);
        var svc = new PlayerService(playerRepo, repo, new StubBadgeService());

        var result = await svc.GetHeadToHeadAsync(1);

        Assert.Equal(2, result!.Count);
        Assert.Contains(result, e => e.OpponentId == 2);
        Assert.Contains(result, e => e.OpponentId == 3);
    }

    [Fact]
    public async Task GetHeadToHeadAsync_PlayerNotFound_ReturnsNull()
    {
        var repo = new FakeGameRepository([]);
        var playerRepo = new FakePlayerRepository([]);
        var svc = new PlayerService(playerRepo, repo, new StubBadgeService());

        var result = await svc.GetHeadToHeadAsync(999);

        Assert.Null(result);
    }

    [Fact]
    public async Task GetHeadToHeadAsync_OrderedByGamesDescending()
    {
        // Charlie: 2 shared games, Bob: 1 shared game
        var g1 = MakeGame(1, (1, "Alice", 1), (2, "Bob", 2), (3, "Charlie", 3));
        var g2 = MakeGame(2, (1, "Alice", 2), (3, "Charlie", 1));
        var allResults = g1.Results.Concat(g2.Results).ToList();
        var repo = new FakeGameRepository(allResults);
        var playerRepo = new FakePlayerRepository([new Player { Id = 1, Name = "Alice" }]);
        var svc = new PlayerService(playerRepo, repo, new StubBadgeService());

        var result = await svc.GetHeadToHeadAsync(1);

        Assert.Equal(3, result![0].OpponentId); // Charlie first (2 games)
        Assert.Equal(2, result![1].OpponentId); // Bob second (1 game)
    }
}
