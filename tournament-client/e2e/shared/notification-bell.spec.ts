import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import {
  stubUnmatchedApi,
  makeNotificationDto,
  mockGetNotificationCount,
  mockGetNotifications,
  mockMarkNotificationRead,
  mockMarkAllNotificationsRead,
  mockPlayerProfileSubApis,
} from '../helpers/api-mock';

// ─── Notification Bell ────────────────────────────────────────────────────────
//
// Tests notification bell visibility and interactions.
// Route order: stubUnmatchedApi FIRST (catch-all), feature mocks AFTER (LIFO).

// ── Visibility for Tier2 ──────────────────────────────────────────────────────

test.describe('Notification Bell — visibility', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'Player', { playerId: 1, licenseTier: 'Tier2' });
    await stubUnmatchedApi(page);
    await mockGetNotificationCount(page, { unread: 3 });
    await mockGetNotifications(page, []);
    await page.goto('/');
  });

  test('bell icon visible in nav for Tier2 player', async ({ page }) => {
    await expect(page.locator('app-notification-bell button[mat-icon-button]')).toBeVisible();
  });

  test('badge shows unread count "3"', async ({ page }) => {
    await expect(page.locator('app-notification-bell .mat-badge-content')).toHaveText('3');
  });
});

// ── Hidden for Free tier ──────────────────────────────────────────────────────

test.describe('Notification Bell — hidden for Free', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'Player', { playerId: 1, licenseTier: 'Free' });
    await stubUnmatchedApi(page);
    await page.goto('/');
  });

  test('bell NOT visible for Free tier player', async ({ page }) => {
    await expect(page.locator('app-notification-bell button[mat-icon-button]')).not.toBeVisible();
  });
});

// ── Open panel ────────────────────────────────────────────────────────────────

test.describe('Notification Bell — open panel', () => {
  const notif1 = makeNotificationDto({ id: 1, message: 'Trade match with Alice!' });
  const notif2 = makeNotificationDto({ id: 2, message: 'Trade match with Bob!' });

  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'Player', { playerId: 1, licenseTier: 'Tier2' });
    await stubUnmatchedApi(page);
    await mockGetNotificationCount(page, { unread: 2 });
    await mockGetNotifications(page, [notif1, notif2]);
    await mockMarkNotificationRead(page, 1);
    await mockMarkNotificationRead(page, 2);
    await page.goto('/');
  });

  test('clicking bell opens panel with both notifications listed', async ({ page }) => {
    await page.locator('app-notification-bell button[mat-icon-button]').click();
    await expect(page.getByText('Trade match with Alice!')).toBeVisible();
    await expect(page.getByText('Trade match with Bob!')).toBeVisible();
  });
});

// ── Mark read ─────────────────────────────────────────────────────────────────

test.describe('Notification Bell — mark read', () => {
  const notif = makeNotificationDto({ id: 5, message: 'Trade match found!', isRead: false });

  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'Player', { playerId: 1, licenseTier: 'Tier2' });
    await stubUnmatchedApi(page);
    await mockGetNotificationCount(page, { unread: 1 });
    await mockGetNotifications(page, [notif]);
    await mockMarkNotificationRead(page, 5);
    await mockGetNotificationCount(page, { unread: 0 });
    await page.goto('/');
  });

  test('clicking notification calls mark-read API', async ({ page }) => {
    await page.locator('app-notification-bell button[mat-icon-button]').click();
    const [request] = await Promise.all([
      page.waitForRequest(r => r.url().includes('/api/notifications/5/read') && r.method() === 'PUT'),
      page.getByText('Trade match found!').click(),
    ]);
    expect(request).toBeTruthy();
  });
});

// ── Mark all read ─────────────────────────────────────────────────────────────

test.describe('Notification Bell — mark all read', () => {
  const notif1 = makeNotificationDto({ id: 1, message: 'Match 1', isRead: false });
  const notif2 = makeNotificationDto({ id: 2, message: 'Match 2', isRead: false });

  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'Player', { playerId: 1, licenseTier: 'Tier2' });
    await stubUnmatchedApi(page);
    await mockGetNotificationCount(page, { unread: 2 });
    await mockGetNotifications(page, [notif1, notif2]);
    await mockMarkAllNotificationsRead(page);
    await page.goto('/');
  });

  test('clicking "Mark all read" calls PUT /notifications/readall', async ({ page }) => {
    await page.locator('app-notification-bell button[mat-icon-button]').click();
    const [request] = await Promise.all([
      page.waitForRequest(r => r.url().includes('/api/notifications/readall') && r.method() === 'PUT'),
      page.getByRole('button', { name: /mark all read/i }).click(),
    ]);
    expect(request).toBeTruthy();
  });
});

// ── Empty state ───────────────────────────────────────────────────────────────

test.describe('Notification Bell — empty', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'Player', { playerId: 1, licenseTier: 'Tier2' });
    await stubUnmatchedApi(page);
    await mockGetNotificationCount(page, { unread: 0 });
    await mockGetNotifications(page, []);
    await page.goto('/');
  });

  test('"No notifications" text visible when panel is empty', async ({ page }) => {
    await page.locator('app-notification-bell button[mat-icon-button]').click();
    await expect(page.getByText('No notifications')).toBeVisible();
  });
});

// ── Navigate on click ─────────────────────────────────────────────────────────

test.describe('Notification Bell — navigate on click', () => {
  const notif = makeNotificationDto({ id: 7, message: 'Trade with player 5', linkPath: '/players/5', isRead: false });

  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'Player', { playerId: 1, licenseTier: 'Tier2' });
    await stubUnmatchedApi(page);
    await mockPlayerProfileSubApis(page, 5);
    await mockGetNotificationCount(page, { unread: 1 });
    await mockGetNotifications(page, [notif]);
    await mockMarkNotificationRead(page, 7);
    await page.goto('/');
  });

  test('clicking notification navigates to linkPath', async ({ page }) => {
    await page.locator('app-notification-bell button[mat-icon-button]').click();
    await page.getByText('Trade with player 5').click();
    await expect(page).toHaveURL(/\/players\/5/);
  });
});
