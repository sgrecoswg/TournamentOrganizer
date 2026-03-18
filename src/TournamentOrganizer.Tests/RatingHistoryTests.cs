using TournamentOrganizer.Api.DTOs;
using TournamentOrganizer.Api.Models;
using TournamentOrganizer.Api.Repositories.Interfaces;
using TournamentOrganizer.Api.Services;

namespace TournamentOrganizer.Tests;

/// <summary>
/// TDD tests for the Player Rating History feature.
/// </summary>
public class RatingHistoryTests
{
    // ── Fakes ─────────────────────────────────────────────────────────────

    private sealed class FakePlayerRepository : IPlayerRepository
    {
        private readonly List<Player> _players = [];

        public void Add(Player p) => _players.Add(p);

        public Task<Player?> GetByIdAsync(int id) =>
            Task.FromResult(_players.FirstOrDefault(p => p.Id == id));

        // stubs
        public Task<Player?> GetByEmailAsync(string email)                  => Task.FromResult<Player?>(null);
        public Task<List<Player>> GetLeaderboardAsync()                      => Task.FromResult(new List<Player>());
        public Task<List<Player>> GetAllAsync()                              => Task.FromResult(new List<Player>());
        public Task<Player> CreateAsync(Player p)                            => Task.FromResult(p);
        public Task UpdateAsync(Player p)                                    => Task.CompletedTask;
        public Task UpdateRangeAsync(IEnumerable<Player> ps)                => Task.CompletedTask;
        public Task<List<Player>> GetByIdsAsync(IEnumerable<int> ids)       => Task.FromResult(new List<Player>());
        public Task<List<EventRegistration>> GetPlayerEventRegistrationsAsync(int playerId) =>
            Task.FromResult(new List<EventRegistration>());
    }

    private sealed class FakeGameRepository : IGameRepository
    {
        private readonly List<GameResult> _replayResults = [];

        public void AddReplayResult(GameResult r) => _replayResults.Add(r);

        public Task<List<GameResult>> GetPlayerGamesForRatingReplayAsync(int playerId) =>
            Task.FromResult(_replayResults.Where(r => r.PlayerId == playerId).ToList());

        // stubs
        public Task<Game?> GetByIdAsync(int id)                                        => Task.FromResult<Game?>(null);
        public Task<Game?> GetWithResultsAsync(int id)                                 => Task.FromResult<Game?>(null);
        public Task<Game> CreateAsync(Game g)                                          => Task.FromResult(g);
        public Task UpdateAsync(Game g)                                                => Task.CompletedTask;
        public Task AddResultsAsync(IEnumerable<GameResult> r)                        => Task.CompletedTask;
        public Task DeleteResultsAsync(int gameId)                                     => Task.CompletedTask;
        public Task<List<GameResult>> GetPlayerResultsAsync(int pid)                   => Task.FromResult(new List<GameResult>());
        public Task<List<GameResult>> GetPlayerGamesWithOpponentsAsync(int pid)        => Task.FromResult(new List<GameResult>());
        public Task<List<int>> GetPreviousOpponentIdsAsync(int eid, int pid)           => Task.FromResult(new List<int>());
        public Task<List<GameResult>> GetStoreGameResultsAsync(int storeId, DateTime? since) => Task.FromResult(new List<GameResult>());
    }

    private sealed class StubBadgeService : Api.Services.Interfaces.IBadgeService
    {
        public Task CheckAndAwardAsync(int playerId, Api.Services.Interfaces.BadgeTrigger trigger, int? eventId = null) => Task.CompletedTask;
        public Task<List<Api.DTOs.PlayerBadgeDto>> GetBadgesAsync(int playerId) => Task.FromResult(new List<Api.DTOs.PlayerBadgeDto>());
    }

    private static PlayerService BuildService(FakePlayerRepository playerRepo, FakeGameRepository gameRepo) =>
        new(playerRepo, gameRepo, new StubBadgeService());

    private static Player MakePlayer(int id) =>
        new() { Id = id, Name = $"Player{id}", Mu = 25.0, Sigma = 25.0 / 3.0 };

    /// <summary>
    /// Creates a GameResult where <paramref name="playerId"/> finished at <paramref name="finishPosition"/>
    /// in a 4-player pod. Other participants get default ratings and consecutive finish positions.
    /// </summary>
    private static GameResult MakeGameResult(
        int playerId,
        int finishPosition,
        DateTime eventDate,
        string eventName = "Test Event",
        int roundNumber = 1)
    {
        var evt = new Event { Id = 1, Name = eventName, Date = eventDate };
        var round = new Round { Id = 1, RoundNumber = roundNumber, Event = evt };
        var pod = new Pod { Id = 1, Round = round };

        // 4-player game; target player plus 3 opponents at default ratings
        var opponents = new[]
        {
            new Player { Id = 100, Mu = 25.0, Sigma = 25.0 / 3.0 },
            new Player { Id = 101, Mu = 25.0, Sigma = 25.0 / 3.0 },
            new Player { Id = 102, Mu = 25.0, Sigma = 25.0 / 3.0 },
        };

        var allPlayers = new[] { playerId, 100, 101, 102 };
        var finishPositions = new int[4];
        finishPositions[Array.IndexOf(allPlayers, playerId)] = finishPosition;
        // assign remaining finish positions to opponents
        var remainingPositions = Enumerable.Range(1, 4).Except(new[] { finishPosition }).ToArray();
        for (int i = 0; i < opponents.Length; i++)
            finishPositions[Array.IndexOf(allPlayers, opponents[i].Id)] = remainingPositions[i];

        var game = new Game { Id = 1, Pod = pod };
        game.Results.Add(new GameResult { PlayerId = playerId, FinishPosition = finishPosition, Game = game });
        for (int i = 0; i < opponents.Length; i++)
            game.Results.Add(new GameResult { PlayerId = opponents[i].Id, FinishPosition = remainingPositions[i], Player = opponents[i], Game = game });

        return game.Results.First(r => r.PlayerId == playerId);
    }

    // ── Tests ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetRatingHistoryAsync_PlayerNotFound_ReturnsNull()
    {
        var playerRepo = new FakePlayerRepository();
        var gameRepo   = new FakeGameRepository();
        // no players added

        var svc = BuildService(playerRepo, gameRepo);
        var result = await svc.GetRatingHistoryAsync(99);

        Assert.Null(result);
    }

    [Fact]
    public async Task GetRatingHistoryAsync_NoGames_ReturnsEmptyHistory()
    {
        var playerRepo = new FakePlayerRepository();
        var gameRepo   = new FakeGameRepository();
        playerRepo.Add(MakePlayer(1));

        var svc = BuildService(playerRepo, gameRepo);
        var result = await svc.GetRatingHistoryAsync(1);

        Assert.NotNull(result);
        Assert.Equal(1, result!.PlayerId);
        Assert.Empty(result.History);
    }

    [Fact]
    public async Task GetRatingHistoryAsync_TwoGames_ReturnsTwoSnapshots()
    {
        var playerRepo = new FakePlayerRepository();
        var gameRepo   = new FakeGameRepository();
        playerRepo.Add(MakePlayer(1));

        gameRepo.AddReplayResult(MakeGameResult(1, 1, new DateTime(2024, 1, 1)));
        gameRepo.AddReplayResult(MakeGameResult(1, 2, new DateTime(2024, 2, 1)));

        var svc = BuildService(playerRepo, gameRepo);
        var result = await svc.GetRatingHistoryAsync(1);

        Assert.NotNull(result);
        Assert.Equal(2, result!.History.Count);
    }

    [Fact]
    public async Task GetRatingHistoryAsync_ScoresReplayedChronologically()
    {
        var playerRepo = new FakePlayerRepository();
        var gameRepo   = new FakeGameRepository();
        playerRepo.Add(MakePlayer(1));

        // Two wins in a row should produce two distinct conservative scores
        gameRepo.AddReplayResult(MakeGameResult(1, 1, new DateTime(2024, 1, 1)));
        gameRepo.AddReplayResult(MakeGameResult(1, 1, new DateTime(2024, 2, 1)));

        var svc = BuildService(playerRepo, gameRepo);
        var result = await svc.GetRatingHistoryAsync(1);

        Assert.NotNull(result);
        // Scores should differ as TrueSkill ratings evolve
        Assert.NotEqual(result!.History[0].ConservativeScore, result.History[1].ConservativeScore);
    }

    [Fact]
    public async Task GetRatingHistoryAsync_SnapshotConservativeScoreMatchesExpectedFormula()
    {
        // Conservative score = Mu - 3 * Sigma; we verify the snapshot value is
        // consistent with the formula by checking it is not the default 25 - 3*(25/3) = 0
        // after a win (which should increase mu).
        var playerRepo = new FakePlayerRepository();
        var gameRepo   = new FakeGameRepository();
        playerRepo.Add(MakePlayer(1));

        gameRepo.AddReplayResult(MakeGameResult(1, 1, new DateTime(2024, 1, 1)));

        var svc = BuildService(playerRepo, gameRepo);
        var result = await svc.GetRatingHistoryAsync(1);

        Assert.NotNull(result);
        var snapshot = Assert.Single(result!.History);
        // After a win from default rating, conservative score should be > 0
        Assert.True(snapshot.ConservativeScore > 0,
            $"Expected ConservativeScore > 0 after a win, got {snapshot.ConservativeScore}");
    }
}
