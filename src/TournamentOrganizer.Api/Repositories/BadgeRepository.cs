using Microsoft.EntityFrameworkCore;
using TournamentOrganizer.Api.Data;
using TournamentOrganizer.Api.Models;
using TournamentOrganizer.Api.Repositories.Interfaces;

namespace TournamentOrganizer.Api.Repositories;

public class BadgeRepository : IBadgeRepository
{
    private readonly AppDbContext _db;

    public BadgeRepository(AppDbContext db) => _db = db;

    public async Task<List<PlayerBadge>> GetByPlayerIdAsync(int playerId)
        => await _db.PlayerBadges
            .Where(pb => pb.PlayerId == playerId)
            .OrderBy(pb => pb.AwardedAt)
            .ToListAsync();

    public async Task<bool> ExistsAsync(int playerId, string badgeKey)
        => await _db.PlayerBadges.AnyAsync(pb => pb.PlayerId == playerId && pb.BadgeKey == badgeKey);

    public async Task AddAsync(PlayerBadge badge)
    {
        _db.PlayerBadges.Add(badge);
        await _db.SaveChangesAsync();
    }

    public async Task<List<PlayerBadge>> GetEventWinsForPlayerAsync(int playerId, int eventId)
    {
        // Returns game results where the player finished 1st in a given event
        // We query via GameResult → Game → Pod → Round → Event
        var wins = await _db.GameResults
            .Include(gr => gr.Game)
                .ThenInclude(g => g.Pod)
                    .ThenInclude(p => p.Round)
            .Where(gr => gr.PlayerId == playerId
                      && gr.FinishPosition == 1
                      && gr.Game.Pod.Round.EventId == eventId
                      && gr.Game.Status == GameStatus.Completed)
            .Select(gr => new PlayerBadge { PlayerId = playerId, BadgeKey = "first_win", EventId = eventId })
            .ToListAsync();
        return wins;
    }

    public async Task<int> GetEventCountForPlayerAsync(int playerId)
        => await _db.EventRegistrations
            .Where(er => er.PlayerId == playerId)
            .CountAsync();

    public async Task<int> GetGameCountForPlayerAsync(int playerId)
        => await _db.GameResults
            .Where(gr => gr.PlayerId == playerId)
            .CountAsync();
}
