# Test Coverage: [File or feature being covered]

## Context
<!-- One or two sentences: what exists but has no tests, and why coverage is being added now.
     Example: PlayerService was written before TDD was enforced. It has no spec file.
     Coverage is needed before the next refactor to prevent regressions. -->

**Implementation is complete and correct** — do NOT change production code.
**Goal:** write tests that would catch a real regression if the implementation broke.

---

## Files to Cover

| File | Spec file to create/extend | Already has spec? |
|---|---|---|
| `features/foo/foo.service.ts` | `features/foo/foo.service.spec.ts` | No — create |
| `features/foo/foo.component.ts` | `features/foo/foo.component.spec.ts` | Partial — extend |

---

## Backend Unit Tests (`src/TournamentOrganizer.Tests/`) *(if needed)*

<!-- Delete this section if backend already has coverage or is not in scope. -->

**Test class: `FooServiceTests`** (new file: `TournamentOrganizer.Tests/FooServiceTests.cs`)

### Happy path
- `GetAllAsync_ReturnsAllFoos` — repository returns 3 items, service returns 3 DTOs
- `GetByIdAsync_ReturnsCorrectFoo` — correct item mapped to DTO
- `CreateAsync_PersistsAndReturnsFoo` — repository `AddAsync` called with mapped entity
- `UpdateAsync_ModifiesExistingFoo` — repository `UpdateAsync` called with new values
- `DeleteAsync_RemovesFoo` — repository `DeleteAsync` called with correct id

### Edge / error cases
- `GetByIdAsync_ThrowsKeyNotFoundWhenMissing` *(or returns null — state which)*
- `CreateAsync_ThrowsWhenNameIsEmpty`
- `UpdateAsync_ThrowsWhenEntityNotFound`

Run with: `dotnet test --filter "FullyQualifiedName~FooServiceTests"`

---

## Frontend Unit Tests (Jest)

<!-- List every case as a single it(...) block. Be explicit: method name, condition, assertion.
     For each case, note how you'd break the implementation to confirm the test goes red. -->

**`features/foo/foo.service.spec.ts`** *(new file)*

### State / observable
- `players$` emits the current list on subscribe
- `loadAllPlayers() — online` calls `api.getPlayers()` and pushes result to `players$`
- `loadAllPlayers() — cached` skips the API call when LocalTable already has data
- `loadAllPlayers() — offline` falls back to LocalTable data when API throws

### Writes
- `registerPlayer() — online` calls `api.registerPlayer(dto)` and adds result to local table
- `registerPlayer() — offline` assigns negative ID and saves to local table without calling API
- `updatePlayer() — online` calls `api.updatePlayer(id, dto)` and updates local table
- `updatePlayer() — offline` updates local table without calling API

> **Regression check:** after writing each test, temporarily comment out the relevant
> line in the implementation and confirm the test goes red. Un-comment before moving on.

Run with: `npx jest --config jest.config.js --testPathPatterns=foo.service`

---

**`features/foo/foo.component.spec.ts`** *(extend existing or create new)*

### Rendering
- `renders player names from players$` — subject emits 2 items, both names in DOM
- `renders empty state when players$ emits []` — empty-state text visible

### User interactions
- `register() calls playerService.registerPlayer with correct args`
- `register() clears form on success`
- `register() shows snackbar on error`
- `startEdit() sets editingId and copies fields`
- `cancelEdit() clears editingId`
- `saveEdit() calls playerService.updatePlayer with edited values`
- `saveEdit() clears editingId on success`

### Role gating
- `register card hidden when isStoreEmployee is false`
- `edit button hidden when isStoreEmployee is false`

Run with: `npx jest --config jest.config.js --testPathPatterns=foo.component`

---

## Frontend E2E Tests (Playwright) *(only if component has no existing E2E coverage)*

**File: `e2e/foo/foo.spec.ts`** *(new file)*

> Only add E2E tests here if there is zero existing Playwright coverage for this component.
> If E2E tests already exist, unit tests above are sufficient.

Helpers needed in `e2e/helpers/api-mock.ts`:
- `mockGetFoos(page, foos: FooDto[])` — intercepts `GET /api/foo`
- `makeFooDto(overrides?)` — fixture builder

Minimum describe blocks for backfill coverage:

| Describe | Tests |
|---|---|
| `Foo — heading` | `<h2>Foos</h2>` visible |
| `Foo — populated` | renders name and key fields |
| `Foo — role UI: Player` | restricted controls not visible |
| `Foo — offline cache` | localStorage fallback renders cached data |

Run with: `/e2e e2e/foo/foo.spec.ts`

---

## Verification Checklist

- [ ] `/build` — 0 errors (no production code was changed)
- [ ] `dotnet test --filter "FullyQualifiedName~FooServiceTests"` — all pass *(if backend tests added)*
- [ ] `npx jest --config jest.config.js --testPathPatterns=foo` — all pass, no skipped tests
- [ ] Each test confirmed red when implementation is intentionally broken, then green when restored
- [ ] `/e2e e2e/foo/foo.spec.ts` — all pass *(if E2E tests added)*
