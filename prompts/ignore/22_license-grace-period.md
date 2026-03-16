# Feature: License Expiry Grace Period

## Context
When a license expires, stores currently drop to Free immediately. A configurable grace period lets stores continue using their paid features for N days after expiry before losing access — giving time to renew without disrupting an in-progress event.

**Dependency:** Implement `store-licensing-tiers.md` first.

---

## Requirements

- `License` gains a `GracePeriodDays` field (int, default `0` — zero means instant downgrade, preserving current behaviour)
- `ILicenseTierService.GetEffectiveTierAsync` returns the license's `Tier` during the grace window, then `Free` after it
- Grace period is per-license (Admin sets it when creating/updating)
- `StoreTierDto` includes `bool IsInGracePeriod` and `DateTime? GracePeriodEndsDate` so the frontend can display a warning
- Admin can set `GracePeriodDays = 0` on a license to disable grace period for that store

---

## Backend (`src/TournamentOrganizer.Api/`)

### Database / EF Core
- Add `public int GracePeriodDays { get; set; } = 0;` to `Models/License.cs`
- Run `/migrate AddGracePeriodDaysToLicense`

### DTOs
- `LicenseDto` — append `int GracePeriodDays = 0`
- `CreateLicenseDto` / `UpdateLicenseDto` — add `int GracePeriodDays = 0`
- `StoreTierDto` — add `bool IsInGracePeriod`, `DateTime? GracePeriodEndsDate`

### Service (`Services/LicenseTierService.cs`)
Extend `GetEffectiveTierAsync` to compute the grace window:
```csharp
if (license != null)
{
    var gracePeriodEnd = license.ExpiresDate.AddDays(license.GracePeriodDays);
    if (DateTime.UtcNow <= gracePeriodEnd)
        return license.Tier;  // still within grace
}
// expired and grace elapsed → Free
return LicenseTier.Free;
```

---

## Frontend (`tournament-client/src/app/`)

### Models
- `LicenseDto`: add `gracePeriodDays: number`
- `StoreTierDto`: add `isInGracePeriod: boolean`, `gracePeriodEndsDate?: string | null`

### `store-detail.component.ts` — License tab
Show grace period warning when `isInGracePeriod`:
```html
@if (storeTier?.isInGracePeriod) {
  <mat-card class="grace-warning">
    <mat-icon>warning</mat-icon>
    License expired. Grace period ends {{ storeTier.gracePeriodEndsDate | date:'mediumDate' }}.
    Renew now to avoid losing access.
  </mat-card>
}
```

Admin: add numeric input `Grace Period (days)` in the license form.

### Post-implementation checklist
- [ ] `/check-zone store-detail.component.ts`

---

## Backend Unit Tests

**`LicenseTierServiceTests`** — add:
- `GetEffectiveTierAsync_ExpiredWithinGrace_ReturnsLicenseTier`
- `GetEffectiveTierAsync_ExpiredBeyondGrace_ReturnsFree`
- `GetEffectiveTierAsync_GracePeriodZero_ExpiredReturnsFree`
- `GetEffectiveTierAsync_GracePeriodDays_ComputedCorrectly`

---

## Frontend Unit Tests (Jest)

**`store-detail.component.spec.ts`** — add:
- grace period warning visible when `isInGracePeriod = true`
- grace period warning absent when `isInGracePeriod = false`
- Admin form shows grace period input

---

## Playwright E2E Tests

**File: `e2e/stores/store-detail.spec.ts`** — add to existing file

Mock `GET /api/stores/1` to return a store whose `StoreTierDto` / license has `isInGracePeriod: true` and `gracePeriodEndsDate` set to a near-future date.

`loginAs` must support `licenseTier` option (see `store-licensing-tiers.md`).

| Describe | Tests |
|---|---|
| `Store Detail — License tab: grace period active` | grace warning card visible; shows `gracePeriodEndsDate` formatted date; "Renew now" text present |
| `Store Detail — License tab: grace period inactive` | grace warning absent when `isInGracePeriod = false` |
| `Store Detail — License tab: Admin grace controls` | `loginAs('Administrator')` → "Grace Period (days)" numeric input visible in license form |

Run with: `/e2e e2e/stores/store-detail.spec.ts`

---

## Verification Checklist

- [ ] Failing tests red before implementation (TDD)
- [ ] `/build` — 0 errors
- [ ] `dotnet test --filter "FullyQualifiedName~LicenseTierServiceTests"` — all pass
- [ ] `npx jest --config jest.config.js --testPathPatterns=store-detail` — all pass
- [ ] `/check-zone store-detail.component.ts` — clean
- [ ] `/e2e e2e/stores/store-detail.spec.ts` — all pass
