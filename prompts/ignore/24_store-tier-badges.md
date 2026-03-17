# Feature: Store Tier Badges on Store List

> **GitHub Issue:** [#29 feat: Store Tier Badges on Store List (Admin view)](https://github.com/sgrecoswg/TournamentOrganizer/issues/29)

## Context
Admins managing multiple stores have no at-a-glance view of which stores are on which license tier. This adds a tier chip/badge to each store card in the store list (Admin-only) and extends `StoreDto` to include the current effective tier.

**Dependency:** Implement `store-licensing-tiers.md` first.

---

## Requirements

- Each store card in `StoreListComponent` shows a tier chip when viewed by Admin: `Free`, `Tier 1`, or `Tier 2` (human-readable label)
- Chip color: `Free` = default, `Tier 1` = primary, `Tier 2` = accent
- Expired licenses show the chip color for Free (since effective tier = Free)
- Chip is **only visible to Administrator** role — Players and StoreEmployees do not see it
- `StoreDto` is extended to carry `tier?: LicenseTier | null` (null when store has no license = Free)

---

## Backend (`src/TournamentOrganizer.Api/`)

### DTOs
- `StoreDto` (positional record) — append `LicenseTier? Tier = null` as last param

### Service (`Services/StoresService.cs`)
Inject `ILicenseTierService`.

In `GetAllAsync`, for each store resolve its effective tier and populate `Tier`:
```csharp
var tier = store.LicenseId.HasValue
    ? await _licenseTierService.GetEffectiveTierAsync(store.Id)
    : LicenseTier.Free;
return new StoreDto(store.Id, store.StoreName, store.IsActive, store.LogoUrl, tier);
```

Note: `GetAllAsync` is a list call — be mindful of N+1. Load licenses eagerly via a join in `StoreRepository.GetAllAsync()` rather than calling `GetEffectiveTierAsync` per store in a loop.

### Repository (`Repositories/StoreRepository.cs`)
Ensure `GetAllAsync` uses `.Include(s => s.License)` so `StoresService` can resolve tier without extra queries.

---

## Frontend (`tournament-client/src/app/`)

### Models (`core/models/api.models.ts`)
`StoreDto` already has `tier?: LicenseTier | null` added in `store-licensing-tiers.md`.

### `store-list.component.ts`

Inject `AuthService`. Add tier label helper and chip color:
```typescript
tierLabel(tier: LicenseTier | null | undefined): string {
  switch (tier) {
    case 'Tier1': return 'Tier 1';
    case 'Tier2': return 'Tier 2';
    default:      return 'Free';
  }
}
tierColor(tier: LicenseTier | null | undefined): string {
  switch (tier) {
    case 'Tier1': return 'primary';
    case 'Tier2': return 'accent';
    default:      return '';
  }
}
```

Add to each store card template (Admin only):
```html
@if (authService.isAdmin) {
  <mat-chip class="tier-badge"
            [color]="tierColor(store.tier)" highlighted>
    {{ tierLabel(store.tier) }}
  </mat-chip>
}
```

### Post-implementation checklist
- [ ] `/check-zone store-list.component.ts`

---

## Backend Unit Tests

**`StoresServiceTests`** — add:
- `GetAllAsync_PopulatesTierFromLicense`
- `GetAllAsync_StoreWithNoLicense_TierIsFree`
- `GetAllAsync_StoreWithExpiredLicense_TierIsFree`

---

## Frontend Unit Tests (Jest)

**`store-list.component.spec.ts`** — add:
- Admin role: tier chip visible with label `Tier 2` for a Tier2 store
- Admin role: tier chip shows `Free` for store with null tier
- Player role: tier chip absent
- StoreEmployee role: tier chip absent

Run with: `npx jest --config jest.config.js --testPathPatterns=store-list`

---

## Playwright E2E Tests

**File: `e2e/stores/store-list.spec.ts`** — add to existing file

Uses existing `mockGetStores`, `makeStoreDto` helpers. Extend `makeStoreDto` to accept `tier?: LicenseTier`.

`loginAs` must support `licenseTier` option (see `store-licensing-tiers.md`).

| Describe | beforeEach | Tests |
|---|---|---|
| `Store List — tier badges: Admin` | `loginAs('Administrator')`, `mockGetStores([tier2Store, freeStore])` | Tier2 store shows `"Tier 2"` chip; store with `tier: null` shows `"Free"` chip |
| `Store List — tier badges: chip colors` | `loginAs('Administrator')`, `mockGetStores([tier1Store, tier2Store])` | Tier1 chip has `primary` color; Tier2 chip has `accent` color |
| `Store List — tier badges: Player hidden` | `loginAs('Player')`, `mockGetStores([tier2Store])` | tier chip NOT visible |
| `Store List — tier badges: StoreEmployee hidden` | `loginAs('StoreEmployee', { storeId: 1, licenseTier: 'Tier1' })`, `mockGetStores([tier1Store])` | tier chip NOT visible |

Run with: `/e2e e2e/stores/store-list.spec.ts`

---

## Verification Checklist

- [ ] Failing tests red before implementation (TDD)
- [ ] `/build` — 0 errors
- [ ] `dotnet test --filter "FullyQualifiedName~StoresServiceTests"` — all pass
- [ ] `npx jest --config jest.config.js --testPathPatterns=store-list` — all pass
- [ ] `/check-zone store-list.component.ts` — clean
- [ ] `/e2e e2e/stores/store-list.spec.ts` — all pass
