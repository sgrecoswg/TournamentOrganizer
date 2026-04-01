using TournamentOrganizer.Api.Models;
using TournamentOrganizer.Api.Services;

namespace TournamentOrganizer.Tests;

/// <summary>
/// Tests for PodService.GenerateRound1Pods to ensure all pods are 3-5 players
/// and oversized single pods are properly split.
/// </summary>
public class PodServiceTests
{
    private static List<Player> CreatePlayers(int count)
    {
        return Enumerable.Range(1, count)
            .Select(i => new Player
            {
                Id = i,
                Name = $"Player{i}",
                Email = $"p{i}@test.com",
                Mu = 25.0 + i,
                Sigma = 8.333
            })
            .ToList();
    }

    private void AssertPodsValid(List<List<Player>> pods, int expectedTotalPlayers)
    {
        Assert.NotNull(pods);
        Assert.NotEmpty(pods);

        // Each pod must have 3-5 players
        var invalidPods = pods.Where(p => p.Count < 3 || p.Count > 5).ToList();
        if (invalidPods.Any())
        {
            Assert.Fail(
                $"Found {invalidPods.Count} invalid pods: {string.Join(", ", invalidPods.Select(p => p.Count))} players");
        }

        // Total must equal input
        int total = pods.Sum(p => p.Count);
        Assert.Equal(expectedTotalPlayers, total);
    }

    [Fact]
    public void GenerateRound1Pods_WithSixPlayers_ReturnsValidPods()
    {
        var players = CreatePlayers(6);
        var service = new PodService();
        var pods = service.GenerateRound1Pods(players);
        AssertPodsValid(pods, 6);
    }

    [Fact]
    public void GenerateRound1Pods_WithSevenPlayers_ReturnsValidPods()
    {
        var players = CreatePlayers(7);
        var service = new PodService();
        var pods = service.GenerateRound1Pods(players);
        AssertPodsValid(pods, 7);
    }

    [Fact]
    public void GenerateRound1Pods_WithEightPlayers_ReturnsValidPods()
    {
        var players = CreatePlayers(8);
        var service = new PodService();
        var pods = service.GenerateRound1Pods(players);
        AssertPodsValid(pods, 8);
    }

    [Fact]
    public void GenerateRound1Pods_WithNinePlayersSinglePod_SplitsOversizedPod()
    {
        // With 9 players, we get podCount = Ceiling(9/4) = 3
        // This tests that the code correctly handles the split
        var players = CreatePlayers(9);
        var service = new PodService();
        var pods = service.GenerateRound1Pods(players);
        AssertPodsValid(pods, 9);
    }

    [Theory]
    [InlineData(3)]
    [InlineData(4)]
    [InlineData(5)]
    [InlineData(6)]
    [InlineData(7)]
    [InlineData(8)]
    [InlineData(9)]
    [InlineData(10)]
    [InlineData(11)]
    [InlineData(12)]
    [InlineData(13)]
    [InlineData(14)]
    [InlineData(15)]
    [InlineData(16)]
    [InlineData(20)]
    public void GenerateRound1Pods_AllValidSizes_ReturnsValidPods(int playerCount)
    {
        var players = CreatePlayers(playerCount);
        var service = new PodService();
        var pods = service.GenerateRound1Pods(players);
        AssertPodsValid(pods, playerCount);
    }
}
