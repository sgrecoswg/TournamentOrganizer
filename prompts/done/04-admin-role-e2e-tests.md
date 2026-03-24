# RLS: Administrator Role E2E Tests

> **GitHub Issue:** [#36 test: RLS — Administrator Role E2E Tests](https://github.com/sgrecoswg/TournamentOrganizer/issues/36)
> **Story Points:** 3 · Model: `sonnet`

## What
E2E tests covering Administrator-specific global access scenarios that are currently untested.

## Why
The Administrator role is referenced throughout the backend and policy config but has minimal E2E coverage. Global access and cross-store capabilities are unverified.

## Items to Test
- Admin can view the store list and navigate to any store
- Admin can create a new store
- Admin can view and edit any store's settings (not just their own)
- Admin can view employees of any store
- Admin can change a user's role (`AppUsersController`)
- Admin can manage events across all stores
- Admin sees no "storeId restriction" on event creation (can choose any store)

## Notes
- Use `loginAs(page, 'Administrator')` — no `storeId` in token (global)
- Mock `GET /api/stores` to return multiple stores
- Mock `GET /api/appusers` for user management UI
- Verify admin-only UI elements are visible (e.g. store selector on event creation)
