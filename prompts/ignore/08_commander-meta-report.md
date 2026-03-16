# Feature: Commander Meta Report

## Context
Stores want insight into which commanders are dominating their local meta — what's being played, what's winning, and how the field is shifting. This adds a per-store meta analytics page showing commander popularity, win rates, and color identity breakdown derived from declared commander data.

**Dependencies:** `commander-declaration.md` must be implemented first.

---

## Requirements

- New page: `/stores/{id}/meta` (or a "Meta" tab on store detail, visible to all authenticated users)
- Date range filter: last 30 days, last 90 days, all time
- Sections:
  - **Most Played Commanders** (bar chart + table): commander name, games played, win rate, avg finish
  - **Color Identity Breakdown** (pie/donut chart): distribution of played colors (W/U/B/R/G/C)
  - **Win Rate by Color Pair** (table): pairs like WU, RG etc. ordered by win rate
- Commander color identity is parsed from a simple lookup or the player types it with their commander name (simplest: free-text, no card DB needed)
- Data is read-only; sourced from `EventRegistration.CommanderName` + `GameResult`

> **Note on color identity:** If commander-declaration stores only `CommanderName` (free text), color identity can be added later via a `CommanderColors` field or an optional card-database lookup. For this phase, include color only if the player also declares it; otherwise skip the color sections.

---

## Backend (`src/TournamentOrganizer.Api/`)

### New DTOs

```csharp
public record CommanderMetaEntryDto(
    string CommanderName,
    int TimesPlayed,
    int Wins,
    double WinRate,
    double AvgFinish
);

public record CommanderMetaReportDto(
    int StoreId,
    string Period,   // "30d" | "90d" | "all"
    List<CommanderMetaEntryDto> TopCommanders,
    Dictionary<string, int> ColorBreakdown    // "W" → 12, "U" → 7, etc.
);
```

### Service — `ICommanderMetaService` (new)

```csharp
Task<CommanderMetaReportDto> GetStoreMetaAsync(int storeId, string period);
```

- Filter events by `storeId` and date range derived from `period`
- Join `EventRegistration.CommanderName` + `GameResult.FinishPosition` via `PodPlayer → Pod → Round → Event`
- Group by `CommanderName`; compute `TimesPlayed`, `Wins`, `WinRate`, `AvgFinish`
- Order by `TimesPlayed` descending, return top 20

### Controller — new action on `StoresController`

```csharp
[HttpGet("{id}/meta")]
[Authorize]
public async Task<ActionResult<CommanderMetaReportDto>> GetMeta(int id, [FromQuery] string period = "30d")
{
    if (!await UserCanViewStoreMeta(id)) return Forbid();
    return Ok(await _commanderMetaService.GetStoreMetaAsync(id, period));
}
```

`UserCanViewStoreMeta`: Admin → any; StoreEmployee → their own store; others → Forbid.

### API Service (`core/services/api.service.ts`)

```typescript
getCommanderMeta(storeId: number, period: string = '30d'): Observable<CommanderMetaReportDto> {
  return this.http.get<CommanderMetaReportDto>(`${this.base}/stores/${storeId}/meta`, { params: { period } });
}
```

---

## Frontend (`tournament-client/src/app/`)

### Models (`core/models/api.models.ts`)

```typescript
export interface CommanderMetaEntryDto { commanderName: string; timesPlayed: number; wins: number; winRate: number; avgFinish: number; }
export interface CommanderMetaReportDto { storeId: number; period: string; topCommanders: CommanderMetaEntryDto[]; colorBreakdown: Record<string, number>; }
```

### New component: `features/stores/commander-meta.component.ts`

Route: `{ path: 'stores/:id/meta', loadComponent: ... }` — or a tab on `store-detail`.

**Template layout:**
```html
<div class="meta-controls">
  <mat-button-toggle-group [(ngModel)]="period" (change)="loadMeta()">
    <mat-button-toggle value="30d">Last 30 Days</mat-button-toggle>
    <mat-button-toggle value="90d">Last 90 Days</mat-button-toggle>
    <mat-button-toggle value="all">All Time</mat-button-toggle>
  </mat-button-toggle-group>
</div>

<h2>Most Played Commanders</h2>
<table mat-table [dataSource]="report?.topCommanders ?? []">
  <!-- Name, Played, Wins, Win%, Avg Finish columns -->
</table>

@if (report?.colorBreakdown) {
  <h2>Color Breakdown</h2>
  <canvas baseChart type="doughnut" [data]="colorChartData"></canvas>
}
```

Requires `ng2-charts` (same as `rating-history.md`).

### Post-implementation checklist
- [ ] `/check-zone commander-meta.component.ts`

---

## Backend Unit Tests

**`CommanderMetaServiceTests`**:
- `GetStoreMetaAsync_30d_FiltersToDateRange`
- `GetStoreMetaAsync_AllTime_IncludesAllEvents`
- `GetStoreMetaAsync_GroupsCorrectlyByCommanderName`
- `GetStoreMetaAsync_WinRateComputedCorrectly`
- `GetStoreMetaAsync_NoCommandersDeclared_ReturnsEmptyList`
- `GetStoreMetaAsync_LimitedToTop20`

Run with: `dotnet test --filter "FullyQualifiedName~CommanderMetaServiceTests"`

---

## Frontend Unit Tests (Jest)

**`commander-meta.component.spec.ts`** (new file):
- Table rendered with commander rows
- Period toggle calls `apiService.getCommanderMeta` with new period
- Win % formatted to 1 decimal place
- Empty state shown when no commanders

Run with: `npx jest --config jest.config.js --testPathPatterns=commander-meta`

---

## Playwright E2E Tests

**File: `e2e/stores/commander-meta.spec.ts`** (new file)

New helpers in `e2e/helpers/api-mock.ts`:
```typescript
mockGetCommanderMeta(page, storeId, period, response: CommanderMetaReportDto)
makeCommanderMetaReportDto(overrides?)  // fixture builder
```

`loginAs` as `'StoreEmployee'` for all tests.

| Describe | beforeEach | Tests |
|---|---|---|
| `Commander Meta — table` | `loginAs('StoreEmployee', { storeId: 1 })`, `mockGetCommanderMeta(1, '30d', { topCommanders: [{ commanderName: 'Atraxa', timesPlayed: 8, wins: 4, winRate: 50, avgFinish: 2.1 }] })` | "Atraxa" row visible; `"50.0%"` win rate shown; `"2.1"` avg finish shown |
| `Commander Meta — period toggle` | default period `30d` | clicking "Last 90 Days" toggle calls `GET .../meta?period=90d`; table refreshes |
| `Commander Meta — all time` | clicking "All Time" | calls `GET .../meta?period=all` |
| `Commander Meta — empty` | `{ topCommanders: [] }` | empty state message visible; no table rows |
| `Commander Meta — multiple commanders` | 5 commanders in response | all 5 rows rendered in order |

Run with: `/e2e e2e/stores/commander-meta.spec.ts`

---

## Verification Checklist
- [ ] `commander-declaration.md` fully implemented
- [ ] Failing tests red before implementation (TDD)
- [ ] No migration needed
- [ ] `/build` — 0 errors
- [ ] `dotnet test --filter "FullyQualifiedName~CommanderMetaServiceTests"` — all pass
- [ ] Frontend Jest tests pass
- [ ] `/check-zone commander-meta.component.ts` — clean
- [ ] `/e2e e2e/stores/commander-meta.spec.ts` — all pass
