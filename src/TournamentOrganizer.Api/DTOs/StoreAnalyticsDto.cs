namespace TournamentOrganizer.Api.DTOs;

public record StoreAnalyticsDto(
    List<EventTrendDto>       EventTrends,
    List<CommanderWinRateDto> TopCommanders,
    List<StorePlayerStatsDto> TopPlayers,
    FinishDistributionDto     FinishDistribution,
    List<ColorFrequencyDto>   ColorFrequency
);

public record EventTrendDto(int Year, int Month, int EventCount, double AvgPlayerCount);
public record CommanderWinRateDto(string CommanderName, int Wins, int GamesPlayed, double WinPercent);
public record StorePlayerStatsDto(int PlayerId, string PlayerName, int TotalPoints, int EventsPlayed);
public record FinishDistributionDto(double First, double Second, double Third, double Fourth);
public record ColorFrequencyDto(string ColorCode, int Count);
