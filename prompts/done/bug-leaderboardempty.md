# Bug: 
Leaderboard empty when API is offline or unresponsive
## Summary
When naviagting to the leader board when the apiis offline/unresponsive, The leader boards is empty even though I see players when navigating to the `players` component

**Expected**: Show the players in order from highest rank to  lowest.
**Received**: `No ranked players yet. Players need 5 games to appear here.`

**Broken behaviour:** Empty leaderboard
**Expected behaviour:** The list of players ranked from highest to lowest
**Reproduction steps:**
1. API is offline
2. navigate to `/leaderboard`

---

## Root Cause
<!-- Fill in after diagnosis. One sentence naming the exact line/method/condition that causes the bug. -->
<!-- Example: `updateStatus()` in `event.service.ts` has no `catchError` for positive event IDs, so an offline API call throws instead of falling back to local state. -->

**File:** `tournament-client\src\app\features\leaderboard\leaderboard.component.ts` **Line:** 000
**Cause:** ...

---

## Fix

### Frontend (`tournament-client/src/app/`) *(if needed)*
- `tournament-client\src\app\features\leaderboard\leaderboard.component.ts`

- **`features/foo/foo.service.ts`** — describe the change (e.g. add `catchError` fallback to `updateStatus()`)
- **`features/foo/foo.component.ts`** — describe the change

### Post-fix checklist
- [ ] Run `/check-zone` on every modified component

---

## Frontend Unit Tests (Jest)

<!-- One failing `it(...)` per bullet that reproduces the bug BEFORE the fix, passes after.
     Be explicit: name the method, the condition, and the assertion. -->

**`tournament-client\src\app\features\leaderboard\leaderboard.component.spec.ts`** *(or component spec — wherever the bug lives)*

- `methodName() offline — completes without throwing` — reproduces the hang/throw
- `methodName() offline — updates local state` — asserts the fallback works
- `methodName() offline — emits on the relevant subject` — asserts subscribers see the change

Run with: `npx jest --config jest.config.js --testPathPatterns=foo.service`

---

## Frontend E2E Tests (Playwright) *(if the bug is visible in the UI)*

<!-- Only add E2E coverage if the bug manifests in a user-visible flow.
     One failing test that walks through the broken scenario end-to-end. -->

**File: `e2e/leaderboard/leaderboard.spec.ts`** *(create new)*

Helpers needed in `e2e/helpers/api-mock.ts`:
- `mockLeaderboardOffline(page)` — intercepts relevant API call with 500

Describe block / test:

| Describe | Test |
|---|---|
| `Foo — offline behaviour` | action X while API is down → UI shows Y, not error snackbar |

Run with: `/e2e e2e/Leaderboard/Leaderboard.spec.ts`
**All tests (new + existing in this file) must pass before the fix is considered done.**

---

## Verification Checklist

- [ ] `/build` — 0 errors on both .NET and Angular
- [ ] Failing test(s) written and confirmed red before touching implementation
- [ ] Implementation fix applied
- [ ] `dotnet test --filter "FullyQualifiedName~FooServiceTests"` — all pass *(if backend changed)*
- [ ] `npx jest --config jest.config.js --testPathPatterns=foo` — all pass
- [ ] `/e2e e2e/foo/foo.spec.ts` — all pass *(if E2E test added)*
- [ ] `/check-zone` — no missing `cdr.detectChanges()` in modified components
