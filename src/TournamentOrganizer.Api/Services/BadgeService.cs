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
        ["first_win"]           = "First Win",
        ["placement_complete"]  = "Ranked",
        ["tournament_winner"]   = "Tournament Champion",
        ["undefeated_swiss"]    = "Flawless",
        ["veteran"]             = "Veteran",
        ["centurion"]           = "Centurion",
    };

    private readonly IBadgeRepository _badgeRepo;
    private readonly IPlayerRepository _playerRepo;
    private readonly IGameRepository _gameRepo;
    private readonly AppDbContext _db;

    public BadgeService(
        IBadgeRepository badgeRepo,
        IPlayerRepository playerRepo,
        IGameRepository gameRepo,
        AppDbContext db)
    {
        _badgeRepo  = badgeRepo;
        _playerRepo = playerRepo;
        _gameRepo   = gameRepo;
        _db         = db;
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
                await CheckPlacementCompleteAsync(playerId, eventId);
                break;

            case BadgeTrigger.TournamentWinner:
                await AwardBadgeAsync(playerId, "tournament_winner", eventId);
                break;

            case BadgeTrigger.EventCompleted:
                if (eventId.HasValue)
                {
                    await CheckUndefeatedSwissAsync(playerId, eventId.Value);
                    await CheckVeteranAsync(playerId, eventId.Value);
                }
                break;
        }
    }

    private async Task CheckFirstWinAsync(int playerId, int? eventId)
    {
        if (await _badgeRepo.ExistsAsync(playerId, "first_win")) return;

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

    private async Task CheckUndefeatedSwissAsync(int playerId, int eventId)
    {
        if (await _badgeRepo.ExistsAsync(playerId, "undefeated_swiss")) return;

        var results = await _db.GameResults
            .Include(gr => gr.Game)
                .ThenInclude(g => g.Pod)
                    .ThenInclude(p => p.Round)
            .Where(gr => gr.PlayerId == playerId && gr.Game.Pod.Round.EventId == eventId)
            .ToListAsync();

        if (results.Count == 0) return;

        bool allWins = results.All(gr => gr.FinishPosition == 1);
        if (allWins)
            await AwardBadgeAsync(playerId, "undefeated_swiss", eventId);
    }

    private async Task CheckVeteranAsync(int playerId, int eventId)
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
        if (await _badgeRepo.ExistsAsync(playerId, badgeKey)) return;

        var badge = new PlayerBadge
        {
            PlayerId  = playerId,
            BadgeKey  = badgeKey,
            AwardedAt = DateTime.UtcNow,
            EventId   = eventId,
        };
        await _badgeRepo.AddAsync(badge);
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
