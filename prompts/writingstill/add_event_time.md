# Feature: Add time-of-day to events

## Context
When creating an event we should make sure we save the time of the event.
<!-- Example: Players currently cannot register for events when the API is offline. This adds local-first registration so the action is queued and synced later. -->

---

## Requirements
- Save time with the date wehn we register.
- display the time of the event in the event-list cards, and in the event-details pages.
<!-- Bullet list of the concrete behaviour this feature must deliver. Be specific about roles, UI text, field names, API contracts, and edge cases. Vague requirements cause wasted planning. -->

- ...
- ...

---

## Backend (`src/TournamentOrganizer.Api/`)


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
- The entire Backend, Frontend, and Test sections still contain `Foo` placeholder content — they were never filled in. These sections will be ignored or cause confusion. Either fill them in or delete them so the prompt contains only the two concrete requirements.
- The two real requirements are buried in one line each ("Save time with the date when we register" and "display the time of the event in event-list cards and event-detail pages"). The rest is boilerplate. Deleting the unfilled template sections would cut ~70% of the tokens.
- The `Event.Date` column already exists as a `DateTime` in the backend model — check whether it already stores time or is date-only before deciding whether a migration is needed. Calling this out saves unnecessary exploration.

### Anticipated Questions (pre-answer these to skip back-and-forth)
- Q: Does `Event.Date` currently store time-of-day, or is it date-only? → If date-only, a migration is needed to change the column precision; if it already stores time, only the UI changes.
- Q: What format should the time be displayed in? → e.g. `Saturday, March 15, 2026 at 7:00 PM` or `2026-03-15 19:00`?
- Q: Is time input required when creating an event, or optional (defaults to midnight)? → Affects the create-event form and validation.
- Q: Should the `CreateEventDto` accept a combined `DateTime` (date + time in one field) or separate `Date` / `Time` fields?
- Q: Which components show the event date that need updating? → Likely `event-list.component.ts` (card) and `event-detail.component.ts` (header). Confirm if any others (e.g. pairings page, standings) also show the date.
- Q: Does the create-event form (`event-list.component.ts` or a dedicated create component) use a `<input type="date">` today? It would need to change to `<input type="datetime-local">`.

### Missing Context
- No decision on whether `Event.Date` already stores time. Inspect `src/TournamentOrganizer.Api/Models/Event.cs` and the current EF migration to confirm the column type before deciding if a migration is needed.
- No display format specified — needed to write the Angular pipe/format string.
- The requirements bullet list has two placeholder `- ...` lines that were never removed; they imply more requirements exist but are unstated.

### Optimized Prompt



> **Frontend**
> - `event-list.component.ts`: update the date display in event cards to show time, e.g. `{{ event.date | date:'medium' }}`.
> - `event-list.component.ts` (create-event form): change `<input type="date">` to `<input type="datetime-local">` so users can pick a time.
> - `event-detail.component.ts`: update the date display in the header (line ~45) to include time.
>
> **Tests**
> - Backend: add one test confirming time is preserved through create → get round-trip.
> - Jest: update `makeEventDto` fixture in `e2e/helpers/api-mock.ts` to use a full ISO datetime string.
> - E2E: update existing event-detail and event-list display tests to expect the time to appear.
>
> **TDD order**: read `Event.cs` first, then write failing tests, then implement.
---
