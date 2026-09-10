import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import {
  stubUnmatchedApi,
  mockGetEvents,
  mockGetLeaderboard,
  mockGetStores,
  mockGetEvent,
  mockGetEventPlayers,
  makeEventDto,
  makeEventPlayerDto,
} from '../helpers/api-mock';
import { Page } from '@playwright/test';

// ─── Offline / degraded-mode UI hardening ─────────────────────────────────────
//
// Simulates a deployed frontend with no reachable backend: every /api/** call
// fails with a 404 (the same static-host fallback shape isBackendUnreachable()
// treats as "backend absent"). No stubUnmatchedApi 200 catch-all is registered
// in these tests — every request must fail for the app to settle into degraded
// mode on cold load, mirroring a real no-backend deploy.

async function mockBackendUnreachable(page: Page): Promise<void> {
  await page.route('**/api/**', route => route.fulfill({ status: 404, json: {} }));
}

const EVENT_ID = 1;
const STORE_ID = 1;

// ── Home / Login unreachable when degraded ─────────────────────────────────────

test.describe('Home and Login redirect to /events when backend is unreachable', () => {
  test('root route redirects to /events', async ({ page }) => {
    await mockBackendUnreachable(page);
    await page.goto('/');
    await expect(page).toHaveURL(/\/events$/);
  });

  test('/login redirects to /events', async ({ page }) => {
    await mockBackendUnreachable(page);
    await page.goto('/login');
    await expect(page).toHaveURL(/\/events$/);
  });

  test('root route still shows Landing when backend is reachable', async ({ page }) => {
    await stubUnmatchedApi(page);
    await mockGetEvents(page, []);
    await mockGetLeaderboard(page, []);
    await page.goto('/');
    await expect(page).toHaveURL(/\/$|\/\?/);
  });
});

// ── Side nav + toolbar gating ───────────────────────────────────────────────────

test.describe('Side nav and toolbar when degraded', () => {
  test('nav shows Events and Players; Home/Leaderboard/Stores are hidden', async ({ page }) => {
    await mockBackendUnreachable(page);
    await page.goto('/events');
    await expect(page.locator('a[routerLink="/events"]')).toBeVisible();
    // Players stays reachable offline — it's the only way to add players to a
    // locally-created event when there's no backend to authenticate against.
    await expect(page.locator('a[routerLink="/players"]')).toBeVisible();
    await expect(page.locator('a[routerLink="/"]')).toHaveCount(0);
    await expect(page.locator('a[routerLink="/leaderboard"]')).toHaveCount(0);
    await expect(page.locator('a[routerLink="/stores"]')).toHaveCount(0);
  });

  test('toolbar shows no Login button', async ({ page }) => {
    await mockBackendUnreachable(page);
    await page.goto('/events');
    await expect(page.getByRole('button', { name: 'Login with Google' })).toHaveCount(0);
  });

  test('nav shows all links and the Login button when backend is reachable', async ({ page }) => {
    await stubUnmatchedApi(page);
    await mockGetEvents(page, []);
    await page.goto('/events');
    await expect(page.locator('a[routerLink="/"]')).toBeVisible();
    await expect(page.locator('a[routerLink="/leaderboard"]')).toBeVisible();
    await expect(page.locator('a[routerLink="/players"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Login with Google' })).toBeVisible();
  });

  // On a real (unmocked) cold load, degraded starts false and only flips once the
  // silent-refresh /api/auth/refresh call fails — so a slow-to-fail backend leaves
  // a window where the Login button would render before disappearing. Delaying the
  // mocked 404 (instead of resolving same-tick) reproduces that window.
  test('toolbar never shows Login button, even during a slow-to-fail cold load', async ({ page }) => {
    // LIFO route order: register the broad catch-all first so the more specific,
    // delayed handler (registered after) takes priority for auth/refresh.
    await page.route('**/api/**', route => route.fulfill({ status: 404, json: {} }));
    await page.route('**/api/auth/refresh', async route => {
      await new Promise(resolve => setTimeout(resolve, 1500));
      await route.fulfill({ status: 404, json: {} });
    });

    // Race the button check against navigation itself, rather than awaiting goto first —
    // Angular's dev-bundle load/bootstrap time can itself eat past a short delay, so by the
    // time goto() resolves the window may have already closed. toHaveCount(0) is also a
    // polling assertion (checks "is it absent right now"), so a flicker that appears then
    // disappears between polls would slip through it. waitForSelector('attached') resolves
    // the instant the element is added to the DOM, even if it's later removed, so racing it
    // against goto actually catches a transient render.
    const navigation = page.goto('/events');
    let appeared = false;
    try {
      await page.waitForSelector('button:has-text("Login with Google")', { state: 'attached', timeout: 1400 });
      appeared = true;
    } catch {
      appeared = false;
    }
    await navigation;
    expect(appeared).toBe(false);
  });
});

// ── authGuard redirect target when degraded ─────────────────────────────────────

test.describe('authGuard redirects to /events (not /login) when degraded and unauthenticated', () => {
  test('navigating to a protected stores route bounces to /events', async ({ page }) => {
    await mockBackendUnreachable(page);
    await page.goto('/stores');
    await expect(page).toHaveURL(/\/events$/);
  });
});

// ── eventDetailAuthGuard: event-detail stays reachable offline ─────────────────
//
// Unlike the shared authGuard (stores, pairings, game-result), event-detail uses
// its own narrower guard so a degraded, unauthenticated visitor can still reach a
// locally-created event to add players — there's no backend to log in against.

test.describe('eventDetailAuthGuard lets a degraded, unauthenticated visitor reach event-detail', () => {
  test('navigating to /events/:id does NOT bounce to /events when degraded', async ({ page }) => {
    await mockBackendUnreachable(page);
    await page.goto(`/events/${EVENT_ID}`);
    await expect(page).toHaveURL(new RegExp(`/events/${EVENT_ID}$`));
  });
});

// ── Create Event — open to anyone offline ───────────────────────────────────────

test.describe('Create Event is available offline with no login', () => {
  test('Create New Event card is visible for an anonymous visitor', async ({ page }) => {
    await mockBackendUnreachable(page);
    await page.goto('/events');
    await expect(page.getByText('Create New Event')).toBeVisible();
  });

  test('Create button enables once name and date are filled, with no store/role required', async ({ page }) => {
    await mockBackendUnreachable(page);
    await page.goto('/events');
    await page.getByLabel('Event Name').fill('Offline Draft Night');
    await page.getByLabel('Date').fill('3/15/2026');
    const createBtn = page.getByRole('button', { name: 'Create Event' });
    await expect(createBtn).toBeEnabled();
  });
});

// ── Event Detail — no-fallback actions hidden while degraded ───────────────────
//
// Authenticated (valid token from /api/auth/refresh) so authGuard passes and the
// event loads normally, but GET /api/stores — an unrelated call app.ts fires for
// every store-employee/admin session — is forced to 404, flipping the app into
// degraded mode without breaking the event-detail page itself.
//
// networkStatusInterceptor is deliberately "self-healing": ANY successful /api/**
// response calls reportReachable() and clears the degraded flag, even one from an
// endpoint unrelated to the earlier failure (see network-status.interceptor.spec.ts
// — "reports reachable on a successful /api/** response"). Since event-detail fires
// several concurrent requests on load, the one that resolves *last* determines the
// final degraded state. A short delay on the forced-404 route ensures it resolves
// after the page's other (successful) mocked calls, so degraded reliably ends true.

test.describe('Event Detail — actions with no offline fallback are hidden when degraded', () => {
  test('Registration-status event: Pairings, Background upload, Bulk Register, and Edit-commander are hidden', async ({ page }) => {
    await stubUnmatchedApi(page);
    await loginAs(page, 'StoreEmployee', { storeId: STORE_ID });
    await page.route('**/api/stores', async route => {
      if (route.request().method() !== 'GET') return route.fallback();
      await new Promise(resolve => setTimeout(resolve, 300));
      await route.fulfill({ status: 404, json: {} });
    });
    await mockGetEvent(page, makeEventDto({ id: EVENT_ID, status: 'Registration', playerCount: 1, storeId: STORE_ID }));
    await mockGetEventPlayers(page, EVENT_ID, [makeEventPlayerDto({ playerId: 1, name: 'Alice' })]);
    await page.goto(`/events/${EVENT_ID}`);

    await expect(page.getByRole('link', { name: 'Pairings' })).toHaveCount(0);
    await expect(page.locator('.upload-background-btn')).toHaveCount(0);
    await expect(page.locator('.bulk-register-section')).toHaveCount(0);
    await expect(page.locator('.edit-commander-btn')).toHaveCount(0);
  });

  test('InProgress-status event: Un-drop and Promote are hidden for the store employee', async ({ page }) => {
    await stubUnmatchedApi(page);
    await loginAs(page, 'StoreEmployee', { storeId: STORE_ID });
    await page.route('**/api/stores', async route => {
      if (route.request().method() !== 'GET') return route.fallback();
      await new Promise(resolve => setTimeout(resolve, 300));
      await route.fulfill({ status: 404, json: {} });
    });
    await mockGetEvent(page, makeEventDto({ id: EVENT_ID, status: 'InProgress', playerCount: 2, storeId: STORE_ID }));
    await mockGetEventPlayers(page, EVENT_ID, [
      makeEventPlayerDto({ playerId: 1, name: 'Alice', isDropped: true }),
      makeEventPlayerDto({ playerId: 2, name: 'Bob', isWaitlisted: true, waitlistPosition: 1 }),
    ]);
    await page.goto(`/events/${EVENT_ID}`);

    await expect(page.getByRole('button', { name: 'Un-drop' })).toHaveCount(0);
    await page.getByRole('tab', { name: /Waitlist/ }).click();
    await expect(page.getByRole('button', { name: 'Promote' })).toHaveCount(0);
  });

  test('InProgress-status event: Withdraw is hidden for the self-registered player', async ({ page }) => {
    await stubUnmatchedApi(page);
    await loginAs(page, 'Player', { playerId: 1 });
    // A plain Player session (no storeId) never triggers app.ts's GET /api/stores call, so
    // that endpoint can't be used to force degraded mode here (unlike the store-employee
    // tests above). Instead, 404 the GET /api/events/:id/rounds call that event-detail
    // itself fires unconditionally in ngOnInit — event.service.ts swallows rounds load
    // errors via catchError(() => EMPTY), so this doesn't break the rest of the page.
    await page.route(`**/api/events/${EVENT_ID}/rounds`, async route => {
      if (route.request().method() !== 'GET') return route.fallback();
      await new Promise(resolve => setTimeout(resolve, 300));
      await route.fulfill({ status: 404, json: {} });
    });
    await mockGetEvent(page, makeEventDto({ id: EVENT_ID, status: 'InProgress', playerCount: 1, storeId: STORE_ID }));
    await mockGetEventPlayers(page, EVENT_ID, [
      makeEventPlayerDto({ playerId: 1, name: 'Alice', isDropped: false }),
    ]);
    await page.goto(`/events/${EVENT_ID}`);

    await expect(page.getByRole('button', { name: 'Withdraw' })).toHaveCount(0);
  });
});

// ── Add players offline with no prior login (cold start) ───────────────────────
//
// Unlike offline-tournament-lifecycle.spec.ts (which calls loginAs before going
// degraded, simulating a user who authenticated before losing connectivity),
// this never logs in at all — the backend is unreachable from the very first
// request, matching a real absent-backend deploy. Proves a cold, unauthenticated
// visitor can still reach Players via the sidenav (not a deep-link) and add
// players, since isStoreEmployee can never become true without a backend.

test.describe('Add players offline with no prior login (cold start)', () => {
  test('anonymous visitor navigates to Players via sidenav, registers a new player, creates an event, and adds the player to it', async ({ page }) => {
    await mockBackendUnreachable(page);
    await page.goto('/events');

    await page.locator('a[routerLink="/players"]').click();
    await expect(page).toHaveURL(/\/players$/);

    await page.getByLabel('Name').fill('Cold Start Carl');
    await page.getByLabel('Email').fill('cold.start.carl@example.com');
    await page.getByRole('button', { name: 'Register' }).click();
    await expect(page.getByText('Cold Start Carl registered!')).toBeVisible();

    await page.locator('a[routerLink="/events"]').click();
    await page.getByLabel('Event Name').fill('Cold Start Event');
    await page.getByLabel('Date').fill('3/20/2026');
    await page.getByLabel('Date').press('Tab');
    await page.getByRole('button', { name: /Create Event/ }).click();
    await expect(page.getByText('Event created!')).toBeVisible();

    const card = page.locator('mat-card.event-card').filter({ hasText: 'Cold Start Event' });
    await card.click();
    await expect(page.getByRole('heading', { name: 'Cold Start Event' })).toBeVisible();

    await page.getByLabel('Player Name').fill('Cold Start Carl');
    await page.getByRole('option', { name: /Cold Start Carl/ }).click();
    await page.getByRole('button', { name: 'Register Player' }).click();
    await expect(page.getByText('Player registered!')).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Cold Start Carl' })).toBeVisible();

    // Same anonymous, never-logged-in, degraded visitor must be able to check players
    // in and start the event — isStoreEmployee can never become true offline. Register
    // 3 more players inline (a pod needs 4) using the new-player fields the event-detail
    // form exposes while degraded, then check everyone in and start.
    for (const name of ['Cold Start Dana', 'Cold Start Eve', 'Cold Start Frank']) {
      await page.getByLabel('Player Name').fill(name);
      await page.getByLabel('Email (new player)').fill(`${name.toLowerCase().replace(/\s+/g, '.')}@example.com`);
      await page.getByRole('button', { name: 'Register New Player' }).click();
      await expect(page.getByText('Player registered!').last()).toBeVisible();
    }
    await expect(page.getByRole('cell', { name: 'Cold Start Frank' })).toBeVisible();

    await page.getByRole('button', { name: 'Check In All' }).click();
    await page.getByRole('button', { name: 'Start Event' }).click();
    await page.getByRole('button', { name: 'Confirm Start' }).click();
    await expect(page.getByText('Event started — Round 1 generated!')).toBeVisible();

    // Same anonymous, never-logged-in, degraded visitor must be able to run
    // Round 1 too — Generate Next Round / round timer controls / the pod card's
    // Winner + Submit Results are all gated on isStoreEmployee || degraded, and
    // isStoreEmployee can never become true offline.
    await page.getByRole('tab', { name: 'Rounds' }).click();
    await expect(page.getByText('Round 1')).toBeVisible();
    await page.locator('app-pod-card').getByLabel('Winner').click();
    await page.getByRole('option').first().click();
    await page.locator('app-pod-card').getByRole('button', { name: 'Submit Results' }).click();
    await expect(page.getByText('Results submitted!')).toBeVisible();
    await expect(page.locator('app-pod-card').getByText('Results submitted', { exact: true })).toBeVisible();
  });
});
