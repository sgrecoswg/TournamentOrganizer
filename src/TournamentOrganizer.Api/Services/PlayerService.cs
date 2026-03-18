using TournamentOrganizer.Api.DTOs;
using TournamentOrganizer.Api.Models;
using TournamentOrganizer.Api.Repositories.Interfaces;
using TournamentOrganizer.Api.Services.Interfaces;

namespace TournamentOrganizer.Api.Services;

public class PlayerService : IPlayerService
{
    private readonly IPlayerRepository _playerRepo;
    private readonly IGameRepository _gameRepo;
    private readonly IBadgeService _badgeService;

    public PlayerService(IPlayerRepository playerRepo, IGameRepository gameRepo, IBadgeService badgeService)
    {
        _playerRepo = playerRepo;
        _gameRepo = gameRepo;
        _badgeService = badgeService;
    }

    public async Task<PlayerDto> RegisterAsync(CreatePlayerDto dto)
    {
        var existing = await _playerRepo.GetByEmailAsync(dto.Email);
        if (existing != null)
            throw new InvalidOperationException("A player with this email already exists.");

        var player = new Player
        {
            Name = dto.Name,
            Email = dto.Email
        };

        await _playerRepo.CreateAsync(player);
        return ToDto(player);
    }

    public async Task<PlayerDto?> UpdateAsync(int id, UpdatePlayerDto dto)
    {
        var player = await _playerRepo.GetByIdAsync(id);
        if (player == null) return null;

        player.Name = dto.Name;
        player.Email = dto.Email;
        player.IsActive = dto.IsActive;
        await _playerRepo.UpdateAsync(player);
        return ToDto(player);
    }

    public async Task<List<PlayerDto>> GetAllAsync()
    {
        var players = await _playerRepo.GetAllAsync();
        return players.Select(ToDto).ToList();
    }

    public async Task<PlayerProfileDto?> GetProfileAsync(int id)
    {
        var player = await _playerRepo.GetByIdAsync(id);
        if (player == null) return null;

        var results = await _gameRepo.GetPlayerResultsAsync(id);
        var registrations = await _playerRepo.GetPlayerEventRegistrationsAsync(id);
        var badges = await _badgeService.GetBadgesAsync(id);

        return new PlayerProfileDto(
            player.Id,
            player.Name,
            player.Email,
            player.Mu,
            player.Sigma,
            player.ConservativeScore,
            player.IsRanked,
            player.PlacementGamesLeft,
            player.IsActive,
            results.Select(r => new PlayerGameHistoryDto(
                r.GameId,
                r.FinishPosition,
                r.Eliminations,
                r.TurnsSurvived,
                r.CommanderPlayed,
                r.DeckColors,
                r.Conceded,
                r.Game.Pod.Round.EventId,
                r.Game.Pod.Round.Event.Name,
                r.Game.Pod.Round.Event.Date,
                r.Game.Pod.Round.RoundNumber,
                r.Game.Pod.PodNumber
            )).ToList(),
            registrations.Select(er => new PlayerEventRegistrationDto(
                er.EventId,
                er.Event.Name,
                er.Event.Date,
                er.DecklistUrl,
                er.Commanders,
                er.Event.StoreEvent?.Store.StoreName
            )).ToList(),
            player.AvatarUrl,
            badges
        );
    }

    public async Task<List<LeaderboardEntryDto>> GetLeaderboardAsync()
    {
        var players = await _playerRepo.GetLeaderboardAsync();
        return players.Select((p, i) => new LeaderboardEntryDto(
            i + 1,
            p.Id,
            p.Name,
            p.ConservativeScore,
            p.Mu,
            p.Sigma
        )).ToList();
    }

    public async Task<List<HeadToHeadEntryDto>?> GetHeadToHeadAsync(int playerId)
    {
        var player = await _playerRepo.GetByIdAsync(playerId);
        if (player == null) return null;

        // Each result belongs to a game; get all results for this player's games
        // so we can find co-participants (opponents) in the same game.
        var myResults = await _gameRepo.GetPlayerGamesWithOpponentsAsync(playerId);

        // Group by game, then for each opponent in that game determine win/loss
        var records = new Dictionary<int, (string Name, int Wins, int Losses)>();

        foreach (var myResult in myResults)
        {
            var opponents = myResult.Game.Results.Where(r => r.PlayerId != playerId);
            foreach (var opp in opponents)
            {
                bool iWin = myResult.FinishPosition < opp.FinishPosition;
                if (!records.ContainsKey(opp.PlayerId))
                    records[opp.PlayerId] = (opp.Player.Name, 0, 0);

                var (name, wins, losses) = records[opp.PlayerId];
                records[opp.PlayerId] = iWin ? (name, wins + 1, losses) : (name, wins, losses + 1);
            }
        }

        return records
            .Select(kvp => new HeadToHeadEntryDto(
                kvp.Key,
                kvp.Value.Name,
                kvp.Value.Wins,
                kvp.Value.Losses,
                kvp.Value.Wins + kvp.Value.Losses))
            .OrderByDescending(e => e.Games)
            .ToList();
    }

    public async Task<PlayerCommanderStatsDto?> GetCommanderStatsAsync(int playerId)
    {
        var player = await _playerRepo.GetByIdAsync(playerId);
        if (player == null) return null;

        var results = await _gameRepo.GetPlayerResultsAsync(playerId);

        var stats = results
            .Where(r => r.CommanderPlayed != null)
            .GroupBy(r => r.CommanderPlayed!)
            .Select(g =>
            {
                var gamesPlayed = g.Count();
                var wins = g.Count(r => r.FinishPosition == 1);
                var avgFinish = gamesPlayed > 0 ? g.Average(r => r.FinishPosition) : 0.0;
                return new CommanderStatDto(g.Key, gamesPlayed, wins, avgFinish);
            })
            .ToList();

        return new PlayerCommanderStatsDto(playerId, stats);
    }

    public async Task<Player?> GetByIdAsync(int id)
        => await _playerRepo.GetByIdAsync(id);

    public async Task<PlayerDto> UpdateAvatarUrlAsync(int playerId, string? avatarUrl)
    {
        var player = await _playerRepo.GetByIdAsync(playerId)
            ?? throw new KeyNotFoundException($"Player {playerId} not found.");
        player.AvatarUrl = avatarUrl;
        await _playerRepo.UpdateAsync(player);
        return ToDto(player);
    }

    public async Task<bool> IsPlayerAtStoreAsync(int playerId, int storeId)
    {
        var registrations = await _playerRepo.GetPlayerEventRegistrationsAsync(playerId);
        return registrations.Any(er => er.Event?.StoreEvent?.StoreId == storeId);
    }

    public async Task<bool> IsPlayerEmailAsync(int playerId, string? email)
    {
        if (email == null) return false;
        var player = await _playerRepo.GetByIdAsync(playerId);
        return player?.Email == email;
    }

    public async Task<RatingHistoryDto?> GetRatingHistoryAsync(int playerId)
    {
        var player = await _playerRepo.GetByIdAsync(playerId);
        if (player == null) return null;

        var myResults = await _gameRepo.GetPlayerGamesForRatingReplayAsync(playerId);

        double mu = 25.0, sigma = 25.0 / 3.0;
        var snapshots = new List<RatingSnapshotDto>();

        foreach (var myResult in myResults)
        {
            var allResults = myResult.Game.Results.OrderBy(r => r.FinishPosition).ToList();
            var ratings = allResults.Select(r =>
                r.PlayerId == playerId
                    ? (mu, sigma)
                    : (r.Player.Mu, r.Player.Sigma)
            ).ToList();
            var finishPositions = allResults.Select(r => r.FinishPosition).ToArray();

            var newRatings = TrueSkillCalculator.CalculateNewRatings(ratings, finishPositions);
            var myIndex = allResults.FindIndex(r => r.PlayerId == playerId);
            (mu, sigma) = (newRatings[myIndex].NewMu, newRatings[myIndex].NewSigma);

            var conservativeScore = mu - 3 * sigma;
            snapshots.Add(new RatingSnapshotDto(
                myResult.Game.Pod.Round.Event.Date,
                conservativeScore,
                myResult.Game.Pod.Round.Event.Name,
                myResult.Game.Pod.Round.RoundNumber));
        }

        return new RatingHistoryDto(playerId, snapshots);
    }

    private static PlayerDto ToDto(Player p) => new(
        p.Id, p.Name, p.Email, p.Mu, p.Sigma, p.ConservativeScore, p.IsRanked, p.PlacementGamesLeft, p.IsActive, p.AvatarUrl);
}
