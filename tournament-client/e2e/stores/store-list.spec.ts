import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { mockGetStores, stubUnmatchedApi, makeStoreDto } from '../helpers/api-mock';

// ─── Store List (/stores) ─────────────────────────────────────────────────────
//
// Route registration order matters: Playwright evaluates routes in LIFO order
// (last registered = first evaluated).  Always register stubUnmatchedApi FIRST
// so it acts as a true catch-all and specific mocks registered afterwards take
// priority over it.

test.describe('Store List page (/stores)', () => {

  // ── Empty state ─────────────────────────────────────────────────────────────

  test.describe('when there are no stores', () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(page, 'Player');
      await stubUnmatchedApi(page);      // catch-all — registered first → evaluated last
      await mockGetStores(page, []);
      await page.goto('/stores');
    });

    test('shows the page heading', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'Stores' })).toBeVisible();
    });

    test('shows the empty-state message', async ({ page }) => {
      await expect(page.getByText('No stores yet.')).toBeVisible();
    });

    test('does not show the stores table', async ({ page }) => {
      await expect(page.locator('table')).not.toBeVisible();
    });
  });

  // ── Populated state ─────────────────────────────────────────────────────────

  test.describe('when the API returns stores', () => {
    const stores = [
      makeStoreDto({ id: 1, storeName: 'Downtown Game Shop', isActive: true }),
      makeStoreDto({ id: 2, storeName: 'Riverside Cards',    isActive: false }),
    ];

    test.beforeEach(async ({ page }) => {
      await loginAs(page, 'Player');
      await stubUnmatchedApi(page);
      await mockGetStores(page, stores);
      await page.goto('/stores');
    });

    test('renders a row for each store', async ({ page }) => {
      await expect(page.getByRole('cell', { name: 'Downtown Game Shop' })).toBeVisible();
      await expect(page.getByRole('cell', { name: 'Riverside Cards' })).toBeVisible();
    });

    test('shows the table header columns', async ({ page }) => {
      await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Active' })).toBeVisible();
    });

    test('store name is a link to the detail page', async ({ page }) => {
      const link = page.getByRole('link', { name: 'Downtown Game Shop' });
      await expect(link).toHaveAttribute('href', '/stores/1');
    });

    test('settings icon button navigates to store detail', async ({ page }) => {
      // Scope to the table to avoid matching the toolbar's account_circle button
      await page.locator('table').getByRole('button').first().click();
      await expect(page).toHaveURL(/\/stores\/1/);
    });
  });

  // ── Role-based UI ───────────────────────────────────────────────────────────

  test.describe('Admin user', () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(page, 'Administrator');
      await stubUnmatchedApi(page);
      await mockGetStores(page, []);
      await page.goto('/stores');
    });

    test('sees the "New Store" form card', async ({ page }) => {
      await expect(page.getByText('New Store')).toBeVisible();
    });

    test('sees the Store Name input', async ({ page }) => {
      await expect(page.getByLabel('Store Name')).toBeVisible();
    });

    test('Create button is disabled when the store name is empty', async ({ page }) => {
      await expect(page.getByRole('button', { name: /Create/ })).toBeDisabled();
    });

    test('Create button is enabled after typing a store name', async ({ page }) => {
      await page.getByLabel('Store Name').fill('New Shop');
      await expect(page.getByRole('button', { name: /Create/ })).toBeEnabled();
    });
  });

  test.describe('Non-admin user', () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(page, 'Player');
      await stubUnmatchedApi(page);
      await mockGetStores(page, []);
      await page.goto('/stores');
    });

    test('does not see the "New Store" form card', async ({ page }) => {
      await expect(page.getByText('New Store')).not.toBeVisible();
    });
  });

  // ── Create store (happy path) ───────────────────────────────────────────────

  test('Admin can create a store and it appears in the list', async ({ page }) => {
    const newStore = makeStoreDto({ id: 3, storeName: 'Brand New Shop' });

    await loginAs(page, 'Administrator');
    await stubUnmatchedApi(page);
    // Single route handles both initial GET (empty list) and the POST
    await page.route('**/api/stores', route => {
      if (route.request().method() === 'POST') {
        route.fulfill({ json: newStore });
      } else {
        route.fulfill({ json: [] });
      }
    });

    await page.goto('/stores');

    await page.getByLabel('Store Name').fill('Brand New Shop');
    await page.getByRole('button', { name: /Create/ }).click();

    // Snackbar confirmation
    await expect(page.getByText(/Brand New Shop.*created/)).toBeVisible();
    // Store appears in the table
    await expect(page.getByRole('cell', { name: 'Brand New Shop' })).toBeVisible();
    // Input is cleared
    await expect(page.getByLabel('Store Name')).toHaveValue('');
  });
});
