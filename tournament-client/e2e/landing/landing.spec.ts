import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import {
  stubUnmatchedApi,
  mockGetEvents,
  mockGetLeaderboard,
  makeEventDto,
  makeLeaderboardEntry,
} from '../helpers/api-mock';

test.describe('Landing — hero', () => {
  test.beforeEach(async ({ page }) => {
    await stubUnmatchedApi(page);
    await mockGetEvents(page, []);
    await mockGetLeaderboard(page, []);
    await loginAs(page, 'Player');
    await page.goto('/');
  });

  test('heading "Commander Tournament Organizer" is visible', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Commander Tournament Organizer', level: 1 })).toBeVisible();
  });

  test('"Browse Events" button is visible', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Browse Events' })).toBeVisible();
  });
});

test.describe('Landing — featured events (empty)', () => {
  test.beforeEach(async ({ page }) => {
    await stubUnmatchedApi(page);
    await mockGetEvents(page, []);
    await mockGetLeaderboard(page, []);
    await loginAs(page, 'Player');
    await page.goto('/');
  });

  test('shows "No upcoming events"', async ({ page }) => {
    await expect(page.locator('.empty-state')).toContainText('No upcoming events');
  });
});

test.describe('Landing — featured events (populated)', () => {
  const registrationEvent = makeEventDto({ id: 10, name: 'Friday Night Commander', status: 'Registration' });
  const inProgressEvent = makeEventDto({ id: 11, name: 'In Progress Event', status: 'InProgress' });

  test.beforeEach(async ({ page }) => {
    await stubUnmatchedApi(page);
    await mockGetEvents(page, [registrationEvent, inProgressEvent]);
    await mockGetLeaderboard(page, []);
    await loginAs(page, 'Player');
    await page.goto('/');
  });

  test('Registration event card renders', async ({ page }) => {
    await expect(page.locator('mat-card.event-card')).toHaveCount(1);
    await expect(page.locator('mat-card.event-card .event-name')).toContainText('Friday Night Commander');
  });

  test('InProgress event is NOT shown', async ({ page }) => {
    const cards = page.locator('mat-card.event-card');
    await expect(cards).toHaveCount(1);
    await expect(page.locator('mat-card.event-card')).not.toContainText('In Progress Event');
  });

  test('card click navigates to /events/:id', async ({ page }) => {
    await page.locator('mat-card.event-card').click();
    await expect(page).toHaveURL(/\/events\/10/);
  });
});

test.describe('Landing — leaderboard preview', () => {
  const entries = Array.from({ length: 7 }, (_, i) =>
    makeLeaderboardEntry({ rank: i + 1, playerId: i + 1, name: `Player ${i + 1}` })
  );

  test.beforeEach(async ({ page }) => {
    await stubUnmatchedApi(page);
    await mockGetEvents(page, []);
    await mockGetLeaderboard(page, entries);
    await loginAs(page, 'Player');
    await page.goto('/');
  });

  test('"Top Players" heading is visible', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Top Players', level: 2 })).toBeVisible();
  });

  test('shows exactly 5 leaderboard rows', async ({ page }) => {
    await expect(page.locator('tr.leaderboard-row')).toHaveCount(5);
  });

  test('"View Full Leaderboard" link is present', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'View Full Leaderboard' })).toBeVisible();
  });
});

test.describe('Landing — role UI', () => {
  test('"Host a Tournament" is visible for StoreEmployee', async ({ page }) => {
    await stubUnmatchedApi(page);
    await mockGetEvents(page, []);
    await mockGetLeaderboard(page, []);
    await loginAs(page, 'StoreEmployee');
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Host a Tournament' })).toBeVisible();
  });

  test('"Host a Tournament" is NOT visible for Player', async ({ page }) => {
    await stubUnmatchedApi(page);
    await mockGetEvents(page, []);
    await mockGetLeaderboard(page, []);
    await loginAs(page, 'Player');
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Host a Tournament' })).not.toBeVisible();
  });
});
