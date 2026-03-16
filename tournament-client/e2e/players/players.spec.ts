import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { mockGetPlayers, makePlayerDto, stubUnmatchedApi } from '../helpers/api-mock';

// ─── Player List (/players) ───────────────────────────────────────────────────
//
// Route registration order matters: Playwright evaluates routes in LIFO order.
// Register stubUnmatchedApi FIRST so specific mocks take priority over it.

const ALICE  = makePlayerDto({ id: 1, name: 'Alice',  email: 'alice@test.com',  isRanked: true,  conservativeScore: 20 });
const BOB    = makePlayerDto({ id: 2, name: 'Bob',    email: 'bob@shop.com',    isRanked: false, placementGamesLeft: 3 });
const CAROL  = makePlayerDto({ id: 3, name: 'Carol',  email: 'carol@test.com',  isRanked: false, placementGamesLeft: 5 });

// ── Heading ───────────────────────────────────────────────────────────────────

test.describe('Player List — heading', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'StoreEmployee', { storeId: 1 });
    await stubUnmatchedApi(page);
    await mockGetPlayers(page, []);
    await page.goto('/players');
  });

  test('shows the "Players" heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Players' })).toBeVisible();
  });
});

// ── Empty state ───────────────────────────────────────────────────────────────

test.describe('Player List — empty state', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'StoreEmployee', { storeId: 1 });
    await stubUnmatchedApi(page);
    await mockGetPlayers(page, []);
    await page.goto('/players');
  });

  test('table is not rendered when there are no players', async ({ page }) => {
    await expect(page.locator('table[mat-table]')).not.toBeVisible();
  });
});

// ── Populated ─────────────────────────────────────────────────────────────────

test.describe('Player List — populated', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'StoreEmployee', { storeId: 1 });
    await stubUnmatchedApi(page);
    await mockGetPlayers(page, [ALICE, BOB]);
    await page.goto('/players');
  });

  test('renders player names', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Alice' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Bob' })).toBeVisible();
  });

  test('renders player emails', async ({ page }) => {
    await expect(page.getByText('alice@test.com')).toBeVisible();
    await expect(page.getByText('bob@shop.com')).toBeVisible();
  });

  test('clicking a player name navigates to /players/:id', async ({ page }) => {
    await page.getByRole('link', { name: 'Alice' }).click();
    await expect(page).toHaveURL(/\/players\/1/);
  });
});

// ── Paginator ─────────────────────────────────────────────────────────────────

test.describe('Player List — paginator', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'StoreEmployee', { storeId: 1 });
    await stubUnmatchedApi(page);
    // 26 players to verify first page shows 25
    const players = Array.from({ length: 26 }, (_, i) =>
      makePlayerDto({ id: i + 1, name: `Player ${i + 1}`, email: `player${i + 1}@test.com` })
    );
    await mockGetPlayers(page, players);
    await page.goto('/players');
  });

  test('paginator is visible', async ({ page }) => {
    await expect(page.locator('mat-paginator')).toBeVisible();
  });

  test('default page size is 25 — shows 25 rows on first page', async ({ page }) => {
    await expect(page.locator('tr[mat-row]')).toHaveCount(25);
  });

  test('second page contains the 26th player', async ({ page }) => {
    await page.getByRole('button', { name: 'Next page' }).click();
    await expect(page.getByText('Player 26')).toBeVisible();
  });
});

// ── Name filter ───────────────────────────────────────────────────────────────

test.describe('Player List — name filter', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'StoreEmployee', { storeId: 1 });
    await stubUnmatchedApi(page);
    await mockGetPlayers(page, [ALICE, BOB]);
    await page.goto('/players');
  });

  test('typing in Name header hides non-matching rows', async ({ page }) => {
    const nameFilter = page.locator('th').filter({ hasText: 'Name' }).getByPlaceholder('Search…');
    await nameFilter.fill('alice');
    await expect(page.getByRole('link', { name: 'Alice' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Bob' })).not.toBeVisible();
  });

  test('clearing name filter shows all rows again', async ({ page }) => {
    const nameFilter = page.locator('th').filter({ hasText: 'Name' }).getByPlaceholder('Search…');
    await nameFilter.fill('alice');
    await nameFilter.clear();
    await expect(page.getByRole('link', { name: 'Bob' })).toBeVisible();
  });
});

// ── Email filter ──────────────────────────────────────────────────────────────

test.describe('Player List — email filter', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'StoreEmployee', { storeId: 1 });
    await stubUnmatchedApi(page);
    await mockGetPlayers(page, [ALICE, BOB]);
    await page.goto('/players');
  });

  test('typing in Email header hides non-matching rows', async ({ page }) => {
    const emailFilter = page.locator('th').filter({ hasText: 'Email' }).getByPlaceholder('Search…');
    await emailFilter.fill('shop');
    await expect(page.getByRole('link', { name: 'Bob' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Alice' })).not.toBeVisible();
  });
});

// ── Combined filter (AND logic) ───────────────────────────────────────────────

test.describe('Player List — combined filter (AND logic)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'StoreEmployee', { storeId: 1 });
    await stubUnmatchedApi(page);
    await mockGetPlayers(page, [ALICE, BOB]);
    await page.goto('/players');
  });

  test('both filters active — only row matching both remains', async ({ page }) => {
    const nameFilter  = page.locator('th').filter({ hasText: 'Name' }).getByPlaceholder('Search…');
    const emailFilter = page.locator('th').filter({ hasText: 'Email' }).getByPlaceholder('Search…');
    // alice matches name, bob matches email — neither matches both
    await nameFilter.fill('alice');
    await emailFilter.fill('shop');
    await expect(page.getByText('No players found.')).toBeVisible();
    await expect(page.locator('tr[mat-row]')).toHaveCount(0);
  });
});

// ── Role UI: Player ───────────────────────────────────────────────────────────

test.describe('Player List — role UI: Player', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'Player');
    await stubUnmatchedApi(page);
    await mockGetPlayers(page, [ALICE]);
    await page.goto('/players');
  });

  test('Register New Player card is NOT visible', async ({ page }) => {
    await expect(page.getByText('Register New Player')).not.toBeVisible();
  });

  test('edit button is NOT visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /edit/i })).not.toBeVisible();
  });
});

// ── Role UI: StoreEmployee ────────────────────────────────────────────────────

test.describe('Player List — role UI: StoreEmployee', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'StoreEmployee', { storeId: 1 });
    await stubUnmatchedApi(page);
    await mockGetPlayers(page, []);
    await page.goto('/players');
  });

  test('Register New Player card IS visible', async ({ page }) => {
    await expect(page.getByText('Register New Player')).toBeVisible();
  });

  test('Register button is disabled when name and email are empty', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Register' })).toBeDisabled();
  });

  test('Register button is disabled when only name is filled', async ({ page }) => {
    await page.getByLabel('Name').fill('Alice');
    await expect(page.getByRole('button', { name: 'Register' })).toBeDisabled();
  });

  test('Register button is enabled when both name and email are filled', async ({ page }) => {
    await page.getByLabel('Name').fill('Alice');
    await page.getByLabel('Email').fill('alice@test.com');
    await expect(page.getByRole('button', { name: 'Register' })).toBeEnabled();
  });
});

// ── Register (happy path) ─────────────────────────────────────────────────────

test('StoreEmployee can register a player and they appear in the list', async ({ page }) => {
  const newPlayer = makePlayerDto({ id: 99, name: 'New Player', email: 'new@test.com' });

  await loginAs(page, 'StoreEmployee', { storeId: 1 });
  await stubUnmatchedApi(page);

  let registered = false;
  await page.route('**/api/players', route => {
    if (route.request().method() === 'GET') {
      route.fulfill({ json: registered ? [newPlayer] : [] });
    } else if (route.request().method() === 'POST') {
      registered = true;
      route.fulfill({ status: 201, json: newPlayer });
    } else {
      route.continue();
    }
  });

  await page.goto('/players');

  await page.getByLabel('Name').fill('New Player');
  await page.getByLabel('Email').fill('new@test.com');
  await page.getByRole('button', { name: 'Register' }).click();

  await expect(page.getByText('New Player registered!')).toBeVisible();
  await expect(page.getByRole('link', { name: 'New Player' })).toBeVisible();
  await expect(page.getByLabel('Name')).toHaveValue('');
  await expect(page.getByLabel('Email')).toHaveValue('');
});

// ── Offline / localStorage cache ──────────────────────────────────────────────

test.describe('Player List — offline cache', () => {
  const CACHED_PLAYERS = [
    makePlayerDto({ id: 1, name: 'Cached Alpha', email: 'alpha@test.com' }),
    makePlayerDto({ id: 2, name: 'Cached Beta',  email: 'beta@test.com'  }),
  ];

  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'StoreEmployee', { storeId: 1 });
    // Pre-seed localStorage before Angular boots
    await page.addInitScript((players) => {
      localStorage.setItem('to_store_1_players', JSON.stringify(players));
      localStorage.setItem('to_store_1_players_meta', JSON.stringify([]));
    }, CACHED_PLAYERS);
    await stubUnmatchedApi(page);
    await page.route('**/api/players', route => route.fulfill({ status: 500 }));
    await page.goto('/players');
  });

  test('shows players from localStorage when the API is offline', async ({ page }) => {
    await expect(page.getByText('Cached Alpha')).toBeVisible();
    await expect(page.getByText('Cached Beta')).toBeVisible();
  });

  test('does not show empty state when cache is populated', async ({ page }) => {
    await expect(page.locator('table[mat-table]')).toBeVisible();
  });
});
