# Feature: [Feature Name]

## Context
Given a user is on the player details page 
When the api si offline (un responsive) 
Then hide the history and trading tabs


---

## Requirements
- User is on the `tournament-client\src\app\features\player-profile\player-profile.component.ts`
- API is offline, if the api is online we don;t want to do this
- Tabs are hidden from the users

## Frontend (`tournament-client/src/app/`)

### Components
- [Edit] `tournament-client\src\app\features\player-profile\player-profile.component.ts` to not show the tabs when api is off line
  - Route: `/players/:id`
  - History tab line 77-127
  - Trading tab 130-331

### Post-implementation checklist
- [ ] Run `/check-zone` on every new or modified component

---

## Frontend Unit Tests (Jest)

<!-- Describe the spec file(s) and the cases to cover BEFORE touching component code (TDD).
     Each bullet is one `it(...)` or `test(...)` block. -->

**`tournament-client\src\app\features\player-profile\player-profile.component.spec.ts`**

Online path:
- calls `playerService.getProfile()` on init line 425
- renders player info
- renders History and Trading tab
- calls this.loadWishlist(id),this.loadWishlistSupply(id),this.loadTradeList(id),this.loadSuggestedTrades(id),this.loadTradeDemand(id);

Offline / error path:
- `playerService.getProfile()` error → History and Trading tab 
- component still renders cached player info when API is down

Run with: `npx jest --config jest.config.js --testPathPatterns=player-profile.component`

---

## Frontend E2E Tests (Playwright)

<!-- Describe the spec file and every describe block. Be explicit about selectors so the spec matches the template exactly. -->

**File: `tournament-client\e2e\players\players.spec.ts`**

Helpers needed in `e2e/helpers/api-mock.ts`:
- `mockGetFoos(page, foos: FooDto[])` — intercepts `GET /api/foo`
- `makeFooDto(overrides?)` — fixture builder

Run with: `/e2e e2e/players/players.spec.ts`
**All tests must pass before the task is considered done.**

---

## Verification Checklist
- [ ] `npx jest --config jest.config.js --testPathPatterns=player-profile` — all pass
- [ ] `/e2e e2e/players/players.spec.ts` — all pass
- [ ] `/check-zone` — no missing `cdr.detectChanges()` calls in new components
