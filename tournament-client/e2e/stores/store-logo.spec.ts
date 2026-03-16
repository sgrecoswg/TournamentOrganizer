import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import {
  stubUnmatchedApi,
  mockGetStore,
  mockGetStores,
  mockGetThemes,
  mockUploadStoreLogo,
  makeStoreDetailDto,
  makeStoreDto,
} from '../helpers/api-mock';

// ─── Store logo — upload & display ───────────────────────────────────────────
//
// Route registration order: stubUnmatchedApi FIRST (LIFO — last registered wins),
// so specific mocks registered afterwards take priority.

const STORE_ID = 1;
const OLD_LOGO  = '/logos/1.png';
const NEW_LOGO  = '/logos/1.png'; // same path on disk — cache-busting is the fix

const STORE_WITH_LOGO = makeStoreDetailDto({
  id:        STORE_ID,
  storeName: 'Logo Test Shop',
  logoUrl:   OLD_LOGO,
});

const STORE_NO_LOGO = makeStoreDetailDto({
  id:        STORE_ID,
  storeName: 'Logo Test Shop',
});

// ── Toolbar logo on initial load ─────────────────────────────────────────────
// The toolbar logo block is inside @if (isAdmin), so Administrator role is required.
// selectedStoreId starts as null — we must select a store from the dropdown first.

test.describe('Store logo — toolbar display', () => {
  test('toolbar shows store-logo-thumb after selecting a store with a logo', async ({ page }) => {
    await loginAs(page, 'Administrator');
    await stubUnmatchedApi(page);
    await mockGetStores(page, [makeStoreDto({ id: STORE_ID, storeName: 'Logo Test Shop', logoUrl: OLD_LOGO })]);
    await mockGetStore(page, STORE_WITH_LOGO);
    await mockGetThemes(page, []);
    await page.goto('/stores/1');

    // Select the store from the toolbar dropdown so selectedStoreId is set
    await page.locator('mat-toolbar mat-select').click();
    await page.getByRole('option', { name: 'Logo Test Shop' }).click();

    const thumb = page.locator('.store-logo-thumb');
    await expect(thumb).toBeVisible();
    await expect(thumb).toHaveAttribute('src', /\/logos\/1\.png/);
  });

  test('toolbar shows placeholder icon when selected store has no logo', async ({ page }) => {
    await loginAs(page, 'Administrator');
    await stubUnmatchedApi(page);
    await mockGetStores(page, [makeStoreDto({ id: STORE_ID, storeName: 'Logo Test Shop' })]);
    await mockGetStore(page, STORE_NO_LOGO);
    await mockGetThemes(page, []);
    await page.goto('/stores/1');

    await page.locator('mat-toolbar mat-select').click();
    await page.getByRole('option', { name: 'Logo Test Shop' }).click();

    await expect(page.locator('mat-toolbar .store-logo-thumb')).not.toBeVisible();
    await expect(page.locator('mat-toolbar .store-logo-placeholder')).toBeVisible();
  });
});

// ── Logo upload refreshes the store-detail page ───────────────────────────────

test.describe('Store logo — upload refreshes store-detail image', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'StoreEmployee');
    await stubUnmatchedApi(page);
    await mockGetStores(page, [makeStoreDto({ id: STORE_ID, storeName: 'Logo Test Shop' })]);
    await mockGetStore(page, STORE_WITH_LOGO);
    await mockGetThemes(page, []);
    // Upload returns the same path — the component must cache-bust to show the new image
    await mockUploadStoreLogo(page, STORE_ID, makeStoreDto({ id: STORE_ID, storeName: 'Logo Test Shop', logoUrl: NEW_LOGO }));
    await page.goto('/stores/1');
  });

  test('store-logo img is visible before upload', async ({ page }) => {
    await expect(page.locator('.store-logo')).toBeVisible();
  });

  test('after upload the store-logo src contains a cache-busting timestamp', async ({ page }) => {
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByRole('button', { name: /Change Logo/i }).click(),
    ]);
    await fileChooser.setFiles({
      name:     'new-logo.png',
      mimeType: 'image/png',
      buffer:   Buffer.from('PNG'),
    });

    const img = page.locator('.store-logo');
    await expect(img).toHaveAttribute('src', /\/logos\/1\.png\?t=\d+/);
  });
});

// ── Logo upload refreshes the toolbar thumbnail ───────────────────────────────

test.describe('Store logo — upload refreshes toolbar thumbnail', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'Administrator');
    await stubUnmatchedApi(page);
    await mockGetStores(page, [makeStoreDto({ id: STORE_ID, storeName: 'Logo Test Shop', logoUrl: OLD_LOGO })]);
    await mockGetStore(page, STORE_WITH_LOGO);
    await mockGetThemes(page, []);
    await mockUploadStoreLogo(page, STORE_ID, makeStoreDto({ id: STORE_ID, storeName: 'Logo Test Shop', logoUrl: NEW_LOGO }));
    await page.goto('/stores/1');

    // Select the store so selectedStoreId is set and the toolbar thumbnail renders
    await page.locator('mat-toolbar mat-select').click();
    await page.getByRole('option', { name: 'Logo Test Shop' }).click();
  });

  test('after upload the toolbar store-logo-thumb src contains a cache-busting timestamp', async ({ page }) => {
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByRole('button', { name: /Change Logo/i }).click(),
    ]);
    await fileChooser.setFiles({
      name:     'new-logo.png',
      mimeType: 'image/png',
      buffer:   Buffer.from('PNG'),
    });

    const thumb = page.locator('.store-logo-thumb');
    await expect(thumb).toHaveAttribute('src', /\/logos\/1\.png\?t=\d+/);
  });
});

// ── Logo persists after Save Settings ────────────────────────────────────────

test.describe('Store logo — persists after Save Settings', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'StoreManager');
    await stubUnmatchedApi(page);
    await mockGetStores(page, [makeStoreDto({ id: STORE_ID, storeName: 'Logo Test Shop', logoUrl: OLD_LOGO })]);
    await mockGetStore(page, STORE_WITH_LOGO);
    await mockGetThemes(page, []);
    await mockUploadStoreLogo(page, STORE_ID, makeStoreDto({ id: STORE_ID, storeName: 'Logo Test Shop', logoUrl: NEW_LOGO }));

    // updateStore returns the store with the logo still set
    await page.route(`**/api/stores/${STORE_ID}`, route => {
      if (route.request().method() === 'PUT') {
        route.fulfill({ json: makeStoreDetailDto({ id: STORE_ID, storeName: 'Logo Test Shop', logoUrl: NEW_LOGO }) });
      } else {
        route.continue();
      }
    });

    await page.goto('/stores/1');
  });

  test('store-logo img still has a cache-busting timestamp after clicking Save', async ({ page }) => {
    // Upload first
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByRole('button', { name: /Change Logo/i }).click(),
    ]);
    await fileChooser.setFiles({
      name:     'new-logo.png',
      mimeType: 'image/png',
      buffer:   Buffer.from('PNG'),
    });
    await expect(page.locator('.store-logo')).toHaveAttribute('src', /\?t=\d+/);

    // Now save settings
    await page.getByRole('button', { name: /Save$/i }).click();

    // Logo should still have a cache-buster — not reverted to bare path
    await expect(page.locator('.store-logo')).toHaveAttribute('src', /\/logos\/1\.png\?t=\d+/);
  });
});
