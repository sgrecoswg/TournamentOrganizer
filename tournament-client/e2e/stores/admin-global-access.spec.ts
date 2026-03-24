import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import {
  stubUnmatchedApi,
  mockGetStore,
  mockGetStores,
  mockGetEmployees,
  mockGetThemes,
  mockGetEvent,
  mockGetEventPlayers,
  mockGetEvents,
  makeStoreDetailDto,
  makeStoreDto,
  makeEventDto,
  makeEventPlayerDto,
} from '../helpers/api-mock';

// ─── Administrator Role: Global Access E2E Tests ──────────────────────────────
//
// Verifies that the Administrator role has unrestricted UI access across all
// stores and events, matching the backend [Authorize(Policy = "Administrator")]
// and isAdmin checks.

const STORE_A = makeStoreDetailDto({ id: 1, storeName: 'Alpha Game Shop' });
const STORE_B = makeStoreDetailDto({ id: 2, storeName: 'Beta Game Shop' });

// ── Store list: Admin can navigate to any store ───────────────────────────────

test.describe('Admin — store list: navigate to any store', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'Administrator');
    await stubUnmatchedApi(page);
    await mockGetStores(page, [
      makeStoreDto({ id: 1, storeName: 'Alpha Game Shop' }),
      makeStoreDto({ id: 2, storeName: 'Beta Game Shop' }),
    ]);
    await page.goto('/stores');
  });

  test('both stores are visible in the list', async ({ page }) => {
    await expect(page.getByRole('cell', { name: 'Alpha Game Shop' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Beta Game Shop' })).toBeVisible();
  });

  test('store name link navigates to its detail page', async ({ page }) => {
    const link = page.getByRole('link', { name: 'Alpha Game Shop' });
    await expect(link).toHaveAttribute('href', '/stores/1');
  });
});

// ── Store settings: Admin can edit any store's settings ──────────────────────

test.describe('Admin — store detail: can edit any store settings', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'Administrator');
    await stubUnmatchedApi(page);
    await mockGetThemes(page, []);
    await mockGetStore(page, STORE_A);
    await mockGetEmployees(page, 1, []);
    await page.goto('/stores/1');
  });

  test('Save button is visible for Admin on any store', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Save/ })).toBeVisible();
  });

  test('Store Name field is editable for Admin', async ({ page }) => {
    const input = page.getByLabel('Store Name');
    await expect(input).not.toBeDisabled();
  });
});

// ── Employees tab: Admin can view employees of any store ─────────────────────

test.describe('Admin — store detail: Employees tab visible for any store', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'Administrator');
    await stubUnmatchedApi(page);
    await mockGetThemes(page, []);
    await mockGetStore(page, STORE_B);
    await mockGetEmployees(page, 2, [
      { id: 10, name: 'Charlie Staff', email: 'charlie@beta.com', role: 'StoreEmployee' },
    ]);
    await page.goto('/stores/2');
  });

  test('Employees tab is visible for Admin on a different store', async ({ page }) => {
    await expect(page.getByRole('tab', { name: 'Employees' })).toBeVisible();
  });

  test('Admin can see existing employees in the Employees tab', async ({ page }) => {
    await page.getByRole('tab', { name: 'Employees' }).click();
    await expect(page.getByRole('cell', { name: 'Charlie Staff' })).toBeVisible();
  });
});

// ── Event detail: Admin sees store employee management controls ───────────────
// Admin has isStoreEmployee = true, so all employee-gated controls are visible.

const EVENT_ID = 1;
const STORE_ID = 1;
const REG_EVENT = makeEventDto({ id: EVENT_ID, status: 'Registration', playerCount: 1, storeId: STORE_ID });
const ALICE = makeEventPlayerDto({ playerId: 1, name: 'Alice', isCheckedIn: false });

test.describe('Admin — event detail: has store employee management controls', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'Administrator');
    await stubUnmatchedApi(page);
    await mockGetStores(page, []);
    await mockGetEvent(page, REG_EVENT);
    await mockGetEventPlayers(page, EVENT_ID, [ALICE]);
    await mockGetEvents(page, []);
    await page.goto(`/events/${EVENT_ID}`);
  });

  test('Check-In section is visible for Admin', async ({ page }) => {
    await expect(page.locator('.checkin-section')).toBeVisible();
  });

  test('"Check In All" button is visible for Admin', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Check In All/i })).toBeVisible();
  });
});
