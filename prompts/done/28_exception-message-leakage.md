# Bug: Internal exception messages returned directly to API clients

> **GitHub Issue:** [#101 — [Security][MEDIUM] Internal exception messages returned directly to API clients](https://github.com/SensibleProgramming/TournamentOrganizer/issues/101)
> **Story Points:** 3 · Model: `sonnet`

**Broken behaviour:** Raw `ex.Message` strings from service-layer exceptions (`InvalidOperationException`, `KeyNotFoundException`) — and potentially unexpected EF Core / SQL Server exceptions — are serialised directly into HTTP response bodies as `{ "error": "..." }`. Schema details, table names, and query fragments can be leaked to callers.

**Expected behaviour:** HTTP error responses contain only safe, static domain messages. Internal exception detail is logged server-side and never surfaced to clients.

**Reproduction steps:**
1. Trigger an unexpected database error (e.g., violate an unanticipated constraint).
2. Observe the raw SQL error message returned in the HTTP 400/500 body.

---

## Root Cause

**Files:**
- `src/TournamentOrganizer.Api/Controllers/EventsController.cs` — ~14 catch blocks return `ex.Message`
- `src/TournamentOrganizer.Api/Controllers/GamesController.cs:27,42` — catch blocks return `ex.Message`
- `src/TournamentOrganizer.Api/Controllers/PlayersController.cs:41` — catch block returns `ex.Message`
- `src/TournamentOrganizer.Api/Services/EventService.cs:970` — copies `ex.Message` into `BulkRegisterResultDto`

**Cause:** Every catch block passes the raw exception message to the HTTP response rather than logging it and returning a static safe message. There is no global exception handler to catch unhandled exceptions.

---

## Fix

### Backend (`src/TournamentOrganizer.Api/`)

- **`Program.cs`** — Add `app.UseExceptionHandler(...)` middleware before other middleware to return `{ "error": "An unexpected error occurred." }` for all unhandled exceptions (status 500).
- **`Controllers/EventsController.cs`** — Replace all `return BadRequest(new { error = ex.Message })` / `return NotFound(new { error = ex.Message })` / `return StatusCode(500, new { error = ex.Message })` with:
  - `catch (KeyNotFoundException ex)` → `_logger.LogWarning(ex, ...)` + `return NotFound(new { error = "Resource not found." })`
  - `catch (InvalidOperationException ex)` → `_logger.LogWarning(ex, ...)` + `return BadRequest(new { error = "Operation not permitted." })`
  - Any generic `catch (Exception ex)` → `_logger.LogError(ex, ...)` + `return StatusCode(500, new { error = "An unexpected error occurred." })`
- **`Controllers/GamesController.cs`** — Same replacement pattern for catch blocks at lines 27 and 42.
- **`Controllers/PlayersController.cs`** — Same replacement for catch block at line 41.
- **`Services/EventService.cs:970`** — Replace `ex.Message` in `BulkRegisterResultDto` with a static string `"Registration failed."` (log the real message via `_logger`).

### Post-fix checklist
- [ ] No `ex.Message` remains in any HTTP response body
- [ ] All catch blocks log the original exception via `ILogger`

---

## Backend Unit Tests (`src/TournamentOrganizer.Tests/`)

**Test class: `ExceptionMessageLeakageTests`** *(new class)*

These tests call the controller actions directly with mocked services that throw, and assert the response body does NOT contain the exception message.

- `EventsController_WhenServiceThrowsInvalidOperation_ReturnsBadRequestWithStaticMessage` — service throws `InvalidOperationException("db table players col foo")`, response is `400 { error = "Operation not permitted." }`, does NOT contain "players"
- `EventsController_WhenServiceThrowsKeyNotFound_ReturnsNotFoundWithStaticMessage` — service throws `KeyNotFoundException("SELECT * FROM Events")`, response is `404 { error = "Resource not found." }`, does NOT contain "SELECT"
- `GamesController_WhenServiceThrowsInvalidOperation_ReturnsBadRequestWithStaticMessage`
- `PlayersController_WhenServiceThrowsInvalidOperation_ReturnsBadRequestWithStaticMessage`

Run with: `dotnet test --filter "FullyQualifiedName~ExceptionMessageLeakageTests"`

---

## Frontend Unit Tests (Jest)

No frontend changes required — this fix is backend-only.

---

## Frontend E2E Tests (Playwright)

No E2E tests needed — this fix is not visible in the UI (error response bodies are logged, not displayed verbatim).

---

## Verification Checklist

- [ ] `/build` — 0 errors on both .NET and Angular
- [ ] Failing tests written and confirmed red before touching implementation
- [ ] `app.UseExceptionHandler` middleware added to `Program.cs`
- [ ] All `ex.Message` references replaced with static strings in controllers + `EventService.cs`
- [ ] `dotnet test --filter "FullyQualifiedName~ExceptionMessageLeakageTests"` — all pass
- [ ] `dotnet test` — full suite passes
- [ ] No `ex.Message` in any HTTP response body (grep check)

---
## Prompt Refinement Suggestions

### Token Efficiency
- The fix description for `EventsController.cs` lists three catch-block patterns inline — good specificity, no wasted tokens.
- "~14 catch blocks" is approximate; the implementing agent will still need to grep. Consider: add a one-liner grep command so the agent can confirm the full set without extra exploration: `grep -n "ex\.Message" src/TournamentOrganizer.Api/Controllers/EventsController.cs`.
- The `BulkRegisterResultDto` change in `EventService.cs:970` is correctly scoped; no redundancy.
- No redundant CLAUDE.md / MEMORY.md context present — prompt is tight.

### Anticipated Questions (pre-answer these to skip back-and-forth)
- Q: Should `ILogger` be injected into controllers that don't already have it? → Suggested answer: Yes — inject `ILogger<TController>` via constructor if not already present.
- Q: Should `UseExceptionHandler` be added in *all* environments or only non-Development? → Suggested answer: All environments; Development can additionally use `app.UseDeveloperExceptionPage()` *before* it if needed, but the safe handler must always be registered.
- Q: Are there other controllers beyond the three listed? → Suggested answer: Grep for `ex.Message` across all `Controllers/` files before starting — the issue lists the known ones but may not be exhaustive.
- Q: What log level for `KeyNotFoundException` vs `InvalidOperationException` vs unknown `Exception`? → Suggested answer: `LogWarning` for domain exceptions (`KeyNotFoundException`, `InvalidOperationException`); `LogError` for unexpected `Exception`.

### Missing Context
- No mention of whether `ILogger` is already injected in `GamesController` and `PlayersController` — agent should check before adding constructor parameters.
- The `BulkRegisterResultDto` field name that receives `ex.Message` is not specified — agent will need to read `EventService.cs:970` to confirm the field.
- No instruction on whether existing `catch (Exception ex)` blocks (generic) in controllers should be removed, kept, or replaced — clarify: replace generic catches with `LogError` + static 500 response, do not leave bare `throw`.

### Optimized Prompt (no full rewrite needed — targeted additions only)
> Add to **Root Cause** section: "Run `grep -rn 'ex\.Message' src/TournamentOrganizer.Api/Controllers/` before starting to get the definitive list of catch blocks to fix."
> Add to **Fix → Program.cs**: "Register `UseExceptionHandler` before `UseRouting`/`UseAuthentication`. In Development, `UseDeveloperExceptionPage` may precede it."
> Add to **Fix → Controllers**: "If `ILogger<T>` is not already constructor-injected, add it. Use `LogWarning` for domain exceptions, `LogError` for generic `Exception`."
