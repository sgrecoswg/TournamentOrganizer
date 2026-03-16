import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import {
  stubUnmatchedApi,
  mockGetPlayerProfile,
  makePlayerProfile,
  makePlayerDto,
} from '../helpers/api-mock';

// ─── Player Profile (/players/:id) ────────────────────────────────────────────
//
// Route registration order matters: Playwright evaluates routes in LIFO order.
// Register stubUnmatchedApi FIRST so specific mocks take priority over it.

const ALICE_PROFILE = makePlayerProfile({ id: 1, name: 'Alice', email: 'alice@test.com' });
const ALICE_DTO     = makePlayerDto({ id: 1, name: 'Alice', email: 'alice@test.com' });

// ── Online path ───────────────────────────────────────────────────────────────

test.describe('Player Profile — online', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'StoreEmployee', { storeId: 1 });
    await stubUnmatchedApi(page);
    await mockGetPlayerProfile(page, ALICE_PROFILE);
    await page.goto('/players/1');
  });

  test('shows the player name', async ({ page }) => {
    await expect(page.getByText('Alice')).toBeVisible();
  });

  test('History tab IS visible', async ({ page }) => {
    const tabs = page.getByRole('tab');
    await expect(tabs.filter({ hasText: 'History' })).toBeVisible();
  });

  test('Trading tab IS visible', async ({ page }) => {
    const tabs = page.getByRole('tab');
    await expect(tabs.filter({ hasText: 'Trading' })).toBeVisible();
  });
});

// ── Offline path (API 500) ────────────────────────────────────────────────────

test.describe('Player Profile — offline (API 500)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'StoreEmployee', { storeId: 1 });
    // Pre-seed localStorage cache so the component can show cached player info
    await page.addInitScript((player) => {
      localStorage.setItem('to_store_1_players', JSON.stringify([player]));
      localStorage.setItem('to_store_1_players_meta', JSON.stringify([]));
    }, ALICE_DTO);
    await stubUnmatchedApi(page);
    await page.route('**/api/players/1/profile', route => route.fulfill({ status: 500 }));
    await page.goto('/players/1');
  });

  test('shows cached player name from localStorage', async ({ page }) => {
    await expect(page.getByText('Alice')).toBeVisible();
  });

  test('History tab is NOT visible', async ({ page }) => {
    const tabs = page.getByRole('tab');
    await expect(tabs.filter({ hasText: 'History' })).not.toBeVisible();
  });

  test('Trading tab is NOT visible', async ({ page }) => {
    const tabs = page.getByRole('tab');
    await expect(tabs.filter({ hasText: 'Trading' })).not.toBeVisible();
  });
});
