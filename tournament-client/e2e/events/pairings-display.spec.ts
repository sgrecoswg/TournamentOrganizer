import { test, expect } from '@playwright/test';
import { stubUnmatchedApi, mockGetEventPairings, makePairingsDto } from '../helpers/api-mock';

test.describe('Pairings Display — active round', () => {
  test.beforeEach(async ({ page }) => {
    await stubUnmatchedApi(page);
    await mockGetEventPairings(page, 1, makePairingsDto());
  });

  test('navigates without login and shows event name + round in h1', async ({ page }) => {
    await page.goto('/events/1/pairings');
    await expect(page.locator('h1')).toContainText('Friday Night Magic');
    await expect(page.locator('h1')).toContainText('1');
  });

  test('renders pod cards', async ({ page }) => {
    await page.goto('/events/1/pairings');
    await expect(page.locator('mat-card.pod-card')).toHaveCount(1);
  });

  test('shows all player names', async ({ page }) => {
    await page.goto('/events/1/pairings');
    const rows = page.locator('.player-row');
    await expect(rows).toHaveCount(4);
    await expect(rows.nth(0)).toContainText('Alice');
    await expect(rows.nth(1)).toContainText('Bob');
  });
});

test.describe('Pairings Display — no active round', () => {
  test.beforeEach(async ({ page }) => {
    await stubUnmatchedApi(page);
    await mockGetEventPairings(page, 1, makePairingsDto({ currentRound: null, pods: [] }));
  });

  test('shows waiting message', async ({ page }) => {
    await page.goto('/events/1/pairings');
    await expect(page.locator('.waiting-message')).toBeVisible();
  });

  test('shows no pod cards', async ({ page }) => {
    await page.goto('/events/1/pairings');
    await expect(page.locator('mat-card.pod-card')).toHaveCount(0);
  });
});

test.describe('Pairings Display — game result', () => {
  test('shows winner badge and Done status when game is completed', async ({ page }) => {
    await stubUnmatchedApi(page);
    const pairings = makePairingsDto();
    pairings.pods[0].gameStatus = 'Completed';
    pairings.pods[0].winnerPlayerId = 1;
    await mockGetEventPairings(page, 1, pairings);

    await page.goto('/events/1/pairings');
    await expect(page.locator('.game-status.completed')).toContainText('Done');
    await expect(page.locator('.winner-badge')).toBeVisible();
    await expect(page.locator('.player-row.winner .player-name')).toContainText('Alice');
  });

  test('shows Draw badge when game is a draw', async ({ page }) => {
    await stubUnmatchedApi(page);
    const pairings = makePairingsDto();
    pairings.pods[0].gameStatus = 'Draw';
    pairings.pods[0].winnerPlayerId = null;
    await mockGetEventPairings(page, 1, pairings);

    await page.goto('/events/1/pairings');
    await expect(page.locator('.game-status.draw')).toContainText('Draw');
    await expect(page.locator('.winner-badge')).toHaveCount(0);
  });
});

test.describe('Pairings Display — commander names', () => {
  test.beforeEach(async ({ page }) => {
    await stubUnmatchedApi(page);
    await mockGetEventPairings(page, 1, makePairingsDto());
  });

  test('shows commander name next to player when declared', async ({ page }) => {
    await page.goto('/events/1/pairings');
    // Alice declared Atraxa
    const aliceRow = page.locator('.player-row').first();
    await expect(aliceRow.locator('.commander-name')).toContainText('Atraxa');
  });

  test('does not show commander span for players with no commander', async ({ page }) => {
    await page.goto('/events/1/pairings');
    // Bob (index 1) has no commander
    const bobRow = page.locator('.player-row').nth(1);
    await expect(bobRow.locator('.commander-name')).toHaveCount(0);
  });
});
