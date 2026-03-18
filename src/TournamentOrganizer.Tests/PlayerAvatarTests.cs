using TournamentOrganizer.Api.DTOs;
using TournamentOrganizer.Api.Models;
using TournamentOrganizer.Api.Repositories.Interfaces;
using TournamentOrganizer.Api.Services;

namespace TournamentOrganizer.Tests;

/// <summary>
/// TDD tests for avatar-related PlayerService methods.
/// Written BEFORE implementation.
/// </summary>
public class PlayerAvatarTests
{
    // ── Fake IPlayerRepository ──────────────────────────────────────────────

    private sealed class FakePlayerRepository : IPlayerRepository
    {
        private readonly List<Player> _players;

        public Player? LastUpdated { get; private set; }

        public FakePlayerRepository(params Player[] players)
            => _players = players.ToList();

        public Task<Player?> GetByIdAsync(int id)
            => Task.FromResult(_players.FirstOrDefault(p => p.Id == id));

        public Task<Player?> GetByEmailAsync(string email)
            => Task.FromResult(_players.FirstOrDefault(p => p.Email == email));

        public Task<List<Player>> GetLeaderboardAsync() => Task.FromResult(_players);
        public Task<List<Player>> GetAllAsync() => Task.FromResult(_players);

        public Task<Player> CreateAsync(Player player)
        {
            _players.Add(player);
            return Task.FromResult(player);
        }

        public Task UpdateAsync(Player player)
        {
            LastUpdated = player;
            return Task.CompletedTask;
        }

        public Task UpdateRangeAsync(IEnumerable<Player> players) => Task.CompletedTask;

        public Task<List<Player>> GetByIdsAsync(IEnumerable<int> ids)
            => Task.FromResult(_players.Where(p => ids.Contains(p.Id)).ToList());

        public Task<List<EventRegistration>> GetPlayerEventRegistrationsAsync(int playerId)
        {
            var player = _players.FirstOrDefault(p => p.Id == playerId);
            return Task.FromResult(player?.EventRegistrations.ToList() ?? new List<EventRegistration>());
        }

        public Task<bool> IsPlayerAtStoreAsync(int playerId, int storeId)
        {
            var player = _players.FirstOrDefault(p => p.Id == playerId);
            if (player == null) return Task.FromResult(false);
            return Task.FromResult(
                player.EventRegistrations.Any(er =>
                    er.Event?.StoreEvent?.StoreId == storeId));
        }
    }

    // ── Fake IGameRepository (no-op) ─────────────────────────────────────

    private sealed class FakeGameRepository : IGameRepository
    {
        public Task<Game?> GetByIdAsync(int id) => Task.FromResult<Game?>(null);
        public Task<Game?> GetWithResultsAsync(int id) => Task.FromResult<Game?>(null);
        public Task<Game> CreateAsync(Game game) => Task.FromResult(game);
        public Task UpdateAsync(Game game) => Task.CompletedTask;
        public Task AddResultsAsync(IEnumerable<GameResult> results) => Task.CompletedTask;
        public Task DeleteResultsAsync(int gameId) => Task.CompletedTask;
        public Task<List<GameResult>> GetPlayerResultsAsync(int playerId) => Task.FromResult(new List<GameResult>());
        public Task<List<GameResult>> GetPlayerGamesWithOpponentsAsync(int playerId) => Task.FromResult(new List<GameResult>());
        public Task<List<int>> GetPreviousOpponentIdsAsync(int eventId, int playerId) => Task.FromResult(new List<int>());
        public Task<List<GameResult>> GetStoreGameResultsAsync(int storeId, DateTime? since) => Task.FromResult(new List<GameResult>());
        public Task<List<GameResult>> GetPlayerGamesForRatingReplayAsync(int pid) => Task.FromResult(new List<GameResult>());
    }

    private sealed class StubBadgeService : Api.Services.Interfaces.IBadgeService
    {
        public Task CheckAndAwardAsync(int playerId, Api.Services.Interfaces.BadgeTrigger trigger, int? eventId = null) => Task.CompletedTask;
        public Task<List<Api.DTOs.PlayerBadgeDto>> GetBadgesAsync(int playerId) => Task.FromResult(new List<Api.DTOs.PlayerBadgeDto>());
    }

    private static PlayerService BuildService(params Player[] players)
        => new PlayerService(new FakePlayerRepository(players), new FakeGameRepository(), new StubBadgeService());

    // ── UpdateAvatarUrlAsync ─────────────────────────────────────────────

    [Fact]
    public async Task UpdateAvatarUrlAsync_SetsUrl_ReturnsUpdatedDto()
    {
        var player = new Player { Id = 1, Name = "Alice", Email = "alice@test.com" };
        var svc = BuildService(player);

        var dto = await svc.UpdateAvatarUrlAsync(1, "/avatars/1.png");

        Assert.Equal("/avatars/1.png", dto.AvatarUrl);
        Assert.Equal(1, dto.Id);
    }

    [Fact]
    public async Task UpdateAvatarUrlAsync_SetNull_ClearsUrl()
    {
        var player = new Player { Id = 2, Name = "Bob", Email = "bob@test.com", AvatarUrl = "/avatars/2.png" };
        var svc = BuildService(player);

        var dto = await svc.UpdateAvatarUrlAsync(2, null);

        Assert.Null(dto.AvatarUrl);
    }

    [Fact]
    public async Task UpdateAvatarUrlAsync_PlayerNotFound_ThrowsKeyNotFoundException()
    {
        var svc = BuildService(); // empty

        await Assert.ThrowsAsync<KeyNotFoundException>(() => svc.UpdateAvatarUrlAsync(99, "/avatars/99.png"));
    }

    // ── IsPlayerEmailAsync ───────────────────────────────────────────────

    [Fact]
    public async Task IsPlayerEmailAsync_MatchingEmail_ReturnsTrue()
    {
        var player = new Player { Id = 1, Name = "Alice", Email = "alice@test.com" };
        var svc = BuildService(player);

        var result = await svc.IsPlayerEmailAsync(1, "alice@test.com");

        Assert.True(result);
    }

    [Fact]
    public async Task IsPlayerEmailAsync_WrongEmail_ReturnsFalse()
    {
        var player = new Player { Id = 1, Name = "Alice", Email = "alice@test.com" };
        var svc = BuildService(player);

        var result = await svc.IsPlayerEmailAsync(1, "other@test.com");

        Assert.False(result);
    }

    // ── IsPlayerAtStoreAsync ─────────────────────────────────────────────

    [Fact]
    public async Task IsPlayerAtStoreAsync_PlayerRegisteredAtStore_ReturnsTrue()
    {
        var storeEvent = new StoreEvent { StoreId = 5 };
        var ev = new Event { Id = 10, Name = "Test", Date = DateTime.UtcNow, StoreEvent = storeEvent };
        var registration = new EventRegistration { PlayerId = 1, EventId = 10, Event = ev };
        var player = new Player { Id = 1, Name = "Alice", Email = "alice@test.com" };
        player.EventRegistrations.Add(registration);

        var svc = BuildService(player);

        var result = await svc.IsPlayerAtStoreAsync(1, 5);

        Assert.True(result);
    }

    [Fact]
    public async Task IsPlayerAtStoreAsync_PlayerNotAtStore_ReturnsFalse()
    {
        var storeEvent = new StoreEvent { StoreId = 5 };
        var ev = new Event { Id = 10, Name = "Test", Date = DateTime.UtcNow, StoreEvent = storeEvent };
        var registration = new EventRegistration { PlayerId = 1, EventId = 10, Event = ev };
        var player = new Player { Id = 1, Name = "Alice", Email = "alice@test.com" };
        player.EventRegistrations.Add(registration);

        var svc = BuildService(player);

        var result = await svc.IsPlayerAtStoreAsync(1, 99); // different store

        Assert.False(result);
    }
}
