namespace TournamentOrganizer.Api.Services;

/// <summary>
/// Custom TrueSkill implementation for free-for-all (multiplayer) ranked games.
/// Based on the TrueSkill algorithm by Microsoft Research.
/// </summary>
public static class TrueSkillCalculator
{
    private const double DefaultBeta = 25.0 / 6.0;       // skill chain length (half of sigma)
    private const double DefaultTau = 25.0 / 300.0;       // dynamics factor (additive uncertainty per game)
    private const double DefaultDrawProbability = 0.0;

    public static List<(double NewMu, double NewSigma)> CalculateNewRatings(
        List<(double Mu, double Sigma)> playerRatings,
        int[] finishPositions)
    {
        int n = playerRatings.Count;
        if (n < 2)
            return playerRatings.Select(r => (r.Mu, r.Sigma)).ToList();

        double beta = DefaultBeta;
        double tau = DefaultTau;
        double betaSq = beta * beta;

        // Add dynamics factor (tau) to each player's variance
        var sigmas = playerRatings.Select(r => Math.Sqrt(r.Sigma * r.Sigma + tau * tau)).ToArray();
        var mus = playerRatings.Select(r => r.Mu).ToArray();

        var newMus = new double[n];
        var newSigmas = new double[n];

        // For each pair of players, compute pairwise updates based on finish order
        var muDeltas = new double[n];
        var sigmaFactors = new double[n];

        for (int i = 0; i < n; i++)
        {
            sigmaFactors[i] = 1.0;
        }

        for (int i = 0; i < n; i++)
        {
            for (int j = 0; j < n; j++)
            {
                if (i == j) continue;

                double cSq = sigmas[i] * sigmas[i] + sigmas[j] * sigmas[j] + 2 * betaSq;
                double c = Math.Sqrt(cSq);

                double muDiff = mus[i] - mus[j];

                // Determine if i beat j, lost to j, or drew
                int rankI = finishPositions[i];
                int rankJ = finishPositions[j];

                double v, w;
                if (rankI < rankJ)
                {
                    // i beat j (lower rank = better)
                    v = VExceedsMargin(muDiff / c, 0);
                    w = WExceedsMargin(muDiff / c, 0);
                }
                else if (rankI > rankJ)
                {
                    // i lost to j
                    v = -VExceedsMargin(-(muDiff / c), 0);
                    w = WExceedsMargin(-(muDiff / c), 0);
                }
                else
                {
                    // Draw (same rank)
                    v = VWithinMargin(muDiff / c, 0);
                    w = WWithinMargin(muDiff / c, 0);
                }

                double sigmaISqOverC = (sigmas[i] * sigmas[i]) / c;

                muDeltas[i] += sigmaISqOverC * v;
                sigmaFactors[i] *= (1 - (sigmas[i] * sigmas[i]) / cSq * w);
            }
        }

        // Scale updates by 1/(n-1) since we sum over all opponents
        for (int i = 0; i < n; i++)
        {
            double scale = 1.0 / (n - 1);
            newMus[i] = mus[i] + scale * muDeltas[i];

            double newSigmaSq = sigmas[i] * sigmas[i] * Math.Max(sigmaFactors[i], 0.0001);
            newSigmas[i] = Math.Sqrt(newSigmaSq);

            // Ensure sigma doesn't go below a minimum (prevents non-positive ConservativeScore)
            newSigmas[i] = Math.Max(newSigmas[i], 0.1);
        }

        return Enumerable.Range(0, n)
            .Select(i => (newMus[i], newSigmas[i]))
            .ToList();
    }

    // Gaussian PDF
    private static double NormPdf(double x)
    {
        return Math.Exp(-0.5 * x * x) / Math.Sqrt(2 * Math.PI);
    }

    // Gaussian CDF (approximation)
    private static double NormCdf(double x)
    {
        return 0.5 * (1 + Erf(x / Math.Sqrt(2)));
    }

    // Error function approximation (Abramowitz and Stegun)
    private static double Erf(double x)
    {
        double sign = x >= 0 ? 1.0 : -1.0;
        x = Math.Abs(x);

        const double a1 = 0.254829592;
        const double a2 = -0.284496736;
        const double a3 = 1.421413741;
        const double a4 = -1.453152027;
        const double a5 = 1.061405429;
        const double p = 0.3275911;

        double t = 1.0 / (1.0 + p * x);
        double y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.Exp(-x * x);
        return sign * y;
    }

    // V function: expected additive update when player exceeds margin
    private static double VExceedsMargin(double perfDiff, double drawMargin)
    {
        double denom = NormCdf(perfDiff - drawMargin);
        if (denom < 1e-10) return -perfDiff + drawMargin;
        return NormPdf(perfDiff - drawMargin) / denom;
    }

    // W function: expected multiplicative update when player exceeds margin
    private static double WExceedsMargin(double perfDiff, double drawMargin)
    {
        double v = VExceedsMargin(perfDiff, drawMargin);
        return v * (v + perfDiff - drawMargin);
    }

    // V function for draws
    private static double VWithinMargin(double perfDiff, double drawMargin)
    {
        double abs = Math.Abs(perfDiff);
        double numer = NormPdf(-drawMargin - abs) - NormPdf(drawMargin - abs);
        double denom = NormCdf(drawMargin - abs) - NormCdf(-drawMargin - abs);
        if (Math.Abs(denom) < 1e-10) return 0;
        double sign = perfDiff >= 0 ? 1.0 : -1.0;
        return sign * numer / denom;
    }

    // W function for draws
    private static double WWithinMargin(double perfDiff, double drawMargin)
    {
        double abs = Math.Abs(perfDiff);
        double v = VWithinMargin(perfDiff, drawMargin);
        double num1 = (drawMargin - abs) * NormPdf(drawMargin - abs);
        double num2 = (-drawMargin - abs) * NormPdf(-drawMargin - abs);
        double denom = NormCdf(drawMargin - abs) - NormCdf(-drawMargin - abs);
        if (Math.Abs(denom) < 1e-10) return 1.0;
        return v * v + (num1 - num2) / denom;
    }
}
