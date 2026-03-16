using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using TournamentOrganizer.Api.Models;
using TournamentOrganizer.Api.Repositories.Interfaces;
using TournamentOrganizer.Api.Services.Interfaces;

namespace TournamentOrganizer.Api.Services;

public class DiscordWebhookService : IDiscordWebhookService
{
    private readonly IStoreRepository _storeRepo;
    private readonly IStoreEventRepository _storeEventRepo;
    private readonly IEventRepository _eventRepo;
    private readonly IPlayerRepository _playerRepo;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<DiscordWebhookService> _logger;

    public DiscordWebhookService(
        IStoreRepository storeRepo,
        IStoreEventRepository storeEventRepo,
        IEventRepository eventRepo,
        IPlayerRepository playerRepo,
        IHttpClientFactory httpClientFactory,
        ILogger<DiscordWebhookService> logger)
    {
        _storeRepo = storeRepo;
        _storeEventRepo = storeEventRepo;
        _eventRepo = eventRepo;
        _playerRepo = playerRepo;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    public async Task PostRoundResultsAsync(int eventId, int roundNumber)
    {
        var (webhookUrl, storeName) = await GetWebhookForEventAsync(eventId);
        if (webhookUrl == null) return;

        var evt = await _eventRepo.GetByIdAsync(eventId);
        var eventName = evt?.Name ?? "Tournament";

        var rounds = await _eventRepo.GetRoundsForEventAsync(eventId);
        var round = rounds.FirstOrDefault(r => r.RoundNumber == roundNumber);

        var lines = new List<string>();
        if (round != null)
        {
            foreach (var pod in round.Pods.OrderBy(p => p.PodNumber))
            {
                if (pod.Game?.Status != GameStatus.Completed) continue;
                var winner = pod.Game.Results.OrderBy(r => r.FinishPosition).FirstOrDefault();
                if (winner != null)
                    lines.Add($"**Pod {pod.PodNumber}** — Winner: {winner.Player?.Name ?? $"Player #{winner.PlayerId}"}");
            }
        }

        var description = lines.Count > 0
            ? string.Join("\n", lines)
            : "Results recorded.";

        await PostEmbedAsync(webhookUrl, $"Round {roundNumber} Results — {eventName}", description, storeName ?? "Tournament Organizer");
    }

    public async Task PostEventCompletedAsync(int eventId)
    {
        var (webhookUrl, storeName) = await GetWebhookForEventAsync(eventId);
        if (webhookUrl == null) return;

        var evt = await _eventRepo.GetWithDetailsAsync(eventId);
        var eventName = evt?.Name ?? "Tournament";

        // Collect all results across all rounds, aggregate by player
        var playerPoints = new Dictionary<int, (string Name, int Points)>();
        if (evt != null)
        {
            foreach (var round in evt.Rounds.OrderBy(r => r.RoundNumber))
            {
                foreach (var pod in round.Pods)
                {
                    if (pod.Game?.Status != GameStatus.Completed) continue;
                    bool isDraw = pod.Game.Results.Select(r => r.FinishPosition).Distinct().Count() == 1;
                    foreach (var result in pod.Game.Results)
                    {
                        int pts = result.FinishPosition switch { 1 => 4, 2 => 3, 3 => 2, _ => 1 };
                        if (isDraw) pts = 1;
                        var name = result.Player?.Name ?? $"Player #{result.PlayerId}";
                        if (!playerPoints.ContainsKey(result.PlayerId))
                            playerPoints[result.PlayerId] = (name, 0);
                        var entry = playerPoints[result.PlayerId];
                        playerPoints[result.PlayerId] = (entry.Name, entry.Points + pts);
                    }
                }
            }
        }

        var top4 = playerPoints.OrderByDescending(kv => kv.Value.Points).Take(4).ToList();
        var lines = top4.Select((kv, i) => $"{i + 1}. {kv.Value.Name} — {kv.Value.Points} pts").ToList();
        var description = lines.Count > 0 ? string.Join("\n", lines) : "No results recorded.";

        await PostEmbedAsync(webhookUrl, $"🏆 Event Complete — {eventName}", description, storeName ?? "Tournament Organizer");
    }

    public async Task PostPlayerRankedAsync(int playerId, int eventId)
    {
        var (webhookUrl, storeName) = await GetWebhookForEventAsync(eventId);
        if (webhookUrl == null) return;

        var player = await _playerRepo.GetByIdAsync(playerId);
        var playerName = player?.Name ?? $"Player #{playerId}";

        var evt = await _eventRepo.GetByIdAsync(eventId);
        var eventName = evt?.Name ?? "Tournament";

        await PostEmbedAsync(
            webhookUrl,
            $"🎉 New Ranked Player — {playerName}",
            $"{playerName} has completed their placement games and is now officially ranked!\n_Event: {eventName}_",
            storeName ?? "Tournament Organizer");
    }

    public async Task PostTestMessageAsync(int storeId)
    {
        var store = await _storeRepo.GetByIdWithSettingsAsync(storeId);
        if (store?.DiscordWebhookUrl == null) return;
        await PostEmbedAsync(
            store.DiscordWebhookUrl,
            "✅ Webhook Connected",
            "Your Discord webhook is configured correctly for Tournament Organizer.",
            store.StoreName);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private async Task<(string? WebhookUrl, string? StoreName)> GetWebhookForEventAsync(int eventId)
    {
        var storeId = await _storeEventRepo.GetStoreIdForEventAsync(eventId);
        if (storeId == null) return (null, null);

        var store = await _storeRepo.GetByIdWithSettingsAsync(storeId.Value);
        return (store?.DiscordWebhookUrl, store?.StoreName);
    }

    private async Task PostEmbedAsync(string webhookUrl, string title, string description, string footerText)
    {
        var payload = new
        {
            embeds = new[]
            {
                new
                {
                    title,
                    color = 5793266,
                    description,
                    footer = new { text = footerText }
                }
            }
        };

        try
        {
            var client = _httpClientFactory.CreateClient("Discord");
            var json = JsonSerializer.Serialize(payload);
            var content = new StringContent(json, Encoding.UTF8, "application/json");
            var response = await client.PostAsync(webhookUrl, content);
            if (!response.IsSuccessStatusCode)
                _logger.LogWarning("Discord webhook returned {Status} for URL {Url}", response.StatusCode, webhookUrl);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to post Discord webhook to {Url}", webhookUrl);
        }
    }
}
