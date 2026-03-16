import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BehaviorSubject, of } from 'rxjs';
import { PlayersComponent } from './players.component';
import { PlayerService } from '../../core/services/player.service';
import { AuthService } from '../../core/services/auth.service';
import { PlayerDto } from '../../core/models/api.models';

describe('PlayersComponent', () => {
  const playersSubject = new BehaviorSubject<PlayerDto[]>([]);

  const alice: PlayerDto = {
    id: 1, name: 'Alice', email: 'alice@test.com',
    mu: 25, sigma: 8.333, conservativeScore: 0,
    isRanked: false, placementGamesLeft: 5, isActive: true,
  };

  const bob: PlayerDto = {
    id: 2, name: 'Bob', email: 'bob@shop.com',
    mu: 25, sigma: 8.333, conservativeScore: 0,
    isRanked: false, placementGamesLeft: 5, isActive: true,
  };

  // Keep backward compat alias used in older tests
  const playerStub = alice;

  const mockPlayerService: Partial<PlayerService> = {
    players$:       playersSubject.asObservable(),
    loadAllPlayers: jest.fn(),
    registerPlayer: jest.fn().mockReturnValue(of(alice)),
    updatePlayer:   jest.fn().mockReturnValue(of(alice)),
  };

  const mockSnackBar = { open: jest.fn() };

  let mockAuthService: { isStoreEmployee: boolean };

  function createComponent(): ComponentFixture<PlayersComponent> {
    const fixture = TestBed.createComponent(PlayersComponent);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    playersSubject.next([]);
    mockAuthService = { isStoreEmployee: true };

    await TestBed.configureTestingModule({
      imports: [PlayersComponent],
      providers: [
        provideRouter([]),
        provideAnimationsAsync(),
        { provide: PlayerService, useValue: mockPlayerService },
        { provide: MatSnackBar,   useValue: mockSnackBar },
        { provide: AuthService,   useValue: mockAuthService },
      ],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = createComponent();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('calls loadAllPlayers on init', () => {
    createComponent();
    expect(mockPlayerService.loadAllPlayers).toHaveBeenCalledTimes(1);
  });

  it('renders player names from the subject', () => {
    playersSubject.next([alice]);
    const fixture = createComponent();
    expect(fixture.nativeElement.textContent).toContain('Alice');
  });

  // ── startEdit / cancelEdit ────────────────────────────────────────────────

  it('startEdit sets editingId and copies player fields', () => {
    const fixture = createComponent();
    const comp = fixture.componentInstance;

    comp.startEdit(playerStub);

    expect(comp.editingId).toBe(1);
    expect(comp.editName).toBe('Alice');
    expect(comp.editEmail).toBe('alice@test.com');
  });

  it('cancelEdit clears editingId', () => {
    const fixture = createComponent();
    const comp = fixture.componentInstance;
    comp.startEdit(playerStub);

    comp.cancelEdit();

    expect(comp.editingId).toBeNull();
  });

  // ── register() ────────────────────────────────────────────────────────────

  it('register() calls playerService.registerPlayer with current name/email', () => {
    const fixture = createComponent();
    const comp = fixture.componentInstance;
    comp.newName  = 'Bob';
    comp.newEmail = 'bob@test.com';

    comp.register();

    expect(mockPlayerService.registerPlayer).toHaveBeenCalledWith({ name: 'Bob', email: 'bob@test.com' });
  });

  it('register() clears form fields on success', () => {
    const fixture = createComponent();
    const comp = fixture.componentInstance;
    comp.newName  = 'Bob';
    comp.newEmail = 'bob@test.com';

    comp.register();

    expect(comp.newName).toBe('');
    expect(comp.newEmail).toBe('');
  });

  // ── saveEdit() ────────────────────────────────────────────────────────────

  it('saveEdit() calls playerService.updatePlayer with edited fields', () => {
    const fixture = createComponent();
    const comp = fixture.componentInstance;
    comp.editName  = 'Alice Updated';
    comp.editEmail = 'updated@test.com';

    comp.saveEdit(playerStub);

    expect(mockPlayerService.updatePlayer).toHaveBeenCalledWith(1, {
      name: 'Alice Updated', email: 'updated@test.com', isActive: true,
    });
  });

  it('saveEdit() clears editingId on success', () => {
    const fixture = createComponent();
    const comp = fixture.componentInstance;
    comp.startEdit(playerStub);

    comp.saveEdit(playerStub);

    expect(comp.editingId).toBeNull();
  });

  // ── sorting ───────────────────────────────────────────────────────────────

  it('sorts ranked players before unranked', () => {
    const ranked: PlayerDto   = { ...alice, id: 2, isRanked: true,  conservativeScore: 20 };
    const unranked: PlayerDto = { ...alice, id: 3, isRanked: false, placementGamesLeft: 3 };
    playersSubject.next([unranked, ranked]);

    const fixture = createComponent();
    const comp = fixture.componentInstance;

    expect(comp.dataSource.data[0].isRanked).toBe(true);
    expect(comp.dataSource.data[1].isRanked).toBe(false);
  });

  // ── filtering ─────────────────────────────────────────────────────────────

  describe('filtering', () => {
    let comp: PlayersComponent;

    beforeEach(() => {
      playersSubject.next([alice, bob]);
      comp = createComponent().componentInstance;
    });

    it('applyFilter updates dataSource.filter with JSON name and email', () => {
      comp.filterName  = 'alice';
      comp.filterEmail = 'shop';
      comp.applyFilter();
      const f = JSON.parse(comp.dataSource.filter);
      expect(f.name).toBe('alice');
      expect(f.email).toBe('shop');
    });

    it('name filter hides non-matching rows', () => {
      comp.filterName = 'alice';
      comp.applyFilter();
      expect(comp.dataSource.filteredData.length).toBe(1);
      expect(comp.dataSource.filteredData[0].name).toBe('Alice');
    });

    it('email filter hides non-matching rows', () => {
      comp.filterEmail = 'shop';
      comp.applyFilter();
      expect(comp.dataSource.filteredData.length).toBe(1);
      expect(comp.dataSource.filteredData[0].email).toBe('bob@shop.com');
    });

    it('AND logic — row must satisfy both filters', () => {
      comp.filterName  = 'alice';
      comp.filterEmail = 'shop';
      comp.applyFilter();
      // alice matches name but not email (@shop); bob matches email but not name
      expect(comp.dataSource.filteredData.length).toBe(0);
    });

    it('clearing filters shows all rows', () => {
      comp.filterName = 'alice';
      comp.applyFilter();
      expect(comp.dataSource.filteredData.length).toBe(1);

      comp.filterName = '';
      comp.applyFilter();
      expect(comp.dataSource.filteredData.length).toBe(2);
    });
  });

  // ── paginator ─────────────────────────────────────────────────────────────

  describe('paginator', () => {
    it('paginator is wired to dataSource after view init', () => {
      playersSubject.next([alice]);
      const comp = createComponent().componentInstance;
      expect(comp.dataSource.paginator).toBe(comp.paginator);
    });
  });

  // ── role gating ───────────────────────────────────────────────────────────

  describe('role gating', () => {
    it('register card is visible when isStoreEmployee is true', () => {
      mockAuthService.isStoreEmployee = true;
      playersSubject.next([alice]);
      const fixture = createComponent();
      expect(fixture.nativeElement.querySelector('.register-card')).not.toBeNull();
    });

    it('register card is hidden when isStoreEmployee is false', () => {
      mockAuthService.isStoreEmployee = false;
      playersSubject.next([alice]);
      const fixture = createComponent();
      expect(fixture.nativeElement.querySelector('.register-card')).toBeNull();
    });
  });
});
