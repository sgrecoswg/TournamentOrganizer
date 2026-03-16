# Feature: Bulk Player Registration for Events

## Context
Store employees currently register players one at a time via an autocomplete picker. For large events this is tedious. This adds three ways to bulk-add players to an event: (1) upload a text/CSV file of emails, (2) multi-select from the store's player list with checkboxes, and (3) "Select All". Unknown emails trigger a name-prompt step so new players can be created on the fly. All three paths go through a preview step before committing.

**No database schema changes** — uses existing `Player` and `EventRegistration` models.

**File upload preview is client-side only** — emails are resolved against `LocalStorageContext.players` (the store's local player cache) and compared against the already-loaded event player list. No API call is made until the user clicks Confirm.

---

## Requirements

- Only `StoreEmployee`/`StoreManager`/`Administrator` who can manage the event may bulk-register
- **File upload**: one email per line (`.txt` or `.csv`); parsed in the browser via `FileReader`
- **Email resolution**: each email is looked up against `ctx.players.getAll()` (store-scoped local cache)
- **Already-registered check**: compare resolved `playerId` against the set of IDs from the event's already-loaded `EventPlayerDto[]` list
- **Unknown emails**: surface them in the preview with a name-entry field; on confirm, create the player then register
- **Already-registered players**: listed in the preview as skipped (not an error)
- **Preview step**: always shown before any registration is committed; user can deselect rows or cancel
- **Multi-select**: shows all players from `ctx.players.getAll()`, displayed as a checkbox list with filter input and Select All / Deselect All
- **Register Selected** button: disabled when no rows selected
- Results summary snackbar: `"N registered, M new players created"` (plus error detail if any)
- Only available when event status is `Registration`

---

## Backend (`src/TournamentOrganizer.Api/`)

### DTOs (`DTOs/EventDto.cs` — append)

```csharp
// Confirm request — sent from the frontend after preview
public record BulkRegisterConfirmDto(
    List<BulkRegisterConfirmItemDto> Registrations
);

public record BulkRegisterConfirmItemDto(
    int?   PlayerId,   // null when creating a new player
    string Email,
    string? Name       // required when PlayerId is null
);

// Confirm response
public record BulkRegisterResultDto(int Registered, int Created, List<BulkRegisterErrorDto> Errors);
public record BulkRegisterErrorDto(string Email, string Reason);
```

> Note: `BulkRegisterPreviewDto` and `BulkRegisterFoundDto` are **frontend-only** TypeScript types — they never travel over the wire. Do not add them to C# DTOs.

### Service (`Services/EventService.cs` — add one method)

**`BulkRegisterConfirmAsync(int eventId, BulkRegisterConfirmDto dto)`**
- For each item where `PlayerId == null`: create a new `Player` with `Name` and `Email`; use `PlacementGamesLeft = 5`, `Mu = 25.0`, `Sigma = 8.333`, `IsActive = true`
- For each item: call `RegisterPlayerAsync(eventId, playerId)` wrapped in try/catch (collect errors; continue)
- Return `BulkRegisterResultDto`

**No changes to `RegisterPlayerAsync`** — reuse existing validation (event status, duplicate, capacity).

### Controller (`Controllers/EventsController.cs` — add one action)

```csharp
[HttpPost("{id}/bulkregister/confirm")]
[Authorize]
public async Task<ActionResult<BulkRegisterResultDto>> BulkRegisterConfirm(int id, BulkRegisterConfirmDto dto)
{
    if (!await UserCanManageEvent(id)) return Forbid();
    return Ok(await _eventService.BulkRegisterConfirmAsync(id, dto));
}
```

### API Service (`core/services/api.service.ts`)

```typescript
bulkRegisterConfirm(eventId: number, dto: BulkRegisterConfirmDto): Observable<BulkRegisterResultDto> {
  return this.http.post<BulkRegisterResultDto>(`${this.base}/events/${eventId}/bulkregister/confirm`, dto);
}
```

---

## Frontend (`tournament-client/src/app/`)

### Models (`core/models/api.models.ts`)

```typescript
// Frontend-only preview types (not sent to or from the API)
export interface BulkRegisterFoundDto  { playerId: number; name: string; email: string; }
export interface BulkRegisterPreviewDto {
  found:             BulkRegisterFoundDto[];
  notFound:          string[];          // emails with no matching player in local cache
  alreadyRegistered: BulkRegisterFoundDto[];
}

// Confirm DTOs (sent to API)
export interface BulkRegisterConfirmItemDto { playerId?: number | null; email: string; name?: string | null; }
export interface BulkRegisterConfirmDto    { registrations: BulkRegisterConfirmItemDto[]; }
export interface BulkRegisterResultDto     { registered: number; created: number; errors: { email: string; reason: string }[]; }
```

### `event-detail.component.ts` — Players tab changes

Inject `LocalStorageContext` (already available in the component — confirm it is injected; add if missing).

Add below the existing single-player register form (visible to StoreEmployee, event in Registration status).

**New UI sections:**

```
┌─────────────────────────────────────────────────────────┐
│  [Upload File]  ← hidden file input triggered by button │
│                                                          │
│  ── OR ──                                                │
│                                                          │
│  Filter: [__________]  [Select All] [Deselect All]      │
│  ☐ Alice Manager   alice@shop.com                       │
│  ☑ Bob Player      bob@example.com                      │
│  ☐ Charlie New     charlie@test.com                     │
│                                                          │
│  [Register Selected]  (disabled when 0 checked)         │
└─────────────────────────────────────────────────────────┘
```

**Preview panel** (shown inline below, collapses on cancel or after confirm):

```
┌─────────────────────────────────────────────────────────┐
│  Preview Registration                                    │
│                                                          │
│  Will register (3):                                      │
│  ☑ Alice Manager   alice@shop.com                       │
│  ☑ Bob Player      bob@example.com                      │
│  ☑ Charlie New     charlie@test.com                     │
│                                                          │
│  New players to create (1):                              │
│  unknown@new.com   Name: [____________]  ☑ include       │
│                                                          │
│  Already registered (skipped): dave@shop.com            │
│                                                          │
│  [Confirm Registration]          [Cancel]               │
└─────────────────────────────────────────────────────────┘
```

**Template selectors (must match tests exactly):**
- Upload button: `<button mat-stroked-button>Upload File</button>`
- Hidden file input: `input[type="file"][accept=".txt,.csv"]`
- Filter input label: `Filter Players`
- Select All button text: `Select All`
- Deselect All button text: `Deselect All`
- Player option: `mat-list-option` (inside `mat-selection-list`)
- Register Selected button text: `Register Selected`
- Preview panel heading: `<h3>Preview Registration</h3>`
- "Will register" subheading: `Will register`
- "New players" subheading: `New players to create`
- "Already registered" subheading: `Already registered (skipped)`
- Name input for unknown email `foo@bar.com`: `mat-label` text `Name for foo@bar.com`
- Confirm button text: `Confirm Registration`
- Cancel button text: `Cancel`

**Component state to add:**

```typescript
// Multi-select
storePlayerPool: PlayerDto[] = [];
selectedPlayerIds = new Set<number>();
playerFilterText = '';
get filteredPlayerPool() { return this.storePlayerPool.filter(p =>
  p.name.toLowerCase().includes(this.playerFilterText.toLowerCase()) ||
  p.email.toLowerCase().includes(this.playerFilterText.toLowerCase())
); }

// File/preview
showPreview = false;
previewData: BulkRegisterPreviewDto | null = null;
// Per-unknown-email: name input + include toggle
unknownNames: Record<string, string> = {};
unknownIncluded: Record<string, boolean> = {};
// Preview deselect: found players can be unchecked
previewSelected: Record<number, boolean> = {};

// Already-registered player ID set (built from the event's loaded EventPlayerDto[])
private registeredPlayerIds = new Set<number>();
```

**Methods:**

`onBulkFileSelected(event: Event)` — parses the file **client-side**:
```typescript
onBulkFileSelected(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const lines = (reader.result as string)
      .split('\n')
      .map(l => l.trim().toLowerCase())
      .filter(l => l.length > 0 && l !== 'email'); // skip empty + header

    const allPlayers = this.ctx.players.getAll();
    const found: BulkRegisterFoundDto[] = [];
    const notFound: string[] = [];
    const alreadyRegistered: BulkRegisterFoundDto[] = [];

    for (const email of lines) {
      const player = allPlayers.find(p => p.email.toLowerCase() === email);
      if (!player) {
        notFound.push(email);
      } else if (this.registeredPlayerIds.has(player.id)) {
        alreadyRegistered.push({ playerId: player.id, name: player.name, email: player.email });
      } else {
        found.push({ playerId: player.id, name: player.name, email: player.email });
      }
    }

    this.previewData = { found, notFound, alreadyRegistered };
    // Initialise all found rows as selected; all unknown rows as included
    this.previewSelected = Object.fromEntries(found.map(f => [f.playerId, true]));
    this.unknownNames    = Object.fromEntries(notFound.map(e => [e, '']));
    this.unknownIncluded = Object.fromEntries(notFound.map(e => [e, true]));
    this.showPreview = true;
    this.cdr.detectChanges();
  };
  reader.readAsText(file);
}
```

`onRegisterSelected()` — builds preview from `selectedPlayerIds` (no API call — IDs already resolved):
```typescript
onRegisterSelected(): void {
  const found: BulkRegisterFoundDto[] = [];
  const alreadyRegistered: BulkRegisterFoundDto[] = [];
  for (const id of this.selectedPlayerIds) {
    const player = this.ctx.players.getById(id);
    if (!player) continue;
    if (this.registeredPlayerIds.has(id)) {
      alreadyRegistered.push({ playerId: id, name: player.name, email: player.email });
    } else {
      found.push({ playerId: id, name: player.name, email: player.email });
    }
  }
  this.previewData = { found, notFound: [], alreadyRegistered };
  this.previewSelected = Object.fromEntries(found.map(f => [f.playerId, true]));
  this.showPreview = true;
  this.cdr.detectChanges();
}
```

`confirmBulkRegistration()` — builds `BulkRegisterConfirmDto` from preview selections + unknown names, calls `apiService.bulkRegisterConfirm()`, shows result snackbar, reloads event players.

`cancelPreview()` — sets `showPreview = false`, clears `previewData`, calls `cdr.detectChanges()`.

**Build `registeredPlayerIds` when event players load in `ngOnInit`:**
After loading event players (the `EventPlayerDto[]` the component already fetches), populate the set:
```typescript
this.registeredPlayerIds = new Set(this.eventPlayers.map(p => p.playerId));
```

**Load store player pool in `ngOnInit`:**
```typescript
this.storePlayerPool = this.ctx.players.getAll();
```
No new API endpoint needed — `ctx.players` is already scoped to the current store.

### Post-implementation checklist
- [ ] `/check-zone event-detail.component.ts`

---

## Backend Unit Tests (`src/TournamentOrganizer.Tests/`)

**`EventBulkRegisterTests`** — write before implementation:

- `BulkRegisterConfirmAsync_CreatesNewPlayerForUnknownEmail`
- `BulkRegisterConfirmAsync_RegistersExistingPlayer`
- `BulkRegisterConfirmAsync_SkipsFullyRegistered_ReturnsError`
- `BulkRegisterConfirmAsync_MissingNameForNewPlayer_ReturnsError`
- `BulkRegisterConfirmAsync_PartialSuccess_ReturnsCountsAndErrors`

Run with: `dotnet test --filter "FullyQualifiedName~EventBulkRegisterTests"`

---

## Frontend Unit Tests (Jest)

**`event-detail.component.spec.ts`** — add describe block `'Bulk Register'`:

- Upload File button visible for StoreEmployee when event is in Registration
- Upload File button NOT visible for Player role
- Register Selected button disabled when no players checked
- Register Selected button enabled when at least one player checked
- `onBulkFileSelected` reads file via FileReader, resolves emails against `ctx.players.getAll()`, and shows preview panel **without calling `apiService`**
- `onBulkFileSelected` puts player found in local cache in `previewData.found`
- `onBulkFileSelected` puts email not found in local cache in `previewData.notFound`
- `onBulkFileSelected` puts already-registered player in `previewData.alreadyRegistered`
- Preview panel shows found players with checkboxes
- Preview panel shows unknown emails with name input fields
- Preview panel shows already-registered players in skipped section
- `confirmBulkRegistration` calls `apiService.bulkRegisterConfirm` with correct payload
- Snackbar shows `"N registered, M new players created"` on success
- Cancel hides the preview panel
- Preview panel absent before file upload or Register Selected clicked

**Mocking `FileReader` in Jest:**
```typescript
// Fake FileReader that calls onload synchronously
class MockFileReader {
  result: string = '';
  onload: (() => void) | null = null;
  readAsText(file: File) {
    this.result = fakeFileContent;
    this.onload?.();
  }
}
(global as any).FileReader = MockFileReader;
```

Run with: `npx jest --config jest.config.js --testPathPatterns=event-detail`

---

## Playwright E2E Tests

**File: `e2e/events/event-detail.spec.ts`** — new file (none exists yet for event detail)

New helpers needed in `e2e/helpers/api-mock.ts`:
```typescript
mockGetEvent(page, event: EventDto)       // GET /api/events/:id
mockGetEventPlayers(page, eventId, players: EventPlayerDto[])  // GET /api/events/:id/players
mockBulkRegisterConfirm(page, eventId, response: BulkRegisterResultDto)   // POST .../confirm
makeEventPlayerDto(overrides?)            // fixture builder
makeBulkRegisterResultDto(overrides?)     // fixture builder
```

> Note: No `mockBulkRegisterPreview` helper is needed — the preview is built entirely client-side from the local player cache. The E2E test must seed `ctx.players` in localStorage **before** navigating so the browser-side lookup finds the players.

`loginAs` as `'StoreEmployee'` for all tests. Event status must be `'Registration'`.

**Seeding localStorage for E2E tests:**
Before navigating to `/events/1`, inject players into the store's localStorage namespace:
```typescript
await page.addInitScript((players) => {
  localStorage.setItem('to_store_1_players', JSON.stringify(players));
  localStorage.setItem('to_store_1_players_meta', JSON.stringify([]));
}, [
  { id: 10, name: 'Alice Manager', email: 'alice@shop.com', mu: 25, sigma: 8.333, conservativeScore: 0, isRanked: false, placementGamesLeft: 5 },
  { id: 11, name: 'Bob Player',    email: 'bob@example.com', mu: 25, sigma: 8.333, conservativeScore: 0, isRanked: false, placementGamesLeft: 5 },
]);
```

| Describe | beforeEach | Tests |
|---|---|---|
| `Event Detail — Bulk Register: upload file` | `loginAs('StoreEmployee')`, seed 2 players in localStorage, `mockGetEvent` (Registration), `mockGetEventPlayers([])` | Upload File button visible; file input present; setting file triggers preview panel (no network call fired for preview) |
| `Event Detail — Bulk Register: preview panel` | same + navigate to `/events/1`; file contains `alice@shop.com` (found) + `unknown@new.com` (not found) | "Preview Registration" heading visible; found players listed with checkboxes; "New players to create" section shows name input for `unknown@new.com`; "Already registered (skipped)" section visible |
| `Event Detail — Bulk Register: confirm` | `mockBulkRegisterConfirm({ registered: 2, created: 1, errors: [] })` | fill in unknown name → click Confirm → snackbar `"2 registered, 1 new players created"` visible; preview panel hidden |
| `Event Detail — Bulk Register: cancel` | preview showing | click Cancel → preview panel NOT visible |
| `Event Detail — Bulk Register: multi-select` | players seeded in localStorage | checkboxes render; Select All checks all; Register Selected enabled; clicking Register Selected shows preview |
| `Event Detail — Bulk Register: already registered` | seed player in localStorage + `mockGetEventPlayers` returns that player already registered | that player appears in "Already registered (skipped)" section of preview |
| `Event Detail — Bulk Register: role gate` | `loginAs('Player')` | Upload File button NOT visible; multi-select NOT visible |

Run with: `/e2e e2e/events/event-detail.spec.ts`

---

## Verification Checklist

- [ ] Failing tests confirmed red before implementation (TDD)
- [ ] `/build` — 0 errors
- [ ] `dotnet test --filter "FullyQualifiedName~EventBulkRegisterTests"` — all pass
- [ ] `npx jest --config jest.config.js --testPathPatterns=event-detail` — all pass
- [ ] `npx jest --config jest.config.js` — full suite green
- [ ] `/check-zone tournament-client/src/app/features/events/event-detail.component.ts` — clean
- [ ] `/e2e e2e/events/event-detail.spec.ts` — all pass
