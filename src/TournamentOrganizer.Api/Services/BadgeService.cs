using Microsoft.EntityFrameworkCore;
using TournamentOrganizer.Api.Data;
using TournamentOrganizer.Api.DTOs;
using TournamentOrganizer.Api.Models;
using TournamentOrganizer.Api.Repositories.Interfaces;
using TournamentOrganizer.Api.Services.Interfaces;

namespace TournamentOrganizer.Api.Services;

public class BadgeService : IBadgeService
{
    private static readonly Dictionary<string, string> BadgeDisplayNames = new()
    {
        ["first_win"]            = "First Win",
        ["placement_complete"]   = "Ranked",
        ["tournament_winner"]    = "Tournament Champion",
        ["undefeated_swiss"]     = "Flawless",
        ["veteran"]              = "Veteran",
        ["centurion"]            = "Centurion",
    };

    private readonly AppDbContext _ctx;

    public BadgeService(AppDbContext ctx) => _ctx = ctx;
    private readonly IBadgeRepository _badgeRepo;
    private readonly IPlayerRepository _playerRepo;
    private readonly IGameRepository _gameRepo;
    private readonly AppDbContext _db;

    private static readonly Dictionary<string, string> BadgeDisplayNames = new()
    {
        ["first_win"]           = "First Win",
        ["placement_complete"]  = "Ranked",
        ["tournament_winner"]   = "Tournament Champion",
        ["undefeated_swiss"]    = "Flawless",
        ["veteran"]             = "Veteran",
        ["centurion"]           = "Centurion",
    };

    public BadgeService(
        IBadgeRepository badgeRepo,
        IPlayerRepository playerRepo,
        IGameRepository gameRepo,
        AppDbContext db)
    {
        _badgeRepo = badgeRepo;
        _playerRepo = playerRepo;
        _gameRepo = gameRepo;
        _db = db;
    }

    public async Task CheckAndAwardAsync(int playerId, BadgeTrigger trigger, int? eventId = null)
    {
        switch (trigger)
        {
            case BadgeTrigger.GameResultRecorded:
                await CheckFirstWinAsync(playerId, eventId);
                await CheckCenturionAsync(playerId, eventId);
                break;

            case BadgeTrigger.PlacementComplete:
                await AwardIfNewAsync(playerId, "placement_complete", eventId);
                await CheckPlacementCompleteAsync(playerId, eventId);
                break;

            case BadgeTrigger.TournamentWinner:
                if (eventId.HasValue)
                    await CheckTournamentWinnerAsync(playerId, eventId.Value);
                break;

            case BadgeTrigger.EventCompleted:
                if (eventId.HasValue)
                {
                    await CheckTournamentWinnerAsync(playerId, eventId.Value);
                    await CheckUndefeatedSwissAsync(playerId, eventId.Value);
                    await CheckVeteranAsync(playerId, eventId.Value);
                }
                break;
        }
    }

    private async Task CheckFirstWinAsync(int playerId, int? eventId)
    {
        if (await _badgeRepo.ExistsAsync(playerId, "first_win")) return;

        // Check if this player has any game result with FinishPosition == 1
        var hasWin = await _db.GameResults.AnyAsync(gr =>
            gr.PlayerId == playerId &&
            gr.FinishPosition == 1 &&
            gr.Game.Status == GameStatus.Completed);

        if (hasWin)
            await AwardBadgeAsync(playerId, "first_win", eventId);
    }

    private async Task CheckPlacementCompleteAsync(int playerId, int? eventId)
    {
        if (await _badgeRepo.ExistsAsync(playerId, "placement_complete")) return;

        var player = await _playerRepo.GetByIdAsync(playerId);
        if (player != null && player.PlacementGamesLeft == 0)
            await AwardBadgeAsync(playerId, "placement_complete", eventId);
    }

    private async Task CheckTournamentWinnerAsync(int playerId, int eventId)
    {
        // Player wins event if they have the most 1st-place finishes (or ranked #1 overall).
        // We define it as: player finished 1st in every pod they played in this event, AND
        // had more wins than any other player, OR they simply had the highest total wins —
        // Simplified: player who has the most FinishPosition==1 across all pods in the event
        // (tie-break: first alphabetically is not ideal; use DB-level ordering).
        // Per spec intent: "Finish 1st overall in a completed event" = player ranks 1st in
        // the event standings. We derive it from pod results: most wins, then any tiebreak.

        var playerWins = await _ctx.GameResults
            .Include(gr => gr.Game)
                .ThenInclude(g => g.Pod)
                    .ThenInclude(p => p.Round)
            .Where(gr => gr.Game.Pod.Round.EventId == eventId && gr.FinishPosition == 1)
            .GroupBy(gr => gr.PlayerId)
            .Select(g => new { PlayerId = g.Key, Wins = g.Count() })
            .OrderByDescending(x => x.Wins)
            .ToListAsync();

        if (playerWins.Count == 0) return;

        // The player with the most wins in the event is the tournament winner.
        // If our player has the highest count (or tied for highest), award the badge.
        var topWins = playerWins[0].Wins;
        var topPlayers = playerWins.Where(x => x.Wins == topWins).Select(x => x.PlayerId).ToList();

        if (topPlayers.Contains(playerId))
            await AwardIfNewAsync(playerId, "tournament_winner", eventId);
        if (await _badgeRepo.ExistsAsync(playerId, "tournament_winner")) return;

        // Player finished 1st overall in this event (determined by standings query)
        // We look at whether this player has rank 1 in standins for this event
        // Best proxy: check if they were the top finisher in the final game result set
        // We'll query to find the player with the most wins / points in the event
        // Simpler approach: check if this player has a standing of rank 1
        // For now, trust the caller to only invoke this for the actual winner
        await AwardBadgeAsync(playerId, "tournament_winner", eventId);
    }

    private async Task CheckUndefeatedSwissAsync(int playerId, int eventId)
    {
        // All pods in the event that have results for this player must be FinishPosition == 1
        var results = await _ctx.GameResults
            .Include(gr => gr.Game)
                .ThenInclude(g => g.Pod)
                    .ThenInclude(p => p.Round)
            .Where(gr => gr.PlayerId == playerId && gr.Game.Pod.Round.EventId == eventId)
            .ToListAsync();

        if (results.Count == 0) return;

        bool allWins = results.All(gr => gr.FinishPosition == 1);
        if (allWins)
            await AwardIfNewAsync(playerId, "undefeated_swiss", eventId);
    }

    private async Task CheckVeteranAsync(int playerId, int eventId)
    {
        // Count all events the player has registered for (completed or otherwise)
        int eventCount = await _ctx.EventRegistrations
            .CountAsync(er => er.PlayerId == playerId);

        if (eventCount >= 10)
            await AwardIfNewAsync(playerId, "veteran", eventId);
    }

    public async Task<List<PlayerBadgeDto>> GetBadgesAsync(int playerId)
    {
        var badges = await _ctx.PlayerBadges
            .Where(b => b.PlayerId == playerId)
            .OrderBy(b => b.AwardedAt)
            .ToListAsync();

        return badges.Select(b => new PlayerBadgeDto(
            b.BadgeKey,
            BadgeDisplayNames.TryGetValue(b.BadgeKey, out var name) ? name : b.BadgeKey,
            b.AwardedAt,
            b.EventId
        )).ToList();
    }

    // ── helper ───────────────────────────────────────────────────────────────

    private async Task AwardIfNewAsync(int playerId, string badgeKey, int? eventId)
    {
        bool exists = await _ctx.PlayerBadges
            .AnyAsync(b => b.PlayerId == playerId && b.BadgeKey == badgeKey);

        if (exists) return;

        _ctx.PlayerBadges.Add(new PlayerBadge
        if (await _badgeRepo.ExistsAsync(playerId, "undefeated_swiss")) return;

        // Check if the player won every pod they played in this event
        var playerResults = await _db.GameResults
            .Include(gr => gr.Game)
                .ThenInclude(g => g.Pod)
                    .ThenInclude(p => p.Round)
            .Where(gr => gr.PlayerId == playerId
                      && gr.Game.Pod.Round.EventId == eventId
                      && gr.Game.Status == GameStatus.Completed)
            .ToListAsync();

        if (playerResults.Count == 0) return;

        bool allWins = playerResults.All(gr => gr.FinishPosition == 1);
        if (allWins)
            await AwardBadgeAsync(playerId, "undefeated_swiss", eventId);
    }

    private async Task CheckVeteranAsync(int playerId, int? eventId)
    {
        if (await _badgeRepo.ExistsAsync(playerId, "veteran")) return;

        var eventCount = await _badgeRepo.GetEventCountForPlayerAsync(playerId);
        if (eventCount >= 10)
            await AwardBadgeAsync(playerId, "veteran", eventId);
    }

    private async Task CheckCenturionAsync(int playerId, int? eventId)
    {
        if (await _badgeRepo.ExistsAsync(playerId, "centurion")) return;

        var gameCount = await _badgeRepo.GetGameCountForPlayerAsync(playerId);
        if (gameCount >= 100)
            await AwardBadgeAsync(playerId, "centurion", eventId);
    }

    private async Task AwardBadgeAsync(int playerId, string badgeKey, int? eventId)
    {
        // Double-check to prevent race: only award if not already present
        if (await _badgeRepo.ExistsAsync(playerId, badgeKey)) return;

        var badge = new PlayerBadge
        {
            PlayerId  = playerId,
            BadgeKey  = badgeKey,
            AwardedAt = DateTime.UtcNow,
            EventId   = eventId,       
        }       
        await _badgeRepo.AddAsync(badge);
        await _ctx.SaveChangesAsync();
    }

    public async Task<List<PlayerBadgeDto>> GetBadgesAsync(int playerId)
    {
        var badges = await _badgeRepo.GetByPlayerIdAsync(playerId);
        return badges
            .Select(b => new PlayerBadgeDto(
                b.BadgeKey,
                BadgeDisplayNames.GetValueOrDefault(b.BadgeKey, b.BadgeKey),
                b.AwardedAt,
                b.EventId))
            .ToList();
    }

    public static string GetDisplayName(string badgeKey)
        => BadgeDisplayNames.GetValueOrDefault(badgeKey, badgeKey);
}
