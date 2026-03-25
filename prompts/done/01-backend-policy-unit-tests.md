# RLS: Backend Policy Unit Tests

> **GitHub Issue:** [#33 test: RLS — Backend Policy Unit Tests](https://github.com/sgrecoswg/TournamentOrganizer/issues/33)
> **Story Points:** 3 · Model: `sonnet`

## What
Add xUnit tests verifying that ASP.NET authorization policies actually block the roles they should.

## Why
Zero backend auth tests currently exist. `[Authorize(Policy = "StoreEmployee")]` is declared but never verified to block a `Player` role.

## Items to Test
- `StoreEmployee` policy blocks unauthenticated and `Player` role
- `StoreManager` policy blocks `Player` and `StoreEmployee` roles
- `Administrator` policy blocks `Player`, `StoreEmployee`, and `StoreManager` roles
- Unauthenticated requests to any `[Authorize]` endpoint return 401

## Controllers to Cover
- `EventsController` — `[Authorize(Policy = "StoreEmployee")]`
- `StoresController` — mixed policies per endpoint
- `AppUsersController` — admin/manager-only actions
- `AuthController` — `/api/auth/me` requires `[Authorize]`

## Approach
Use `WebApplicationFactory<Program>` with a custom JWT for each role. Assert 403 for forbidden roles, 200/valid for allowed roles.
