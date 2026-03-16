using TournamentOrganizer.Api.Models;

namespace TournamentOrganizer.Api.Repositories.Interfaces;

public interface IPlayerRepository
{
    Task<Player?> GetByIdAsync(int id);
    Task<Player?> GetByEmailAsync(string email);
    Task<List<Player>> GetLeaderboardAsync();
    Task<List<Player>> GetAllAsync();
    Task<Player> CreateAsync(Player player);
    Task UpdateAsync(Player player);
    Task UpdateRangeAsync(IEnumerable<Player> players);
    Task<List<Player>> GetByIdsAsync(IEnumerable<int> ids);
    Task<List<EventRegistration>> GetPlayerEventRegistrationsAsync(int playerId);
}
