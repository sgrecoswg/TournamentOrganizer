import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import {
  stubUnmatchedApi,
  mockGetCommanderMeta,
  makeCommanderMetaReportDto,
  makeCommanderMetaEntryDto,
} from '../helpers/api-mock';

// ─── Commander Meta Report (/stores/:id/meta) ─────────────────────────────────
//
// Route registration order matters: Playwright evaluates routes in LIFO order.
// Register stubUnmatchedApi FIRST so specific mocks take priority over it.

const STORE_ID = 1;

// ── Table rendering ───────────────────────────────────────────────────────────

test.describe('Commander Meta — table', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'StoreEmployee', { storeId: STORE_ID });
    await stubUnmatchedApi(page);
    await mockGetCommanderMeta(page, STORE_ID, '30d', makeCommanderMetaReportDto({
      topCommanders: [makeCommanderMetaEntryDto({ commanderName: 'Atraxa', timesPlayed: 8, wins: 4, winRate: 50, avgFinish: 2.1 })],
    }));
    await page.goto(`/stores/${STORE_ID}/meta`);
  });

  test('shows commander name row', async ({ page }) => {
    await expect(page.getByText('Atraxa')).toBeVisible();
  });

  test('shows formatted win rate (50.0%)', async ({ page }) => {
    await expect(page.getByText('50.0%')).toBeVisible();
  });

  test('shows avg finish', async ({ page }) => {
    await expect(page.getByText('2.1')).toBeVisible();
  });
});

// ── Empty state ───────────────────────────────────────────────────────────────

test.describe('Commander Meta — empty', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'StoreEmployee', { storeId: STORE_ID });
    await stubUnmatchedApi(page);
    await mockGetCommanderMeta(page, STORE_ID, '30d', makeCommanderMetaReportDto({ topCommanders: [] }));
    await page.goto(`/stores/${STORE_ID}/meta`);
  });

  test('shows empty state message when no commanders', async ({ page }) => {
    await expect(page.getByText('No commander data')).toBeVisible();
  });
});

// ── Multiple commanders ───────────────────────────────────────────────────────

test.describe('Commander Meta — multiple commanders', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'StoreEmployee', { storeId: STORE_ID });
    await stubUnmatchedApi(page);
    await mockGetCommanderMeta(page, STORE_ID, '30d', makeCommanderMetaReportDto({
      topCommanders: [
        makeCommanderMetaEntryDto({ commanderName: 'Atraxa',  timesPlayed: 8, wins: 4, winRate: 50,   avgFinish: 2.1 }),
        makeCommanderMetaEntryDto({ commanderName: 'Omnath',  timesPlayed: 6, wins: 2, winRate: 33.3, avgFinish: 2.5 }),
        makeCommanderMetaEntryDto({ commanderName: 'Zur',     timesPlayed: 4, wins: 3, winRate: 75,   avgFinish: 1.5 }),
        makeCommanderMetaEntryDto({ commanderName: 'Breya',   timesPlayed: 3, wins: 1, winRate: 33.3, avgFinish: 2.7 }),
        makeCommanderMetaEntryDto({ commanderName: 'Tergrid', timesPlayed: 2, wins: 1, winRate: 50,   avgFinish: 2.0 }),
      ],
    }));
    await page.goto(`/stores/${STORE_ID}/meta`);
  });

  test('shows all 5 commander rows', async ({ page }) => {
    await expect(page.getByText('Atraxa')).toBeVisible();
    await expect(page.getByText('Omnath')).toBeVisible();
    await expect(page.getByText('Zur')).toBeVisible();
    await expect(page.getByText('Breya')).toBeVisible();
    await expect(page.getByText('Tergrid')).toBeVisible();
  });
});

// ── Period toggle ─────────────────────────────────────────────────────────────

test.describe('Commander Meta — period toggle', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'StoreEmployee', { storeId: STORE_ID });
    await stubUnmatchedApi(page);
    await mockGetCommanderMeta(page, STORE_ID, '30d', makeCommanderMetaReportDto({
      topCommanders: [makeCommanderMetaEntryDto({ commanderName: 'Atraxa' })],
    }));
    await mockGetCommanderMeta(page, STORE_ID, '90d', makeCommanderMetaReportDto({
      topCommanders: [makeCommanderMetaEntryDto({ commanderName: 'Omnath' })],
    }));
    await mockGetCommanderMeta(page, STORE_ID, 'all', makeCommanderMetaReportDto({
      topCommanders: [makeCommanderMetaEntryDto({ commanderName: 'Tergrid' })],
    }));
    await page.goto(`/stores/${STORE_ID}/meta`);
  });

  test('default period shows 30d data', async ({ page }) => {
    await expect(page.getByText('Atraxa')).toBeVisible();
  });

  test('clicking Last 90 Days loads 90d data', async ({ page }) => {
    await page.getByRole('radio', { name: 'Last 90 Days' }).click();
    await expect(page.getByText('Omnath')).toBeVisible();
  });

  test('clicking All Time loads all-time data', async ({ page }) => {
    await page.getByRole('radio', { name: 'All Time' }).click();
    await expect(page.getByText('Tergrid')).toBeVisible();
  });
});
