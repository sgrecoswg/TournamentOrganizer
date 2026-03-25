using System.Security.Claims;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using TournamentOrganizer.Api.Controllers;
using TournamentOrganizer.Api.DTOs;
using TournamentOrganizer.Api.Models;
using TournamentOrganizer.Api.Repositories.Interfaces;
using TournamentOrganizer.Api.Services;
using TournamentOrganizer.Api.Services.Interfaces;

namespace TournamentOrganizer.Tests;

/// <summary>
/// TDD tests for the per-event background image feature.
/// Written BEFORE implementation — they fail to compile until
/// BackgroundImageUrl is added to Event, EventDto, and PairingsDto, and
/// UpdateBackgroundImageUrlAsync is added to IEventService / EventService.
/// </summary>
public class EventBackgroundTests
{
    // ── Fakes ─────────────────────────────────────────────────────────────

    private sealed class FakeEventRepo : IEventRepository
    {
        public List<Event> Events { get; } = [];
        public List<EventRegistration> Registrations { get; } = [];
        public List<Round> Rounds { get; } = [];

        public Task<Event?> GetByIdAsync(int id) =>
            Task.FromResult(Events.FirstOrDefault(e => e.Id == id));

        public Task<Event> CreateAsync(Event evt)
        {
            evt.Id = Events.Count + 1;
            Events.Add(evt);
            return Task.FromResult(evt);
        }

        public Task UpdateAsync(Event evt) => Task.CompletedTask;
        public Task<bool> IsPlayerRegisteredAsync(int eid, int pid) => Task.FromResult(false);
        public Task<EventRegistration?> GetRegistrationAsync(int eid, int pid) => Task.FromResult<EventRegistration?>(null);
        public Task<List<EventRegistration>> GetRegistrationsWithPlayersAsync(int eid) => Task.FromResult(new List<EventRegistration>());
        public Task<EventRegistration> RegisterPlayerAsync(EventRegistration r) { Registrations.Add(r); return Task.FromResult(r); }
        public Task UpdateRegistrationAsync(EventRegistration r) => Task.CompletedTask;
        public Task<List<Event>> GetAllAsync() => Task.FromResult(Events.ToList());
        public Task<List<Event>> GetAllWithStoreAsync(int? storeId = null) => Task.FromResult(Events.ToList());
        public Task<Event?> GetWithDetailsAsync(int id) => Task.FromResult(Events.FirstOrDefault(e => e.Id == id));
        public Task<Round> CreateRoundAsync(Round r) => throw new NotImplementedException();
        public Task<Round?> GetLatestRoundWithPairingsAsync(int eid) =>
            Task.FromResult(Rounds.LastOrDefault(r => r.EventId == eid));
        public Task<Round?> GetLatestRoundAsync(int eid) => Task.FromResult<Round?>(null);
        public Task<Round?> GetRoundWithDetailsAsync(int rid) => Task.FromResult<Round?>(null);
        public Task<List<Round>> GetRoundsForEventAsync(int eid) => Task.FromResult(new List<Round>());
        public Task RemoveRegistrationAsync(EventRegistration r) => Task.CompletedTask;
        public Task<Event?> GetByCheckInTokenAsync(string token) => Task.FromResult<Event?>(null);
        public Task<List<Player>> GetRegisteredPlayersAsync(int eid) => Task.FromResult(new List<Player>());
    }

    private sealed class FakeStoreEventRepo : IStoreEventRepository
    {
        private readonly int? _storeId;
        private readonly string? _storeName;
        public string? StoreBackground { get; set; }

        public FakeStoreEventRepo(int? storeId = 1, string? storeName = null, string? storeBackground = null)
        {
            _storeId = storeId;
            _storeName = storeName;
            StoreBackground = storeBackground;
        }

        public Task AddAsync(StoreEvent se) => Task.CompletedTask;
        public Task<int?> GetStoreIdForEventAsync(int eventId) => Task.FromResult(_storeId);
        public Task<(int? StoreId, string? StoreName, string? StoreBackgroundImageUrl)> GetStoreInfoForEventAsync(int eventId) =>
            Task.FromResult((_storeId, _storeName, StoreBackground));
        public Task<List<StoreEvent>> GetByStoreIdAsync(int storeId) => Task.FromResult(new List<StoreEvent>());
    }

    private sealed class FakeLicenseTierService : ILicenseTierService
    {
        public Task<LicenseTier> GetEffectiveTierAsync(int storeId) => Task.FromResult(LicenseTier.Free);
        public Task<(bool IsInTrial, DateTime? TrialExpiresDate)> GetTrialStatusAsync(int storeId) => Task.FromResult((false, (DateTime?)null));
        public Task<(bool IsInGracePeriod, DateTime? GracePeriodEndsDate)> GetGracePeriodStatusAsync(int storeId) => Task.FromResult((false, (DateTime?)null));
    }

    private static EventService MakeService(
        FakeEventRepo? eventRepo = null,
        FakeStoreEventRepo? storeEventRepo = null)
    {
        return new EventService(
            eventRepo ?? new FakeEventRepo(),
            new StubPlayerRepo(),
            new StubGameRepo(),
            new StubPodService(),
            new StubTrueSkillService(),
            storeEventRepo ?? new FakeStoreEventRepo(),
            new StubDiscordService(),
            new StubBadgeService(),
            new FakeLicenseTierService());
    }

    // ── Stub no-ops ───────────────────────────────────────────────────────

    private sealed class StubPlayerRepo : IPlayerRepository
    {
        public Task<Player?> GetByIdAsync(int id) => Task.FromResult<Player?>(null);
        public Task<Player?> GetByEmailAsync(string e) => Task.FromResult<Player?>(null);
        public Task<List<Player>> GetLeaderboardAsync() => Task.FromResult(new List<Player>());
        public Task<List<Player>> GetAllAsync() => Task.FromResult(new List<Player>());
        public Task<Player> CreateAsync(Player p) => Task.FromResult(p);
        public Task UpdateAsync(Player p) => Task.CompletedTask;
        public Task UpdateRangeAsync(IEnumerable<Player> ps) => Task.CompletedTask;
        public Task<List<Player>> GetByIdsAsync(IEnumerable<int> ids) => Task.FromResult(new List<Player>());
        public Task<List<EventRegistration>> GetPlayerEventRegistrationsAsync(int pid) => Task.FromResult(new List<EventRegistration>());
    }

    private sealed class StubGameRepo : IGameRepository
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

    private sealed class StubPodService : IPodService
    {
        public List<List<Player>> GenerateRound1Pods(List<Player> p) => [p];
        public List<List<Player>> GenerateNextRoundPods(Round prev, List<Player> active) => [active];
    }

    private sealed class StubTrueSkillService : ITrueSkillService
    {
        public Task UpdateRatingsAsync(Game game) => Task.CompletedTask;
        public Task UpdateRatingsFromEventStandingsAsync(List<(int PlayerId, int Rank, int GamesPlayed)> rankings) => Task.CompletedTask;
    }

    private sealed class StubDiscordService : IDiscordWebhookService
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

    // ── Fake IEventService (for controller tests) ─────────────────────────

    private sealed class FakeEventService : IEventService
    {
        public EventDto? NextDto { get; set; }
        public string? LastBackgroundUrl { get; private set; }
        public int LastEventId { get; private set; }

        public Task<EventDto?> UpdateBackgroundImageUrlAsync(int eventId, string url)
        {
            LastEventId = eventId;
            LastBackgroundUrl = url;
            return Task.FromResult(NextDto);
        }

        public Task<EventDto> CreateAsync(CreateEventDto dto) => throw new NotImplementedException();
        public Task<EventDto?> GetByIdAsync(int id) => throw new NotImplementedException();
        public Task<List<EventDto>> GetAllAsync(int? storeId = null) => throw new NotImplementedException();
        public Task RegisterPlayerAsync(int eventId, int playerId, string? decklistUrl = null, string? commanders = null) => throw new NotImplementedException();
        public Task<RoundDto> GenerateNextRoundAsync(int eventId) => throw new NotImplementedException();
        public Task<List<RoundDto>> GetRoundsAsync(int eventId) => throw new NotImplementedException();
        public Task SubmitGameResultAsync(int gameId, List<GameResultSubmitDto> results) => throw new NotImplementedException();
        public Task RevertGameResultAsync(int gameId) => throw new NotImplementedException();
        public Task<List<StandingsEntryDto>> GetStandingsAsync(int eventId) => throw new NotImplementedException();
        public Task<EventDto?> UpdateStatusAsync(int eventId, string status, int? plannedRounds = null) => throw new NotImplementedException();
        public Task<List<EventPlayerDto>> GetEventPlayersAsync(int eventId) => throw new NotImplementedException();
        public Task DropPlayerAsync(int eventId, int playerId) => throw new NotImplementedException();
        public Task DisqualifyPlayerAsync(int eventId, int playerId) => throw new NotImplementedException();
        public Task RemoveAsync(int eventId) => throw new NotImplementedException();
        public Task<EventPlayerDto> SetCheckInAsync(int eventId, int playerId, bool checkedIn) => throw new NotImplementedException();
        public Task<EventPlayerDto> SetDroppedAsync(int eventId, int playerId, bool dropped) => throw new NotImplementedException();
        public Task PromoteFromWaitlistAsync(int eventId) => throw new NotImplementedException();
        public Task<EventPlayerDto> ManualPromoteAsync(int eventId, int playerId) => throw new NotImplementedException();
        public Task<PairingsDto?> GetPairingsAsync(int eventId) => throw new NotImplementedException();
        public Task<CheckInResponseDto> CheckInByTokenAsync(string token, string playerEmail) => throw new NotImplementedException();
        public Task<EventPlayerDto> DeclareCommanderAsync(int eventId, int playerId, DeclareCommanderDto dto) => throw new NotImplementedException();
        public Task<BulkRegisterResultDto> BulkRegisterConfirmAsync(int eventId, BulkRegisterConfirmDto dto) => throw new NotImplementedException();
    }

    // ── Fake IWebHostEnvironment ──────────────────────────────────────────

    private sealed class FakeWebHostEnvironment : IWebHostEnvironment
    {
        public string WebRootPath { get; set; } = Path.GetTempPath();
        public string ContentRootPath { get; set; } = Path.GetTempPath();
        public string EnvironmentName { get; set; } = "Testing";
        public string ApplicationName { get; set; } = "TournamentOrganizer";
        public Microsoft.Extensions.FileProviders.IFileProvider ContentRootFileProvider { get; set; } = null!;
        public Microsoft.Extensions.FileProviders.IFileProvider WebRootFileProvider { get; set; } = null!;
    }

    // ── Helpers ───────────────────────────────────────────────────────────

    private static IFormFile MakeFormFile(string fileName, long sizeBytes, string contentType = "image/png")
    {
        var stream = new MemoryStream(new byte[sizeBytes]);
        return new FormFile(stream, 0, sizeBytes, "background", fileName)
        {
            Headers = new HeaderDictionary(),
            ContentType = contentType
        };
    }

    private static EventsController BuildController(
        IEventService service,
        IWebHostEnvironment env,
        bool isAdmin = false,
        int jwtStoreId = 1)
    {
        var controller = new EventsController(service, new FakeStoreEventRepo(jwtStoreId), env);
        var claims = new List<Claim>
        {
            new("sub", "user-1"),
            new("storeId", jwtStoreId.ToString()),
            new("role", isAdmin ? "Administrator" : "StoreEmployee"),
        };
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(claims, "Test"))
            }
        };
        return controller;
    }

    // ══════════════════════════════════════════════════════════════════════
    // Service tests — UpdateBackgroundImageUrlAsync
    // ══════════════════════════════════════════════════════════════════════

    [Fact]
    public async Task UpdateBackgroundImageUrlAsync_SetsUrl_ReturnsUpdatedDto()
    {
        var eventRepo = new FakeEventRepo();
        var evt = new Event { Id = 1, Name = "Test Event", Date = DateTime.UtcNow };
        eventRepo.Events.Add(evt);
        var service = MakeService(eventRepo);

        var result = await service.UpdateBackgroundImageUrlAsync(1, "/backgrounds/event_1.png");

        Assert.NotNull(result);
        Assert.Equal("/backgrounds/event_1.png", result!.BackgroundImageUrl);
    }

    [Fact]
    public async Task UpdateBackgroundImageUrlAsync_UnknownEvent_ReturnsNull()
    {
        var service = MakeService();
        var result = await service.UpdateBackgroundImageUrlAsync(99, "/backgrounds/event_99.png");
        Assert.Null(result);
    }

    // ══════════════════════════════════════════════════════════════════════
    // Service tests — GetByIdAsync returns background URLs
    // ══════════════════════════════════════════════════════════════════════

    [Fact]
    public async Task GetById_ReturnsEventBackgroundImageUrl()
    {
        var eventRepo = new FakeEventRepo();
        eventRepo.Events.Add(new Event { Id = 1, Name = "Bg Event", Date = DateTime.UtcNow, BackgroundImageUrl = "/backgrounds/event_1.jpg" });
        var service = MakeService(eventRepo);

        var dto = await service.GetByIdAsync(1);

        Assert.NotNull(dto);
        Assert.Equal("/backgrounds/event_1.jpg", dto!.BackgroundImageUrl);
    }

    [Fact]
    public async Task GetById_ReturnsStoreBackgroundImageUrl_FromStoreEventRepo()
    {
        var eventRepo = new FakeEventRepo();
        eventRepo.Events.Add(new Event { Id = 1, Name = "Event", Date = DateTime.UtcNow });
        var storeEventRepo = new FakeStoreEventRepo(storeId: 1, storeName: "My Store", storeBackground: "/backgrounds/1.png");
        var service = MakeService(eventRepo, storeEventRepo);

        var dto = await service.GetByIdAsync(1);

        Assert.NotNull(dto);
        Assert.Null(dto!.BackgroundImageUrl);
        Assert.Equal("/backgrounds/1.png", dto.StoreBackgroundImageUrl);
    }

    // ══════════════════════════════════════════════════════════════════════
    // Service tests — GetAllAsync passes store background
    // ══════════════════════════════════════════════════════════════════════

    [Fact]
    public async Task GetAll_ReturnsStoreBackgroundImageUrl_WhenEventHasNone()
    {
        var store = new Store { Id = 1, StoreName = "Shop", BackgroundImageUrl = "/backgrounds/1.png" };
        var storeEvt = new StoreEvent { StoreId = 1, EventId = 1, Store = store };
        var evt = new Event { Id = 1, Name = "Event", Date = DateTime.UtcNow, Status = EventStatus.Registration, StoreEvent = storeEvt };

        var eventRepo = new FakeEventRepo();
        eventRepo.Events.Add(evt);
        var service = MakeService(eventRepo);

        var list = await service.GetAllAsync();

        Assert.Single(list);
        Assert.Null(list[0].BackgroundImageUrl);
        Assert.Equal("/backgrounds/1.png", list[0].StoreBackgroundImageUrl);
    }

    // ══════════════════════════════════════════════════════════════════════
    // Service tests — GetPairingsAsync includes effective background
    // ══════════════════════════════════════════════════════════════════════

    [Fact]
    public async Task GetPairings_IncludesEffectiveBackgroundUrl_EventOwn()
    {
        var eventRepo = new FakeEventRepo();
        eventRepo.Events.Add(new Event
        {
            Id = 1, Name = "Test", Date = DateTime.UtcNow,
            Status = EventStatus.InProgress,
            BackgroundImageUrl = "/backgrounds/event_1.png"
        });
        var storeEventRepo = new FakeStoreEventRepo(storeId: 1, storeBackground: "/backgrounds/1.png");
        var service = MakeService(eventRepo, storeEventRepo);

        var pairings = await service.GetPairingsAsync(1);

        Assert.NotNull(pairings);
        // Event's own background takes priority
        Assert.Equal("/backgrounds/event_1.png", pairings!.BackgroundImageUrl);
    }

    [Fact]
    public async Task GetPairings_FallsBackToStoreBackground_WhenEventHasNone()
    {
        var eventRepo = new FakeEventRepo();
        eventRepo.Events.Add(new Event
        {
            Id = 1, Name = "Test", Date = DateTime.UtcNow,
            Status = EventStatus.InProgress
            // No BackgroundImageUrl
        });
        var storeEventRepo = new FakeStoreEventRepo(storeId: 1, storeBackground: "/backgrounds/1.png");
        var service = MakeService(eventRepo, storeEventRepo);

        var pairings = await service.GetPairingsAsync(1);

        Assert.NotNull(pairings);
        Assert.Equal("/backgrounds/1.png", pairings!.BackgroundImageUrl);
    }

    // ══════════════════════════════════════════════════════════════════════
    // Controller tests — POST /api/events/{id}/background
    // ══════════════════════════════════════════════════════════════════════

    [Fact]
    public async Task UploadBackground_ValidFile_CallsServiceAndReturnsDto()
    {
        var env = new FakeWebHostEnvironment();
        var returnDto = new EventDto(1, "Test Event", DateTime.UtcNow, "Registration", 0, 55, null, "ScoreBased", 1, null, null, null,
            BackgroundImageUrl: "/backgrounds/event_1.png");
        var service = new FakeEventService { NextDto = returnDto };
        var controller = BuildController(service, env, isAdmin: true);

        var result = await controller.UploadBackground(1, MakeFormFile("bg.png", 100 * 1024));

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var dto = Assert.IsType<EventDto>(ok.Value);
        Assert.Equal("/backgrounds/event_1.png", dto.BackgroundImageUrl);
        Assert.Equal("/backgrounds/event_1.png", service.LastBackgroundUrl);
    }

    [Fact]
    public async Task UploadBackground_InvalidExtension_Returns400()
    {
        var env = new FakeWebHostEnvironment();
        var controller = BuildController(new FakeEventService(), env, isAdmin: true);

        var result = await controller.UploadBackground(1, MakeFormFile("bg.bmp", 100, "image/bmp"));

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public async Task UploadBackground_FileTooLarge_Returns400()
    {
        var env = new FakeWebHostEnvironment();
        var controller = BuildController(new FakeEventService(), env, isAdmin: true);

        var result = await controller.UploadBackground(1, MakeFormFile("bg.png", 6 * 1024 * 1024));

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }
}
