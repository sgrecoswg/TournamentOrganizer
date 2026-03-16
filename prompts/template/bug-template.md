# Bug: [Short description — one line]

## Summary
<!-- One or two sentences: what is broken, where it breaks, and what the user sees vs. what they expect. -->
<!-- Example: Clicking "Start Event" on an event with a positive ID throws a PUT 500 when the API is offline.
     Expected: event status updates locally and the UI reflects the change.
     Received: error snackbar, state unchanged. -->

**Broken behaviour:** [what actually happens]
**Expected behaviour:** [what should happen]
**Reproduction steps:**
1. ...
2. ...
3. ...

---

## Root Cause
<!-- Fill in after diagnosis. One sentence naming the exact line/method/condition that causes the bug. -->
<!-- Example: `updateStatus()` in `event.service.ts` has no `catchError` for positive event IDs, so an offline API call throws instead of falling back to local state. -->

**File:** `path/to/file.ts` **Line:** 000
**Cause:** ...

---

## Fix

### Backend (`src/TournamentOrganizer.Api/`) *(if needed)*
<!-- List every file to change. Delete section if backend is not involved. -->

- **`Controllers/FooController.cs`** — describe the change
- **`Services/FooService.cs`** — describe the change

### Frontend (`tournament-client/src/app/`) *(if needed)*
<!-- List every file to change. Delete section if frontend is not involved. -->

- **`features/foo/foo.service.ts`** — describe the change (e.g. add `catchError` fallback to `updateStatus()`)
- **`features/foo/foo.component.ts`** — describe the change

### Post-fix checklist
- [ ] Run `/check-zone` on every modified component

---

## Backend Unit Tests (`src/TournamentOrganizer.Tests/`) *(if needed)*

<!-- One failing test per bullet that reproduces the bug BEFORE the fix (red), then passes after (green). -->

**Test class: `FooServiceTests`** *(add to existing class or create new)*

- `MethodName_WhenCondition_DoesExpectedThing` — reproduces the bug
- `MethodName_WhenOtherCondition_DoesOtherThing` — related edge case

Run with: `dotnet test --filter "FullyQualifiedName~FooServiceTests"`

---

## Frontend Unit Tests (Jest)

<!-- One failing `it(...)` per bullet that reproduces the bug BEFORE the fix, passes after.
     Be explicit: name the method, the condition, and the assertion. -->

**`features/foo/foo.service.spec.ts`** *(or component spec — wherever the bug lives)*

- `methodName() offline — completes without throwing` — reproduces the hang/throw
- `methodName() offline — updates local state` — asserts the fallback works
- `methodName() offline — emits on the relevant subject` — asserts subscribers see the change

Run with: `npx jest --config jest.config.js --testPathPatterns=foo.service`

---

## Frontend E2E Tests (Playwright) *(if the bug is visible in the UI)*

<!-- Only add E2E coverage if the bug manifests in a user-visible flow.
     One failing test that walks through the broken scenario end-to-end. -->

**File: `e2e/foo/foo.spec.ts`** *(add to existing describe block or create new)*

Helpers needed in `e2e/helpers/api-mock.ts`:
- `mockFooOffline(page)` — intercepts relevant API call with 500

Describe block / test:

| Describe | Test |
|---|---|
| `Foo — offline behaviour` | action X while API is down → UI shows Y, not error snackbar |

Run with: `/e2e e2e/foo/foo.spec.ts`
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
