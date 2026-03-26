using Microsoft.EntityFrameworkCore;
using TournamentOrganizer.Api.Data;
using TournamentOrganizer.Api.Models;
using TournamentOrganizer.Api.Repositories.Interfaces;

namespace TournamentOrganizer.Api.Repositories;

public class NotificationRepository : INotificationRepository
{
    private readonly AppDbContext _db;

    public NotificationRepository(AppDbContext db) => _db = db;

    public async Task<List<Notification>> GetForPlayerAsync(int playerId, DateTime since, int limit) =>
        await _db.Notifications
            .Where(n => n.PlayerId == playerId && n.CreatedAt >= since)
            .OrderByDescending(n => n.CreatedAt)
            .Take(limit)
            .ToListAsync();

    public async Task<int> GetUnreadCountAsync(int playerId) =>
        await _db.Notifications.CountAsync(n => n.PlayerId == playerId && !n.IsRead);

    public async Task<Notification?> GetByIdAsync(int id) =>
        await _db.Notifications.FindAsync(id);

    public async Task<List<Notification>> GetUnreadByPlayerAsync(int playerId) =>
        await _db.Notifications.Where(n => n.PlayerId == playerId && !n.IsRead).ToListAsync();

    public async Task<Notification> AddAsync(Notification notification)
    {
        _db.Notifications.Add(notification);
        await _db.SaveChangesAsync();
        return notification;
    }

    public async Task UpdateAsync(Notification notification)
    {
        _db.Notifications.Update(notification);
        await _db.SaveChangesAsync();
    }

    public async Task UpdateRangeAsync(IEnumerable<Notification> notifications)
    {
        _db.Notifications.UpdateRange(notifications);
        await _db.SaveChangesAsync();
    }

    public async Task<bool> ExistsAsync(int playerId, int relatedEntityId, string type) =>
        await _db.Notifications.AnyAsync(n =>
            n.PlayerId == playerId &&
            n.RelatedEntityId == relatedEntityId &&
            n.Type == type);
}
