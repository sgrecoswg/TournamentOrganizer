using TournamentOrganizer.Api.Models;

namespace TournamentOrganizer.Api.Repositories.Interfaces;

public interface IGameRepository
{
    Task<Game?> GetByIdAsync(int id);
    Task<Game?> GetWithResultsAsync(int id);
    Task<Game> CreateAsync(Game game);
    Task UpdateAsync(Game game);
    Task AddResultsAsync(IEnumerable<GameResult> results);
    Task DeleteResultsAsync(int gameId);
    Task<List<GameResult>> GetPlayerResultsAsync(int playerId);
    Task<List<GameResult>> GetPlayerGamesWithOpponentsAsync(int playerId);
    Task<List<int>> GetPreviousOpponentIdsAsync(int eventId, int playerId);
    Task<List<GameResult>> GetStoreGameResultsAsync(int storeId, DateTime? since);
}
