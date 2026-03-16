# Feature: Free Tier Player Cap per Event

## Context
Free tier stores use local storage only and have no paid subscription. To encourage upgrades, Free tier events are capped at a configurable maximum player count (default 16). Tier1+ stores have no cap. Admins are never capped.

**Dependency:** Implement `store-licensing-tiers.md` first.

---

## Requirements

- Free tier events: max **16 players** by default (make it a configurable constant, not hardcoded)
- Cap enforced server-side in `EventService.RegisterPlayerAsync` — return `400` with message `"Free tier events are limited to 16 players. Upgrade to Tier 1 to remove this limit."`
- Cap also enforced at event creation: if `maxPlayers` is null or > 16 on a Free store, clamp it to 16
- Tier1+ stores: no change to existing behaviour
- Frontend shows a notice on the event registration form when the store is Free tier and the cap is close: `"Free tier: up to 16 players per event"`

---

## Backend (`src/TournamentOrganizer.Api/`)

### Constant
Add to a new `src/TournamentOrganizer.Api/Constants/LicenseLimits.cs`:
```csharp
public static class LicenseLimits
{
    public const int FreeMaxPlayersPerEvent = 16;
}
```

### Service (`Services/EventService.cs`)
Inject `ILicenseTierService`.

**In `CreateEventAsync`:** if store's effective tier is `Free`, clamp `dto.MaxPlayers` to `LicenseLimits.FreeMaxPlayersPerEvent`.

**In `RegisterPlayerAsync`:** before adding the registration, check:
```csharp
var tier = await _licenseTierService.GetEffectiveTierAsync(storeId);
if (tier == LicenseTier.Free && currentPlayerCount >= LicenseLimits.FreeMaxPlayersPerEvent)
    throw new InvalidOperationException(
        $"Free tier events are limited to {LicenseLimits.FreeMaxPlayersPerEvent} players. Upgrade to Tier 1 to remove this limit.");
```

Controller maps `InvalidOperationException` → `400`.

---

## Frontend (`tournament-client/src/app/`)

### `event-detail.component.ts` — registration section
When `authService.licenseTier === 'Free'`, show a notice below the player count:
```html
@if (!authService.isTier1) {
  <p class="free-cap-notice">
    <mat-icon>info</mat-icon> Free tier: up to {{ FREE_CAP }} players per event.
  </p>
}
```

Export `FREE_CAP = 16` as a component constant (not hard-coded in template).

### Post-implementation checklist
- [ ] `/check-zone event-detail.component.ts`

---

## Backend Unit Tests

**`EventServiceTests`** — add:
- `CreateEvent_FreeTier_ClampsMaxPlayersTo16`
- `RegisterPlayer_FreeTier_AtCapacity_Throws`
- `RegisterPlayer_FreeTier_BelowCap_Succeeds`
- `RegisterPlayer_Tier1_BeyondFreeCap_Succeeds`

Run with: `dotnet test --filter "FullyQualifiedName~EventServiceTests"`

---

## Frontend Unit Tests (Jest)

**`event-detail.component.spec.ts`** — add:
- Free tier notice visible when `isTier1 = false`
- Free tier notice absent when `isTier1 = true`

---

## Playwright E2E Tests

**File: `e2e/events/event-detail.spec.ts`** — add to existing file (or create if it doesn't exist)

Uses existing `mockGetEvents`, `makeEventDto` helpers. No new helpers needed.

`loginAs` must support `licenseTier` option (see `store-licensing-tiers.md`).

| Describe | beforeEach | Tests |
|---|---|---|
| `Event Detail — Free tier cap notice` | `loginAs('StoreEmployee', { licenseTier: 'Free' })`, `mockGetEvents([...])`, navigate to `/events/1` | cap notice `"Free tier: up to 16 players per event"` is visible |
| `Event Detail — Tier1 no cap notice` | `loginAs('StoreEmployee', { licenseTier: 'Tier1' })` | cap notice is NOT visible |
| `Event Detail — Player no cap notice` | `loginAs('Player')` | cap notice is NOT visible (players don't see store tier messaging) |

Run with: `/e2e e2e/events/event-detail.spec.ts`

---

## Verification Checklist

- [ ] Failing tests red before implementation (TDD)
- [ ] `/build` — 0 errors
- [ ] `dotnet test --filter "FullyQualifiedName~EventServiceTests"` — all pass
- [ ] `npx jest --config jest.config.js --testPathPatterns=event-detail` — all pass
- [ ] `/check-zone event-detail.component.ts` — clean
- [ ] `/e2e e2e/events/event-detail.spec.ts` — all pass
