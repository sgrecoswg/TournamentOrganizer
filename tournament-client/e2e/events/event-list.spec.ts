import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { mockGetEvents, mockGetStores, makeStoreDto, stubUnmatchedApi, makeEventDto } from '../helpers/api-mock';

// ─── Event List (/events) ─────────────────────────────────────────────────────
//
// Route registration order matters: Playwright evaluates routes in LIFO order
// (last registered = first evaluated).  Always register stubUnmatchedApi FIRST
// so it acts as a true catch-all and specific mocks registered afterwards take
// priority over it.

const REG_EVENT    = makeEventDto({ id: 1, name: 'Friday Night Commander', status: 'Registration', playerCount: 3 });
const INPROG_EVENT = makeEventDto({ id: 2, name: 'Saturday Showdown',      status: 'InProgress',   playerCount: 8 });
const DONE_EVENT   = makeEventDto({ id: 3, name: 'Spring Championship',    status: 'Completed',    playerCount: 12 });

// ── Heading ───────────────────────────────────────────────────────────────────

test.describe('Event List — heading', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'Player');
    await stubUnmatchedApi(page);
    await mockGetEvents(page, []);
    await page.goto('/events');
  });

  test('shows the "Events" heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Events' })).toBeVisible();
  });
});

// ── Empty states ──────────────────────────────────────────────────────────────

test.describe('Event List — empty states', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'Player');
    await stubUnmatchedApi(page);
    await mockGetEvents(page, []);
    await page.goto('/events');
  });

  test('Registration tab shows empty message', async ({ page }) => {
    await expect(page.getByText('No registration events.')).toBeVisible();
  });

  test('In Progress tab shows empty message', async ({ page }) => {
    await page.getByRole('tab', { name: 'In Progress' }).click();
    await expect(page.getByText('No in progress events.')).toBeVisible();
  });

  test('Completed tab shows empty message', async ({ page }) => {
    await page.getByRole('tab', { name: 'Completed' }).click();
    await expect(page.getByText('No completed events.')).toBeVisible();
  });

  test('does not show any event cards', async ({ page }) => {
    await expect(page.locator('mat-card.event-card')).toHaveCount(0);
  });
});

// ── Populated (Registration tab) ──────────────────────────────────────────────

test.describe('Event List — populated (Registration tab)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'Player');
    await stubUnmatchedApi(page);
    await mockGetEvents(page, [REG_EVENT]);
    await page.goto('/events');
  });

  test('shows event name on card', async ({ page }) => {
    await expect(page.getByText('Friday Night Commander')).toBeVisible();
  });

  test('shows event date', async ({ page }) => {
    // date '2026-03-15' rendered by Angular's date pipe as 'Mar 15, 2026'
    await expect(page.getByText(/Mar 15, 2026/)).toBeVisible();
  });

  test('clicking a card navigates to /events/:id', async ({ page }) => {
    await page.locator('mat-card.event-card').first().click();
    await expect(page).toHaveURL(/\/events\/1/);
  });
});

// ── Tab filtering ─────────────────────────────────────────────────────────────

test.describe('Event List — tab filtering', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'Player');
    await stubUnmatchedApi(page);
    await mockGetEvents(page, [REG_EVENT, INPROG_EVENT, DONE_EVENT]);
    await page.goto('/events');
  });

  test('Registration tab shows only Registration events', async ({ page }) => {
    await expect(page.getByText('Friday Night Commander')).toBeVisible();
    await expect(page.getByText('Saturday Showdown')).not.toBeVisible();
    await expect(page.getByText('Spring Championship')).not.toBeVisible();
  });

  test('In Progress tab shows InProgress events', async ({ page }) => {
    await page.getByRole('tab', { name: 'In Progress' }).click();
    await expect(page.getByText('Saturday Showdown')).toBeVisible();
  });

  test('Registration event does NOT appear on In Progress tab', async ({ page }) => {
    await page.getByRole('tab', { name: 'In Progress' }).click();
    await expect(page.getByText('Friday Night Commander')).not.toBeVisible();
  });

  test('Completed tab shows Completed events', async ({ page }) => {
    await page.getByRole('tab', { name: 'Completed' }).click();
    await expect(page.getByText('Spring Championship')).toBeVisible();
  });
});

// ── Full badge and slot count ─────────────────────────────────────────────────

test.describe('Event List — Full badge and slot count', () => {
  const FULL_EVENT      = makeEventDto({ id: 4, name: 'Full Event',      status: 'Registration', playerCount: 4, maxPlayers: 4 });
  const PARTIAL_EVENT   = makeEventDto({ id: 5, name: 'Partial Event',   status: 'Registration', playerCount: 2, maxPlayers: 8 });
  const UNLIMITED_EVENT = makeEventDto({ id: 6, name: 'Unlimited Event', status: 'Registration', playerCount: 5, maxPlayers: null });

  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'Player');
    await stubUnmatchedApi(page);
    await mockGetEvents(page, [FULL_EVENT, PARTIAL_EVENT, UNLIMITED_EVENT]);
    await page.goto('/events');
  });

  test('shows "Full" chip when event is at capacity', async ({ page }) => {
    const fullCard = page.locator('mat-card.event-card').filter({ hasText: 'Full Event' });
    await expect(fullCard.getByText('Full', { exact: true })).toBeVisible();
  });

  test('shows remaining slots when not full', async ({ page }) => {
    const partialCard = page.locator('mat-card.event-card').filter({ hasText: 'Partial Event' });
    await expect(partialCard.getByText(/6 remaining/)).toBeVisible();
  });

  test('does not show remaining slots for unlimited event', async ({ page }) => {
    const unlimitedCard = page.locator('mat-card.event-card').filter({ hasText: 'Unlimited Event' });
    await expect(unlimitedCard.getByText(/remaining/)).not.toBeVisible();
  });
});

// ── Role-based UI: Player ─────────────────────────────────────────────────────

test.describe('Event List — role-based UI: Player', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'Player');
    await stubUnmatchedApi(page);
    await mockGetEvents(page, [REG_EVENT]);
    await page.goto('/events');
  });

  test('Create New Event card is NOT visible', async ({ page }) => {
    await expect(page.getByText('Create New Event')).not.toBeVisible();
  });

  test('Remove button is NOT visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Remove/ })).not.toBeVisible();
  });
});

// ── Role-based UI: StoreEmployee ──────────────────────────────────────────────

test.describe('Event List — role-based UI: StoreEmployee', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'StoreEmployee', { storeId: 1 });
    await stubUnmatchedApi(page);
    await mockGetEvents(page, []);
    await page.goto('/events');
  });

  test('Create New Event card IS visible', async ({ page }) => {
    await expect(page.getByText('Create New Event')).toBeVisible();
  });

  test('Event Name input is visible', async ({ page }) => {
    await expect(page.getByLabel('Event Name')).toBeVisible();
  });

  test('Create Event button is disabled when name is empty', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Create Event/ })).toBeDisabled();
  });

  test('Create Event button is disabled when name filled but date empty', async ({ page }) => {
    await page.getByLabel('Event Name').fill('My Event');
    await expect(page.getByRole('button', { name: /Create Event/ })).toBeDisabled();
  });

  test('Create Event button is enabled when name and date are filled', async ({ page }) => {
    await page.getByLabel('Event Name').fill('My Event');
    await page.getByLabel('Date').fill('3/15/2026');
    await page.getByLabel('Date').press('Tab');
    await expect(page.getByRole('button', { name: /Create Event/ })).toBeEnabled();
  });
});

// ── Role-based UI: Remove button ──────────────────────────────────────────────

test.describe('Event List — role-based UI: Remove button', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'StoreEmployee', { storeId: 1 });
    await stubUnmatchedApi(page);
    await mockGetEvents(page, [REG_EVENT]);
    await page.goto('/events');
  });

  test('Remove button is visible for each event card', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Remove/ })).toBeVisible();
  });
});

// ── Create event (happy path) ─────────────────────────────────────────────────

test('StoreEmployee can create an event and it appears in the list', async ({ page }) => {
  await loginAs(page, 'StoreEmployee', { storeId: 1 });
  await stubUnmatchedApi(page);
  await mockGetEvents(page, []);
  await page.goto('/events');

  await page.getByLabel('Event Name').fill('New Commander Night');
  await page.getByLabel('Date').fill('3/15/2026');
  await page.getByLabel('Date').press('Tab');
  await page.getByRole('button', { name: /Create Event/ }).click();

  await expect(page.getByText('Event created!')).toBeVisible();
  await expect(page.getByText('New Commander Night')).toBeVisible();
  await expect(page.getByLabel('Event Name')).toHaveValue('');
});

// ── Remove event (happy path) ─────────────────────────────────────────────────

test('StoreEmployee can remove an event', async ({ page }) => {
  await loginAs(page, 'StoreEmployee', { storeId: 1 });
  await stubUnmatchedApi(page);

  let removed = false;
  await page.route('**/api/events', route => {
    if (route.request().method() === 'GET') {
      route.fulfill({ json: removed ? [] : [REG_EVENT] });
    } else {
      route.continue();
    }
  });
  await page.route('**/api/events/1', route => {
    if (route.request().method() === 'DELETE') {
      removed = true;
      route.fulfill({ status: 200, body: '' });
    } else {
      route.fallback();
    }
  });

  await page.goto('/events');

  await expect(page.getByText('Friday Night Commander')).toBeVisible();
  await page.getByRole('button', { name: /Remove/ }).click();

  await expect(page.getByText('Event removed')).toBeVisible();
  await expect(page.getByText('Friday Night Commander')).not.toBeVisible();
});

// ── Offline / localStorage cache ──────────────────────────────────────────────

test.describe('Event List — offline / localStorage cache', () => {
  const CACHED_EVENTS = [
    makeEventDto({ id: 1, name: 'Cached Alpha', status: 'Registration' }),
    makeEventDto({ id: 2, name: 'Cached Beta',  status: 'Registration' }),
  ];

  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'StoreEmployee', { storeId: 1 });
    // Pre-seed the LocalTable before Angular boots (storeId 1 → prefix 'to_store_1')
    await page.addInitScript((events) => {
      localStorage.setItem('to_store_1_events', JSON.stringify(events));
      localStorage.setItem('to_store_1_events_meta', JSON.stringify([]));
    }, CACHED_EVENTS);
    await stubUnmatchedApi(page);
    // loadAllEvents() early-exits from cache — this 500 is insurance
    await page.route('**/api/events', route => route.fulfill({ status: 500 }));
    await page.goto('/events');
  });

  test('shows events from localStorage when the API is offline', async ({ page }) => {
    await expect(page.getByText('Cached Alpha')).toBeVisible();
    await expect(page.getByText('Cached Beta')).toBeVisible();
  });

  test('does not show an empty state when cache is populated', async ({ page }) => {
    await expect(page.getByText('No registration events.')).not.toBeVisible();
  });
});

// ── Role-based UI: Admin — no store selected ───────────────────────────────────

test.describe('Event List — role-based UI: Admin, no store selected', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'Administrator');
    await stubUnmatchedApi(page);
    await mockGetStores(page, [makeStoreDto({ id: 1, storeName: 'Test Game Shop' })]);
    await mockGetEvents(page, []);
    await page.goto('/events');
  });

  test('Create New Event card is NOT visible when no store is selected', async ({ page }) => {
    await expect(page.getByText('Create New Event')).not.toBeVisible();
  });
});

// ── Sync button on offline event cards ────────────────────────────────────────

const OFFLINE_EVENT = makeEventDto({ id: -1, name: 'Offline Event', status: 'Registration' });
const SYNCED_EVENT  = makeEventDto({ id: 99, name: 'Synced Event',  status: 'Registration' });

test.describe('Event List — sync button visibility', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'StoreEmployee', { storeId: 1 });
    // Seed an offline (negative-ID) event into localStorage before Angular boots.
    await page.addInitScript((evt) => {
      localStorage.setItem('to_store_1_events', JSON.stringify([evt]));
      localStorage.setItem('to_store_1_events_meta', JSON.stringify([[-1, 'added']]));
    }, OFFLINE_EVENT);
    await stubUnmatchedApi(page);
    await page.route('**/api/events', route => route.fulfill({ status: 500 }));
    await page.goto('/events');
  });

  test('Sync button is visible on an offline event card', async ({ page }) => {
    const card = page.locator('mat-card.event-card').filter({ hasText: 'Offline Event' });
    await expect(card.locator('button.sync-btn')).toBeVisible();
  });

  test('Sync button icon shows sync icon', async ({ page }) => {
    const card = page.locator('mat-card.event-card').filter({ hasText: 'Offline Event' });
    await expect(card.locator('button.sync-btn mat-icon')).toHaveText('sync');
  });
});

test.describe('Event List — sync button NOT visible on synced event', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'StoreEmployee', { storeId: 1 });
    await stubUnmatchedApi(page);
    await mockGetEvents(page, [SYNCED_EVENT]);
    await page.goto('/events');
  });

  test('Sync button is NOT visible on a synced event card', async ({ page }) => {
    const card = page.locator('mat-card.event-card').filter({ hasText: 'Synced Event' });
    await expect(card.locator('button.sync-btn')).not.toBeVisible();
  });
});

test.describe('Event List — sync button click', () => {
  test('clicking Sync calls POST /api/events and shows success snackbar', async ({ page }) => {
    await loginAs(page, 'StoreEmployee', { storeId: 1 });
    const CREATED_EVENT = makeEventDto({ id: 5, name: 'Offline Event', status: 'Registration' });
    await page.addInitScript((evt) => {
      localStorage.setItem('to_store_1_events', JSON.stringify([evt]));
      localStorage.setItem('to_store_1_events_meta', JSON.stringify([[-1, 'added']]));
    }, OFFLINE_EVENT);
    await stubUnmatchedApi(page);
    // loadAllEvents early-exits from cache; let POST /api/events succeed with a real ID
    await page.route('**/api/events', route => {
      if (route.request().method() === 'POST') {
        route.fulfill({ json: CREATED_EVENT });
      } else {
        route.fulfill({ status: 500 });
      }
    });
    await page.goto('/events');

    const card = page.locator('mat-card.event-card').filter({ hasText: 'Offline Event' });
    await card.locator('button.sync-btn').click();

    await expect(page.getByText(/synced successfully/i)).toBeVisible();
  });

  test('clicking Sync does NOT navigate away from the event list', async ({ page }) => {
    await loginAs(page, 'StoreEmployee', { storeId: 1 });
    await page.addInitScript((evt) => {
      localStorage.setItem('to_store_1_events', JSON.stringify([evt]));
      localStorage.setItem('to_store_1_events_meta', JSON.stringify([[-1, 'added']]));
    }, OFFLINE_EVENT);
    await stubUnmatchedApi(page);
    await page.route('**/api/events', route => route.fulfill({ status: 500 }));
    await page.goto('/events');

    const card = page.locator('mat-card.event-card').filter({ hasText: 'Offline Event' });
    await card.locator('button.sync-btn').click();

    await expect(page).toHaveURL(/\/events$/);
  });

  test('Player does NOT see a Sync button even for an offline event', async ({ page }) => {
    await loginAs(page, 'Player');
    await page.addInitScript((evt) => {
      localStorage.setItem('to_store_1_events', JSON.stringify([evt]));
      localStorage.setItem('to_store_1_events_meta', JSON.stringify([[-1, 'added']]));
    }, OFFLINE_EVENT);
    await stubUnmatchedApi(page);
    await page.route('**/api/events', route => route.fulfill({ status: 500 }));
    await page.goto('/events');

    await expect(page.locator('button.sync-btn')).not.toBeVisible();
  });
});

// ── Role-based UI: Admin — store selected via toolbar ─────────────────────────

test.describe('Event List — role-based UI: Admin, store selected via toolbar', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'Administrator');
    await stubUnmatchedApi(page);
    await mockGetStores(page, [makeStoreDto({ id: 1, storeName: 'Test Game Shop' })]);
    await mockGetEvents(page, []);
    await page.goto('/events');
  });

  test('Create New Event card becomes visible after selecting a store', async ({ page }) => {
    // Section hidden before store selection
    await expect(page.getByText('Create New Event')).not.toBeVisible();

    // Select a store from the toolbar dropdown
    await page.locator('mat-form-field.store-selector mat-select').click();
    await page.getByRole('option', { name: 'Test Game Shop' }).click();

    // Section now visible
    await expect(page.getByText('Create New Event')).toBeVisible();
  });
});
