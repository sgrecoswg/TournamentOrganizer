namespace TournamentOrganizer.Api.DTOs;

public record GameResultSubmitDto(
    int PlayerId,
    int FinishPosition,
    int Eliminations = 0,
    int TurnsSurvived = 0,
    string? CommanderPlayed = null,
    string? DeckColors = null,
    bool Conceded = false
);

public record RoundDto(
    int RoundId,
    int RoundNumber,
    List<PodDto> Pods
);

public record PodDto(
    int PodId,
    int PodNumber,
    int? FinishGroup,
    int GameId,
    List<PodPlayerDto> Players,
    string GameStatus,
    int? WinnerPlayerId
);

public record PodPlayerDto(int PlayerId, string Name, double ConservativeScore, int SeatOrder);
