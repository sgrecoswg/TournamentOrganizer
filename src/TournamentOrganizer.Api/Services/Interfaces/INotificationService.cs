using TournamentOrganizer.Api.DTOs;

namespace TournamentOrganizer.Api.Services.Interfaces;

public interface INotificationService
{
    Task<List<NotificationDto>> GetForPlayerAsync(int playerId, int limit = 20);
    Task<NotificationCountDto> GetUnreadCountAsync(int playerId);
    Task MarkReadAsync(int notificationId, int playerId);
    Task MarkAllReadAsync(int playerId);
    Task CreateTradeMatchNotificationAsync(int playerId, int matchedPlayerId);
}
