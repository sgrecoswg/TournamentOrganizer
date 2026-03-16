# Refactor: [Short description — one line]

## Context
<!-- One or two sentences: what is being restructured and why. No new behaviour is added.
     Example: PlayerService has grown to 400 lines with mixed concerns. Extract offline/cache logic
     into a dedicated PlayerCacheService so the service stays focused on API calls and state. -->

**Scope:** `path/to/file.ts` (and any directly affected files)
**Behaviour change:** None — all existing tests must stay green before and after.

---

## What Changes

<!-- List every structural change. Be concrete about names, signatures, and locations.
     Do NOT describe new behaviour — only restructuring of existing behaviour. -->

### Files to modify
- **`path/to/source.ts`** — describe what moves out or gets reorganised
- **`path/to/target.ts`** — describe what moves in or gets created

### Files to create *(if any)*
- **`path/to/new-file.ts`** — purpose and what it extracts from the source file

### Files to delete *(if any)*
- **`path/to/dead-file.ts`** — reason it is no longer needed

### What must NOT change
<!-- Explicit preservation contract — anything the refactor must leave untouched. -->
- Public API surface: method names, parameter types, return types
- Template selectors / CSS classes used by E2E tests
- localStorage keys and data shapes
- Existing test file structure (update import paths only)

---

## Backend (`src/TournamentOrganizer.Api/`) *(if needed)*

<!-- Delete this section if backend is not involved. -->

- **`Services/FooService.cs`** — extract `Bar` logic to `BarService`
- **`Program.cs`** — register new service as Scoped

---

## Frontend (`tournament-client/src/app/`) *(if needed)*

<!-- Delete this section if frontend is not involved. -->

- **`features/foo/foo.service.ts`** — remove extracted methods
- **`features/foo/foo-cache.service.ts`** — new file, receives extracted methods
- **`features/foo/foo.component.ts`** — inject new service, update call sites
- Update import paths in any spec files that reference moved symbols

### Post-refactor checklist
- [ ] Run `/check-zone` on every modified component

---

## Verification

<!-- No new tests needed for a pure refactor. The existing suite IS the verification. -->

**Existing tests must pass unchanged** (update import paths only, never test logic):

- [ ] `/build` — 0 errors on both .NET and Angular
- [ ] `dotnet test --filter "FullyQualifiedName~FooServiceTests"` — all pass *(if backend changed)*
- [ ] `npx jest --config jest.config.js --testPathPatterns=foo` — all pass, 0 changes to assertions
- [ ] `/e2e e2e/foo/foo.spec.ts` — all pass *(run the E2E suite for affected features)*
- [ ] `/check-zone` — no missing `cdr.detectChanges()` in modified components

<!-- If any test had to change beyond an import path fix, document why here: -->
**Test changes made (import paths only):**
- `foo.service.spec.ts` line 3: updated import from `./foo.service` to `./foo-cache.service`
