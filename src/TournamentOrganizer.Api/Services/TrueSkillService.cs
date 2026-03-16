using TournamentOrganizer.Api.Models;
using TournamentOrganizer.Api.Repositories.Interfaces;
using TournamentOrganizer.Api.Services.Interfaces;

namespace TournamentOrganizer.Api.Services;

public class TrueSkillService : ITrueSkillService
{
    private readonly IPlayerRepository _playerRepo;
    private readonly IDiscordWebhookService _discordService;

    public TrueSkillService(IPlayerRepository playerRepo, IDiscordWebhookService discordService)
    {
        _playerRepo = playerRepo;
        _discordService = discordService;
    }

    public async Task UpdateRatingsAsync(Game game)
    {
        var results = game.Results.OrderBy(r => r.FinishPosition).ToList();
        if (results.Count < 2) return;

        var playerRatings = results
            .Select(r => (r.Player.Mu, r.Player.Sigma))
            .ToList();

        var finishPositions = results
            .Select(r => r.FinishPosition)
            .ToArray();

        var newRatings = TrueSkillCalculator.CalculateNewRatings(playerRatings, finishPositions);

        var playersToUpdate = new List<Player>();
        var newlyRanked = new List<(int PlayerId, int EventId)>();
        var eventId = game.Pod.Round.EventId;

        for (int i = 0; i < results.Count; i++)
        {
            var player = results[i].Player;
            player.Mu = newRatings[i].NewMu;
            player.Sigma = newRatings[i].NewSigma;
            if (player.PlacementGamesLeft > 0)
            {
                player.PlacementGamesLeft--;
                if (player.PlacementGamesLeft == 0)
                    newlyRanked.Add((player.Id, eventId));
            }
            playersToUpdate.Add(player);
        }

        await _playerRepo.UpdateRangeAsync(playersToUpdate);

        foreach (var (playerId, evtId) in newlyRanked)
            await _discordService.PostPlayerRankedAsync(playerId, evtId);
    }

    public async Task UpdateRatingsFromEventStandingsAsync(List<(int PlayerId, int Rank, int GamesPlayed)> rankings)
    {
        if (rankings.Count < 2) return;

        var players = await _playerRepo.GetByIdsAsync(rankings.Select(r => r.PlayerId));
        var ordered = rankings.OrderBy(r => r.Rank).ToList();

        var playerRatings = ordered
            .Select(r => { var p = players.First(pl => pl.Id == r.PlayerId); return (p.Mu, p.Sigma); })
            .ToList();
        var finishPositions = ordered.Select(r => r.Rank).ToArray();

        var newRatings = TrueSkillCalculator.CalculateNewRatings(playerRatings, finishPositions);

        var playersToUpdate = new List<Player>();
        for (int i = 0; i < ordered.Count; i++)
        {
            var player = players.First(p => p.Id == ordered[i].PlayerId);
            player.Mu = newRatings[i].NewMu;
            player.Sigma = newRatings[i].NewSigma;
            var games = ordered[i].GamesPlayed;
            player.PlacementGamesLeft = Math.Max(0, player.PlacementGamesLeft - games);
            playersToUpdate.Add(player);
        }

        await _playerRepo.UpdateRangeAsync(playersToUpdate);
    }
}
