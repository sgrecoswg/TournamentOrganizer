using TournamentOrganizer.Api.Models;

namespace TournamentOrganizer.Api.Services.Interfaces;

public interface IPodService
{
    List<List<Player>> GenerateRound1Pods(List<Player> players);
    List<List<Player>> GenerateNextRoundPods(Round previousRound, List<Player> players);
}
