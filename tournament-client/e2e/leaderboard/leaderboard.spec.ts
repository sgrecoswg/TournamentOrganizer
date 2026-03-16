import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import {
  stubUnmatchedApi,
  mockGetLeaderboard,
  makeLeaderboardEntry,
  makePlayerDto,
} from '../helpers/api-mock';

// ─── Leaderboard (/leaderboard) ───────────────────────────────────────────────
//
// Route registration order matters: Playwright evaluates routes in LIFO order.
// Register stubUnmatchedApi FIRST so specific mocks take priority over it.

const ALICE_ENTRY = makeLeaderboardEntry({ rank: 1, playerId: 1, name: 'Alice', conservativeScore: 20 });
const BOB_ENTRY   = makeLeaderboardEntry({ rank: 2, playerId: 2, name: 'Bob',   conservativeScore: 10 });

// ── Heading ───────────────────────────────────────────────────────────────────

test.describe('Leaderboard — heading', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'Player');
    await stubUnmatchedApi(page);
    await mockGetLeaderboard(page, []);
    await page.goto('/leaderboard');
  });

  test('shows the "Global Leaderboard" heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Global Leaderboard' })).toBeVisible();
  });
});

// ── Empty state (API online, no ranked players) ───────────────────────────────

test.describe('Leaderboard — empty state (API online)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'Player');
    await stubUnmatchedApi(page);
    await mockGetLeaderboard(page, []);
    await page.goto('/leaderboard');
  });

  test('shows the empty-state message', async ({ page }) => {
    await expect(page.getByText('No ranked players yet')).toBeVisible();
  });

  test('table is not rendered', async ({ page }) => {
    await expect(page.locator('table[mat-table]')).not.toBeVisible();
  });
});

// ── Online, populated ─────────────────────────────────────────────────────────

test.describe('Leaderboard — online, populated', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'Player');
    await stubUnmatchedApi(page);
    await mockGetLeaderboard(page, [ALICE_ENTRY, BOB_ENTRY]);
    await page.goto('/leaderboard');
  });

  test('renders player names as links', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Alice' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Bob' })).toBeVisible();
  });

  test('clicking a player name navigates to /players/:id', async ({ page }) => {
    await page.getByRole('link', { name: 'Alice' }).click();
    await expect(page).toHaveURL(/\/players\/1/);
  });
});

// ── Offline — ranked cache present (the bug fix) ──────────────────────────────

test.describe('Leaderboard — offline, ranked cache present', () => {
  const CACHED = [
    makePlayerDto({ id: 1, name: 'Cached Alice', email: 'alice@test.com',
                    isRanked: true,  conservativeScore: 20, mu: 30, sigma: 5, placementGamesLeft: 0 }),
    makePlayerDto({ id: 2, name: 'Cached Bob',   email: 'bob@test.com',
                    isRanked: true,  conservativeScore: 10, mu: 26, sigma: 6, placementGamesLeft: 0 }),
    makePlayerDto({ id: 3, name: 'Unranked Carol', email: 'carol@test.com',
                    isRanked: false, conservativeScore: 0,  placementGamesLeft: 3 }),
  ];

  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'Player');
    // Seed localStorage before Angular boots. Player role → storePrefix = 'to_store_0'
    await page.addInitScript((players) => {
      localStorage.setItem('to_store_0_players', JSON.stringify(players));
      localStorage.setItem('to_store_0_players_meta', JSON.stringify([]));
    }, CACHED);
    await stubUnmatchedApi(page);
    await page.route('**/api/leaderboard', route => route.fulfill({ status: 503 }));
    await page.goto('/leaderboard');
  });

  test('shows cached ranked players', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Cached Alice' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Cached Bob' })).toBeVisible();
  });

  test('does not show the empty-state message', async ({ page }) => {
    await expect(page.getByText('No ranked players yet')).not.toBeVisible();
  });

  test('excludes the unranked player', async ({ page }) => {
    await expect(page.getByText('Unranked Carol')).not.toBeVisible();
  });

  test('table is visible', async ({ page }) => {
    await expect(page.locator('table[mat-table]')).toBeVisible();
  });
});

// ── Offline — no ranked cache ─────────────────────────────────────────────────

test.describe('Leaderboard — offline, no ranked cache', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'Player');
    await page.addInitScript(() => {
      const unranked = [{
        id: 9, name: 'Unranked Dan', email: 'dan@test.com',
        mu: 25, sigma: 8.333, conservativeScore: 0,
        isRanked: false, placementGamesLeft: 5, isActive: true,
      }];
      localStorage.setItem('to_store_0_players', JSON.stringify(unranked));
      localStorage.setItem('to_store_0_players_meta', JSON.stringify([]));
    });
    await stubUnmatchedApi(page);
    await page.route('**/api/leaderboard', route => route.fulfill({ status: 503 }));
    await page.goto('/leaderboard');
  });

  test('shows the empty-state message when no ranked players are cached', async ({ page }) => {
    await expect(page.getByText('No ranked players yet')).toBeVisible();
  });
});
