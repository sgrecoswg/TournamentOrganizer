# Feature: Pairings Display Page

## Context
During an event, players need to know which pod/table they are at for the current round. Currently this requires an employee to read pods aloud or players to log in and navigate. A public read-only pairings page — suitable for display on a TV or shared as a link — shows the current round's pod assignments with no login required.

---

## Requirements

- Route: `/events/{id}/pairings` — **public, no auth required**
- Shows current active round's pod assignments: pod number, table number, player names
- Auto-refreshes every 30 seconds (configurable constant in component)
- If no round is active (event not InProgress), shows a friendly waiting message
- Mobile-friendly layout — large text, readable across a room
- Shareable: URL alone is sufficient (no login redirect)
- Commander name shown next to player name if declared (see `commander-declaration.md`)
- Read-only — no actions

---

## Backend (`src/TournamentOrganizer.Api/`)

### New endpoint

`GET /api/events/{id}/pairings` — **no `[Authorize]`**

Returns the current round's pods with players. Response DTO:

```csharp
public record PairingsDto(
    int EventId,
    string EventName,
    int? CurrentRound,
    List<PodPairingsDto> Pods
);

public record PodPairingsDto(
    int PodId,
    int PodNumber,
    List<PodPlayerPairingsDto> Players
);

public record PodPlayerPairingsDto(
    int PlayerId,
    string Name,
    string? CommanderName   // null if not declared or feature not enabled
);
```

Add to `EventsController`:
```csharp
[HttpGet("{id}/pairings")]
[AllowAnonymous]
public async Task<ActionResult<PairingsDto>> GetPairings(int id)
{
    var result = await _eventService.GetPairingsAsync(id);
    if (result == null) return NotFound();
    return Ok(result);
}
```

### Service (`Services/EventService.cs`)

**`GetPairingsAsync(int eventId)`**
- Fetch event; return null if not found
- Find rounds where `Status == Active` (or `InProgress`) — use the latest round number
- Load pods + pod players for that round
- Map to `PairingsDto`; include `CommanderName` from `EventRegistration` if available

### API Service (`core/services/api.service.ts`)

```typescript
getEventPairings(eventId: number): Observable<PairingsDto> {
  return this.http.get<PairingsDto>(`${this.base}/events/${eventId}/pairings`);
}
```

---

## Frontend (`tournament-client/src/app/`)

### Models (`core/models/api.models.ts`)

```typescript
export interface PodPlayerPairingsDto { playerId: number; name: string; commanderName?: string | null; }
export interface PodPairingsDto       { podId: number; podNumber: number; players: PodPlayerPairingsDto[]; }
export interface PairingsDto          { eventId: number; eventName: string; currentRound?: number | null; pods: PodPairingsDto[]; }
```

### New component: `features/events/pairings-display.component.ts`

- **Standalone**, no auth guard
- Injects `ActivatedRoute`, `ApiService`, `ChangeDetectorRef`
- On init: load pairings; set up 30-second interval timer
- On destroy: clear interval

```typescript
readonly REFRESH_INTERVAL_MS = 30_000;
pairings: PairingsDto | null = null;
loading = true;
private refreshTimer: ReturnType<typeof setInterval> | null = null;
```

**Template layout:**
```html
<div class="pairings-page">
  <h1>{{ pairings?.eventName }} — Round {{ pairings?.currentRound }}</h1>

  @if (!pairings?.currentRound) {
    <p class="waiting-message">Waiting for pairings...</p>
  }

  @for (pod of pairings?.pods ?? []; track pod.podId) {
    <mat-card class="pod-card">
      <mat-card-title>Pod {{ pod.podNumber }}</mat-card-title>
      @for (player of pod.players; track player.playerId) {
        <div class="player-row">
          <span class="player-name">{{ player.name }}</span>
          @if (player.commanderName) {
            <span class="commander-name">{{ player.commanderName }}</span>
          }
        </div>
      }
    </mat-card>
  }
</div>
```

**Template selectors (must match tests):**
- Page heading: `h1` containing event name
- Waiting message: `.waiting-message`
- Pod card: `mat-card.pod-card`
- Player row: `.player-row`

**Styles:** Large font (`font-size: 1.4rem` for player names), high contrast, responsive grid of pod cards.

### Route

Add to `app.routes.ts`:
```typescript
{ path: 'events/:id/pairings', loadComponent: () => import('./features/events/pairings-display.component').then(m => m.PairingsDisplayComponent) }
```

No auth guard — this route must be accessible without login.

Add a "Pairings" link/button on the event detail page (visible to StoreEmployee) that opens `/events/{id}/pairings` in a new tab.

### Post-implementation checklist
- [ ] `/check-zone pairings-display.component.ts`

---

## Backend Unit Tests

**`EventPairingsTests`**:
- `GetPairingsAsync_ActiveRound_ReturnsPods`
- `GetPairingsAsync_NoActiveRound_ReturnsEmptyPods`
- `GetPairingsAsync_EventNotFound_ReturnsNull`
- `GetPairingsAsync_IncludesCommanderNameWhenDeclared`

Run with: `dotnet test --filter "FullyQualifiedName~EventPairingsTests"`

---

## Frontend Unit Tests (Jest)

**`pairings-display.component.spec.ts`** (new file):
- Pods rendered with player names
- Waiting message shown when `currentRound` is null
- Commander name shown when present
- Auto-refresh calls `apiService.getEventPairings` again after interval
- Interval cleared on destroy

Run with: `npx jest --config jest.config.js --testPathPatterns=pairings-display`

---

## Playwright E2E Tests

**File: `e2e/events/pairings-display.spec.ts`** (new file)

New helper: `mockGetEventPairings(page, eventId, response: PairingsDto)`

| Describe | Tests |
|---|---|
| `Pairings Display — active round` | navigates without login; h1 shows event name and round; pod cards rendered; player names visible |
| `Pairings Display — no active round` | waiting message visible; no pod cards |
| `Pairings Display — commander names` | commander name shown next to player name when present |

Run with: `/e2e e2e/events/pairings-display.spec.ts`

---

## Verification Checklist
- [ ] Failing tests red before implementation (TDD)
- [ ] `/build` — 0 errors
- [ ] Backend unit tests pass
- [ ] Frontend Jest tests pass
- [ ] `/check-zone pairings-display.component.ts` — clean
- [ ] `/e2e e2e/events/pairings-display.spec.ts` — all pass
