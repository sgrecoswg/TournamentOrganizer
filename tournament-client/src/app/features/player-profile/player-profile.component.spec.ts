import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { ActivatedRoute } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';
import { ScryfallService } from '../../core/services/scryfall.service';
import { PlayerProfileComponent } from './player-profile.component';
import { PlayerService } from '../../core/services/player.service';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { LocalStorageContext } from '../../core/services/local-storage-context.service';
import { PlayerProfile, PlayerDto, CommanderStatDto } from '../../core/models/api.models';

describe('PlayerProfileComponent (smoke)', () => {
  const profileStub: PlayerProfile = {
    id: 1, name: 'Alice', email: 'alice@test.com',
    mu: 25, sigma: 8.333, conservativeScore: 0,
    isRanked: false, placementGamesLeft: 5, isActive: true,
    gameHistory: [], eventRegistrations: []
  };

  const mockPlayerService: Partial<PlayerService> = {
    getProfile: jest.fn().mockReturnValue(of(profileStub)),
    updatePlayer: jest.fn().mockReturnValue(of(profileStub)),
  };

  const mockSnackBar = { open: jest.fn() };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlayerProfileComponent],
      providers: [
        provideRouter([]),
        provideAnimationsAsync(),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => '1' } } },
        },
        { provide: PlayerService, useValue: mockPlayerService },
        { provide: MatSnackBar, useValue: mockSnackBar },
      ],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(PlayerProfileComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should call getProfile with the route id on init', () => {
    TestBed.createComponent(PlayerProfileComponent);
    expect(mockPlayerService.getProfile).toHaveBeenCalledWith(1);
  });

  it('should render player name after profile loads', () => {
    const fixture = TestBed.createComponent(PlayerProfileComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Alice');
  });

  it('getWins() returns 0 when game history is empty', () => {
    const fixture = TestBed.createComponent(PlayerProfileComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.getWins()).toBe(0);
  });

});

// ── Tab visibility by API state ───────────────────────────────────────────────

describe('PlayerProfileComponent — tab visibility by API state', () => {
  const PLAYER_ID = 1;

  const profileStub: PlayerProfile = {
    id: PLAYER_ID, name: 'Alice', email: 'alice@test.com',
    mu: 25, sigma: 8.333, conservativeScore: 0,
    isRanked: false, placementGamesLeft: 5, isActive: true,
    gameHistory: [], eventRegistrations: [],
  };

  const cachedPlayer: PlayerDto = {
    id: PLAYER_ID, name: 'Alice', email: 'alice@test.com',
    mu: 25, sigma: 8.333, conservativeScore: 0,
    isRanked: false, placementGamesLeft: 5, isActive: true,
  };

  let mockPlayerService: { getProfile: jest.Mock; updatePlayer: jest.Mock };
  let mockApi: {
    getWishlist:        jest.Mock;
    getWishlistSupply:  jest.Mock;
    getTradeList:       jest.Mock;
    getSuggestedTrades: jest.Mock;
    getTradeDemand:     jest.Mock;
    getCommanderStats:  jest.Mock;
  };
  let mockCtx: { players: { getById: jest.Mock; getAll: jest.Mock } };
  let mockAuth: { currentUser: null };
  let mockDialog: { open: jest.Mock };
  let mockSnackBar: { open: jest.Mock };

  async function setup(profileResult: 'online' | 'offline') {
    mockPlayerService = {
      getProfile:   jest.fn().mockReturnValue(
        profileResult === 'online' ? of(profileStub) : throwError(() => new Error('offline'))
      ),
      updatePlayer: jest.fn().mockReturnValue(of(profileStub)),
    };
    mockApi = {
      getWishlist:        jest.fn().mockReturnValue(of([])),
      getWishlistSupply:  jest.fn().mockReturnValue(of([])),
      getTradeList:       jest.fn().mockReturnValue(of([])),
      getSuggestedTrades: jest.fn().mockReturnValue(of([])),
      getTradeDemand:     jest.fn().mockReturnValue(of([])),
      getCommanderStats:  jest.fn().mockReturnValue(of({ playerId: PLAYER_ID, commanders: [] })),
    };
    mockCtx     = { players: { getById: jest.fn().mockReturnValue(cachedPlayer), getAll: jest.fn().mockReturnValue([]) } };
    mockAuth    = { currentUser: null };
    mockDialog  = { open: jest.fn().mockReturnValue({ afterClosed: () => of(false) }) };
    mockSnackBar = { open: jest.fn() };

    await TestBed.configureTestingModule({
      imports: [PlayerProfileComponent],
      providers: [
        provideRouter([]),
        provideAnimationsAsync(),
        { provide: ActivatedRoute,      useValue: { snapshot: { paramMap: { get: () => String(PLAYER_ID) } } } },
        { provide: PlayerService,       useValue: mockPlayerService },
        { provide: ApiService,          useValue: mockApi },
        { provide: LocalStorageContext, useValue: mockCtx },
        { provide: AuthService,         useValue: mockAuth },
        { provide: MatDialog,           useValue: mockDialog },
        { provide: MatSnackBar,         useValue: mockSnackBar },
      ],
    }).compileComponents();
  }

  afterEach(() => TestBed.resetTestingModule());

  // ── Online path ─────────────────────────────────────────────────────────────

  it('apiOnline is true when getProfile succeeds', async () => {
    await setup('online');
    const fixture = TestBed.createComponent(PlayerProfileComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.apiOnline).toBe(true);
  });

  it('all 5 load methods are called on init when API is online', async () => {
    await setup('online');
    TestBed.createComponent(PlayerProfileComponent).detectChanges();
    expect(mockApi.getWishlist).toHaveBeenCalledWith(PLAYER_ID);
    expect(mockApi.getWishlistSupply).toHaveBeenCalledWith(PLAYER_ID);
    expect(mockApi.getTradeList).toHaveBeenCalledWith(PLAYER_ID);
    expect(mockApi.getSuggestedTrades).toHaveBeenCalledWith(PLAYER_ID);
    expect(mockApi.getTradeDemand).toHaveBeenCalledWith(PLAYER_ID);
  });

  it('tab buttons are rendered when API is online', async () => {
    await setup('online');
    const fixture = TestBed.createComponent(PlayerProfileComponent);
    fixture.detectChanges();
    const tabs = Array.from<Element>(fixture.nativeElement.querySelectorAll('[role="tab"]'));
    const labels = tabs.map(t => t.textContent?.trim());
    expect(labels).toContain('History');
    expect(labels).toContain('Trading');
  });

  // ── Offline path ─────────────────────────────────────────────────────────────

  it('apiOnline is false when getProfile errors', async () => {
    await setup('offline');
    const fixture = TestBed.createComponent(PlayerProfileComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.apiOnline).toBe(false);
  });

  it('no load methods are called when API is offline', async () => {
    await setup('offline');
    TestBed.createComponent(PlayerProfileComponent).detectChanges();
    expect(mockApi.getWishlist).not.toHaveBeenCalled();
    expect(mockApi.getWishlistSupply).not.toHaveBeenCalled();
    expect(mockApi.getTradeList).not.toHaveBeenCalled();
    expect(mockApi.getSuggestedTrades).not.toHaveBeenCalled();
    expect(mockApi.getTradeDemand).not.toHaveBeenCalled();
  });

  it('tab buttons are NOT rendered when API is offline', async () => {
    await setup('offline');
    const fixture = TestBed.createComponent(PlayerProfileComponent);
    fixture.detectChanges();
    const tabs = Array.from<Element>(fixture.nativeElement.querySelectorAll('[role="tab"]'));
    const labels = tabs.map(t => t.textContent?.trim());
    expect(labels).not.toContain('History');
    expect(labels).not.toContain('Trading');
  });

  it('player name is still shown from cache when API is offline', async () => {
    await setup('offline');
    const fixture = TestBed.createComponent(PlayerProfileComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Alice');
  });
});

// ── Commander Stats ───────────────────────────────────────────────────────────

describe('PlayerProfileComponent — Commander Stats', () => {
  const PLAYER_ID = 1;
  const profileStub: PlayerProfile = {
    id: PLAYER_ID, name: 'Alice', email: 'alice@test.com',
    mu: 25, sigma: 8.333, conservativeScore: 0,
    isRanked: true, placementGamesLeft: 0, isActive: true,
    gameHistory: [], eventRegistrations: [],
  };

  function makeCommanderStat(overrides: Partial<CommanderStatDto> = {}): CommanderStatDto {
    return { commanderName: 'Atraxa', gamesPlayed: 5, wins: 3, avgFinish: 1.8, ...overrides };
  }

  async function setup(commanders: CommanderStatDto[]) {
    const mockPlayerService = {
      getProfile:   jest.fn().mockReturnValue(of(profileStub)),
      updatePlayer: jest.fn().mockReturnValue(of(profileStub)),
    };
    const mockApi = {
      getWishlist:        jest.fn().mockReturnValue(of([])),
      getWishlistSupply:  jest.fn().mockReturnValue(of([])),
      getTradeList:       jest.fn().mockReturnValue(of([])),
      getSuggestedTrades: jest.fn().mockReturnValue(of([])),
      getTradeDemand:     jest.fn().mockReturnValue(of([])),
      getCommanderStats:  jest.fn().mockReturnValue(of({ playerId: PLAYER_ID, commanders })),
    };
    const mockCtx  = { players: { getById: jest.fn().mockReturnValue(null), getAll: jest.fn().mockReturnValue([]) } };
    const mockAuth = { currentUser: null };

    await TestBed.configureTestingModule({
      imports: [PlayerProfileComponent],
      providers: [
        provideRouter([]),
        provideAnimationsAsync(),
        { provide: ActivatedRoute,      useValue: { snapshot: { paramMap: { get: () => String(PLAYER_ID) } } } },
        { provide: PlayerService,       useValue: mockPlayerService },
        { provide: ApiService,          useValue: mockApi },
        { provide: LocalStorageContext, useValue: mockCtx },
        { provide: AuthService,         useValue: mockAuth },
        { provide: MatDialog,           useValue: { open: jest.fn() } },
        { provide: MatSnackBar,         useValue: { open: jest.fn() } },
      ],
    }).compileComponents();
  }

  afterEach(() => TestBed.resetTestingModule());

  it('shows My Commanders heading and row when commander data is present', async () => {
    await setup([makeCommanderStat()]);
    const fixture = TestBed.createComponent(PlayerProfileComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('My Commanders');
    expect(el.textContent).toContain('Atraxa');
  });

  it('shows correct win % for a commander', async () => {
    // 3 wins / 5 games = 60.0%
    await setup([makeCommanderStat({ gamesPlayed: 5, wins: 3 })]);
    const fixture = TestBed.createComponent(PlayerProfileComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('60.0%');
  });

  it('hides My Commanders section when commanders list is empty', async () => {
    await setup([]);
    const fixture = TestBed.createComponent(PlayerProfileComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('My Commanders');
  });

  it('shows 0.0% win rate when gamesPlayed is 0 (guards against NaN)', async () => {
    await setup([makeCommanderStat({ gamesPlayed: 0, wins: 0 })]);
    const fixture = TestBed.createComponent(PlayerProfileComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('0.0%');
  });
});

// ── Avatar ────────────────────────────────────────────────────────────────────

describe('PlayerProfileComponent — Avatar', () => {
  const PLAYER_ID = 1;

  function makeProfile(avatarUrl: string | null = null): PlayerProfile {
    return {
      id: PLAYER_ID, name: 'Alice', email: 'alice@test.com',
      mu: 25, sigma: 8.333, conservativeScore: 0,
      isRanked: false, placementGamesLeft: 5, isActive: true,
      gameHistory: [], eventRegistrations: [],
      avatarUrl,
    };
  }

  function makeAuthService(opts: { isAdmin?: boolean; isStoreManager?: boolean; email?: string } = {}) {
    return {
      currentUser: opts.email ? { id: 1, email: opts.email, name: 'Test', role: 'Player' } : null,
      isAdmin: opts.isAdmin ?? false,
      isStoreManager: opts.isStoreManager ?? false,
    };
  }

  function makeMockApi(uploadResult?: any) {
    return {
      getWishlist:          jest.fn().mockReturnValue(of([])),
      getWishlistSupply:    jest.fn().mockReturnValue(of([])),
      getTradeList:         jest.fn().mockReturnValue(of([])),
      getSuggestedTrades:   jest.fn().mockReturnValue(of([])),
      getTradeDemand:       jest.fn().mockReturnValue(of([])),
      getCommanderStats:    jest.fn().mockReturnValue(of({ playerId: PLAYER_ID, commanders: [] })),
      uploadPlayerAvatar:   jest.fn().mockReturnValue(uploadResult ?? of({ id: PLAYER_ID, avatarUrl: '/avatars/1.png' })),
      removePlayerAvatar:   jest.fn().mockReturnValue(of({ id: PLAYER_ID, avatarUrl: null })),
    };
  }

  async function setup(profile: PlayerProfile, auth: ReturnType<typeof makeAuthService>, mockApi = makeMockApi()) {
    await TestBed.configureTestingModule({
      imports: [PlayerProfileComponent],
      providers: [
        provideRouter([]),
        provideAnimationsAsync(),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => String(PLAYER_ID) } } } },
        { provide: PlayerService, useValue: { getProfile: jest.fn().mockReturnValue(of(profile)), updatePlayer: jest.fn().mockReturnValue(of(profile)), refreshPlayersFromApi: jest.fn().mockReturnValue(of(undefined)) } },
        { provide: ApiService, useValue: mockApi },
        { provide: LocalStorageContext, useValue: { players: { getById: jest.fn(), getAll: jest.fn().mockReturnValue([]) } } },
        { provide: AuthService, useValue: auth },
        { provide: MatDialog, useValue: { open: jest.fn() } },
        { provide: MatSnackBar, useValue: { open: jest.fn() } },
      ],
    }).compileComponents();
  }

  afterEach(() => TestBed.resetTestingModule());

  it('renders img.player-avatar when avatarUrl is set', async () => {
    await setup(makeProfile('/avatars/1.png'), makeAuthService());
    const fixture = TestBed.createComponent(PlayerProfileComponent);
    fixture.detectChanges();
    const img = fixture.nativeElement.querySelector('img.player-avatar');
    expect(img).toBeTruthy();
    expect(img.src).toContain('/avatars/1.png');
  });

  it('renders div.player-avatar-placeholder when avatarUrl is null', async () => {
    await setup(makeProfile(null), makeAuthService());
    const fixture = TestBed.createComponent(PlayerProfileComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('div.player-avatar-placeholder')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('img.player-avatar')).toBeFalsy();
  });

  it('upload button visible when canManageAvatar (own player by email)', async () => {
    await setup(makeProfile(), makeAuthService({ email: 'alice@test.com' }));
    const fixture = TestBed.createComponent(PlayerProfileComponent);
    fixture.detectChanges();
    const btn = Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('button'))
      .find(b => b.getAttribute('mattooltip') === 'Upload avatar' || b.getAttribute('ng-reflect-message') === 'Upload avatar');
    expect(btn).toBeTruthy();
  });

  it('upload button NOT visible for different player (Player role, different email)', async () => {
    await setup(makeProfile(), makeAuthService({ email: 'other@test.com' }));
    const fixture = TestBed.createComponent(PlayerProfileComponent);
    fixture.detectChanges();
    const avatarSection = fixture.nativeElement.querySelector('.avatar-actions');
    expect(avatarSection).toBeFalsy();
  });

  it('upload button visible for StoreManager', async () => {
    await setup(makeProfile(), makeAuthService({ isStoreManager: true }));
    const fixture = TestBed.createComponent(PlayerProfileComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.avatar-actions')).toBeTruthy();
  });

  it('upload button visible for Admin', async () => {
    await setup(makeProfile(), makeAuthService({ isAdmin: true }));
    const fixture = TestBed.createComponent(PlayerProfileComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.avatar-actions')).toBeTruthy();
  });

  it('remove button visible when avatarUrl is set and canManageAvatar', async () => {
    await setup(makeProfile('/avatars/1.png'), makeAuthService({ isAdmin: true }));
    const fixture = TestBed.createComponent(PlayerProfileComponent);
    fixture.detectChanges();
    const btn = Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('button'))
      .find(b => b.getAttribute('mattooltip') === 'Remove avatar' || b.getAttribute('ng-reflect-message') === 'Remove avatar');
    expect(btn).toBeTruthy();
  });

  it('remove button absent when avatarUrl is null', async () => {
    await setup(makeProfile(null), makeAuthService({ isAdmin: true }));
    const fixture = TestBed.createComponent(PlayerProfileComponent);
    fixture.detectChanges();
    const btn = Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('button'))
      .find(b => b.getAttribute('mattooltip') === 'Remove avatar' || b.getAttribute('ng-reflect-message') === 'Remove avatar');
    expect(btn).toBeFalsy();
  });

  it('onAvatarFileSelected calls uploadPlayerAvatar and updates avatarUrl on success', async () => {
    const mockApi = makeMockApi(of({ id: PLAYER_ID, avatarUrl: '/avatars/1.png?t=1' }));
    await setup(makeProfile(), makeAuthService({ isAdmin: true }), mockApi);
    const fixture = TestBed.createComponent(PlayerProfileComponent);
    fixture.detectChanges();

    const comp = fixture.componentInstance;
    const file = new File(['data'], 'avatar.png', { type: 'image/png' });
    const event = { target: { files: [file] } } as unknown as Event;
    comp.onAvatarFileSelected(event);

    expect(mockApi.uploadPlayerAvatar).toHaveBeenCalledWith(PLAYER_ID, file);
    fixture.detectChanges();
    expect(comp.profile?.avatarUrl).toContain('/avatars/1.png');
  });

  it('onAvatarFileSelected shows error snackbar on failure', async () => {
    const mockApi = makeMockApi(throwError(() => new Error('upload failed')));
    await setup(makeProfile(), makeAuthService({ isAdmin: true }), mockApi);
    const fixture = TestBed.createComponent(PlayerProfileComponent);
    fixture.detectChanges();
    const snackBarSpy = jest.spyOn((fixture.componentInstance as any).snackBar, 'open').mockReturnValue({} as any);
    const file = new File(['data'], 'avatar.png', { type: 'image/png' });
    fixture.componentInstance.onAvatarFileSelected({ target: { files: [file] } } as unknown as Event);
    expect(snackBarSpy).toHaveBeenCalledWith(expect.stringContaining('failed'), 'Close', expect.anything());
  });

  it('removeAvatar calls removePlayerAvatar and clears avatarUrl on success', async () => {
    const mockApi = makeMockApi();
    await setup(makeProfile('/avatars/1.png'), makeAuthService({ isAdmin: true }), mockApi);
    const fixture = TestBed.createComponent(PlayerProfileComponent);
    fixture.detectChanges();
    fixture.componentInstance.removeAvatar();
    expect(mockApi.removePlayerAvatar).toHaveBeenCalledWith(PLAYER_ID);
    fixture.detectChanges();
    expect(fixture.componentInstance.profile?.avatarUrl).toBeNull();
  });
});

// ── Card name autocomplete ──────────────────────────────────────────────────

describe('PlayerProfileComponent — card name autocomplete', () => {
  const PLAYER_ID = 1;

  function makeProfile(): PlayerProfile {
    return {
      id: PLAYER_ID, name: 'Alice', email: 'alice@test.com',
      mu: 25, sigma: 8.333, conservativeScore: 0,
      isRanked: false, placementGamesLeft: 5, isActive: true,
      gameHistory: [], eventRegistrations: [],
    };
  }

  let mockScryfallService: { getSuggestions: jest.Mock };

  async function setup() {
    mockScryfallService = { getSuggestions: jest.fn().mockReturnValue(of([])) };

    await TestBed.configureTestingModule({
      imports: [PlayerProfileComponent],
      providers: [
        provideRouter([]),
        provideAnimationsAsync(),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => String(PLAYER_ID) } } } },
        { provide: PlayerService, useValue: { getProfile: jest.fn().mockReturnValue(of(makeProfile())), updatePlayer: jest.fn().mockReturnValue(of(makeProfile())), refreshPlayersFromApi: jest.fn().mockReturnValue(of(undefined)) } },
        { provide: ApiService, useValue: {
          getWishlist: jest.fn().mockReturnValue(of([])),
          getWishlistSupply: jest.fn().mockReturnValue(of([])),
          getTradeList: jest.fn().mockReturnValue(of([])),
          getSuggestedTrades: jest.fn().mockReturnValue(of([])),
          getTradeDemand: jest.fn().mockReturnValue(of([])),
          getCommanderStats: jest.fn().mockReturnValue(of({ playerId: PLAYER_ID, commanders: [] })),
        }},
        { provide: LocalStorageContext, useValue: { players: { getById: jest.fn(), getAll: jest.fn().mockReturnValue([]) } } },
        { provide: AuthService, useValue: { currentUser: null, isAdmin: false, isStoreManager: false } },
        { provide: MatDialog, useValue: { open: jest.fn() } },
        { provide: MatSnackBar, useValue: { open: jest.fn() } },
        { provide: ScryfallService, useValue: mockScryfallService },
      ],
    }).compileComponents();
  }

  afterEach(() => TestBed.resetTestingModule());

  it('onWishlistCardChange calls ScryfallService and populates wishlistSuggestions', async () => {
    await setup();
    jest.useFakeTimers();
    mockScryfallService.getSuggestions.mockReturnValue(of(['Sol Ring', 'Sol Talisman']));
    const fixture = TestBed.createComponent(PlayerProfileComponent);
    fixture.detectChanges();

    fixture.componentInstance.onWishlistCardChange('sol');
    jest.advanceTimersByTime(300);

    expect(mockScryfallService.getSuggestions).toHaveBeenCalledWith('sol');
    expect(fixture.componentInstance.wishlistSuggestions).toEqual(['Sol Ring', 'Sol Talisman']);
    jest.useRealTimers();
  });

  it('onTradeCardChange calls ScryfallService and populates tradeSuggestions', async () => {
    await setup();
    jest.useFakeTimers();
    mockScryfallService.getSuggestions.mockReturnValue(of(['Sol Ring']));
    const fixture = TestBed.createComponent(PlayerProfileComponent);
    fixture.detectChanges();

    fixture.componentInstance.onTradeCardChange('sol');
    jest.advanceTimersByTime(300);

    expect(mockScryfallService.getSuggestions).toHaveBeenCalledWith('sol');
    expect(fixture.componentInstance.tradeSuggestions).toEqual(['Sol Ring']);
    jest.useRealTimers();
  });

  it('short query yields empty wishlistSuggestions', async () => {
    await setup();
    jest.useFakeTimers();
    const fixture = TestBed.createComponent(PlayerProfileComponent);
    fixture.detectChanges();

    fixture.componentInstance.onWishlistCardChange('s');
    jest.advanceTimersByTime(300);

    expect(fixture.componentInstance.wishlistSuggestions).toEqual([]);
    jest.useRealTimers();
  });

  it('wishlist and trade suggestions are independent', async () => {
    await setup();
    jest.useFakeTimers();
    mockScryfallService.getSuggestions
      .mockReturnValueOnce(of(['Lightning Bolt']))
      .mockReturnValueOnce(of(['Sol Ring']));
    const fixture = TestBed.createComponent(PlayerProfileComponent);
    fixture.detectChanges();

    fixture.componentInstance.onWishlistCardChange('lig');
    jest.advanceTimersByTime(300);
    fixture.componentInstance.onTradeCardChange('sol');
    jest.advanceTimersByTime(300);

    expect(fixture.componentInstance.wishlistSuggestions).toEqual(['Lightning Bolt']);
    expect(fixture.componentInstance.tradeSuggestions).toEqual(['Sol Ring']);
    jest.useRealTimers();
  });
});
