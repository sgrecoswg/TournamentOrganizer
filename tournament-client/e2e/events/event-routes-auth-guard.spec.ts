import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import {
  stubUnmatchedApi,
  mockGetEvent,
  mockGetEventPlayers,
  mockGetEventPairings,
  mockGetStores,
  makeEventDto,
  makeEventPlayerDto,
  makePairingsDto,
} from '../helpers/api-mock';

// ─── Auth Guard — events/:id and events/:id/pairings ─────────────────────────
//
// Both routes must require authentication.  Unauthenticated users are
// redirected to /login with ?returnUrl pointing back to the original path.

const EVENT_ID = 1;

test.describe('Event Detail — auth guard', () => {
  test('redirects unauthenticated user to /login', async ({ page }) => {
    await stubUnmatchedApi(page);
    await page.goto(`/events/${EVENT_ID}`);
    await expect(page).toHaveURL(/\/login/);
  });

  test('includes returnUrl query param pointing to event detail', async ({ page }) => {
    await stubUnmatchedApi(page);
    await page.goto(`/events/${EVENT_ID}`);
    await expect(page).toHaveURL(new RegExp(`returnUrl=%2Fevents%2F${EVENT_ID}`));
  });

  test('allows authenticated user to access event detail', async ({ page }) => {
    await loginAs(page, 'StoreEmployee', { storeId: 1 });
    await stubUnmatchedApi(page);
    await mockGetStores(page, []);
    await mockGetEvent(page, makeEventDto({ id: EVENT_ID, status: 'Registration', playerCount: 0, storeId: 1 }));
    await mockGetEventPlayers(page, EVENT_ID, []);
    await page.goto(`/events/${EVENT_ID}`);
    await expect(page).not.toHaveURL(/\/login/);
  });
});

test.describe('Pairings Display — auth guard', () => {
  test('redirects unauthenticated user to /login', async ({ page }) => {
    await stubUnmatchedApi(page);
    await page.goto(`/events/${EVENT_ID}/pairings`);
    await expect(page).toHaveURL(/\/login/);
  });

  test('includes returnUrl query param pointing to pairings', async ({ page }) => {
    await stubUnmatchedApi(page);
    await page.goto(`/events/${EVENT_ID}/pairings`);
    await expect(page).toHaveURL(new RegExp(`returnUrl=%2Fevents%2F${EVENT_ID}%2Fpairings`));
  });

  test('allows authenticated user to access pairings', async ({ page }) => {
    await loginAs(page, 'StoreEmployee', { storeId: 1 });
    await stubUnmatchedApi(page);
    await mockGetEventPairings(page, EVENT_ID, makePairingsDto());
    await page.goto(`/events/${EVENT_ID}/pairings`);
    await expect(page).not.toHaveURL(/\/login/);
  });
});
