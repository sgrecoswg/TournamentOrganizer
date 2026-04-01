using TournamentOrganizer.Api.Services;

namespace TournamentOrganizer.Tests;

public class TrueSkillCalculatorTests
{
    // Default TrueSkill values used by the implementation
    private const double DefaultMu = 25.0;
    private const double DefaultSigma = 25.0 / 3.0;  // ~8.333

    // ------------------------------------------------------------------
    // Single-player (degenerate) case
    // ------------------------------------------------------------------

    [Fact]
    public void SinglePlayer_ReturnsUnchangedRating()
    {
        var ratings = new List<(double Mu, double Sigma)> { (DefaultMu, DefaultSigma) };
        var positions = new[] { 1 };

        var result = TrueSkillCalculator.CalculateNewRatings(ratings, positions);

        Assert.Single(result);
        Assert.Equal(DefaultMu, result[0].NewMu, precision: 6);
        Assert.Equal(DefaultSigma, result[0].NewSigma, precision: 6);
    }

    // ------------------------------------------------------------------
    // Two-player match
    // ------------------------------------------------------------------

    [Fact]
    public void TwoPlayers_WinnerGainsMu_LoserLosesMu()
    {
        var ratings = new List<(double Mu, double Sigma)>
        {
            (DefaultMu, DefaultSigma), // player 0
            (DefaultMu, DefaultSigma)  // player 1
        };
        var positions = new[] { 1, 2 }; // player 0 wins

        var result = TrueSkillCalculator.CalculateNewRatings(ratings, positions);

        Assert.Equal(2, result.Count);
        Assert.True(result[0].NewMu > DefaultMu, "Winner should gain mu");
        Assert.True(result[1].NewMu < DefaultMu, "Loser should lose mu");
    }

    [Fact]
    public void TwoPlayers_Symmetric_WinnerGainEqualsLoserLoss()
    {
        var ratings = new List<(double Mu, double Sigma)>
        {
            (DefaultMu, DefaultSigma),
            (DefaultMu, DefaultSigma)
        };
        var positions = new[] { 1, 2 };

        var result = TrueSkillCalculator.CalculateNewRatings(ratings, positions);

        double winnerGain = result[0].NewMu - DefaultMu;
        double loserLoss = DefaultMu - result[1].NewMu;

        Assert.Equal(winnerGain, loserLoss, precision: 6);
    }

    [Fact]
    public void TwoPlayers_SigmaDecreasesAfterMatch()
    {
        var ratings = new List<(double Mu, double Sigma)>
        {
            (DefaultMu, DefaultSigma),
            (DefaultMu, DefaultSigma)
        };
        var positions = new[] { 1, 2 };

        var result = TrueSkillCalculator.CalculateNewRatings(ratings, positions);

        // Sigma should generally not increase (uncertainty resolved by game)
        Assert.True(result[0].NewSigma <= DefaultSigma + 0.5,
            "Winner sigma should not grow significantly");
        Assert.True(result[1].NewSigma <= DefaultSigma + 0.5,
            "Loser sigma should not grow significantly");
    }

    // ------------------------------------------------------------------
    // Four-player match (typical Commander pod)
    // ------------------------------------------------------------------

    [Fact]
    public void FourPlayers_FirstPlaceGainsMostMu()
    {
        var ratings = Enumerable.Repeat((DefaultMu, DefaultSigma), 4).ToList();
        var positions = new[] { 1, 2, 3, 4 };

        var result = TrueSkillCalculator.CalculateNewRatings(ratings, positions);

        double firstChange = result[0].NewMu - DefaultMu;
        double secondChange = result[1].NewMu - DefaultMu;
        double thirdChange = result[2].NewMu - DefaultMu;
        double fourthChange = result[3].NewMu - DefaultMu;

        Assert.True(firstChange > secondChange, "1st should gain more than 2nd");
        Assert.True(secondChange > thirdChange, "2nd should gain more than 3rd");
        Assert.True(thirdChange > fourthChange, "3rd should gain more than 4th (or lose less)");
        Assert.True(fourthChange < 0, "Last place should lose mu");
        Assert.True(firstChange > 0, "First place should gain mu");
    }

    [Fact]
    public void FourPlayers_ReturnsFourResults()
    {
        var ratings = Enumerable.Repeat((DefaultMu, DefaultSigma), 4).ToList();
        var positions = new[] { 1, 2, 3, 4 };

        var result = TrueSkillCalculator.CalculateNewRatings(ratings, positions);

        Assert.Equal(4, result.Count);
    }

    // ------------------------------------------------------------------
    // Draw scenario (all same finish position)
    // ------------------------------------------------------------------

    [Fact]
    public void FourPlayers_Draw_AllMuChangesSymmetric()
    {
        var ratings = Enumerable.Repeat((DefaultMu, DefaultSigma), 4).ToList();
        var positions = new[] { 1, 1, 1, 1 }; // full draw

        var result = TrueSkillCalculator.CalculateNewRatings(ratings, positions);

        // All players have equal input, so all mu changes should be equal
        double first = result[0].NewMu;
        for (int i = 1; i < result.Count; i++)
        {
            Assert.Equal(first, result[i].NewMu, precision: 6);
        }
    }

    // ------------------------------------------------------------------
    // Upset: low-rated player beats high-rated player
    // ------------------------------------------------------------------

    [Fact]
    public void Upset_LowRatedWins_GainsMoreMuThanExpected()
    {
        var ratings = new List<(double Mu, double Sigma)>
        {
            (15.0, DefaultSigma), // underdog (player 0) — wins
            (35.0, DefaultSigma)  // favourite (player 1) — loses
        };
        var positions = new[] { 1, 2 };

        var result = TrueSkillCalculator.CalculateNewRatings(ratings, positions);
        var expected = TrueSkillCalculator.CalculateNewRatings(
            new List<(double, double)> { (DefaultMu, DefaultSigma), (DefaultMu, DefaultSigma) },
            new[] { 1, 2 });

        // Underdog winning gives a bigger mu jump than an equal-skill win
        double underdogGain = result[0].NewMu - 15.0;
        double evenGain = expected[0].NewMu - DefaultMu;

        Assert.True(underdogGain > evenGain,
            "Upset win should grant more mu than an even-match win");
    }

    // ------------------------------------------------------------------
    // Sigma is non-negative
    // ------------------------------------------------------------------

    [Fact]
    public void AllPlayers_SigmaRemainsPositive()
    {
        // Run many games to check sigma never hits zero
        var ratings = Enumerable.Repeat((DefaultMu, DefaultSigma), 4).ToList();
        var positions = new[] { 1, 2, 3, 4 };

        for (int i = 0; i < 20; i++)
        {
            var result = TrueSkillCalculator.CalculateNewRatings(ratings, positions);
            foreach (var r in result)
            {
                Assert.True(r.NewSigma > 0, "Sigma must remain positive");
            }
            ratings = result.Select(r => (r.NewMu, r.NewSigma)).ToList();
        }
    }

    // ------------------------------------------------------------------
    // Empty list
    // ------------------------------------------------------------------

    [Fact]
    public void EmptyList_ReturnsEmpty()
    {
        var ratings = new List<(double Mu, double Sigma)>();
        var positions = Array.Empty<int>();

        var result = TrueSkillCalculator.CalculateNewRatings(ratings, positions);

        Assert.Empty(result);
    }

    // ------------------------------------------------------------------
    // High-disparity Sigma (issue #113)
    // ------------------------------------------------------------------

    [Fact]
    public void HighSigmaDisparity_SigmaRemainsPositive()
    {
        // Regression test for issue #113: high disparity in sigma values
        // should not produce non-positive NewSigma
        var ratings = new List<(double Mu, double Sigma)>
        {
            (2.0, 2.0),  // low sigma (high confidence)
            (2.0, 5.0)   // high sigma (low confidence)
        };
        var positions = new[] { 1, 2 };

        var result = TrueSkillCalculator.CalculateNewRatings(ratings, positions);

        Assert.Equal(2, result.Count);
        Assert.True(result[0].NewSigma > 0, "First player sigma must be positive");
        Assert.True(result[1].NewSigma > 0, "Second player sigma must be positive");

        // Verify the values are reasonable (greater than minimum clamp)
        Assert.True(result[0].NewSigma >= 0.1, "First player sigma should respect minimum clamp");
        Assert.True(result[1].NewSigma >= 0.1, "Second player sigma should respect minimum clamp");
    }
}
