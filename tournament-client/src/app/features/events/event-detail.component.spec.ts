import { TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute, Router } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTabChangeEvent } from '@angular/material/tabs';
import { BehaviorSubject, EMPTY, of, throwError } from 'rxjs';
import { EventDetailComponent } from './event-detail.component';
import { EventService } from '../../core/services/event.service';
import { PlayerService } from '../../core/services/player.service';
import { AuthService } from '../../core/services/auth.service';
import { MatDialog } from '@angular/material/dialog';
import { Subject, of as observableOf } from 'rxjs';
import { ScryfallService } from '../../core/services/scryfall.service';
import {
  EventDto, EventPlayerDto, PlayerDto, RoundDto, StandingsEntry,
} from '../../core/models/api.models';
import { ApiService } from '../../core/services/api.service';

describe('EventDetailComponent', () => {
  const EVENT_ID = 7;

  // ── Stubs ──────────────────────────────────────────────────────────────────

  const eventStub: EventDto = {
    id: EVENT_ID, name: 'Test Event', date: '2025-06-01',
    status: 'Registration', playerCount: 4,
    defaultRoundTimeMinutes: 60, maxPlayers: 8,
    pointSystem: 'ScoreBased',
  };

  const epStub: EventPlayerDto = {
    playerId: 1, name: 'Alice', decklistUrl: null, commanders: null,
    isDropped: false, isDisqualified: false,
  };

  const playerStub: PlayerDto = {
    id: 2, name: 'Bob', email: 'bob@test.com',
    mu: 25, sigma: 8.333, conservativeScore: 0,
    isRanked: false, placementGamesLeft: 5, isActive: true,
  };

  const roundStub: RoundDto = { roundId: 1, roundNumber: 1, pods: [] };

  // ── Reactive subjects (reset each test) ───────────────────────────────────

  let currentEventSubject:  BehaviorSubject<EventDto | null>;
  let eventPlayersSubject:  BehaviorSubject<EventPlayerDto[]>;
  let roundsSubject:        BehaviorSubject<RoundDto[]>;
  let standingsSubject:     BehaviorSubject<StandingsEntry[]>;
  let playersSubject:       BehaviorSubject<PlayerDto[]>;

  let mockEventService: {
    currentEvent$:   ReturnType<typeof jest.fn> | BehaviorSubject<EventDto | null>;
    eventPlayers$:   ReturnType<typeof jest.fn> | BehaviorSubject<EventPlayerDto[]>;
    rounds$:         ReturnType<typeof jest.fn> | BehaviorSubject<RoundDto[]>;
    standings$:      ReturnType<typeof jest.fn> | BehaviorSubject<StandingsEntry[]>;
    loadEvent:         jest.Mock;
    loadEventPlayers:  jest.Mock;
    loadRounds:        jest.Mock;
    loadStandings:     jest.Mock;
    registerPlayer:    jest.Mock;
    updateStatus:      jest.Mock;
    generateNextRound$: jest.Mock;
    generateNextRound:  jest.Mock;
    removeEvent:       jest.Mock;
    dropPlayer:        jest.Mock;
    disqualifyPlayer:  jest.Mock;
    addRound:          jest.Mock;
    clearRounds:       jest.Mock;
    clearAllPlayers:   jest.Mock;
  };

  let mockPlayerService: {
    players$:       ReturnType<typeof jest.fn> | BehaviorSubject<PlayerDto[]>;
    loadAllPlayers: jest.Mock;
  };

  let mockSnackBar:    { open: jest.Mock };
  let mockRouter:      { navigate: jest.Mock };
  let mockApiService:  { uploadEventBackground: jest.Mock };

  async function setup(authOverrides: object = {}) {
    const mockAuth = {
      isStoreEmployee: true,
      isAdmin: false,
      currentUser: null,
      ...authOverrides,
    };

    await TestBed.configureTestingModule({
      imports: [EventDetailComponent],
      providers: [
        provideRouter([]),
        provideAnimationsAsync(),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: jest.fn().mockReturnValue(String(EVENT_ID)) } } },
        },
        { provide: Router,               useValue: mockRouter },
        { provide: EventService,         useValue: mockEventService },
        { provide: PlayerService,        useValue: mockPlayerService },
        { provide: AuthService,          useValue: mockAuth },
        { provide: MatSnackBar,          useValue: mockSnackBar },
        { provide: ApiService,           useValue: mockApiService },
      ],
    }).compileComponents();
  }

  beforeEach(() => {
    jest.clearAllMocks();

    currentEventSubject = new BehaviorSubject<EventDto | null>(null);
    eventPlayersSubject = new BehaviorSubject<EventPlayerDto[]>([]);
    roundsSubject       = new BehaviorSubject<RoundDto[]>([]);
    standingsSubject    = new BehaviorSubject<StandingsEntry[]>([]);
    playersSubject      = new BehaviorSubject<PlayerDto[]>([]);

    mockEventService = {
      currentEvent$:    currentEventSubject.asObservable() as any,
      eventPlayers$:    eventPlayersSubject.asObservable() as any,
      rounds$:          roundsSubject.asObservable() as any,
      standings$:       standingsSubject.asObservable() as any,
      loadEvent:        jest.fn(),
      loadEventPlayers: jest.fn(),
      loadRounds:       jest.fn(),
      loadStandings:    jest.fn(),
      registerPlayer:   jest.fn().mockReturnValue(of({})),
      updateStatus:     jest.fn().mockReturnValue(of({})),
      generateNextRound$: jest.fn().mockReturnValue(of(roundStub)),
      generateNextRound:  jest.fn(),
      removeEvent:      jest.fn().mockReturnValue(of({})),
      dropPlayer:       jest.fn().mockReturnValue(of({})),
      disqualifyPlayer: jest.fn().mockReturnValue(of({})),
      addRound:         jest.fn(),
      clearRounds:      jest.fn(),
      clearAllPlayers:  jest.fn().mockReturnValue(of({})),
    };

    mockPlayerService = {
      players$:       playersSubject.asObservable() as any,
      loadAllPlayers: jest.fn(),
    };

    mockSnackBar   = { open: jest.fn() };
    mockApiService = { uploadEventBackground: jest.fn() };
    mockRouter   = {
      navigate: jest.fn(),
      events: EMPTY,
      createUrlTree: jest.fn().mockReturnValue({}),
      serializeUrl: jest.fn().mockReturnValue('/fake'),
    };
  });

  // ── Smoke ───────────────────────────────────────────────────────────────────

  it('should create', async () => {
    await setup();
    const fixture = TestBed.createComponent(EventDetailComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  // ── ngOnInit ────────────────────────────────────────────────────────────────

  it('reads eventId from route on init', async () => {
    await setup();
    const fixture = TestBed.createComponent(EventDetailComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.eventId).toBe(EVENT_ID);
  });

  it('calls loadEvent on init', async () => {
    await setup();
    const fixture = TestBed.createComponent(EventDetailComponent);
    fixture.detectChanges();
    expect(mockEventService.loadEvent).toHaveBeenCalledWith(EVENT_ID);
  });

  it('calls loadEventPlayers on init', async () => {
    await setup();
    const fixture = TestBed.createComponent(EventDetailComponent);
    fixture.detectChanges();
    expect(mockEventService.loadEventPlayers).toHaveBeenCalledWith(EVENT_ID);
  });

  it('calls loadRounds on init', async () => {
    await setup();
    const fixture = TestBed.createComponent(EventDetailComponent);
    fixture.detectChanges();
    expect(mockEventService.loadRounds).toHaveBeenCalledWith(EVENT_ID);
  });

  it('calls loadAllPlayers on init', async () => {
    await setup();
    const fixture = TestBed.createComponent(EventDetailComponent);
    fixture.detectChanges();
    expect(mockPlayerService.loadAllPlayers).toHaveBeenCalledTimes(1);
  });

  it('calls loadStandings on init', async () => {
    await setup();
    const fixture = TestBed.createComponent(EventDetailComponent);
    fixture.detectChanges();
    expect(mockEventService.loadStandings).toHaveBeenCalledWith(EVENT_ID);
  });

  it('populates event from currentEvent$ subscription', async () => {
    await setup();
    const fixture = TestBed.createComponent(EventDetailComponent);
    fixture.detectChanges();
    currentEventSubject.next(eventStub);
    expect(fixture.componentInstance.event).toEqual(eventStub);
  });

  it('populates eventPlayers from eventPlayers$ subscription', async () => {
    await setup();
    const fixture = TestBed.createComponent(EventDetailComponent);
    fixture.detectChanges();
    eventPlayersSubject.next([epStub]);
    expect(fixture.componentInstance.eventPlayers).toContainEqual(epStub);
  });

  it('populates rounds from rounds$ subscription', async () => {
    await setup();
    const fixture = TestBed.createComponent(EventDetailComponent);
    fixture.detectChanges();
    roundsSubject.next([roundStub]);
    expect(fixture.componentInstance.rounds).toContainEqual(roundStub);
  });

  // ── pointSystemLabel getter ─────────────────────────────────────────────────

  it('pointSystemLabel returns the label for ScoreBased', async () => {
    await setup();
    const fixture = TestBed.createComponent(EventDetailComponent);
    const comp = fixture.componentInstance;
    comp.event = { ...eventStub, pointSystem: 'ScoreBased' };
    expect(comp.pointSystemLabel).toContain('Score-Based');
  });

  it('pointSystemLabel returns the label for WinBased', async () => {
    await setup();
    const fixture = TestBed.createComponent(EventDetailComponent);
    const comp = fixture.componentInstance;
    comp.event = { ...eventStub, pointSystem: 'WinBased' };
    expect(comp.pointSystemLabel).toContain('Win-Based');
  });

  it('pointSystemLabel falls back to raw pointSystem when not found', async () => {
    await setup();
    const fixture = TestBed.createComponent(EventDetailComponent);
    const comp = fixture.componentInstance;
    comp.event = { ...eventStub, pointSystem: 'UnknownSystem' as any };
    expect(comp.pointSystemLabel).toBe('UnknownSystem');
  });

  // ── isAlreadyRegistered ─────────────────────────────────────────────────────

  it('isAlreadyRegistered returns true for an active player', async () => {
    await setup();
    const fixture = TestBed.createComponent(EventDetailComponent);
    const comp = fixture.componentInstance;
    comp.eventPlayers = [epStub]; // playerId: 1, active
    expect(comp.isAlreadyRegistered(1)).toBe(true);
  });

  it('isAlreadyRegistered returns false for a dropped player', async () => {
    await setup();
    const fixture = TestBed.createComponent(EventDetailComponent);
    const comp = fixture.componentInstance;
    comp.eventPlayers = [{ ...epStub, isDropped: true }];
    expect(comp.isAlreadyRegistered(1)).toBe(false);
  });

  it('isAlreadyRegistered returns false for a disqualified player', async () => {
    await setup();
    const fixture = TestBed.createComponent(EventDetailComponent);
    const comp = fixture.componentInstance;
    comp.eventPlayers = [{ ...epStub, isDisqualified: true }];
    expect(comp.isAlreadyRegistered(1)).toBe(false);
  });

  it('isAlreadyRegistered returns false when playerId is not in list', async () => {
    await setup();
    const fixture = TestBed.createComponent(EventDetailComponent);
    const comp = fixture.componentInstance;
    comp.eventPlayers = [epStub]; // only playerId 1
    expect(comp.isAlreadyRegistered(99)).toBe(false);
  });

  // ── isEventFull getter ──────────────────────────────────────────────────────

  it('isEventFull is false when maxPlayers is null', async () => {
    await setup();
    const fixture = TestBed.createComponent(EventDetailComponent);
    const comp = fixture.componentInstance;
    comp.event = { ...eventStub, maxPlayers: null };
    comp.eventPlayers = [epStub, { ...epStub, playerId: 2 }];
    expect(comp.isEventFull).toBe(false);
  });

  it('isEventFull is false when active count is below maxPlayers', async () => {
    await setup();
    const fixture = TestBed.createComponent(EventDetailComponent);
    const comp = fixture.componentInstance;
    comp.event = { ...eventStub, maxPlayers: 8 };
    comp.eventPlayers = [epStub]; // 1 active < 8
    expect(comp.isEventFull).toBe(false);
  });

  it('isEventFull is true when active count equals maxPlayers', async () => {
    await setup();
    const fixture = TestBed.createComponent(EventDetailComponent);
    const comp = fixture.componentInstance;
    comp.event = { ...eventStub, maxPlayers: 2 };
    comp.eventPlayers = [
      { ...epStub, playerId: 1 },
      { ...epStub, playerId: 2 },
    ];
    expect(comp.isEventFull).toBe(true);
  });

  it('isEventFull ignores dropped players in the count', async () => {
    await setup();
    const fixture = TestBed.createComponent(EventDetailComponent);
    const comp = fixture.componentInstance;
    comp.event = { ...eventStub, maxPlayers: 2 };
    comp.eventPlayers = [
      epStub,                             // active
      { ...epStub, playerId: 2, isDropped: true }, // dropped — shouldn't count
    ];
    expect(comp.isEventFull).toBe(false);
  });

  // ── filteredPlayers getter ──────────────────────────────────────────────────

  it('filteredPlayers excludes already-registered players', async () => {
    await setup();
    const fixture = TestBed.createComponent(EventDetailComponent);
    const comp = fixture.componentInstance;
    comp.eventPlayers = [{ ...epStub, playerId: playerStub.id }]; // Bob registered
    comp.allPlayers = [playerStub];
    expect(comp.filteredPlayers).toEqual([]);
  });

  it('filteredPlayers includes dropped players (they can re-register)', async () => {
    await setup();
    const fixture = TestBed.createComponent(EventDetailComponent);
    const comp = fixture.componentInstance;
    comp.eventPlayers = [{ ...epStub, playerId: playerStub.id, isDropped: true }];
    comp.allPlayers = [playerStub];
    expect(comp.filteredPlayers).toContainEqual(playerStub);
  });

  it('filteredPlayers excludes inactive players', async () => {
    await setup();
    const fixture = TestBed.createComponent(EventDetailComponent);
    const comp = fixture.componentInstance;
    comp.eventPlayers = [];
    comp.allPlayers = [{ ...playerStub, isActive: false }];
    expect(comp.filteredPlayers).toEqual([]);
  });

  it('filteredPlayers filters by name search text', async () => {
    await setup();
    const fixture = TestBed.createComponent(EventDetailComponent);
    const comp = fixture.componentInstance;
    comp.eventPlayers = [];
    comp.allPlayers = [playerStub, { ...playerStub, id: 3, name: 'Charlie', email: 'c@test.com' }];
    comp.playerSearchText = 'bo';
    expect(comp.filteredPlayers).toEqual([playerStub]);
  });

  it('filteredPlayers filters by email search text', async () => {
    await setup();
    const fixture = TestBed.createComponent(EventDetailComponent);
    const comp = fixture.componentInstance;
    comp.eventPlayers = [];
    comp.allPlayers = [playerStub];
    comp.playerSearchText = 'bob@';
    expect(comp.filteredPlayers).toContainEqual(playerStub);
  });

  // ── displayPlayerName ───────────────────────────────────────────────────────

  it('displayPlayerName returns player.name for a PlayerDto', async () => {
    await setup();
    const fixture = TestBed.createComponent(EventDetailComponent);
    expect(fixture.componentInstance.displayPlayerName(playerStub)).toBe('Bob');
  });

  it('displayPlayerName returns the string when passed a string', async () => {
    await setup();
    const fixture = TestBed.createComponent(EventDetailComponent);
    expect(fixture.componentInstance.displayPlayerName('manual text')).toBe('manual text');
  });

  // ── onPlayerSelected ────────────────────────────────────────────────────────

  it('onPlayerSelected sets playerIdToRegister and playerSearchText', async () => {
    await setup();
    const fixture = TestBed.createComponent(EventDetailComponent);
    const comp = fixture.componentInstance;
    comp.onPlayerSelected({ option: { value: playerStub } } as any);
    expect(comp.playerIdToRegister).toBe(playerStub.id);
    expect(comp.playerSearchText).toBe(playerStub.name);
  });

  // ── registerPlayer ──────────────────────────────────────────────────────────

  it('registerPlayer does nothing when playerIdToRegister is null', async () => {
    await setup();
    const fixture = TestBed.createComponent(EventDetailComponent);
    const comp = fixture.componentInstance;
    comp.playerIdToRegister = null;
    comp.registerPlayer();
    expect(mockEventService.registerPlayer).not.toHaveBeenCalled();
  });

  it('registerPlayer calls eventService.registerPlayer with correct args', async () => {
    await setup();
    const fixture = TestBed.createComponent(EventDetailComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    comp.playerIdToRegister = playerStub.id;
    comp.decklistUrl = 'https://deck.url';
    comp.commandersInput = 'Atraxa';
    comp.registerPlayer();
    expect(mockEventService.registerPlayer).toHaveBeenCalledWith(EVENT_ID, {
      playerId: playerStub.id,
      decklistUrl: 'https://deck.url',
      commanders: 'Atraxa',
    });
  });

  it('registerPlayer clears form fields on success', async () => {
    await setup();
    const fixture = TestBed.createComponent(EventDetailComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    comp.playerIdToRegister = playerStub.id;
    comp.playerSearchText = 'Bob';
    comp.decklistUrl = 'https://deck.url';
    comp.commandersInput = 'Atraxa';
    comp.registerPlayer();
    expect(comp.playerIdToRegister).toBeNull();
    expect(comp.playerSearchText).toBe('');
    expect(comp.decklistUrl).toBeNull();
    expect(comp.commandersInput).toBe('');
  });

  // ── selfRegister ────────────────────────────────────────────────────────────

  it('selfRegister does nothing when no currentUser', async () => {
    await setup({ currentUser: null });
    const fixture = TestBed.createComponent(EventDetailComponent);
    fixture.detectChanges();
    fixture.componentInstance.selfRegister();
    expect(mockEventService.registerPlayer).not.toHaveBeenCalled();
  });

  it('selfRegister calls registerPlayer with currentUser.playerId', async () => {
    await setup({ currentUser: { playerId: 42 } });
    const fixture = TestBed.createComponent(EventDetailComponent);
    fixture.detectChanges();
    fixture.componentInstance.selfRegister();
    expect(mockEventService.registerPlayer).toHaveBeenCalledWith(EVENT_ID, { playerId: 42 });
  });

  // ── getRecommendedRounds ────────────────────────────────────────────────────

  it.each([
    [1,  2], [4,  2],
    [5,  3], [8,  3],
    [9,  5], [32, 5],
    [33, 6], [64, 6],
    [65, 7], [128, 7],
    [129, 8], [226, 8],
    [227, 9], [409, 9],
    [410, 10],
  ])('getRecommendedRounds(%i players) = %i', async (players, expected) => {
    await setup();
    const comp = TestBed.createComponent(EventDetailComponent).componentInstance;
    expect(comp.getRecommendedRounds(players)).toBe(expected);
  });

  // ── prepareStart / cancelStart ──────────────────────────────────────────────

  it('prepareStart sets showStartConfirm = true', async () => {
    await setup();
    const fixture = TestBed.createComponent(EventDetailComponent);
    const comp = fixture.componentInstance;
    comp.event = { ...eventStub, playerCount: 8 };
    comp.prepareStart();
    expect(comp.showStartConfirm).toBe(true);
  });

  it('prepareStart sets confirmedRounds to the recommended value', async () => {
    await setup();
    const fixture = TestBed.createComponent(EventDetailComponent);
    const comp = fixture.componentInstance;
    comp.event = { ...eventStub, playerCount: 8 }; // recommended = 3
    comp.prepareStart();
    expect(comp.confirmedRounds).toBe(3);
  });

  it('cancelStart sets showStartConfirm = false', async () => {
    await setup();
    const fixture = TestBed.createComponent(EventDetailComponent);
    const comp = fixture.componentInstance;
    comp.showStartConfirm = true;
    comp.cancelStart();
    expect(comp.showStartConfirm).toBe(false);
  });

  // ── confirmStart ────────────────────────────────────────────────────────────

  it('confirmStart calls eventService.updateStatus with InProgress and confirmedRounds', async () => {
    await setup();
    const fixture = TestBed.createComponent(EventDetailComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    comp.confirmedRounds = 4;
    comp.confirmStart();
    expect(mockEventService.updateStatus).toHaveBeenCalledWith(EVENT_ID, 'InProgress', 4);
  });

  it('confirmStart calls generateNextRound$ and addRound on success', async () => {
    await setup();
    const fixture = TestBed.createComponent(EventDetailComponent);
    fixture.detectChanges();
    fixture.componentInstance.confirmStart();
    expect(mockEventService.generateNextRound$).toHaveBeenCalledWith(EVENT_ID);
    expect(mockEventService.addRound).toHaveBeenCalledWith(roundStub);
  });

  it('confirmStart resets showStartConfirm to false', async () => {
    await setup();
    const fixture = TestBed.createComponent(EventDetailComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    comp.showStartConfirm = true;
    comp.confirmStart();
    expect(comp.showStartConfirm).toBe(false);
  });

  it('confirmStart sets showStartConfirm = true on error', async () => {
    mockEventService.updateStatus = jest.fn().mockReturnValue(throwError(() => ({ error: { error: 'fail' } })));
    await setup();
    const fixture = TestBed.createComponent(EventDetailComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    comp.showStartConfirm = false;
    comp.confirmStart();
    expect(comp.showStartConfirm).toBe(true);
  });

  // ── updateStatus ────────────────────────────────────────────────────────────

  it('updateStatus calls eventService.updateStatus with the given status', async () => {
    await setup();
    const fixture = TestBed.createComponent(EventDetailComponent);
    fixture.detectChanges();
    fixture.componentInstance.updateStatus('Completed');
    expect(mockEventService.updateStatus).toHaveBeenCalledWith(EVENT_ID, 'Completed');
  });

  // ── dropPlayer ──────────────────────────────────────────────────────────────

  it('dropPlayer calls eventService.dropPlayer', async () => {
    await setup();
    const fixture = TestBed.createComponent(EventDetailComponent);
    fixture.detectChanges();
    fixture.componentInstance.dropPlayer(1);
    expect(mockEventService.dropPlayer).toHaveBeenCalledWith(EVENT_ID, 1);
  });

  // ── disqualifyPlayer ────────────────────────────────────────────────────────

  it('disqualifyPlayer calls eventService.disqualifyPlayer', async () => {
    await setup();
    const fixture = TestBed.createComponent(EventDetailComponent);
    fixture.detectChanges();
    fixture.componentInstance.disqualifyPlayer(1);
    expect(mockEventService.disqualifyPlayer).toHaveBeenCalledWith(EVENT_ID, 1);
  });

  // ── removeEvent ─────────────────────────────────────────────────────────────

  it('removeEvent calls eventService.removeEvent', async () => {
    await setup();
    const fixture = TestBed.createComponent(EventDetailComponent);
    fixture.detectChanges();
    fixture.componentInstance.removeEvent();
    expect(mockEventService.removeEvent).toHaveBeenCalledWith(EVENT_ID);
  });

  it('removeEvent navigates to /events on success', async () => {
    await setup();
    const fixture = TestBed.createComponent(EventDetailComponent);
    fixture.detectChanges();
    fixture.componentInstance.removeEvent();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/events']);
  });

  // ── generateRound ───────────────────────────────────────────────────────────

  it('generateRound delegates to eventService.generateNextRound', async () => {
    await setup();
    const fixture = TestBed.createComponent(EventDetailComponent);
    fixture.detectChanges();
    fixture.componentInstance.generateRound();
    expect(mockEventService.generateNextRound).toHaveBeenCalledWith(EVENT_ID);
  });

  // ── loadStandings ───────────────────────────────────────────────────────────

  it('loadStandings calls eventService.loadStandings', async () => {
    await setup();
    const fixture = TestBed.createComponent(EventDetailComponent);
    fixture.detectChanges();
    jest.clearAllMocks();
    fixture.componentInstance.loadStandings();
    expect(mockEventService.loadStandings).toHaveBeenCalledWith(EVENT_ID);
  });

  // ── onTabChange ─────────────────────────────────────────────────────────────

  it('onTabChange calls loadStandings when index is STANDINGS_TAB (2)', async () => {
    await setup();
    const fixture = TestBed.createComponent(EventDetailComponent);
    fixture.detectChanges();
    jest.clearAllMocks();
    fixture.componentInstance.onTabChange({ index: 2 } as MatTabChangeEvent);
    expect(mockEventService.loadStandings).toHaveBeenCalledWith(EVENT_ID);
  });

  it('onTabChange calls loadEventPlayers when index is PLAYERS_TAB (0)', async () => {
    await setup();
    const fixture = TestBed.createComponent(EventDetailComponent);
    fixture.detectChanges();
    jest.clearAllMocks();
    fixture.componentInstance.onTabChange({ index: 0 } as MatTabChangeEvent);
    expect(mockEventService.loadEventPlayers).toHaveBeenCalledWith(EVENT_ID);
  });

  it('onTabChange does not call loadStandings for other tabs', async () => {
    await setup();
    const fixture = TestBed.createComponent(EventDetailComponent);
    fixture.detectChanges();
    jest.clearAllMocks();
    fixture.componentInstance.onTabChange({ index: 1 } as MatTabChangeEvent);
    expect(mockEventService.loadStandings).not.toHaveBeenCalled();
  });

  // ── getPodState ─────────────────────────────────────────────────────────────

  it('getPodState creates a fresh state for an unknown podId', async () => {
    await setup();
    const comp = TestBed.createComponent(EventDetailComponent).componentInstance;
    const state = comp.getPodState(99);
    expect(state).toEqual({ winnerId: null, placements: [], submitted: false, isDraw: false });
  });

  it('getPodState returns the same object on repeated calls', async () => {
    await setup();
    const comp = TestBed.createComponent(EventDetailComponent).componentInstance;
    const first  = comp.getPodState(42);
    const second = comp.getPodState(42);
    expect(first).toBe(second);
  });

  // ── isRoundComplete ─────────────────────────────────────────────────────────

  it('isRoundComplete is false for a round with no pods', async () => {
    await setup();
    const comp = TestBed.createComponent(EventDetailComponent).componentInstance;
    expect(comp.isRoundComplete({ roundId: 1, roundNumber: 1, pods: [] })).toBe(false);
  });

  it('isRoundComplete is false when any pod is not yet submitted', async () => {
    await setup();
    const comp = TestBed.createComponent(EventDetailComponent).componentInstance;
    const round: RoundDto = { roundId: 1, roundNumber: 1, pods: [
      { podId: 1, players: [], gameId: 0, gameStatus: 'Pending', winnerPlayerId: null },
    ]};
    // podState for 1 defaults to submitted=false
    expect(comp.isRoundComplete(round)).toBe(false);
  });

  it('isRoundComplete is true when all pods are submitted', async () => {
    await setup();
    const comp = TestBed.createComponent(EventDetailComponent).componentInstance;
    const round: RoundDto = { roundId: 1, roundNumber: 1, pods: [
      { podId: 5, players: [], gameId: 0, gameStatus: 'Completed', winnerPlayerId: 1 },
    ]};
    comp.getPodState(5).submitted = true;
    expect(comp.isRoundComplete(round)).toBe(true);
  });

  // ── Check-In ─────────────────────────────────────────────────────────────────

  describe('Check-In', () => {
    const checkedInPlayer: EventPlayerDto = {
      playerId: 1, name: 'Alice', decklistUrl: null, commanders: null,
      isDropped: false, isDisqualified: false, isCheckedIn: true,
      conservativeScore: 0, isRanked: false,
    };
    const uncheckedPlayer: EventPlayerDto = {
      playerId: 2, name: 'Bob', decklistUrl: null, commanders: null,
      isDropped: false, isDisqualified: false, isCheckedIn: false,
      conservativeScore: 0, isRanked: false,
    };

    it('Check-In section is visible for StoreEmployee when status is Registration', async () => {
      await setup({ isStoreEmployee: true });
      const fixture = TestBed.createComponent(EventDetailComponent);
      fixture.detectChanges();
      currentEventSubject.next({ ...eventStub, status: 'Registration' });
      eventPlayersSubject.next([uncheckedPlayer]);
      fixture.detectChanges();
      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelector('.checkin-section')).not.toBeNull();
    });

    it('Check-In section is NOT visible when status is InProgress', async () => {
      await setup({ isStoreEmployee: true });
      const fixture = TestBed.createComponent(EventDetailComponent);
      fixture.detectChanges();
      currentEventSubject.next({ ...eventStub, status: 'InProgress' });
      eventPlayersSubject.next([uncheckedPlayer]);
      fixture.detectChanges();
      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelector('.checkin-section')).toBeNull();
    });

    it('checkedInCount returns number of checked-in players', async () => {
      await setup({ isStoreEmployee: true });
      const fixture = TestBed.createComponent(EventDetailComponent);
      fixture.detectChanges();
      currentEventSubject.next({ ...eventStub, status: 'Registration' });
      eventPlayersSubject.next([checkedInPlayer, uncheckedPlayer]);
      fixture.detectChanges();
      expect(fixture.componentInstance.checkedInCount).toBe(1);
    });

    it('toggleCheckIn calls eventService.setCheckIn with toggled value', async () => {
      (mockEventService as any).setCheckIn = jest.fn().mockReturnValue(of(checkedInPlayer));
      await setup({ isStoreEmployee: true });
      const fixture = TestBed.createComponent(EventDetailComponent);
      fixture.detectChanges();
      currentEventSubject.next({ ...eventStub, status: 'Registration' });
      eventPlayersSubject.next([uncheckedPlayer]);
      fixture.detectChanges();

      fixture.componentInstance.toggleCheckIn(uncheckedPlayer);

      expect((mockEventService as any).setCheckIn)
        .toHaveBeenCalledWith(EVENT_ID, uncheckedPlayer.playerId, true);
    });

    it('after toggleCheckIn success player row is updated', async () => {
      const updated = { ...uncheckedPlayer, isCheckedIn: true };
      (mockEventService as any).setCheckIn = jest.fn().mockReturnValue(of(updated));
      await setup({ isStoreEmployee: true });
      const fixture = TestBed.createComponent(EventDetailComponent);
      fixture.detectChanges();
      currentEventSubject.next({ ...eventStub, status: 'Registration' });
      eventPlayersSubject.next([uncheckedPlayer]);
      fixture.detectChanges();

      fixture.componentInstance.toggleCheckIn(uncheckedPlayer);

      const player = fixture.componentInstance.players.find(p => p.playerId === 2);
      expect(player?.isCheckedIn).toBe(true);
    });

    it('checkAllIn calls setCheckIn for each unchecked player', async () => {
      (mockEventService as any).setCheckIn = jest.fn().mockReturnValue(of(checkedInPlayer));
      await setup({ isStoreEmployee: true });
      const fixture = TestBed.createComponent(EventDetailComponent);
      fixture.detectChanges();
      currentEventSubject.next({ ...eventStub, status: 'Registration' });
      eventPlayersSubject.next([checkedInPlayer, uncheckedPlayer]);
      fixture.detectChanges();

      fixture.componentInstance.checkAllIn();

      // Only uncheckedPlayer (playerId 2) should be called — checkedInPlayer is already in
      expect((mockEventService as any).setCheckIn)
        .toHaveBeenCalledWith(EVENT_ID, uncheckedPlayer.playerId, true);
      expect((mockEventService as any).setCheckIn).toHaveBeenCalledTimes(1);
    });

    it('Player role: checkbox condition is true for own player, false for others', async () => {
      (mockEventService as any).setCheckIn = jest.fn().mockReturnValue(of({}));
      await setup({ isStoreEmployee: false, isAdmin: false, currentUser: { playerId: 1, role: 'Player' } });
      const fixture = TestBed.createComponent(EventDetailComponent);
      fixture.detectChanges();
      currentEventSubject.next({ ...eventStub, status: 'Registration' });
      eventPlayersSubject.next([checkedInPlayer, uncheckedPlayer]);
      fixture.detectChanges();
      const comp = fixture.componentInstance;
      const auth = (comp as any).authService;
      // isStoreEmployee is false; currentUser.playerId is 1
      // Checkbox shows when: isStoreEmployee || row.playerId === currentUser.playerId
      expect(auth.isStoreEmployee || checkedInPlayer.playerId === auth.currentUser?.playerId).toBe(true);
      expect(auth.isStoreEmployee || uncheckedPlayer.playerId === auth.currentUser?.playerId).toBe(false);
    });
  });

  // ── clearAllPlayers ─────────────────────────────────────────────────────────

  describe('clearAllPlayers', () => {
    it('calls eventService.clearAllPlayers with the event ID', async () => {
      await setup();
      const fixture = TestBed.createComponent(EventDetailComponent);
      fixture.detectChanges();
      fixture.componentInstance.clearAllPlayers();
      expect(mockEventService.clearAllPlayers).toHaveBeenCalledWith(EVENT_ID);
    });

    it('shows success snackbar on completion', async () => {
      await setup();
      const fixture = TestBed.createComponent(EventDetailComponent);
      fixture.detectChanges();
      const snackBarOpenSpy = jest.spyOn((fixture.componentInstance as any).snackBar, 'open')
        .mockReturnValue({} as any);
      fixture.componentInstance.clearAllPlayers();
      expect(snackBarOpenSpy).toHaveBeenCalledWith('All players cleared.', 'OK', expect.any(Object));
    });

    it('shows error snackbar when service call fails', async () => {
      mockEventService.clearAllPlayers.mockReturnValue(
        throwError(() => ({ error: { error: 'Cannot clear' } }))
      );
      await setup();
      const fixture = TestBed.createComponent(EventDetailComponent);
      fixture.detectChanges();
      const snackBarOpenSpy = jest.spyOn((fixture.componentInstance as any).snackBar, 'open')
        .mockReturnValue({} as any);
      fixture.componentInstance.clearAllPlayers();
      expect(snackBarOpenSpy).toHaveBeenCalledWith('Cannot clear', 'OK', expect.any(Object));
    });
  });

  // ── Player Drop ─────────────────────────────────────────────────────────────

  describe('Player Drop', () => {
    const inProgressEvent: EventDto = {
      ...eventStub, status: 'InProgress',
    };

    const activePlayer: EventPlayerDto = {
      playerId: 10, name: 'Carol', decklistUrl: null, commanders: null,
      isDropped: false, isDisqualified: false, isCheckedIn: true,
    };

    const droppedPlayer: EventPlayerDto = {
      ...activePlayer, isDropped: true, droppedAfterRound: 1,
    };

    it('setDropped(player, true) calls eventService.setPlayerDropped with eventId and playerId', async () => {
      (mockEventService as any).setPlayerDropped = jest.fn().mockReturnValue(of(droppedPlayer));
      jest.spyOn(window, 'confirm').mockReturnValue(true);
      await setup({ isStoreEmployee: true });
      const fixture = TestBed.createComponent(EventDetailComponent);
      fixture.detectChanges();
      eventPlayersSubject.next([activePlayer]);
      fixture.detectChanges();

      fixture.componentInstance.setDropped(activePlayer, true);

      expect((mockEventService as any).setPlayerDropped)
        .toHaveBeenCalledWith(EVENT_ID, activePlayer.playerId, true);
    });

    it('setDropped does NOT call service when confirm is cancelled', async () => {
      (mockEventService as any).setPlayerDropped = jest.fn().mockReturnValue(of(droppedPlayer));
      jest.spyOn(window, 'confirm').mockReturnValue(false);
      await setup({ isStoreEmployee: true });
      const fixture = TestBed.createComponent(EventDetailComponent);
      fixture.detectChanges();
      eventPlayersSubject.next([activePlayer]);
      fixture.detectChanges();

      fixture.componentInstance.setDropped(activePlayer, true);

      expect((mockEventService as any).setPlayerDropped).not.toHaveBeenCalled();
    });

    it('setDropped success updates the player row in eventPlayers', async () => {
      (mockEventService as any).setPlayerDropped = jest.fn().mockReturnValue(of(droppedPlayer));
      jest.spyOn(window, 'confirm').mockReturnValue(true);
      await setup({ isStoreEmployee: true });
      const fixture = TestBed.createComponent(EventDetailComponent);
      fixture.detectChanges();
      eventPlayersSubject.next([activePlayer]);
      fixture.detectChanges();

      fixture.componentInstance.setDropped(activePlayer, true);

      const updated = fixture.componentInstance.eventPlayers.find(p => p.playerId === activePlayer.playerId);
      expect(updated?.isDropped).toBe(true);
    });

    it('setDropped(player, false) calls setPlayerDropped with isDropped=false (un-drop)', async () => {
      (mockEventService as any).setPlayerDropped = jest.fn().mockReturnValue(of(activePlayer));
      jest.spyOn(window, 'confirm').mockReturnValue(true);
      await setup({ isStoreEmployee: true });
      const fixture = TestBed.createComponent(EventDetailComponent);
      fixture.detectChanges();
      eventPlayersSubject.next([droppedPlayer]);
      fixture.detectChanges();

      fixture.componentInstance.setDropped(droppedPlayer, false);

      expect((mockEventService as any).setPlayerDropped)
        .toHaveBeenCalledWith(EVENT_ID, droppedPlayer.playerId, false);
    });

    it('setDropped error shows snackbar', async () => {
      (mockEventService as any).setPlayerDropped = jest.fn()
        .mockReturnValue(throwError(() => ({ error: { error: 'Cannot drop' } })));
      jest.spyOn(window, 'confirm').mockReturnValue(true);
      await setup({ isStoreEmployee: true });
      const fixture = TestBed.createComponent(EventDetailComponent);
      fixture.detectChanges();
      eventPlayersSubject.next([activePlayer]);
      fixture.detectChanges();
      const snackBarOpenSpy = jest.spyOn((fixture.componentInstance as any).snackBar, 'open')
        .mockReturnValue({} as any);

      fixture.componentInstance.setDropped(activePlayer, true);

      expect(snackBarOpenSpy).toHaveBeenCalledWith('Cannot drop', 'OK', expect.any(Object));
    });
  });

  // ── Waitlist ─────────────────────────────────────────────────────────────────

  describe('Waitlist', () => {
    const regEvent: EventDto = { ...eventStub, status: 'Registration' };

    const activePlayer: EventPlayerDto = {
      playerId: 1, name: 'Alice', decklistUrl: null, commanders: null,
      isDropped: false, isDisqualified: false, isCheckedIn: true,
      isWaitlisted: false, waitlistPosition: null,
      conservativeScore: 0, isRanked: false,
    };

    const waitlistedPlayer: EventPlayerDto = {
      playerId: 5, name: 'Eve', decklistUrl: null, commanders: null,
      isDropped: false, isDisqualified: false, isCheckedIn: false,
      isWaitlisted: true, waitlistPosition: 1,
      conservativeScore: 0, isRanked: false,
    };

    const promotedPlayer: EventPlayerDto = {
      ...waitlistedPlayer, isWaitlisted: false, waitlistPosition: null,
    };

    it('waitlistedPlayers getter returns only waitlisted players sorted by position', async () => {
      await setup({ isStoreEmployee: true });
      const fixture = TestBed.createComponent(EventDetailComponent);
      fixture.detectChanges();
      eventPlayersSubject.next([activePlayer, waitlistedPlayer]);
      fixture.detectChanges();

      const comp = fixture.componentInstance;
      expect(comp.waitlistedPlayers).toEqual([waitlistedPlayer]);
    });

    it('promotePlayer calls eventService.promotePlayer with eventId and playerId', async () => {
      (mockEventService as any).promotePlayer = jest.fn().mockReturnValue(of(promotedPlayer));
      await setup({ isStoreEmployee: true });
      const fixture = TestBed.createComponent(EventDetailComponent);
      fixture.detectChanges();
      currentEventSubject.next(regEvent);
      eventPlayersSubject.next([activePlayer, waitlistedPlayer]);
      fixture.detectChanges();

      fixture.componentInstance.promotePlayer(waitlistedPlayer.playerId);

      expect((mockEventService as any).promotePlayer)
        .toHaveBeenCalledWith(EVENT_ID, waitlistedPlayer.playerId);
    });

    it('promotePlayer success updates the player row in eventPlayers', async () => {
      (mockEventService as any).promotePlayer = jest.fn().mockReturnValue(of(promotedPlayer));
      await setup({ isStoreEmployee: true });
      const fixture = TestBed.createComponent(EventDetailComponent);
      fixture.detectChanges();
      currentEventSubject.next(regEvent);
      eventPlayersSubject.next([activePlayer, waitlistedPlayer]);
      fixture.detectChanges();

      fixture.componentInstance.promotePlayer(waitlistedPlayer.playerId);

      const updated = fixture.componentInstance.eventPlayers.find(p => p.playerId === waitlistedPlayer.playerId);
      expect(updated?.isWaitlisted).toBe(false);
    });

    it('promotePlayer error shows snackbar', async () => {
      (mockEventService as any).promotePlayer = jest.fn()
        .mockReturnValue(throwError(() => ({ error: { error: 'Promote failed' } })));
      await setup({ isStoreEmployee: true });
      const fixture = TestBed.createComponent(EventDetailComponent);
      fixture.detectChanges();
      currentEventSubject.next(regEvent);
      eventPlayersSubject.next([activePlayer, waitlistedPlayer]);
      fixture.detectChanges();
      const snackBarOpenSpy = jest.spyOn((fixture.componentInstance as any).snackBar, 'open')
        .mockReturnValue({} as any);

      fixture.componentInstance.promotePlayer(waitlistedPlayer.playerId);

      expect(snackBarOpenSpy).toHaveBeenCalledWith('Promote failed', 'OK', expect.any(Object));
    });

    it('myRegistration getter returns the current players own registration', async () => {
      await setup({ isStoreEmployee: false, currentUser: { playerId: 5, role: 'Player' } });
      const fixture = TestBed.createComponent(EventDetailComponent);
      fixture.detectChanges();
      eventPlayersSubject.next([waitlistedPlayer]);
      fixture.detectChanges();

      expect(fixture.componentInstance.myRegistration?.playerId).toBe(5);
      expect(fixture.componentInstance.myRegistration?.isWaitlisted).toBe(true);
    });
  });

  // ── Bulk Register dialog ───────────────────────────────────────────────────

  describe('Bulk Register', () => {
    const regEvent: EventDto = { ...eventStub, status: 'Registration' };

    it('Bulk Register Players button is visible for StoreEmployee', async () => {
      await setup({ isStoreEmployee: true });
      const fixture = TestBed.createComponent(EventDetailComponent);
      fixture.detectChanges();
      currentEventSubject.next(regEvent);
      fixture.detectChanges();
      const el: HTMLElement = fixture.nativeElement;
      const btn = Array.from(el.querySelectorAll('button')).find(b => b.textContent?.includes('Bulk Register'));
      expect(btn).toBeTruthy();
    });

    it('Bulk Register Players button is NOT visible for Player role', async () => {
      await setup({ isStoreEmployee: false });
      const fixture = TestBed.createComponent(EventDetailComponent);
      fixture.detectChanges();
      currentEventSubject.next(regEvent);
      fixture.detectChanges();
      const el: HTMLElement = fixture.nativeElement;
      const btn = Array.from(el.querySelectorAll('button')).find(b => b.textContent?.includes('Bulk Register'));
      expect(btn).toBeFalsy();
    });

    it('clicking Bulk Register opens MatDialog with correct data', async () => {
      await setup({ isStoreEmployee: true });
      const fixture = TestBed.createComponent(EventDetailComponent);
      fixture.detectChanges();
      currentEventSubject.next({ ...regEvent, maxPlayers: 8, playerCount: 4 });
      fixture.detectChanges();

      const dialogOpenSpy = jest.spyOn((fixture.componentInstance as any).dialog, 'open')
        .mockReturnValue({ afterClosed: () => of(undefined) });

      fixture.componentInstance.openBulkRegisterDialog();

      expect(dialogOpenSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({ eventId: EVENT_ID, availableSlots: 4 }),
        }),
      );
    });

    it('after dialog closes with result, snackbar shows summary and event reloads', async () => {
      await setup({ isStoreEmployee: true });
      const fixture = TestBed.createComponent(EventDetailComponent);
      fixture.detectChanges();
      currentEventSubject.next(regEvent);
      fixture.detectChanges();

      const closeSubject = new Subject<{ registered: number; created: number; errors: [] }>();
      jest.spyOn((fixture.componentInstance as any).dialog, 'open')
        .mockReturnValue({ afterClosed: () => closeSubject.asObservable() });
      const snackBarOpenSpy = jest.spyOn((fixture.componentInstance as any).snackBar, 'open').mockReturnValue({} as any);

      fixture.componentInstance.openBulkRegisterDialog();
      closeSubject.next({ registered: 3, created: 1, errors: [] });

      expect(snackBarOpenSpy).toHaveBeenCalledWith(
        expect.stringContaining('3 registered'),
        'OK',
        expect.any(Object),
      );
      expect(mockEventService.loadEventPlayers).toHaveBeenCalledWith(EVENT_ID);
      expect(mockEventService.loadEvent).toHaveBeenCalledWith(EVENT_ID);
    });

    it('after dialog closes with undefined (cancel), no snackbar or reload', async () => {
      await setup({ isStoreEmployee: true });
      const fixture = TestBed.createComponent(EventDetailComponent);
      fixture.detectChanges();
      currentEventSubject.next(regEvent);
      fixture.detectChanges();

      const closeSubject = new Subject<undefined>();
      jest.spyOn((fixture.componentInstance as any).dialog, 'open')
        .mockReturnValue({ afterClosed: () => closeSubject.asObservable() });
      const snackBarOpenSpy = jest.spyOn((fixture.componentInstance as any).snackBar, 'open').mockReturnValue({} as any);

      fixture.componentInstance.openBulkRegisterDialog();
      closeSubject.next(undefined);

      expect(snackBarOpenSpy).not.toHaveBeenCalled();
    });
  });

  // ── Commander autocomplete ─────────────────────────────────────────────────

  describe('Commander autocomplete', () => {
    let mockScryfallService: { getSuggestions: jest.Mock };

    beforeEach(() => {
      mockScryfallService = {
        getSuggestions: jest.fn().mockReturnValue(observableOf([])),
      };
    });

    async function setupWithScryfall(authOverrides: object = {}) {
      const mockAuth = {
        isStoreEmployee: true,
        isAdmin: false,
        currentUser: null,
        ...authOverrides,
      };
      await TestBed.configureTestingModule({
        imports: [EventDetailComponent],
        providers: [
          provideRouter([]),
          provideAnimationsAsync(),
          {
            provide: ActivatedRoute,
            useValue: { snapshot: { paramMap: { get: jest.fn().mockReturnValue(String(EVENT_ID)) } } },
          },
          { provide: Router,          useValue: mockRouter },
          { provide: EventService,    useValue: mockEventService },
          { provide: PlayerService,   useValue: mockPlayerService },
          { provide: AuthService,     useValue: mockAuth },
          { provide: MatSnackBar,     useValue: mockSnackBar },
          { provide: ScryfallService, useValue: mockScryfallService },
        ],
      }).compileComponents();
    }

    it('onCommanderInputChange calls ScryfallService.getSuggestions with the query', async () => {
      jest.useFakeTimers();
      mockScryfallService.getSuggestions.mockReturnValue(observableOf(["Atraxa, Praetors' Voice"]));
      await setupWithScryfall();
      const fixture = TestBed.createComponent(EventDetailComponent);
      fixture.detectChanges();

      fixture.componentInstance.onCommanderInputChange('atr');
      jest.advanceTimersByTime(300);

      expect(mockScryfallService.getSuggestions).toHaveBeenCalledWith('atr');
      jest.useRealTimers();
    });

    it('commanderSuggestions is populated from ScryfallService response', async () => {
      jest.useFakeTimers();
      mockScryfallService.getSuggestions.mockReturnValue(observableOf(["Atraxa, Praetors' Voice", 'Atarka, World Render']));
      await setupWithScryfall();
      const fixture = TestBed.createComponent(EventDetailComponent);
      fixture.detectChanges();

      fixture.componentInstance.onCommanderInputChange('atr');
      jest.advanceTimersByTime(300);

      expect(fixture.componentInstance.commanderSuggestions).toEqual([
        "Atraxa, Praetors' Voice",
        'Atarka, World Render',
      ]);
      jest.useRealTimers();
    });

    it('onCommanderInputChange with short query yields empty suggestions', async () => {
      jest.useFakeTimers();
      mockScryfallService.getSuggestions.mockReturnValue(observableOf([]));
      await setupWithScryfall();
      const fixture = TestBed.createComponent(EventDetailComponent);
      fixture.detectChanges();

      fixture.componentInstance.onCommanderInputChange('a');
      jest.advanceTimersByTime(300);

      // getSuggestions returns [] for single char — commanderSuggestions stays empty
      expect(fixture.componentInstance.commanderSuggestions).toEqual([]);
      jest.useRealTimers();
    });
  });

  // ── Free tier cap notice ───────────────────────────────────────────────────

  describe('Free tier cap notice', () => {
    it('cap notice visible when isTier1 = false (Free tier store employee)', async () => {
      await setup({ isStoreEmployee: true, isTier1: false });
      const fixture = TestBed.createComponent(EventDetailComponent);
      fixture.detectChanges();
      currentEventSubject.next({ ...eventStub, status: 'Registration' });
      fixture.detectChanges();
      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelector('.free-cap-notice')).not.toBeNull();
    });

    it('cap notice absent when isTier1 = true (Tier1+ store employee)', async () => {
      await setup({ isStoreEmployee: true, isTier1: true });
      const fixture = TestBed.createComponent(EventDetailComponent);
      fixture.detectChanges();
      currentEventSubject.next({ ...eventStub, status: 'Registration' });
      fixture.detectChanges();
      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelector('.free-cap-notice')).toBeNull();
    });
  });

  // ── Background upload ───────────────────────────────────────────────────────

  describe('Background upload', () => {
    it('upload button is visible for a StoreEmployee', async () => {
      await setup({ isStoreEmployee: true });
      const fixture = TestBed.createComponent(EventDetailComponent);
      fixture.detectChanges();
      currentEventSubject.next(eventStub);
      fixture.detectChanges();
      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelector('.upload-background-btn')).not.toBeNull();
    });

    it('onBackgroundSelected calls apiService.uploadEventBackground with the file', async () => {
      await setup({ isStoreEmployee: true });
      const fixture = TestBed.createComponent(EventDetailComponent);
      fixture.detectChanges();
      const comp = fixture.componentInstance;
      comp.eventId = EVENT_ID;
      const file = new File(['data'], 'bg.png', { type: 'image/png' });
      mockApiService.uploadEventBackground.mockReturnValue(of({ ...eventStub, backgroundImageUrl: '/backgrounds/event_7.png' }));
      comp.onBackgroundSelected({ target: { files: [file] } } as any);
      expect(mockApiService.uploadEventBackground).toHaveBeenCalledWith(EVENT_ID, file);
    });

    it('upload success applies a cache-busted backgroundImageUrl to event', async () => {
      await setup({ isStoreEmployee: true });
      const fixture = TestBed.createComponent(EventDetailComponent);
      fixture.detectChanges();
      const comp = fixture.componentInstance;
      comp.event = { ...eventStub };
      comp.eventId = EVENT_ID;
      const file = new File(['data'], 'bg.png', { type: 'image/png' });
      const returnedUrl = '/backgrounds/event_7.png';
      mockApiService.uploadEventBackground.mockReturnValue(
        of({ ...eventStub, backgroundImageUrl: returnedUrl }),
      );
      comp.onBackgroundSelected({ target: { files: [file] } } as any);
      expect(comp.event!.backgroundImageUrl).toMatch(/\/backgrounds\/event_7\.png\?t=\d+/);
    });

    it('upload error opens snackBar', async () => {
      await setup({ isStoreEmployee: true });
      const fixture = TestBed.createComponent(EventDetailComponent);
      fixture.detectChanges();
      const comp = fixture.componentInstance;
      comp.event = { ...eventStub };
      comp.eventId = EVENT_ID;
      const snackBarOpenSpy = jest.spyOn((comp as any).snackBar, 'open').mockReturnValue({} as any);
      const file = new File(['data'], 'bg.png', { type: 'image/png' });
      mockApiService.uploadEventBackground.mockReturnValue(throwError(() => new Error('upload failed')));
      comp.onBackgroundSelected({ target: { files: [file] } } as any);
      expect(snackBarOpenSpy).toHaveBeenCalled();
    });
  });
});
