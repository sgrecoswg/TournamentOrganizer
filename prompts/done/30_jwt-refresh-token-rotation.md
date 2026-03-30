# Feature: JWT Refresh Token Rotation

> **GitHub Issue:** [#98 — JWT lifetime set to 24 hours with no refresh-token rotation or revocation](https://github.com/SensibleProgramming/TournamentOrganizer/issues/98)
> **Story Points:** 5 · Model: `claude-sonnet-4-6`

## Context

`Jwt:ExpiryMinutes` is currently 1440 (24 hours). The app uses stateless JWT auth with no revocation mechanism — a stolen token grants uninterrupted access for up to 24 hours. This feature reduces the JWT lifetime to 60 minutes and introduces an opaque refresh-token stored in an `HttpOnly; Secure; SameSite=Strict` cookie. When the short-lived JWT expires, the Angular interceptor calls `POST /api/auth/refresh` to silently obtain a new one without requiring re-login.

---

## Dependencies

- None

---

## Files Modified

**Created:**
- `src/TournamentOrganizer.Api/Models/RefreshToken.cs`
- `src/TournamentOrganizer.Api/Repositories/Interfaces/IRefreshTokenRepository.cs`
- `src/TournamentOrganizer.Api/Repositories/RefreshTokenRepository.cs`
- `src/TournamentOrganizer.Tests/RefreshTokenTests.cs`

**Modified:**
- `src/TournamentOrganizer.Api/Data/AppDbContext.cs`
- `src/TournamentOrganizer.Api/Services/Interfaces/IAuthService.cs`
- `src/TournamentOrganizer.Api/Services/AuthService.cs`
- `src/TournamentOrganizer.Api/Controllers/AuthController.cs`
- `src/TournamentOrganizer.Api/Program.cs`
- `src/TournamentOrganizer.Api/appsettings.json`
- `tournament-client/src/app/core/services/auth.service.ts`
- `tournament-client/src/app/core/interceptors/auth.interceptor.ts`

---

## Requirements

- Reduce `Jwt:ExpiryMinutes` from 1440 to 60 in `appsettings.json`
- On successful Google OAuth callback, issue a cryptographically random opaque refresh token (64 hex chars, 30-day expiry) stored as an `HttpOnly; Secure; SameSite=Strict` cookie named `refresh_token`
- Persist the refresh token in a new `RefreshTokens` DB table linked to `AppUser`
- `POST /api/auth/refresh` reads the `refresh_token` cookie, validates it, rotates it (issues a new cookie + invalidates the old token row), and returns `{ token: "<new-jwt>" }` in the response body
- `POST /api/auth/logout` deletes the `refresh_token` cookie and invalidates the stored token
- The Angular `authInterceptor` intercepts 401 responses, calls `POST /api/auth/refresh` (with `withCredentials: true`), stores the new JWT via `AuthService.storeToken()`, then retries the original request once — if refresh fails, calls `authService.logout()` and navigates to `/login`
- CORS must allow credentials from `http://localhost:4200` (`AllowCredentials()` + `AllowOrigins` — not `AllowAnyOrigin`)
- Add `Jwt:RefreshTokenExpiryDays` config key (default 30)

---

## Backend (`src/TournamentOrganizer.Api/`)

### Database / EF Core

- New entity `RefreshToken` with columns: `Id int PK`, `Token string UNIQUE`, `AppUserId int FK → AppUser.Id`, `ExpiresAt DateTime`, `CreatedAt DateTime`, `RevokedAt DateTime?`
- Add `DbSet<RefreshToken> RefreshTokens` to `AppDbContext`
- Run `/migrate AddRefreshTokens`

### Models / Entities (`Models/`)

```csharp
public class RefreshToken
{
    public int Id { get; set; }
    public string Token { get; set; } = string.Empty;   // 64 hex chars
    public int AppUserId { get; set; }
    public AppUser AppUser { get; set; } = null!;
    public DateTime ExpiresAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? RevokedAt { get; set; }
    public bool IsExpired => DateTime.UtcNow >= ExpiresAt;
    public bool IsRevoked => RevokedAt.HasValue;
    public bool IsActive => !IsRevoked && !IsExpired;
}
```

### Repository (`Repositories/`)

`IRefreshTokenRepository` / `RefreshTokenRepository`:
- `Task<RefreshToken?> GetByTokenAsync(string token)`
- `Task<RefreshToken> CreateAsync(RefreshToken token)`
- `Task RevokeAsync(RefreshToken token)`  — sets `RevokedAt = DateTime.UtcNow`, saves

### Service (`Services/`)

Extend `IAuthService` with:
- `Task<RefreshToken> GenerateRefreshTokenAsync(int appUserId)` — creates 64-char random hex token, persists it
- `Task<(string jwt, RefreshToken refreshToken)?> RefreshAsync(string rawToken)` — validates token (active? user exists?), revokes old, issues new JWT + new refresh token; returns `null` if invalid

Update `AuthService`:
- `GenerateRefreshTokenAsync`: `RandomNumberGenerator.GetBytes(32)` → `Convert.ToHexString(bytes).ToLower()`
- `RefreshAsync`: fetches token, checks `IsActive`, revokes it, creates new refresh token, calls `GenerateJwtAsync(user)`, returns both

Register `IRefreshTokenRepository` as Scoped in `Program.cs`.

### Controller (`Controllers/AuthController.cs`)

Add constant for cookie name: `private const string RefreshCookieName = "refresh_token";`

Update `GoogleCallback`:
```csharp
var refreshToken = await _authService.GenerateRefreshTokenAsync(user.Id);
Response.Cookies.Append(RefreshCookieName, refreshToken.Token, new CookieOptions
{
    HttpOnly = true,
    Secure   = true,
    SameSite = SameSiteMode.Strict,
    Expires  = refreshToken.ExpiresAt,
});
```

Add `POST /api/auth/refresh`:
```csharp
[HttpPost("refresh")]
[AllowAnonymous]
public async Task<IActionResult> Refresh()
{
    if (!Request.Cookies.TryGetValue(RefreshCookieName, out var rawToken) || rawToken == null)
        return Unauthorized();

    var result = await _authService.RefreshAsync(rawToken);
    if (result == null) return Unauthorized();

    var (jwt, newRefreshToken) = result.Value;
    Response.Cookies.Append(RefreshCookieName, newRefreshToken.Token, new CookieOptions
    {
        HttpOnly = true,
        Secure   = true,
        SameSite = SameSiteMode.Strict,
        Expires  = newRefreshToken.ExpiresAt,
    });
    return Ok(new { token = jwt });
}
```

Add `POST /api/auth/logout`:
```csharp
[HttpPost("logout")]
[AllowAnonymous]
public async Task<IActionResult> Logout()
{
    if (Request.Cookies.TryGetValue(RefreshCookieName, out var rawToken) && rawToken != null)
    {
        var token = await _refreshTokenRepo.GetByTokenAsync(rawToken);
        if (token != null) await _refreshTokenRepo.RevokeAsync(token);
    }
    Response.Cookies.Delete(RefreshCookieName);
    return NoContent();
}
```

### `Program.cs`

Update CORS to allow credentials (required for cookie exchange):
```csharp
policy.WithOrigins("http://localhost:4200")
      .AllowAnyHeader()
      .AllowAnyMethod()
      .AllowCredentials();
```

### `appsettings.json`

```json
"Jwt": {
  "ExpiryMinutes": 60,
  "RefreshTokenExpiryDays": 30
}
```

---

## Frontend (`tournament-client/src/app/`)

### `core/services/auth.service.ts`

Add `refresh()` method:
```typescript
refresh(): Observable<string> {
  return this.http.post<{ token: string }>(
    `${environment.apiBase}/api/auth/refresh`,
    {},
    { withCredentials: true }
  ).pipe(
    tap(res => this.storeToken(res.token)),
    map(res => res.token)
  );
}
```

Add `logout()` API call (fire-and-forget, then clear local state):
```typescript
logoutFull(): void {
  this.http.post(`${environment.apiBase}/api/auth/logout`, {}, { withCredentials: true })
    .subscribe({ error: () => {} });
  this.logout();  // existing: clears localStorage + subject
}
```

### `core/interceptors/auth.interceptor.ts`

Replace existing 401 handler with refresh-and-retry logic:

```typescript
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router      = inject(Router);

  const token = authService.getToken();
  const authedReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authedReq).pipe(
    catchError((err: HttpErrorResponse) => {
      // Skip refresh for the refresh and logout endpoints themselves to avoid loops
      if (err.status === 401
          && !req.url.includes('/api/auth/refresh')
          && !req.url.includes('/api/auth/logout')) {
        return authService.refresh().pipe(
          switchMap(newToken => {
            const retried = req.clone({ setHeaders: { Authorization: `Bearer ${newToken}` } });
            return next(retried);
          }),
          catchError(() => {
            authService.logout();
            router.navigate(['/login']);
            return throwError(() => err);
          })
        );
      }
      return throwError(() => err);
    })
  );
};
```

Import `switchMap` from `rxjs/operators`. Inject `HttpClient` in the interceptor via `inject(HttpClient)` — **do not** call `authService.refresh()` if it would cause circular dependency; instead call the HTTP directly inside the interceptor using `inject(HttpClient)`.

> **Important:** If `AuthService.refresh()` injects `HttpClient`, and `authInterceptor` injects `AuthService`, Angular's DI will form a cycle. To avoid this, call `POST /api/auth/refresh` directly inside the interceptor using `inject(HttpClient)` rather than delegating to `AuthService`.

---

## Backend Unit Tests (`src/TournamentOrganizer.Tests/`)

**Test class: `RefreshTokenTests`** — use `TournamentOrganizerFactory`

- `Refresh_Returns401_WhenNoCookiePresent`
- `Refresh_Returns401_WhenTokenIsInvalid`
- `Refresh_Returns200WithNewJwt_WhenTokenIsValid`
- `Refresh_RotatesToken_OldTokenNoLongerWorks` — call refresh twice with the same token; second call must return 401
- `Logout_RevokesToken_RefreshNoLongerWorks`

Run with: `dotnet test --filter "FullyQualifiedName~RefreshTokenTests"`

> **Note on integration tests:** To call `POST /api/auth/refresh` in tests, you'll need to seed a `RefreshToken` row directly in the in-memory DB via `factory.Services`. Use the DB seed pattern from other test classes (e.g. `StoreAnalyticsServiceTests`).

---

## Frontend Unit Tests (Jest)

No new component — update existing `auth.service.spec.ts`:

- `refresh() calls POST /api/auth/refresh with withCredentials and stores returned token`
- `logoutFull() calls POST /api/auth/logout and clears local state`

**`core/interceptors/auth.interceptor.spec.ts`** (new):

- `adds Authorization header when token exists`
- `on 401: calls refresh and retries the request with new token`
- `on 401 from refresh endpoint: does not retry (avoids loop)`
- `on 401 when refresh also fails: calls authService.logout and navigates to /login`

Run with: `npx jest --config jest.config.js --testPathPatterns=auth.interceptor`

---

## Verification Checklist

- [ ] `/migrate AddRefreshTokens` — migration applied
- [ ] `/build` — 0 errors on both .NET and Angular
- [ ] `dotnet test --filter "FullyQualifiedName~RefreshTokenTests"` — all pass
- [ ] `dotnet test` — all pass
- [ ] `npx jest --config jest.config.js --testPathPatterns=auth` — all pass
- [ ] No circular DI errors at Angular startup (`ng build` clean)
