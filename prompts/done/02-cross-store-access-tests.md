# RLS: Cross-Store Access Tests

> **GitHub Issue:** [#34 test: RLS — Cross-Store Access Tests](https://github.com/sgrecoswg/TournamentOrganizer/issues/34)
> **Story Points:** 3 · Model: `sonnet`

## What
Tests verifying that a StoreEmployee/StoreManager of store A cannot read or mutate store B's data.

## Why
All store isolation is done manually in controllers by comparing the JWT `storeId` claim to the resource's `storeId`. There is no automatic row-filtering and no tests confirming these checks hold.

## Items to Test
- `GET /api/stores/{id}` — StoreEmployee of store 1 gets 403 for store 2
- `PUT /api/stores/{id}` — StoreManager of store 1 cannot update store 2
- `GET /api/stores/{id}/meta` — Employee of store 1 gets 403 for store 2
- `GET /api/events` — Events endpoint only returns events for the user's store
- `GET /api/appusers?storeId=X` — Employee of store 1 cannot list store 2 employees
- `POST /api/events` — StoreEmployee cannot create an event for a different store

## Notes
- Administrator should pass all of the above (global access)
- Backend: use `WebApplicationFactory` with crafted JWT (`storeId` claim set to store A)
- E2E: navigate directly to `/stores/2` when logged in as store 1 employee and assert 403/redirect
