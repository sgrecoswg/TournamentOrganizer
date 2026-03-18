namespace TournamentOrganizer.Api.DTOs;

public record PlayerBadgeDto(string BadgeKey, string DisplayName, DateTime AwardedAt, int? EventId);

public record CreatePlayerDto(string Name, string Email);

public record UpdatePlayerDto(string Name, string Email, bool IsActive);

public record PlayerDto(int Id, string Name, string Email, double Mu, double Sigma, double ConservativeScore, bool IsRanked, int PlacementGamesLeft, bool IsActive, string? AvatarUrl = null);

public record LeaderboardEntryDto(int Rank, int PlayerId, string Name, double ConservativeScore, double Mu, double Sigma);

public record PlayerProfileDto(
    int Id,
    string Name,
    string Email,
    double Mu,
    double Sigma,
    double ConservativeScore,
    bool IsRanked,
    int PlacementGamesLeft,
    bool IsActive,
    List<PlayerGameHistoryDto> GameHistory,
    List<PlayerEventRegistrationDto> EventRegistrations,
    string? AvatarUrl = null,
    List<PlayerBadgeDto>? Badges = null
);

public record PlayerGameHistoryDto(
    int GameId,
    int FinishPosition,
    int Eliminations,
    int TurnsSurvived,
    string? CommanderPlayed,
    string? DeckColors,
    bool Conceded,
    int EventId,
    string EventName,
    DateTime EventDate,
    int RoundNumber,
    int PodNumber
);

public record PlayerEventRegistrationDto(
    int EventId,
    string EventName,
    DateTime EventDate,
    string? DecklistUrl,
    string? Commanders,
    string? StoreName
);

public record CommanderStatDto(
    string CommanderName,
    int GamesPlayed,
    int Wins,
    double AvgFinish
);

public record PlayerCommanderStatsDto(
    int PlayerId,
    List<CommanderStatDto> Commanders
);

public record HeadToHeadEntryDto(
    int OpponentId,
    string OpponentName,
    int Wins,
    int Losses,
    int Games
);

public record RatingSnapshotDto(DateTime Date, double ConservativeScore, string EventName, int RoundNumber);

public record RatingHistoryDto(int PlayerId, List<RatingSnapshotDto> History);
