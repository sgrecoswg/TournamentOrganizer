# Feature: Event Check-In

## Context
Between Registration closing and the first round starting, the TO needs to confirm which registered players actually showed up. Currently there is no check-in step — absent players get seeded into pods, wasting a seat. This adds an `IsCheckedIn` flag to `EventRegistration` and a new optional event phase between Registration and InProgress.

---

## Requirements

- `EventRegistration` gains `IsCheckedIn` (bool, default `false`)
- A **Check-In** tab/panel appears on the event detail page when status is `Registration`, visible to StoreEmployee+
- Shows all registered players as a checklist; employee taps to toggle check-in
- **Check In All** and **Uncheck All** bulk buttons
- When starting the event (`Registration → InProgress`), the backend seeds pods using only checked-in players; unchecked players remain registered but are not podded
- If zero players are checked in, starting the event is blocked with a 400
- Players can self-check-in from the event detail page (their own registration only) while status is `Registration`
- Checked-in count displayed on the event card: e.g. `12 / 16 checked in`

---

## Backend (`src/TournamentOrganizer.Api/`)

### Database / EF Core

```csharp
// Models/EventRegistration.cs — add:
public bool IsCheckedIn { get; set; } = false;
```
Run: `/migrate AddIsCheckedInToEventRegistration`

### DTOs

- **`EventPlayerDto`** — append `bool IsCheckedIn = false`
- **New `CheckInDto`**: `public record CheckInDto(bool IsCheckedIn);`
- **`EventDto`** — append `int CheckedInCount = 0` (computed on fetch)

### Service (`Services/EventService.cs`)

**`SetCheckInAsync(int eventId, int playerId, bool checkedIn)`**
- Fetch registration; 404 if not found
- Validate event status is `Registration`
- Update `IsCheckedIn`; persist; return `EventPlayerDto`

**Modify `StartEventAsync` (or equivalent pod-seeding method):**
- Filter to `registrations.Where(r => r.IsCheckedIn)` when building the player pool
- If count == 0: throw `InvalidOperationException("No players are checked in.")`

### Controller (`Controllers/EventsController.cs`)

```csharp
[HttpPut("{id}/players/{playerId}/checkin")]
[Authorize]
public async Task<ActionResult<EventPlayerDto>> SetCheckIn(
    int id, int playerId, CheckInDto dto)
{
    if (!await UserCanManageCheckIn(id, playerId)) return Forbid();
    return Ok(await _eventService.SetCheckInAsync(id, playerId, dto.IsCheckedIn));
}
```

### API Service (`core/services/api.service.ts`)

```typescript
setCheckIn(eventId: number, playerId: number, checkedIn: boolean): Observable<EventPlayerDto> {
  return this.http.put<EventPlayerDto>(
    `${this.base}/events/${eventId}/players/${playerId}/checkin`,
    { isCheckedIn: checkedIn }
  );
}
```

---

## Frontend (`tournament-client/src/app/`)

### Models
- `EventPlayerDto`: add `isCheckedIn: boolean`
- `EventDto`: add `checkedInCount?: number`

### `event-detail.component.ts` — Check-In section

Visible when `event.status === 'Registration'` and `authService.isStoreEmployee`:

```
┌──────────────────────────────────────────────┐
│  Check-In  (12 / 16)                         │
│  [Check In All]  [Uncheck All]               │
│  ☑ Alice Manager    alice@shop.com           │
│  ☐ Bob Player       bob@example.com          │
│  ...                                         │
└──────────────────────────────────────────────┘
```

- Clicking a row calls `apiService.setCheckIn()`; updates `isCheckedIn` on the local player; `cdr.detectChanges()`
- Player role: only their own row has a check-in toggle (self-check-in)
- Checked-in count shown in section header and on the Start Event button: `Start Event (12 checked in)`

### Post-implementation checklist
- [ ] `/check-zone event-detail.component.ts`

---

## Backend Unit Tests

**`EventCheckInTests`**:
- `SetCheckInAsync_ChecksInPlayer_ReturnsUpdatedDto`
- `SetCheckInAsync_UnchecksPlayer_ReturnsUpdatedDto`
- `SetCheckInAsync_PlayerNotRegistered_ThrowsKeyNotFoundException`
- `SetCheckInAsync_EventNotInRegistration_ThrowsInvalidOperationException`
- `StartEvent_OnlyCheckedInPlayersSeeded`
- `StartEvent_NoCheckedInPlayers_ThrowsInvalidOperationException`

Run with: `dotnet test --filter "FullyQualifiedName~EventCheckInTests"`

---

## Frontend Unit Tests (Jest)

**`event-detail.component.spec.ts`** — add `'Check-In'` describe:
- Check-In section visible for StoreEmployee when status is Registration
- Check-In section hidden when status is InProgress
- Check-In section hidden for Player role (self-check row only)
- Clicking toggle calls `apiService.setCheckIn`; row updated
- Checked-in count reflects number of `isCheckedIn: true` players

Run with: `npx jest --config jest.config.js --testPathPatterns=event-detail`

---

## Playwright E2E Tests

**File: `e2e/events/event-detail.spec.ts`** — add describe blocks

New helpers in `e2e/helpers/api-mock.ts`:
```typescript
mockSetCheckIn(page, eventId, playerId, response: EventPlayerDto)  // PUT .../checkin
```

`loginAs` as `'StoreEmployee'` for employee tests, `'Player'` for self-check-in tests. Event status `'Registration'`.

| Describe | beforeEach | Tests |
|---|---|---|
| `Event Detail — Check-In: section visibility` | `loginAs('StoreEmployee')`, `mockGetEventPlayers([...])` | Check-In section visible; checked-in count shown in header |
| `Event Detail — Check-In: toggle` | same | clicking unchecked player calls `PUT .../checkin` with `{ isCheckedIn: true }`; row updates |
| `Event Detail — Check-In: Check In All` | 3 unchecked players | clicking "Check In All" fires 3 API calls; all rows show checked |
| `Event Detail — Check-In: hidden when InProgress` | event status `'InProgress'` | Check-In section NOT visible |
| `Event Detail — Check-In: Player self-check` | `loginAs('Player', { email: 'alice@shop.com' })`, own player row unchecked | own row has toggle; other rows do NOT have toggles |
| `Event Detail — Check-In: role gate` | `loginAs('Player')` — different player | Check-In section NOT visible |

Run with: `/e2e e2e/events/event-detail.spec.ts`

---

## Verification Checklist
- [ ] Failing tests red before implementation (TDD)
- [ ] `/migrate AddIsCheckedInToEventRegistration` — applied
- [ ] `/build` — 0 errors
- [ ] `dotnet test --filter "FullyQualifiedName~EventCheckInTests"` — all pass
- [ ] Frontend Jest tests pass
- [ ] `/check-zone event-detail.component.ts` — clean
- [ ] `/e2e e2e/events/event-detail.spec.ts` — all pass

---

## Lessons Learned (implementation post-mortem)

### 1. Add `isCheckedIn` to every `EventPlayerDto` literal in `EventService`
When a new required field is added to `EventPlayerDto`, all places that construct the DTO manually must be updated. In `event.service.ts` the `registerPlayer` method builds the DTO locally (for offline/local-first support) in two places (lines ~143 and ~167). These were missed, causing a TypeScript compile error. The Angular dev server silently served a stale compiled bundle — the new template block simply never appeared in the DOM.

**Rule:** After adding a required field to a DTO interface, grep for every `EventPlayerDto = {` in the codebase before running E2E tests.

### 2. A TypeScript compile error in the dev server produces a stale bundle, not a visible error
When `ng serve` (or `npm start`) encounters a TS error, it outputs the error to the terminal but continues serving the last successful compiled bundle. The browser receives no error — the app appears to work but is missing the code from the failing file. E2E tests then fail with "element not found" for UI that was just added, which looks like a template-condition bug rather than a compile error.

**Rule:** Always run `/build` (or `npx ng build`) before running E2E tests to surface compile errors quickly.

### 3. Page snapshot in Playwright error context is the fastest diagnostic
The Playwright error context screenshot (`test-results/.../error-context.md`) showed the full ARIA tree. Seeing auth-gated elements (Start Event button, registration form) present but the new section absent immediately pointed to a compile/serve issue rather than an auth or logic problem.

**Rule:** Read the error context snapshot before diving into code — it reveals what the page actually rendered.

---
## Prompt Refinement Suggestions

### Token Efficiency
- The pod-seeding filter already exists at `EventService.cs:137` — the exact line to edit is `.Where(r => !r.IsDropped && !r.IsDisqualified)`. Add `&& r.IsCheckedIn` here; no new method needed.
- `EventPlayerDto` already exists at `DTOs/EventDto.cs:28` with fields `IsDropped`, `IsDisqualified` — just append `bool IsCheckedIn = false` as the last param.
- `CheckedInCount` on `EventDto` is redundant if the frontend computes it from the players list — consider dropping it from the DTO and computing in the component to avoid a second fetch or extra service logic.

### Anticipated Questions (pre-answer these to skip back-and-forth)
- Q: What is the actual method/location for pod seeding? → `EventService.cs` line 137: `registrations.Where(r => !r.IsDropped && !r.IsDisqualified)` — add `&& r.IsCheckedIn`
- Q: How does the frontend identify "the logged-in player's own row" for self-check-in? → The JWT has a `playerId` claim (confirmed at `EventsController.cs:70`). Match `jwt.playerId === row.playerId`.
- Q: Is `UserCanManageCheckIn` a new helper or reuse existing pattern? → Reuse the exact pattern already in `EventsController` — check `role` claim, then `storeId` for StoreEmployee/Manager, then `playerId` for Player self-check. See lines 34–70 for the pattern.
- Q: Does "Check In All" need a bulk endpoint? → No — spec says 3 individual API calls. No new endpoint needed.
- Q: Does `event-detail.component.ts` already have tabs/sections structure? → Yes — it has an existing tab structure for Registrations, Rounds, etc. The Check-In section fits as a new `@if` block in the Registrations tab, not a new tab.

### Missing Context
- `UserCanManageCheckIn` authorization rule is referenced but not defined — StoreEmployee must belong to the same store as the event; Player can only toggle their own. The store ownership check should follow the same `jwtStoreId == event.StoreId` pattern used elsewhere in `EventsController`.
- The minimum checked-in player count for starting is "at least 1" per the 400 rule, but the existing guard is "at least 4 active players" — the updated guard should be `checkedIn.Count < 4`, not just `== 0`, to keep pods valid.
---
