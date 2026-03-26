# Feature: Trade Match Notifications

> **GitHub Issue:** [#31 feat: Trade Match Notifications (in-app)](https://github.com/sgrecoswg/TournamentOrganizer/issues/31)
> **Story Points:** 8 · Model: `opus`

## Context
Suggested trade matches (Tier2) are currently only visible when a player actively navigates to their profile. This adds an in-app notification system: when a new trade match is found — triggered by any wishlist or trade list update — both players receive a notification. A notification bell in the nav bar shows the unread count.

**Dependency:** `store-licensing-tiers.md` (Tier2) must be implemented.

---

## Requirements

- `Notification` table: per-player, typed, read/unread, linked to the triggering entity
- Notification types: `TradeMatch` (initial scope; extensible)
- Notification bell icon in the top nav bar, showing unread count badge
- Clicking bell opens a panel listing recent notifications; clicking one navigates to the relevant page
- Mark-as-read on click; Mark all read button
- Notifications generated server-side when `SuggestedTradeService` finds a new match
- Only Tier2 players receive trade notifications (consistent with trade feature gate)
- Notifications older than 30 days are not shown (soft filter)

---

## Backend (`src/TournamentOrganizer.Api/`)

### Database / EF Core

**New `Models/Notification.cs`:**
```csharp
public class Notification
{
    public int Id { get; set; }
    public int PlayerId { get; set; }
    public Player Player { get; set; } = null!;
    public string Type { get; set; } = "TradeMatch";   // extensible string key
    public string Message { get; set; } = string.Empty;
    public string? LinkPath { get; set; }   // e.g. "/players/42/profile#trades"
    public bool IsRead { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public int? RelatedEntityId { get; set; }  // e.g. the matched player's ID
}
```

Add `DbSet<Notification> Notifications` to `AppDbContext`.
Run: `/migrate AddNotifications`

### DTOs

```csharp
public record NotificationDto(int Id, string Type, string Message, string? LinkPath, bool IsRead, DateTime CreatedAt);
public record NotificationCountDto(int Unread);
```

### Service — `INotificationService` (new)

```csharp
Task<List<NotificationDto>> GetForPlayerAsync(int playerId, int limit = 20);
Task<NotificationCountDto> GetUnreadCountAsync(int playerId);
Task MarkReadAsync(int notificationId, int playerId);
Task MarkAllReadAsync(int playerId);
Task CreateTradeMatchNotificationAsync(int playerId, int matchedPlayerId);
```

Call `CreateTradeMatchNotificationAsync` from `SuggestedTradeService` when a new match is found (deduplicate — don't notify for matches already notified).

### Controller — `NotificationsController` (new)

```
GET  /api/notifications              → GetForPlayerAsync (current user's playerId from JWT)
GET  /api/notifications/count        → GetUnreadCountAsync
PUT  /api/notifications/{id}/read    → MarkReadAsync
PUT  /api/notifications/readall      → MarkAllReadAsync
```

All routes: `[Authorize]`

### API Service (`core/services/api.service.ts`)

```typescript
getNotifications(): Observable<NotificationDto[]>
getNotificationCount(): Observable<NotificationCountDto>
markNotificationRead(id: number): Observable<void>
markAllNotificationsRead(): Observable<void>
```

---

## Frontend (`tournament-client/src/app/`)

### Models (`core/models/api.models.ts`)

```typescript
export interface NotificationDto { id: number; type: string; message: string; linkPath?: string | null; isRead: boolean; createdAt: string; }
export interface NotificationCountDto { unread: number; }
```

### Notification Bell — `shared/components/notification-bell.component.ts`

New standalone component added to the app toolbar (`app.html`):

```html
<button mat-icon-button [matMenuTriggerFor]="notifMenu" (click)="loadNotifications()">
  <mat-icon [matBadge]="unreadCount || null" matBadgeColor="warn">notifications</mat-icon>
</button>
<mat-menu #notifMenu>
  <div class="notif-panel">
    <div class="notif-header">
      <span>Notifications</span>
      <button mat-button (click)="markAllRead()">Mark all read</button>
    </div>
    @for (n of notifications; track n.id) {
      <div class="notif-item" [class.unread]="!n.isRead" (click)="onNotifClick(n)">
        {{ n.message }}
        <small>{{ n.createdAt | date:'shortDate' }}</small>
      </div>
    }
    @if (!notifications.length) { <div class="notif-empty">No notifications</div> }
  </div>
</mat-menu>
```

**Component state:**
```typescript
notifications: NotificationDto[] = [];
unreadCount = 0;
private pollSub: Subscription | null = null;
readonly POLL_INTERVAL_MS = 60_000; // poll every 60s
```

**`ngOnInit`:** Start polling `getNotificationCount()` every 60 seconds (only when user is logged in and Tier2).
**`loadNotifications()`:** Fetch full list on bell click.
**`onNotifClick(n)`:** Call `markNotificationRead(n.id)`; navigate to `n.linkPath`.
**`ngOnDestroy`:** Clear poll interval.

Visible only when `authService.isLoggedIn && authService.isTier2`.

### Post-implementation checklist
- [ ] `/check-zone notification-bell.component.ts`

---

## Backend Unit Tests

**`NotificationServiceTests`**:
- `GetForPlayerAsync_ReturnsPlayerNotifications_ExcludesOthers`
- `GetUnreadCountAsync_CountsOnlyUnread`
- `MarkReadAsync_SetsIsRead_WrongPlayer_DoesNothing`
- `MarkAllReadAsync_MarksAllForPlayer`
- `CreateTradeMatchNotification_CreatesCorrectMessage`
- `CreateTradeMatchNotification_DuplicateMatch_NotDuplicated`

Run with: `dotnet test --filter "FullyQualifiedName~NotificationServiceTests"`

---

## Frontend Unit Tests (Jest)

**`notification-bell.component.spec.ts`** (new file):
- Bell hidden when not logged in
- Bell hidden when `isTier2 = false`
- Unread count badge shown when `unreadCount > 0`
- Clicking bell loads notifications
- `markAllRead` calls `apiService.markAllNotificationsRead`

Run with: `npx jest --config jest.config.js --testPathPatterns=notification-bell`

---

## Playwright E2E Tests

**File: `e2e/shared/notification-bell.spec.ts`** (new file)

New helpers in `e2e/helpers/api-mock.ts`:
```typescript
mockGetNotificationCount(page, response: NotificationCountDto)
mockGetNotifications(page, response: NotificationDto[])
mockMarkNotificationRead(page, id)
mockMarkAllNotificationsRead(page)
makeNotificationDto(overrides?)  // fixture builder
```

`loginAs` with `licenseTier: 'Tier2'` for all notification tests.

| Describe | beforeEach | Tests |
|---|---|---|
| `Notification Bell — visibility` | `loginAs('Player', { licenseTier: 'Tier2' })`, `mockGetNotificationCount({ unread: 3 })` | bell icon visible in nav; badge shows `"3"` |
| `Notification Bell — hidden for Free` | `loginAs('Player', { licenseTier: 'Free' })` | bell NOT visible |
| `Notification Bell — open panel` | unread count 2; `mockGetNotifications([notif1, notif2])` | clicking bell opens panel; both notifications listed |
| `Notification Bell — mark read` | `mockMarkNotificationRead`, panel open | clicking notification calls mark-read API; notification style changes (unread highlight removed) |
| `Notification Bell — mark all read` | 2 unread notifications | clicking "Mark all read" calls `PUT /notifications/readall`; badge disappears |
| `Notification Bell — empty` | `mockGetNotifications([])` | "No notifications" text visible in panel |
| `Notification Bell — navigate on click` | notification with `linkPath: '/players/5/profile'` | clicking notification navigates to that path |

Run with: `/e2e e2e/shared/notification-bell.spec.ts`

---

## Verification Checklist
- [ ] Failing tests red before implementation (TDD)
- [ ] `/migrate AddNotifications` — applied
- [ ] `/build` — 0 errors
- [ ] `dotnet test --filter "FullyQualifiedName~NotificationServiceTests"` — all pass
- [ ] Frontend Jest tests pass
- [ ] `/check-zone notification-bell.component.ts` — clean
- [ ] `/e2e e2e/shared/notification-bell.spec.ts` — all pass
