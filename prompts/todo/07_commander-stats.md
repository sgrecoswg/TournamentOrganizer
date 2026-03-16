# Feature: Commander Statistics

## Context
Once players are declaring commanders (see `commander-declaration.md`), per-commander win rates and performance stats become available. This adds a commander stats section on the player profile and a store-level commander popularity/meta report.

**Dependency:** `commander-declaration.md` must be implemented first.

---

## Requirements

- **Player profile** — "My Commanders" section: list of commanders the player has played, with games played, wins (1st place), average finish position
- **Commander detail** — clicking a commander shows all events where the player played it and per-event record
- Stats are computed from existing `EventRegistration.CommanderName` + `GameResult` data — no new tables

---

## Backend (`src/TournamentOrganizer.Api/`)

### New DTOs

```csharp
public record CommanderStatDto(
    string CommanderName,
    int GamesPlayed,
    int Wins,           // 1st place pod finishes
    double AvgFinish    // average finish position (lower = better)
);

public record PlayerCommanderStatsDto(
    int PlayerId,
    List<CommanderStatDto> Commanders
);
```

### Service (`Services/PlayerService.cs`)

**`GetCommanderStatsAsync(int playerId)`**
- Fetch all `EventRegistration` rows for the player where `CommanderName != null`
- For each registration: join `GameResult` rows via `PodPlayer → Pod → Round → Event`
- Group by `CommanderName`; compute `GamesPlayed`, `Wins` (FinishPosition == 1), `AvgFinish`
- Return `PlayerCommanderStatsDto`

### Controller (`Controllers/PlayersController.cs`)

```csharp
[HttpGet("{id}/commanderstats")]
[AllowAnonymous]
public async Task<ActionResult<PlayerCommanderStatsDto>> GetCommanderStats(int id)
{
    var result = await _playerService.GetCommanderStatsAsync(id);
    if (result == null) return NotFound();
    return Ok(result);
}
```

### API Service (`core/services/api.service.ts`)

```typescript
getCommanderStats(playerId: number): Observable<PlayerCommanderStatsDto> {
  return this.http.get<PlayerCommanderStatsDto>(`${this.base}/players/${playerId}/commanderstats`);
}
```

---

## Frontend (`tournament-client/src/app/`)

### Models (`core/models/api.models.ts`)

```typescript
export interface CommanderStatDto { commanderName: string; gamesPlayed: number; wins: number; avgFinish: number; }
export interface PlayerCommanderStatsDto { playerId: number; commanders: CommanderStatDto[]; }
```

### `player-profile.component.ts`

Load alongside profile in `ngOnInit` (non-fatal if fails — section hidden):

```typescript
commanderStats: CommanderStatDto[] = [];
```

**Template — My Commanders section:**
```html
@if (commanderStats.length) {
  <div class="commander-stats-section">
    <h3>My Commanders</h3>
    <table mat-table [dataSource]="commanderStats">
      <!-- Commander Name column -->
      <!-- Games Played column -->
      <!-- Wins column -->
      <!-- Win % column: (wins / gamesPlayed * 100).toFixed(1) -->
      <!-- Avg Finish column -->
    </table>
  </div>
}
```

Win % column: `{{ (row.wins / row.gamesPlayed * 100).toFixed(1) }}%` (guard against division by zero).

### Post-implementation checklist
- [ ] `/check-zone player-profile.component.ts`

---

## Backend Unit Tests

**`CommanderStatsTests`**:
- `GetCommanderStatsAsync_MultipleCommanders_ReturnsGroupedStats`
- `GetCommanderStatsAsync_SingleCommander_ComputesWinRateCorrectly`
- `GetCommanderStatsAsync_NoCommandersDeclared_ReturnsEmptyList`
- `GetCommanderStatsAsync_PlayerNotFound_ReturnsNull`
- `GetCommanderStatsAsync_AvgFinish_ComputedCorrectly`

Run with: `dotnet test --filter "FullyQualifiedName~CommanderStatsTests"`

---

## Frontend Unit Tests (Jest)

**`player-profile.component.spec.ts`** — add `'Commander Stats'` describe:
- Section rendered with commander rows when data present
- Win % computed correctly and displayed
- Section absent when `commanderStats` is empty

Run with: `npx jest --config jest.config.js --testPathPatterns=player-profile`

---

## Playwright E2E Tests

**File: `e2e/players/player-profile.spec.ts`** — add describe blocks

New helpers in `e2e/helpers/api-mock.ts`:
```typescript
mockGetCommanderStats(page, playerId, response: PlayerCommanderStatsDto)
makeCommanderStatDto(overrides?)  // fixture builder
```

| Describe | beforeEach | Tests |
|---|---|---|
| `Player Profile — Commander Stats: display` | `loginAs('Player')`, mock returns `{ commanders: [{ commanderName: 'Atraxa', gamesPlayed: 5, wins: 3, avgFinish: 1.8 }] }` | "My Commanders" heading visible; "Atraxa" row shown; win % `"60.0%"` shown |
| `Player Profile — Commander Stats: multiple` | 3 commanders in response | all 3 rows rendered |
| `Player Profile — Commander Stats: empty` | `{ commanders: [] }` | "My Commanders" section NOT visible |
| `Player Profile — Commander Stats: zero games guard` | commander with `gamesPlayed: 0` | win % shows `"0.0%"` not NaN or error |

Run with: `/e2e e2e/players/player-profile.spec.ts`

---

## Verification Checklist
- [ ] `commander-declaration.md` fully implemented
- [ ] Failing tests red before implementation (TDD)
- [ ] No migration needed
- [ ] `/build` — 0 errors
- [ ] `dotnet test --filter "FullyQualifiedName~CommanderStatsTests"` — all pass
- [ ] Frontend Jest tests pass
- [ ] `/check-zone player-profile.component.ts` — clean
- [ ] `/e2e e2e/players/player-profile.spec.ts` — all pass
