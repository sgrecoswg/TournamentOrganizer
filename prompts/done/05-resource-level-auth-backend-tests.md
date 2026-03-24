# RLS: Resource-Level Authorization Backend Tests

> **GitHub Issue:** [#37 test: RLS — Resource-Level Authorization Backend Tests](https://github.com/sgrecoswg/TournamentOrganizer/issues/37)
> **Story Points:** 3 · Model: `sonnet`

## What
xUnit tests for the manual resource-level checks inside controllers (beyond just policy attributes).

## Why
Controllers have logic like "StoreManager can only update their own store" and "Players can only register themselves" — these are coded manually and currently untested.

## Items to Test

### EventsController
- `RegisterPlayer`: Player can register themselves → 200
- `RegisterPlayer`: Player tries to register a different player → 403
- `RegisterPlayer`: StoreEmployee can register any player → 200
- `Create`: StoreEmployee auto-assigned to their store (no override) → correct storeId
- `Create`: Admin must provide storeId explicitly

### StoresController
- `Update`: StoreManager updates their own store → 200
- `Update`: StoreManager tries to update a different store → 403
- `Update`: Administrator updates any store → 200
- `GetMeta`: Employee gets their store's meta → 200
- `GetMeta`: Employee gets a different store's meta → 403

### AppUsersController
- `UpdateRole`: Administrator can change any user's role → 200
- `UpdateRole`: StoreManager cannot escalate a user to Administrator → 403 or validation error

## Approach
Instantiate controllers with mocked services and a `ClaimsPrincipal` constructed for each scenario. Assert the returned `IActionResult` type (Ok, Forbid, etc.).
