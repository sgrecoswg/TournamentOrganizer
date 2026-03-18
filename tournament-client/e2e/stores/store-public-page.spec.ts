import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import {
  stubUnmatchedApi,
  mockGetStorePublicPage,
  mockGetStorePublicPageNotFound,
  mockGetStore,
  makeStorePublicDto,
  makeStoreDetailDto,
  makeStoreEventSummaryDto,
  makeStorePublicTopPlayerDto,
} from '../helpers/api-mock';


// Route registration order matters: Playwright evaluates routes in LIFO order
// (last registered = first evaluated). Always register stubUnmatchedApi FIRST
// so specific mocks registered afterwards take priority over it.

const SLUG = 'top-deck-games';

// ── Store Public Page — display (unauthenticated) ─────────────────────────────

test.describe('Store Public Page — display', () => {
  test.beforeEach(async ({ page }) => {
    await stubUnmatchedApi(page);
    await mockGetStorePublicPage(page, SLUG, makeStorePublicDto({
      storeName: 'Top Deck Games',
      location:  '42 Card St, Portland OR',
      upcomingEvents: [
        makeStoreEventSummaryDto({ eventId: 1, eventName: 'FNM Draft', status: 'Registration' }),
        makeStoreEventSummaryDto({ eventId: 2, eventName: 'Commander Night', status: 'Registration' }),
      ],
      recentEvents: [
        makeStoreEventSummaryDto({ eventId: 10, eventName: 'Last Week Draft', status: 'Completed' }),
      ],
      topPlayers: [
        makeStorePublicTopPlayerDto({ playerId: 1, name: 'Alice', conservativeScore: 22.1 }),
        makeStorePublicTopPlayerDto({ playerId: 2, name: 'Bob',   conservativeScore: 18.4 }),
      ],
    }));
    // No loginAs — test that page is accessible without auth
    await page.goto(`/stores/public/${SLUG}`);
  });

  test('page is accessible without authentication — no redirect to login', async ({ page }) => {
    // Should NOT redirect to the login/oauth page
    await expect(page).not.toHaveURL(/auth|login|callback/);
    await expect(page.getByText('Top Deck Games')).toBeVisible();
  });

  test('renders store name as heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Top Deck Games' })).toBeVisible();
  });

  test('renders store location', async ({ page }) => {
    await expect(page.getByText('42 Card St, Portland OR')).toBeVisible();
  });

  test('renders upcoming events', async ({ page }) => {
    await expect(page.getByText('FNM Draft')).toBeVisible();
    await expect(page.getByText('Commander Night')).toBeVisible();
  });

  test('renders recent events', async ({ page }) => {
    await expect(page.getByText('Last Week Draft')).toBeVisible();
  });

  test('renders top players in leaderboard', async ({ page }) => {
    await expect(page.getByText('Alice')).toBeVisible();
    await expect(page.getByText('Bob')).toBeVisible();
  });
});

// ── Store Public Page — logo ───────────────────────────────────────────────────

test.describe('Store Public Page — logo', () => {
  test('shows logo img when logoUrl is set', async ({ page }) => {
    await stubUnmatchedApi(page);
    await mockGetStorePublicPage(page, SLUG, makeStorePublicDto({ logoUrl: '/logos/1.png' }));
    await page.goto(`/stores/public/${SLUG}`);
    await expect(page.locator('img.store-logo')).toBeVisible();
  });

  test('does not show logo img when logoUrl is null', async ({ page }) => {
    await stubUnmatchedApi(page);
    await mockGetStorePublicPage(page, SLUG, makeStorePublicDto({ logoUrl: null }));
    await page.goto(`/stores/public/${SLUG}`);
    await expect(page.locator('img.store-logo')).not.toBeVisible();
  });
});

// ── Store Public Page — empty states ──────────────────────────────────────────

test.describe('Store Public Page — empty states', () => {
  test.beforeEach(async ({ page }) => {
    await stubUnmatchedApi(page);
    await mockGetStorePublicPage(page, SLUG, makeStorePublicDto({
      upcomingEvents: [],
      recentEvents:   [],
      topPlayers:     [],
    }));
    await page.goto(`/stores/public/${SLUG}`);
  });

  test('shows "No upcoming events" when list is empty', async ({ page }) => {
    await expect(page.getByText('No upcoming events')).toBeVisible();
  });

  test('shows "No ranked players yet" when leaderboard is empty', async ({ page }) => {
    await expect(page.getByText('No ranked players yet')).toBeVisible();
  });
});

// ── Store Public Page — 404 ───────────────────────────────────────────────────

test.describe('Store Public Page — 404', () => {
  test('shows not-found message when API returns 404', async ({ page }) => {
    await stubUnmatchedApi(page);
    await mockGetStorePublicPageNotFound(page, SLUG);
    await page.goto(`/stores/public/${SLUG}`);
    await expect(page.getByText('Store not found')).toBeVisible();
  });
});

// ── Store Public Page — background image ──────────────────────────────────────

test.describe('Store Public Page — background image', () => {
  test('store-header has background-image style when backgroundImageUrl is set', async ({ page }) => {
    await stubUnmatchedApi(page);
    await mockGetStorePublicPage(page, SLUG, makeStorePublicDto({ backgroundImageUrl: '/backgrounds/1.png' }));
    await page.goto(`/stores/public/${SLUG}`);
    const header = page.locator('.store-header');
    await expect(header).toBeVisible();
    const bgImage = await header.evaluate((el: HTMLElement) => el.style.backgroundImage);
    expect(bgImage).toContain('/backgrounds/1.png');
  });

  test('store-header has no background-image style when backgroundImageUrl is null', async ({ page }) => {
    await stubUnmatchedApi(page);
    await mockGetStorePublicPage(page, SLUG, makeStorePublicDto({ backgroundImageUrl: null }));
    await page.goto(`/stores/public/${SLUG}`);
    const header = page.locator('.store-header');
    await expect(header).toBeVisible();
    const bgImage = await header.evaluate((el: HTMLElement) => el.style.backgroundImage);
    expect(bgImage).toBeFalsy();
  });
});

// ── Store Detail — Public Page link ──────────────────────────────────────────

test.describe('Store Detail — Public Page link', () => {
  const storeWithSlug = makeStoreDetailDto({ id: 1, storeName: 'Top Deck Games', slug: 'top-deck-games' });
  const storeNoSlug   = makeStoreDetailDto({ id: 2, storeName: 'New Store',      slug: null });

  test('Public Page link is visible for StoreManager when store has a slug', async ({ page }) => {
    await loginAs(page, 'StoreManager');
    await stubUnmatchedApi(page);
    await mockGetStore(page, storeWithSlug);
    await page.goto('/stores/1');
    await expect(page.getByTestId('public-page-link')).toBeVisible();
  });

  test('Public Page link is hidden when store has no slug', async ({ page }) => {
    await loginAs(page, 'StoreManager');
    await stubUnmatchedApi(page);
    await mockGetStore(page, storeNoSlug);
    await page.goto('/stores/2');
    await expect(page.getByTestId('public-page-link')).not.toBeVisible();
  });

  test('Public Page link is hidden for Player role', async ({ page }) => {
    await loginAs(page, 'Player');
    await stubUnmatchedApi(page);
    await mockGetStore(page, storeWithSlug);
    await page.goto('/stores/1');
    await expect(page.getByTestId('public-page-link')).not.toBeVisible();
  });
});
