using System.Net;
using System.Net.Http.Json;
using TournamentOrganizer.Api.Models;
using TournamentOrganizer.Api.DTOs;
using TournamentOrganizer.Api.Repositories.Interfaces;
using TournamentOrganizer.Api.Services;
using TournamentOrganizer.Api.Services.Interfaces;

namespace TournamentOrganizer.Tests;

/// <summary>
/// Verifies that controller catch blocks return static safe messages rather than
/// raw ex.Message strings that could expose internal implementation details.
/// OWASP A05:2021 — Security Misconfiguration.
/// </summary>
public class ExceptionMessageLeakageTests(TournamentOrganizerFactory factory)
    : IClassFixture<TournamentOrganizerFactory>
{
    // ── Integration tests: controller catch blocks ────────────────────────────

    [Fact]
    public async Task EventsController_CheckInByToken_WhenTokenNotFound_ReturnsStaticNotFoundMessage()
    {
        // Arrange: any authenticated user, token that doesn't exist in empty DB
        var client = factory.ClientAs("Player", playerId: 99);

        // Act: CheckInByTokenAsync throws KeyNotFoundException("Check-in token not found.")
        var response = await client.PostAsync("/api/events/checkin/nonexistent-token-xyz-99", null);

        // Assert: 404 with static message, NOT the raw exception text
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.Equal("{\"error\":\"Resource not found.\"}", body);
    }

    [Fact]
    public async Task GamesController_SubmitResult_WhenGameNotFound_ReturnsBadRequestWithStaticMessage()
    {
        // Arrange: StoreEmployee JWT, game 99999 doesn't exist
        var client = factory.ClientAs("StoreEmployee", storeId: 1);
        var payload = new[] { new { playerId = 1, finishPosition = 1 } };

        // Act: SubmitGameResultAsync throws InvalidOperationException("Game not found.")
        var response = await client.PostAsJsonAsync("/api/games/99999/result", payload);

        // Assert: 400 with static message, NOT "Game not found."
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.Equal("{\"error\":\"Operation not permitted.\"}", body);
    }

    [Fact]
    public async Task PlayersController_Register_WhenEmailDuplicate_ReturnsConflictWithStaticMessage()
    {
        // Arrange: register a player, then register again with the same email
        var client = factory.ClientAs("Player", playerId: 1);
        var uniqueEmail = $"leak-test-{Guid.NewGuid()}@example.com";

        var firstResponse = await client.PostAsJsonAsync("/api/players",
            new { name = "LeakTest Player", email = uniqueEmail });
        Assert.Equal(HttpStatusCode.Created, firstResponse.StatusCode);

        // Act: second registration throws InvalidOperationException("A player with this email already exists.")
        var response = await client.PostAsJsonAsync("/api/players",
            new { name = "LeakTest Player 2", email = uniqueEmail });

        // Assert: 409 with static message, NOT "A player with this email already exists."
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.Equal("{\"error\":\"Operation not permitted.\"}", body);
    }

    // ── Unit test: EventService.BulkRegisterConfirmAsync error message ────────

    [Fact]
    public async Task BulkRegisterConfirmAsync_WhenRegistrationFails_ErrorContainsStaticMessage()
    {
        // Arrange: event doesn't exist → RegisterPlayerAsync throws KeyNotFoundException
        var eventRepo = new StubEmptyEventRepository();
        var playerRepo = new StubPlayerRepositoryWithPlayer(playerId: 50, email: "bulk-leak@example.com");
        var svc = BuildEventService(eventRepo, playerRepo);

        var dto = new BulkRegisterConfirmDto([
            new BulkRegisterConfirmItemDto(50, "bulk-leak@example.com", null)
        ]);

        // Act: event 999 doesn't exist → RegisterPlayerAsync throws → error added
        var result = await svc.BulkRegisterConfirmAsync(999, dto);

        // Assert: error message is static, NOT the raw KeyNotFoundException message
        Assert.Single(result.Errors);
        Assert.Equal("Registration failed.", result.Errors[0].Reason);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static EventService BuildEventService(IEventRepository eventRepo, IPlayerRepository playerRepo) =>
        new(eventRepo, playerRepo,
            new StubGameRepo2(), new StubPodService2(), new StubTrueSkillService2(),
            new StubStoreEventRepo2(), new StubDiscordWebhookService2(),
            new StubBadgeService2(), new StubLicenseTierService2());

    private sealed class StubEmptyEventRepository : IEventRepository
    {
        public Task<TournamentOrganizer.Api.Models.Event?> GetByIdAsync(int id) => Task.FromResult<TournamentOrganizer.Api.Models.Event?>(null);
        public Task<EventRegistration?> GetRegistrationAsync(int eid, int pid) => Task.FromResult<EventRegistration?>(null);
        public Task<bool> IsPlayerRegisteredAsync(int eventId, int playerId) => Task.FromResult(false);
        public Task<EventRegistration> RegisterPlayerAsync(EventRegistration r) => Task.FromResult(r);
        public Task<List<EventRegistration>> GetRegistrationsWithPlayersAsync(int eventId) => Task.FromResult(new List<EventRegistration>());
        public Task UpdateRegistrationAsync(EventRegistration r) => Task.CompletedTask;
        public Task<TournamentOrganizer.Api.Models.Event?> GetByCheckInTokenAsync(string token) => Task.FromResult<TournamentOrganizer.Api.Models.Event?>(null);
        public Task<Round?> GetLatestRoundAsync(int eventId) => Task.FromResult<Round?>(null);
        public Task<List<Player>> GetRegisteredPlayersAsync(int eventId) => Task.FromResult(new List<Player>());
        public Task<TournamentOrganizer.Api.Models.Event?> GetWithDetailsAsync(int id) => Task.FromResult<TournamentOrganizer.Api.Models.Event?>(null);
        public Task<List<TournamentOrganizer.Api.Models.Event>> GetAllAsync() => Task.FromResult(new List<TournamentOrganizer.Api.Models.Event>());
        public Task<List<TournamentOrganizer.Api.Models.Event>> GetAllWithStoreAsync(int? storeId = null) => Task.FromResult(new List<TournamentOrganizer.Api.Models.Event>());
        public Task<TournamentOrganizer.Api.Models.Event> CreateAsync(TournamentOrganizer.Api.Models.Event evt) => Task.FromResult(evt);
        public Task UpdateAsync(TournamentOrganizer.Api.Models.Event evt) => Task.CompletedTask;
        public Task<Round> CreateRoundAsync(Round round) => Task.FromResult(round);
        public Task<Round?> GetLatestRoundWithPairingsAsync(int eventId) => Task.FromResult<Round?>(null);
        public Task<Round?> GetRoundWithDetailsAsync(int roundId) => Task.FromResult<Round?>(null);
        public Task<List<Round>> GetRoundsForEventAsync(int eventId) => Task.FromResult(new List<Round>());
        public Task RemoveRegistrationAsync(EventRegistration r) => Task.CompletedTask;
    }

    private sealed class StubPlayerRepositoryWithPlayer(int playerId, string email) : IPlayerRepository
    {
        private readonly Player _player = new() { Id = playerId, Name = "Bulk Test", Email = email, Mu = 25, Sigma = 8.333 };

        public Task<Player?> GetByIdAsync(int id) => Task.FromResult<Player?>(id == playerId ? _player : null);
        public Task<Player?> GetByEmailAsync(string e) => Task.FromResult<Player?>(string.Equals(e, email, StringComparison.OrdinalIgnoreCase) ? _player : null);
        public Task<Player> CreateAsync(Player p) => Task.FromResult(p);
        public Task UpdateAsync(Player p) => Task.CompletedTask;
        public Task UpdateRangeAsync(IEnumerable<Player> ps) => Task.CompletedTask;
        public Task<List<Player>> GetLeaderboardAsync() => Task.FromResult(new List<Player>());
        public Task<List<Player>> GetAllAsync() => Task.FromResult(new List<Player>());
        public Task<List<Player>> GetByIdsAsync(IEnumerable<int> ids) => Task.FromResult(new List<Player>());
        public Task<List<EventRegistration>> GetPlayerEventRegistrationsAsync(int pid) => Task.FromResult(new List<EventRegistration>());
    }

    private sealed class StubGameRepo2 : IGameRepository
    {
        public Task<Game?> GetByIdAsync(int id) => Task.FromResult<Game?>(null);
        public Task<Game?> GetWithResultsAsync(int id) => Task.FromResult<Game?>(null);
        public Task<Game> CreateAsync(Game g) => Task.FromResult(g);
        public Task UpdateAsync(Game g) => Task.CompletedTask;
        public Task AddResultsAsync(IEnumerable<GameResult> r) => Task.CompletedTask;
        public Task DeleteResultsAsync(int gameId) => Task.CompletedTask;
        public Task<List<GameResult>> GetPlayerResultsAsync(int pid) => Task.FromResult(new List<GameResult>());
        public Task<List<GameResult>> GetPlayerGamesWithOpponentsAsync(int pid) => Task.FromResult(new List<GameResult>());
        public Task<List<int>> GetPreviousOpponentIdsAsync(int eid, int pid) => Task.FromResult(new List<int>());
        public Task<List<GameResult>> GetStoreGameResultsAsync(int storeId, DateTime? since) => Task.FromResult(new List<GameResult>());
        public Task<List<GameResult>> GetPlayerGamesForRatingReplayAsync(int pid) => Task.FromResult(new List<GameResult>());
    }

    private sealed class StubPodService2 : IPodService
    {
        public List<List<Player>> GenerateRound1Pods(List<Player> players) => [players];
        public List<List<Player>> GenerateNextRoundPods(Round previousRound, List<Player> activePlayers) => [activePlayers];
    }

    private sealed class StubTrueSkillService2 : ITrueSkillService
    {
        public Task UpdateRatingsAsync(Game game) => Task.CompletedTask;
        public Task UpdateRatingsFromEventStandingsAsync(List<(int PlayerId, int Rank, int GamesPlayed)> rankings) => Task.CompletedTask;
    }

    private sealed class StubStoreEventRepo2 : IStoreEventRepository
    {
        public Task AddAsync(StoreEvent se) => Task.CompletedTask;
        public Task<int?> GetStoreIdForEventAsync(int eventId) => Task.FromResult<int?>(null);
        public Task<(int? StoreId, string? StoreName, string? StoreBackgroundImageUrl)> GetStoreInfoForEventAsync(int eventId) => Task.FromResult<(int?, string?, string?)>((null, null, null));
        public Task<List<StoreEvent>> GetByStoreIdAsync(int storeId) => Task.FromResult(new List<StoreEvent>());
    }

    private sealed class StubDiscordWebhookService2 : IDiscordWebhookService
    {
        public Task PostRoundResultsAsync(int eventId, int roundNumber) => Task.CompletedTask;
        public Task PostEventCompletedAsync(int eventId) => Task.CompletedTask;
        public Task PostPlayerRankedAsync(int playerId, int eventId) => Task.CompletedTask;
        public Task PostTestMessageAsync(int storeId) => Task.CompletedTask;
    }

    private sealed class StubBadgeService2 : IBadgeService
    {
        public Task CheckAndAwardAsync(int playerId, BadgeTrigger trigger, int? eventId = null) => Task.CompletedTask;
        public Task<List<PlayerBadgeDto>> GetBadgesAsync(int playerId) => Task.FromResult(new List<PlayerBadgeDto>());
    }

    private sealed class StubStoreEventRepo2b : IStoreEventRepository
    {
        public Task AddAsync(StoreEvent se) => Task.CompletedTask;
        public Task<int?> GetStoreIdForEventAsync(int eventId) => Task.FromResult<int?>(null);
        public Task<(int? StoreId, string? StoreName, string? StoreBackgroundImageUrl)> GetStoreInfoForEventAsync(int eventId) => Task.FromResult<(int?, string?, string?)>((null, null, null));
        public Task<List<StoreEvent>> GetByStoreIdAsync(int storeId) => Task.FromResult(new List<StoreEvent>());
    }

    private sealed class StubLicenseTierService2 : ILicenseTierService
    {
        public Task<TournamentOrganizer.Api.Models.LicenseTier> GetEffectiveTierAsync(int storeId) =>
            Task.FromResult(TournamentOrganizer.Api.Models.LicenseTier.Tier1);
        public Task<(bool IsInTrial, DateTime? TrialExpiresDate)> GetTrialStatusAsync(int storeId) =>
            Task.FromResult((false, (DateTime?)null));
        public Task<(bool IsInGracePeriod, DateTime? GracePeriodEndsDate)> GetGracePeriodStatusAsync(int storeId) =>
            Task.FromResult((false, (DateTime?)null));
    }
}
