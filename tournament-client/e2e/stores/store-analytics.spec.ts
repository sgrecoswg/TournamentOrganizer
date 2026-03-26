import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import {
  stubUnmatchedApi,
  mockGetStore,
  mockGetThemes,
  mockGetEmployees,
  mockGetEventTemplates,
  mockGetStoreAnalytics,
  makeStoreDetailDto,
  makeStoreAnalyticsDto,
  makeThemeDto,
} from '../helpers/api-mock';

// ─── Store Analytics tab (/stores/:id) ───────────────────────────────────────
//
// Playwright routes are LIFO — register stubUnmatchedApi FIRST so specific
// mocks registered afterwards take priority.

const STORE_ID = 1;
const STORE = makeStoreDetailDto({ id: STORE_ID, storeName: 'Test Store' });
const THEMES = [makeThemeDto()];

const ANALYTICS_DATA = makeStoreAnalyticsDto({
  eventTrends: [
    { year: 2026, month: 1, eventCount: 3, avgPlayerCount: 6.5 },
  ],
  topCommanders: [
    { commanderName: "Atraxa, Praetors' Voice", wins: 5, gamesPlayed: 10, winPercent: 50 },
  ],
  topPlayers: [
    { playerId: 1, playerName: 'Alice', totalPoints: 40, eventsPlayed: 3 },
  ],
  finishDistribution: { first: 30, second: 25, third: 25, fourth: 20 },
  colorFrequency: [{ colorCode: 'W', count: 8 }],
});

async function goToAnalyticsTab(page: any) {
  await page.getByRole('tab', { name: 'Analytics' }).click();
}

/** Common beforeEach setup for StoreManager roles */
async function setupStoreManager(page: any, opts: { licenseTier: 'Tier1' | 'Tier2' | 'Tier3' }) {
  await stubUnmatchedApi(page);
  await mockGetThemes(page, THEMES);
  await mockGetEmployees(page, STORE_ID, []);
  await mockGetEventTemplates(page, STORE_ID, []);
  await mockGetStore(page, STORE);
}

// ── Tier3 StoreManager sees Analytics tab ─────────────────────────────────────

test.describe('Store Detail — Analytics tab: Tier3 visible', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'StoreManager', { storeId: STORE_ID, licenseTier: 'Tier3' });
    await setupStoreManager(page, { licenseTier: 'Tier3' });
    await mockGetStoreAnalytics(page, STORE_ID, ANALYTICS_DATA);
    await page.goto(`/stores/${STORE_ID}`);
  });

  test('Analytics tab visible in nav', async ({ page }) => {
    await expect(page.getByRole('tab', { name: 'Analytics' })).toBeVisible();
  });

  test('event trends section rendered', async ({ page }) => {
    await goToAnalyticsTab(page);
    await expect(page.getByRole('heading', { name: 'Event Trends' })).toBeVisible();
    await expect(page.getByRole('cell', { name: '3', exact: true }).first()).toBeVisible();  // event count
  });

  test('top commanders section rendered', async ({ page }) => {
    await goToAnalyticsTab(page);
    await expect(page.getByRole('heading', { name: 'Top Commanders' })).toBeVisible();
    await expect(page.getByText('Atraxa')).toBeVisible();
  });
});

// ── Tier2 StoreManager sees upgrade prompt ────────────────────────────────────

test.describe('Store Detail — Analytics tab: upgrade prompt for Tier2', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'StoreManager', { storeId: STORE_ID, licenseTier: 'Tier2' });
    await setupStoreManager(page, { licenseTier: 'Tier2' });
    await page.goto(`/stores/${STORE_ID}`);
  });

  test('Analytics tab visible but shows upgrade prompt text', async ({ page }) => {
    await expect(page.getByRole('tab', { name: 'Analytics' })).toBeVisible();
    await goToAnalyticsTab(page);
    await expect(page.locator('app-tier-upgrade-prompt')).toBeVisible();
  });
});

// ── Empty state ───────────────────────────────────────────────────────────────

test.describe('Store Detail — Analytics tab: empty state', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'StoreManager', { storeId: STORE_ID, licenseTier: 'Tier3' });
    await setupStoreManager(page, { licenseTier: 'Tier3' });
    await mockGetStoreAnalytics(page, STORE_ID, makeStoreAnalyticsDto());
    await page.goto(`/stores/${STORE_ID}`);
  });

  test('"Not enough data yet." text visible when arrays are empty', async ({ page }) => {
    await goToAnalyticsTab(page);
    const emptyMsgs = page.locator('.empty-state');
    await expect(emptyMsgs.first()).toBeVisible();
  });
});

// ── Admin always sees Analytics ───────────────────────────────────────────────

test.describe('Store Detail — Analytics tab: Admin always sees', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'Administrator', { storeId: STORE_ID });
    await stubUnmatchedApi(page);
    await mockGetThemes(page, THEMES);
    await mockGetEmployees(page, STORE_ID, []);
    await mockGetEventTemplates(page, STORE_ID, []);
    await mockGetStoreAnalytics(page, STORE_ID, ANALYTICS_DATA);
    await mockGetStore(page, STORE);
    await page.goto(`/stores/${STORE_ID}`);
  });

  test('Analytics tab visible for Administrator', async ({ page }) => {
    await expect(page.getByRole('tab', { name: 'Analytics' })).toBeVisible();
  });

  test('no upgrade prompt for Administrator', async ({ page }) => {
    await goToAnalyticsTab(page);
    await expect(page.locator('app-tier-upgrade-prompt')).not.toBeVisible();
  });
});

// ── Player role: no Analytics tab ────────────────────────────────────────────

test.describe('Store Detail — Analytics tab: Player absent', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'Player');
    await stubUnmatchedApi(page);
    await mockGetThemes(page, THEMES);
    await mockGetStore(page, STORE);
    await page.goto(`/stores/${STORE_ID}`);
  });

  test('Analytics tab NOT visible for Player', async ({ page }) => {
    await expect(page.getByRole('tab', { name: 'Analytics' })).not.toBeVisible();
  });
});
