namespace TournamentOrganizer.Api.DTOs;

public record StandingsEntryDto(
    int Rank,
    int PlayerId,
    string PlayerName,
    int TotalPoints,
    double Tiebreaker,
    List<int> FinishPositions,
    List<string> GameResults
);
