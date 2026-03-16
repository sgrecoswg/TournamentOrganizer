# Feature: Store functionality if not selected

## Context
Given a user i slogged in and has the 'Admin' role is accessing the site
When they have not selected a store
then they should not be able to make events
---

## Requirements

<!-- Bullet list of the concrete behaviour this feature must deliver. Be specific about roles, UI text, field names, API contracts, and edge cases. Vague requirements cause wasted planning. -->

- When Admin is logged in and has not selected a stoe, the `Create New Event` section in the events list should not be visible
- When an Admin is logged in and does select a store, the `Create New Event` section will be visible
- When an Admin selects the store on the event list page, the ui should update showing them the `Create New Event` section

---
## Frontend (`tournament-client/src/app/`)

<!-- List every file to create or change. -->
- `tournament-client\src\app\features\events\event-list.component.ts`
- `tournament-client\src\app\features\events\event-list.component.spec.ts`
- `tournament-client\src\app\app.ts`
- `tournament-client\src\app\core\services\store-context.service.ts`


### Components
- **`tournament-client\src\app\features\events\event-list.component.ts`** — standalone; lists items; role-based create form; remove button 
- **`tournament-client\src\app\app.ts`**  

### Post-implementation checklist
- [ ] Run `/check-zone` on every new or modified component

---

## Frontend Unit Tests (Jest)

<!-- Describe the spec file(s) and the cases to cover BEFORE touching component code (TDD).
     Each bullet is one `it(...)` or `test(...)` block. -->

**`tournament-client\src\app\features\events\event-list.component.spec.ts`**

Online path:
- calls `eventService.loadAllEvents()` on init
- renders each event name from `events$` 
- Create event section (lines 33-71) hidden if No store was selected in app.ts

Offline / error path:
- when store is selected, render Create event section (lines 33-71)

Run with: `npx jest --config jest.config.js --testPathPatterns=foo-list.component`

---

## Frontend E2E Tests (Playwright)

<!-- Describe the spec file and every describe block. Be explicit about selectors so the spec matches the template exactly. -->

**File: `tournament-client\e2e\events\event-list.spec.ts`**

Helpers needed in `e2e/helpers/api-mock.ts`:
- `mockGetevents(page, foos: FooDto[])` — intercepts `GET /api/foo`
- `makeEventDto(overrides?)` — fixture builder

Run with: `/e2e e2e/foo/foo-list.spec.ts`
**All tests must pass before the task is considered done.**

---

## Verification Checklist

- [ ] `/build` — 0 errors on both .NET and Angular
- [ ] `dotnet test --filter "FullyQualifiedName~FooServiceTests"` — all pass
- [ ] `npx jest --config jest.config.js --testPathPatterns=foo` — all pass
- [ ] `/e2e e2e/foo/foo-list.spec.ts` — all pass
- [ ] `/check-zone` — no missing `cdr.detectChanges()` calls in new components
