using Microsoft.EntityFrameworkCore;
using TournamentOrganizer.Api.Data;
using TournamentOrganizer.Api.DTOs;
using TournamentOrganizer.Api.Services.Interfaces;

namespace TournamentOrganizer.Api.Services;

public class StoreAnalyticsService : IStoreAnalyticsService
{
    private readonly AppDbContext _db;

    public StoreAnalyticsService(AppDbContext db) => _db = db;

    public async Task<StoreAnalyticsDto> GetAnalyticsAsync(int storeId)
    {
        // Collect all event IDs for this store
        var eventIds = await _db.StoreEvents
            .Where(se => se.StoreId == storeId)
            .Select(se => se.EventId)
            .ToListAsync();

        if (eventIds.Count == 0)
        {
            return new StoreAnalyticsDto([], [], [], new FinishDistributionDto(0, 0, 0, 0), []);
        }

        // ── Event Trends ──────────────────────────────────────────────────────

        var eventTrends = await _db.Events
            .Where(e => eventIds.Contains(e.Id))
            .GroupBy(e => new { e.Date.Year, e.Date.Month })
            .Select(g => new
            {
                g.Key.Year,
                g.Key.Month,
                EventCount = g.Count(),
                AvgPlayerCount = (double)_db.EventRegistrations
                    .Count(er => g.Select(ev => ev.Id).Contains(er.EventId))
                    / g.Count(),
            })
            .OrderBy(t => t.Year).ThenBy(t => t.Month)
            .ToListAsync();

        var eventTrendDtos = new List<EventTrendDto>();
        foreach (var t in eventTrends)
        {
            var eventsInGroup = await _db.Events
                .Where(e => eventIds.Contains(e.Id) && e.Date.Year == t.Year && e.Date.Month == t.Month)
                .Select(e => e.Id)
                .ToListAsync();

            var totalRegistrations = await _db.EventRegistrations
                .CountAsync(er => eventsInGroup.Contains(er.EventId));

            var avg = t.EventCount > 0 ? (double)totalRegistrations / t.EventCount : 0;
            eventTrendDtos.Add(new EventTrendDto(t.Year, t.Month, t.EventCount, avg));
        }

        // ── Game results for this store ───────────────────────────────────────

        var gameResults = await _db.GameResults
            .Include(gr => gr.Game)
                .ThenInclude(g => g.Pod)
                    .ThenInclude(p => p.Round)
            .Include(gr => gr.Player)
            .Where(gr => eventIds.Contains(gr.Game.Pod.Round.EventId))
            .ToListAsync();

        // ── Commander Win Rates ───────────────────────────────────────────────

        var commanderGroups = gameResults
            .Where(gr => !string.IsNullOrWhiteSpace(gr.CommanderPlayed))
            .GroupBy(gr => gr.CommanderPlayed!)
            .Select(g => new CommanderWinRateDto(
                CommanderName: g.Key,
                Wins: g.Count(gr => gr.FinishPosition == 1),
                GamesPlayed: g.Count(),
                WinPercent: g.Count() > 0
                    ? Math.Round((double)g.Count(gr => gr.FinishPosition == 1) / g.Count() * 100, 1)
                    : 0
            ))
            .OrderByDescending(c => c.WinPercent)
            .Take(10)
            .ToList();

        // ── Top Players ───────────────────────────────────────────────────────

        var topPlayers = gameResults
            .GroupBy(gr => gr.PlayerId)
            .Select(g =>
            {
                var points = g.Sum(gr => gr.FinishPosition switch
                {
                    1 => 4, 2 => 3, 3 => 2, _ => 1
                });
                var eventsPlayed = g.Select(gr => gr.Game.Pod.Round.EventId).Distinct().Count();
                var name = g.First().Player?.Name ?? "Unknown";
                return new StorePlayerStatsDto(g.Key, name, points, eventsPlayed);
            })
            .OrderByDescending(p => p.TotalPoints)
            .Take(10)
            .ToList();

        // ── Finish Distribution ───────────────────────────────────────────────

        var total = gameResults.Count;
        var finishDist = total == 0
            ? new FinishDistributionDto(0, 0, 0, 0)
            : new FinishDistributionDto(
                First:  Math.Round((double)gameResults.Count(gr => gr.FinishPosition == 1) / total * 100, 1),
                Second: Math.Round((double)gameResults.Count(gr => gr.FinishPosition == 2) / total * 100, 1),
                Third:  Math.Round((double)gameResults.Count(gr => gr.FinishPosition == 3) / total * 100, 1),
                Fourth: Math.Round((double)gameResults.Count(gr => gr.FinishPosition >= 4) / total * 100, 1)
            );

        // ── Color Frequency ───────────────────────────────────────────────────

        var validColors = new HashSet<char>(['W', 'U', 'B', 'R', 'G', 'C']);
        var colorCounts = new Dictionary<char, int>();

        foreach (var gr in gameResults)
        {
            if (string.IsNullOrWhiteSpace(gr.DeckColors)) continue;
            foreach (var ch in gr.DeckColors.ToUpperInvariant())
            {
                if (validColors.Contains(ch))
                    colorCounts[ch] = colorCounts.GetValueOrDefault(ch) + 1;
            }
        }

        var colorFrequency = colorCounts
            .Select(kv => new ColorFrequencyDto(kv.Key.ToString(), kv.Value))
            .OrderByDescending(c => c.Count)
            .ToList();

        return new StoreAnalyticsDto(eventTrendDtos, commanderGroups, topPlayers, finishDist, colorFrequency);
    }
}
