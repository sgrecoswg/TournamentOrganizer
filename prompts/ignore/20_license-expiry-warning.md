# Feature: License Expiry Warning Banner

## Context
Store managers have no visibility into upcoming license expiry until it happens. This adds a prominent warning banner in the store detail page when the license is within a configurable threshold (default 30 days) of expiring, prompting action before the store loses paid features.

**Dependency:** Implement `store-licensing-tiers.md` first.

---

## Requirements

- Warning banner appears in the store detail header (above the tabs) when `daysUntilExpiry <= 30`
- Banner text: `"Your license expires in N days. Contact your administrator to renew."`
- When `daysUntilExpiry <= 7`: banner uses `warn` color (red) instead of `accent` (yellow)
- Banner is visible to `StoreManager` and `Administrator`
- Banner is not shown for Free tier stores (no expiry to warn about)
- Threshold (30 days) is a constant in the component, not hardcoded in the template

---

## Frontend only — no backend changes needed

`expiresDate` is already returned in `LicenseDto` and `StoreTierDto`.

### `store-detail.component.ts`

Add computed getter:
```typescript
get daysUntilExpiry(): number | null {
  if (!this.store?.license?.expiresDate) return null;
  const ms = new Date(this.store.license.expiresDate).getTime() - Date.now();
  return Math.ceil(ms / 86400000);
}
```

Add constant:
```typescript
readonly EXPIRY_WARN_DAYS = 30;
```

Add to template (above `<mat-tab-group>`):
```html
@if (daysUntilExpiry !== null && daysUntilExpiry <= EXPIRY_WARN_DAYS
     && (authService.isStoreManager || authService.isAdmin)) {
  <div class="expiry-banner" [class.expiry-critical]="daysUntilExpiry <= 7">
    <mat-icon>warning</mat-icon>
    @if (daysUntilExpiry > 0) {
      Your license expires in {{ daysUntilExpiry }} day{{ daysUntilExpiry === 1 ? '' : 's' }}.
      Contact your administrator to renew.
    } @else {
      Your license has expired. Contact your administrator to renew.
    }
  </div>
}
```

Add styles:
```scss
.expiry-banner {
  display: flex; align-items: center; gap: 8px;
  padding: 12px 16px; margin-bottom: 16px;
  background: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;
  mat-icon { color: #856404; }
}
.expiry-banner.expiry-critical {
  background: #f8d7da; border-left-color: #dc3545;
  mat-icon { color: #842029; }
}
```

### Post-implementation checklist
- [ ] `/check-zone store-detail.component.ts`

---

## Frontend Unit Tests (Jest)

**`store-detail.component.spec.ts`** — add:
- banner visible when `expiresDate` is 15 days away (within 30-day threshold)
- banner absent when `expiresDate` is 45 days away
- banner absent for Free tier (no `expiresDate`)
- banner uses `expiry-critical` class when `daysUntilExpiry <= 7`
- banner visible to StoreManager; absent for Player role

Run with: `npx jest --config jest.config.js --testPathPatterns=store-detail`

---

## Playwright E2E Tests

**File: `e2e/stores/store-detail.spec.ts`** — add to existing file

Mock `GET /api/stores/1` to return a `StoreDetailDto` whose `license.expiresDate` is set to a near-future date. Adjust the date per describe block.

`loginAs` must support `licenseTier` option (see `store-licensing-tiers.md`).

| Describe | beforeEach | Tests |
|---|---|---|
| `Store Detail — expiry warning: within 30 days` | `loginAs('StoreManager', { licenseTier: 'Tier1' })`, license expires in 15 days | banner with `"expires in 15 days"` visible; does NOT have `expiry-critical` class |
| `Store Detail — expiry warning: critical (≤7 days)` | `loginAs('StoreManager', { licenseTier: 'Tier1' })`, license expires in 5 days | banner has `.expiry-critical` class |
| `Store Detail — expiry warning: not shown >30 days` | `loginAs('StoreManager', { licenseTier: 'Tier1' })`, license expires in 45 days | banner NOT visible |
| `Store Detail — expiry warning: hidden for Player` | `loginAs('Player')` | banner NOT visible |
| `Store Detail — expiry warning: expired` | license `expiresDate` = yesterday | "Your license has expired" text visible |

Run with: `/e2e e2e/stores/store-detail.spec.ts`

---

## Verification Checklist

- [ ] Failing tests red before implementation (TDD)
- [ ] `/build` — 0 errors
- [ ] `npx jest --config jest.config.js --testPathPatterns=store-detail` — all pass
- [ ] `/check-zone store-detail.component.ts` — clean
- [ ] `/e2e e2e/stores/store-detail.spec.ts` — all pass
