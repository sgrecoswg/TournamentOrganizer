# Feature: Registration verification

## Context
When a player registers for an event we need to make sure they are not also registered for another event at the same time to prevetn no shows and having to drop them.
<!-- Example: Players currently cannot register for events when the API is offline. This adds local-first registration so the action is queued and synced later. -->

---

## Requirements
**dependency** add_event_time.md should be done first
<!-- Bullet list of the concrete behaviour this feature must deliver. Be specific about roles, UI text, field names, API contracts, and edge cases. Vague requirements cause wasted planning. -->

- ...
- ...

---

## Backend (`src/TournamentOrganizer.Api/`)

<!-- List every file to create or change. Use the sub-sections that apply; delete the rest. -->

### Database / EF Core
<!-- New tables, columns, or relationship changes. Use the exact column names and types that match the C# model. -->
- New entity `Foo` (`Id int PK`, `Name string`, `StoreId int FK → Store.Id`, ...)
- Add `DbSet<Foo>` to `AppDbContext`
- Run `/migrate AddFoo`

### Models / Entities (`Models/`)
- `Foo.cs` — new EF Core entity

### DTOs (`DTOs/`)
- `FooDto` — request/response shape (list all fields)
- `CreateFooDto` — POST body shape

### Repository (`Repositories/`)
- `IFooRepository` / `FooRepository` — methods: `GetAllAsync()`, `GetByIdAsync(id)`, `AddAsync(dto)`, `UpdateAsync(dto)`, `DeleteAsync(id)`

### Service (`Services/`)
- `IFooService` / `FooService` — business logic methods (describe each)
- Register `IFooRepository`, `IFooService` as Scoped in `Program.cs`

### Controller (`Controllers/`)
- `FooController` at `/api/foo`
  - `GET /api/foo` → returns `FooDto[]`
  - `GET /api/foo/{id}` → returns `FooDto`
  - `POST /api/foo` → creates, returns `FooDto`
  - `PUT /api/foo/{id}` → updates, returns `FooDto`
  - `DELETE /api/foo/{id}` → removes, returns `204`

---

## Frontend (`tournament-client/src/app/`)

<!-- List every file to create or change. -->

### Models (`core/models/api.models.ts`)
- Add `FooDto { id: number; name: string; ... }`
- Add `CreateFooDto { name: string; ... }`

### API Service (`core/services/api.service.ts`)
- Add `getFoos(): Observable<FooDto[]>`
- Add `createFoo(dto: CreateFooDto): Observable<FooDto>`
- Add `updateFoo(id: number, dto: CreateFooDto): Observable<FooDto>`
- Add `deleteFoo(id: number): Observable<void>`

### Feature Service (`features/foo/foo.service.ts`) *(if needed)*
- Local-first / offline behaviour notes (e.g. negative-ID pattern, cache keys, catchError fallback)

### Components
- **`features/foo/foo-list.component.ts`** — standalone; lists items; role-based create form; remove button
  - Template selectors to use (for test alignment):
    - Heading: `<h2>Foos</h2>`
    - Form card title: `Create New Foo`
    - Name input label: `Foo Name`
    - Create button text: `Create Foo`
    - Empty state: `No foos yet.`
    - Remove button text: `Remove`
- **`features/foo/foo-detail.component.ts`** — standalone; form with Save; role-gated save button
  - Route: `/foo/:id`

### Routing (`app.routes.ts`)
- Add `{ path: 'foo', component: FooListComponent }`
- Add `{ path: 'foo/:id', component: FooDetailComponent }`

### Navigation (`app.html`)
- Add nav link `routerLink="/foo"` with label `Foos` (guard with `@if (isStoreEmployee)` if role-restricted)

### Post-implementation checklist
- [ ] Run `/check-zone` on every new or modified component

---

## Backend Unit Tests (`src/TournamentOrganizer.Tests/`)

<!-- Describe the test class and the cases to cover BEFORE writing the service code (TDD). -->

**Test class: `FooServiceTests`**

- `GetAllAsync_ReturnsAllFoos`
- `CreateAsync_PersistsAndReturnsFoo`
- `UpdateAsync_ModifiesExistingFoo`
- `DeleteAsync_RemovesFoo`
- `GetByIdAsync_ThrowsWhenNotFound` *(or returns null — state which)*

Run with: `dotnet test --filter "FullyQualifiedName~FooServiceTests"`

---

## Frontend Unit Tests (Jest)

<!-- Describe the spec file(s) and the cases to cover BEFORE touching component code (TDD).
     Each bullet is one `it(...)` or `test(...)` block. -->

**`features/foo/foo-list.component.spec.ts`**

Online path:
- calls `fooService.loadAll()` on init
- renders each foo name from `foos$`
- Create button disabled when name is empty
- clicking Create calls `fooService.create()` with the correct args
- snackbar shows "Foo created!" on success

Offline / error path:
- `fooService.create()` error → snackbar shows error message
- component still renders cached foos when API is down

Run with: `npx jest --config jest.config.js --testPathPatterns=foo-list.component`

---

## Frontend E2E Tests (Playwright)

<!-- Describe the spec file and every describe block. Be explicit about selectors so the spec matches the template exactly. -->

**File: `e2e/foo/foo-list.spec.ts`**

Helpers needed in `e2e/helpers/api-mock.ts`:
- `mockGetFoos(page, foos: FooDto[])` — intercepts `GET /api/foo`
- `makeFooDto(overrides?)` — fixture builder

Describe blocks:

| Describe | Tests |
|---|---|
| `Foo List — heading` | shows `<h2>Foos</h2>` |
| `Foo List — empty state` | shows "No foos yet.", no cards |
| `Foo List — populated` | renders name, clicking card navigates to `/foo/:id` |
| `Foo List — role UI: Player` | no create form, no Remove button |
| `Foo List — role UI: StoreEmployee` | create form visible; Create disabled when name empty; enabled when filled |
| `Foo List — create (happy path)` | POST → snackbar "Foo created!" → card appears → form cleared |
| `Foo List — remove (happy path)` | DELETE → snackbar "Foo removed" → card gone |
| `Foo List — offline cache` | pre-seed `to_store_1_foos` localStorage → API 500 → cached items shown |

Run with: `/e2e e2e/foo/foo-list.spec.ts`
**All tests must pass before the task is considered done.**

---

## Verification Checklist

- [ ] `/build` — 0 errors on both .NET and Angular
- [ ] `dotnet test --filter "FullyQualifiedName~FooServiceTests"` — all pass
- [ ] `npx jest --config jest.config.js --testPathPatterns=foo` — all pass
- [ ] `/e2e e2e/foo/foo-list.spec.ts` — all pass
- [ ] `/check-zone` — no missing `cdr.detectChanges()` calls in new components

---
## Prompt Refinement Suggestions

### Token Efficiency
- The entire Backend, Frontend, and Test sections are `Foo` placeholder boilerplate — never filled in. They add ~80 tokens of noise and will cause the assistant to either ignore them or implement the wrong thing. Delete everything from `## Backend` down and replace with actual specifics.
- The only real requirement is one sentence in the Context section. The Requirements section has no concrete bullets (just `- ...`). This forces the assistant to infer all the rules, which wastes planning tokens on questions that should be pre-answered.
- **Dependency note is good** — keeping `**dependency** add_event_time.md should be done first` is useful and should stay.

### Anticipated Questions (pre-answer these to skip back-and-forth)
- Q: What counts as a "clash"? Two events overlap if their time windows overlap, or just if they start within the same time slot? → Define the exact rule (e.g. "a player may not be registered for two events whose `Date` falls within 4 hours of each other").
- Q: Is this a hard block (API returns 400) or a soft warning (UI shows a warning but still allows registration)?
- Q: Does this apply to self-registration only, or also to store-employee registration on behalf of a player?
- Q: Where does the clash check live — in `EventService.RegisterPlayerAsync` (backend) or in the frontend before the API call, or both?
- Q: What is the API error message shown to the user when a clash is detected? (Needed for Jest/E2E assertions.)
- Q: Does the clash check consider dropped/disqualified/waitlisted registrations as "active" for the purposes of blocking? (Probably not — dropped players should be able to re-register elsewhere.)
- Q: What repository query is needed? `IPlayerRepository.GetPlayerEventRegistrationsAsync(playerId)` already exists — does it return enough data (event date/time) to perform the check, or does it need to be extended?

### Missing Context
- No definition of "same time" — this is the entire logic of the feature and is completely unspecified.
- No error message text specified — needed for test assertions.
- No UI behaviour described: does the registration button become disabled? Is there a validation message before the API call? Or is it purely a backend 400 with a snackbar?
- The dependency on `add_event_time.md` is noted but the reason is implicit — spell it out: "the clash check requires `Event.Date` to carry time-of-day, which `add_event_time.md` adds."

### Optimized Prompt
> **Feature: Block registration when player has a time clash**
>
> **Depends on**: `add_event_time.md` (event Date must carry time-of-day before this can work).
>
> **Clash rule**: A player cannot register for Event B if they are already actively registered for Event A whose `Date` is within [X hours] of Event B's `Date`. Dropped, disqualified, and waitlisted registrations do not count as active.
>
> **Backend** (`EventService.RegisterPlayerAsync`, `src/TournamentOrganizer.Api/Services/EventService.cs`)
> - After confirming the player is not already registered, load the player's active registrations via `IPlayerRepository.GetPlayerEventRegistrationsAsync(playerId)` (already exists).
> - For each active registration, compare the event's `Date` to the new event's `Date`; throw `InvalidOperationException("Player is already registered for an event at this time.")` if a clash is found.
> - No new migration, model, DTO, repository, or controller changes needed — this is pure service logic.
>
> **Frontend** (`event-detail.component.ts`)
> - The existing `selfRegister()` and `registerPlayer()` error handlers already show `err.error?.error` — no frontend changes needed if the backend returns a descriptive 400.
>
> **Backend Tests** (`src/TournamentOrganizer.Tests/EventRegistrationClashTests.cs`)
> - `RegisterPlayerAsync_WhenPlayerHasClashingEvent_ThrowsInvalidOperationException`
> - `RegisterPlayerAsync_WhenPlayerHasDroppedFromClashingEvent_Succeeds`
> - `RegisterPlayerAsync_WhenNoClash_Succeeds`
>
> **E2E**: update `event-detail.spec.ts` — self-register error path shows the clash message.
---
