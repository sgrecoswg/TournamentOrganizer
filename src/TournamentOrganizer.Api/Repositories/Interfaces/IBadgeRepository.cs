using TournamentOrganizer.Api.Models;

namespace TournamentOrganizer.Api.Repositories.Interfaces;

public interface IBadgeRepository
{
    Task<List<PlayerBadge>> GetByPlayerIdAsync(int playerId);
    Task<bool> ExistsAsync(int playerId, string badgeKey);
    Task AddAsync(PlayerBadge badge);
    Task<List<PlayerBadge>> GetEventWinsForPlayerAsync(int playerId, int eventId);
    Task<int> GetEventCountForPlayerAsync(int playerId);
    Task<int> GetGameCountForPlayerAsync(int playerId);
}
