import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import {
  stubUnmatchedApi,
  mockGetPlayerProfile,
  mockPlayerProfileSubApis,
  makePlayerProfile,
} from '../helpers/api-mock';

// ─── Player Profile — Tier Gate (wishlist / trade visibility) ─────────────────
//
// Verifies that the Trading tab is shown only when the current user's
// licenseTier is Tier2, and hidden for Free/Tier1.

const PLAYER_ID = 1;

const PROFILE = makePlayerProfile({
  id:     PLAYER_ID,
  name:   'Alice',
  email:  'alice@test.com',
  isRanked: true,
  placementGamesLeft: 0,
});

// ── Tier2 — Trading tab visible ───────────────────────────────────────────────

test.describe('Player Profile Tier Gate — Tier2 user sees Trading tab', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'StoreEmployee', { storeId: 1, licenseTier: 'Tier2' });
    await stubUnmatchedApi(page);
    await mockPlayerProfileSubApis(page, PLAYER_ID);
    await mockGetPlayerProfile(page, PROFILE);
    await page.goto(`/players/${PLAYER_ID}`);
  });

  test('Trading tab is visible for Tier2 user', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /trading/i })).toBeVisible();
  });
});

// ── Free tier — Trading tab hidden ────────────────────────────────────────────

test.describe('Player Profile Tier Gate — Free tier user does NOT see Trading tab', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'StoreEmployee', { storeId: 1, licenseTier: 'Free' });
    await stubUnmatchedApi(page);
    await mockPlayerProfileSubApis(page, PLAYER_ID);
    await mockGetPlayerProfile(page, PROFILE);
    await page.goto(`/players/${PLAYER_ID}`);
  });

  test('Trading tab is NOT visible for Free tier user', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /trading/i })).not.toBeVisible();
  });
});

// ── Tier1 — Trading tab hidden ────────────────────────────────────────────────

test.describe('Player Profile Tier Gate — Tier1 user does NOT see Trading tab', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'StoreEmployee', { storeId: 1, licenseTier: 'Tier1' });
    await stubUnmatchedApi(page);
    await mockPlayerProfileSubApis(page, PLAYER_ID);
    await mockGetPlayerProfile(page, PROFILE);
    await page.goto(`/players/${PLAYER_ID}`);
  });

  test('Trading tab is NOT visible for Tier1 user', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /trading/i })).not.toBeVisible();
  });
});
