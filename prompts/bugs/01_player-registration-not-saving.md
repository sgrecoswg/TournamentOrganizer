# Bug: Registering a player from Event Detail shows no result and player absent from DB

## Summary
When a StoreEmployee registers a player from the Event Detail page while the API is running,
the player does not appear in the registered-players list and is not saved to the database.
The app may silently show a success snackbar ("Player registered!") even though nothing was persisted.

**Broken behaviour:** Player registration appears to complete (or fails silently) but the player is
absent from both the UI list and the database.
**Expected behaviour:** Player appears in the registered-players list immediately after registration
and is persisted in the database.
**Reproduction steps:**
1. Start the .NET API (`/run`)
2. Log in as a StoreEmployee
3. Navigate to an event in `Registration` status
4. Select a player from the autocomplete and click **Register Player**
5. Player does not appear in the list below; checking the DB confirms no new `EventRegistration` row

---

## Root Cause

> ⚠️ **Needs confirmation** — two plausible scenarios depending on whether the success snackbar appears.

### Scenario A — API call fails but error is swallowed (most likely)

`EventService.registerPlayer` (`event.service.ts`) wraps the API call in a `catchError` intended
for **offline / API-unreachable** situations. When the API IS running but returns a 4xx/5xx
(e.g. 403 Forbidden because the StoreEmployee's JWT `storeId` doesn't match the event's store,
or a 400 validation error), `catchError` treats it identically to a network failure:

```typescript
catchError(() => {
  applyLocally();          // tries to find player in localStorage — silently no-ops if not found
  return of<void>(undefined);   // converts the error into a success!
})
```

The component's `next:` callback fires, showing **"Player registered!"** and calling
`loadEventPlayers` — which fetches from the API and returns the unchanged list.
The DB has no new row because the API rejected the request.

**To confirm:** check the browser Network tab for the `POST /api/events/{id}/register` call.
If the response is 4xx, this is Scenario A.

**File:** `tournament-client/src/app/core/services/event.service.ts` **Line:** ~188–196
**Cause:** `catchError` in `registerPlayer` swallows real API errors for positive event IDs,
converting any error (including 403/400) into a silent local no-op.

### Scenario B — `applyLocally` silently fails after a successful API call

If the API call **does** succeed (201 response), `tap(() => applyLocally())` fires.
`applyLocally` calls `this.ctx.players.getById(dto.playerId)`. If the player is not seeded
in the local players store (localStorage empty / different store prefix), `getById` returns
`undefined` and the function returns early without pushing to `eventPlayersSubject`.
`loadEventPlayers` should still refresh the list from the API, so in this scenario the player
WOULD be in the DB but briefly not visible.

**To confirm:** if the player IS in the DB but just missing from the UI until a page reload,
this is Scenario B.

---

## Fix

### Frontend (`tournament-client/src/app/`) — Scenario A (primary fix)

- **`core/services/event.service.ts`** — split `catchError` behaviour by error type.
  Only apply locally and swallow the error when the status indicates the API is unreachable
  (network error / no response). For HTTP 4xx/5xx responses from a running API, re-throw so
  the component's `error:` handler shows the correct error snackbar.

  ```typescript
  catchError((err) => {
    // Only fall back to local if the API is genuinely unreachable (no HTTP status)
    if (err?.status != null) return throwError(() => err);
    applyLocally();
    return of<void>(undefined);
  })
  ```

- **`features/events/event-detail.component.ts`** — add an `error:` handler to
  `registerPlayer().subscribe(...)` that shows the API error message via snackbar.
  (Currently the error handler is absent — any rethrown error would be an unhandled
  observable error.)

### Frontend — Scenario B (secondary fix, low priority)

- **`core/services/event.service.ts`** — `applyLocally` should not depend on
  `ctx.players.getById` succeeding. If the player isn't in local store, fall back to calling
  `api.getEventPlayers(eventId)` to refresh, rather than silently no-oping.

### Post-fix checklist
- [ ] Run `/check-zone` on `event-detail.component.ts`

---

## Backend Unit Tests (`src/TournamentOrganizer.Tests/`) *(if needed)*

No backend changes expected — the API is likely already returning the correct error code.
Add a test only if the auth/ownership check for `RegisterPlayer` is found to be wrong.

---

## Frontend Unit Tests (Jest)

**`core/services/event.service.spec.ts`**

- `registerPlayer() — API returns 403 — rethrows error (does not swallow)`
- `registerPlayer() — API returns 400 — rethrows error`
- `registerPlayer() — network error (no status) — applies locally and resolves`

**`features/events/event-detail.component.spec.ts`**

- `registerPlayer() — API error — shows error snackbar with message from API`

Run with: `npx jest --config jest.config.js --testPathPatterns=event.service|event-detail`

---

## Frontend E2E Tests (Playwright)

**File: `e2e/events/event-detail.spec.ts`** — add to existing describe blocks

Helpers needed in `e2e/helpers/api-mock.ts`:
- `mockRegisterPlayerError(page, eventId, status, message)` — intercepts POST with given status

| Describe | Test |
|---|---|
| `Registration: API error on register` | select player, click Register → error snackbar shown, player absent from list |
| `Registration: successful register` | select player, click Register → player appears in list |

Run with: `/e2e e2e/events/event-detail.spec.ts`

---

## Investigation Steps (before fixing)

1. Open browser DevTools → Network tab
2. Register a player from the event detail page
3. Find the `POST /api/events/{id}/register` request
4. Check the response status code:
   - **4xx/5xx** → Scenario A (error swallowed by `catchError`)
   - **201** but player absent from list → Scenario B (`applyLocally` no-op)
   - **Request never appears** → routing/proxy issue; check `proxy.conf.json`

---

## Verification Checklist

- [ ] Root cause confirmed via Network tab (see Investigation Steps above)
- [ ] `/build` — 0 errors on both .NET and Angular
- [ ] Failing test(s) written and confirmed red before touching implementation
- [ ] Implementation fix applied
- [ ] `npx jest --config jest.config.js --testPathPatterns=event.service|event-detail` — all pass
- [ ] `/e2e e2e/events/event-detail.spec.ts` — all pass
- [ ] `/check-zone tournament-client/src/app/features/events/event-detail.component.ts` — clean
