# Feature: [Feature Name]

## Context
Given a user has authorization to view players,
When they view the list of players on `tournament-client\src\app\features\players\players.component.ts` there should be a paginator and a search filter so it will be easier to find players

---

## Requirements

<!-- Bullet list of the concrete behaviour this feature must deliver. Be specific about roles, UI text, field names, API contracts, and edge cases. Vague requirements cause wasted planning. -->

- Roles: 
  - Store employee - full control
  - Store manager - full control
  - Admin - full control
- Pagnation
  - default to 25 players visible at a time
  - pagination controls available on bottom of list
- Filters
  - Be able to search players by name and email
  - th search functionality should be in the column headers  
- Keep inline editing currently available
---

## Backend (`src/TournamentOrganizer.Api/`)
none

### Database / EF Core
none

### Repository (`Repositories/`)
none

### Service (`Services/`)
none

### Controller (`Controllers/`)
none
---

## Frontend (`tournament-client/src/app/`)
`tournament-client\src\app\features\players\players.component.ts` `ngOnInit()` line 142
<!-- List every file to create or change. -->

### Models (`core/models/api.models.ts`)
not sure

### API Service (`core/services/api.service.ts`)
not usre if we should modify this

### Feature Service (`features/foo/foo.service.ts`) *(if needed)*
- look to see if api returns values
  - if it does, merge the list of plaers from local sorage if there is a difference and notify the user we should sync with server
  - if not use local storage

### Components
- **`tournament-client\src\app\features\players\players.component.ts`** — standalone; lists items; role-based create form; remove button
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
- [existing] ./features/player-profile/player-profile.component' returns PlayerProfileComponent

### Navigation (`app.html`)
n/a

### Post-implementation checklist
- [ ] Run `/check-zone` on every new or modified component

---

## Backend Unit Tests (`src/TournamentOrganizer.Tests/`)
n/a

---

## Frontend Unit Tests (Jest)

<!-- Describe the spec file(s) and the cases to cover BEFORE touching component code (TDD).
     Each bullet is one `it(...)` or `test(...)` block. -->

**`tournament-client\src\app\features\players\players.component.spec.ts`**

Online path:
- calls `this.playerService.loadAllPlayers()` on ngOnInit
- renders each players from this.playerService.players$
- clicking name navigates to `./features/players/players.component`, with the correct args

Offline / error path:
- `playerService.loadAllPlayers()` error → snackbar shows error message
- component still renders cached players when API is down

Run with: `npx jest --config jest.config.js --testPathPatterns=foo-list.component`

---

## Frontend E2E Tests (Playwright)

<!-- Describe the spec file and every describe block. Be explicit about selectors so the spec matches the template exactly. -->

**File: [New] `e2e/players/players.spec.ts`**

Helpers needed in `e2e/helpers/api-mock.ts`:
- `mockGetPLayers(page, players: PlayerDto[])` — intercepts `GET /api/players`

Describe blocks:

| Describe | Tests |
|---|---|
| `Player List — heading` | shows `<h2>Players</h2>` |
| `Player List — empty state` | shows "No players found.", no cards |
| `Player List — populated` | renders name,email,rating,status,active,edit button if user has authorization to modify clicking card navigates to `/players/:id` |
| `Player List — role UI: Player` | no create form, no Remove button |
| `Player List — role UI: StoreEmployee` | create form visible; Create disabled when name empty; enabled when filled |
| `Player List — create (happy path)` | POST → snackbar "Player created!" → card appears → form cleared |
| `Player List — remove (happy path)` | DELETE → snackbar "Player removed" → card gone |
| `Player List — offline cache` | pre-seed `to_store_1_players` localStorage → API 500 → cached items shown |

Run with: `/e2e e2e/players/players.spec.ts`
**All tests must pass before the task is considered done.**

---

## Verification Checklist

- [ ] `/build` — 0 errors on both .NET and Angular
- [ ] `dotnet test --filter "FullyQualifiedName~PlayersControllerTests"` — all pass
- [ ] `npx jest --config jest.config.js --testPathPatterns=player` — all pass
- [ ] `/e2e e2e/players/players.spec.ts` — all pass
- [ ] `/check-zone` — no missing `cdr.detectChanges()` calls in new components
