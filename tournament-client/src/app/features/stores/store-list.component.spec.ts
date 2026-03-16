import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of, throwError } from 'rxjs';
import { StoreListComponent } from './store-list.component';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { LocalStorageContext } from '../../core/services/local-storage-context.service';
import { StoreDto } from '../../core/models/api.models';

describe('StoreListComponent', () => {
  const storeStub: StoreDto = { id: 1, storeName: 'Downtown Shop', isActive: true };

  const mockApi = {
    getStores:   jest.fn().mockReturnValue(of([])),
    createStore: jest.fn().mockReturnValue(of(storeStub)),
  };

  const mockAuth = {
    isAdmin: false,
    currentUser: null,
  };

  const mockCtx = {
    stores: {
      getAll: jest.fn().mockReturnValue([]),
      seed:   jest.fn(),
    },
  };

  const mockSnackBar = { open: jest.fn() };

  function setup() {
    return TestBed.configureTestingModule({
      imports: [StoreListComponent],
      providers: [
        provideRouter([]),
        provideAnimationsAsync(),
        { provide: ApiService,         useValue: mockApi },
        { provide: AuthService,        useValue: mockAuth },
        { provide: LocalStorageContext, useValue: mockCtx },
        { provide: MatSnackBar,         useValue: mockSnackBar },
      ],
    }).compileComponents();
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    mockCtx.stores.getAll.mockReturnValue([]);
    mockApi.getStores.mockReturnValue(of([]));
    await setup();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(StoreListComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('calls api.getStores on init', () => {
    const fixture = TestBed.createComponent(StoreListComponent);
    fixture.detectChanges();
    expect(mockApi.getStores).toHaveBeenCalledTimes(1);
  });

  it('shows empty state when no stores', () => {
    const fixture = TestBed.createComponent(StoreListComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('No stores yet');
  });

  it('renders store names returned by the API', () => {
    mockApi.getStores.mockReturnValue(of([storeStub]));
    mockCtx.stores.getAll.mockReturnValue([storeStub]);

    const fixture = TestBed.createComponent(StoreListComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Downtown Shop');
  });

  it('renders stores from cache immediately if cache is non-empty', () => {
    mockCtx.stores.getAll.mockReturnValue([storeStub]);
    mockApi.getStores.mockReturnValue(of([])); // API returns empty but cache has data

    const fixture = TestBed.createComponent(StoreListComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.stores).toContainEqual(storeStub);
  });

  it('does not crash when api.getStores fails and cache is empty', () => {
    mockCtx.stores.getAll.mockReturnValue([]);
    mockApi.getStores.mockReturnValue(throwError(() => new Error('network error')));

    const fixture = TestBed.createComponent(StoreListComponent);
    expect(() => fixture.detectChanges()).not.toThrow();
    expect(fixture.componentInstance.stores).toEqual([]);
  });

  it('createStore() calls api.createStore with trimmed name', () => {
    const fixture = TestBed.createComponent(StoreListComponent);
    const comp = fixture.componentInstance;
    comp.newStoreName = '  New Shop  ';

    comp.createStore();

    expect(mockApi.createStore).toHaveBeenCalledWith({ storeName: 'New Shop' });
  });

  it('createStore() clears newStoreName on success', () => {
    mockCtx.stores.getAll.mockReturnValue([storeStub]);
    const fixture = TestBed.createComponent(StoreListComponent);
    const comp = fixture.componentInstance;
    comp.newStoreName = 'New Shop';

    comp.createStore();

    expect(comp.newStoreName).toBe('');
  });

  it('createStore() does nothing when name is blank', () => {
    const fixture = TestBed.createComponent(StoreListComponent);
    const comp = fixture.componentInstance;
    comp.newStoreName = '   ';

    comp.createStore();

    expect(mockApi.createStore).not.toHaveBeenCalled();
  });
});

describe('StoreListComponent — Create button disabled when API offline', () => {
  const mockSnackBar = { open: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [StoreListComponent],
      providers: [
        provideRouter([]),
        provideAnimationsAsync(),
        { provide: ApiService,          useValue: { getStores: jest.fn().mockReturnValue(throwError(() => new Error('offline'))), createStore: jest.fn() } },
        { provide: AuthService,         useValue: { isAdmin: true, currentUser: null } },
        { provide: LocalStorageContext,  useValue: { stores: { getAll: jest.fn().mockReturnValue([]), seed: jest.fn() } } },
        { provide: MatSnackBar,          useValue: mockSnackBar },
      ],
    }).compileComponents();
  });

  afterEach(() => TestBed.resetTestingModule());

  it('Create button is disabled when API is offline, even with a name entered', () => {
    const fixture = TestBed.createComponent(StoreListComponent);
    fixture.componentInstance.newStoreName = 'My Shop'; // set before first detectChanges
    fixture.detectChanges();
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('button[color="primary"]');
    expect(btn?.disabled).toBe(true);
  });

  it('apiOnline is false after getStores errors', () => {
    const fixture = TestBed.createComponent(StoreListComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.apiOnline).toBe(false);
  });
});
