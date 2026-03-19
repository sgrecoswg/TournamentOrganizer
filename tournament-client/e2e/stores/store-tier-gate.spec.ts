import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import {
  stubUnmatchedApi,
  mockGetStore,
  mockGetThemes,
  mockGetEmployees,
  mockGetEventTemplates,
  makeStoreDetailDto,
  makeThemeDto,
  makeLicenseDto,
} from '../helpers/api-mock';

// ─── Store Licensing Tier Gates (/stores/:id) ─────────────────────────────────
//
// Verifies that the store-detail page shows/hides features based on the
// current user's licenseTier JWT claim.
//
// Route order: stubUnmatchedApi FIRST (catch-all), feature mocks AFTER (LIFO).

const STORE_ID = 1;

const BASE_STORE = makeStoreDetailDto({
  id:       STORE_ID,
  storeName: 'Tier Test Shop',
  allowableTradeDifferential: 10,
});

const THEMES = [makeThemeDto()];

// ── Free tier (StoreEmployee, no license) ─────────────────────────────────────

test.describe('Store Tier Gate — Free tier StoreEmployee', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'StoreEmployee', { storeId: STORE_ID, licenseTier: 'Free' });
    await stubUnmatchedApi(page);
    await mockGetThemes(page, THEMES);
    await mockGetStore(page, BASE_STORE);
    await page.goto(`/stores/${STORE_ID}`);
  });

  test('logo upload button is NOT shown for Free tier employee', async ({ page }) => {
    // Should NOT see a "Change Logo" or "upload" button
    await expect(page.getByRole('button', { name: /change logo/i })).not.toBeVisible();
  });

  test('upgrade prompt is shown for logo upload when Free tier', async ({ page }) => {
    await expect(page.getByText(/tier 1/i)).toBeVisible();
  });

  test('Save button is NOT shown in Settings tab for Free tier employee (not a manager)', async ({ page }) => {
    const saveBtn = page.getByRole('button', { name: /^save$/i });
    await expect(saveBtn).not.toBeVisible();
  });
});

// ── Tier 1 (StoreEmployee) ────────────────────────────────────────────────────

test.describe('Store Tier Gate — Tier1 StoreEmployee', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'StoreEmployee', { storeId: STORE_ID, licenseTier: 'Tier1' });
    await stubUnmatchedApi(page);
    await mockGetThemes(page, THEMES);
    await mockGetStore(page, BASE_STORE);
    await page.goto(`/stores/${STORE_ID}`);
  });

  test('Change Logo button IS shown for Tier1 employee', async ({ page }) => {
    await expect(page.getByRole('button', { name: /change logo/i })).toBeVisible();
  });

  test('upgrade prompt is NOT shown for Tier1 employee', async ({ page }) => {
    await expect(page.getByText(/logo upload requires tier 1/i)).not.toBeVisible();
  });
});

// ── Tier 1 (StoreManager) — Save button ──────────────────────────────────────

test.describe('Store Tier Gate — Tier1 StoreManager', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'StoreManager', { storeId: STORE_ID, licenseTier: 'Tier1' });
    await stubUnmatchedApi(page);
    await mockGetThemes(page, THEMES);
    await mockGetEmployees(page, STORE_ID, []);
    await mockGetEventTemplates(page, STORE_ID, []);
    await mockGetStore(page, BASE_STORE);
    await page.goto(`/stores/${STORE_ID}`);
  });

  test('Save button IS visible for Tier1 StoreManager', async ({ page }) => {
    await expect(page.getByRole('button', { name: /^save$/i })).toBeVisible();
  });
});

// ── Free tier StoreManager — Save button hidden ───────────────────────────────

test.describe('Store Tier Gate — Free tier StoreManager (no save)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'StoreManager', { storeId: STORE_ID, licenseTier: 'Free' });
    await stubUnmatchedApi(page);
    await mockGetThemes(page, THEMES);
    await mockGetEmployees(page, STORE_ID, []);
    await mockGetEventTemplates(page, STORE_ID, []);
    await mockGetStore(page, BASE_STORE);
    await page.goto(`/stores/${STORE_ID}`);
  });

  test('Save button is NOT visible for Free tier StoreManager', async ({ page }) => {
    await expect(page.getByRole('button', { name: /^save$/i })).not.toBeVisible();
  });
});

// ── License tab — tier chip for StoreManager ─────────────────────────────────

test.describe('Store Tier Gate — License tab tier chip', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'StoreManager', { storeId: STORE_ID, licenseTier: 'Tier1' });
    await stubUnmatchedApi(page);
    await mockGetThemes(page, THEMES);
    await mockGetEmployees(page, STORE_ID, []);
    await mockGetEventTemplates(page, STORE_ID, []);
    await mockGetStore(page, makeStoreDetailDto({
      id:       STORE_ID,
      storeName: 'Tier Test Shop',
      allowableTradeDifferential: 10,
      license:  makeLicenseDto({ tier: 'Tier1' }),
    }));
    await page.goto(`/stores/${STORE_ID}`);
  });

  test('License tab is visible for StoreManager', async ({ page }) => {
    await expect(page.getByRole('tab', { name: 'License' })).toBeVisible();
  });

  test('tier chip shows the license tier after clicking License tab', async ({ page }) => {
    await page.getByRole('tab', { name: 'License' }).click();
    // The tier chip or tier label should show in the license tab content
    await expect(page.getByText(/tier/i)).toBeVisible();
  });
});

// ── License expiry warning ────────────────────────────────────────────────────

test.describe('Store Tier Gate — License expiry warning', () => {
  test('shows expiry warning when license expires in 10 days', async ({ page }) => {
    const soonDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    await loginAs(page, 'StoreManager', { storeId: STORE_ID, licenseTier: 'Tier1' });
    await stubUnmatchedApi(page);
    await mockGetThemes(page, THEMES);
    await mockGetEmployees(page, STORE_ID, []);
    await mockGetEventTemplates(page, STORE_ID, []);
    await mockGetStore(page, makeStoreDetailDto({
      id:       STORE_ID,
      storeName: 'Tier Test Shop',
      allowableTradeDifferential: 10,
      license:  makeLicenseDto({ expiresDate: soonDate, tier: 'Tier1' }),
    }));
    await page.goto(`/stores/${STORE_ID}`);
    await page.getByRole('tab', { name: 'License' }).click();
    await expect(page.getByText(/expires in \d+ days/i)).toBeVisible();
  });

  test('does NOT show expiry warning when license expires far in future', async ({ page }) => {
    const farDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    await loginAs(page, 'StoreManager', { storeId: STORE_ID, licenseTier: 'Tier1' });
    await stubUnmatchedApi(page);
    await mockGetThemes(page, THEMES);
    await mockGetEmployees(page, STORE_ID, []);
    await mockGetEventTemplates(page, STORE_ID, []);
    await mockGetStore(page, makeStoreDetailDto({
      id:       STORE_ID,
      storeName: 'Tier Test Shop',
      allowableTradeDifferential: 10,
      license:  makeLicenseDto({ expiresDate: farDate, tier: 'Tier2' }),
    }));
    await page.goto(`/stores/${STORE_ID}`);
    await page.getByRole('tab', { name: 'License' }).click();
    await expect(page.getByText(/expires in \d+ days/i)).not.toBeVisible();
  });
});
