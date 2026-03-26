using TournamentOrganizer.Api.DTOs;
using TournamentOrganizer.Api.Repositories.Interfaces;
using TournamentOrganizer.Api.Services.Interfaces;

namespace TournamentOrganizer.Api.Services;

public class NotificationService : INotificationService
{
    private readonly INotificationRepository _repo;
    private const int DaysToShow = 30;

    public NotificationService(INotificationRepository repo)
    {
        _repo = repo;
    }

    public async Task<List<NotificationDto>> GetForPlayerAsync(int playerId, int limit = 20)
    {
        var since = DateTime.UtcNow.AddDays(-DaysToShow);
        var notifications = await _repo.GetForPlayerAsync(playerId, since, limit);
        return notifications.Select(ToDto).ToList();
    }

    public async Task<NotificationCountDto> GetUnreadCountAsync(int playerId)
    {
        var count = await _repo.GetUnreadCountAsync(playerId);
        return new NotificationCountDto(count);
    }

    public async Task MarkReadAsync(int notificationId, int playerId)
    {
        var notification = await _repo.GetByIdAsync(notificationId);
        if (notification == null || notification.PlayerId != playerId) return;
        notification.IsRead = true;
        await _repo.UpdateAsync(notification);
    }

    public async Task MarkAllReadAsync(int playerId)
    {
        var unread = await _repo.GetUnreadByPlayerAsync(playerId);
        foreach (var n in unread) n.IsRead = true;
        await _repo.UpdateRangeAsync(unread);
    }

    public async Task CreateTradeMatchNotificationAsync(int playerId, int matchedPlayerId)
    {
        var alreadyExists = await _repo.ExistsAsync(playerId, matchedPlayerId, "TradeMatch");
        if (alreadyExists) return;

        var notification = new Models.Notification
        {
            PlayerId = playerId,
            Type = "TradeMatch",
            Message = $"New trade match found with player #{matchedPlayerId}!",
            LinkPath = $"/players/{matchedPlayerId}",
            RelatedEntityId = matchedPlayerId,
            CreatedAt = DateTime.UtcNow,
        };
        await _repo.AddAsync(notification);
    }

    private static NotificationDto ToDto(Models.Notification n) =>
        new(n.Id, n.Type, n.Message, n.LinkPath, n.IsRead, n.CreatedAt);
}
