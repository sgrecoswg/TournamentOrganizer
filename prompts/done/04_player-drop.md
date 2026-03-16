# Feature: Player Drop / Withdraw Mid-Event

## Context
Players sometimes need to leave a tournament early. Currently there is no way to mark a player as dropped — they continue to appear in pod seeding, creating empty seats. This adds a drop/withdraw mechanism that excludes the player from future rounds while preserving all their completed game results.

---

## Requirements

- `EventRegistration` gains `IsDropped` (bool, default `false`) and `DroppedAfterRound` (int?, null = not dropped)
- Dropped players are excluded from pod seeding in subsequent rounds
- Dropped players still appear in the event player list with a visual indicator (greyed out / "Dropped" badge)
- **Who can drop a player:**
  - StoreEmployee/Manager can drop any player at their event
  - A player can withdraw themselves (their own registration)
- **When:** Only while event status is `InProgress`
- **Un-drop:** StoreEmployee/Manager only (player cannot un-drop themselves)
- Dropped player's prior game results and TrueSkill updates are preserved
- Final standings exclude dropped players from ranking positions (they appear below active finishers)

---

## Backend (`src/TournamentOrganizer.Api/`)

### Database / EF Core

```csharp
// Models/EventRegistration.cs — add:
public bool IsDropped { get; set; } = false;
public int? DroppedAfterRound { get; set; }
```
Run: `/migrate AddIsDroppedToEventRegistration`

### DTOs

- **`EventPlayerDto`** — append `bool IsDropped = false`, `int? DroppedAfterRound = null`
- **New `DropPlayerDto`**: `public record DropPlayerDto(bool IsDropped);`

### Service (`Services/EventService.cs`)

**`SetDroppedAsync(int eventId, int playerId, bool dropped)`**
- Fetch registration; 404 if not found
- Validate event status is `InProgress`
- Set `IsDropped = dropped`; if dropping, set `DroppedAfterRound = currentRoundNumber`; if un-dropping, clear it
- Persist; return updated `EventPlayerDto`

**Modify pod seeding logic:**
- Filter `registrations.Where(r => !r.IsDropped)` before building player pool for new round

### Controller (`Controllers/EventsController.cs`)

```csharp
[HttpPut("{id}/players/{playerId}/drop")]
[Authorize]
public async Task<ActionResult<EventPlayerDto>> SetDropped(
    int id, int playerId, DropPlayerDto dto)
{
    if (!await UserCanDropPlayer(id, playerId, dto.IsDropped)) return Forbid();
    return Ok(await _eventService.SetDroppedAsync(id, playerId, dto.IsDropped));
}
```

`UserCanDropPlayer`: Admin/StoreEmployee → always; Player → can set `IsDropped = true` (withdraw self) but cannot set `IsDropped = false` (un-drop).

### API Service (`core/services/api.service.ts`)

```typescript
setPlayerDropped(eventId: number, playerId: number, isDropped: boolean): Observable<EventPlayerDto> {
  return this.http.put<EventPlayerDto>(
    `${this.base}/events/${eventId}/players/${playerId}/drop`,
    { isDropped }
  );
}
```

---

## Frontend (`tournament-client/src/app/`)

### Models
- `EventPlayerDto`: add `isDropped: boolean`, `droppedAfterRound?: number | null`

### `event-detail.component.ts` — Players tab

- Dropped players shown with a `Dropped` chip and greyed row
- StoreEmployee sees a "Drop" button per active player row (visible during InProgress)
- StoreEmployee sees an "Un-drop" button on dropped rows
- Player sees a "Withdraw" button on their own row (no un-drop)
- Confirm dialog before dropping: `"Drop [Name] from this event?"` (use `MatDialog` or simple `confirm()`)
- On confirm: call `apiService.setPlayerDropped()`; update local player row; `cdr.detectChanges()`

**Template selectors:**
- Drop button: `button` with text `Drop`
- Withdraw button: `button` with text `Withdraw`
- Un-drop button: `button` with text `Un-drop`
- Dropped indicator: `mat-chip` with text `Dropped`

### Post-implementation checklist
- [ ] `/check-zone event-detail.component.ts`

---

## Backend Unit Tests

**`PlayerDropTests`**:
- `SetDroppedAsync_DropsPlayer_SetsDroppedAfterRound`
- `SetDroppedAsync_UndropsPlayer_ClearsDroppedAfterRound`
- `SetDroppedAsync_PlayerNotRegistered_ThrowsKeyNotFoundException`
- `SetDroppedAsync_EventNotInProgress_ThrowsInvalidOperationException`
- `PodSeeding_ExcludesDroppedPlayers`

Run with: `dotnet test --filter "FullyQualifiedName~PlayerDropTests"`

---

## Frontend Unit Tests (Jest)

**`event-detail.component.spec.ts`** — add `'Player Drop'` describe:
- Drop button visible for StoreEmployee during InProgress
- Drop button absent when status is Registration
- Dropped player row shows `Dropped` chip
- Un-drop button visible on dropped rows for StoreEmployee
- `setPlayerDropped` API called on drop; row updated

Run with: `npx jest --config jest.config.js --testPathPatterns=event-detail`

---

## Playwright E2E Tests

**File: `e2e/events/event-detail.spec.ts`** — add describe blocks

New helpers in `e2e/helpers/api-mock.ts`:
```typescript
mockSetPlayerDropped(page, eventId, playerId, response: EventPlayerDto)  // PUT .../drop
```

Event status `'InProgress'` for all drop tests.

| Describe | beforeEach | Tests |
|---|---|---|
| `Event Detail — Player Drop: Drop button` | `loginAs('StoreEmployee')`, active player in list | "Drop" button visible per row; absent when status is Registration |
| `Event Detail — Player Drop: drop action` | same | clicking "Drop" fires `PUT .../drop`; row shows `Dropped` chip; "Drop" button replaced by "Un-drop" |
| `Event Detail — Player Drop: un-drop` | dropped player in list | "Un-drop" button visible for StoreEmployee; clicking calls API; `Dropped` chip removed |
| `Event Detail — Player Drop: Player withdraw` | `loginAs('Player', { email: 'alice@shop.com' })`, own registration active | "Withdraw" button visible on own row; no "Un-drop" button after withdrawal |
| `Event Detail — Player Drop: role gate` | `loginAs('Player', { email: 'other@shop.com' })`, viewing another player | "Drop" button NOT visible on other players' rows |

Run with: `/e2e e2e/events/event-detail.spec.ts`

---

## Verification Checklist
- [ ] Failing tests red before implementation (TDD)
- [ ] `/migrate AddIsDroppedToEventRegistration` — applied
- [ ] `/build` — 0 errors
- [ ] `dotnet test --filter "FullyQualifiedName~PlayerDropTests"` — all pass
- [ ] Frontend Jest tests pass
- [ ] `/check-zone event-detail.component.ts` — clean
- [ ] `/e2e e2e/events/event-detail.spec.ts` — all pass
