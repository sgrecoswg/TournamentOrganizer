import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import {
  stubUnmatchedApi,
  mockGetEvent,
  mockGetEventPlayers,
  mockGetEvents,
  mockGetStores,
  mockSetCheckIn,
  mockDropPlayer,
  mockSetPlayerDropped,
  mockPromoteFromWaitlist,
  mockDeclareCommander,
  mockBulkRegisterConfirm,
  makeEventDto,
  makeEventPlayerDto,
  makeBulkRegisterResultDto,
} from '../helpers/api-mock';

// ─── Event Detail — Check-In ──────────────────────────────────────────────────
//
// Route registration order: stubUnmatchedApi FIRST (LIFO — last registered wins).

const EVENT_ID = 1;
const STORE_ID = 1;

const REG_EVENT = makeEventDto({ id: EVENT_ID, status: 'Registration', playerCount: 2, storeId: STORE_ID });
const IP_EVENT  = makeEventDto({ id: EVENT_ID, status: 'InProgress',   playerCount: 2, storeId: STORE_ID });

const ALICE = makeEventPlayerDto({ playerId: 1, name: 'Alice', isCheckedIn: false });
const BOB   = makeEventPlayerDto({ playerId: 2, name: 'Bob',   isCheckedIn: false });
const ALICE_CHECKED = makeEventPlayerDto({ playerId: 1, name: 'Alice', isCheckedIn: true });

// ── Section visibility ────────────────────────────────────────────────────────

test.describe('Check-In: section visibility', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'StoreEmployee', { storeId: STORE_ID });
    await stubUnmatchedApi(page);
    await mockGetStores(page, []);
    await mockGetEvent(page, REG_EVENT);
    await mockGetEventPlayers(page, EVENT_ID, [ALICE, BOB]);
    await page.goto(`/events/${EVENT_ID}`);
  });

  test('Check-In section is visible during Registration', async ({ page }) => {
    await expect(page.locator('.checkin-section')).toBeVisible();
  });

  test('checked-in count is shown in header', async ({ page }) => {
    await expect(page.locator('.checkin-count')).toContainText('Check-In: 0 / 2');
  });
});

test.describe('Check-In: section hidden when InProgress', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'StoreEmployee', { storeId: STORE_ID });
    await stubUnmatchedApi(page);
    await mockGetStores(page, []);
    await mockGetEvent(page, IP_EVENT);
    await mockGetEventPlayers(page, EVENT_ID, [ALICE, BOB]);
    await page.goto(`/events/${EVENT_ID}`);
  });

  test('Check-In section is NOT visible when InProgress', async ({ page }) => {
    await expect(page.locator('.checkin-section')).not.toBeVisible();
  });
});

// ── Toggle check-in ───────────────────────────────────────────────────────────

test.describe('Check-In: toggle', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'StoreEmployee', { storeId: STORE_ID });
    await stubUnmatchedApi(page);
    await mockGetStores(page, []);
    await mockGetEvent(page, REG_EVENT);
    await mockGetEventPlayers(page, EVENT_ID, [ALICE]);
    await mockSetCheckIn(page, EVENT_ID, ALICE.playerId, ALICE_CHECKED);
    await page.goto(`/events/${EVENT_ID}`);
  });

  test('clicking unchecked row calls API and updates the checkbox', async ({ page }) => {
    const checkbox = page.locator('tr[mat-row] mat-checkbox').first();
    await expect(checkbox).toBeVisible();

    // Confirm initially unchecked
    await expect(checkbox.locator('input[type="checkbox"]')).not.toBeChecked();

    // Click to check in
    await checkbox.click();

    // After API response the count updates
    await expect(page.locator('.checkin-count')).toContainText('Check-In: 1 / 1');
  });
});

// ── Check In All ──────────────────────────────────────────────────────────────

test.describe('Check-In: Check In All', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'StoreEmployee', { storeId: STORE_ID });
    await stubUnmatchedApi(page);
    await mockGetStores(page, []);
    await mockGetEvent(page, makeEventDto({ id: EVENT_ID, status: 'Registration', playerCount: 3, storeId: STORE_ID }));
    const players = [
      makeEventPlayerDto({ playerId: 1, name: 'Alice', isCheckedIn: false }),
      makeEventPlayerDto({ playerId: 2, name: 'Bob',   isCheckedIn: false }),
      makeEventPlayerDto({ playerId: 3, name: 'Carol', isCheckedIn: false }),
    ];
    await mockGetEventPlayers(page, EVENT_ID, players);
    // Each check-in call returns the player with isCheckedIn: true
    for (const p of players) {
      await mockSetCheckIn(page, EVENT_ID, p.playerId, { ...p, isCheckedIn: true });
    }
    await page.goto(`/events/${EVENT_ID}`);
  });

  test('clicking Check In All checks all 3 players', async ({ page }) => {
    await page.getByRole('button', { name: 'Check In All' }).click();
    await expect(page.locator('.checkin-count')).toContainText('Check-In: 3 / 3');
  });
});

// ── Player self-check-in ──────────────────────────────────────────────────────

test.describe('Check-In: Player self-check-in', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'Player', { playerId: 1 });
    await stubUnmatchedApi(page);
    await mockGetStores(page, []);
    await mockGetEvent(page, REG_EVENT);
    await mockGetEventPlayers(page, EVENT_ID, [ALICE, BOB]);
    await mockSetCheckIn(page, EVENT_ID, ALICE.playerId, ALICE_CHECKED);
    await page.goto(`/events/${EVENT_ID}`);
  });

  test("own row has a checkbox; other player's row does not", async ({ page }) => {
    const checkboxes = page.locator('tr[mat-row] mat-checkbox');
    await expect(checkboxes).toHaveCount(1);
  });
});

// ── Role gate ─────────────────────────────────────────────────────────────────

test.describe('Check-In: role gate (Player viewing another player)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'Player', { playerId: 99 });
    await stubUnmatchedApi(page);
    await mockGetStores(page, []);
    await mockGetEvent(page, REG_EVENT);
    await mockGetEventPlayers(page, EVENT_ID, [ALICE, BOB]);
    await page.goto(`/events/${EVENT_ID}`);
  });

  test('no checkboxes visible for a different player', async ({ page }) => {
    await expect(page.locator('tr[mat-row] mat-checkbox')).toHaveCount(0);
  });
});

// ── Clear All Players ─────────────────────────────────────────────────────────

test.describe('Registration: Clear All Players button', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'StoreEmployee', { storeId: STORE_ID });
    await stubUnmatchedApi(page);
    await mockGetStores(page, []);
    await mockGetEvent(page, REG_EVENT);
    await mockGetEventPlayers(page, EVENT_ID, [ALICE, BOB]);
    await page.goto(`/events/${EVENT_ID}`);
  });

  test('Clear All Players button is visible when players are registered', async ({ page }) => {
    await expect(page.getByRole('button', { name: /clear all players/i })).toBeVisible();
  });

  test('clicking Clear All Players calls drop for each active player and shows snackbar', async ({ page }) => {
    await mockDropPlayer(page, EVENT_ID, ALICE.playerId);
    await mockDropPlayer(page, EVENT_ID, BOB.playerId);
    // After clearing, return empty player list
    await mockGetEventPlayers(page, EVENT_ID, []);
    await mockGetEvent(page, { ...REG_EVENT, playerCount: 0 });

    await page.getByRole('button', { name: /clear all players/i }).click();

    await expect(page.getByText('All players cleared.')).toBeVisible();
  });
});

test.describe('Registration: Clear All Players — not shown when no players', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'StoreEmployee', { storeId: STORE_ID });
    await stubUnmatchedApi(page);
    await mockGetStores(page, []);
    await mockGetEvent(page, makeEventDto({ id: EVENT_ID, status: 'Registration', playerCount: 0, storeId: STORE_ID }));
    await mockGetEventPlayers(page, EVENT_ID, []);
    await page.goto(`/events/${EVENT_ID}`);
  });

  test('Clear All Players button is NOT shown when player list is empty', async ({ page }) => {
    await expect(page.getByRole('button', { name: /clear all players/i })).not.toBeVisible();
  });
});

// ── Player Drop / Withdraw (InProgress) ───────────────────────────────────────

const CAROL = makeEventPlayerDto({ playerId: 3, name: 'Carol', isCheckedIn: true });
const CAROL_DROPPED = makeEventPlayerDto({ playerId: 3, name: 'Carol', isCheckedIn: true, isDropped: true, droppedAfterRound: 1 });

test.describe('Player Drop: StoreEmployee can drop an active player during InProgress', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'StoreEmployee', { storeId: STORE_ID });
    await stubUnmatchedApi(page);
    await mockGetStores(page, []);
    await mockGetEvent(page, IP_EVENT);
    await mockGetEventPlayers(page, EVENT_ID, [CAROL]);
    await mockSetPlayerDropped(page, EVENT_ID, CAROL.playerId, CAROL_DROPPED);
    await page.goto(`/events/${EVENT_ID}`);
  });

  test('Drop button is visible for active player row during InProgress', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Drop' })).toBeVisible();
  });

  test('clicking Drop and confirming calls API and shows Dropped chip', async ({ page }) => {
    page.on('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Drop' }).click();
    await expect(page.locator('mat-chip').filter({ hasText: 'Dropped' })).toBeVisible();
  });
});

test.describe('Player Drop: Un-drop button visible on dropped rows for StoreEmployee', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'StoreEmployee', { storeId: STORE_ID });
    await stubUnmatchedApi(page);
    await mockGetStores(page, []);
    await mockGetEvent(page, IP_EVENT);
    await mockGetEventPlayers(page, EVENT_ID, [CAROL_DROPPED]);
    await mockSetPlayerDropped(page, EVENT_ID, CAROL.playerId, CAROL);
    await page.goto(`/events/${EVENT_ID}`);
  });

  test('Un-drop button is visible on a dropped player row', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Un-drop' })).toBeVisible();
  });

  test('clicking Un-drop restores the player to Active', async ({ page }) => {
    page.on('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Un-drop' }).click();
    await expect(page.locator('mat-chip').filter({ hasText: 'Active' })).toBeVisible();
  });
});

test.describe('Player Drop: Withdraw button for Player on own row during InProgress', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'Player', { playerId: CAROL.playerId });
    await stubUnmatchedApi(page);
    await mockGetStores(page, []);
    await mockGetEvent(page, IP_EVENT);
    await mockGetEventPlayers(page, EVENT_ID, [CAROL]);
    await mockSetPlayerDropped(page, EVENT_ID, CAROL.playerId, CAROL_DROPPED);
    await page.goto(`/events/${EVENT_ID}`);
  });

  test('Withdraw button is visible for player on their own row', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Withdraw' })).toBeVisible();
  });

  test('clicking Withdraw and confirming marks player as Dropped', async ({ page }) => {
    page.on('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Withdraw' }).click();
    await expect(page.locator('mat-chip').filter({ hasText: 'Dropped' })).toBeVisible();
  });
});

test.describe('Player Drop: role gate — no Drop/Withdraw for a different player row', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'Player', { playerId: 99 });
    await stubUnmatchedApi(page);
    await mockGetStores(page, []);
    await mockGetEvent(page, IP_EVENT);
    await mockGetEventPlayers(page, EVENT_ID, [CAROL]);
    await page.goto(`/events/${EVENT_ID}`);
  });

  test('no Drop or Withdraw buttons visible for a different player', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Drop' })).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Withdraw' })).not.toBeVisible();
  });
});

// ── Waitlist ──────────────────────────────────────────────────────────────────

const FULL_REG_EVENT = makeEventDto({ id: EVENT_ID, status: 'Registration', playerCount: 2, maxPlayers: 2, storeId: STORE_ID });

const EVE_WAITLISTED = makeEventPlayerDto({
  playerId: 5, name: 'Eve', isWaitlisted: true, waitlistPosition: 1,
});
const EVE_PROMOTED = makeEventPlayerDto({
  playerId: 5, name: 'Eve', isWaitlisted: false, waitlistPosition: null,
});

async function openWaitlistTab(page: import('@playwright/test').Page) {
  await page.getByRole('tab', { name: /waitlist/i }).click();
}

test.describe('Waitlist: StoreEmployee sees waitlist section with Promote buttons', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'StoreEmployee', { storeId: STORE_ID });
    await stubUnmatchedApi(page);
    await mockGetStores(page, []);
    await mockGetEvent(page, FULL_REG_EVENT);
    await mockGetEventPlayers(page, EVENT_ID, [ALICE, BOB, EVE_WAITLISTED]);
    await page.goto(`/events/${EVENT_ID}`);
    await openWaitlistTab(page);
  });

  test('waitlist section is visible with the waitlisted player', async ({ page }) => {
    await expect(page.locator('.waitlist-section')).toBeVisible();
    await expect(page.locator('.waitlist-section')).toContainText('Eve');
  });

  test('Promote button is visible for the waitlisted player', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Promote' })).toBeVisible();
  });

  test('clicking Promote calls the API and removes player from waitlist section', async ({ page }) => {
    await mockPromoteFromWaitlist(page, EVENT_ID, EVE_WAITLISTED.playerId, EVE_PROMOTED);
    await page.getByRole('button', { name: 'Promote' }).click();
    await expect(page.locator('.waitlist-section')).not.toBeVisible();
  });
});

test.describe('Waitlist: Player sees own waitlist position notice', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'Player', { playerId: 5 });
    await stubUnmatchedApi(page);
    await mockGetStores(page, []);
    await mockGetEvent(page, FULL_REG_EVENT);
    await mockGetEventPlayers(page, EVENT_ID, [ALICE, BOB, EVE_WAITLISTED]);
    await page.goto(`/events/${EVENT_ID}`);
    await openWaitlistTab(page);
  });

  test('Player sees "You are #1 on the waitlist" notice', async ({ page }) => {
    await expect(page.locator('.waitlist-notice')).toBeVisible();
    await expect(page.locator('.waitlist-notice')).toContainText('#1 on the waitlist');
  });

  test('Promote button is NOT visible for a Player', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Promote' })).not.toBeVisible();
  });
});

test.describe('Waitlist: no waitlist section when nobody is waitlisted', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'StoreEmployee', { storeId: STORE_ID });
    await stubUnmatchedApi(page);
    await mockGetStores(page, []);
    await mockGetEvent(page, REG_EVENT);
    await mockGetEventPlayers(page, EVENT_ID, [ALICE, BOB]);
    await page.goto(`/events/${EVENT_ID}`);
    await openWaitlistTab(page);
  });

  test('waitlist section is not shown when nobody is on the waitlist', async ({ page }) => {
    await expect(page.locator('.waitlist-section')).not.toBeVisible();
  });
});

// ── Commander Declaration ──────────────────────────────────────────────────────

const ALICE_WITH_COMMANDER = makeEventPlayerDto({ playerId: 1, name: 'Alice', commanders: 'Atraxa, Praetors\' Voice' });
const ALICE_NO_COMMANDER   = makeEventPlayerDto({ playerId: 1, name: 'Alice', commanders: null });

test.describe('Commander Declaration: display', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'StoreEmployee', { storeId: STORE_ID });
    await stubUnmatchedApi(page);
    await mockGetStores(page, []);
    await mockGetEvent(page, IP_EVENT);
    await mockGetEventPlayers(page, EVENT_ID, [ALICE_WITH_COMMANDER, BOB]);
    await page.goto(`/events/${EVENT_ID}`);
  });

  test('commander name is shown in player row', async ({ page }) => {
    await expect(page.getByText("Atraxa, Praetors' Voice")).toBeVisible();
  });
});

test.describe('Commander Declaration: null display', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'StoreEmployee', { storeId: STORE_ID });
    await stubUnmatchedApi(page);
    await mockGetStores(page, []);
    await mockGetEvent(page, IP_EVENT);
    await mockGetEventPlayers(page, EVENT_ID, [ALICE_NO_COMMANDER, BOB]);
    await page.goto(`/events/${EVENT_ID}`);
  });

  test('shows — when commander is null', async ({ page }) => {
    // The commander column for Alice should show em dash
    const rows = page.locator('mat-table tr, table tr').filter({ hasText: 'Alice' });
    await expect(rows.first()).toContainText('—');
  });
});

test.describe('Commander Declaration: edit (StoreEmployee)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'StoreEmployee', { storeId: STORE_ID });
    await stubUnmatchedApi(page);
    await mockGetStores(page, []);
    await mockGetEvent(page, IP_EVENT);
    await mockGetEventPlayers(page, EVENT_ID, [ALICE_NO_COMMANDER, BOB]);
    await mockDeclareCommander(page, EVENT_ID, 1, makeEventPlayerDto({ playerId: 1, name: 'Alice', commanders: 'Atraxa' }));
    await page.goto(`/events/${EVENT_ID}`);
  });

  test('edit icon is visible on player row', async ({ page }) => {
    await expect(page.getByTitle('Edit commander').first()).toBeVisible();
  });

  test('clicking edit shows input; saving updates commander name', async ({ page }) => {
    await page.getByTitle('Edit commander').first().click();
    const input = page.locator('.commander-input').first();
    await expect(input).toBeVisible();
    await input.fill('Atraxa');
    await page.getByTitle('Save').first().click();
    await expect(page.getByText('Atraxa')).toBeVisible();
  });
});

test.describe('Commander Declaration: edit (own player)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'Player', { playerId: 1 });
    await stubUnmatchedApi(page);
    await mockGetStores(page, []);
    await mockGetEvent(page, IP_EVENT);
    await mockGetEventPlayers(page, EVENT_ID, [ALICE_NO_COMMANDER, BOB]);
    await page.goto(`/events/${EVENT_ID}`);
  });

  test('edit icon visible on own row', async ({ page }) => {
    const aliceRow = page.locator('tr').filter({ hasText: 'Alice' });
    await expect(aliceRow.getByTitle('Edit commander')).toBeVisible();
  });
});

test.describe('Commander Declaration: role gate', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'Player', { playerId: 99 });
    await stubUnmatchedApi(page);
    await mockGetStores(page, []);
    await mockGetEvent(page, IP_EVENT);
    await mockGetEventPlayers(page, EVENT_ID, [ALICE_NO_COMMANDER, BOB]);
    await page.goto(`/events/${EVENT_ID}`);
  });

  test('edit icon NOT visible on another player row', async ({ page }) => {
    await expect(page.getByTitle('Edit commander')).not.toBeVisible();
  });
});

// ── Bulk Register ─────────────────────────────────────────────────────────────
//
// Player data is seeded into localStorage BEFORE navigation via addInitScript.
// The localStorage key format is to_store_<storeId>_players.

const ALICE_STORE_PLAYER = { id: 10, name: 'Alice Manager', email: 'alice@shop.com', mu: 25, sigma: 8.333, conservativeScore: 0, isRanked: false, placementGamesLeft: 5, isActive: true };
const BOB_STORE_PLAYER   = { id: 11, name: 'Bob Player',    email: 'bob@example.com', mu: 25, sigma: 8.333, conservativeScore: 0, isRanked: false, placementGamesLeft: 5, isActive: true };

/** Seed players into localStorage for store 1 before page load. */
async function seedStorePlayers(page: import('@playwright/test').Page, players: typeof ALICE_STORE_PLAYER[]) {
  await page.addInitScript((p) => {
    localStorage.setItem('to_store_1_players', JSON.stringify(p));
    localStorage.setItem('to_store_1_players_meta', JSON.stringify([]));
  }, players);
}

test.describe('Bulk Register: upload file — visibility', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'StoreEmployee', { storeId: STORE_ID });
    await seedStorePlayers(page, [ALICE_STORE_PLAYER, BOB_STORE_PLAYER]);
    await stubUnmatchedApi(page);
    await mockGetStores(page, []);
    await mockGetEvent(page, REG_EVENT);
    await mockGetEventPlayers(page, EVENT_ID, []);
    await page.goto(`/events/${EVENT_ID}`);
  });

  test('Upload File button is visible for StoreEmployee during Registration', async ({ page }) => {
    await expect(page.getByRole('button', { name: /upload file/i })).toBeVisible();
  });

  test('hidden file input for .txt/.csv is present', async ({ page }) => {
    await expect(page.locator('input[type="file"][accept=".txt,.csv"]')).toBeAttached();
  });

  test('multi-select list renders store players', async ({ page }) => {
    await expect(page.getByText('Alice Manager')).toBeVisible();
    await expect(page.getByText('Bob Player')).toBeVisible();
  });
});

test.describe('Bulk Register: upload file — preview panel', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'StoreEmployee', { storeId: STORE_ID });
    await seedStorePlayers(page, [ALICE_STORE_PLAYER, BOB_STORE_PLAYER]);
    await stubUnmatchedApi(page);
    await mockGetStores(page, []);
    await mockGetEvent(page, REG_EVENT);
    await mockGetEventPlayers(page, EVENT_ID, []);

    // Upload a file containing alice (found) and unknown@new.com (not found)
    await page.addInitScript(() => {
      // Override FileReader so it loads the fake CSV synchronously
      (window as any).__fakeFileContent = 'alice@shop.com\nunknown@new.com';
    });

    await page.goto(`/events/${EVENT_ID}`);

    // Trigger file selection by dispatching a synthetic change event via evaluate
    await page.locator('input[type="file"][accept=".txt,.csv"]').evaluate((input: HTMLInputElement) => {
      const content = (window as any).__fakeFileContent ?? '';
      const file = new File([content], 'players.txt', { type: 'text/plain' });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      Object.defineProperty(input, 'files', { value: dataTransfer.files });
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
  });

  test('Preview Registration heading appears after file upload', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Preview Registration', level: 3 })).toBeVisible();
  });

  test('"Will register" section lists alice', async ({ page }) => {
    await expect(page.locator('.bulk-preview-panel')).toContainText('alice@shop.com');
  });

  test('"New players to create" section shows unknown email with name input', async ({ page }) => {
    await expect(page.locator('.bulk-preview-panel')).toContainText('New players to create');
    await expect(page.getByLabel('Name for unknown@new.com')).toBeVisible();
  });
});

test.describe('Bulk Register: confirm', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'StoreEmployee', { storeId: STORE_ID });
    await seedStorePlayers(page, [ALICE_STORE_PLAYER]);
    await stubUnmatchedApi(page);
    await mockGetStores(page, []);
    await mockGetEvent(page, REG_EVENT);
    await mockGetEventPlayers(page, EVENT_ID, []);
    await mockBulkRegisterConfirm(page, EVENT_ID, makeBulkRegisterResultDto({ registered: 2, created: 1 }));

    await page.addInitScript(() => {
      (window as any).__fakeFileContent = 'alice@shop.com';
    });

    await page.goto(`/events/${EVENT_ID}`);

    await page.locator('input[type="file"][accept=".txt,.csv"]').evaluate((input: HTMLInputElement) => {
      const content = (window as any).__fakeFileContent ?? '';
      const file = new File([content], 'players.txt', { type: 'text/plain' });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      Object.defineProperty(input, 'files', { value: dataTransfer.files });
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
  });

  test('clicking Confirm Registration shows summary snackbar', async ({ page }) => {
    await page.getByRole('button', { name: 'Confirm Registration' }).click();
    await expect(page.getByText(/2 registered/)).toBeVisible();
  });

  test('preview panel is hidden after confirm', async ({ page }) => {
    await page.getByRole('button', { name: 'Confirm Registration' }).click();
    await expect(page.getByRole('heading', { name: 'Preview Registration', level: 3 })).not.toBeVisible();
  });
});

test.describe('Bulk Register: cancel', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'StoreEmployee', { storeId: STORE_ID });
    await seedStorePlayers(page, [ALICE_STORE_PLAYER]);
    await stubUnmatchedApi(page);
    await mockGetStores(page, []);
    await mockGetEvent(page, REG_EVENT);
    await mockGetEventPlayers(page, EVENT_ID, []);

    await page.addInitScript(() => {
      (window as any).__fakeFileContent = 'alice@shop.com';
    });

    await page.goto(`/events/${EVENT_ID}`);

    await page.locator('input[type="file"][accept=".txt,.csv"]').evaluate((input: HTMLInputElement) => {
      const content = (window as any).__fakeFileContent ?? '';
      const file = new File([content], 'players.txt', { type: 'text/plain' });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      Object.defineProperty(input, 'files', { value: dataTransfer.files });
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
  });

  test('clicking Cancel hides the preview panel', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Preview Registration', level: 3 })).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('heading', { name: 'Preview Registration', level: 3 })).not.toBeVisible();
  });
});

test.describe('Bulk Register: multi-select', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'StoreEmployee', { storeId: STORE_ID });
    await seedStorePlayers(page, [ALICE_STORE_PLAYER, BOB_STORE_PLAYER]);
    await stubUnmatchedApi(page);
    await mockGetStores(page, []);
    await mockGetEvent(page, REG_EVENT);
    await mockGetEventPlayers(page, EVENT_ID, []);
    await page.goto(`/events/${EVENT_ID}`);
  });

  test('Select All button checks all players and enables Register Selected', async ({ page }) => {
    await page.getByRole('button', { name: 'Select All', exact: true }).click();
    // Register Selected should now be enabled
    await expect(page.getByRole('button', { name: 'Register Selected' })).not.toBeDisabled();
  });

  test('clicking Register Selected shows preview panel', async ({ page }) => {
    await page.getByRole('button', { name: 'Select All', exact: true }).click();
    await page.getByRole('button', { name: 'Register Selected' }).click();
    await expect(page.getByRole('heading', { name: 'Preview Registration', level: 3 })).toBeVisible();
  });
});

test.describe('Bulk Register: already registered', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'StoreEmployee', { storeId: STORE_ID });
    await seedStorePlayers(page, [ALICE_STORE_PLAYER]);
    await stubUnmatchedApi(page);
    await mockGetStores(page, []);
    await mockGetEvent(page, REG_EVENT);
    // Alice is already registered
    await mockGetEventPlayers(page, EVENT_ID, [makeEventPlayerDto({ playerId: ALICE_STORE_PLAYER.id, name: ALICE_STORE_PLAYER.name })]);

    await page.addInitScript(() => {
      (window as any).__fakeFileContent = 'alice@shop.com';
    });

    await page.goto(`/events/${EVENT_ID}`);

    await page.locator('input[type="file"][accept=".txt,.csv"]').evaluate((input: HTMLInputElement) => {
      const content = (window as any).__fakeFileContent ?? '';
      const file = new File([content], 'players.txt', { type: 'text/plain' });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      Object.defineProperty(input, 'files', { value: dataTransfer.files });
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
  });

  test('already-registered player appears in the skipped section', async ({ page }) => {
    await expect(page.locator('.bulk-preview-panel')).toContainText('Already registered (skipped)');
    await expect(page.locator('.bulk-preview-panel')).toContainText('alice@shop.com');
  });
});

test.describe('Bulk Register: role gate', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'Player', { playerId: 99 });
    await stubUnmatchedApi(page);
    await mockGetStores(page, []);
    await mockGetEvent(page, REG_EVENT);
    await mockGetEventPlayers(page, EVENT_ID, []);
    await page.goto(`/events/${EVENT_ID}`);
  });

  test('Upload File button is NOT visible for Player role', async ({ page }) => {
    await expect(page.getByRole('button', { name: /upload file/i })).not.toBeVisible();
  });

  test('multi-select section is NOT visible for Player role', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Select All', exact: true })).not.toBeVisible();
  });
});
