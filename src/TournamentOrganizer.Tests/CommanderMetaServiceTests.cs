using TournamentOrganizer.Api.DTOs;
using TournamentOrganizer.Api.Models;
using TournamentOrganizer.Api.Repositories.Interfaces;
using TournamentOrganizer.Api.Services;

namespace TournamentOrganizer.Tests;

public class CommanderMetaServiceTests
{
    // ── Fake ──────────────────────────────────────────────────────────────

    private sealed class FakeGameRepository : IGameRepository
    {
        public List<GameResult> Results { get; set; } = [];
        public DateTime? LastSince { get; private set; } = DateTime.MinValue; // sentinel

        public Task<List<GameResult>> GetStoreGameResultsAsync(int storeId, DateTime? since)
        {
            LastSince = since;
            return Task.FromResult(Results);
        }

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
    }

    private static GameResult MakeResult(string? commanderPlayed, int storeId, int finishPosition) =>
        new() { CommanderPlayed = commanderPlayed, FinishPosition = finishPosition };

    // ── Tests ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetStoreMetaAsync_30d_PassesCorrectCutoffToRepo()
    {
        var repo = new FakeGameRepository();
        var svc = new CommanderMetaService(repo);

        await svc.GetStoreMetaAsync(1, "30d");

        Assert.NotNull(repo.LastSince);
        var expected = DateTime.UtcNow.AddDays(-30);
        Assert.True(repo.LastSince >= expected.AddSeconds(-5) && repo.LastSince <= expected.AddSeconds(5));
    }

    [Fact]
    public async Task GetStoreMetaAsync_90d_PassesCorrectCutoffToRepo()
    {
        var repo = new FakeGameRepository();
        var svc = new CommanderMetaService(repo);

        await svc.GetStoreMetaAsync(1, "90d");

        Assert.NotNull(repo.LastSince);
        var expected = DateTime.UtcNow.AddDays(-90);
        Assert.True(repo.LastSince >= expected.AddSeconds(-5) && repo.LastSince <= expected.AddSeconds(5));
    }

    [Fact]
    public async Task GetStoreMetaAsync_AllTime_PassesNullSinceToRepo()
    {
        var repo = new FakeGameRepository();
        var svc = new CommanderMetaService(repo);

        await svc.GetStoreMetaAsync(1, "all");

        Assert.Null(repo.LastSince);
    }

    [Fact]
    public async Task GetStoreMetaAsync_GroupsCorrectlyByCommanderName()
    {
        var repo = new FakeGameRepository();
        repo.Results = [
            MakeResult("Atraxa", 1, 1),
            MakeResult("Atraxa", 1, 2),
            MakeResult("Omnath", 1, 3),
        ];
        var svc = new CommanderMetaService(repo);

        var report = await svc.GetStoreMetaAsync(1, "all");

        Assert.Equal(2, report.TopCommanders.Count);
        var atraxa = report.TopCommanders.Single(c => c.CommanderName == "Atraxa");
        Assert.Equal(2, atraxa.TimesPlayed);
        var omnath = report.TopCommanders.Single(c => c.CommanderName == "Omnath");
        Assert.Equal(1, omnath.TimesPlayed);
    }

    [Fact]
    public async Task GetStoreMetaAsync_WinRateComputedCorrectly()
    {
        // 3 wins out of 5 games = 60%
        var repo = new FakeGameRepository();
        repo.Results = [
            MakeResult("Atraxa", 1, 1),
            MakeResult("Atraxa", 1, 1),
            MakeResult("Atraxa", 1, 1),
            MakeResult("Atraxa", 1, 2),
            MakeResult("Atraxa", 1, 3),
        ];
        var svc = new CommanderMetaService(repo);

        var report = await svc.GetStoreMetaAsync(1, "all");

        var atraxa = report.TopCommanders.Single();
        Assert.Equal(60.0, atraxa.WinRate, precision: 5);
    }

    [Fact]
    public async Task GetStoreMetaAsync_NoCommanderPlayed_ReturnsEmptyList()
    {
        var repo = new FakeGameRepository();
        repo.Results = [MakeResult(null, 1, 2)];
        var svc = new CommanderMetaService(repo);

        var report = await svc.GetStoreMetaAsync(1, "all");

        Assert.Empty(report.TopCommanders);
    }

    [Fact]
    public async Task GetStoreMetaAsync_LimitedToTop20()
    {
        var repo = new FakeGameRepository();
        repo.Results = Enumerable.Range(1, 25)
            .Select(i => MakeResult($"Commander{i}", 1, 2))
            .ToList();
        var svc = new CommanderMetaService(repo);

        var report = await svc.GetStoreMetaAsync(1, "all");

        Assert.Equal(20, report.TopCommanders.Count);
    }
}
