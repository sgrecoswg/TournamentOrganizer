using TournamentOrganizer.Api.Models;

namespace TournamentOrganizer.Api.Repositories.Interfaces;

public interface ITradeRepository
{
    Task<List<TradeEntry>> GetAllAsync();
    Task<List<TradeEntry>> GetByPlayerAsync(int playerId);
    Task<TradeEntry?> GetByIdAsync(int id);
    Task<TradeEntry> AddAsync(TradeEntry entry);
    Task<bool> DeleteAsync(int id);
    Task DeleteAllByPlayerAsync(int playerId);
    Task<List<TradeEntry>> GetByCardNamesAsync(IEnumerable<string> cardNames, int excludePlayerId);
}
