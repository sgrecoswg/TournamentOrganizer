# Feature: Player Rating History Chart

> **GitHub Issue:** [#21 feat: Player Rating History Chart](https://github.com/sgrecoswg/TournamentOrganizer/issues/21)

## Context
A player's current TrueSkill rating gives no sense of their trajectory. A rating history chart shows `ConservativeScore` over time (one point per game), revealing improvement, slumps, and peak performance. All the data to compute this exists in `GameResult` — it just needs to be replayed chronologically.

---

## Requirements

- **Player profile** — "Rating History" section with a line chart of `ConservativeScore` over time
- One data point per game, ordered by `GameResult.CreatedAt` (or `Game.PlayedAt`)
- X-axis: date; Y-axis: conservative score
- Chart is interactive: hover shows date, score, event name
- Data is computed on-the-fly by replaying game results — no new table needed
- Chart library: **ng2-charts** (Chart.js wrapper) — already a common Angular pairing; add as dependency if not present

---

## Backend (`src/TournamentOrganizer.Api/`)

### Algorithm

Replay TrueSkill from the beginning using the existing `TrueSkillCalculator`:
1. Start player at `Mu = 25.0, Sigma = 8.333`
2. Fetch all `GameResult` rows for the player ordered by `CreatedAt` ascending
3. For each result: call `TrueSkillCalculator.CalculateNewRatings` with pod participants + finish positions
4. Record `(date, ConservativeScore)` snapshot after each game

### New DTO

```csharp
public record RatingSnapshotDto(DateTime Date, double ConservativeScore, string EventName, int RoundNumber);
public record RatingHistoryDto(int PlayerId, List<RatingSnapshotDto> History);
```

### Service (`Services/PlayerService.cs`)

**`GetRatingHistoryAsync(int playerId)`**
- Fetch player's game results ordered by `CreatedAt` ascending, including pod participants
- Replay TrueSkill game by game; record snapshot after each
- Return `RatingHistoryDto`

> Note: This is O(n) over the player's game history. For players with 100+ games this may be slow. Consider caching the result or adding a `RatingSnapshot` materialized table later if needed.

### Controller (`Controllers/PlayersController.cs`)

```csharp
[HttpGet("{id}/ratinghistory")]
[AllowAnonymous]
public async Task<ActionResult<RatingHistoryDto>> GetRatingHistory(int id)
{
    var result = await _playerService.GetRatingHistoryAsync(id);
    if (result == null) return NotFound();
    return Ok(result);
}
```

### API Service (`core/services/api.service.ts`)

```typescript
getRatingHistory(playerId: number): Observable<RatingHistoryDto> {
  return this.http.get<RatingHistoryDto>(`${this.base}/players/${playerId}/ratinghistory`);
}
```

---

## Frontend (`tournament-client/src/app/`)

### Dependency

Add if not already installed:
```bash
npm install ng2-charts chart.js
```
Import `BaseChartDirective` from `ng2-charts` in the player-profile module/standalone imports.

### Models (`core/models/api.models.ts`)

```typescript
export interface RatingSnapshotDto { date: string; conservativeScore: number; eventName: string; roundNumber: number; }
export interface RatingHistoryDto  { playerId: number; history: RatingSnapshotDto[]; }
```

### `player-profile.component.ts`

**New state:**
```typescript
ratingHistory: RatingSnapshotDto[] = [];
ratingChartData: ChartData<'line'> = { datasets: [] };
ratingChartOptions: ChartOptions<'line'> = {
  responsive: true,
  plugins: { tooltip: { callbacks: {
    label: (ctx) => `Score: ${ctx.parsed.y.toFixed(2)}`
  }}}
};
```

Load in `ngOnInit` (non-fatal):
```typescript
this.apiService.getRatingHistory(this.playerId).subscribe({
  next: (data) => {
    this.ratingHistory = data.history;
    this.ratingChartData = {
      labels: data.history.map(s => new Date(s.date).toLocaleDateString()),
      datasets: [{ data: data.history.map(s => s.conservativeScore), label: 'Rating', fill: false, tension: 0.3 }]
    };
    this.cdr.detectChanges();
  }
});
```

**Template:**
```html
@if (ratingHistory.length > 1) {
  <div class="rating-history-section">
    <h3>Rating History</h3>
    <canvas baseChart
            [data]="ratingChartData"
            [options]="ratingChartOptions"
            type="line">
    </canvas>
  </div>
}
```

### Post-implementation checklist
- [ ] `/check-zone player-profile.component.ts`

---

## Backend Unit Tests

**`RatingHistoryTests`**:
- `GetRatingHistoryAsync_TwoGames_ReturnsTwoSnapshots`
- `GetRatingHistoryAsync_ScoresReplayedChronologically`
- `GetRatingHistoryAsync_NoGames_ReturnsEmptyHistory`
- `GetRatingHistoryAsync_PlayerNotFound_ReturnsNull`
- `GetRatingHistoryAsync_SnapshotConservativeScoreMatchesExpectedFormula`

Run with: `dotnet test --filter "FullyQualifiedName~RatingHistoryTests"`

---

## Frontend Unit Tests (Jest)

**`player-profile.component.spec.ts`** — add `'Rating History'` describe:
- Chart section rendered when `ratingHistory` has 2+ entries
- Chart section absent when history has 0 or 1 entries
- `apiService.getRatingHistory` called in ngOnInit
- Chart data mapped correctly from history snapshots

Run with: `npx jest --config jest.config.js --testPathPatterns=player-profile`

---

## Playwright E2E Tests

**File: `e2e/players/player-profile.spec.ts`** — add describe blocks

New helpers in `e2e/helpers/api-mock.ts`:
```typescript
mockGetRatingHistory(page, playerId, response: RatingHistoryDto)
makeRatingSnapshotDto(overrides?)  // fixture builder
```

| Describe | beforeEach | Tests |
|---|---|---|
| `Player Profile — Rating History: chart shown` | `loginAs('Player')`, mock returns history with 3 snapshots | `.rating-history-section` visible; `<canvas>` element present |
| `Player Profile — Rating History: hidden with < 2 points` | history with 1 snapshot | `.rating-history-section` NOT visible |
| `Player Profile — Rating History: empty` | `{ history: [] }` | section NOT visible |

> Note: Chart rendering is handled by Chart.js canvas — do not assert pixel content; assert the container and canvas element presence only.

Run with: `/e2e e2e/players/player-profile.spec.ts`

---

## Verification Checklist
- [ ] Failing tests red before implementation (TDD)
- [ ] No migration needed
- [ ] `npm install ng2-charts chart.js` — done
- [ ] `/build` — 0 errors
- [ ] `dotnet test --filter "FullyQualifiedName~RatingHistoryTests"` — all pass
- [ ] Frontend Jest tests pass
- [ ] `/check-zone player-profile.component.ts` — clean
- [ ] `/e2e e2e/players/player-profile.spec.ts` — all pass
