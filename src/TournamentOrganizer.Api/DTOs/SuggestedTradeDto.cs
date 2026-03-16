namespace TournamentOrganizer.Api.DTOs;

public record TradeLegDto(
    int FromPlayerId,
    string FromPlayerName,
    int ToPlayerId,
    string ToPlayerName,
    string CardName,
    int Quantity,
    decimal? UsdPrice
);

public record SuggestedTradeDto(
    string Type,
    List<int> ParticipantIds,
    List<string> ParticipantNames,
    List<TradeLegDto> Legs
);

public record TradeCardDemandDto(
    string CardName,
    int WishlistCount,
    int TotalPlayers,
    double DemandPercent,
    List<string> InterestedPlayerNames
);
