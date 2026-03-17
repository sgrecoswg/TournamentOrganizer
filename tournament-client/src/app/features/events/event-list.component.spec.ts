import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BehaviorSubject, of, Subject } from 'rxjs';
import { EventListComponent } from './event-list.component';
import { EventService } from '../../core/services/event.service';
import { AuthService } from '../../core/services/auth.service';
import { StoreContextService } from '../../core/services/store-context.service';
import { SyncService } from '../../core/services/sync.service';
import { EventDto } from '../../core/models/api.models';

describe('EventListComponent (smoke)', () => {
  const eventsSubject = new BehaviorSubject<EventDto[]>([]);

  const mockEventService: Partial<EventService> = {
    events$: eventsSubject.asObservable(),
    loadAllEvents: jest.fn(),
    createEvent: jest.fn().mockReturnValue(of(null)),
    removeEvent: jest.fn().mockReturnValue(of(null)),
  };

  const mockSnackBar = { open: jest.fn() };

  // Provide a store-employee so the Create Event form is rendered
  const mockAuthService = { isStoreEmployee: true, isAdmin: false, currentUser: null };

  beforeEach(async () => {
    jest.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [EventListComponent],
      providers: [
        provideRouter([]),
        provideAnimationsAsync(),
        { provide: EventService,  useValue: mockEventService },
        { provide: MatSnackBar,   useValue: mockSnackBar },
        { provide: AuthService,   useValue: mockAuthService },
      ],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(EventListComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should call loadAllEvents on init', () => {
    const fixture = TestBed.createComponent(EventListComponent);
    fixture.detectChanges();
    expect(mockEventService.loadAllEvents).toHaveBeenCalled();
  });

  it('should render event list heading', () => {
    const fixture = TestBed.createComponent(EventListComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('h2')?.textContent).toContain('Events');
  });

  it('should disable Create button when name is empty', () => {
    const fixture = TestBed.createComponent(EventListComponent);
    fixture.detectChanges();
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('button[color="primary"]');
    expect(btn?.disabled).toBe(true);
  });
});

// ── Create New Event visibility — Admin role ───────────────────────────────────

describe('EventListComponent — Create New Event visibility (Admin)', () => {
  const eventsSubject = new BehaviorSubject<EventDto[]>([]);
  const selectedStoreId$ = new Subject<number | null>();

  const mockEventService: Partial<EventService> = {
    events$: eventsSubject.asObservable(),
    loadAllEvents: jest.fn(),
    createEvent: jest.fn().mockReturnValue(of(null)),
    removeEvent: jest.fn().mockReturnValue(of(null)),
  };

  const mockSnackBar = { open: jest.fn() };

  async function setup(opts: {
    isAdmin: boolean;
    isStoreEmployee: boolean;
    selectedStoreId: number | null;
  }) {
    const mockAuthService = {
      isStoreEmployee: opts.isStoreEmployee,
      isAdmin: opts.isAdmin,
      currentUser: null,
    };
    const mockStoreContext = {
      selectedStoreId: opts.selectedStoreId,
      selectedStoreId$: selectedStoreId$.asObservable(),
    };

    await TestBed.configureTestingModule({
      imports: [EventListComponent],
      providers: [
        provideRouter([]),
        provideAnimationsAsync(),
        { provide: EventService,       useValue: mockEventService },
        { provide: MatSnackBar,        useValue: mockSnackBar },
        { provide: AuthService,        useValue: mockAuthService },
        { provide: StoreContextService, useValue: mockStoreContext },
      ],
    }).compileComponents();
  }

  afterEach(() => TestBed.resetTestingModule());

  it('Admin without store selected — Create New Event section is NOT visible', async () => {
    await setup({ isAdmin: true, isStoreEmployee: true, selectedStoreId: null });
    const fixture = TestBed.createComponent(EventListComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Create New Event');
  });

  it('Admin with store selected — Create New Event section IS visible', async () => {
    await setup({ isAdmin: true, isStoreEmployee: true, selectedStoreId: 1 });
    const fixture = TestBed.createComponent(EventListComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Create New Event');
  });

  it('StoreEmployee (non-admin) — Create New Event section IS visible regardless of selectedStoreId', async () => {
    await setup({ isAdmin: false, isStoreEmployee: true, selectedStoreId: null });
    const fixture = TestBed.createComponent(EventListComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Create New Event');
  });

  it('Player — Create New Event section is NOT visible', async () => {
    await setup({ isAdmin: false, isStoreEmployee: false, selectedStoreId: null });
    const fixture = TestBed.createComponent(EventListComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Create New Event');
  });
});

// ── Sync button on event cards ─────────────────────────────────────────────────

describe('EventListComponent — sync button', () => {
  const eventsSubject = new BehaviorSubject<EventDto[]>([]);
  const selectedStoreId$ = new Subject<number | null>();

  const SYNCED_EVENT:  EventDto = { id: 1,  name: 'Synced Event',  date: '2026-03-15', status: 'Registration', playerCount: 0, defaultRoundTimeMinutes: 55, maxPlayers: null, pointSystem: 'ScoreBased' };
  const OFFLINE_EVENT: EventDto = { id: -1, name: 'Offline Event', date: '2026-03-15', status: 'Registration', playerCount: 0, defaultRoundTimeMinutes: 55, maxPlayers: null, pointSystem: 'ScoreBased' };

  let mockSyncService: { push: jest.Mock };
  let mockEventService: Partial<EventService>;
  let snackBarOpenSpy: jest.SpyInstance;

  async function setup(events: EventDto[]) {
    eventsSubject.next(events);
    mockSyncService = { push: jest.fn().mockResolvedValue({ pushed: 1, conflicts: 0, errors: 0 }) };
    mockEventService = {
      events$: eventsSubject.asObservable(),
      loadAllEvents: jest.fn(),
      createEvent: jest.fn().mockReturnValue(of(null)),
      removeEvent: jest.fn().mockReturnValue(of(null)),
    };

    await TestBed.configureTestingModule({
      imports: [EventListComponent],
      providers: [
        provideRouter([]),
        provideAnimationsAsync(),
        { provide: EventService,        useValue: mockEventService },
        { provide: MatSnackBar,         useValue: { open: jest.fn() } },
        { provide: AuthService,         useValue: { isStoreEmployee: true, isAdmin: false, currentUser: null } },
        { provide: StoreContextService, useValue: { selectedStoreId: 1, selectedStoreId$: selectedStoreId$.asObservable() } },
        { provide: SyncService,         useValue: mockSyncService },
      ],
    }).compileComponents();
  }

  afterEach(() => TestBed.resetTestingModule());

  it('shows a Sync button on an offline (negative-ID) event card', async () => {
    await setup([OFFLINE_EVENT]);
    const fixture = TestBed.createComponent(EventListComponent);
    fixture.detectChanges();
    const btn = fixture.nativeElement.querySelector('button.sync-btn');
    expect(btn).toBeTruthy();
  });

  it('does NOT show a Sync button on a synced (positive-ID) event card', async () => {
    await setup([SYNCED_EVENT]);
    const fixture = TestBed.createComponent(EventListComponent);
    fixture.detectChanges();
    const btn = fixture.nativeElement.querySelector('button.sync-btn');
    expect(btn).toBeNull();
  });

  it('clicking Sync calls SyncService.push()', async () => {
    await setup([OFFLINE_EVENT]);
    const fixture = TestBed.createComponent(EventListComponent);
    fixture.detectChanges();
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('button.sync-btn');
    btn.click();
    expect(mockSyncService.push).toHaveBeenCalled();
  });

  it('clicking Sync does NOT navigate to the event (stopPropagation)', async () => {
    await setup([OFFLINE_EVENT]);
    const fixture = TestBed.createComponent(EventListComponent);
    fixture.detectChanges();
    const card: HTMLElement = fixture.nativeElement.querySelector('mat-card.event-card');
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('button.sync-btn');
    const cardClickSpy = jest.fn();
    card.addEventListener('click', cardClickSpy);
    btn.click();
    expect(cardClickSpy).not.toHaveBeenCalled();
  });
});
