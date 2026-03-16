# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

You are a Senior .NET and Angular Developer specializing in Test-Driven Development (TDD). You are working on a "Magic the Gathering" Tournament Organizer application.

## Git Workflow (MANDATORY)

All work follows a **feature branch → PR → dev** flow:

1. **Start every task** from the `dev` branch, pulled to latest:
   ```bash
   git checkout dev && git pull TournamentOrganizer dev
   ```
2. **Create a feature branch** named after the task:
   ```bash
   git checkout -b feature/<short-task-name>
   ```
3. **Do all work on the feature branch** — commits, migrations, tests.
4. **After all tests pass**, commit all changes and push:
   ```bash
   git push -u TournamentOrganizer feature/<short-task-name>
   ```
5. **Open or update the PR** targeting `dev`:
   ```bash
   # Check if a PR already exists for this branch
   gh pr list --head feature/<short-task-name> --base dev --json number --jq '.[0].number'
   # If a PR number is returned → the PR already exists; the push in step 4 already updated it.
   # If no PR is returned → create one:
   gh pr create --base dev --title "..." --body "..."
   ```

**Rules:**
- Never commit directly to `dev` or `main`.
- Never push to `main` — `main` is updated only via PR from `dev`.
- Bug fixes discovered during a task go on the **same branch** as the task (additional commits), not a new branch.
- The remote is named `TournamentOrganizer` (not `origin`).

## Commands

Several slash-command skills are available for common operations — prefer these over raw shell commands:

| Skill | Purpose |
|---|---|
| `/build` | Build both the .NET API and Angular frontend |
| `/run` | Start the .NET API server |
| `/serve-frontend` | Start the Angular dev server with proxy |
| `/migrate` | Create and apply an EF Core migration |
| `/test-api` | Smoke-test API endpoints via curl |
| `/check-zone` | Audit Angular components for missing `cdr.detectChanges()` calls |
| `/e2e` | Run Playwright E2E tests (all, or a specific path/pattern) |

### Backend (run from repo root)
```bash
dotnet build
dotnet run --project src/TournamentOrganizer.Api/
dotnet test                                # xUnit tests in TournamentOrganizer.Tests
dotnet test --filter "FullyQualifiedName~TrueSkillCalculatorTests"  # single test class
```

### Frontend (run from `tournament-client/`)
```bash
npm start                    # dev server at http://localhost:4200
npm run build                # production build
npm test                     # Jest (jest-preset-angular)
npm test -- --testPathPattern=event-list  # single test file
```

### EF Core Migrations
```bash
dotnet ef migrations add <Name> --project src/TournamentOrganizer.Api/
dotnet ef database update --project src/TournamentOrganizer.Api/
```

## Architecture

### Backend (`src/TournamentOrganizer.Api/`)

Thin controllers → Services → Repositories → EF Core `AppDbContext`. Each layer has a matching interface under `*/Interfaces/`.

- **Controllers**: Route + HTTP shape only. Return DTOs, never domain models.
- **Services**: All business logic. `EventService`, `PlayerService`, `PodService`, `TrueSkillService`.
- **Repositories**: `PlayerRepository`, `EventRepository`, `GameRepository` — raw data access via EF Core.
- **DTOs** (`DTOs/`): Request and response shapes. `EventDto`, `PlayerDto`, `GameResultDto`, `StandingsDto`.
- **Models** (`Models/`): EF Core entities. `Player`, `Event`, `Round`, `Pod`, `PodPlayer`, `Game`, `GameResult`, `EventRegistration`.

All services and repositories are registered as `Scoped` in `Program.cs`.

**TrueSkill**: Custom implementation in `Services/TrueSkillCalculator.cs` (static) — do **not** add Moserware.Skills (incompatible with .NET 9). `TrueSkillService` wraps it and persists rating updates. Defaults: Mu=25.0, Sigma=8.333. `ConservativeScore = Mu - 3*Sigma` is computed, not stored.

**Player ranking lifecycle**: New players start with `PlacementGamesLeft = 5`. Each game result decrements it. `IsRanked` becomes true at 0. The leaderboard filters on `IsRanked`. Placement games still update TrueSkill.

**Pod seeding**:
- Round 1 — snake draft by `ConservativeScore` into balanced 4-player pods.
- Round 2+ — group by prior `FinishPosition`, sort by `ConservativeScore` within each group, form pods of 4 (allow one 3- or 5-player pod for remainders).

**Scoring**: 1st=4pts, 2nd=3pts, 3rd=2pts, 4th=1pt. Tiebreaker = average opponent `ConservativeScore`.

### Frontend (`tournament-client/`)

Angular 21, standalone components, Angular Material 21. State is managed via `BehaviorSubject` in feature services — no NgRx.

- **`core/services/api.service.ts`**: Single HTTP facade for all backend calls. All components go through this.
- **`core/models/api.models.ts`**: Shared TypeScript interfaces mirroring backend DTOs.
- **`features/`**: `events`, `leaderboard`, `player-profile`, `players`, `tournament` — each is a self-contained feature directory.
- **`shared/components/`**: Reusable `RatingBadgeComponent`, `PlacementBadgeComponent`, `PodTimerComponent`.

The Angular dev server proxies `/api/*` to `http://localhost:5021` via `proxy.conf.json`. The API allows CORS from `http://localhost:4200`.

### Testing

- **Backend**: xUnit in `src/TournamentOrganizer.Tests/`. Currently covers `TrueSkillCalculator`. Use `dotnet test`.
- **Frontend unit**: Jest via `jest-preset-angular`. Config in `tournament-client/jest.config.js`. Run with `npm test` from `tournament-client/`.
- **Frontend E2E**: Playwright in `tournament-client/e2e/`. Config in `tournament-client/playwright.config.ts`. Run with `/e2e` or `npm run e2e` from `tournament-client/`. Tests mock all API routes via `page.route()` — the .NET API does not need to be running.

## TDD Workflow (MANDATORY)

All new features and bug fixes must follow Test-Driven Development:

1. **Write the test first** — before writing any implementation code, write a failing test that describes the expected behaviour.
2. **Run the test** — confirm it fails for the right reason (not a compile error).
3. **Write the minimum implementation** to make the test pass.
4. **Run the test again** — confirm it passes.
5. **Refactor** if needed, keeping tests green.

### Backend TDD
- Add xUnit tests in `src/TournamentOrganizer.Tests/` before touching service/controller code.
- Use `dotnet test` to run; `dotnet test --filter "FullyQualifiedName~<TestClass>"` for a single class.

### Frontend TDD
- Add Jest specs (`.spec.ts`) alongside the component/service file before touching implementation.
- Use `npm test -- --testPathPattern=<filename>` from `tournament-client/` to run a single spec.
- Mock `ApiService` and `HttpClient` with Jest spies — do not make real HTTP calls in tests.

### Frontend E2E (Playwright)
- E2E specs live in `tournament-client/e2e/` organised by feature (e.g. `e2e/stores/`).
- Use `loginAs(page, role)` from `e2e/helpers/auth.ts` to inject a fake JWT — do not attempt real OAuth in tests.
- Mock all API calls with `page.route()` helpers from `e2e/helpers/api-mock.ts` — the backend does not need to be running.

## Frontend Workflow — E2E Rules

This rule is **mandatory**:

> After completing **any** feature that adds or modifies UI, write E2E tests for it and run `/e2e <spec-file>` before considering the task done. All tests must pass — do not skip or comment out failing tests.

Specifically:
- Every new component or user-visible behaviour needs at least one E2E describe block
- Role-gating must be covered: if a UI element is hidden for some roles, test both the visible and hidden cases
- Write E2E tests **before** implementation (TDD) — confirm they are red first
- New mock helpers go in `e2e/helpers/api-mock.ts`; new fixture builders use the `make*Dto(overrides?)` pattern
- Register `stubUnmatchedApi` **before** feature-specific mocks so it is the last fallback (LIFO route order)

## Frontend Workflow — Zone Rules

This app uses **Angular 21 zoneless change detection** (no Zone.js). Without Zone.js, Angular never triggers change detection automatically. This rule is **mandatory**:

> After **any** frontend CRUD operation that touches component state, run `/check-zone` on the modified component(s) before considering the task done.

Specifically, every method that assigns to `this.*` properties must call `this.cdr.detectChanges()` after the mutation — including:
- `subscribe()` `next:` and `error:` callbacks
- Synchronous click/event handler methods (e.g. `startEdit()`, `cancelEdit()`)
- `async` methods using `await`
- `ngOnInit` and other lifecycle hooks

## Frontend Workflow — Static Image Uploads (browser cache-busting)

The API always overwrites the same file path on disk (e.g. `/logos/{id}.ext`, `/avatars/{id}.ext`).
If the URL doesn't change, the browser serves the old image from cache even after a successful upload.

**Rule:** every place a component receives an image URL from an API response must append `?t=<Date.now()>`.

Apply in all of:
1. Upload success handler (`onLogoSelected`, `onAvatarFileSelected`, etc.)
2. `ngOnInit` load success (navigate-back re-fetches the original URL — must re-bust)
3. `save()` / settings-save success (response URL is bare — apply timestamp again)

For components that *display* the URL but don't upload (e.g. the toolbar `selectedStore` getter in `app.ts`,
leaderboard rows, player list rows), use a **per-session constant** to avoid calling `Date.now()` on every
change-detection cycle:

```typescript
private readonly sessionTs = Date.now();

get someDisplayUrl(): string | null {
  const url = this.someSource?.imageUrl;
  if (!url) return null;
  return url.includes('?t=') ? url : `${url}?t=${this.sessionTs}`;
}
```

The upload-side timestamp is fresh each upload; the session-side constant ensures the initial load is
also cache-busted without repeated `Date.now()` calls.

## Workflow — Plan File Hygiene

Plan files in `C:\Users\sgall\.claude\plans\` are injected as context into every new session. A stale plan wastes tokens and misleads the assistant into thinking unfinished work remains.

**Rule:** At the end of every feature, check `ls C:\Users\sgall\.claude\plans\` and delete any plan whose feature is complete.

## Key Constraints

- **Swashbuckle**: Pin to `6.*` — version 10.x is incompatible with .NET 9.
- **Angular Material theming**: Configure manually in `styles.scss` — `ng add @angular/material` theming fails on v21.
- **TrueSkill input**: `TrueSkillCalculator.CalculateNewRatings` takes `List<(double Mu, double Sigma)>` and `int[] finishPositions` (1-indexed, where 1 = winner).
- **Event status flow**: `Registration` → `InProgress` → `Completed` | `Removed`. The `GetAllAsync` service method filters out `Removed` events.
- **Pod sizes**: Normal pods are 4 players. One pod per round may be 3 or 5 when player count is not divisible by 4.
