using TournamentOrganizer.Api.Models;

namespace TournamentOrganizer.Api.Services.Interfaces;

public interface ITrueSkillService
{
    Task UpdateRatingsAsync(Game game);
    Task UpdateRatingsFromEventStandingsAsync(List<(int PlayerId, int Rank, int GamesPlayed)> rankings);
}
