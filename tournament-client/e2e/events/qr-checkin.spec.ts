import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import {
  stubUnmatchedApi,
  mockCheckInByToken,
  mockGetEvent,
  mockGetEventPlayers,
  makeCheckInResponseDto,
  makeEventDto,
} from '../helpers/api-mock';

test.describe('QR Check-In — success', () => {
  test('shows success message with event name after check-in', async ({ page }) => {
    await stubUnmatchedApi(page);
    await mockCheckInByToken(page, 'abc123', makeCheckInResponseDto({ eventName: 'Friday Night Magic' }));
    await loginAs(page, 'Player', { playerId: 1 });

    await page.goto('/checkin/abc123');

    await expect(page.locator('.checkin-success')).toBeVisible();
    await expect(page.locator('.checkin-success')).toContainText('Friday Night Magic');
    await expect(page.locator('.checkin-error')).not.toBeVisible();
  });
});

test.describe('QR Check-In — not registered', () => {
  test('shows error message on 404', async ({ page }) => {
    await stubUnmatchedApi(page);
    await mockCheckInByToken(page, 'abc123', 404);
    await loginAs(page, 'Player', { playerId: 1 });

    await page.goto('/checkin/abc123');

    await expect(page.locator('.checkin-error')).toBeVisible();
    await expect(page.locator('.checkin-success')).not.toBeVisible();
  });
});

test.describe('QR Check-In — event closed', () => {
  test('shows error message on 400', async ({ page }) => {
    await stubUnmatchedApi(page);
    await mockCheckInByToken(page, 'abc123', 400);
    await loginAs(page, 'Player', { playerId: 1 });

    await page.goto('/checkin/abc123');

    await expect(page.locator('.checkin-error')).toBeVisible();
    await expect(page.locator('.checkin-success')).not.toBeVisible();
  });
});

test.describe('QR Check-In — QR displayed (StoreEmployee)', () => {
  test('QR code image is shown on event detail for StoreEmployee during Registration', async ({ page }) => {
    const event = makeEventDto({
      id: 1,
      status: 'Registration',
      checkInToken: 'abc123',
    });
    await stubUnmatchedApi(page);
    await mockGetEvent(page, event);
    await mockGetEventPlayers(page, 1, []);
    await loginAs(page, 'StoreEmployee', { storeId: 1 });

    await page.goto('/events/1');

    await expect(page.locator('.qr-card img')).toBeVisible({ timeout: 5000 });
  });

  test('QR code is not shown when event is InProgress', async ({ page }) => {
    const event = makeEventDto({ id: 1, status: 'InProgress', checkInToken: 'abc123' });
    await stubUnmatchedApi(page);
    await mockGetEvent(page, event);
    await mockGetEventPlayers(page, 1, []);
    await loginAs(page, 'StoreEmployee', { storeId: 1 });

    await page.goto('/events/1');

    await expect(page.locator('.qr-card')).not.toBeVisible();
  });
});
