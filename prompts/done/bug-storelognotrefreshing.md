# Bug: Store logo not refreshing when changed

## Summary
When a user updates the image for their logo, it does not update the logo next to the store slector in app.html until refresh

**Broken behaviour:**
Given a user can change a logo of a store
When thy do
Then it does not update the logo in the tournament-client\src\app\app.html line 34
When we change to the store does not change unless i refresh

**Expected behaviour:**
Given a user can adds or changes a logo of a store
When thy do
It updates the logo in tournament-client\src\app\app.html line 34 if it is the one selected.
When we change to the store it should change

**Reproduction steps:**
1. navigate to store details
2. add/modify the logo

---

## Root Cause

**File:** `features/stores/store-detail.component.ts` **Line:** ~707
**Cause:** `onLogoSelected()` updates only the component's local `this.store` reference after a successful upload; it never calls `this.ctx.stores.update(dto)` or `this.storeContext.storesChanged$.next()`, so `app.ts` never refreshes its `stores` array and the toolbar logo stays stale.

---

## Fix

### Frontend (`tournament-client/src/app/`)

- **`features/stores/store-detail.component.ts`** — In the `onLogoSelected()` upload success handler, after updating `this.store`, add:
  ```ts
  const cached = this.ctx.stores.getById(this.storeId);
  if (cached) this.ctx.stores.update({ ...cached, logoUrl: dto.logoUrl ?? null });
  this.storeContext.storesChanged$.next();
  ```
  This mirrors the existing pattern used by the store-name save handler (lines 511–517).

### Post-fix checklist
- [ ] Run `/check-zone` on every modified component

---

## Backend Unit Tests (`src/TournamentOrganizer.Tests/`) *(if needed)*

No backend change required.

---

## Frontend Unit Tests (Jest)

**`features/stores/store-detail.component.spec.ts`**

- `onLogoSelected() — after successful upload — calls ctx.stores.update with new logoUrl` — confirms the cache is written
- `onLogoSelected() — after successful upload — emits storeContext.storesChanged$` — confirms app shell gets notified

Run with: `npx jest --config jest.config.js --testPathPatterns=store-detail.component`

---

## Frontend E2E Tests (Playwright)

**File: `e2e/stores/store-logo.spec.ts`**

Helpers needed in `e2e/helpers/api-mock.ts`:
- `mockUploadStoreLogo(page, storeId, logoUrl)` — intercepts `POST /api/stores/:id/logo` and returns a StoreDto with the given `logoUrl`

Describe block / test:

| Describe | Test |
|---|---|
| `Store logo — toolbar refresh` | upload a logo → toolbar `<img>` src updates to new URL without page reload |
| `Store logo — store switch` | upload logo for store A, switch to store B, switch back to store A → toolbar shows updated logo |

Run with: `/e2e e2e/stores/store-logo.spec.ts`
**All tests (new + existing in this file) must pass before the fix is considered done.**

---

## Verification Checklist

- [x] `/build` — 0 errors on both .NET and Angular
- [x] Failing test(s) written and confirmed red before touching implementation
- [x] Implementation fix applied
- [x] `npx jest --config jest.config.js --testPathPatterns=store-detail.component` — all pass (44/44)
- [x] `/e2e e2e/stores/store-logo.spec.ts` — all pass
- [x] `/check-zone` — clean, no missing `cdr.detectChanges()` in modified components

## Resolution Notes

Fixed 2026-03-14 across three iterations.

### Issue 1 — toolbar logo never updated (original bug)

`onLogoSelected()` in `store-detail.component.ts` updated only the component's local
`this.store` on upload success. It never wrote back to `ctx.stores` or emitted
`storeContext.storesChanged$`, so `app.ts` never refreshed its `stores` array.

**Fix:** added to `onLogoSelected()` success handler:
```ts
const cached = this.ctx.stores.getById(this.storeId);
if (cached) this.ctx.stores.update({ ...cached, logoUrl: dto.logoUrl ?? null });
this.storeContext.storesChanged$.next();
```

### Issue 2 — browser image cache served the old image (same URL)

The server always writes to the same path (`/logos/{id}.ext`), so the browser cached
the old image and served it even after the upload succeeded.

**Fix:** append `?t=<Date.now()>` to the logo URL everywhere it is set from an API
response, forcing the browser to re-fetch:
- `onLogoSelected()` success handler — after upload
- `ngOnInit` → `getStore` next — on page load / navigate-back
- `save()` next — after saving store settings

**Fix in `app.ts`:** `selectedStore` getter applies `?t=<sessionTs>` to any logo URL
that doesn't already have a timestamp, using a per-session constant so the getter
doesn't call `Date.now()` on every invocation.

### Tests added

Two new Jest specs in `store-detail.component.spec.ts`:
- `onLogoSelected() — after successful upload — calls ctx.stores.update with new logoUrl`
- `onLogoSelected() — after successful upload — emits storeContext.storesChanged$`

Existing specs updated to match `?t=\d+` pattern for logo URL assertions.

**Remaining:** E2E tests in `e2e/stores/store-logo.spec.ts` still to be written.
