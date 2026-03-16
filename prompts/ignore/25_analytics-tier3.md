# Feature: Tier3 Analytics Dashboard

## Context
Store managers currently have no insight into event trends, player performance, or commander meta at their store. A Tier3 license tier adds an Analytics tab to the store detail page with charts and stats derived from existing game result data.

**Dependency:** Implement `store-licensing-tiers.md` first. Add `Tier3 = 3` to the `LicenseTier` enum.

---

## Requirements

- New `Tier3` license tier — add to enum, policies, JWT claim, and UI
- Analytics are scoped to a single store (only events with `storeId == this store`)
- All analytics computed server-side; frontend just renders the data
- Accessible only to `StoreManager`+ with `Tier3` license (Admin always sees it)
- Analytics tab appears in store detail alongside Settings / Employees / License / Data Management

### Analytics sections

| Section | Data shown |
|---|---|
| **Event Trends** | Events per month (bar chart), avg player count per event |
| **Win Rate by Commander** | Top 10 commanders ranked by win % across all games at this store |
| **Top Players (store)** | Top 10 players by total points earned at this store's events |
| **Pod Finish Distribution** | % of games ending in 1st / 2nd / 3rd / 4th at this store |
| **Most Played Colors** | Deck color frequency (WUBRG breakdown) from `deckColors` field |

---

## Backend (`src/TournamentOrganizer.Api/`)

### LicenseTier enum
Add `Tier3 = 3` to `Models/LicenseTier.cs`.

### DTOs (`DTOs/`)

New response shapes (no DB entities — all computed):
```csharp
public record StoreAnalyticsDto(
    List<EventTrendDto>        EventTrends,
    List<CommanderWinRateDto>  TopCommanders,
    List<StorePlayerStatsDto>  TopPlayers,
    FinishDistributionDto      FinishDistribution,
    List<ColorFrequencyDto>    ColorFrequency
);

public record EventTrendDto(int Year, int Month, int EventCount, double AvgPlayerCount);
public record CommanderWinRateDto(string CommanderName, int Wins, int GamesPlayed, double WinPercent);
public record StorePlayerStatsDto(int PlayerId, string PlayerName, int TotalPoints, int EventsPlayed);
public record FinishDistributionDto(double First, double Second, double Third, double Fourth);
public record ColorFrequencyDto(string ColorCode, int Count); // W/U/B/R/G/C
```

### Service (`Services/IStoreAnalyticsService`)
```csharp
Task<StoreAnalyticsDto> GetAnalyticsAsync(int storeId);
```

Queries via EF Core: joins `Store → StoreEvents → Event → Round → Pod → Game → GameResult`.
Register as `Scoped` in `Program.cs`.

### Controller
New `StoreAnalyticsController` at `GET /api/stores/{storeId}/analytics`:
- `[Authorize(Policy = "Tier3Required")]`
- Returns `StoreAnalyticsDto`

Add `"Tier3Required"` policy to `Program.cs`:
```csharp
options.AddPolicy("Tier3Required", p => p.RequireAssertion(ctx =>
    ctx.User.HasClaim("role", "Administrator") ||
    TierAtLeast(ctx.User, LicenseTier.Tier3)));
```

---

## Frontend (`tournament-client/src/app/`)

### Models (`core/models/api.models.ts`)
Add all analytics DTOs as TypeScript interfaces.

### API Service (`core/services/api.service.ts`)
```typescript
getStoreAnalytics(storeId: number): Observable<StoreAnalyticsDto> {
  return this.http.get<StoreAnalyticsDto>(`${this.base}/stores/${storeId}/analytics`);
}
```

### New Component (`features/stores/store-analytics.component.ts`)
Standalone component embedded as the Analytics tab in `store-detail.component.ts`.
Uses a charting library — **prefer a lightweight option** (e.g. `chart.js` via `ng2-charts`, or pure CSS bar charts to avoid adding a dependency). Decide at implementation time.

**Template structure:**
- Section heading: `<h3>Event Trends</h3>`, `<h3>Top Commanders</h3>`, etc.
- Loading state: `<mat-spinner>` while API call is in flight
- Empty state: `<p class="empty-state">Not enough data yet.</p>` when arrays are empty

### `store-detail.component.ts` — add Analytics tab
```html
@if (authService.isStoreManager && authService.isTier3) {
  <mat-tab label="Analytics">
    <app-store-analytics [storeId]="storeId" />
  </mat-tab>
} @else if (authService.isStoreManager) {
  <mat-tab label="Analytics">
    <app-tier-upgrade-prompt feature="Analytics" requiredTier="Tier 3" />
  </mat-tab>
}
```

### Auth Service (`core/services/auth.service.ts`)
Add getter:
```typescript
get isTier3(): boolean { return this.licenseTier === 'Tier3'; }
```

### Post-implementation checklist
- [ ] `/check-zone store-analytics.component.ts`
- [ ] `/check-zone store-detail.component.ts`

---

## Backend Unit Tests

**`StoreAnalyticsServiceTests`**
- `GetAnalyticsAsync_NoEvents_ReturnsEmptyCollections`
- `GetAnalyticsAsync_WithEvents_ReturnsCorrectEventTrends`
- `GetAnalyticsAsync_CalculatesCommanderWinRates`
- `GetAnalyticsAsync_CalculatesFinishDistribution`
- `GetAnalyticsAsync_OnlyIncludesEventsForRequestedStore`

Run with: `dotnet test --filter "FullyQualifiedName~StoreAnalyticsServiceTests"`

---

## Frontend Unit Tests (Jest)

**`store-analytics.component.spec.ts`** (new):
- loading spinner shown while API call pending
- event trends section rendered with correct month/count data
- top commanders section rendered with win %
- empty state shown when data arrays are empty

**`store-detail.component.spec.ts`** — add:
- Analytics tab visible for Tier3 StoreManager
- Upgrade prompt shown for Tier1/Tier2 StoreManager
- Analytics tab absent for Player role

Run with: `npx jest --config jest.config.js --testPathPatterns="store-analytics|store-detail"`

---

## Playwright E2E Tests

**New file: `e2e/stores/store-analytics.spec.ts`**

New helper needed in `e2e/helpers/api-mock.ts`:
```typescript
mockGetStoreAnalytics(page, storeId, response: StoreAnalyticsDto)
// intercepts GET /api/stores/{storeId}/analytics
makeStoreAnalyticsDto(overrides?)  // fixture builder with empty arrays as defaults
```

`loginAs` must support `licenseTier` option (see `store-licensing-tiers.md`).

| Describe | beforeEach | Tests |
|---|---|---|
| `Store Detail — Analytics tab: Tier3 visible` | `loginAs('StoreManager', { licenseTier: 'Tier3' })`, `mockGetStoreAnalytics(page, 1, analyticsData)` | Analytics tab visible; event trends section rendered; top commanders section rendered |
| `Store Detail — Analytics tab: upgrade prompt` | `loginAs('StoreManager', { licenseTier: 'Tier2' })` | Analytics tab visible but shows upgrade prompt text; `app-tier-upgrade-prompt` present |
| `Store Detail — Analytics tab: empty state` | `loginAs('StoreManager', { licenseTier: 'Tier3' })`, mock returns empty arrays | "Not enough data yet." text visible |
| `Store Detail — Analytics tab: Admin always sees` | `loginAs('Administrator')`, `mockGetStoreAnalytics` | Analytics tab visible; no upgrade prompt |
| `Store Detail — Analytics tab: Player absent` | `loginAs('Player')` | Analytics tab NOT visible |

Run with: `/e2e e2e/stores/store-analytics.spec.ts`

---

## Verification Checklist

- [ ] Failing tests red before implementation (TDD)
- [ ] `/build` — 0 errors
- [ ] `dotnet test --filter "FullyQualifiedName~StoreAnalyticsServiceTests"` — all pass
- [ ] `npx jest --config jest.config.js --testPathPatterns="store-analytics|store-detail"` — all pass
- [ ] `/check-zone` on new and modified components — clean
- [ ] `/e2e e2e/stores/store-analytics.spec.ts` — all pass
- [ ] `/e2e e2e/stores/store-detail.spec.ts` — all pass
