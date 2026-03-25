using TournamentOrganizer.Api.Models;
using TournamentOrganizer.Api.Repositories.Interfaces;
using TournamentOrganizer.Api.Services;

namespace TournamentOrganizer.Tests;

/// <summary>
/// TDD tests for NotificationService (Issue #31).
/// Written BEFORE full implementation — tests define expected behaviour.
/// </summary>
public class NotificationServiceTests
{
    // ── Fake repository ───────────────────────────────────────────────────────

    private sealed class FakeNotificationRepository : INotificationRepository
    {
        private readonly List<Notification> _notifications = [];
        private int _nextId = 1;

        public Task<List<Notification>> GetForPlayerAsync(int playerId, DateTime since, int limit) =>
            Task.FromResult(_notifications
                .Where(n => n.PlayerId == playerId && n.CreatedAt >= since)
                .OrderByDescending(n => n.CreatedAt)
                .Take(limit)
                .ToList());

        public Task<int> GetUnreadCountAsync(int playerId) =>
            Task.FromResult(_notifications.Count(n => n.PlayerId == playerId && !n.IsRead));

        public Task<Notification?> GetByIdAsync(int id) =>
            Task.FromResult(_notifications.FirstOrDefault(n => n.Id == id));

        public Task<List<Notification>> GetUnreadByPlayerAsync(int playerId) =>
            Task.FromResult(_notifications.Where(n => n.PlayerId == playerId && !n.IsRead).ToList());

        public Task<Notification> AddAsync(Notification notification)
        {
            notification.Id = _nextId++;
            _notifications.Add(notification);
            return Task.FromResult(notification);
        }

        public Task UpdateAsync(Notification notification)
        {
            var existing = _notifications.FirstOrDefault(n => n.Id == notification.Id);
            if (existing != null) existing.IsRead = notification.IsRead;
            return Task.CompletedTask;
        }

        public Task UpdateRangeAsync(IEnumerable<Notification> notifications)
        {
            foreach (var n in notifications)
            {
                var existing = _notifications.FirstOrDefault(x => x.Id == n.Id);
                if (existing != null) existing.IsRead = n.IsRead;
            }
            return Task.CompletedTask;
        }

        public Task<bool> ExistsAsync(int playerId, int relatedEntityId, string type) =>
            Task.FromResult(_notifications.Any(n =>
                n.PlayerId == playerId &&
                n.RelatedEntityId == relatedEntityId &&
                n.Type == type));

        // Expose internals for assertions
        public IReadOnlyList<Notification> All => _notifications.AsReadOnly();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static (NotificationService Service, FakeNotificationRepository Repo) Build()
    {
        var repo = new FakeNotificationRepository();
        return (new NotificationService(repo), repo);
    }

    private static Notification MakeNotification(int playerId, bool isRead = false, int? relatedEntityId = null) =>
        new()
        {
            PlayerId = playerId,
            Type = "TradeMatch",
            Message = "Test notification",
            IsRead = isRead,
            CreatedAt = DateTime.UtcNow,
            RelatedEntityId = relatedEntityId,
        };

    // ── Tests ─────────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetForPlayerAsync_ReturnsPlayerNotifications_ExcludesOthers()
    {
        var (service, repo) = Build();
        await repo.AddAsync(MakeNotification(playerId: 1));
        await repo.AddAsync(MakeNotification(playerId: 1));
        await repo.AddAsync(MakeNotification(playerId: 2));

        var result = await service.GetForPlayerAsync(playerId: 1);

        Assert.Equal(2, result.Count);
        Assert.All(result, dto => Assert.Equal("TradeMatch", dto.Type));
    }

    [Fact]
    public async Task GetUnreadCountAsync_CountsOnlyUnread()
    {
        var (service, repo) = Build();
        await repo.AddAsync(MakeNotification(playerId: 1, isRead: false));
        await repo.AddAsync(MakeNotification(playerId: 1, isRead: false));
        await repo.AddAsync(MakeNotification(playerId: 1, isRead: true));
        await repo.AddAsync(MakeNotification(playerId: 2, isRead: false));

        var result = await service.GetUnreadCountAsync(playerId: 1);

        Assert.Equal(2, result.Unread);
    }

    [Fact]
    public async Task MarkReadAsync_SetsIsRead_WrongPlayer_DoesNothing()
    {
        var (service, repo) = Build();
        var notif = await repo.AddAsync(MakeNotification(playerId: 1, isRead: false));

        // Wrong player — should do nothing
        await service.MarkReadAsync(notif.Id, playerId: 99);
        Assert.False(repo.All.First(n => n.Id == notif.Id).IsRead);

        // Correct player — should mark read
        await service.MarkReadAsync(notif.Id, playerId: 1);
        Assert.True(repo.All.First(n => n.Id == notif.Id).IsRead);
    }

    [Fact]
    public async Task MarkAllReadAsync_MarksAllForPlayer()
    {
        var (service, repo) = Build();
        await repo.AddAsync(MakeNotification(playerId: 1, isRead: false));
        await repo.AddAsync(MakeNotification(playerId: 1, isRead: false));
        await repo.AddAsync(MakeNotification(playerId: 2, isRead: false));

        await service.MarkAllReadAsync(playerId: 1);

        Assert.All(repo.All.Where(n => n.PlayerId == 1), n => Assert.True(n.IsRead));
        Assert.False(repo.All.First(n => n.PlayerId == 2).IsRead);
    }

    [Fact]
    public async Task CreateTradeMatchNotification_CreatesCorrectMessage()
    {
        var (service, repo) = Build();

        await service.CreateTradeMatchNotificationAsync(playerId: 5, matchedPlayerId: 10);

        Assert.Single(repo.All);
        var notif = repo.All[0];
        Assert.Equal(5, notif.PlayerId);
        Assert.Equal("TradeMatch", notif.Type);
        Assert.Equal(10, notif.RelatedEntityId);
        Assert.Contains("10", notif.Message);
        Assert.NotNull(notif.LinkPath);
        Assert.Contains("10", notif.LinkPath);
        Assert.False(notif.IsRead);
    }

    [Fact]
    public async Task CreateTradeMatchNotification_DuplicateMatch_NotDuplicated()
    {
        var (service, repo) = Build();

        await service.CreateTradeMatchNotificationAsync(playerId: 5, matchedPlayerId: 10);
        await service.CreateTradeMatchNotificationAsync(playerId: 5, matchedPlayerId: 10);

        Assert.Single(repo.All);
    }
}
