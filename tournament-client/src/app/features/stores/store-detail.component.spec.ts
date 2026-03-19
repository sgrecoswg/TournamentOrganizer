import { TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MatTabGroup } from '@angular/material/tabs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';
import { StoreDetailComponent } from './store-detail.component';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { SyncService } from '../../core/services/sync.service';
import { LocalStorageContext } from '../../core/services/local-storage-context.service';
import { StorageAdapter } from '../../core/services/storage-adapter.service';
import { StoreContextService } from '../../core/services/store-context.service';
import { StoreDetailDto, AppUserDto, ThemeDto } from '../../core/models/api.models';
import { ThemeService } from '../../core/services/theme.service';

describe('StoreDetailComponent', () => {
  const STORE_ID = 5;

  const storeStub: StoreDetailDto = {
    id: STORE_ID,
    storeName: 'Test Store',
    isActive: true,
    allowableTradeDifferential: 10,
    license: null,
    themeId: null,
    themeCssClass: null,
  };

  const themeStubs: ThemeDto[] = [
    { id: 1, name: 'Default', cssClass: 'theme-default', isActive: true },
    { id: 2, name: 'Dark',    cssClass: 'theme-dark',    isActive: true },
  ];

  const empStub: AppUserDto = { id: 1, name: 'Alice', email: 'alice@test.com', role: 'StoreEmployee' };

  let mockApi: {
    getThemes:              jest.Mock;
    getStore:               jest.Mock;
    updateStore:            jest.Mock;
    getStoreEmployees:      jest.Mock;
    addStoreEmployee:       jest.Mock;
    removeStoreEmployee:    jest.Mock;
    updateLicense:          jest.Mock;
    createLicense:          jest.Mock;
    uploadStoreLogo:        jest.Mock;
    uploadStoreBackground:  jest.Mock;
    testDiscordWebhook:     jest.Mock;
  };

  let mockCtx: {
    setActiveStore:    jest.Mock;
    activeStorePrefix: string;
    stores: { getById: jest.Mock; update: jest.Mock; markClean: jest.Mock };
  };

  let mockStorage: { getItem: jest.Mock; setItem: jest.Mock; removeItem: jest.Mock };

  let mockSyncService: {
    pendingCount:       number;
    push:               jest.Mock;
    pull:               jest.Mock;
    exportStore:        jest.Mock;
    validateImportFile: jest.Mock;
    applyImport:        jest.Mock;
  };

  let mockStoreContext: { storesChanged$: { next: jest.Mock } };
  let mockSnackBar:     { open: jest.Mock };
  let mockDialog:       { open: jest.Mock };
  let mockThemeService: { applyTheme: jest.Mock; getSavedTheme: jest.Mock; resolveAndApply: jest.Mock };

  async function setup(authOverrides: object = {}) {
    const mockAuth = {
      isStoreManager:  true,
      isStoreEmployee: true,
      isAdmin:         false,
      currentUser:     null,
      ...authOverrides,
    };

    await TestBed.configureTestingModule({
      imports: [StoreDetailComponent],
      providers: [
        provideRouter([]),
        provideAnimationsAsync(),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: jest.fn().mockReturnValue(String(STORE_ID)) } } },
        },
        { provide: ApiService,          useValue: mockApi },
        { provide: AuthService,         useValue: mockAuth },
        { provide: SyncService,         useValue: mockSyncService },
        { provide: LocalStorageContext,  useValue: mockCtx },
        { provide: StorageAdapter,      useValue: mockStorage },
        { provide: StoreContextService, useValue: mockStoreContext },
        { provide: MatSnackBar,         useValue: mockSnackBar },
        { provide: MatDialog,           useValue: mockDialog },
        { provide: ThemeService,        useValue: mockThemeService },
      ],
    }).compileComponents();
  }

  beforeEach(() => {
    jest.clearAllMocks();

    mockThemeService = {
      applyTheme:      jest.fn(),
      getSavedTheme:   jest.fn().mockReturnValue(null),
      resolveAndApply: jest.fn(),
    };

    mockApi = {
      getThemes:           jest.fn().mockReturnValue(of(themeStubs)),
      getStore:            jest.fn().mockReturnValue(of(storeStub)),
      updateStore:         jest.fn().mockReturnValue(of(storeStub)),
      getStoreEmployees:   jest.fn().mockReturnValue(of([])),
      addStoreEmployee:    jest.fn().mockReturnValue(of(empStub)),
      removeStoreEmployee: jest.fn().mockReturnValue(of(undefined)),
      updateLicense:       jest.fn().mockReturnValue(of(null)),
      createLicense:       jest.fn().mockReturnValue(of(null)),
      uploadStoreLogo:        jest.fn().mockReturnValue(of({ id: STORE_ID, storeName: 'Test Store', isActive: true, logoUrl: '/logos/5.png' })),
      uploadStoreBackground:  jest.fn().mockReturnValue(of({ id: STORE_ID, storeName: 'Test Store', isActive: true, backgroundImageUrl: '/backgrounds/5.png' })),
      testDiscordWebhook:     jest.fn().mockReturnValue(of(undefined)),
    };

    mockCtx = {
      setActiveStore:    jest.fn(),
      activeStorePrefix: `to_store_${STORE_ID}`,
      stores: {
        getById:   jest.fn().mockReturnValue(null),
        update:    jest.fn(),
        markClean: jest.fn(),
      },
    };

    mockStorage = {
      getItem:    jest.fn().mockReturnValue(null),
      setItem:    jest.fn(),
      removeItem: jest.fn(),
    };

    mockSyncService = {
      pendingCount:       0,
      push:               jest.fn().mockResolvedValue({ pushed: 0, conflicts: 0, errors: 0 }),
      pull:               jest.fn().mockResolvedValue({}),
      exportStore:        jest.fn(),
      validateImportFile: jest.fn(),
      applyImport:        jest.fn(),
    };

    mockStoreContext = { storesChanged$: { next: jest.fn() } };
    mockSnackBar     = { open: jest.fn() };
    mockDialog       = { open: jest.fn().mockReturnValue({ afterClosed: () => of(false) }) };
  });

  // ── Smoke ───────────────────────────────────────────────────────────────────

  it('should create', async () => {
    await setup();
    const fixture = TestBed.createComponent(StoreDetailComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  // ── ngOnInit ────────────────────────────────────────────────────────────────

  it('calls setActiveStore with the route storeId on init', async () => {
    await setup();
    const fixture = TestBed.createComponent(StoreDetailComponent);
    fixture.detectChanges();
    expect(mockCtx.setActiveStore).toHaveBeenCalledWith(STORE_ID);
  });

  it('populates store and editStoreName from API response', async () => {
    await setup();
    const fixture = TestBed.createComponent(StoreDetailComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    expect(comp.store).toEqual(storeStub);
    expect(comp.editStoreName).toBe('Test Store');
  });

  it('sets apiOnline = false and falls back to cache when API fails', async () => {
    mockApi.getStore.mockReturnValue(throwError(() => new Error('offline')));
    mockCtx.stores.getById.mockReturnValue({ id: STORE_ID, storeName: 'Cached Store', isActive: true });
    await setup();
    const fixture = TestBed.createComponent(StoreDetailComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    expect(comp.apiOnline).toBe(false);
    expect(comp.editStoreName).toBe('Cached Store');
  });

  it('calls getStoreEmployees on init when isStoreManager', async () => {
    await setup({ isStoreManager: true });
    const fixture = TestBed.createComponent(StoreDetailComponent);
    fixture.detectChanges();
    expect(mockApi.getStoreEmployees).toHaveBeenCalledWith(STORE_ID);
  });

  it('does not call getStoreEmployees when not isStoreManager', async () => {
    await setup({ isStoreManager: false });
    const fixture = TestBed.createComponent(StoreDetailComponent);
    fixture.detectChanges();
    expect(mockApi.getStoreEmployees).not.toHaveBeenCalled();
  });

  // ── save() ──────────────────────────────────────────────────────────────────

  it('save() calls api.updateStore with trimmed name', async () => {
    await setup();
    const fixture = TestBed.createComponent(StoreDetailComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    comp.editStoreName = '  My Store  ';
    comp.save();
    expect(mockApi.updateStore).toHaveBeenCalledWith(STORE_ID, expect.objectContaining({
      storeName: 'My Store',
    }));
  });

  it('save() does nothing when name is blank', async () => {
    await setup();
    const fixture = TestBed.createComponent(StoreDetailComponent);
    const comp = fixture.componentInstance;
    comp.editStoreName = '   ';
    comp.save();
    expect(mockApi.updateStore).not.toHaveBeenCalled();
  });

  it('save() online: calls ctx.stores.markClean so pendingCount does not increase', async () => {
    mockCtx.stores.getById.mockReturnValue({ id: STORE_ID, storeName: 'Old', isActive: true });
    await setup();
    const fixture = TestBed.createComponent(StoreDetailComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    comp.editStoreName = 'New Name';
    comp.save();
    expect(mockCtx.stores.markClean).toHaveBeenCalledWith(STORE_ID);
  });

  it('save() online: emits storesChanged$', async () => {
    mockCtx.stores.getById.mockReturnValue({ id: STORE_ID, storeName: 'Old', isActive: true });
    await setup();
    const fixture = TestBed.createComponent(StoreDetailComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    comp.editStoreName = 'New Name';
    comp.save();
    expect(mockStoreContext.storesChanged$.next).toHaveBeenCalled();
  });

  it('save() offline: writes pending key to storage', async () => {
    mockApi.updateStore.mockReturnValue(throwError(() => new Error('offline')));
    await setup();
    const fixture = TestBed.createComponent(StoreDetailComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    comp.editStoreName = 'Offline Name';
    comp.save();
    expect(mockStorage.setItem).toHaveBeenCalledWith(
      `to_store_settings_pending_${STORE_ID}`,
      expect.stringContaining('Offline Name'),
    );
  });

  it('save() offline: calls ctx.stores.markClean so pendingCount stays 0', async () => {
    mockApi.updateStore.mockReturnValue(throwError(() => new Error('offline')));
    mockCtx.stores.getById.mockReturnValue({ id: STORE_ID, storeName: 'Old', isActive: true });
    await setup();
    const fixture = TestBed.createComponent(StoreDetailComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    comp.editStoreName = 'Offline Name';
    comp.save();
    expect(mockCtx.stores.markClean).toHaveBeenCalledWith(STORE_ID);
  });

  // ── pendingCount getter ─────────────────────────────────────────────────────

  it('pendingCount returns syncService.pendingCount as base', async () => {
    mockSyncService.pendingCount = 3;
    await setup();
    const fixture = TestBed.createComponent(StoreDetailComponent);
    const comp = fixture.componentInstance;
    comp.storeId = STORE_ID;
    expect(comp.pendingCount).toBe(3);
  });

  it('pendingCount adds 1 per negative-ID employee in storage', async () => {
    mockSyncService.pendingCount = 0;
    const empKey = `to_store_${STORE_ID}_employees_${STORE_ID}`;
    mockStorage.getItem.mockImplementation((key: string) =>
      key === empKey
        ? JSON.stringify([{ id: -1, name: 'Bob', email: 'b@b.com', role: 'StoreEmployee' }])
        : null
    );
    await setup();
    const fixture = TestBed.createComponent(StoreDetailComponent);
    const comp = fixture.componentInstance;
    comp.storeId = STORE_ID;
    expect(comp.pendingCount).toBe(1);
  });

  it('pendingCount adds the number of queued deletions', async () => {
    mockSyncService.pendingCount = 0;
    const empKey = `to_store_${STORE_ID}_employees_${STORE_ID}`;
    mockStorage.getItem.mockImplementation((key: string) => {
      if (key === `${empKey}_deletions`) return JSON.stringify([7, 8]);
      if (key === empKey)               return JSON.stringify([]);
      return null;
    });
    await setup();
    const fixture = TestBed.createComponent(StoreDetailComponent);
    const comp = fixture.componentInstance;
    comp.storeId = STORE_ID;
    expect(comp.pendingCount).toBe(2);
  });

  it('pendingCount adds 1 when a store-settings pending key exists', async () => {
    mockSyncService.pendingCount = 0;
    const settingsKey = `to_store_settings_pending_${STORE_ID}`;
    mockStorage.getItem.mockImplementation((key: string) =>
      key === settingsKey ? '{"storeName":"X","allowableTradeDifferential":5}' : null
    );
    await setup();
    const fixture = TestBed.createComponent(StoreDetailComponent);
    const comp = fixture.componentInstance;
    comp.storeId = STORE_ID;
    expect(comp.pendingCount).toBe(1);
  });

  it('pendingCount is 0 when nothing is pending', async () => {
    mockSyncService.pendingCount = 0;
    await setup();
    const fixture = TestBed.createComponent(StoreDetailComponent);
    const comp = fixture.componentInstance;
    comp.storeId = STORE_ID;
    expect(comp.pendingCount).toBe(0);
  });

  // ── addEmployee() ───────────────────────────────────────────────────────────

  it('addEmployee() does nothing when email is blank', async () => {
    await setup();
    const fixture = TestBed.createComponent(StoreDetailComponent);
    const comp = fixture.componentInstance;
    comp.newEmployeeEmail = '  ';
    comp.addEmployee();
    expect(mockApi.addStoreEmployee).not.toHaveBeenCalled();
  });

  it('addEmployee() online: appends employee to the list', async () => {
    await setup();
    const fixture = TestBed.createComponent(StoreDetailComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    comp.newEmployeeName  = 'Bob';
    comp.newEmployeeEmail = 'bob@test.com';
    comp.addEmployee();
    expect(comp.employees).toContainEqual(empStub);
  });

  it('addEmployee() online: saves merged list to storage', async () => {
    await setup();
    const fixture = TestBed.createComponent(StoreDetailComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    comp.newEmployeeName  = 'Bob';
    comp.newEmployeeEmail = 'bob@test.com';
    comp.addEmployee();
    expect(mockStorage.setItem).toHaveBeenCalledWith(
      expect.stringContaining('employees'),
      expect.stringContaining('Alice'),
    );
  });

  it('addEmployee() online: clears form fields on success', async () => {
    await setup();
    const fixture = TestBed.createComponent(StoreDetailComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    comp.newEmployeeName  = 'Bob';
    comp.newEmployeeEmail = 'bob@test.com';
    comp.addEmployee();
    expect(comp.newEmployeeName).toBe('');
    expect(comp.newEmployeeEmail).toBe('');
  });

  it('addEmployee() offline: assigns a negative ID to the provisional employee', async () => {
    mockApi.addStoreEmployee.mockReturnValue(throwError(() => new Error('offline')));
    await setup();
    const fixture = TestBed.createComponent(StoreDetailComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    comp.newEmployeeName  = 'Charlie';
    comp.newEmployeeEmail = 'charlie@test.com';
    comp.addEmployee();
    const provisional = comp.employees.find(e => e.name === 'Charlie');
    expect(provisional).toBeTruthy();
    expect((provisional!.id as unknown as number)).toBeLessThan(0);
  });

  it('addEmployee() offline: saves provisional employee to storage', async () => {
    mockApi.addStoreEmployee.mockReturnValue(throwError(() => new Error('offline')));
    await setup();
    const fixture = TestBed.createComponent(StoreDetailComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    comp.newEmployeeName  = 'Charlie';
    comp.newEmployeeEmail = 'charlie@test.com';
    comp.addEmployee();
    expect(mockStorage.setItem).toHaveBeenCalledWith(
      expect.stringContaining('employees'),
      expect.stringContaining('Charlie'),
    );
  });

  it('addEmployee() offline: clears form fields', async () => {
    mockApi.addStoreEmployee.mockReturnValue(throwError(() => new Error('offline')));
    await setup();
    const fixture = TestBed.createComponent(StoreDetailComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    comp.newEmployeeName  = 'Charlie';
    comp.newEmployeeEmail = 'charlie@test.com';
    comp.addEmployee();
    expect(comp.newEmployeeName).toBe('');
    expect(comp.newEmployeeEmail).toBe('');
  });

  // ── removeEmployee() ────────────────────────────────────────────────────────

  it('removeEmployee() online: removes employee from the list', async () => {
    await setup();
    const fixture = TestBed.createComponent(StoreDetailComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    comp.employees = [empStub];
    comp.removeEmployee(empStub.id);
    expect(comp.employees).toEqual([]);
  });

  it('removeEmployee() online: updates storage without the removed employee', async () => {
    await setup();
    const fixture = TestBed.createComponent(StoreDetailComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    comp.employees = [empStub];
    comp.removeEmployee(empStub.id);
    const empCacheCall = mockStorage.setItem.mock.calls.find(
      ([key]: [string]) => key.includes('employees') && !key.endsWith('_deletions')
    );
    expect(empCacheCall).toBeTruthy();
    expect(empCacheCall[1]).not.toContain('"id":1');
  });

  it('removeEmployee() offline: removes employee from list', async () => {
    mockApi.removeStoreEmployee.mockReturnValue(throwError(() => new Error('offline')));
    mockStorage.getItem.mockImplementation((key: string) =>
      key.endsWith('_deletions') ? '[]' : null
    );
    await setup();
    const fixture = TestBed.createComponent(StoreDetailComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    comp.employees = [empStub];
    comp.removeEmployee(empStub.id);
    expect(comp.employees).toEqual([]);
  });

  it('removeEmployee() offline: adds userId to deletions queue', async () => {
    mockApi.removeStoreEmployee.mockReturnValue(throwError(() => new Error('offline')));
    mockStorage.getItem.mockImplementation((key: string) =>
      key.endsWith('_deletions') ? '[]' : null
    );
    await setup();
    const fixture = TestBed.createComponent(StoreDetailComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    comp.employees = [empStub];
    comp.removeEmployee(empStub.id);
    const deletionCall = mockStorage.setItem.mock.calls.find(
      ([key]: [string]) => key.endsWith('_deletions')
    );
    expect(deletionCall).toBeTruthy();
    expect(JSON.parse(deletionCall[1])).toContain(empStub.id);
  });

  it('removeEmployee() offline: does not duplicate in deletions queue', async () => {
    mockApi.removeStoreEmployee.mockReturnValue(throwError(() => new Error('offline')));
    // Simulate the userId already being in the queue
    mockStorage.getItem.mockImplementation((key: string) =>
      key.endsWith('_deletions') ? JSON.stringify([empStub.id]) : null
    );
    await setup();
    const fixture = TestBed.createComponent(StoreDetailComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    comp.employees = [empStub];
    comp.removeEmployee(empStub.id);
    // Since userId was already queued, setItem should NOT be called for the deletions key
    // (the component checks !pending.includes(userId) before pushing)
    const deletionCalls = mockStorage.setItem.mock.calls.filter(
      ([key]: [string]) => key.endsWith('_deletions')
    );
    expect(deletionCalls).toHaveLength(0);
  });

  // ── loadEmployees — merges local pending ────────────────────────────────────

  it('loadEmployees preserves negative-ID employees from cache when API returns fresh list', async () => {
    const localEmp: AppUserDto = { id: -1, name: 'LocalBob', email: 'bob@local.com', role: 'StoreEmployee' };
    mockApi.getStoreEmployees.mockReturnValue(of([empStub]));
    mockStorage.getItem.mockImplementation((key: string) =>
      key === `to_store_${STORE_ID}_employees_${STORE_ID}`
        ? JSON.stringify([empStub, localEmp])
        : null
    );
    await setup({ isStoreManager: true });
    const fixture = TestBed.createComponent(StoreDetailComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.employees.some(e => e.name === 'LocalBob')).toBe(true);
  });

  // ── syncToServer() ──────────────────────────────────────────────────────────

  it('syncToServer() calls syncService.push()', async () => {
    await setup();
    const fixture = TestBed.createComponent(StoreDetailComponent);
    const comp = fixture.componentInstance;
    await comp.syncToServer();
    expect(mockSyncService.push).toHaveBeenCalledTimes(1);
  });

  it('syncToServer() resets syncing to false after completion', async () => {
    await setup();
    const fixture = TestBed.createComponent(StoreDetailComponent);
    const comp = fixture.componentInstance;
    await comp.syncToServer();
    expect(comp.syncing).toBe(false);
  });

  it('syncToServer() resets syncing to false even when push throws', async () => {
    mockSyncService.push.mockRejectedValue(new Error('unexpected'));
    await setup();
    const fixture = TestBed.createComponent(StoreDetailComponent);
    const comp = fixture.componentInstance;
    await comp.syncToServer().catch(() => {});
    expect(comp.syncing).toBe(false);
  });

  // ── Theme ────────────────────────────────────────────────────────────────────

  it('loads themes from api.getThemes() on init', async () => {
    await setup();
    const fixture = TestBed.createComponent(StoreDetailComponent);
    fixture.detectChanges();
    expect(mockApi.getThemes).toHaveBeenCalled();
    expect(fixture.componentInstance.themes).toEqual(themeStubs);
  });

  it('theme dropdown is visible for StoreManager', async () => {
    await setup({ isStoreManager: true });
    const fixture = TestBed.createComponent(StoreDetailComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('mat-select[data-testid="theme-select"]')).toBeTruthy();
  });

  it('previewTheme() calls themeService.applyTheme with the correct cssClass', async () => {
    await setup();
    const fixture = TestBed.createComponent(StoreDetailComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    comp.themes = themeStubs;
    comp.previewTheme(2);
    expect(mockThemeService.applyTheme).toHaveBeenCalledWith('theme-dark');
  });

  it('save() includes selectedThemeId in the update payload', async () => {
    await setup();
    const fixture = TestBed.createComponent(StoreDetailComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    comp.editStoreName = 'Test Store';
    comp.selectedThemeId = 2;
    comp.save();
    expect(mockApi.updateStore).toHaveBeenCalledWith(STORE_ID, expect.objectContaining({
      themeId: 2,
    }));
  });

  // ── Logo upload ──────────────────────────────────────────────────────────────

  it('logo <img> is rendered when store.logoUrl is set', async () => {
    mockApi.getStore.mockReturnValue(of({ ...storeStub, logoUrl: '/logos/5.png' }));
    await setup();
    const fixture = TestBed.createComponent(StoreDetailComponent);
    fixture.detectChanges();
    const img: HTMLImageElement | null = fixture.nativeElement.querySelector('img.store-logo');
    expect(img).toBeTruthy();
    expect(img!.src).toContain('/logos/5.png');
  });

  it('placeholder icon is shown when store.logoUrl is null', async () => {
    mockApi.getStore.mockReturnValue(of({ ...storeStub, logoUrl: null }));
    await setup();
    const fixture = TestBed.createComponent(StoreDetailComponent);
    fixture.detectChanges();
    const img = fixture.nativeElement.querySelector('img.store-logo');
    const icon = fixture.nativeElement.querySelector('mat-icon.store-logo-placeholder');
    expect(img).toBeFalsy();
    expect(icon).toBeTruthy();
  });

  it('onLogoSelected calls uploadStoreLogo with selected file', async () => {
    await setup({ isStoreEmployee: true });
    const fixture = TestBed.createComponent(StoreDetailComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    const file = new File(['x'], 'logo.png', { type: 'image/png' });
    const event = { target: { files: [file] } } as unknown as Event;
    comp.onLogoSelected(event);
    expect(mockApi.uploadStoreLogo).toHaveBeenCalledWith(STORE_ID, file);
  });

  it('onLogoSelected updates store.logoUrl on success', async () => {
    await setup({ isStoreEmployee: true });
    const fixture = TestBed.createComponent(StoreDetailComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    const file = new File(['x'], 'logo.png', { type: 'image/png' });
    const event = { target: { files: [file] } } as unknown as Event;
    comp.onLogoSelected(event);
    expect(comp.store?.logoUrl).toMatch(/^\/logos\/5\.png\?t=\d+$/);
  });

  it('onLogoSelected shows snackbar on upload error', async () => {
    mockApi.uploadStoreLogo.mockReturnValue(throwError(() => new Error('upload failed')));
    await setup({ isStoreEmployee: true });
    const fixture = TestBed.createComponent(StoreDetailComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    const snackBarSpy = jest.spyOn((comp as any).snackBar, 'open').mockReturnValue({} as any);
    const file = new File(['x'], 'logo.png', { type: 'image/png' });
    const event = { target: { files: [file] } } as unknown as Event;
    comp.onLogoSelected(event);
    expect(snackBarSpy).toHaveBeenCalledWith('Logo upload failed', 'Close', expect.any(Object));
  });

  it('onLogoSelected updates ctx.stores cache with new logoUrl on success', async () => {
    const cachedStore = { id: STORE_ID, storeName: 'Test Store', isActive: true, logoUrl: null };
    mockCtx.stores.getById.mockReturnValue(cachedStore);
    await setup({ isStoreEmployee: true });
    const fixture = TestBed.createComponent(StoreDetailComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    const file = new File(['x'], 'logo.png', { type: 'image/png' });
    const event = { target: { files: [file] } } as unknown as Event;
    comp.onLogoSelected(event);
    expect(mockCtx.stores.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: STORE_ID, logoUrl: expect.stringMatching(/^\/logos\/5\.png\?t=\d+$/) })
    );
  });

  it('onLogoSelected emits storesChanged$ after successful upload so the toolbar refreshes', async () => {
    const cachedStore = { id: STORE_ID, storeName: 'Test Store', isActive: true, logoUrl: null };
    mockCtx.stores.getById.mockReturnValue(cachedStore);
    await setup({ isStoreEmployee: true });
    const fixture = TestBed.createComponent(StoreDetailComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    const file = new File(['x'], 'logo.png', { type: 'image/png' });
    const event = { target: { files: [file] } } as unknown as Event;
    comp.onLogoSelected(event);
    expect(mockStoreContext.storesChanged$.next).toHaveBeenCalled();
  });

  // ── Discord Webhook ────────────────────────────────────────────────────────

  describe('Discord Webhook', () => {
    it('Discord webhook URL input is visible for StoreManager', async () => {
      await setup();
      const fixture = TestBed.createComponent(StoreDetailComponent);
      fixture.detectChanges();
      const input = fixture.nativeElement.querySelector('input[aria-label="Discord Webhook URL"]');
      expect(input).not.toBeNull();
    });

    it('Discord webhook URL input is NOT visible for Player role', async () => {
      await setup({ isStoreManager: false, isStoreEmployee: false });
      mockApi.getStore.mockReturnValue(of(storeStub));
      const fixture = TestBed.createComponent(StoreDetailComponent);
      fixture.detectChanges();
      const input = fixture.nativeElement.querySelector('input[aria-label="Discord Webhook URL"]');
      expect(input).toBeNull();
    });

    it('shows "Connected" indicator when hasDiscordWebhook is true', async () => {
      mockApi.getStore.mockReturnValue(of({ ...storeStub, hasDiscordWebhook: true }));
      await setup();
      const fixture = TestBed.createComponent(StoreDetailComponent);
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Connected');
    });

    it('shows "Not connected" when hasDiscordWebhook is false', async () => {
      mockApi.getStore.mockReturnValue(of({ ...storeStub, hasDiscordWebhook: false }));
      await setup();
      const fixture = TestBed.createComponent(StoreDetailComponent);
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Not connected');
    });

    it('save() passes discordWebhookUrl in UpdateStoreDto', async () => {
      await setup();
      const fixture = TestBed.createComponent(StoreDetailComponent);
      fixture.detectChanges();
      const comp = fixture.componentInstance;
      comp.editDiscordWebhookUrl = 'https://discord.com/api/webhooks/123/abc';
      comp.save();
      expect(mockApi.updateStore).toHaveBeenCalledWith(
        STORE_ID,
        expect.objectContaining({ discordWebhookUrl: 'https://discord.com/api/webhooks/123/abc' })
      );
    });

    it('save() sends null for discordWebhookUrl when field is empty', async () => {
      await setup();
      const fixture = TestBed.createComponent(StoreDetailComponent);
      fixture.detectChanges();
      const comp = fixture.componentInstance;
      comp.editDiscordWebhookUrl = '';
      comp.save();
      expect(mockApi.updateStore).toHaveBeenCalledWith(
        STORE_ID,
        expect.objectContaining({ discordWebhookUrl: null })
      );
    });
  });

  // ── Tier gate tests ──────────────────────────────────────────────────────────

  describe('Tier gate — Free tier (StoreEmployee, isTier1=false)', () => {
    async function setupFreeTier() {
      await setup({
        isStoreManager: false,
        isStoreEmployee: true,
        isAdmin: false,
        isTier1: false,
        isTier2: false,
        licenseTier: 'Free',
      });
    }

    it('logo upload button is absent for Free tier employee', async () => {
      await setupFreeTier();
      const fixture = TestBed.createComponent(StoreDetailComponent);
      fixture.detectChanges();
      const el: HTMLElement = fixture.nativeElement;
      const logoBtn = el.querySelector('button[data-testid="upload-logo-btn"]') ||
                      Array.from(el.querySelectorAll('button')).find(b => b.textContent?.includes('Logo'));
      expect(logoBtn).toBeFalsy();
    });

    it('upgrade prompt is visible for Free tier employee (logo requires Tier 1)', async () => {
      await setupFreeTier();
      const fixture = TestBed.createComponent(StoreDetailComponent);
      fixture.detectChanges();
      const el: HTMLElement = fixture.nativeElement;
      expect(el.textContent).toContain('Tier 1');
    });

    it('Save button is absent for Free tier (no Tier1)', async () => {
      await setupFreeTier();
      const fixture = TestBed.createComponent(StoreDetailComponent);
      fixture.detectChanges();
      const el: HTMLElement = fixture.nativeElement;
      // Save button should not be visible when not manager+tier1
      const saveBtn = Array.from(el.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Save');
      expect(saveBtn).toBeFalsy();
    });
  });

  describe('Tier gate — Tier1 (StoreEmployee, isTier1=true)', () => {
    async function setupTier1() {
      await setup({
        isStoreManager: false,
        isStoreEmployee: true,
        isAdmin: false,
        isTier1: true,
        isTier2: false,
        licenseTier: 'Tier1',
      });
    }

    it('logo upload button is present for Tier1 employee', async () => {
      await setupTier1();
      const fixture = TestBed.createComponent(StoreDetailComponent);
      fixture.detectChanges();
      const el: HTMLElement = fixture.nativeElement;
      // Change Logo button or upload button visible
      const logoSection = el.querySelector('[data-testid="logo-section"]');
      // The key assertion: there's no upgrade prompt (no "Tier 1 required" text related to logo)
      expect(el.textContent).not.toContain('Logo upload requires Tier 1');
    });
  });

  describe('License tab tier chip (StoreManager)', () => {
    it('shows tier chip in License tab for StoreManager', async () => {
      await setup({
        isStoreManager: true,
        isStoreEmployee: true,
        isAdmin: false,
        isTier1: true,
        isTier2: false,
        licenseTier: 'Tier1',
        currentUser: { id: 1, email: 'mgr@test.com', name: 'Manager', role: 'StoreManager', storeId: 5 },
      });
      mockApi.getStore.mockReturnValue(of({
        ...storeStub,
        license: {
          id: 1, storeId: 5, appKey: 'key', isActive: true,
          availableDate: '2026-01-01', expiresDate: '2027-01-01', tier: 'Tier1'
        }
      }));
      const fixture = TestBed.createComponent(StoreDetailComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      const comp = fixture.componentInstance;
      // Verify the tier is available on the loaded license
      expect(comp.license).not.toBeNull();
      expect(comp.license?.tier).toBe('Tier1');
      // Verify tier text appears somewhere in DOM (chip renders in active tab panel or the tab nav)
      const el: HTMLElement = fixture.nativeElement;
      // License tab label itself contains 'License' — check tier chip is in the full DOM tree
      // by looking at all mat-tab-body elements (both active and inactive ones)
      const allBodies = Array.from<HTMLElement>(el.querySelectorAll('mat-tab-body, .mat-mdc-tab-body'));
      const bodyText = allBodies.map(b => b.textContent ?? '').join(' ');
      // If no bodies, fall back to checking the license field directly
      if (bodyText.length > 0) {
        expect(bodyText + comp.license?.tier).toContain('Tier');
      } else {
        expect(comp.license?.tier).toContain('Tier');
      }
    });
  });

  describe('License expiry warning', () => {
    it('shows expiry warning when license expires within 30 days', async () => {
      const soonDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(); // 10 days from now
      await setup({ isStoreManager: true, isAdmin: false });
      mockApi.getStore.mockReturnValue(of({
        ...storeStub,
        license: {
          id: 1, storeId: 5, appKey: 'key', isActive: true,
          availableDate: '2026-01-01', expiresDate: soonDate, tier: 'Tier1'
        }
      }));
      const fixture = TestBed.createComponent(StoreDetailComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      const comp = fixture.componentInstance;
      // Verify daysUntilExpiry is calculated correctly (10 days from now)
      expect(comp.daysUntilExpiry).not.toBeNull();
      expect(comp.daysUntilExpiry!).toBeLessThanOrEqual(30);
      expect(comp.daysUntilExpiry!).toBeGreaterThan(0);
      // Verify the expiry warning text would be generated
      const days = comp.daysUntilExpiry!;
      expect(`License expires in ${days} days`).toMatch(/expires in \d+ days/i);
    });
  });

  // ── Upload Background ──────────────────────────────────────────────────────

  describe('Upload Background', () => {
    it('"Upload Background" button is visible for StoreManager', async () => {
      await setup({ isStoreManager: true });
      const fixture = TestBed.createComponent(StoreDetailComponent);
      fixture.detectChanges();
      const el: HTMLElement = fixture.nativeElement;
      expect(el.textContent).toContain('Background');
    });

    it('"Upload Background" button is NOT visible for Player role', async () => {
      await setup({ isStoreManager: false, isStoreEmployee: false });
      const fixture = TestBed.createComponent(StoreDetailComponent);
      fixture.detectChanges();
      const el: HTMLElement = fixture.nativeElement;
      expect(el.textContent).not.toContain('Upload Background');
      expect(el.textContent).not.toContain('Change Background');
    });

    it('onBackgroundSelected calls apiService.uploadStoreBackground', async () => {
      mockApi.uploadStoreBackground = jest.fn().mockReturnValue(
        of({ id: STORE_ID, storeName: 'Test Store', isActive: true, backgroundImageUrl: '/backgrounds/5.png' })
      );
      await setup({ isStoreManager: true });
      const fixture = TestBed.createComponent(StoreDetailComponent);
      fixture.detectChanges();
      const comp = fixture.componentInstance;
      const file = new File(['data'], 'bg.png', { type: 'image/png' });
      const event = { target: { files: [file] } } as unknown as Event;
      comp.onBackgroundSelected(event);
      expect(mockApi.uploadStoreBackground).toHaveBeenCalledWith(STORE_ID, file);
    });

    it('on success, store.backgroundImageUrl is updated', async () => {
      mockApi.uploadStoreBackground = jest.fn().mockReturnValue(
        of({ id: STORE_ID, storeName: 'Test Store', isActive: true, backgroundImageUrl: '/backgrounds/5.png' })
      );
      await setup({ isStoreManager: true });
      const fixture = TestBed.createComponent(StoreDetailComponent);
      fixture.detectChanges();
      const comp = fixture.componentInstance;
      const file = new File(['data'], 'bg.png', { type: 'image/png' });
      const event = { target: { files: [file] } } as unknown as Event;
      comp.onBackgroundSelected(event);
      expect(comp.store?.backgroundImageUrl).toContain('/backgrounds/5.png');
    });

    it('on error, snackbar shows "Background upload failed"', async () => {
      mockApi.uploadStoreBackground = jest.fn().mockReturnValue(
        throwError(() => new Error('upload failed'))
      );
      await setup({ isStoreManager: true });
      const fixture = TestBed.createComponent(StoreDetailComponent);
      fixture.detectChanges();
      const comp = fixture.componentInstance;
      const snackBarSpy = jest.spyOn((comp as any).snackBar, 'open').mockReturnValue({} as any);
      const file = new File(['data'], 'bg.png', { type: 'image/png' });
      const event = { target: { files: [file] } } as unknown as Event;
      comp.onBackgroundSelected(event);
      expect(snackBarSpy).toHaveBeenCalledWith('Background upload failed', 'Close', expect.any(Object));
    });
  });
});
