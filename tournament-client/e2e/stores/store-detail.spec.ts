import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { mockGetStore, mockGetEmployees, mockGetThemes, mockUploadStoreLogo, mockUploadStoreBackground, mockTestDiscordWebhook, mockGetEventTemplates, mockCreateEventTemplate, mockDeleteEventTemplate, makeEventTemplateDto, stubUnmatchedApi, makeStoreDetailDto, makeStoreDto, makeThemeDto } from '../helpers/api-mock';

// ─── Store Detail (/stores/:id) ───────────────────────────────────────────────
//
// Route registration order matters: Playwright evaluates routes in LIFO order
// (last registered = first evaluated).  Always register stubUnmatchedApi FIRST
// so it acts as a true catch-all and specific mocks registered afterwards take
// priority over it.

const STORE = makeStoreDetailDto({
  id:                       1,
  storeName:                'Downtown Game Shop',
  allowableTradeDifferential: 15,
});

const EMPLOYEES = [
  { id: 10, name: 'Alice Manager', email: 'alice@shop.com', role: 'StoreManager' },
  { id: 11, name: 'Bob Employee',  email: 'bob@shop.com',   role: 'StoreEmployee' },
];

// ── Header & navigation ──────────────────────────────────────────────────────

test.describe('Store Detail — header', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'Player');
    await stubUnmatchedApi(page);
    await mockGetStore(page, STORE);
    await page.goto('/stores/1');
  });

  test('shows the store name in the heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Downtown Game Shop' })).toBeVisible();
  });

  test('back button navigates to /stores', async ({ page }) => {
    // Scope to .page-header to avoid matching the toolbar's account_circle button
    await page.locator('.page-header').getByRole('button').click();
    await expect(page).toHaveURL(/\/stores$/);
  });
});

// ── Settings tab (visible to all) ─────────────────────────────────────────────

test.describe('Store Detail — Settings tab (Player / read-only)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'Player');
    await stubUnmatchedApi(page);
    await mockGetStore(page, STORE);
    await page.goto('/stores/1');
  });

  test('Settings tab is visible', async ({ page }) => {
    await expect(page.getByRole('tab', { name: 'Settings' })).toBeVisible();
  });

  test('Store Name field is populated', async ({ page }) => {
    const input = page.getByLabel('Store Name');
    await expect(input).toHaveValue('Downtown Game Shop');
  });

  test('Allowable Trade Differential field shows the correct value', async ({ page }) => {
    const input = page.getByLabel(/Allowable Trade Differential/);
    await expect(input).toHaveValue('15');
  });

  test('Save button is NOT visible for a Player', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Save/ })).not.toBeVisible();
  });
});

test.describe('Store Detail — Settings tab (StoreManager / editable)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'StoreManager', { storeId: 1, licenseTier: 'Tier1' });
    await stubUnmatchedApi(page);
    await mockGetThemes(page, []);
    await mockGetStore(page, STORE);
    await mockGetEmployees(page, 1, EMPLOYEES);
    await page.goto('/stores/1');
  });

  test('Save button is visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Save/ })).toBeVisible();
  });

  test('Save is disabled when the store name is cleared', async ({ page }) => {
    const nameInput = page.getByLabel('Store Name');
    await nameInput.clear();
    await expect(page.getByRole('button', { name: /Save/ })).toBeDisabled();
  });

  test('saving shows a success snackbar', async ({ page }) => {
    // Override only PUT for /api/stores/1; fall back to next handler for GET
    await page.route('**/api/stores/1', route => {
      if (route.request().method() === 'PUT') {
        route.fulfill({ json: { ...STORE, storeName: 'Updated Name' } });
      } else {
        route.fallback(); // pass GET to the mockGetStore handler registered in beforeEach
      }
    });

    await page.getByLabel('Store Name').fill('Updated Name');
    await page.getByRole('button', { name: /Save/ }).click();

    await expect(page.getByText(/Store settings saved/)).toBeVisible();
  });
});

// ── Tab visibility by role ────────────────────────────────────────────────────

test.describe('Store Detail — tab visibility: StoreManager', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'StoreManager', { storeId: 1 });
    await stubUnmatchedApi(page);
    await mockGetThemes(page, []);
    await mockGetStore(page, STORE);
    await mockGetEmployees(page, 1, EMPLOYEES);
    await page.goto('/stores/1');
  });

  test('Employees tab is visible', async ({ page }) => {
    await expect(page.getByRole('tab', { name: 'Employees' })).toBeVisible();
  });

  test('License tab is visible', async ({ page }) => {
    await expect(page.getByRole('tab', { name: 'License' })).toBeVisible();
  });

  test('Data Management tab is visible', async ({ page }) => {
    await expect(page.getByRole('tab', { name: 'Data Management' })).toBeVisible();
  });
});

test.describe('Store Detail — tab visibility: Player', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'Player');
    await stubUnmatchedApi(page);
    await mockGetStore(page, STORE);
    await page.goto('/stores/1');
  });

  test('Employees tab is NOT visible', async ({ page }) => {
    await expect(page.getByRole('tab', { name: 'Employees' })).not.toBeVisible();
  });

  test('License tab is NOT visible', async ({ page }) => {
    await expect(page.getByRole('tab', { name: 'License' })).not.toBeVisible();
  });

  test('Data Management tab is NOT visible', async ({ page }) => {
    await expect(page.getByRole('tab', { name: 'Data Management' })).not.toBeVisible();
  });
});

// ── Employees tab ─────────────────────────────────────────────────────────────

test.describe('Store Detail — Employees tab', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'StoreManager', { storeId: 1 });
    await stubUnmatchedApi(page);
    await mockGetThemes(page, []);
    await mockGetStore(page, STORE);
    await mockGetEmployees(page, 1, EMPLOYEES);
    await page.goto('/stores/1');
    await page.getByRole('tab', { name: 'Employees' }).click();
  });

  test('lists existing employees', async ({ page }) => {
    await expect(page.getByRole('cell', { name: 'Alice Manager' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Bob Employee' })).toBeVisible();
  });

  test('shows employee email and role columns', async ({ page }) => {
    await expect(page.getByRole('cell', { name: 'alice@shop.com' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'StoreManager' })).toBeVisible();
  });

  test('Add button is disabled when email is empty', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Add/ })).toBeDisabled();
  });

  test('Add button is enabled when email is filled', async ({ page }) => {
    await page.getByLabel('Email').fill('new@shop.com');
    await expect(page.getByRole('button', { name: /Add/ })).toBeEnabled();
  });

  test('adding an employee shows snackbar and new row', async ({ page }) => {
    const newEmployee = { id: 99, name: 'Charlie New', email: 'charlie@shop.com', role: 'StoreEmployee' };

    await page.route('**/api/stores/1/employees', route => {
      if (route.request().method() === 'POST') {
        route.fulfill({ json: newEmployee });
      } else {
        route.fallback(); // fall through to mockGetEmployees registered in beforeEach
      }
    });

    await page.getByLabel('Name').fill('Charlie New');
    await page.getByLabel('Email').fill('charlie@shop.com');
    await page.getByRole('button', { name: /Add/ }).click();

    await expect(page.getByText(/Charlie New.*added/)).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Charlie New' })).toBeVisible();
  });
});

// ── Data Management tab ───────────────────────────────────────────────────────

test.describe('Store Detail — Data Management tab', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'StoreEmployee', { storeId: 1 });
    await stubUnmatchedApi(page);
    await mockGetStore(page, STORE);
    await page.goto('/stores/1');
    await page.getByRole('tab', { name: 'Data Management' }).click();
  });

  test('shows Sync to Server button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Sync to Server/ })).toBeVisible();
  });

  test('shows Pull from Server button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Pull from Server/ })).toBeVisible();
  });

  test('shows Download (Export) button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Download/ })).toBeVisible();
  });

  test('shows Upload (Import) button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Upload/ })).toBeVisible();
  });

  test('Sync to Server is disabled when there are no pending changes', async ({ page }) => {
    // No pending local data → pendingCount = 0 → button disabled
    await expect(page.getByRole('button', { name: /Sync to Server/ })).toBeDisabled();
  });

  test('shows "All local changes are in sync" status when pendingCount is 0', async ({ page }) => {
    await expect(page.getByText('All local changes are in sync')).toBeVisible();
  });
});

// ── Theme selector ────────────────────────────────────────────────────────────

const THEMES = [
  makeThemeDto({ id: 1, name: 'Default', cssClass: 'theme-default' }),
  makeThemeDto({ id: 2, name: 'Dark',    cssClass: 'theme-dark'    }),
];

test.describe('Store Detail — theme selector', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'StoreManager', { storeId: 1, licenseTier: 'Tier1' });
    await stubUnmatchedApi(page);
    await mockGetThemes(page, THEMES);
    await mockGetStore(page, STORE);
    await mockGetEmployees(page, STORE.id, []);
    await page.goto('/stores/1');
  });

  test('theme dropdown is visible for StoreManager', async ({ page }) => {
    await expect(page.getByLabel('Theme')).toBeVisible();
  });

  test('theme dropdown is NOT visible for Player role', async ({ page }) => {
    await loginAs(page, 'Player');
    await page.goto('/stores/1');
    await expect(page.getByLabel('Theme')).not.toBeVisible();
  });

  test('selecting a theme adds the CSS class to <body> immediately', async ({ page }) => {
    await page.getByLabel('Theme').click();
    await page.getByRole('option', { name: 'Dark' }).click();
    await expect(page.locator('body')).toHaveClass(/theme-dark/);
  });

  test('Save button calls PUT with the selected themeId', async ({ page }) => {
    let putBody: Record<string, unknown> | null = null;
    await page.route(`**/api/stores/${STORE.id}`, route => {
      if (route.request().method() === 'PUT') {
        putBody = route.request().postDataJSON();
        route.fulfill({ json: { ...STORE, themeId: 2, themeCssClass: 'theme-dark' } });
      } else {
        route.continue();
      }
    });

    await page.getByLabel('Theme').click();
    await page.getByRole('option', { name: 'Dark' }).click();
    await page.getByRole('button', { name: /Save/ }).click();

    expect(putBody).toMatchObject({ themeId: 2 });
  });
});

// ── Logo upload ───────────────────────────────────────────────────────────────

test.describe('Store Detail — logo: placeholder shown when no logo', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'StoreEmployee', { storeId: 1, licenseTier: 'Tier1' });
    await stubUnmatchedApi(page);
    await mockGetStore(page, makeStoreDetailDto({ id: 1, storeName: 'Downtown Game Shop' }));
    await page.goto('/stores/1');
  });

  test('shows placeholder icon when logoUrl is null', async ({ page }) => {
    await expect(page.locator('mat-icon.store-logo-placeholder')).toBeVisible();
  });

  test('Change Logo button is visible for StoreEmployee', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Change Logo/i })).toBeVisible();
  });
});

test.describe('Store Detail — logo: image shown when logoUrl is set', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'StoreEmployee', { storeId: 1 });
    await stubUnmatchedApi(page);
    await mockGetStore(page, makeStoreDetailDto({ id: 1, storeName: 'Downtown Game Shop', logoUrl: '/logos/1.png' }));
    await page.goto('/stores/1');
  });

  test('shows logo <img> when logoUrl is set', async ({ page }) => {
    await expect(page.locator('img.store-logo')).toBeVisible();
  });

  test('placeholder icon is NOT shown when logoUrl is set', async ({ page }) => {
    await expect(page.locator('mat-icon.store-logo-placeholder')).not.toBeVisible();
  });
});

test.describe('Store Detail — logo: upload updates the image', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'StoreEmployee', { storeId: 1, licenseTier: 'Tier1' });
    await stubUnmatchedApi(page);
    await mockGetStore(page, makeStoreDetailDto({ id: 1, storeName: 'Downtown Game Shop' }));
    await mockUploadStoreLogo(page, 1, makeStoreDto({ id: 1, storeName: 'Downtown Game Shop', logoUrl: '/logos/1.png' }));
    await page.goto('/stores/1');
  });

  test('uploading a file calls POST /api/stores/1/logo', async ({ page }) => {
    const uploadRequest = page.waitForRequest(req =>
      req.url().includes('/api/stores/1/logo') && req.method() === 'POST'
    );

    const fileInput = page.locator('input[type="file"][accept=".png,.jpg,.jpeg,.gif"]');
    await fileInput.setInputFiles({
      name: 'logo.png',
      mimeType: 'image/png',
      buffer: Buffer.from('fake-image'),
    });

    await uploadRequest;
  });

  test('Change Logo button is NOT visible for Player role', async ({ page }) => {
    await loginAs(page, 'Player');
    await page.goto('/stores/1');
    await expect(page.getByRole('button', { name: /Change Logo/i })).not.toBeVisible();
  });
});

// ── Discord Webhook ────────────────────────────────────────────────────────────

test.describe('Store Detail — Discord: connected', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'StoreManager', { storeId: 1, licenseTier: 'Tier1' });
    await stubUnmatchedApi(page);
    await mockGetThemes(page, []);
    await mockGetStore(page, makeStoreDetailDto({ id: 1, storeName: 'Downtown Game Shop', hasDiscordWebhook: true }));
    await mockGetEmployees(page, 1, []);
    await page.goto('/stores/1');
  });

  test('Discord webhook URL input is visible', async ({ page }) => {
    await expect(page.getByLabel('Discord Webhook URL')).toBeVisible();
  });

  test('"Connected" indicator shown when hasDiscordWebhook is true', async ({ page }) => {
    await expect(page.getByText('Connected')).toBeVisible();
  });

  test('Test Webhook button is visible when connected', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Test Webhook/ })).toBeVisible();
  });
});

test.describe('Store Detail — Discord: not connected', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'StoreManager', { storeId: 1 });
    await stubUnmatchedApi(page);
    await mockGetThemes(page, []);
    await mockGetStore(page, makeStoreDetailDto({ id: 1, storeName: 'Downtown Game Shop', hasDiscordWebhook: false }));
    await mockGetEmployees(page, 1, []);
    await page.goto('/stores/1');
  });

  test('"Not connected" text is shown when hasDiscordWebhook is false', async ({ page }) => {
    await expect(page.getByText('Not connected')).toBeVisible();
  });

  test('Test Webhook button is NOT visible when not connected', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Test Webhook/ })).not.toBeVisible();
  });
});

test.describe('Store Detail — Discord: URL masked', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'StoreManager', { storeId: 1 });
    await stubUnmatchedApi(page);
    await mockGetThemes(page, []);
    await mockGetStore(page, makeStoreDetailDto({ id: 1, storeName: 'Downtown Game Shop', hasDiscordWebhook: false }));
    await mockGetEmployees(page, 1, []);
    await page.goto('/stores/1');
  });

  test('Discord webhook input has type="password"', async ({ page }) => {
    const input = page.getByLabel('Discord Webhook URL');
    await expect(input).toHaveAttribute('type', 'password');
  });
});

test.describe('Store Detail — Discord: save webhook', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'StoreManager', { storeId: 1, licenseTier: 'Tier1' });
    await stubUnmatchedApi(page);
    await mockGetThemes(page, []);
    await mockGetStore(page, makeStoreDetailDto({ id: 1, storeName: 'Downtown Game Shop', hasDiscordWebhook: false }));
    await mockGetEmployees(page, 1, []);
    await page.goto('/stores/1');
  });

  test('saving form includes discordWebhookUrl in PUT request body', async ({ page }) => {
    let putBody: Record<string, unknown> | null = null;
    await page.route('**/api/stores/1', route => {
      if (route.request().method() === 'PUT') {
        putBody = route.request().postDataJSON();
        route.fulfill({ json: makeStoreDetailDto({ id: 1, hasDiscordWebhook: true }) });
      } else {
        route.continue();
      }
    });

    await page.getByLabel('Discord Webhook URL').fill('https://discord.com/api/webhooks/123/abc');
    await page.getByRole('button', { name: /^Save$/ }).click();

    expect(putBody).toMatchObject({ discordWebhookUrl: 'https://discord.com/api/webhooks/123/abc' });
  });
});

test.describe('Store Detail — Discord: test button', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'StoreManager', { storeId: 1, licenseTier: 'Tier1' });
    await stubUnmatchedApi(page);
    await mockGetThemes(page, []);
    await mockGetStore(page, makeStoreDetailDto({ id: 1, storeName: 'Downtown Game Shop', hasDiscordWebhook: true }));
    await mockGetEmployees(page, 1, []);
    await mockTestDiscordWebhook(page, 1);
    await page.goto('/stores/1');
  });

  test('clicking Test Webhook fires POST .../discord/test and shows snackbar', async ({ page }) => {
    const request = page.waitForRequest(req =>
      req.url().includes('/api/stores/1/discord/test') && req.method() === 'POST'
    );
    await page.getByRole('button', { name: /Test Webhook/ }).click();
    await request;
    await expect(page.getByText(/Test message sent to Discord/)).toBeVisible();
  });
});

test.describe('Store Detail — Discord: hidden for Player', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'Player');
    await stubUnmatchedApi(page);
    await mockGetStore(page, makeStoreDetailDto({ id: 1, storeName: 'Downtown Game Shop', hasDiscordWebhook: true }));
    await page.goto('/stores/1');
  });

  test('Discord webhook input is NOT visible for Player role', async ({ page }) => {
    await expect(page.getByLabel('Discord Webhook URL')).not.toBeVisible();
  });
});

// ── Event Templates tab ───────────────────────────────────────────────────────

const TEMPLATE_1 = makeEventTemplateDto({ id: 1, storeId: 1, name: 'Friday Night Commander', format: 'Commander', maxPlayers: 16, numberOfRounds: 4 });
const TEMPLATE_2 = makeEventTemplateDto({ id: 2, storeId: 1, name: 'Two-Headed Giant',       format: 'THG',       maxPlayers: 8,  numberOfRounds: 3 });

test.describe('Store Detail — Event Templates: list', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'StoreManager', { storeId: 1 });
    await stubUnmatchedApi(page);
    await mockGetThemes(page, []);
    await mockGetEmployees(page, 1, []);
    await mockGetEventTemplates(page, 1, [TEMPLATE_1, TEMPLATE_2]);
    await mockGetStore(page, STORE);
    await page.goto('/stores/1');
    await page.getByRole('tab', { name: 'Templates' }).click();
  });

  test('Templates tab is visible for StoreManager', async ({ page }) => {
    await expect(page.getByRole('tab', { name: 'Templates' })).toBeVisible();
  });

  test('template names are shown', async ({ page }) => {
    await expect(page.getByText('Friday Night Commander')).toBeVisible();
    await expect(page.getByText('Two-Headed Giant')).toBeVisible();
  });

  test('template format and max players are shown', async ({ page }) => {
    await expect(page.getByText('Commander')).toBeVisible();
    await expect(page.getByText('16')).toBeVisible();
  });
});

test.describe('Store Detail — Event Templates: create', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'StoreManager', { storeId: 1 });
    await stubUnmatchedApi(page);
    await mockGetThemes(page, []);
    await mockGetEmployees(page, 1, []);
    await mockGetEventTemplates(page, 1, []);
    await mockCreateEventTemplate(page, 1, TEMPLATE_1);
    await mockGetStore(page, STORE);
    await page.goto('/stores/1');
    await page.getByRole('tab', { name: 'Templates' }).click();
  });

  test('New Template button is visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /New Template/ })).toBeVisible();
  });

  test('clicking New Template shows the form', async ({ page }) => {
    await page.getByRole('button', { name: /New Template/ }).click();
    await expect(page.getByLabel('Template Name')).toBeVisible();
  });

  test('saving a new template calls POST and shows the template', async ({ page }) => {
    await page.getByRole('button', { name: /New Template/ }).click();
    await page.getByLabel('Template Name').fill('Friday Night Commander');
    await page.getByRole('button', { name: /^Save Template$/ }).click();
    await expect(page.getByText(/Friday Night Commander/)).toBeVisible();
  });
});

test.describe('Store Detail — Event Templates: delete', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'StoreManager', { storeId: 1 });
    await stubUnmatchedApi(page);
    await mockGetThemes(page, []);
    await mockGetEmployees(page, 1, []);
    await mockGetEventTemplates(page, 1, [TEMPLATE_1]);
    await mockDeleteEventTemplate(page, 1, 1);
    await mockGetStore(page, STORE);
    await page.goto('/stores/1');
    await page.getByRole('tab', { name: 'Templates' }).click();
  });

  test('Delete button calls DELETE and removes template from list', async ({ page }) => {
    await expect(page.getByText('Friday Night Commander')).toBeVisible();
    await page.getByRole('button', { name: /Delete/ }).first().click();
    await expect(page.getByText('Friday Night Commander')).not.toBeVisible();
  });
});

test.describe('Store Detail — Event Templates: hidden for Player', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'Player');
    await stubUnmatchedApi(page);
    await mockGetStore(page, STORE);
    await page.goto('/stores/1');
  });

  test('Templates tab is NOT visible for Player', async ({ page }) => {
    await expect(page.getByRole('tab', { name: 'Templates' })).not.toBeVisible();
  });
});

// ── Upload Background ──────────────────────────────────────────────────────────

test.describe('Store Detail — Upload Background (StoreManager)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'StoreManager', { storeId: 1 });
    await stubUnmatchedApi(page);
    await mockGetThemes(page, []);
    await mockGetStore(page, STORE);
    await mockGetEmployees(page, 1, EMPLOYEES);
    await page.goto('/stores/1');
  });

  test('"Upload Background" button is visible for StoreManager', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Background/ })).toBeVisible();
  });
});

test.describe('Store Detail — Upload Background (Player)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'Player');
    await stubUnmatchedApi(page);
    await mockGetStore(page, STORE);
    await page.goto('/stores/1');
  });

  test('"Upload Background" button is NOT visible for Player role', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Upload Background/ })).not.toBeVisible();
    await expect(page.getByRole('button', { name: /Change Background/ })).not.toBeVisible();
  });
});

// ── License expiry warning banner ─────────────────────────────────────────────

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 86400000).toISOString();
}

function makeTier1License(overrides: Partial<{ expiresDate: string }> = {}) {
  return {
    id: 1, storeId: 1, appKey: 'key', isActive: true,
    startDate: '2026-01-01T00:00:00Z',
    availableDate: '2026-01-01T00:00:00Z',
    expiresDate: daysFromNow(90),
    tier: 'Tier1' as const,
    ...overrides,
  };
}

test.describe('Store Detail — expiry warning: within 30 days', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'StoreManager', { storeId: 1, licenseTier: 'Tier1' });
    await stubUnmatchedApi(page);
    await mockGetThemes(page, []);
    await mockGetStore(page, makeStoreDetailDto({ id: 1, license: makeTier1License({ expiresDate: daysFromNow(15) }) }));
    await mockGetEmployees(page, 1, []);
    await page.goto('/stores/1');
  });

  test('banner with "expires in 15 days" is visible', async ({ page }) => {
    await expect(page.locator('.expiry-banner')).toBeVisible();
    await expect(page.locator('.expiry-banner')).toContainText('expires in 15 days');
  });

  test('banner does NOT have expiry-critical class', async ({ page }) => {
    await expect(page.locator('.expiry-banner.expiry-critical')).not.toBeVisible();
  });
});

test.describe('Store Detail — expiry warning: critical (≤7 days)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'StoreManager', { storeId: 1, licenseTier: 'Tier1' });
    await stubUnmatchedApi(page);
    await mockGetThemes(page, []);
    await mockGetStore(page, makeStoreDetailDto({ id: 1, license: makeTier1License({ expiresDate: daysFromNow(5) }) }));
    await mockGetEmployees(page, 1, []);
    await page.goto('/stores/1');
  });

  test('banner has expiry-critical class', async ({ page }) => {
    await expect(page.locator('.expiry-banner.expiry-critical')).toBeVisible();
  });
});

test.describe('Store Detail — expiry warning: not shown >30 days', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'StoreManager', { storeId: 1, licenseTier: 'Tier1' });
    await stubUnmatchedApi(page);
    await mockGetThemes(page, []);
    await mockGetStore(page, makeStoreDetailDto({ id: 1, license: makeTier1License({ expiresDate: daysFromNow(45) }) }));
    await mockGetEmployees(page, 1, []);
    await page.goto('/stores/1');
  });

  test('banner NOT visible when expiry is more than 30 days away', async ({ page }) => {
    await expect(page.locator('.expiry-banner')).not.toBeVisible();
  });
});

test.describe('Store Detail — expiry warning: hidden for Player', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'Player');
    await stubUnmatchedApi(page);
    await mockGetStore(page, makeStoreDetailDto({ id: 1, license: makeTier1License({ expiresDate: daysFromNow(10) }) }));
    await page.goto('/stores/1');
  });

  test('banner NOT visible for Player role', async ({ page }) => {
    await expect(page.locator('.expiry-banner')).not.toBeVisible();
  });
});

test.describe('Store Detail — expiry warning: expired', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'StoreManager', { storeId: 1, licenseTier: 'Tier1' });
    await stubUnmatchedApi(page);
    await mockGetThemes(page, []);
    await mockGetStore(page, makeStoreDetailDto({ id: 1, license: makeTier1License({ expiresDate: daysFromNow(-1) }) }));
    await mockGetEmployees(page, 1, []);
    await page.goto('/stores/1');
  });

  test('"Your license has expired" text is visible', async ({ page }) => {
    await expect(page.locator('.expiry-banner')).toBeVisible();
    await expect(page.locator('.expiry-banner')).toContainText('Your license has expired');
  });
});

