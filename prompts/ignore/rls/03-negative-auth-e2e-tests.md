# RLS: Negative Authorization E2E Tests

> **GitHub Issue:** [#35 test: RLS — Negative Authorization E2E Tests](https://github.com/sgrecoswg/TournamentOrganizer/issues/35)

## What
Playwright E2E tests that assert unauthorized users receive a forbidden/redirect response — not just that authorized users succeed.

## Why
All current E2E auth tests are "happy path" only. Missing coverage: what happens when the wrong role tries an action.

## Items to Test

### UI element hidden AND API blocked
- Player tries to upload a logo → button absent + mocked 403 API response handled gracefully
- Player tries to access employee management tab → tab absent + direct URL redirects/errors
- StoreEmployee tries to access License tab → tab absent

### Registration gating
- Unauthenticated user navigates to event detail → redirected to login
- Player tries to register a *different* player for an event → mocked 403 shown as error

### Settings
- StoreEmployee tries to edit store settings → Save button absent (or disabled)
- StoreEmployee tries to navigate directly to store settings → handled gracefully

## Approach
Use `loginAs(page, 'Player')` (or no login), mock the relevant API with a 403 response via `page.route()`, and assert the correct UI feedback (snackbar error, redirect, hidden element).
