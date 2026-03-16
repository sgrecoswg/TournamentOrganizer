import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { ActivatedRoute } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';
import { PlayerProfileComponent } from './player-profile.component';
import { PlayerService } from '../../core/services/player.service';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { LocalStorageContext } from '../../core/services/local-storage-context.service';
import { PlayerProfile, PlayerDto } from '../../core/models/api.models';

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
    getWishlist:       jest.Mock;
    getWishlistSupply: jest.Mock;
    getTradeList:      jest.Mock;
    getSuggestedTrades: jest.Mock;
    getTradeDemand:    jest.Mock;
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
