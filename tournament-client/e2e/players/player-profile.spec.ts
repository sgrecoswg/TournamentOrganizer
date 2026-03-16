import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import {
  stubUnmatchedApi,
  mockGetPlayerProfile,
  mockGetCommanderStats,
  makePlayerProfile,
  makePlayerDto,
  makeCommanderStatDto,
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

// ── Commander Stats ───────────────────────────────────────────────────────────

const PLAYER_ID = 1;

test.describe('Player Profile — Commander Stats: display', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'Player');
    await stubUnmatchedApi(page);
    await mockGetCommanderStats(page, PLAYER_ID, {
      playerId: PLAYER_ID,
      commanders: [makeCommanderStatDto({ commanderName: 'Atraxa', gamesPlayed: 5, wins: 3, avgFinish: 1.8 })],
    });
    await mockGetPlayerProfile(page, makePlayerProfile({ id: PLAYER_ID }));
    await page.goto(`/players/${PLAYER_ID}`);
  });

  test('shows My Commanders heading', async ({ page }) => {
    await expect(page.getByText('My Commanders')).toBeVisible();
  });

  test('shows the commander name row', async ({ page }) => {
    await expect(page.getByText('Atraxa')).toBeVisible();
  });

  test('shows correct win % (60.0%)', async ({ page }) => {
    await expect(page.getByText('60.0%')).toBeVisible();
  });
});

test.describe('Player Profile — Commander Stats: multiple commanders', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'Player');
    await stubUnmatchedApi(page);
    await mockGetCommanderStats(page, PLAYER_ID, {
      playerId: PLAYER_ID,
      commanders: [
        makeCommanderStatDto({ commanderName: 'Atraxa', gamesPlayed: 5, wins: 3, avgFinish: 1.8 }),
        makeCommanderStatDto({ commanderName: 'Omnath', gamesPlayed: 3, wins: 1, avgFinish: 2.3 }),
        makeCommanderStatDto({ commanderName: 'Zur',    gamesPlayed: 2, wins: 2, avgFinish: 1.0 }),
      ],
    });
    await mockGetPlayerProfile(page, makePlayerProfile({ id: PLAYER_ID }));
    await page.goto(`/players/${PLAYER_ID}`);
  });

  test('shows all 3 commander rows', async ({ page }) => {
    await expect(page.getByText('Atraxa')).toBeVisible();
    await expect(page.getByText('Omnath')).toBeVisible();
    await expect(page.getByText('Zur')).toBeVisible();
  });
});

test.describe('Player Profile — Commander Stats: empty', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'Player');
    await stubUnmatchedApi(page);
    await mockGetCommanderStats(page, PLAYER_ID, { playerId: PLAYER_ID, commanders: [] });
    await mockGetPlayerProfile(page, makePlayerProfile({ id: PLAYER_ID }));
    await page.goto(`/players/${PLAYER_ID}`);
  });

  test('My Commanders section is NOT visible when no commanders', async ({ page }) => {
    await expect(page.getByText('My Commanders')).not.toBeVisible();
  });
});

test.describe('Player Profile — Commander Stats: zero games guard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'Player');
    await stubUnmatchedApi(page);
    await mockGetCommanderStats(page, PLAYER_ID, {
      playerId: PLAYER_ID,
      commanders: [makeCommanderStatDto({ commanderName: 'Atraxa', gamesPlayed: 0, wins: 0, avgFinish: 0 })],
    });
    await mockGetPlayerProfile(page, makePlayerProfile({ id: PLAYER_ID }));
    await page.goto(`/players/${PLAYER_ID}`);
  });

  test('shows 0.0% not NaN when gamesPlayed is 0', async ({ page }) => {
    await expect(page.getByText('0.0%')).toBeVisible();
    await expect(page.getByText('NaN')).not.toBeVisible();
  });
});
