using System.Net;
using System.Text;
using System.Text.Json;
using FsCheck;
using FsCheck.Xunit;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TournamentOrganizer.Api.Data;
using TournamentOrganizer.Api.Models;
using TournamentOrganizer.Api.Services;

namespace TournamentOrganizer.Tests;

/// <summary>
/// Property-based fuzz tests using FsCheck 3.x.
/// [Property] methods receive randomly-generated typed arguments from FsCheck.
/// Each property runs 100 random inputs by default and reports the falsifying input on failure.
/// </summary>
public class FuzzTests
{
    // -----------------------------------------------------------------------
    // 1. TrueSkill invariants
    // -----------------------------------------------------------------------

    [Property(DisplayName = "TrueSkill: never throws for 2 players with valid finish positions")]
    public bool TrueSkill_NeverThrows_TwoPlayers(
        PositiveInt mu1, PositiveInt sigma1,
        PositiveInt mu2, PositiveInt sigma2)
    {
        var ratings = new List<(double Mu, double Sigma)>
        {
            ((double)(mu1.Get % 50 + 1), (double)(sigma1.Get % 15 + 1)),
            ((double)(mu2.Get % 50 + 1), (double)(sigma2.Get % 15 + 1)),
        };
        var positions = new[] { 1, 2 };

        try
        {
            TrueSkillCalculator.CalculateNewRatings(ratings, positions);
            return true;
        }
        catch
        {
            return false;
        }
    }

    [Property(DisplayName = "TrueSkill: never throws for 3 players with valid finish positions")]
    public bool TrueSkill_NeverThrows_ThreePlayers(
        PositiveInt mu1, PositiveInt mu2, PositiveInt mu3,
        PositiveInt s1, PositiveInt s2, PositiveInt s3)
    {
        var ratings = new List<(double Mu, double Sigma)>
        {
            ((double)(mu1.Get % 50 + 1), (double)(s1.Get % 15 + 1)),
            ((double)(mu2.Get % 50 + 1), (double)(s2.Get % 15 + 1)),
            ((double)(mu3.Get % 50 + 1), (double)(s3.Get % 15 + 1)),
        };
        var positions = new[] { 1, 2, 3 };

        try
        {
            TrueSkillCalculator.CalculateNewRatings(ratings, positions);
            return true;
        }
        catch
        {
            return false;
        }
    }

    [Property(DisplayName = "TrueSkill: winner Mu >= all loser Mus after equal-rated 2-player game")]
    public bool TrueSkill_WinnerMuGeLoserMu(PositiveInt mu, PositiveInt sigma)
    {
        double m = (double)(mu.Get % 50 + 1);
        double s = (double)(sigma.Get % 15 + 1);
        var ratings = new List<(double Mu, double Sigma)> { (m, s), (m, s) };
        var positions = new[] { 1, 2 };

        List<(double NewMu, double NewSigma)> results;
        try { results = TrueSkillCalculator.CalculateNewRatings(ratings, positions); }
        catch { return true; } // exceptions covered by NeverThrows

        return results[0].NewMu >= results[1].NewMu;
    }

    [Property(DisplayName = "TrueSkill: Mu is finite, Sigma is positive finite")]
    public bool TrueSkill_OutputsPositiveFinite(
        PositiveInt mu1, PositiveInt sigma1,
        PositiveInt mu2, PositiveInt sigma2)
    {
        var ratings = new List<(double Mu, double Sigma)>
        {
            ((double)(mu1.Get % 50 + 1), (double)(sigma1.Get % 15 + 1)),
            ((double)(mu2.Get % 50 + 1), (double)(sigma2.Get % 15 + 1)),
        };
        var positions = new[] { 1, 2 };

        List<(double NewMu, double NewSigma)> results;
        try { results = TrueSkillCalculator.CalculateNewRatings(ratings, positions); }
        catch { return true; }

        return results.All(r =>
            double.IsFinite(r.NewMu) &&
            double.IsFinite(r.NewSigma) && r.NewSigma > 0);
    }

    // -----------------------------------------------------------------------
    // 2. Scoring invariants
    // -----------------------------------------------------------------------

    [Property(DisplayName = "Scoring: ScoreBased always returns 1-4, never negative")]
    public bool Scoring_ScoreBased_InRange(PositiveInt rawPos, PositiveInt rawSize)
    {
        int podSize = rawSize.Get % 3 + 3; // 3, 4, or 5
        int position = rawPos.Get % podSize + 1; // 1..podSize

        int points = EventService.CalculatePoints(
            PointSystem.ScoreBased, position, isDraw: false, seatOrder: 1, podSize: podSize);

        return points >= 1 && points <= 4;
    }

    [Property(DisplayName = "Scoring: WinBased winner=5, non-winner=0")]
    public bool Scoring_WinBased_Correct(PositiveInt rawPos, PositiveInt rawSize)
    {
        int podSize = rawSize.Get % 3 + 3;
        int position = rawPos.Get % podSize + 1;

        int points = EventService.CalculatePoints(
            PointSystem.WinBased, position, isDraw: false, seatOrder: 1, podSize: podSize);

        return position == 1 ? points == 5 : points == 0;
    }

    [Property(DisplayName = "Scoring: no point system returns negative points for any input")]
    public bool Scoring_NeverNegative(
        PositiveInt rawSystem, PositiveInt rawPos, PositiveInt rawSize, bool isDraw, PositiveInt rawSeat)
    {
        var systems = new[] {
            PointSystem.ScoreBased, PointSystem.WinBased,
            PointSystem.FiveOneZero, PointSystem.SeatBased
        };
        var system = systems[rawSystem.Get % systems.Length];
        int podSize = rawSize.Get % 3 + 3;
        int position = rawPos.Get % podSize + 1;
        int seatOrder = rawSeat.Get % podSize + 1;

        int points = EventService.CalculatePoints(system, position, isDraw, seatOrder, podSize);
        return points >= 0;
    }

    // -----------------------------------------------------------------------
    // 3. Pod formation invariants
    // -----------------------------------------------------------------------

    [Property(DisplayName = "Pod formation: all pods 3-5 players, total equals input")]
    public bool PodFormation_ValidSizesAndTotal(PositiveInt rawCount)
    {
        int playerCount = rawCount.Get % 18 + 3; // 3..20

        var players = Enumerable.Range(1, playerCount)
            .Select(i => new Player
            {
                Id = i,
                Name = $"Player{i}",
                Email = $"p{i}@test.com",
                Mu = 25.0,
                Sigma = 8.333
            })
            .ToList();

        var service = new PodService();
        List<List<Player>> pods;
        try { pods = service.GenerateRound1Pods(players); }
        catch { return false; }

        int total = pods.Sum(p => p.Count);
        bool allValidSize = pods.All(p => p.Count >= 3 && p.Count <= 5);

        return total == playerCount && allValidSize;
    }

    // -----------------------------------------------------------------------
    // 4. HTTP layer — POST /api/players never returns 500
    // -----------------------------------------------------------------------

    public static IEnumerable<object[]> PlayerPayloads =>
        new List<object[]>
        {
            new object[] { "", "" },
            new object[] { " ", " " },
            new object[] { "\t", "\n" },
            new object[] { "Normal Player", "valid@test.com" },
            new object[] { "' OR '1'='1", "sql@test.com" },
            new object[] { "<script>alert(1)</script>", "xss@test.com" },
            new object[] { "javascript:alert(1)", "js@test.com" },
            new object[] { "../../../etc/passwd", "path@test.com" },
            new object[] { "{{7*7}}", "template@test.com" },
            new object[] { "${7*7}", "el@test.com" },
            new object[] { new string('a', 10_001), "long@test.com" },
            new object[] { "\u0000", "null@test.com" },
            new object[] { "\uFFFD\u202E", "unicode@test.com" },
            new object[] { "%s%s%s%s", "fmt@test.com" },
            new object[] { "😀😀😀😀😀", "emoji@test.com" },
        };

    [Theory(DisplayName = "HTTP POST /api/players: never returns 500")]
    [MemberData(nameof(PlayerPayloads))]
    public async Task HttpPostPlayer_NeverReturns500(string name, string email)
    {
        using var factory = BuildFactory();
        var client = factory.CreateClient();

        var body = JsonSerializer.Serialize(new { name, email });
        var content = new StringContent(body, Encoding.UTF8, "application/json");

        var response = await client.PostAsync("/api/players", content);

        Assert.NotEqual(HttpStatusCode.InternalServerError, response.StatusCode);

        // 401/403 responses have empty bodies by default — only validate JSON for business responses.
        if (response.StatusCode != HttpStatusCode.Unauthorized &&
            response.StatusCode != HttpStatusCode.Forbidden)
        {
            var responseBody = await response.Content.ReadAsStringAsync();
            var exception = Record.Exception(() => JsonDocument.Parse(responseBody));
            Assert.Null(exception);
        }
    }

    // -----------------------------------------------------------------------
    // 5. HTTP layer — POST /api/events never returns 500
    // -----------------------------------------------------------------------

    public static IEnumerable<object[]> EventPayloads =>
        new List<object[]>
        {
            new object[] { "", "2026-01-01T00:00:00" },
            new object[] { " ", "not-a-date" },
            new object[] { "Normal Event", "" },
            new object[] { "' OR '1'='1", "2026-13-01" },
            new object[] { "<script>alert(1)</script>", "2999-12-31T23:59:59" },
            new object[] { new string('a', 10_001), "2026-01-01T00:00:00" },
            new object[] { "{{7*7}}", "-1" },
            new object[] { "../../../", "null" },
            new object[] { "\u0000", "0001-01-01T00:00:00" },
            new object[] { "Normal Event", "2026-01-01T00:00:00" },
        };

    [Theory(DisplayName = "HTTP POST /api/events: never returns 500")]
    [MemberData(nameof(EventPayloads))]
    public async Task HttpPostEvent_NeverReturns500(string name, string date)
    {
        using var factory = BuildFactory();
        var client = factory.CreateClient();

        var body = $"{{\"name\":{JsonSerializer.Serialize(name)},\"date\":{JsonSerializer.Serialize(date)},\"storeId\":1}}";
        var content = new StringContent(body, Encoding.UTF8, "application/json");

        var response = await client.PostAsync("/api/events", content);

        var status = (int)response.StatusCode;
        Assert.True(
            status is 200 or 201 or 400 or 401 or 403 or 404 or 409 or 422,
            $"Unexpected status {status} for name='{name[..Math.Min(30, name.Length)]}' date='{date}'");
    }

    // -----------------------------------------------------------------------
    // 6. HTTP layer — structural body mutations never return 500
    // -----------------------------------------------------------------------

    public static IEnumerable<object[]> StructuralBodies =>
        new List<object[]>
        {
            new object[] { "POST", "/api/players", "{}" },
            new object[] { "POST", "/api/players", "null" },
            new object[] { "POST", "/api/players", "[]" },
            new object[] { "POST", "/api/players", "\"string-instead-of-object\"" },
            new object[] { "POST", "/api/players", "{\"name\":\"x\",\"email\":\"x@x.com\"," + string.Join(",", Enumerable.Range(0, 50).Select(i => $"\"extra{i}\":\"val\"")) + "}" },
        };

    [Theory(DisplayName = "HTTP structural mutations: never return 500")]
    [MemberData(nameof(StructuralBodies))]
    public async Task HttpStructural_NeverReturns500(string method, string path, string body)
    {
        using var factory = BuildFactory();
        var client = factory.CreateClient();

        var content = new StringContent(body, Encoding.UTF8, "application/json");
        var response = method == "POST"
            ? await client.PostAsync(path, content)
            : await client.PutAsync(path, content);

        Assert.NotEqual(HttpStatusCode.InternalServerError, response.StatusCode);
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    private static WebApplicationFactory<Program> BuildFactory() =>
        new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                var desc = services.SingleOrDefault(
                    d => d.ServiceType == typeof(DbContextOptions<AppDbContext>));
                if (desc != null) services.Remove(desc);

                services.AddDbContext<AppDbContext>(opts =>
                    opts.UseInMemoryDatabase($"FuzzDb_{Guid.NewGuid()}"));
            });
        });
}
