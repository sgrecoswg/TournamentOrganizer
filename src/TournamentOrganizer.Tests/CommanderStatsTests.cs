using TournamentOrganizer.Api.DTOs;
using TournamentOrganizer.Api.Models;
using TournamentOrganizer.Api.Repositories.Interfaces;
using TournamentOrganizer.Api.Services;

namespace TournamentOrganizer.Tests;

/// <summary>
/// TDD tests for the Commander Statistics feature.
/// </summary>
public class CommanderStatsTests
{
    // ── Fakes ─────────────────────────────────────────────────────────────

    private sealed class FakePlayerRepository : IPlayerRepository
    {
        private readonly List<Player> _players = [];
        private readonly List<EventRegistration> _registrations = [];

        public void Add(Player p) => _players.Add(p);
        public void AddRegistration(EventRegistration r) => _registrations.Add(r);

        public Task<Player?> GetByIdAsync(int id) =>
            Task.FromResult(_players.FirstOrDefault(p => p.Id == id));
        public Task<List<EventRegistration>> GetPlayerEventRegistrationsAsync(int playerId) =>
            Task.FromResult(_registrations.Where(r => r.PlayerId == playerId).ToList());

        // stubs
        public Task<Player?> GetByEmailAsync(string email)                  => Task.FromResult<Player?>(null);
        public Task<List<Player>> GetLeaderboardAsync()                      => Task.FromResult(new List<Player>());
        public Task<List<Player>> GetAllAsync()                              => Task.FromResult(new List<Player>());
        public Task<Player> CreateAsync(Player p)                            => Task.FromResult(p);
        public Task UpdateAsync(Player p)                                    => Task.CompletedTask;
        public Task UpdateRangeAsync(IEnumerable<Player> ps)                => Task.CompletedTask;
        public Task<List<Player>> GetByIdsAsync(IEnumerable<int> ids)       => Task.FromResult(new List<Player>());
    }

    private sealed class FakeGameRepository : IGameRepository
    {
        private readonly List<GameResult> _results = [];

        public void AddResult(GameResult r) => _results.Add(r);

        public Task<List<GameResult>> GetPlayerResultsAsync(int playerId) =>
            Task.FromResult(_results.Where(r => r.PlayerId == playerId).ToList());

        // stubs
        public Task<Game?> GetByIdAsync(int id)                                        => Task.FromResult<Game?>(null);
        public Task<Game?> GetWithResultsAsync(int id)                                 => Task.FromResult<Game?>(null);
        public Task<Game> CreateAsync(Game g)                                          => Task.FromResult(g);
        public Task UpdateAsync(Game g)                                                => Task.CompletedTask;
        public Task AddResultsAsync(IEnumerable<GameResult> r)                        => Task.CompletedTask;
        public Task DeleteResultsAsync(int gameId)                                     => Task.CompletedTask;
        public Task<List<GameResult>> GetPlayerGamesWithOpponentsAsync(int pid)        => Task.FromResult(new List<GameResult>());
        public Task<List<int>> GetPreviousOpponentIdsAsync(int eid, int pid) => Task.FromResult(new List<int>());
        public Task<List<GameResult>> GetStoreGameResultsAsync(int storeId, DateTime? since) => Task.FromResult(new List<GameResult>());
        public Task<List<GameResult>> GetPlayerGamesForRatingReplayAsync(int pid) => Task.FromResult(new List<GameResult>());
    }

    private sealed class StubBadgeService : Api.Services.Interfaces.IBadgeService
    {
        public Task CheckAndAwardAsync(int playerId, Api.Services.Interfaces.BadgeTrigger trigger, int? eventId = null) => Task.CompletedTask;
        public Task<List<Api.DTOs.PlayerBadgeDto>> GetBadgesAsync(int playerId) => Task.FromResult(new List<Api.DTOs.PlayerBadgeDto>());
    }

    private static PlayerService BuildService(FakePlayerRepository playerRepo, FakeGameRepository gameRepo) =>
        new(playerRepo, gameRepo, new StubBadgeService());

    private static Player MakePlayer(int id) =>
        new() { Id = id, Name = $"Player{id}", Mu = 25, Sigma = 8.333 };

    private static GameResult MakeResult(int playerId, int finishPosition, string? commanderPlayed = null) =>
        new()
        {
            PlayerId = playerId,
            FinishPosition = finishPosition,
            CommanderPlayed = commanderPlayed,
            Game = new Game { Pod = new Pod { Round = new Round { EventId = 1 } } }
        };

    // ── Tests ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetCommanderStatsAsync_MultipleCommanders_ReturnsGroupedStats()
    {
        var playerRepo = new FakePlayerRepository();
        var gameRepo   = new FakeGameRepository();
        playerRepo.Add(MakePlayer(1));

        gameRepo.AddResult(MakeResult(1, 1, "Atraxa")); // win
        gameRepo.AddResult(MakeResult(1, 2, "Atraxa")); // 2nd
        gameRepo.AddResult(MakeResult(1, 3, "Omnath")); // 3rd

        var svc = BuildService(playerRepo, gameRepo);
        var result = await svc.GetCommanderStatsAsync(1);

        Assert.NotNull(result);
        Assert.Equal(2, result!.Commanders.Count);

        var atraxa = result.Commanders.Single(c => c.CommanderName == "Atraxa");
        Assert.Equal(2, atraxa.GamesPlayed);
        Assert.Equal(1, atraxa.Wins);

        var omnath = result.Commanders.Single(c => c.CommanderName == "Omnath");
        Assert.Equal(1, omnath.GamesPlayed);
        Assert.Equal(0, omnath.Wins);
    }

    [Fact]
    public async Task GetCommanderStatsAsync_SingleCommander_ComputesWinRateCorrectly()
    {
        var playerRepo = new FakePlayerRepository();
        var gameRepo   = new FakeGameRepository();
        playerRepo.Add(MakePlayer(1));

        gameRepo.AddResult(MakeResult(1, 1, "Atraxa")); // win
        gameRepo.AddResult(MakeResult(1, 1, "Atraxa")); // win
        gameRepo.AddResult(MakeResult(1, 3, "Atraxa")); // 3rd

        var svc = BuildService(playerRepo, gameRepo);
        var result = await svc.GetCommanderStatsAsync(1);

        Assert.NotNull(result);
        var stat = Assert.Single(result!.Commanders);
        Assert.Equal(3, stat.GamesPlayed);
        Assert.Equal(2, stat.Wins);
    }

    [Fact]
    public async Task GetCommanderStatsAsync_NoCommanderPlayed_ReturnsEmptyList()
    {
        var playerRepo = new FakePlayerRepository();
        var gameRepo   = new FakeGameRepository();
        playerRepo.Add(MakePlayer(1));      

        var svc = BuildService(playerRepo, gameRepo);
        var result = await svc.GetCommanderStatsAsync(1);

        Assert.NotNull(result);
        Assert.Empty(result!.Commanders);
    }

    [Fact]
    public async Task GetCommanderStatsAsync_PlayerNotFound_ReturnsNull()
    {
        var playerRepo = new FakePlayerRepository();
        var gameRepo   = new FakeGameRepository();
        // no players added

        var svc = BuildService(playerRepo, gameRepo);
        var result = await svc.GetCommanderStatsAsync(99);

        Assert.Null(result);
    }

    [Fact]
    public async Task GetCommanderStatsAsync_AvgFinish_ComputedCorrectly()
    {
        var playerRepo = new FakePlayerRepository();
        var gameRepo   = new FakeGameRepository();
        playerRepo.Add(MakePlayer(1));

        gameRepo.AddResult(MakeResult(1, 1, "Atraxa")); // finish 1
        gameRepo.AddResult(MakeResult(1, 3, "Atraxa")); // finish 3
        // avg = 2.0

        var svc = BuildService(playerRepo, gameRepo);
        var result = await svc.GetCommanderStatsAsync(1);

        Assert.NotNull(result);
        var stat = Assert.Single(result!.Commanders);
        Assert.Equal(2.0, stat.AvgFinish, precision: 5);
    }
}
