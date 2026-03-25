using TournamentOrganizer.Api.Models;

namespace TournamentOrganizer.Api.Repositories.Interfaces;

public interface INotificationRepository
{
    Task<List<Notification>> GetForPlayerAsync(int playerId, DateTime since, int limit);
    Task<int> GetUnreadCountAsync(int playerId);
    Task<Notification?> GetByIdAsync(int id);
    Task<List<Notification>> GetUnreadByPlayerAsync(int playerId);
    Task<Notification> AddAsync(Notification notification);
    Task UpdateAsync(Notification notification);
    Task UpdateRangeAsync(IEnumerable<Notification> notifications);
    Task<bool> ExistsAsync(int playerId, int relatedEntityId, string type);
}
