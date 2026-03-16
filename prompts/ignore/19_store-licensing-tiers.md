# Feature: Multi-Tier Store Licensing

## Context
Stores currently have a single `License` record (active/inactive + date range) with no concept of feature tiers. This adds a `Tier` field to the license so stores unlock features progressively. Admins always have full access regardless of tier. Free stores use the existing local-storage-only offline mode; paid tiers unlock server-side persistence and advanced features.

---

## Tier Definitions

| Tier | Name | What it unlocks |
|---|---|---|
| `Free` | Free | Create and run events (local storage only, no server sync) |
| `Tier1` | Standard | Everything in Free + server sync, store customization (logo, theme, settings), employee/user management |
| `Tier2` | Premium | Everything in Tier1 + trade/wishlist write access, trade visibility at this store, suggested trade matching |

**Rules:**
- Administrator always bypasses all tier checks
- Expired license → auto-downgrade to Free (data preserved, features locked)
- Existing active licenses → default to `Tier2` on migration (backwards compatible)
- New stores with no license record → `Free`
- Tier enum is ordered numerically so `tier >= Tier1` checks work cleanly
- New tiers can be inserted by appending to the enum — no restructuring needed
- When a locked feature is accessed: show upgrade prompt in UI ("Upgrade to Tier 1 to unlock this feature"); API returns `403`

**Trade/Wishlist visibility (Tier2):**
- Any authenticated player can always manage (add/remove) their own wishlist and trade entries
- A player's trade/wishlist entries are **visible to others** only when viewed within a Tier2+ store context (viewer's JWT tier determines this)
- Suggested trade matching only returns candidates from players whose store has Tier2+ license
- The trade/wishlist section in player profiles is hidden when the viewing user's store is below Tier2

---

## Backend (`src/TournamentOrganizer.Api/`)

### Database / EF Core

**New `Models/LicenseTier.cs`:**
```csharp
public enum LicenseTier { Free = 0, Tier1 = 1, Tier2 = 2 }
```

**Modify `Models/License.cs`** — add field:
```csharp
public LicenseTier Tier { get; set; } = LicenseTier.Tier2;
```

**Run:** `/migrate AddLicenseTierToLicense`
- In the `Up()` method, before adding the column, set all existing rows to `Tier = 2`

### DTOs (`DTOs/`)

- **`LicenseDto`** (positional record) — append `LicenseTier Tier = LicenseTier.Tier2` as last param
- **`CreateLicenseDto`** — add `LicenseTier Tier = LicenseTier.Tier1` field
- **`UpdateLicenseDto`** — add `LicenseTier Tier` field
- **`StoreDto`** — append `LicenseTier? Tier = null` (null means no license = Free; populated for Admin list view)
- **New `StoreTierDto`** — lightweight response for tier endpoint:
  ```csharp
  public record StoreTierDto(int StoreId, LicenseTier Tier, bool IsActive, DateTime? ExpiresDate);
  ```

### Service — `ILicenseTierService` (new)

Single source of truth for effective tier resolution:

```csharp
public interface ILicenseTierService
{
    // Free if no license; Free if expired; otherwise license.Tier
    Task<LicenseTier> GetEffectiveTierAsync(int storeId);
}
```

Implementation reads `License` via `ILicenseRepository`. Register as `Scoped` in `Program.cs`.

Used by:
- `AuthService.GenerateJwt` to embed the `licenseTier` claim
- `SuggestedTradeService` to filter candidates to Tier2+ stores

### Authorization (`Program.cs`)

Add two new policies alongside the existing role policies:

```csharp
options.AddPolicy("Tier1Required", p => p.RequireAssertion(ctx =>
    ctx.User.HasClaim("role", "Administrator") ||
    TierAtLeast(ctx.User, LicenseTier.Tier1)));

options.AddPolicy("Tier2Required", p => p.RequireAssertion(ctx =>
    ctx.User.HasClaim("role", "Administrator") ||
    TierAtLeast(ctx.User, LicenseTier.Tier2)));

static bool TierAtLeast(ClaimsPrincipal user, LicenseTier required)
{
    var raw = user.FindFirstValue("licenseTier");
    return Enum.TryParse<LicenseTier>(raw, out var t) && t >= required;
}
```

### JWT (`Services/AuthService.cs`)

In `GenerateJwt`, for `StoreEmployee` / `StoreManager` roles:
```csharp
var tier = await _licenseTierService.GetEffectiveTierAsync(user.StoreId!.Value);
claims.Add(new Claim("licenseTier", tier.ToString()));
```
Admins get no `licenseTier` claim — policies check `role == Administrator` first.

### Controller changes

| Controller / Action | Current policy | New policy |
|---|---|---|
| `StoresController.Update` | `StoreManager` | `StoreManager` **+ Tier1Required** |
| `StoresController.UploadLogo` | `StoreEmployee` | `StoreEmployee` **+ Tier1Required** |
| `AppUsersController` (all employee routes) | `StoreManager` | `StoreManager` **+ Tier1Required** |
| `WishlistController` POST/DELETE/bulk | `Authorize` | **`Tier2Required`** |
| `TradeController` POST/DELETE/bulk | `Authorize` | **`Tier2Required`** |
| `SuggestedTradeController` both GETs | public | **`Tier2Required`** |

Note: `GET /api/themes` stays public. `GET /api/players/{id}/wishlist` and `GET trades` stay public (player can always view their own; frontend hides based on tier context).

**Filter `SuggestedTradeService`:** when building the candidate pool, join through `AppUser → Store → License` and filter to stores where `GetEffectiveTierAsync(storeId) >= Tier2`.

### New endpoint

`GET /api/stores/{storeId}/tier` — public, no auth required, returns `StoreTierDto`
Useful for the frontend to determine feature visibility before a JWT is available (e.g. public-facing store page).

---

## Frontend (`tournament-client/src/app/`)

### Models (`core/models/api.models.ts`)

```typescript
export type LicenseTier = 'Free' | 'Tier1' | 'Tier2';
```

- Extend `LicenseDto`: add `tier: LicenseTier`
- Extend `CurrentUser`: add `licenseTier?: LicenseTier`
- Add `StoreTierDto { storeId: number; tier: LicenseTier; isActive: boolean; expiresDate: string | null }`
- Extend `StoreDto`: add `tier?: LicenseTier | null`

### Auth Service (`core/services/auth.service.ts`)

Parse `licenseTier` JWT claim alongside existing claims. Add getters:

```typescript
get licenseTier(): LicenseTier {
  if (this.isAdmin) return 'Tier2';  // admins always full access
  return this.currentUserValue?.licenseTier ?? 'Free';
}
get isTier1(): boolean { return this.licenseTier === 'Tier1' || this.licenseTier === 'Tier2'; }
get isTier2(): boolean { return this.licenseTier === 'Tier2'; }
```

### Upgrade Prompt Component (`shared/components/tier-upgrade-prompt.component.ts`)

New small reusable component:

```typescript
@Input() requiredTier!: string;
@Input() feature!: string;
// Template:
<div class="tier-locked">
  <mat-icon>lock</mat-icon>
  <span>{{ feature }} requires {{ requiredTier }}. Contact your administrator to upgrade.</span>
</div>
```

Selector: `app-tier-upgrade-prompt`

### Feature gates in existing components

**`store-detail.component.ts`**

| Feature | Gate |
|---|---|
| Logo upload button | `authService.isStoreEmployee && authService.isTier1`; show `<app-tier-upgrade-prompt feature="Logo upload" requiredTier="Tier 1">` when employee but not Tier1 |
| Settings Save button | `authService.isStoreManager && authService.isTier1` |
| Theme dropdown | `authService.isStoreManager && authService.isTier1` |
| Employees tab | `authService.isStoreManager && authService.isTier1` |
| Data Sync / Pull buttons | `authService.isTier1`; show upgrade prompt for Free |

**`player-profile.component.ts`**

| Feature | Gate |
|---|---|
| Wishlist section | `authService.isTier2` (hides section entirely for Tier1/Free viewers) |
| Trade list section | `authService.isTier2` |
| Suggested trades section | `authService.isTier2` |
| Add/remove own wishlist/trade entries | always allowed (player manages own data) — the server enforces ownership via `Authorize` |

**`store-list.component.ts`** (Admin view only)

Add tier chip to each store card:
```html
@if (isAdmin && store.tier) {
  <mat-chip class="tier-badge">{{ store.tier }}</mat-chip>
}
```

**`store-detail.component.ts` — License tab** (Admin only additions)

- Add `mat-select` for `Tier` field when creating or updating a license
- Show current tier as a `mat-chip` badge visible to StoreManager (read-only for them)
- Show expiry warning banner when `expiresDate` is within 30 days:
  ```html
  @if (daysUntilExpiry <= 30) {
    <mat-card class="expiry-warning">
      <mat-icon>warning</mat-icon> License expires in {{ daysUntilExpiry }} days.
    </mat-card>
  }
  ```

### Post-implementation checklist
- [ ] `/check-zone` on all modified components

---

## Additional ideas for future tiers

- **Trial period**: New stores get a 30-day Tier2 trial — store `TrialExpiresDate` on `License`; `ILicenseTierService` returns trial tier if within trial window
- **Tier3 / Analytics**: Event analytics dashboard, win-rate breakdowns, commander meta stats per store
- **Player event cap**: Free tier could cap max players per event (e.g. 16); enforce in `EventService.CreateAsync`
- **Leaderboard always public**: Rankings remain public at all tiers — community engagement driver
- **Configurable grace period**: Add `GracePeriodDays` to License; `ILicenseTierService` uses this before dropping to Free on expiry

---

## Backend Unit Tests (`src/TournamentOrganizer.Tests/`)

**`LicenseTierServiceTests`** — write before implementing `LicenseTierService`:

- `GetEffectiveTierAsync_NoLicense_ReturnsFree`
- `GetEffectiveTierAsync_ExpiredLicense_ReturnsFree`
- `GetEffectiveTierAsync_ActiveTier1_ReturnsTier1`
- `GetEffectiveTierAsync_ActiveTier2_ReturnsTier2`
- `GetEffectiveTierAsync_ExpiryTomorrow_ReturnsCorrectTier`

Run with: `dotnet test --filter "FullyQualifiedName~LicenseTierServiceTests"`

---

## Frontend Unit Tests (Jest)

**`auth.service.spec.ts`** — add:
- JWT with `licenseTier: "Tier1"` → `isTier1 = true`, `isTier2 = false`
- JWT with `licenseTier: "Tier2"` → `isTier1 = true`, `isTier2 = true`
- JWT with no `licenseTier` → `isTier1 = false`, `isTier2 = false`, `licenseTier === 'Free'`
- Admin role → `isTier1 = true`, `isTier2 = true` regardless of claim

**`store-detail.component.spec.ts`** — add:
- Free tier: logo button absent, upgrade prompt visible
- Free tier: Settings Save absent, upgrade prompt visible
- Tier1: logo button present, no upgrade prompt
- Tier2: all features present
- License tab shows tier chip for StoreManager
- License tab shows tier selector dropdown for Admin
- Expiry warning visible when `expiresDate` is within 30 days

**`player-profile.component.spec.ts`** — add:
- `isTier2 = false` → wishlist/trade sections not rendered
- `isTier2 = true` → wishlist/trade sections rendered

Run with: `npx jest --config jest.config.js --testPathPatterns="auth.service|store-detail|player-profile"`

---

## Playwright E2E Tests

**Helper change required first:**
Extend `loginAs` in `e2e/helpers/auth.ts` to accept `licenseTier?: LicenseTier` and embed it as the `"licenseTier"` claim in the fake JWT payload. All tier-related E2E specs depend on this.

**`e2e/stores/store-detail.spec.ts`** — add describe blocks:

| Describe | beforeEach | Tests |
|---|---|---|
| `Store Detail — tier gate: Free` | `loginAs('StoreEmployee', { storeId: 1, licenseTier: 'Free' })`, `mockGetStore`, `stubUnmatchedApi` | logo button absent; upgrade prompt `"Logo upload requires Tier 1"` visible; Settings Save absent; sync buttons absent |
| `Store Detail — tier gate: Tier1` | `loginAs('StoreEmployee', { storeId: 1, licenseTier: 'Tier1' })` | logo button present; no upgrade prompt; Save button present; Employees tab visible |
| `Store Detail — tier gate: Admin` | `loginAs('Administrator')` | all features present; no upgrade prompts |
| `Store Detail — License tab: tier selector (Admin)` | `loginAs('Administrator')` | tier `mat-select` with options Free / Standard / Premium visible in license form |
| `Store Detail — License tab: tier badge (StoreManager)` | `loginAs('StoreManager', { storeId: 1, licenseTier: 'Tier1' })` | `mat-chip` with text `"Tier 1"` visible in License tab (read-only) |

**`e2e/player-profile/player-profile.spec.ts`** — add describe blocks (create file if it doesn't exist):

| Describe | beforeEach | Tests |
|---|---|---|
| `Player Profile — wishlist/trade: Tier2` | `loginAs('Player', { licenseTier: 'Tier2' })`, `mockGetPlayerProfile` | wishlist section visible; trade section visible; suggested trades section visible |
| `Player Profile — wishlist/trade: Free hidden` | `loginAs('Player', { licenseTier: 'Free' })` | wishlist section NOT visible; trade section NOT visible |
| `Player Profile — wishlist/trade: Tier1 hidden` | `loginAs('Player', { licenseTier: 'Tier1' })` | wishlist section NOT visible |

Run with:
- `/e2e e2e/stores/store-detail.spec.ts`
- `/e2e e2e/player-profile/player-profile.spec.ts`

---

## Verification Checklist

- [ ] Failing tests confirmed red before implementation (TDD)
- [ ] `/migrate AddLicenseTierToLicense` — applied; existing licenses set to Tier2
- [ ] `/build` — 0 errors
- [ ] `dotnet test --filter "FullyQualifiedName~LicenseTierServiceTests"` — all pass
- [ ] `npx jest --config jest.config.js --testPathPatterns="auth.service|store-detail|player-profile"` — all pass
- [ ] `npx jest --config jest.config.js` — full suite green
- [ ] `/check-zone` on all modified components — clean
- [ ] `/e2e e2e/stores/store-detail.spec.ts` — all pass
- [ ] `/e2e e2e/player-profile/player-profile.spec.ts` — all pass
