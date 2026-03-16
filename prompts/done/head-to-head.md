# Feature: Head-to-Head Record

## Context
Players want to know their personal record against specific opponents. All the data already exists in `GameResult` — this feature is purely a new read endpoint and a UI section on the player profile. No schema changes needed.

---

## Requirements

- On a player's profile, show a "Head-to-Head" section listing opponents they have faced with W/L/D record
- Sortable by: games played (default), win rate, opponent name
- Clicking an opponent navigates to that player's profile
- Endpoint is **public** — no auth required
- Minimum 1 shared game to appear in the list

---

## Backend (`src/TournamentOrganizer.Api/`)

### New DTO

```csharp
public record HeadToHeadDto(
    int OpponentId,
    string OpponentName,
    int Wins,     // times this player finished above opponent in same pod
    int Losses,   // times opponent finished above this player in same pod
    int Games     // total pods they shared
);
```

### Service (`Services/PlayerService.cs`)

**`GetHeadToHeadAsync(int playerId)`**
- Query all `GameResult` rows for pods where both `playerId` and opponent played in the same `PodId`
- For each shared pod: compare finish positions — lower position number = better finish
- Group by opponent; compute wins/losses/games
- Return `List<HeadToHeadDto>` ordered by `Games` descending

This is a pure read over existing `GameResult` / `PodPlayer` data.

### Controller (`Controllers/PlayersController.cs`)

```csharp
[HttpGet("{id}/headtohead")]
[AllowAnonymous]
public async Task<ActionResult<List<HeadToHeadDto>>> GetHeadToHead(int id)
{
    var result = await _playerService.GetHeadToHeadAsync(id);
    if (result == null) return NotFound();
    return Ok(result);
}
```

### API Service (`core/services/api.service.ts`)

```typescript
getHeadToHead(playerId: number): Observable<HeadToHeadDto[]> {
  return this.http.get<HeadToHeadDto[]>(`${this.base}/players/${playerId}/headtohead`);
}
```

---

## Frontend (`tournament-client/src/app/`)

### Models (`core/models/api.models.ts`)

```typescript
export interface HeadToHeadDto { opponentId: number; opponentName: string; wins: number; losses: number; games: number; }
```

### `player-profile.component.ts`

**New state:**
```typescript
headToHead: HeadToHeadDto[] = [];
h2hSortField: 'games' | 'winRate' | 'name' = 'games';
```

Load in `ngOnInit` alongside existing profile load:
```typescript
this.apiService.getHeadToHead(this.playerId).subscribe({
  next: (data) => { this.headToHead = data; this.cdr.detectChanges(); },
  error: () => { /* non-fatal — section hidden */ }
});
```

**Template — Head-to-Head section:**
```html
@if (headToHead.length) {
  <div class="h2h-section">
    <h3>Head-to-Head</h3>
    <table mat-table [dataSource]="sortedH2H">
      <ng-container matColumnDef="opponent">
        <th mat-header-cell *matHeaderCellDef>Opponent</th>
        <td mat-cell *matCellDef="let row">
          <a [routerLink]="['/players', row.opponentId, 'profile']">{{ row.opponentName }}</a>
        </td>
      </ng-container>
      <ng-container matColumnDef="record">
        <th mat-header-cell *matHeaderCellDef>W / L</th>
        <td mat-cell *matCellDef="let row">{{ row.wins }} / {{ row.losses }}</td>
      </ng-container>
      <ng-container matColumnDef="games">
        <th mat-header-cell *matHeaderCellDef>Games</th>
        <td mat-cell *matCellDef="let row">{{ row.games }}</td>
      </ng-container>
      <tr mat-header-row *matHeaderRowDef="['opponent','record','games']"></tr>
      <tr mat-row *matRowDef="let row; columns: ['opponent','record','games']"></tr>
    </table>
  </div>
}
```

**`sortedH2H` getter** sorts `headToHead` by `h2hSortField`.

### Post-implementation checklist
- [ ] `/check-zone player-profile.component.ts`

---

## Backend Unit Tests

**`HeadToHeadTests`**:
- `GetHeadToHeadAsync_TwoPlayersSharedPod_ReturnsCorrectWinsLosses`
- `GetHeadToHeadAsync_MultipleSharedPods_AccumulatesRecord`
- `GetHeadToHeadAsync_NoSharedPods_ReturnsEmpty`
- `GetHeadToHeadAsync_PlayerNotFound_ReturnsNull`

Run with: `dotnet test --filter "FullyQualifiedName~HeadToHeadTests"`

---

## Frontend Unit Tests (Jest)

**`player-profile.component.spec.ts`** — add `'Head-to-Head'` describe:
- Table rendered when `headToHead` is non-empty
- Section absent when `headToHead` is empty
- `apiService.getHeadToHead` called in ngOnInit
- Opponent name links to their profile

Run with: `npx jest --config jest.config.js --testPathPatterns=player-profile`

---

## Playwright E2E Tests

**File: `e2e/players/player-profile.spec.ts`** — add describe blocks

New helpers in `e2e/helpers/api-mock.ts`:
```typescript
mockGetHeadToHead(page, playerId, response: HeadToHeadDto[])  // GET /api/players/:id/headtohead
makeHeadToHeadDto(overrides?)  // fixture builder
```

| Describe | beforeEach | Tests |
|---|---|---|
| `Player Profile — Head-to-Head: table` | `loginAs('Player')`, `mockGetHeadToHead([{ opponentId: 2, opponentName: 'Bob', wins: 3, losses: 1, games: 4 }])` | "Head-to-Head" heading visible; row shows `"Bob"`, `"3 / 1"`, `"4"` |
| `Player Profile — Head-to-Head: opponent link` | same | clicking opponent name navigates to `/players/2/profile` |
| `Player Profile — Head-to-Head: empty` | `mockGetHeadToHead([])` | Head-to-Head section NOT visible |
| `Player Profile — Head-to-Head: multiple rows` | 3 opponents | all 3 rows rendered, ordered by games descending |

Run with: `/e2e e2e/players/player-profile.spec.ts`

---

## Verification Checklist
- [ ] Failing tests red before implementation (TDD)
- [ ] No migration needed
- [ ] `/build` — 0 errors
- [ ] `dotnet test --filter "FullyQualifiedName~HeadToHeadTests"` — all pass
- [ ] Frontend Jest tests pass
- [ ] `/check-zone player-profile.component.ts` — clean
- [ ] `/e2e e2e/players/player-profile.spec.ts` — all pass
