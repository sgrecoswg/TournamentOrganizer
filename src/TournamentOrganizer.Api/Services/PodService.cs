using TournamentOrganizer.Api.Models;
using TournamentOrganizer.Api.Services.Interfaces;

namespace TournamentOrganizer.Api.Services;

public class PodService : IPodService
{
    public List<List<Player>> GenerateRound1Pods(List<Player> players)
    {
        // Sort by conservative score descending for snake draft
        var sorted = players.OrderByDescending(p => p.ConservativeScore).ToList();
        int podCount = Math.Max(1, (int)Math.Ceiling(sorted.Count / 4.0));

        var pods = Enumerable.Range(0, podCount).Select(_ => new List<Player>()).ToList();

        bool forward = true;
        int podIndex = 0;

        foreach (var player in sorted)
        {
            pods[podIndex].Add(player);

            if (forward)
            {
                podIndex++;
                if (podIndex >= podCount)
                {
                    podIndex = podCount - 1;
                    forward = false;
                }
            }
            else
            {
                podIndex--;
                if (podIndex < 0)
                {
                    podIndex = 0;
                    forward = true;
                }
            }
        }

        // Handle edge case: redistribute if any pod has < 3 or > 5 players
        return RebalancePods(pods);
    }

    public List<List<Player>> GenerateNextRoundPods(Round previousRound, List<Player> players)
    {
        // Group players by their finish position from the previous round
        var resultsByPlayer = previousRound.Pods
            .Where(p => p.Game?.Status == GameStatus.Completed)
            .SelectMany(p => p.Game!.Results)
            .ToDictionary(r => r.PlayerId, r => r.FinishPosition);

        var groups = players
            .GroupBy(p => resultsByPlayer.GetValueOrDefault(p.Id, 4))
            .OrderBy(g => g.Key)
            .ToList();

        var allPods = new List<List<Player>>();

        var overflow = new List<Player>();

        foreach (var group in groups)
        {
            var groupPlayers = overflow.Concat(group).OrderByDescending(p => p.ConservativeScore).ToList();
            overflow.Clear();

            if (groupPlayers.Count < 3)
            {
                // Too few — push to next group
                overflow.AddRange(groupPlayers);
                continue;
            }

            int podCount = groupPlayers.Count / 4;
            if (podCount == 0) podCount = 1;

            var pods = Enumerable.Range(0, podCount).Select(_ => new List<Player>()).ToList();

            for (int i = 0; i < groupPlayers.Count; i++)
            {
                pods[i % podCount].Add(groupPlayers[i]);
            }

            allPods.AddRange(RebalancePods(pods));
        }

        // Handle any remaining overflow
        if (overflow.Count > 0)
        {
            if (allPods.Count > 0)
            {
                // Distribute overflow into last pods
                foreach (var player in overflow)
                {
                    var smallestPod = allPods.OrderBy(p => p.Count).First();
                    if (smallestPod.Count < 5)
                        smallestPod.Add(player);
                    else
                        allPods.Add(new List<Player> { player });
                }
            }
            else
            {
                allPods.Add(overflow);
            }
        }

        // Final pass: balance size-3/size-5 pod pairs into size-4 pods
        var podsWith3 = allPods.Where(p => p.Count == 3).ToList();
        var podsWith5 = allPods.Where(p => p.Count == 5).ToList();
        int pairs = Math.Min(podsWith3.Count, podsWith5.Count);
        for (int i = 0; i < pairs; i++)
        {
            var player = podsWith5[i].Last();
            podsWith5[i].RemoveAt(podsWith5[i].Count - 1);
            podsWith3[i].Add(player);
        }

        return allPods;
    }

    private static List<List<Player>> RebalancePods(List<List<Player>> pods)
    {
        // Remove empty pods
        pods = pods.Where(p => p.Count > 0).ToList();

        // Handle single oversized pod: split if > 5 players
        if (pods.Count == 1 && pods[0].Count > 5)
        {
            var singlePod = pods[0];
            var newPods = new List<List<Player>>();

            // For oversized single pod, split into valid sizes (3-5 players each)
            // Strategy: fill pods with 4 players first, then handle remainder
            int remaining = singlePod.Count;
            int idx = 0;

            while (remaining > 5)
            {
                // Take 4 players
                newPods.Add(new List<Player>(singlePod.Skip(idx).Take(4)));
                idx += 4;
                remaining -= 4;
            }

            // Remaining players (3-5) go into final pod
            if (remaining > 0)
            {
                newPods.Add(new List<Player>(singlePod.Skip(idx)));
            }

            return newPods;
        }

        if (pods.Count <= 1) return pods;

        // If any pod has fewer than 3 players, merge into adjacent pods
        var result = new List<List<Player>>();
        var stragglers = new List<Player>();

        foreach (var pod in pods)
        {
            if (pod.Count < 3)
                stragglers.AddRange(pod);
            else
                result.Add(pod);
        }

        // Distribute stragglers into existing pods (max 5 per pod)
        foreach (var player in stragglers)
        {
            var target = result.Where(p => p.Count < 5).OrderBy(p => p.Count).FirstOrDefault();
            if (target != null)
                target.Add(player);
            else
                result.Add(new List<Player> { player });
        }

        return result;
    }
}
