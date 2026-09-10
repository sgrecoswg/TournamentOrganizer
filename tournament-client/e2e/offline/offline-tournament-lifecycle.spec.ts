import { test, expect, Page } from '@playwright/test';
import { loginAs } from '../helpers/auth';

// ─── Full tournament lifecycle with the backend completely unreachable ───────
//
// Proves the local-first engine (EventService/PlayerService — negative IDs,
// LocalStorageContext) can run an entire event — create, add players,
// register, run rounds, submit results, view standings, complete — with
// every /api/** call failing. Unlike offline-mode.spec.ts (which checks
// banner/nav/redirect gating in isolation), this exercises the actual
// tournament-running capability end to end.
//
// No stubUnmatchedApi 200 catch-all here — every request must fail so the
// app settles into (and stays in) degraded mode, mirroring a real no-backend
// deploy. loginAs is registered after the catch-all so its specific
// /api/auth/refresh route wins (Playwright LIFO route order), simulating a
// user who authenticated before losing connectivity.

async function mockBackendUnreachable(page: Page): Promise<void> {
  await page.route('**/api/**', route => route.fulfill({ status: 404, json: {} }));
}

const PLAYER_NAMES = ['Offline Alice', 'Offline Bob', 'Offline Carol', 'Offline Dave'];

test('run a full tournament — create, register, 2 rounds, standings, complete — entirely offline', async ({ page }) => {
  test.setTimeout(60_000);

  await mockBackendUnreachable(page);
  await loginAs(page, 'StoreEmployee', { storeId: 1 });

  await page.goto('/events');
  await expect(page.getByText(/Backend unreachable/i)).toBeVisible();

  // ── Add players (Players sidenav link is hidden while degraded, but the
  //    route itself has no guard — a real user could still deep-link here) ──
  await page.goto('/players');
  for (const name of PLAYER_NAMES) {
    await page.getByLabel('Name').fill(name);
    await page.getByLabel('Email').fill(`${name.toLowerCase().replace(/\s+/g, '.')}@example.com`);
    await page.getByRole('button', { name: 'Register' }).click();
    await expect(page.getByText(`${name} registered!`)).toBeVisible();
  }
  for (const name of PLAYER_NAMES) {
    await expect(page.getByRole('link', { name })).toBeVisible();
  }

  // ── Create event (always local-only, negative id) ──
  await page.goto('/events');
  await page.getByLabel('Event Name').fill('Offline Lifecycle Test');
  await page.getByLabel('Date').fill('3/15/2026');
  await page.getByLabel('Date').press('Tab');
  await page.getByRole('button', { name: /Create Event/ }).click();
  await expect(page.getByText('Event created!')).toBeVisible();

  const card = page.locator('mat-card.event-card').filter({ hasText: 'Offline Lifecycle Test' });
  await expect(card.locator('button.sync-btn')).toBeVisible();
  await card.click();

  await expect(page.getByRole('heading', { name: 'Offline Lifecycle Test' })).toBeVisible();

  // ── Register all 4 players onto the event ──
  for (const name of PLAYER_NAMES) {
    await page.getByLabel('Player Name').fill(name);
    await page.getByRole('option', { name: new RegExp(name) }).click();
    await page.getByRole('button', { name: 'Register Player' }).click();
    await expect(page.getByText('Player registered!').last()).toBeVisible();
  }
  for (const name of PLAYER_NAMES) {
    await expect(page.getByRole('cell', { name })).toBeVisible();
  }

  // ── Check everyone in, then start the event (round 1 auto-generates) ──
  await page.getByRole('button', { name: 'Check In All' }).click();
  await page.getByRole('button', { name: 'Start Event' }).click();
  await page.getByRole('button', { name: 'Confirm Start' }).click();
  await expect(page.getByText('Event started — Round 1 generated!')).toBeVisible();

  // ── Round 1: one pod of 4 — submit a result ──
  await page.getByRole('tab', { name: 'Rounds' }).click();
  await expect(page.getByText('Round 1')).toBeVisible();
  await page.locator('app-pod-card').getByLabel('Winner').click();
  await page.getByRole('option').first().click();
  await page.locator('app-pod-card').getByRole('button', { name: 'Submit Results' }).click();
  await expect(page.getByText('Results submitted!')).toBeVisible();
  await expect(page.locator('app-pod-card').getByText('Results submitted', { exact: true })).toBeVisible();

  // ── Round 2: generate, submit ──
  await page.getByRole('button', { name: 'Generate Next Round' }).click();
  await expect(page.getByText('Round 2')).toBeVisible();
  const round2Pod = page.locator('app-pod-card').filter({ hasText: 'Pod' }).last();
  await round2Pod.getByLabel('Winner').click();
  await page.getByRole('option').first().click();
  await round2Pod.getByRole('button', { name: 'Submit Results' }).click();
  await expect(page.getByText('Results submitted!').last()).toBeVisible();

  // ── Standings reflect both rounds ──
  await page.getByRole('tab', { name: 'Standings' }).click();
  await expect(page.locator('table').getByRole('row')).toHaveCount(5); // header + 4 players
  for (const name of PLAYER_NAMES) {
    await expect(page.locator('table').getByText(name)).toBeVisible();
  }

  // ── Complete the event ──
  await page.getByRole('button', { name: 'End Event' }).click();
  await expect(page.getByText('Event status: Completed')).toBeVisible();
  await expect(page.locator('mat-chip').filter({ hasText: 'Completed' })).toBeVisible();
});

test('register a brand-new player directly from event-detail while offline, without pre-creating via /players', async ({ page }) => {
  await mockBackendUnreachable(page);
  await loginAs(page, 'StoreEmployee', { storeId: 1 });

  await page.goto('/events');
  await page.getByLabel('Event Name').fill('Inline New Player Test');
  await page.getByLabel('Date').fill('3/15/2026');
  await page.getByLabel('Date').press('Tab');
  await page.getByRole('button', { name: /Create Event/ }).click();
  await expect(page.getByText('Event created!')).toBeVisible();

  const card = page.locator('mat-card.event-card').filter({ hasText: 'Inline New Player Test' });
  await card.click();
  await expect(page.getByRole('heading', { name: 'Inline New Player Test' })).toBeVisible();

  // Type a name that has never been registered anywhere — no /players detour.
  await page.getByLabel('Player Name').fill('Fresh Newbie');

  const registerBtn = page.getByRole('button', { name: 'Register New Player' });
  await expect(registerBtn).toBeVisible();
  await expect(registerBtn).toBeDisabled();

  await page.getByLabel('Email (new player)').fill('fresh.newbie@example.com');
  await expect(registerBtn).toBeEnabled();
  await registerBtn.click();

  await expect(page.getByText('Player registered!')).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Fresh Newbie' })).toBeVisible();

  // Form resets — the email field disappears again.
  await expect(page.getByLabel('Email (new player)')).toHaveCount(0);

  // The local write actually landed in the player store.
  await page.goto('/players');
  await expect(page.getByRole('link', { name: 'Fresh Newbie' })).toBeVisible();
});
