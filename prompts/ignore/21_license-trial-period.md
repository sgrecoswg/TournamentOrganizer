# Feature: License Trial Period

> **GitHub Issue:** [#26 feat: License Trial Period (30-day Tier2 for new stores)](https://github.com/sgrecoswg/TournamentOrganizer/issues/26)

## Context
New stores currently have no license and land on the Free tier immediately, which gives a poor first impression. This adds a 30-day Tier2 trial so new stores can evaluate all features before committing to a paid tier.

**Dependency:** Implement `store-licensing-tiers.md` first.

---

## Requirements

- When a store is created (by Admin), optionally start a Tier2 trial by setting `TrialExpiresDate`
- `ILicenseTierService.GetEffectiveTierAsync` returns `Tier2` during the trial window, regardless of the `License.Tier` value
- Trial expiry → drops to the store's actual `License.Tier` (Free if no license)
- Trial status is surfaced in the License tab and `StoreTierDto` so the UI can show "Trial ends in N days"
- Admin can manually end a trial early by clearing `TrialExpiresDate`

---

## Backend (`src/TournamentOrganizer.Api/`)

### Database / EF Core
- Add `public DateTime? TrialExpiresDate { get; set; }` to `Models/License.cs` (nullable — null means no trial)
- Run `/migrate AddTrialExpiresDateToLicense`

### DTOs
- `LicenseDto` — append `DateTime? TrialExpiresDate = null`
- `CreateLicenseDto` / `UpdateLicenseDto` — add `DateTime? TrialExpiresDate`
- `StoreTierDto` — add `bool IsInTrial`, `DateTime? TrialExpiresDate`

### Service (`Services/LicenseTierService.cs`)
Extend `GetEffectiveTierAsync`:
```csharp
// After resolving license:
if (license?.TrialExpiresDate != null && license.TrialExpiresDate > DateTime.UtcNow)
    return LicenseTier.Tier2;  // trial active — always Tier2
// ... then normal expiry/tier logic
```

### No controller changes needed
Admin already sets license fields via `PUT /api/stores/{storeId}/license`; just expose `TrialExpiresDate` through the existing DTO.

---

## Frontend (`tournament-client/src/app/`)

### Models (`core/models/api.models.ts`)
- `LicenseDto`: add `trialExpiresDate?: string | null`
- `StoreTierDto`: add `isInTrial: boolean`, `trialExpiresDate?: string | null`

### `store-detail.component.ts` — License tab
- Show trial badge when `isInTrial`:
  ```html
  @if (license?.isInTrial) {
    <mat-chip color="accent" highlighted>
      Trial — {{ trialDaysRemaining }} days remaining
    </mat-chip>
  }
  ```
- Admin: add date picker for `TrialExpiresDate` in the license form
- `trialDaysRemaining` getter: `Math.ceil((new Date(license.trialExpiresDate) - Date.now()) / 86400000)`

### Post-implementation checklist
- [ ] `/check-zone store-detail.component.ts`

---

## Backend Unit Tests

**`LicenseTierServiceTests`** — add:
- `GetEffectiveTierAsync_WithinTrial_ReturnsTier2`
- `GetEffectiveTierAsync_TrialExpired_ReturnsActualTier`
- `GetEffectiveTierAsync_NoTrialDate_UsesLicenseTier`

---

## Frontend Unit Tests (Jest)

**`store-detail.component.spec.ts`** — add:
- trial badge visible when `isInTrial = true` with correct days remaining
- trial badge absent when `isInTrial = false`

---

## Playwright E2E Tests

**File: `e2e/stores/store-detail.spec.ts`** — add to existing file

No new API-mock helpers needed. Mock `GET /api/stores/1` to return a `StoreDetailDto` with `license.isInTrial` and `license.trialExpiresDate` set.

`loginAs` must support `licenseTier` option (see `store-licensing-tiers.md`).

| Describe | Tests |
|---|---|
| `Store Detail — License tab: trial active` | trial badge visible; shows correct days remaining |
| `Store Detail — License tab: trial inactive` | trial badge absent when `isInTrial = false` |
| `Store Detail — License tab: Admin trial controls` | `loginAs('Administrator')` → trial expiry date picker visible in license form |

Run with: `/e2e e2e/stores/store-detail.spec.ts`

---

## Verification Checklist

- [ ] Failing tests red before implementation (TDD)
- [ ] `/build` — 0 errors
- [ ] `dotnet test --filter "FullyQualifiedName~LicenseTierServiceTests"` — all pass
- [ ] `npx jest --config jest.config.js --testPathPatterns=store-detail` — all pass
- [ ] `/check-zone store-detail.component.ts` — clean
- [ ] `/e2e e2e/stores/store-detail.spec.ts` — all pass
