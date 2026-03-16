# Feature: Event Waitlist

## Context
When an event reaches `MaxPlayers`, additional registration attempts are rejected. A waitlist lets interested players queue up; when a registered player drops or the TO increases capacity, the first waitlisted player is automatically promoted and notified.

---

## Requirements

- When `RegisterPlayerAsync` would exceed `MaxPlayers`, add to waitlist instead of rejecting
- `EventRegistration` gains `IsWaitlisted` (bool) and `WaitlistPosition` (int?) fields
- Waitlisted players see their position on the event detail page
- StoreEmployee sees the full waitlist; can manually promote a player
- When a player drops (`IsDropped = true`) or is removed, the first waitlisted player is auto-promoted (their `IsWaitlisted` cleared, `WaitlistPosition` cleared)
- Waitlisted players do NOT appear in pod seeding
- Waitlist position is 1-indexed and gapless (recomputed after any promotion/removal)

---

## Backend (`src/TournamentOrganizer.Api/`)

### Database / EF Core

```csharp
// Models/EventRegistration.cs — add:
public bool IsWaitlisted { get; set; } = false;
public int? WaitlistPosition { get; set; }
```
Run: `/migrate AddWaitlistToEventRegistration`

### DTOs

- **`EventPlayerDto`** — append `bool IsWaitlisted = false`, `int? WaitlistPosition = null`

### Service (`Services/EventService.cs`)

**Modify `RegisterPlayerAsync`:**
```csharp
var activeCount = registrations.Count(r => !r.IsWaitlisted && !r.IsDropped);
if (activeCount >= eventEntity.MaxPlayers)
{
    var nextPosition = registrations.Where(r => r.IsWaitlisted).Max(r => r.WaitlistPosition ?? 0) + 1;
    registration.IsWaitlisted = true;
    registration.WaitlistPosition = nextPosition;
}
```

**New `PromoteFromWaitlistAsync(int eventId)`** (internal):
- Find lowest `WaitlistPosition` registration; clear `IsWaitlisted` and `WaitlistPosition`
- Recompute remaining waitlist positions (renumber from 1)
- Persist

**New `ManualPromoteAsync(int eventId, int playerId)`** — for StoreEmployee:
- Promote specific player; recompute positions

**Call `PromoteFromWaitlistAsync` from:**
- `SetDroppedAsync` when dropping a player
- `UnregisterPlayerAsync` (if that exists) when removing a player

### Controller (`Controllers/EventsController.cs`)

```csharp
[HttpPost("{id}/players/{playerId}/promote")]
[Authorize(Policy = "StoreEmployee")]
public async Task<ActionResult<EventPlayerDto>> PromoteFromWaitlist(int id, int playerId)
{
    if (!await UserCanManageEvent(id)) return Forbid();
    return Ok(await _eventService.ManualPromoteAsync(id, playerId));
}
```

### API Service (`core/services/api.service.ts`)

```typescript
promoteFromWaitlist(eventId: number, playerId: number): Observable<EventPlayerDto> {
  return this.http.post<EventPlayerDto>(`${this.base}/events/${eventId}/players/${playerId}/promote`, {});
}
```

---

## Frontend (`tournament-client/src/app/`)

### Models
- `EventPlayerDto`: add `isWaitlisted: boolean`, `waitlistPosition?: number | null`

### `event-detail.component.ts`

**For registered (active) players tab:** no change.

**Add Waitlist section** (visible when `authService.isStoreEmployee`):
```html
@if (waitlistedPlayers.length) {
  <div class="waitlist-section">
    <h3>Waitlist ({{ waitlistedPlayers.length }})</h3>
    @for (player of waitlistedPlayers; track player.playerId) {
      <div class="waitlist-row">
        <span class="position">#{{ player.waitlistPosition }}</span>
        <span>{{ player.name }}</span>
        <button mat-stroked-button (click)="promotePlayer(player.playerId)">Promote</button>
      </div>
    }
  </div>
}
```

**For Player role:** show their own position if waitlisted:
```html
@if (myRegistration?.isWaitlisted) {
  <mat-card class="waitlist-notice">
    You are #{{ myRegistration.waitlistPosition }} on the waitlist.
  </mat-card>
}
```

**`waitlistedPlayers` getter:** `this.eventPlayers.filter(p => p.isWaitlisted).sort((a, b) => (a.waitlistPosition ?? 0) - (b.waitlistPosition ?? 0))`

### Post-implementation checklist
- [ ] `/check-zone event-detail.component.ts`

---

## Backend Unit Tests

**`EventWaitlistTests`**:
- `RegisterPlayerAsync_WhenFull_AddsToWaitlist`
- `RegisterPlayerAsync_WhenNotFull_AddsNormally`
- `PromoteFromWaitlistAsync_PromotesLowestPosition`
- `PromoteFromWaitlistAsync_RecomputesRemainingPositions`
- `DropPlayer_TriggersAutoPromotion`
- `ManualPromoteAsync_PromotesSpecificPlayer`
- `ManualPromoteAsync_PlayerNotWaitlisted_ThrowsInvalidOperationException`

Run with: `dotnet test --filter "FullyQualifiedName~EventWaitlistTests"`

---

## Frontend Unit Tests (Jest)

**`event-detail.component.spec.ts`** — add `'Waitlist'` describe:
- Waitlist section visible for StoreEmployee when waitlisted players exist
- Waitlisted players shown in position order
- Promote button calls `apiService.promoteFromWaitlist`
- Player role sees their own waitlist position notice

Run with: `npx jest --config jest.config.js --testPathPatterns=event-detail`

---

## Playwright E2E Tests

**File: `e2e/events/event-detail.spec.ts`** — add describe blocks

New helpers in `e2e/helpers/api-mock.ts`:
```typescript
mockPromoteFromWaitlist(page, eventId, playerId, response: EventPlayerDto)
// Extend makeEventPlayerDto to accept isWaitlisted, waitlistPosition
```

| Describe | beforeEach | Tests |
|---|---|---|
| `Event Detail — Waitlist: section visible` | `loginAs('StoreEmployee')`, `mockGetEventPlayers` with 2 active + 1 waitlisted | Waitlist section visible; waitlisted player shown with `#1` position badge |
| `Event Detail — Waitlist: promote` | same + `mockPromoteFromWaitlist` | clicking "Promote" calls API; player moves to active list; waitlist section gone |
| `Event Detail — Waitlist: ordering` | 3 waitlisted players (positions 1, 2, 3) | players listed in ascending position order |
| `Event Detail — Waitlist: hidden when empty` | no waitlisted players | Waitlist section NOT visible |
| `Event Detail — Waitlist: Player sees own position` | `loginAs('Player', { email: 'alice@shop.com' })`, own registration `isWaitlisted: true, waitlistPosition: 2` | `"You are #2 on the waitlist"` notice visible |
| `Event Detail — Waitlist: full event registration` | `mockRegisterPlayer` returns waitlisted player | registering when event is full shows waitlist position snackbar |

Run with: `/e2e e2e/events/event-detail.spec.ts`

---

## Verification Checklist
- [ ] Failing tests red before implementation (TDD)
- [ ] `/migrate AddWaitlistToEventRegistration` — applied
- [ ] `/build` — 0 errors
- [ ] `dotnet test --filter "FullyQualifiedName~EventWaitlistTests"` — all pass
- [ ] Frontend Jest tests pass
- [ ] `/check-zone event-detail.component.ts` — clean
- [ ] `/e2e e2e/events/event-detail.spec.ts` — all pass
