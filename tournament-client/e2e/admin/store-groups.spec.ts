import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { mockGetStores, mockGetStoreGroups, mockCreateStoreGroup, mockAssignStore, stubUnmatchedApi, makeStoreDto, makeStoreGroupDto } from '../helpers/api-mock';

test.describe('Store Groups — Admin: list', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'Administrator');
    await stubUnmatchedApi(page);
    await mockGetStoreGroups(page, [makeStoreGroupDto({ id: 1, name: 'Top Deck Chain', storeCount: 2 })]);
    await page.goto('/store-groups');
  });

  test('group name visible', async ({ page }) => {
    await expect(page.getByText('Top Deck Chain')).toBeVisible();
  });

  test('store count visible', async ({ page }) => {
    await expect(page.getByText('2')).toBeVisible();
  });
});

test.describe('Store Groups — Admin: create', () => {
  test.beforeEach(async ({ page }) => {
    const newGroup = makeStoreGroupDto({ id: 2, name: 'New Group', storeCount: 0 });
    await loginAs(page, 'Administrator');
    await stubUnmatchedApi(page);
    await mockGetStoreGroups(page, []);
    await mockCreateStoreGroup(page, newGroup);
    await page.goto('/store-groups');
  });

  test('"New Group" button opens create form', async ({ page }) => {
    await page.getByRole('button', { name: /New Group/i }).click();
    await expect(page.locator('.create-group-form')).toBeVisible();
  });

  test('saving new group name adds it to the list', async ({ page }) => {
    await page.getByRole('button', { name: /New Group/i }).click();
    await page.getByLabel('Group Name').fill('New Group');
    await page.getByRole('button', { name: /Save/i }).click();
    await expect(page.locator('mat-card-title', { hasText: 'New Group' })).toBeVisible();
  });
});

test.describe('Store Groups — Admin: assign store', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'Administrator');
    await stubUnmatchedApi(page);
    await mockGetStoreGroups(page, [makeStoreGroupDto({ id: 1, name: 'Top Deck Chain', storeCount: 0 })]);
    await mockGetStores(page, [makeStoreDto({ id: 5, storeName: 'Solo Shop', storeGroupId: null } as any)]);
    await mockAssignStore(page, 1, 5);
    await page.goto('/store-groups');
  });

  test('selecting a store and assigning calls assign API', async ({ page }) => {
    // Open assign panel for group 1
    await page.locator('button[data-group-id="1"]').click();
    // Select store from dropdown
    await page.locator('mat-select[data-assign-select]').click();
    await page.getByRole('option', { name: 'Solo Shop' }).click();
    // Confirm
    await page.getByRole('button', { name: /Confirm/i }).click();
    // Verify assignment succeeded — snackbar appears
    await expect(page.getByText('Store assigned to group')).toBeVisible();
  });
});
