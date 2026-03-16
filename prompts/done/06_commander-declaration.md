# Feature: Commander Declaration

## Context
Players currently have no way to declare which commander (and deck) they are playing in an event. Adding this unlocks commander-level analytics, meta reports, and richer player profiles. Declaration is per event registration and is optional until the store enables it as required.

**Dependency:** None. Commander Stats and Commander Meta Report features depend on this.

---

## Requirements

- Each `EventRegistration` can store a declared `CommanderName` (string) and optional `DecklistUrl` (string — already exists on `EventRegistration`; verify)
- Player declares/updates their commander from the event detail Players tab (their own registration only)
- StoreEmployee/Manager can view and edit any player's declaration for their event
- Declaration is allowed while event status is `Registration` or `InProgress`
- Display commander name on the event player list and on the player's profile under that event's registration history
- `CommanderName` is free-text (no card database lookup in this feature)

---

## Backend (`src/TournamentOrganizer.Api/`)

### Database / EF Core

Check `Models/EventRegistration.cs` — if `DecklistUrl` already exists, add only:
```csharp
public string? CommanderName { get; set; }
```
Run: `/migrate AddCommanderNameToEventRegistration`

### DTOs

- **`EventPlayerDto`** — append `string? CommanderName = null`
- **`EventRegistrationDto`** (player profile history) — append `string? CommanderName = null`
- **New `DeclareCommanderDto`**: `public record DeclareCommanderDto(string? CommanderName, string? DecklistUrl);`

### Service (`Services/EventService.cs`)

**`DeclareCommanderAsync(int eventId, int playerId, DeclareCommanderDto dto)`**
- Fetch `EventRegistration` by `(eventId, playerId)`; 404 if not found
- Validate event status is `Registration` or `InProgress`; return 400 otherwise
- Update `CommanderName` and `DecklistUrl`; persist
- Return updated `EventPlayerDto`

### Controller (`Controllers/EventsController.cs`)

```csharp
[HttpPut("{id}/players/{playerId}/commander")]
[Authorize]
public async Task<ActionResult<EventPlayerDto>> DeclareCommander(
    int id, int playerId, DeclareCommanderDto dto)
{
    if (!await UserCanDeclareForPlayer(id, playerId)) return Forbid();
    return Ok(await _eventService.DeclareCommanderAsync(id, playerId, dto));
}
```

`UserCanDeclareForPlayer`: Admin → always; StoreEmployee → any player at their event; Player → only if `playerId` matches their own player record (look up by JWT email).

### API Service (`core/services/api.service.ts`)

```typescript
declareCommander(eventId: number, playerId: number, dto: { commanderName?: string; decklistUrl?: string }): Observable<EventPlayerDto> {
  return this.http.put<EventPlayerDto>(`${this.base}/events/${eventId}/players/${playerId}/commander`, dto);
}
```

---

## Frontend (`tournament-client/src/app/`)

### Models (`core/models/api.models.ts`)
- `EventPlayerDto`: add `commanderName?: string | null`

### `event-detail.component.ts` — Players tab

Add inline edit for commander name per player row:
- Each player row shows `commanderName` or `—` if null
- Edit pencil icon (own player, or StoreEmployee for any)
- Clicking edit opens a small inline form: text input for commander name + save/cancel
- On save: call `apiService.declareCommander()`; update row; `cdr.detectChanges()`

### Post-implementation checklist
- [ ] `/check-zone event-detail.component.ts`

---

## Backend Unit Tests

**`CommanderDeclarationTests`**:
- `DeclareCommanderAsync_ValidRegistration_UpdatesAndReturnsDto`
- `DeclareCommanderAsync_EventNotFound_ThrowsKeyNotFoundException`
- `DeclareCommanderAsync_PlayerNotRegistered_ThrowsKeyNotFoundException`
- `DeclareCommanderAsync_EventCompleted_ThrowsInvalidOperationException`
- `DeclareCommanderAsync_ClearsCommanderName_WhenNullPassed`

Run with: `dotnet test --filter "FullyQualifiedName~CommanderDeclarationTests"`

---

## Frontend Unit Tests (Jest)

**`event-detail.component.spec.ts`** — add `'Commander Declaration'` describe:
- Commander name displayed in player row when set
- `—` shown when commanderName is null
- Edit icon visible for own player; hidden for other player when role is Player
- `declareCommander` API called on save; row updated

Run with: `npx jest --config jest.config.js --testPathPatterns=event-detail`

---

## Playwright E2E Tests

**File: `e2e/events/event-detail.spec.ts`** — add describe blocks

New helper needed in `e2e/helpers/api-mock.ts`:
```typescript
mockDeclareCommander(page, eventId, playerId, response: EventPlayerDto)  // PUT .../commander
```

`loginAs` as `'StoreEmployee'` or `'Player'` as needed. Event status `'InProgress'`.

| Describe | beforeEach | Tests |
|---|---|---|
| `Event Detail — Commander Declaration: display` | `loginAs('StoreEmployee')`, `mockGetEventPlayers` with `commanderName: 'Atraxa'` | `"Atraxa"` visible in player row |
| `Event Detail — Commander Declaration: null` | player with `commanderName: null` | `"—"` shown in commander column |
| `Event Detail — Commander Declaration: edit (StoreEmployee)` | `loginAs('StoreEmployee')` | edit icon visible on any player row; clicking opens inline input; saving calls `PUT .../commander`; updated name shown |
| `Event Detail — Commander Declaration: edit (own player)` | `loginAs('Player', { email: 'alice@shop.com' })`, own player row | edit icon visible on own row only |
| `Event Detail — Commander Declaration: role gate` | `loginAs('Player', { email: 'other@shop.com' })`, viewing another player's row | edit icon NOT visible |

Run with: `/e2e e2e/events/event-detail.spec.ts`

---

## Verification Checklist
- [ ] Failing tests red before implementation (TDD)
- [ ] `/migrate AddCommanderNameToEventRegistration` — applied
- [ ] `/build` — 0 errors
- [ ] `dotnet test --filter "FullyQualifiedName~CommanderDeclarationTests"` — all pass
- [ ] `npx jest --config jest.config.js --testPathPatterns=event-detail` — all pass
- [ ] `/check-zone event-detail.component.ts` — clean
- [ ] `/e2e e2e/events/event-detail.spec.ts` — all pass
