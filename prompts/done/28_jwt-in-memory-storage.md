# Feature: JWT In-Memory Storage (Remove localStorage)

> **GitHub Issue:** [#89 — [Security][HIGH] JWT stored in localStorage — accessible to any XSS payload](https://github.com/SensibleProgramming/TournamentOrganizer/issues/89)
> **Story Points:** 3 · Model: `claude-sonnet-4-6`

## Context

The JWT access token is currently persisted to `localStorage` via `localStorage.setItem('auth_token', token)` in `auth.service.ts`. Any JavaScript executing in the page — including XSS payloads — can read and exfiltrate this token. The backend already issues a `refresh_token` in an `HttpOnly; Secure; SameSite=Strict` cookie on every login and refresh cycle, so the infrastructure to support in-memory session restoration is already in place.

This task implements **Option B** from the issue: store the JWT exclusively in-memory (`BehaviorSubject`) and use the existing `/api/auth/refresh` endpoint (backed by the HttpOnly cookie) to silently restore the session on page reload. No backend changes are required.

---

## Dependencies

- None

---

## Files Modified

**Created:**
- *(none)*

**Modified:**
- `tournament-client/src/app/core/services/auth.service.ts`
- `tournament-client/src/app/core/services/auth.service.spec.ts`
- `tournament-client/src/app/features/auth/oauth-callback.component.ts`
- `tournament-client/src/app/features/auth/oauth-callback.component.spec.ts`

---

## Requirements

- JWT must **never** be written to `localStorage` or `sessionStorage`.
- On construction, `AuthService` silently calls `POST /api/auth/refresh` with `withCredentials: true`. On success it stores the returned JWT in-memory and emits the decoded user. On failure it remains unauthenticated (null user).
- `storeToken(token)` stores the token in a private `string | null` field and emits the decoded user via `userSubject`. No localStorage writes.
- `getToken()` returns the in-memory token (with expiry check). No localStorage reads.
- `logout()` clears the in-memory token and emits null. No localStorage writes.
- `logoutFull()` revokes the server-side refresh cookie (POST /api/auth/logout) then calls `logout()`.
- `OAuthCallbackComponent`: after `storeToken()` is called (JWT is now in-memory), navigate using `router.navigate([safeUrl])` instead of `window.location.href`. The full-page reload is no longer required because the in-memory state is already set.
- All existing `OAuthCallbackComponent` tests must continue to pass (the public API of the component is unchanged; only the internal navigation mechanism changes from `window.location.href` to `Router.navigate`).

---

## Backend (`src/TournamentOrganizer.Api/`)

No backend changes.

---

## Frontend (`tournament-client/src/app/`)

### `core/services/auth.service.ts`

Replace the `localStorage`-based implementation with in-memory storage + silent refresh:

```typescript
@Injectable({ providedIn: 'root' })
export class AuthService {
  private userSubject = new BehaviorSubject<CurrentUser | null>(null);
  currentUser$ = this.userSubject.asObservable();

  private token: string | null = null;   // in-memory only

  constructor(private http: HttpClient) {
    this.silentRefresh();
  }

  private silentRefresh(): void {
    this.http.post<{ token: string }>(
      `${environment.apiBase}/api/auth/refresh`,
      {},
      { withCredentials: true }
    ).subscribe({
      next: res => { this.setToken(res.token); },
      error: () => {}  // no active session — stay unauthenticated
    });
  }

  private setToken(token: string): void {
    this.token = token;
    this.userSubject.next(this.decodeJwt(token));
  }

  storeToken(token: string): void {
    this.setToken(token);
  }

  logout(): void {
    this.token = null;
    this.userSubject.next(null);
  }

  logoutFull(): void {
    this.http.post(`${environment.apiBase}/api/auth/logout`, {}, { withCredentials: true })
      .subscribe({ error: () => {} });
    this.logout();
  }

  getToken(): string | null {
    if (!this.token) return null;
    try {
      const payload = JSON.parse(atob(this.token.split('.')[1]));
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        this.token = null;
        this.userSubject.next(null);
        return null;
      }
    } catch {
      this.token = null;
      this.userSubject.next(null);
      return null;
    }
    return this.token;
  }

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

  // ... all getter properties unchanged (currentUser, isStoreEmployee, etc.)
  // ... login() unchanged
  // ... decodeJwt() unchanged
}
```

### `features/auth/oauth-callback.component.ts`

- Inject `Router` in the constructor.
- Replace `window.location.href = safeUrl` with `this.router.navigate([safeUrl])`.
- Replace `window.location.href = '/'` (error path) with `this.router.navigate(['/'])`.
- Remove the comment about "Full page reload so AuthService.loadFromStorage() runs fresh" — it is no longer needed.

The `readLocationHash()` protected method and all other logic remain unchanged.

---

## Backend Unit Tests

No backend tests required.

---

## Frontend Unit Tests (Jest)

### `core/services/auth.service.spec.ts`

Rewrite the spec to use `HttpClientTestingModule` and `HttpTestingController` for the silent refresh call that happens in the constructor. Remove all `localStorage.setItem/getItem` references — they no longer apply.

**Helpers:**
- `makeJwt(payload)` — same helper as before
- `nowSec(offsetSeconds)` — same helper as before
- `createService(flushWith?: string | 'error')` — configures TestBed with `provideHttpClientTesting()`, creates the service, and optionally flushes the pending refresh request:
  - `flushWith = 'error'` → `httpController.expectOne(...refresh...).flush('', { status: 401, statusText: 'Unauthorized' })`
  - `flushWith = <token string>` → `httpController.expectOne(...refresh...).flush({ token: <token> })`
  - called without argument → does NOT flush (leaves request pending) for tests that verify the pending state

**Describe blocks and test cases:**

`constructor (silentRefresh)`:
- `emits null immediately before refresh response arrives` — create service without flushing; `currentUser` is null
- `emits the decoded user when refresh succeeds` — flush with a valid token; `currentUser` matches decoded user
- `remains null when refresh fails (no active session)` — flush with 401; `currentUser` is null
- `makes exactly one POST to /api/auth/refresh on construction` — verify via `httpController.expectOne`

`storeToken()`:
- `emits the decoded CurrentUser on currentUser$`
- `updates currentUser synchronously`
- `does NOT write to localStorage`

`logout()`:
- `clears the in-memory token (getToken returns null)`
- `emits null on currentUser$`
- `does NOT touch localStorage`

`getToken()`:
- `returns null when no token is stored`
- `returns the token string when valid`
- `returns null and clears state when token is expired`
- `returns null and clears state for a malformed token`

`currentUser getter`:
- `returns null initially`
- `returns the user set by storeToken`
- `returns null after logout`

`isStoreEmployee getter`:
- parameterised — same coverage as before (StoreEmployee, StoreManager, Administrator → true; others → false)

`isStoreManager getter`:
- parameterised — same as before

`isAdmin getter`:
- same as before

`login()`:
- `navigates to the Google OAuth login endpoint via relative URL` — same as before (window.location spy)

`licenseTier / isTier1 / isTier2 getters`:
- same four cases as before (set up via `storeToken` not localStorage)

Run with: `npx jest --config jest.config.js --testPathPatterns=auth.service`

### `features/auth/oauth-callback.component.spec.ts`

Update tests to replace the `navigateSpy` (which spied on `window.location._locationObjectSetterNavigate`) with a `RouterSpy`:

```typescript
import { Router } from '@angular/router';
// In providers: provideRouter([])
// Spy: jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true)
```

All existing `it(...)` descriptions remain exactly the same. Only the spy setup changes:
- Replace `navigateSpy` (impl-based) with `routerNavigateSpy` = `jest.spyOn(TestBed.inject(Router), 'navigate')`
- Replace `navigateSpy` assertions with `routerNavigateSpy`:
  - `expect(routerNavigateSpy).toHaveBeenCalledWith(['/'])` for root redirects
  - `expect(routerNavigateSpy).toHaveBeenCalledWith(['/events/42'])` for the returnUrl test

Run with: `npx jest --config jest.config.js --testPathPatterns=oauth-callback`

---

## Verification Checklist

- [ ] `dotnet build src/TournamentOrganizer.Api/` — 0 errors (no backend changes, sanity check)
- [ ] `cd tournament-client && npx ng build && cd ..` — 0 errors
- [ ] `npx jest --config jest.config.js --testPathPatterns=auth.service` — all pass
- [ ] `npx jest --config jest.config.js --testPathPatterns=oauth-callback` — all pass
- [ ] No `localStorage.getItem\|setItem\|removeItem.*auth_token` in any `.ts` file (grep to confirm)

---
## Prompt Refinement Suggestions

### Token Efficiency
- The `auth.service.ts` code block uses `// ... all getter properties unchanged` — this is fine as a signal to keep those methods, but make sure the implementer knows to keep ALL existing getter properties (`currentUser`, `isStoreEmployee`, `isStoreManager`, `isAdmin`, `licenseTier`, `isTier1`, `isTier2`, `isTier3`) and `login()` / `decodeJwt()` verbatim. Consider adding an explicit list to avoid accidental omission.
- The prompt doesn't mention `auth.interceptor.ts` — add a one-liner confirming it requires no changes (`getToken()` public API is unchanged; reading from memory vs localStorage is an internal detail).

### Anticipated Questions (pre-answer these to skip back-and-forth)
- Q: Must `createService()` in the spec flush the constructor's silentRefresh call before every test, or only in some tests? → **Every test** that uses `createService()` must flush or error the pending refresh request. Failing to do so causes `httpController.verify()` failures. The `flushWith` parameter on `createService()` should be mandatory (not optional) in practice — only the "emits null before refresh arrives" test legitimately leaves it unflushed and must NOT call `httpController.verify()`.
- Q: Should `httpController.verify()` be called in `afterEach`? → Yes. Add `afterEach(() => httpController.verify())` to catch unexpected extra requests. Tests that intentionally leave the request pending (the "null before refresh arrives" case) must call `httpController.expectOne(...)` to consume the request manually before the afterEach runs, or skip verify for that test.
- Q: Does `oauth-callback.component.spec.ts` still need the `navigateSpy` (window impl spy) in `beforeEach`/`afterEach`? → **No.** Once the component uses `this.router.navigate()` instead of `window.location.href`, the `_locationObjectSetterNavigate` spy can be removed entirely from `beforeEach`/`afterEach`. The `replaceStateSpy` (for `history.replaceState`) is still needed — the component still clears the hash fragment.
- Q: Does `oauth-callback.component.spec.ts` need `AuthService` to be mocked differently now that AuthService makes HTTP calls in its constructor? → No. The spec provides `{ provide: AuthService, useValue: mockAuthService }` — Angular never constructs the real AuthService, so no HTTP calls occur in those tests.
- Q: Does `router.navigate([safeUrl])` work when `safeUrl` is `/events/42` (starts with '/')? → Yes. Angular Router treats strings starting with '/' as absolute paths.

### Missing Context
- The `provideHttpClient()` provider must be added alongside `provideHttpClientTesting()` in `auth.service.spec.ts`. Without `provideHttpClient()`, Angular will throw because `HttpClient` is not provided. The correct pair is: `providers: [provideHttpClient(), provideHttpClientTesting()]`.
- The `HttpTestingController` instance must be retrieved via `TestBed.inject(HttpTestingController)` after `TestBed.configureTestingModule(...)` and before `createService()`. The prompt describes the helper but doesn't show where `httpController` is captured.
- The "does NOT write to localStorage" test approach is not specified — use `jest.spyOn(localStorage, 'setItem')` and assert `not.toHaveBeenCalledWith('auth_token', expect.any(String))`. The spy must be set up before calling `storeToken()`.

### Optimized Prompt additions (apply inline)
> Add to Requirements: "The `auth.interceptor.ts` file requires no changes — `getToken()`'s public signature is unchanged."
> Add to auth.service.spec.ts section: "Add `afterEach(() => httpController.verify())`. For the 'emits null immediately before refresh arrives' test, consume the pending request manually: `httpController.expectOne(url => url.includes('/api/auth/refresh')).flush('', { status: 503, statusText: '' })` at the end of the test body, so verify() passes."
