import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import {
  stubUnmatchedApi,
  mockGetStore,
  mockGetStores,
  mockGetThemes,
  mockGetEvent,
  mockGetEventPlayers,
  mockGetEvents,
  makeStoreDetailDto,
  makeStoreDto,
  makeEventDto,
  makeEventPlayerDto,
} from '../helpers/api-mock';

// ─── Negative Authorization E2E Tests ────────────────────────────────────────
//
// Verifies that unauthorized roles see no forbidden UI controls, and that
// unauthenticated users are redirected rather than allowed through.
//
// Route registration: stubUnmatchedApi FIRST (LIFO — last registered wins).

const STORE = makeStoreDetailDto({ id: 1, storeName: 'Downtown Game Shop' });

// ── Unauthenticated: guarded routes redirect to /login ────────────────────────

test.describe('Negative auth — unauthenticated redirect', () => {
  test('unauthenticated user visiting /stores/:id is redirected to /login', async ({ page }) => {
    // No loginAs — no JWT token
    await stubUnmatchedApi(page);
    await page.goto('/stores/1');
    await expect(page).toHaveURL(/\/login/);
  });

  test('unauthenticated user visiting /stores is redirected to /login', async ({ page }) => {
    await stubUnmatchedApi(page);
    await page.goto('/stores');
    await expect(page).toHaveURL(/\/login/);
  });
});

// ── Player: upload logo button absent ────────────────────────────────────────

test.describe('Negative auth — Player: upload logo button absent', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'Player');
    await stubUnmatchedApi(page);
    await mockGetStore(page, STORE);
    await page.goto('/stores/1');
  });

  test('upload logo button is NOT visible for Player', async ({ page }) => {
    await expect(page.locator('[data-testid="upload-logo-btn"]')).not.toBeVisible();
  });
});

// ── StoreEmployee: License tab absent ────────────────────────────────────────
// License tab requires isStoreManager (StoreEmployee < StoreManager)

test.describe('Negative auth — StoreEmployee: License tab absent', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'StoreEmployee', { storeId: 1 });
    await stubUnmatchedApi(page);
    await mockGetThemes(page, []);
    await mockGetStore(page, STORE);
    await page.goto('/stores/1');
  });

  test('License tab is NOT visible for StoreEmployee', async ({ page }) => {
    await expect(page.getByRole('tab', { name: 'License' })).not.toBeVisible();
  });
});

// ── StoreEmployee: Save settings button absent ────────────────────────────────
// Save requires isStoreManager + isTier1 (StoreEmployee has neither StoreManager role)

test.describe('Negative auth — StoreEmployee: Save button absent', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'StoreEmployee', { storeId: 1 });
    await stubUnmatchedApi(page);
    await mockGetThemes(page, []);
    await mockGetStore(page, STORE);
    await page.goto('/stores/1');
  });

  test('Save button is NOT visible for StoreEmployee', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Save/ })).not.toBeVisible();
  });
});

// ── Player: self-register 403 shown as error snackbar ────────────────────────
// Player has playerId but API returns 403; UI should show an error message.

const EVENT_ID = 1;
const REG_EVENT = makeEventDto({ id: EVENT_ID, status: 'Registration', playerCount: 0, storeId: 1 });

test.describe('Negative auth — Player: register 403 shown as snackbar error', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'Player', { playerId: 1 });
    await stubUnmatchedApi(page);
    await mockGetStores(page, []);
    await mockGetEvent(page, REG_EVENT);
    await mockGetEventPlayers(page, EVENT_ID, []); // no players → self-register button visible
    await mockGetEvents(page, []);
    // Mock the register endpoint to return 403
    await page.route(`**/api/events/${EVENT_ID}/register`, route => {
      route.fulfill({ status: 403, body: 'Forbidden' });
    });
    await page.goto(`/events/${EVENT_ID}`);
  });

  test('Register for This Event button is visible for Player', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Register for This Event/i })).toBeVisible();
  });

  test('clicking Register shows error snackbar when API returns 403', async ({ page }) => {
    await page.getByRole('button', { name: /Register for This Event/i }).click();
    await expect(page.locator('mat-snack-bar-container')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('mat-snack-bar-container')).toContainText(/Failed to register/i);
  });
});
