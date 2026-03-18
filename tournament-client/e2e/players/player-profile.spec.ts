import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import {
  stubUnmatchedApi,
  mockGetPlayerProfile,
  mockGetCommanderStats,
  mockGetRatingHistory,
  mockUploadPlayerAvatar,
  mockRemovePlayerAvatar,
  mockScryfallAutocomplete,
  mockPlayerProfileSubApis,
  makePlayerProfile,
  makePlayerBadgeDto,
  makePlayerDto,
  makeCommanderStatDto,
  makeRatingSnapshotDto,
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
    await loginAs(page, 'StoreEmployee', { storeId: 1, licenseTier: 'Tier2' });
    await stubUnmatchedApi(page);
    await mockGetPlayerProfile(page, ALICE_PROFILE);
    await page.goto('/players/1');
  });

  test('shows the player name', async ({ page }) => {
    await expect(page.getByText('Alice')).toBeVisible();
  });

  test('History tab IS visible', async ({ page }) => {
    await expect(page.getByRole('tab', { name: 'History', exact: true })).toBeVisible();
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
    await expect(page.getByRole('tab', { name: 'History', exact: true })).not.toBeVisible();
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

// ── Avatar ─────────────────────────────────────────────────────────────────────

test.describe('Player Profile — avatar: display', () => {
  test.beforeEach(async ({ page }) => {
    await stubUnmatchedApi(page);
    await mockGetPlayerProfile(page, makePlayerProfile({ id: 1, avatarUrl: '/avatars/1.png' }));
    await loginAs(page, 'Player');
    await page.goto('/players/1');
  });

  test('img.player-avatar is visible with correct src', async ({ page }) => {
    const img = page.locator('img.player-avatar');
    await expect(img).toBeVisible();
    await expect(img).toHaveAttribute('src', /\/avatars\/1\.png/);
  });

  test('placeholder is absent when avatarUrl is set', async ({ page }) => {
    await expect(page.locator('div.player-avatar-placeholder')).not.toBeVisible();
  });
});

test.describe('Player Profile — avatar: placeholder', () => {
  test.beforeEach(async ({ page }) => {
    await stubUnmatchedApi(page);
    await mockGetPlayerProfile(page, makePlayerProfile({ id: 1, avatarUrl: null }));
    await loginAs(page, 'Player');
    await page.goto('/players/1');
  });

  test('div.player-avatar-placeholder is visible', async ({ page }) => {
    await expect(page.locator('div.player-avatar-placeholder')).toBeVisible();
  });

  test('img.player-avatar is absent', async ({ page }) => {
    await expect(page.locator('img.player-avatar')).not.toBeVisible();
  });
});

test.describe('Player Profile — avatar: upload (own player)', () => {
  test.beforeEach(async ({ page }) => {
    await stubUnmatchedApi(page);
    await mockGetPlayerProfile(page, makePlayerProfile({ id: 1, email: 'alice@test.com', avatarUrl: null }));
    await mockUploadPlayerAvatar(page, 1, makePlayerDto({ id: 1, avatarUrl: '/avatars/1.png' }));
    await loginAs(page, 'Player', { id: 1, playerId: 1 });
    // Inject matching email so canManageAvatar returns true
    await page.addInitScript(() => {
      const token = localStorage.getItem('auth_token');
      if (token) {
        const parts = token.split('.');
        const payload = JSON.parse(atob(parts[1]));
        payload.email = 'alice@test.com';
        parts[1] = btoa(JSON.stringify(payload));
        localStorage.setItem('auth_token', parts.join('.'));
      }
    });
    await page.goto('/players/1');
  });

  test('upload button is visible for own player', async ({ page }) => {
    await expect(page.locator('button[ng-reflect-message="Upload avatar"], button[mattooltip="Upload avatar"]').first()).toBeVisible();
  });

  test('hidden file input is present', async ({ page }) => {
    await expect(page.locator('input[type="file"][accept=".png,.jpg,.jpeg,.gif,.webp"]')).toBeAttached();
  });
});

test.describe('Player Profile — avatar: upload (StoreManager)', () => {
  test.beforeEach(async ({ page }) => {
    await stubUnmatchedApi(page);
    await mockGetPlayerProfile(page, makePlayerProfile({ id: 1, avatarUrl: null }));
    await mockUploadPlayerAvatar(page, 1, makePlayerDto({ id: 1, avatarUrl: '/avatars/1.png' }));
    await loginAs(page, 'StoreManager', { storeId: 1 });
    await page.goto('/players/1');
  });

  test('upload button visible for StoreManager', async ({ page }) => {
    await expect(page.locator('.avatar-actions')).toBeVisible();
  });
});

test.describe('Player Profile — avatar: upload (Admin)', () => {
  test.beforeEach(async ({ page }) => {
    await stubUnmatchedApi(page);
    await mockGetPlayerProfile(page, makePlayerProfile({ id: 1, avatarUrl: null }));
    await loginAs(page, 'Administrator');
    await page.goto('/players/1');
  });

  test('upload button visible for Administrator', async ({ page }) => {
    await expect(page.locator('.avatar-actions')).toBeVisible();
  });
});

test.describe('Player Profile — avatar: role gate', () => {
  test.beforeEach(async ({ page }) => {
    await stubUnmatchedApi(page);
    await mockGetPlayerProfile(page, makePlayerProfile({ id: 1, email: 'alice@test.com', avatarUrl: '/avatars/1.png' }));
    await loginAs(page, 'Player', { id: 2, playerId: 2 });
    await page.goto('/players/1');
  });

  test('upload button NOT visible for different player', async ({ page }) => {
    await expect(page.locator('.avatar-actions')).not.toBeVisible();
  });

  test('remove button NOT visible for different player', async ({ page }) => {
    await expect(page.locator('.avatar-actions')).not.toBeVisible();
  });
});

test.describe('Player Profile — avatar: remove', () => {
  test.beforeEach(async ({ page }) => {
    await stubUnmatchedApi(page);
    await mockGetPlayerProfile(page, makePlayerProfile({ id: 1, avatarUrl: '/avatars/1.png' }));
    await mockRemovePlayerAvatar(page, 1, makePlayerDto({ id: 1, avatarUrl: null }));
    await loginAs(page, 'StoreManager', { storeId: 1 });
    await page.goto('/players/1');
  });

  test('remove button is visible when avatarUrl is set', async ({ page }) => {
    const btn = page.locator('button[ng-reflect-message="Remove avatar"], button[mattooltip="Remove avatar"]').first();
    await expect(btn).toBeVisible();
  });

  test('clicking remove fires DELETE and shows placeholder', async ({ page }) => {
    let deleteCalled = false;
    await page.route('**/api/players/1/avatar', route => {
      if (route.request().method() === 'DELETE') {
        deleteCalled = true;
        route.fulfill({ json: makePlayerDto({ id: 1, avatarUrl: null }) });
      } else {
        route.continue();
      }
    });
    const btn = page.locator('button[ng-reflect-message="Remove avatar"], button[mattooltip="Remove avatar"]').first();
    await btn.click();
    expect(deleteCalled).toBe(true);
    await expect(page.locator('div.player-avatar-placeholder')).toBeVisible();
  });
});

// ── Card name autocomplete ─────────────────────────────────────────────────────

test.describe('Player Profile — wishlist card autocomplete', () => {
  test.beforeEach(async ({ page }) => {
    await stubUnmatchedApi(page);
    await mockPlayerProfileSubApis(page, 1);
    await mockScryfallAutocomplete(page, ['Sol Ring', 'Sol Talisman', 'Solemn Simulacrum']);
    await mockGetPlayerProfile(page, makePlayerProfile({ id: 1 }));
    await loginAs(page, 'Administrator');
    await page.goto('/players/1');
    await page.getByRole('tab', { name: 'Trading' }).click();
    // The inner mat-tab-group is portal-rendered; wait for it to attach after the outer tab activates
    await page.locator('mat-tab-group mat-tab-group').waitFor({ state: 'attached', timeout: 5000 });
    await expect(page.locator('input[placeholder="e.g. Lightning Bolt"]')).toBeVisible({ timeout: 5000 });
  });

  test('shows suggestions after typing in wishlist card input', async ({ page }) => {
    const input = page.locator('input[placeholder="e.g. Lightning Bolt"]');
    await input.click();
    await input.pressSequentially('sol', { delay: 50 });
    // Wait for debounce + network response
    await expect(page.locator('mat-option').filter({ hasText: 'Sol Ring' })).toBeVisible({ timeout: 2000 });
    await expect(page.locator('mat-option').filter({ hasText: 'Sol Talisman' })).toBeVisible();
  });

  test('selecting a suggestion fills the wishlist input', async ({ page }) => {
    const input = page.locator('input[placeholder="e.g. Lightning Bolt"]');
    await input.click();
    await input.pressSequentially('sol', { delay: 50 });
    await page.locator('mat-option').filter({ hasText: 'Sol Ring' }).click();
    await expect(input).toHaveValue('Sol Ring');
  });

  test('no suggestions shown for very short query', async ({ page }) => {
    await mockScryfallAutocomplete(page, []);
    const input = page.locator('input[placeholder="e.g. Lightning Bolt"]');
    await input.click();
    await input.pressSequentially('s', { delay: 50 });
    await page.waitForTimeout(400);
    await expect(page.locator('mat-option')).toHaveCount(0);
  });
});

test.describe('Player Profile — trade card autocomplete', () => {
  test.beforeEach(async ({ page }) => {
    await stubUnmatchedApi(page);
    await mockPlayerProfileSubApis(page, 1);
    await mockScryfallAutocomplete(page, ['Atraxa, Praetors\' Voice', 'Atarka, World Render']);
    await mockGetPlayerProfile(page, makePlayerProfile({ id: 1 }));
    await loginAs(page, 'Administrator');
    await page.goto('/players/1');
    // Wait for profile, then navigate Trading → Wishlist (to activate the sub-tab-group) → For Trade
    await page.getByRole('tab', { name: 'Trading' }).click();
    await page.locator('mat-tab-group mat-tab-group').waitFor({ state: 'attached', timeout: 5000 });
    await page.getByRole('tab', { name: /For Trade/ }).click();
    await expect(page.locator('input[placeholder="e.g. Sol Ring"]')).toBeVisible({ timeout: 5000 });
  });

  test('shows suggestions after typing in trade card input', async ({ page }) => {
    const input = page.locator('input[placeholder="e.g. Sol Ring"]');
    await input.click();
    await input.pressSequentially('atr', { delay: 50 });
    await expect(page.locator('mat-option').filter({ hasText: 'Atraxa' })).toBeVisible({ timeout: 2000 });
  });

  test('selecting a trade suggestion fills the input', async ({ page }) => {
    const input = page.locator('input[placeholder="e.g. Sol Ring"]');
    await input.click();
    await input.pressSequentially('atr', { delay: 50 });
    await page.locator('mat-option').filter({ hasText: 'Atraxa' }).click();
    await expect(input).toHaveValue('Atraxa, Praetors\' Voice');
  });
});

test.describe('Player Profile — card autocomplete: Scryfall unavailable', () => {
  test.beforeEach(async ({ page }) => {
    await stubUnmatchedApi(page);
    await mockPlayerProfileSubApis(page, 1);
    // Scryfall returns a network error
    await page.route('https://api.scryfall.com/**', route => route.abort());
    await mockGetPlayerProfile(page, makePlayerProfile({ id: 1 }));
    await loginAs(page, 'Administrator');
    await page.goto('/players/1');
    await page.getByRole('tab', { name: 'Trading' }).click();
    await page.locator('mat-tab-group mat-tab-group').waitFor({ state: 'attached', timeout: 5000 });
    await expect(page.locator('input[placeholder="e.g. Lightning Bolt"]')).toBeVisible({ timeout: 5000 });
  });

  test('manual card entry still works when Scryfall is unavailable', async ({ page }) => {
    const input = page.locator('input[placeholder="e.g. Lightning Bolt"]');
    await input.click();
    await input.fill('Black Lotus');
    await expect(input).toHaveValue('Black Lotus');
    // No crash — no mat-option shown but the input value is intact
    await expect(page.locator('mat-option')).toHaveCount(0);
  });
});

// ── Rating History ─────────────────────────────────────────────────────────────

test.describe('Player Profile — Rating History: chart shown', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'Player');
    await stubUnmatchedApi(page);
    await mockPlayerProfileSubApis(page, PLAYER_ID);
    await mockGetRatingHistory(page, PLAYER_ID, {
      playerId: PLAYER_ID,
      history: [
        makeRatingSnapshotDto({ date: '2024-01-01T00:00:00', conservativeScore: 3.0 }),
        makeRatingSnapshotDto({ date: '2024-02-01T00:00:00', conservativeScore: 5.5 }),
        makeRatingSnapshotDto({ date: '2024-03-01T00:00:00', conservativeScore: 7.2 }),
      ],
    });
    await mockGetPlayerProfile(page, makePlayerProfile({ id: PLAYER_ID }));
    await page.goto(`/players/${PLAYER_ID}`);
    await page.getByRole('tab', { name: 'Rating History' }).click();
  });

  test('rating-history-section is visible', async ({ page }) => {
    await expect(page.locator('.rating-history-section')).toBeVisible();
  });

  test('canvas element is present inside the section', async ({ page }) => {
    await expect(page.locator('.rating-history-section canvas')).toBeVisible();
  });
});

test.describe('Player Profile — Rating History: hidden with < 2 points', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'Player');
    await stubUnmatchedApi(page);
    await mockPlayerProfileSubApis(page, PLAYER_ID);
    await mockGetRatingHistory(page, PLAYER_ID, {
      playerId: PLAYER_ID,
      history: [makeRatingSnapshotDto()],
    });
    await mockGetPlayerProfile(page, makePlayerProfile({ id: PLAYER_ID }));
    await page.goto(`/players/${PLAYER_ID}`);
    await page.getByRole('tab', { name: 'Rating History' }).click();
  });

  test('canvas is NOT present with 1 snapshot', async ({ page }) => {
    await expect(page.locator('.rating-history-section canvas')).not.toBeVisible();
  });
});

test.describe('Player Profile — Rating History: hidden when empty', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'Player');
    await stubUnmatchedApi(page);
    await mockPlayerProfileSubApis(page, PLAYER_ID);
    await mockGetRatingHistory(page, PLAYER_ID, { playerId: PLAYER_ID, history: [] });
    await mockGetPlayerProfile(page, makePlayerProfile({ id: PLAYER_ID }));
    await page.goto(`/players/${PLAYER_ID}`);
    await page.getByRole('tab', { name: 'Rating History' }).click();
  });

  test('canvas is NOT present with empty history', async ({ page }) => {
    await expect(page.locator('.rating-history-section canvas')).not.toBeVisible();
  });
});

// ── Badges ─────────────────────────────────────────────────────────────────────

test.describe('Player Profile — Badges: display', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'Player');
    await stubUnmatchedApi(page);
    await mockGetPlayerProfile(page, makePlayerProfile({
      id: PLAYER_ID,
      badges: [makePlayerBadgeDto({ badgeKey: 'first_win', displayName: 'First Win', awardedAt: '2026-01-01T00:00:00Z' })],
    }));
    await page.goto(`/players/${PLAYER_ID}`);
  });

  test('"Achievements" heading is visible when badges present', async ({ page }) => {
    await expect(page.getByText('Achievements')).toBeVisible();
  });

  test('"First Win" badge chip is shown', async ({ page }) => {
    await expect(page.locator('.badge-chip').filter({ hasText: 'First Win' })).toBeVisible();
  });
});

test.describe('Player Profile — Badges: multiple badges', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'Player');
    await stubUnmatchedApi(page);
    await mockGetPlayerProfile(page, makePlayerProfile({
      id: PLAYER_ID,
      badges: [
        makePlayerBadgeDto({ badgeKey: 'first_win',    displayName: 'First Win' }),
        makePlayerBadgeDto({ badgeKey: 'veteran',      displayName: 'Veteran' }),
        makePlayerBadgeDto({ badgeKey: 'undefeated_swiss', displayName: 'Flawless' }),
      ],
    }));
    await page.goto(`/players/${PLAYER_ID}`);
  });

  test('all 3 badge chips are rendered', async ({ page }) => {
    await expect(page.locator('.badge-chip').filter({ hasText: 'First Win' })).toBeVisible();
    await expect(page.locator('.badge-chip').filter({ hasText: 'Veteran' })).toBeVisible();
    await expect(page.locator('.badge-chip').filter({ hasText: 'Flawless' })).toBeVisible();
  });
});

test.describe('Player Profile — Badges: no badges', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'Player');
    await stubUnmatchedApi(page);
    await mockGetPlayerProfile(page, makePlayerProfile({ id: PLAYER_ID, badges: [] }));
    await page.goto(`/players/${PLAYER_ID}`);
  });

  test('"Achievements" section is NOT visible when badges is empty', async ({ page }) => {
    await expect(page.getByText('Achievements')).not.toBeVisible();
  });
});

test.describe('Player Profile — Badges: tooltip', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'Player');
    await stubUnmatchedApi(page);
    await mockGetPlayerProfile(page, makePlayerProfile({
      id: PLAYER_ID,
      badges: [makePlayerBadgeDto({ badgeKey: 'veteran', displayName: 'Veteran', awardedAt: '2026-01-15T00:00:00Z' })],
    }));
    await page.goto(`/players/${PLAYER_ID}`);
  });

  test('tooltip on badge chip shows badge name', async ({ page }) => {
    const chip = page.locator('.badge-chip').first();
    await chip.hover();
    // The matTooltip renders as a tooltip panel; check it contains 'Veteran'
    await expect(page.locator('mat-tooltip-component, .mdc-tooltip')).toContainText('Veteran', { timeout: 3000 });
  });
});
