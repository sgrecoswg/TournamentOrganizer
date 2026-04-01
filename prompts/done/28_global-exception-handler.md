# Feature: Environment-Gated Global Exception Handler

> **GitHub Issue:** [#108 — [Security][LOW] No global exception handler — stack traces exposed if environment misconfigured](https://github.com/SensibleProgramming/TournamentOrganizer/issues/108)
> **Story Points:** 3 · Model: `claude-sonnet-4-6`

## Context

`Program.cs` currently has an unconditional inline `UseExceptionHandler` lambda that returns a safe JSON error for all environments. However, it does not call `UseDeveloperExceptionPage()` in Development (losing helpful debug output during local development), and it uses an inline lambda rather than the recommended route-based `UseExceptionHandler("/error")` + `ErrorController` pattern. This task replaces the inline lambda with the proper environment-gated pattern.

---

## Dependencies

- None

---

## Files Modified

**Created:**
- `src/TournamentOrganizer.Api/Controllers/ErrorController.cs` (new)
- `src/TournamentOrganizer.Tests/GlobalExceptionHandlerTests.cs` (new)

**Modified:**
- `src/TournamentOrganizer.Api/Program.cs`

---

## Requirements

- In Development, call `app.UseDeveloperExceptionPage()` so the full stack trace is shown locally.
- In non-Development, call `app.UseExceptionHandler("/error")` which routes to `ErrorController.HandleError`.
- `ErrorController` is decorated `[ApiController]`, `[ApiExplorerSettings(IgnoreApi = true)]`, listens on `[Route("/error")]`, and returns `Problem(title: "An unexpected error occurred.", statusCode: 500)`.
- Unhandled exceptions in Production/Staging must return HTTP 500 with a ProblemDetails JSON body — never a raw stack trace.
- The existing inline lambda (`app.UseExceptionHandler(errorApp => ...)`) must be removed.

---

## Backend (`src/TournamentOrganizer.Api/`)

### Controller (`Controllers/`)

New file `ErrorController.cs`:

```csharp
[ApiController]
[ApiExplorerSettings(IgnoreApi = true)]
public class ErrorController : ControllerBase
{
    [Route("/error")]
    public IActionResult HandleError() =>
        Problem(title: "An unexpected error occurred.", statusCode: 500);
}
```

### Program.cs change

Replace the existing unconditional block:
```csharp
app.UseExceptionHandler(errorApp => errorApp.Run(async ctx =>
{
    ctx.Response.StatusCode = 500;
    ctx.Response.ContentType = "application/json";
    await ctx.Response.WriteAsJsonAsync(new { error = "An unexpected error occurred." });
}));
```

With:
```csharp
if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
}
else
{
    app.UseExceptionHandler("/error");
}
```

---

## Backend Unit Tests (`src/TournamentOrganizer.Tests/`)

**Test class: `GlobalExceptionHandlerTests`**

Use `WebApplicationFactory<Program>` with `UseEnvironment("Production")` (same pattern as `CorsEnvironmentGatingTests`).

- `Production_UnhandledException_Returns500WithProblemDetails`
  — Force an exception by calling an endpoint that throws (use a test-only route or mock a service to throw). Verify response is HTTP 500 and body contains ProblemDetails shape (`"title"`, `"status": 500`).
- `Production_UnhandledException_DoesNotLeakStackTrace`
  — Same setup; assert the response body does NOT contain "at " (stack frame prefix) or "Exception" string.
- `Development_UnhandledException_ReturnsDeveloperExceptionPage`
  — Use `UseEnvironment("Development")`. Trigger an exception. Verify the response contains a developer-friendly error page (status 500 or developer exception page HTML/text).

**Note:** To trigger an unhandled exception in tests, create a minimal test route or mock a controller action. Alternatively, rely on a dedicated `/api/test-error` endpoint added only in Development, or use the existing `/error` route directly to verify the `ErrorController` returns ProblemDetails.

For simplicity, test the `ErrorController` directly (call `GET /error` and assert ProblemDetails shape) and test that `Program.cs` wires up `UseExceptionHandler("/error")` in Production by checking that an HTTP call to `/error` returns status 500 with ProblemDetails.

Run with: `dotnet test --filter "FullyQualifiedName~GlobalExceptionHandlerTests"`

---

## Verification Checklist

- [ ] `dotnet build src/TournamentOrganizer.Api/` — 0 errors
- [ ] `dotnet test --filter "FullyQualifiedName~GlobalExceptionHandlerTests"` — all pass
- [ ] `dotnet test` (full suite) — no regressions in `ExceptionMessageLeakageTests`
