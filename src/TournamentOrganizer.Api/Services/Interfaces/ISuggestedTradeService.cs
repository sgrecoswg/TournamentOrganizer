using TournamentOrganizer.Api.DTOs;

namespace TournamentOrganizer.Api.Services.Interfaces;

public interface ISuggestedTradeService
{
    Task<List<SuggestedTradeDto>> GetSuggestionsAsync(int playerId);
    Task<List<TradeCardDemandDto>> GetDemandAsync(int playerId);
}
