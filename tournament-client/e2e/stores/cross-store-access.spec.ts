import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import {
  stubUnmatchedApi,
  mockGetStores,
  mockGetThemes,
  makeStoreDto,
} from '../helpers/api-mock';

// ─── Cross-Store Access E2E Tests ─────────────────────────────────────────────
//
// Verifies that a StoreEmployee of store A cannot load store B's detail page.
// The API now requires StoreEmployee policy on GET /api/stores/{id} and enforces
// storeId ownership — so a cross-store request returns 403.
//
// The frontend should redirect to /stores and show an "Access denied" snackbar
// when the API returns 403 on the store load.

// ── StoreEmployee: cross-store navigation redirects ───────────────────────────

test.describe('Cross-store access — StoreEmployee redirected from foreign store', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'StoreEmployee', { storeId: 1 });
    await stubUnmatchedApi(page);
    await mockGetThemes(page, []);
    await mockGetStores(page, [
      makeStoreDto({ id: 1, storeName: 'Own Store' }),
      makeStoreDto({ id: 2, storeName: 'Other Store' }),
    ]);
    // Mock GET /api/stores/2 → 403 Forbidden
    await page.route('**/api/stores/2', route => {
      if (route.request().method() === 'GET') {
        route.fulfill({ status: 403, body: 'Forbidden' });
      } else {
        route.continue();
      }
    });
  });

  test('navigating to a foreign store redirects to /stores', async ({ page }) => {
    await page.goto('/stores/2');
    await expect(page).toHaveURL(/\/stores$/, { timeout: 5000 });
  });

  test('an "Access denied" snackbar is shown after forbidden store load', async ({ page }) => {
    await page.goto('/stores/2');
    await expect(page.locator('mat-snack-bar-container')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('mat-snack-bar-container')).toContainText(/Access denied/i);
  });
});

// ── StoreEmployee: own store loads normally ────────────────────────────────────

test.describe('Cross-store access — StoreEmployee can load own store', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'StoreEmployee', { storeId: 1 });
    await stubUnmatchedApi(page);
    await mockGetThemes(page, []);
  });

  test('StoreEmployee navigating to own store sees the store page', async ({ page }) => {
    await page.goto('/stores/1');
    // stubUnmatchedApi returns {} for the store — component renders normally (no redirect)
    await expect(page).toHaveURL(/\/stores\/1/, { timeout: 5000 });
  });
});
