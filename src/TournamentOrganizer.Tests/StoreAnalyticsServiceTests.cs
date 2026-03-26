using Microsoft.EntityFrameworkCore;
using TournamentOrganizer.Api.Data;
using TournamentOrganizer.Api.Models;
using TournamentOrganizer.Api.Services;

namespace TournamentOrganizer.Tests;

/// <summary>
/// TDD tests for StoreAnalyticsService (Issue #30).
/// Uses EF Core InMemory provider to seed data and assert computed analytics.
/// </summary>
public class StoreAnalyticsServiceTests : IDisposable
{
    private readonly AppDbContext _db;
    private readonly StoreAnalyticsService _service;

    public StoreAnalyticsServiceTests()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        _db = new AppDbContext(options);
        _service = new StoreAnalyticsService(_db);
    }

    public void Dispose() => _db.Dispose();

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static Player MakePlayer(int id, string name = "Player") =>
        new() { Id = id, Name = name, Email = $"{name.ToLower()}@test.com" };

    private Store SeedStore(int storeId)
    {
        var store = new Store { Id = storeId, StoreName = "Test Store", IsActive = true };
        _db.Stores.Add(store);
        _db.SaveChanges();
        return store;
    }

    private (Event ev, StoreEvent se) SeedEvent(int storeId, int eventId, DateTime date, int playerCount = 4)
    {
        var ev = new Event { Id = eventId, Name = $"Event {eventId}", Date = date, Status = EventStatus.Completed };
        var se = new StoreEvent { Id = eventId, StoreId = storeId, EventId = eventId };
        _db.Events.Add(ev);
        _db.StoreEvents.Add(se);
        _db.SaveChanges();
        return (ev, se);
    }

    /// <summary>Seeds a Round → Pod → Game → GameResult chain.</summary>
    private void SeedGameResults(int eventId, List<(int PlayerId, int Finish, string? Commander, string? Colors)> results)
    {
        var round = new Round { EventId = eventId, RoundNumber = 1 };
        _db.Rounds.Add(round);
        _db.SaveChanges();

        var pod = new Pod { RoundId = round.Id, PodNumber = 1 };
        _db.Pods.Add(pod);
        _db.SaveChanges();

        var game = new Game { PodId = pod.Id, Status = GameStatus.Completed };
        _db.Games.Add(game);
        _db.SaveChanges();

        foreach (var (playerId, finish, commander, colors) in results)
        {
            _db.GameResults.Add(new GameResult
            {
                GameId = game.Id,
                PlayerId = playerId,
                FinishPosition = finish,
                CommanderPlayed = commander,
                DeckColors = colors,
            });
        }
        _db.SaveChanges();
    }

    // ── Tests ─────────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetAnalyticsAsync_NoEvents_ReturnsEmptyCollections()
    {
        SeedStore(storeId: 1);

        var result = await _service.GetAnalyticsAsync(storeId: 1);

        Assert.Empty(result.EventTrends);
        Assert.Empty(result.TopCommanders);
        Assert.Empty(result.TopPlayers);
        Assert.Empty(result.ColorFrequency);
        Assert.Equal(0, result.FinishDistribution.First);
        Assert.Equal(0, result.FinishDistribution.Second);
    }

    [Fact]
    public async Task GetAnalyticsAsync_WithEvents_ReturnsCorrectEventTrends()
    {
        _db.Players.AddRange(MakePlayer(1), MakePlayer(2), MakePlayer(3), MakePlayer(4));
        _db.SaveChanges();
        SeedStore(storeId: 1);
        SeedEvent(storeId: 1, eventId: 1, date: new DateTime(2026, 1, 15));
        SeedEvent(storeId: 1, eventId: 2, date: new DateTime(2026, 1, 28));
        SeedEvent(storeId: 1, eventId: 3, date: new DateTime(2026, 3, 10));

        // Seed registrations to drive player count
        _db.EventRegistrations.AddRange(
            new EventRegistration { EventId = 1, PlayerId = 1 },
            new EventRegistration { EventId = 1, PlayerId = 2 },
            new EventRegistration { EventId = 2, PlayerId = 1 },
            new EventRegistration { EventId = 2, PlayerId = 2 },
            new EventRegistration { EventId = 2, PlayerId = 3 },
            new EventRegistration { EventId = 2, PlayerId = 4 },
            new EventRegistration { EventId = 3, PlayerId = 1 }
        );
        _db.SaveChanges();

        var result = await _service.GetAnalyticsAsync(storeId: 1);

        var jan = result.EventTrends.FirstOrDefault(t => t.Year == 2026 && t.Month == 1);
        var mar = result.EventTrends.FirstOrDefault(t => t.Year == 2026 && t.Month == 3);

        Assert.NotNull(jan);
        Assert.Equal(2, jan.EventCount);
        Assert.NotNull(mar);
        Assert.Equal(1, mar.EventCount);
    }

    [Fact]
    public async Task GetAnalyticsAsync_CalculatesCommanderWinRates()
    {
        _db.Players.AddRange(MakePlayer(1), MakePlayer(2), MakePlayer(3), MakePlayer(4));
        _db.SaveChanges();
        SeedStore(storeId: 1);
        SeedEvent(storeId: 1, eventId: 1, date: new DateTime(2026, 1, 15));
        SeedGameResults(eventId: 1, results: [
            (1, 1, "Atraxa, Praetors' Voice", "WUG"),
            (2, 2, "Kenrith, the Returned King", "WUBRG"),
            (3, 3, "Atraxa, Praetors' Voice", "WUG"),
            (4, 4, "Kenrith, the Returned King", "WUBRG"),
        ]);

        var result = await _service.GetAnalyticsAsync(storeId: 1);

        var atraxa = result.TopCommanders.FirstOrDefault(c => c.CommanderName == "Atraxa, Praetors' Voice");
        Assert.NotNull(atraxa);
        Assert.Equal(1, atraxa.Wins);
        Assert.Equal(2, atraxa.GamesPlayed);
        Assert.Equal(50.0, atraxa.WinPercent, precision: 1);
    }

    [Fact]
    public async Task GetAnalyticsAsync_CalculatesFinishDistribution()
    {
        _db.Players.AddRange(MakePlayer(1), MakePlayer(2), MakePlayer(3), MakePlayer(4));
        _db.SaveChanges();
        SeedStore(storeId: 1);
        SeedEvent(storeId: 1, eventId: 1, date: new DateTime(2026, 1, 15));
        SeedGameResults(eventId: 1, results: [
            (1, 1, null, null),
            (2, 2, null, null),
            (3, 3, null, null),
            (4, 4, null, null),
        ]);

        var result = await _service.GetAnalyticsAsync(storeId: 1);

        Assert.Equal(25.0, result.FinishDistribution.First, precision: 1);
        Assert.Equal(25.0, result.FinishDistribution.Second, precision: 1);
        Assert.Equal(25.0, result.FinishDistribution.Third, precision: 1);
        Assert.Equal(25.0, result.FinishDistribution.Fourth, precision: 1);
    }

    [Fact]
    public async Task GetAnalyticsAsync_OnlyIncludesEventsForRequestedStore()
    {
        _db.Players.AddRange(MakePlayer(1), MakePlayer(2), MakePlayer(3), MakePlayer(4));
        _db.SaveChanges();
        SeedStore(storeId: 1);
        SeedStore(storeId: 2);

        // Store 1 event
        SeedEvent(storeId: 1, eventId: 1, date: new DateTime(2026, 1, 15));
        SeedGameResults(eventId: 1, results: [
            (1, 1, "Atraxa", "WU"),
            (2, 2, "Kenrith", "WUBRG"),
        ]);

        // Store 2 event — should be excluded
        SeedEvent(storeId: 2, eventId: 2, date: new DateTime(2026, 1, 20));
        SeedGameResults(eventId: 2, results: [
            (3, 1, "Omnath", "RG"),
            (4, 2, "Atraxa", "WU"),
        ]);

        var result = await _service.GetAnalyticsAsync(storeId: 1);

        Assert.Equal(1, result.EventTrends.Sum(t => t.EventCount));
        // Omnath should NOT appear — it's from store 2
        Assert.DoesNotContain(result.TopCommanders, c => c.CommanderName == "Omnath");
    }
}
