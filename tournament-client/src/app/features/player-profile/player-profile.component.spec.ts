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
import { PlayerProfile, PlayerDto, CommanderStatDto, ScryfallCard, RatingSnapshotDto, RatingHistoryDto, PlayerBadgeDto } from '../../core/models/api.models';

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
    getRatingHistory:   jest.Mock;
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
      getRatingHistory:   jest.fn().mockReturnValue(of({ playerId: PLAYER_ID, history: [] })),
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
      getRatingHistory:   jest.fn().mockReturnValue(of({ playerId: PLAYER_ID, history: [] })),
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
        getRatingHistory:     jest.fn().mockReturnValue(of({ playerId: PLAYER_ID, history: [] })),
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
          getRatingHistory: jest.fn().mockReturnValue(of({ playerId: PLAYER_ID, history: [] })),
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

// ── Card Preview Panel ─────────────────────────────────────────────────────────

describe('PlayerProfileComponent — card preview panel', () => {
  const PLAYER_ID = 1;

  const mockCard: ScryfallCard = {
    name: 'Lightning Bolt',
    image_uris: { normal: 'https://cards.scryfall.io/normal/bolt.jpg', large: 'https://cards.scryfall.io/large/bolt.jpg' },
    prices: { usd: '0.50', usd_foil: '3.00' },
    purchase_uris: { tcgplayer: 'https://tcgplayer.com/bolt', cardkingdom: 'https://cardkingdom.com/bolt' },
  };

  const dfcCard: ScryfallCard = {
    name: 'Delver of Secrets',
    card_faces: [
      { image_uris: { normal: 'https://cards.scryfall.io/normal/delver-front.jpg', large: '' } },
    ],
    prices: { usd: '2.00', usd_foil: null },
    purchase_uris: { tcgplayer: 'https://tcgplayer.com/delver' },
  };

  function makeProfile(): PlayerProfile {
    return {
      id: PLAYER_ID, name: 'Alice', email: 'alice@test.com',
      mu: 25, sigma: 8.333, conservativeScore: 0,
      isRanked: false, placementGamesLeft: 5, isActive: true,
      gameHistory: [], eventRegistrations: [],
    };
  }

  let mockScryfallService: { getSuggestions: jest.Mock; getCard: jest.Mock };

  async function setup(getCardResult: ScryfallCard | null = mockCard) {
    mockScryfallService = {
      getSuggestions: jest.fn().mockReturnValue(of([])),
      getCard: jest.fn().mockReturnValue(of(getCardResult)),
    };

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
          getRatingHistory: jest.fn().mockReturnValue(of({ playerId: PLAYER_ID, history: [] })),
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

  it('selectedCard is null on init', async () => {
    await setup();
    const fixture = TestBed.createComponent(PlayerProfileComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.selectedCard).toBeNull();
  });

  it('onCardClick sets selectedCardName and calls getCard', async () => {
    await setup();
    const fixture = TestBed.createComponent(PlayerProfileComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;

    comp.onCardClick('Lightning Bolt', new MouseEvent('click'));
    fixture.detectChanges();

    expect(mockScryfallService.getCard).toHaveBeenCalledWith('Lightning Bolt');
    expect(comp.selectedCardName).toBe('Lightning Bolt');
    expect(comp.selectedCard).toEqual(mockCard);
  });

  it('onCardClick on same card twice dismisses the panel', async () => {
    await setup();
    const fixture = TestBed.createComponent(PlayerProfileComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;

    comp.onCardClick('Lightning Bolt', new MouseEvent('click'));
    fixture.detectChanges();
    comp.onCardClick('Lightning Bolt', new MouseEvent('click'));
    fixture.detectChanges();

    expect(comp.selectedCard).toBeNull();
    expect(comp.selectedCardName).toBeNull();
  });

  it('dismissCard clears selectedCard and selectedCardName', async () => {
    await setup();
    const fixture = TestBed.createComponent(PlayerProfileComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;

    comp.onCardClick('Lightning Bolt', new MouseEvent('click'));
    fixture.detectChanges();
    comp.dismissCard();
    fixture.detectChanges();

    expect(comp.selectedCard).toBeNull();
    expect(comp.selectedCardName).toBeNull();
  });

  it('getCardImageUrl returns image_uris.normal for standard card', async () => {
    await setup();
    const fixture = TestBed.createComponent(PlayerProfileComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    comp.onCardClick('Lightning Bolt', new MouseEvent('click'));
    fixture.detectChanges();

    expect(comp.getCardImageUrl()).toBe('https://cards.scryfall.io/normal/bolt.jpg');
  });

  it('getCardImageUrl falls back to card_faces[0] for double-faced cards', async () => {
    await setup(dfcCard);
    const fixture = TestBed.createComponent(PlayerProfileComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    comp.onCardClick('Delver of Secrets', new MouseEvent('click'));
    fixture.detectChanges();

    expect(comp.getCardImageUrl()).toBe('https://cards.scryfall.io/normal/delver-front.jpg');
  });

  it('getCardImageUrl returns null when no card is selected', async () => {
    await setup();
    const fixture = TestBed.createComponent(PlayerProfileComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.getCardImageUrl()).toBeNull();
  });

  it('getCard returning null keeps selectedCardName but sets selectedCard to null', async () => {
    await setup(null);
    const fixture = TestBed.createComponent(PlayerProfileComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;

    comp.onCardClick('UnknownCard', new MouseEvent('click'));
    fixture.detectChanges();

    expect(comp.selectedCardName).toBe('UnknownCard');
    expect(comp.selectedCard).toBeNull();
  });
});

// ── Rating History ────────────────────────────────────────────────────────────

describe('PlayerProfileComponent — Rating History', () => {
  const PLAYER_ID = 1;

  const profileStub: PlayerProfile = {
    id: PLAYER_ID, name: 'Alice', email: 'alice@test.com',
    mu: 25, sigma: 8.333, conservativeScore: 0,
    isRanked: true, placementGamesLeft: 0, isActive: true,
    gameHistory: [], eventRegistrations: [],
  };

  function makeSnapshot(overrides: Partial<RatingSnapshotDto> = {}): RatingSnapshotDto {
    return {
      date: '2024-01-01T00:00:00',
      conservativeScore: 5.0,
      eventName: 'Test Event',
      roundNumber: 1,
      ...overrides,
    };
  }

  let mockPlayerService: { getProfile: jest.Mock; updatePlayer: jest.Mock };
  let mockApi: {
    getWishlist:        jest.Mock;
    getWishlistSupply:  jest.Mock;
    getTradeList:       jest.Mock;
    getSuggestedTrades: jest.Mock;
    getTradeDemand:     jest.Mock;
    getCommanderStats:  jest.Mock;
    getRatingHistory:   jest.Mock;
  };
  let mockCtx: { players: { getById: jest.Mock; getAll: jest.Mock } };
  let mockAuth: { currentUser: null };
  let mockDialog: { open: jest.Mock };
  let mockSnackBar: { open: jest.Mock };

  async function setup(history: RatingSnapshotDto[]) {
    mockPlayerService = {
      getProfile:   jest.fn().mockReturnValue(of(profileStub)),
      updatePlayer: jest.fn().mockReturnValue(of(profileStub)),
    };
    const historyDto: RatingHistoryDto = { playerId: PLAYER_ID, history };
    mockApi = {
      getWishlist:        jest.fn().mockReturnValue(of([])),
      getWishlistSupply:  jest.fn().mockReturnValue(of([])),
      getTradeList:       jest.fn().mockReturnValue(of([])),
      getSuggestedTrades: jest.fn().mockReturnValue(of([])),
      getTradeDemand:     jest.fn().mockReturnValue(of([])),
      getCommanderStats:  jest.fn().mockReturnValue(of({ playerId: PLAYER_ID, commanders: [] })),
      getRatingHistory:   jest.fn().mockReturnValue(of({ playerId: PLAYER_ID, history: [] })),
      getRatingHistory:   jest.fn().mockReturnValue(of(historyDto)),
    };
    const cachedPlayer: PlayerDto = {
      id: PLAYER_ID, name: 'Alice', email: 'alice@test.com',
      mu: 25, sigma: 8.333, conservativeScore: 0,
      isRanked: true, placementGamesLeft: 0, isActive: true,
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

  it('getRatingHistory is called in ngOnInit', async () => {
    await setup([makeSnapshot(), makeSnapshot()]);
    TestBed.createComponent(PlayerProfileComponent).detectChanges();
    expect(mockApi.getRatingHistory).toHaveBeenCalledWith(PLAYER_ID);
  });

  it('chart section is rendered when ratingHistory has 2+ entries', async () => {
    await setup([makeSnapshot(), makeSnapshot(), makeSnapshot()]);
    const fixture = TestBed.createComponent(PlayerProfileComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.rating-history-section')).not.toBeNull();
  });

  it('chart canvas is present when ratingHistory has 2+ entries', async () => {
    await setup([makeSnapshot(), makeSnapshot()]);
    const fixture = TestBed.createComponent(PlayerProfileComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('canvas')).not.toBeNull();
  });

  it('chart section is hidden when ratingHistory has 1 entry', async () => {
    await setup([makeSnapshot()]);
    const fixture = TestBed.createComponent(PlayerProfileComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.rating-history-section')).toBeNull();
  });

  it('chart section is hidden when ratingHistory is empty', async () => {
    await setup([]);
    const fixture = TestBed.createComponent(PlayerProfileComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.rating-history-section')).toBeNull();
  });

  it('ratingChartData is mapped correctly from history snapshots', async () => {
    const snapshots = [
      makeSnapshot({ date: '2024-01-01T00:00:00', conservativeScore: 3.5 }),
      makeSnapshot({ date: '2024-02-01T00:00:00', conservativeScore: 7.2 }),
    ];
    await setup(snapshots);
    const fixture = TestBed.createComponent(PlayerProfileComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    const dataset = comp.ratingChartData.datasets[0];
    expect(dataset.data).toEqual([3.5, 7.2]);
  });
});

// ── Badges ────────────────────────────────────────────────────────────────────

describe('PlayerProfileComponent — Badges', () => {
  const PLAYER_ID = 1;

  function makeProfileWithBadges(badges?: PlayerBadgeDto[]): PlayerProfile {
    return {
      id: PLAYER_ID, name: 'Alice', email: 'alice@test.com',
      mu: 25, sigma: 8.333, conservativeScore: 0,
      isRanked: true, 
      placementGamesLeft: 0,
      isActive: true,
      gameHistory: [],
      eventRegistrations: [],
      badges,
    };
  }
  function makeBadge(overrides: Partial<PlayerBadgeDto> = {}): PlayerBadgeDto {
    return { badgeKey: 'first_win', displayName: 'First Win', awardedAt: '2026-01-01T00:00:00Z', eventId: null, ...overrides };
  }

  function makeProfile(badges?: PlayerBadgeDto[]): PlayerProfile {
    return {
      id: PLAYER_ID, name: 'Alice', email: 'alice@test.com',
      mu: 25, sigma: 8.333, conservativeScore: 0,
      isRanked: false, placementGamesLeft: 5, isActive: true,
      gameHistory: [], eventRegistrations: [],
      badges,
    };
  }

  async function setup(profile: PlayerProfile) {
    const mockPlayerService = {
      getProfile:   jest.fn().mockReturnValue(of(profile)),
      updatePlayer: jest.fn().mockReturnValue(of(profile)),
    };
    const mockApi = {
      getWishlist:        jest.fn().mockReturnValue(of([])),
      getWishlistSupply:  jest.fn().mockReturnValue(of([])),
      getTradeList:       jest.fn().mockReturnValue(of([])),
      getSuggestedTrades: jest.fn().mockReturnValue(of([])),
      getTradeDemand:     jest.fn().mockReturnValue(of([])),
      getCommanderStats:  jest.fn().mockReturnValue(of({ playerId: PLAYER_ID, commanders: [] })),
      getRatingHistory:   jest.fn().mockReturnValue(of({ playerId: PLAYER_ID, history: [] })),
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
        { provide: MatDialog,           useValue: { open: jest.fn().mockReturnValue({ afterClosed: () => of(false) }) } },
        { provide: MatSnackBar,         useValue: { open: jest.fn() } },
      ],
    }).compileComponents();
  }

  afterEach(() => TestBed.resetTestingModule());

  it('renders Achievements section when profile.badges is non-empty', async () => {
    const badge = makeBadge();
    await setup(makeProfile([badge]));
    const fixture = TestBed.createComponent(PlayerProfileComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Achievements');
  });

  it('renders badge chip with display name', async () => {
    const badge = makeBadge({ badgeKey: 'veteran', displayName: 'Veteran' });
    await setup(makeProfile([badge]));
    const fixture = TestBed.createComponent(PlayerProfileComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Veteran');
  });

  it('Achievements section is absent when badges is empty array', async () => {
    await setup(makeProfile([]));
    const fixture = TestBed.createComponent(PlayerProfileComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).not.toContain('Achievements');
  });

  it('Achievements section is absent when badges is undefined', async () => {
    await setup(makeProfile(undefined));
    const fixture = TestBed.createComponent(PlayerProfileComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).not.toContain('Achievements');
  });

  it('each badge chip shows correct icon for known badge key', async () => {
    const badge = makeBadge({ badgeKey: 'first_win', displayName: 'First Win' });
    await setup(makeProfile([badge]));
    const fixture = TestBed.createComponent(PlayerProfileComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.badgeIcon('first_win')).toBe('emoji_events');
    expect(fixture.componentInstance.badgeIcon('veteran')).toBe('shield');
    expect(fixture.componentInstance.badgeIcon('tournament_winner')).toBe('workspace_premium');
  });

  it('badgeIcon returns grade for unknown key', async () => {
    await setup(makeProfile([]));
    const fixture = TestBed.createComponent(PlayerProfileComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.badgeIcon('unknown_key')).toBe('grade');
  });
});
