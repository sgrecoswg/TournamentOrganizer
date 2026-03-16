using System.Net;
using System.Text.Json;
using Microsoft.Extensions.Logging.Abstractions;
using TournamentOrganizer.Api.Models;
using TournamentOrganizer.Api.Repositories.Interfaces;
using TournamentOrganizer.Api.Services;

namespace TournamentOrganizer.Tests;

public class DiscordWebhookServiceTests
{
    // ── Fakes ─────────────────────────────────────────────────────────────────

    private sealed class FakeStoreRepository : IStoreRepository
    {
        public Store? StoreToReturn { get; set; }
        public Task<List<Store>> GetAllAsync() => Task.FromResult(new List<Store>());
        public Task<Store?> GetByIdWithSettingsAsync(int id) => Task.FromResult(StoreToReturn);
        public Task<Store?> GetByIdWithEventsAsync(int id) => Task.FromResult(StoreToReturn);
        public Task<Store> AddAsync(Store s) => Task.FromResult(s);
        public Task UpdateAsync(Store s) => Task.CompletedTask;
    }

    private sealed class FakeStoreEventRepository : IStoreEventRepository
    {
        public int StoreId { get; set; } = 1;
        public string StoreName { get; set; } = "Test Shop";
        public Task<(int? StoreId, string? StoreName)> GetStoreInfoForEventAsync(int eventId)
            => Task.FromResult<(int?, string?)>((StoreId, StoreName));
        public Task AddAsync(StoreEvent se) => Task.CompletedTask;
        public Task<int?> GetStoreIdForEventAsync(int eventId) => Task.FromResult<int?>(StoreId);
        public Task<List<StoreEvent>> GetByStoreIdAsync(int storeId) => Task.FromResult(new List<StoreEvent>());
    }

    private sealed class FakeEventRepository : IEventRepository
    {
        public Event? EventToReturn { get; set; }
        public Task<Event?> GetByIdAsync(int id) => Task.FromResult(EventToReturn);
        public Task<Event?> GetWithDetailsAsync(int id) => Task.FromResult(EventToReturn);
        public Task<List<Event>> GetAllAsync() => Task.FromResult(new List<Event>());
        public Task<List<Event>> GetAllWithStoreAsync(int? storeId = null) => Task.FromResult(new List<Event>());
        public Task<Event> CreateAsync(Event e) => Task.FromResult(e);
        public Task UpdateAsync(Event e) => Task.CompletedTask;
        public Task<EventRegistration> RegisterPlayerAsync(EventRegistration r) => Task.FromResult(r);
        public Task<List<Player>> GetRegisteredPlayersAsync(int eventId) => Task.FromResult(new List<Player>());
        public Task<bool> IsPlayerRegisteredAsync(int eventId, int playerId) => Task.FromResult(false);
        public Task<Round> CreateRoundAsync(Round r) => Task.FromResult(r);
        public Task<Round?> GetLatestRoundAsync(int eventId) => Task.FromResult<Round?>(null);
        public Task<Round?> GetLatestRoundWithPairingsAsync(int eventId) => Task.FromResult<Round?>(null);
        public Task<Round?> GetRoundWithDetailsAsync(int roundId) => Task.FromResult<Round?>(null);
        public Task<List<Round>> GetRoundsForEventAsync(int eventId)
        {
            var rounds = EventToReturn?.Rounds?.ToList() ?? new List<Round>();
            return Task.FromResult(rounds);
        }
        public Task<EventRegistration?> GetRegistrationAsync(int eventId, int playerId) => Task.FromResult<EventRegistration?>(null);
        public Task<List<EventRegistration>> GetRegistrationsWithPlayersAsync(int eventId) => Task.FromResult(new List<EventRegistration>());
        public Task RemoveRegistrationAsync(EventRegistration r) => Task.CompletedTask;
        public Task UpdateRegistrationAsync(EventRegistration r) => Task.CompletedTask;
        public Task<Event?> GetByCheckInTokenAsync(string token) => Task.FromResult<Event?>(null);
    }

    private sealed class FakePlayerRepository : IPlayerRepository
    {
        public Player? PlayerToReturn { get; set; }
        public Task<Player?> GetByIdAsync(int id) => Task.FromResult(PlayerToReturn);
        public Task<Player?> GetByEmailAsync(string email) => Task.FromResult<Player?>(null);
        public Task<List<Player>> GetLeaderboardAsync() => Task.FromResult(new List<Player>());
        public Task<List<Player>> GetAllAsync() => Task.FromResult(new List<Player>());
        public Task<Player> CreateAsync(Player p) => Task.FromResult(p);
        public Task UpdateAsync(Player p) => Task.CompletedTask;
        public Task UpdateRangeAsync(IEnumerable<Player> players) => Task.CompletedTask;
        public Task<List<Player>> GetByIdsAsync(IEnumerable<int> ids) => Task.FromResult(new List<Player>());
        public Task<List<EventRegistration>> GetPlayerEventRegistrationsAsync(int playerId) => Task.FromResult(new List<EventRegistration>());
    }

    // Captures the HTTP request sent to Discord
    private sealed class CapturingHandler : HttpMessageHandler
    {
        public HttpRequestMessage? LastRequest { get; private set; }
        public HttpStatusCode StatusCode { get; set; } = HttpStatusCode.NoContent;

        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request, CancellationToken cancellationToken)
        {
            LastRequest = request;
            return Task.FromResult(new HttpResponseMessage(StatusCode));
        }
    }

    private static DiscordWebhookService BuildService(
        FakeStoreRepository storeRepo,
        FakeStoreEventRepository storeEventRepo,
        FakeEventRepository eventRepo,
        FakePlayerRepository playerRepo,
        CapturingHandler handler)
    {
        var httpClient = new HttpClient(handler);
        var factory = new SingleClientFactory(httpClient);
        return new DiscordWebhookService(
            storeRepo, storeEventRepo, eventRepo, playerRepo,
            factory, NullLogger<DiscordWebhookService>.Instance);
    }

    // Helper: IHttpClientFactory that always returns the same client
    private sealed class SingleClientFactory : IHttpClientFactory
    {
        private readonly HttpClient _client;
        public SingleClientFactory(HttpClient client) => _client = client;
        public HttpClient CreateClient(string name) => _client;
    }

    // ── Tests ─────────────────────────────────────────────────────────────────

    [Fact]
    public async Task PostRoundResultsAsync_NoWebhookConfigured_DoesNotPost()
    {
        var storeRepo = new FakeStoreRepository { StoreToReturn = new Store { Id = 1, StoreName = "Shop", DiscordWebhookUrl = null } };
        var storeEventRepo = new FakeStoreEventRepository { StoreId = 1 };
        var eventRepo = new FakeEventRepository
        {
            EventToReturn = new Event { Id = 1, Name = "FNM", Rounds = [MakeRound(1)] }
        };
        var handler = new CapturingHandler();
        var svc = BuildService(storeRepo, storeEventRepo, eventRepo, new FakePlayerRepository(), handler);

        await svc.PostRoundResultsAsync(1, 1);

        Assert.Null(handler.LastRequest);
    }

    [Fact]
    public async Task PostRoundResultsAsync_WebhookConfigured_PostsToUrl()
    {
        const string webhookUrl = "https://discord.com/api/webhooks/123/abc";
        var storeRepo = new FakeStoreRepository { StoreToReturn = new Store { Id = 1, StoreName = "Shop", DiscordWebhookUrl = webhookUrl } };
        var storeEventRepo = new FakeStoreEventRepository { StoreId = 1, StoreName = "Shop" };
        var eventRepo = new FakeEventRepository
        {
            EventToReturn = new Event { Id = 1, Name = "FNM", Rounds = [MakeRound(1)] }
        };
        var handler = new CapturingHandler();
        var svc = BuildService(storeRepo, storeEventRepo, eventRepo, new FakePlayerRepository(), handler);

        await svc.PostRoundResultsAsync(1, 1);

        Assert.NotNull(handler.LastRequest);
        Assert.Equal(HttpMethod.Post, handler.LastRequest!.Method);
        Assert.Equal(webhookUrl, handler.LastRequest.RequestUri!.ToString());
    }

    [Fact]
    public async Task PostRoundResultsAsync_WebhookFails_DoesNotThrow()
    {
        const string webhookUrl = "https://discord.com/api/webhooks/123/abc";
        var storeRepo = new FakeStoreRepository { StoreToReturn = new Store { Id = 1, StoreName = "Shop", DiscordWebhookUrl = webhookUrl } };
        var storeEventRepo = new FakeStoreEventRepository { StoreId = 1 };
        var eventRepo = new FakeEventRepository
        {
            EventToReturn = new Event { Id = 1, Name = "FNM", Rounds = [MakeRound(1)] }
        };
        var handler = new CapturingHandler { StatusCode = HttpStatusCode.BadRequest };
        var svc = BuildService(storeRepo, storeEventRepo, eventRepo, new FakePlayerRepository(), handler);

        // Should not throw even on non-2xx
        var ex = await Record.ExceptionAsync(() => svc.PostRoundResultsAsync(1, 1));
        Assert.Null(ex);
    }

    [Fact]
    public async Task PostEventCompletedAsync_FormatsStandingsCorrectly()
    {
        const string webhookUrl = "https://discord.com/api/webhooks/123/abc";
        var storeRepo = new FakeStoreRepository { StoreToReturn = new Store { Id = 1, StoreName = "Shop", DiscordWebhookUrl = webhookUrl } };
        var storeEventRepo = new FakeStoreEventRepository { StoreId = 1, StoreName = "Shop" };
        var eventRepo = new FakeEventRepository
        {
            EventToReturn = new Event
            {
                Id = 1, Name = "FNM",
                Rounds = [MakeRoundWithResults()]
            }
        };
        var handler = new CapturingHandler();
        var svc = BuildService(storeRepo, storeEventRepo, eventRepo, new FakePlayerRepository(), handler);

        await svc.PostEventCompletedAsync(1);

        Assert.NotNull(handler.LastRequest);
        var body = await handler.LastRequest!.Content!.ReadAsStringAsync();
        var doc = JsonDocument.Parse(body);
        var title = doc.RootElement.GetProperty("embeds")[0].GetProperty("title").GetString();
        Assert.Contains("FNM", title);
        Assert.Contains("Complete", title);
    }

    [Fact]
    public async Task PostPlayerRankedAsync_FormatsPlayerNameCorrectly()
    {
        const string webhookUrl = "https://discord.com/api/webhooks/123/abc";
        var storeRepo = new FakeStoreRepository { StoreToReturn = new Store { Id = 1, StoreName = "Shop", DiscordWebhookUrl = webhookUrl } };
        var storeEventRepo = new FakeStoreEventRepository { StoreId = 1, StoreName = "Shop" };
        var eventRepo = new FakeEventRepository
        {
            EventToReturn = new Event { Id = 1, Name = "FNM", Rounds = [] }
        };
        var playerRepo = new FakePlayerRepository { PlayerToReturn = new Player { Id = 42, Name = "Alice" } };
        var handler = new CapturingHandler();
        var svc = BuildService(storeRepo, storeEventRepo, eventRepo, playerRepo, handler);

        await svc.PostPlayerRankedAsync(42, 1);

        Assert.NotNull(handler.LastRequest);
        var body = await handler.LastRequest!.Content!.ReadAsStringAsync();
        Assert.Contains("Alice", body);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private static Round MakeRound(int roundNumber) => new()
    {
        Id = roundNumber,
        RoundNumber = roundNumber,
        Pods = []
    };

    private static Round MakeRoundWithResults() => new()
    {
        Id = 1,
        RoundNumber = 1,
        Pods =
        [
            new Pod
            {
                PodNumber = 1,
                Game = new Game
                {
                    Status = GameStatus.Completed,
                    Results =
                    [
                        new GameResult { PlayerId = 1, FinishPosition = 1, Player = new Player { Name = "Alice" } },
                        new GameResult { PlayerId = 2, FinishPosition = 2, Player = new Player { Name = "Bob" } },
                        new GameResult { PlayerId = 3, FinishPosition = 3, Player = new Player { Name = "Carol" } },
                        new GameResult { PlayerId = 4, FinishPosition = 4, Player = new Player { Name = "Dave" } },
                    ]
                }
            }
        ]
    };
}
