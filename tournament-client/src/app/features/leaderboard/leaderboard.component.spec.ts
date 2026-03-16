import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { BehaviorSubject } from 'rxjs';
import { LeaderboardComponent } from './leaderboard.component';
import { PlayerService } from '../../core/services/player.service';
import { LeaderboardEntry } from '../../core/models/api.models';

describe('LeaderboardComponent', () => {
  const leaderboardSubject = new BehaviorSubject<LeaderboardEntry[]>([]);

  const mockPlayerService: Partial<PlayerService> = {
    leaderboard$:    leaderboardSubject.asObservable(),
    loadLeaderboard: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    leaderboardSubject.next([]);

    await TestBed.configureTestingModule({
      imports: [LeaderboardComponent],
      providers: [
        provideRouter([]),
        provideAnimationsAsync(),
        { provide: PlayerService, useValue: mockPlayerService },
      ],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(LeaderboardComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('calls loadLeaderboard on init', () => {
    const fixture = TestBed.createComponent(LeaderboardComponent);
    fixture.detectChanges();
    expect(mockPlayerService.loadLeaderboard).toHaveBeenCalledTimes(1);
  });

  it('shows empty-state message when no ranked players', () => {
    const fixture = TestBed.createComponent(LeaderboardComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('No ranked players yet');
  });

  it('renders a row for each leaderboard entry', () => {
    const entries: LeaderboardEntry[] = [
      { rank: 1, playerId: 1, name: 'Alice', conservativeScore: 25, mu: 30, sigma: 5 },
      { rank: 2, playerId: 2, name: 'Bob',   conservativeScore: 20, mu: 26, sigma: 6 },
    ];
    leaderboardSubject.next(entries);

    const fixture = TestBed.createComponent(LeaderboardComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    expect(el.textContent).toContain('Alice');
    expect(el.textContent).toContain('Bob');
  });

  it('exposes the correct column definitions', () => {
    const fixture = TestBed.createComponent(LeaderboardComponent);
    expect(fixture.componentInstance.columns).toEqual(['rank', 'name', 'score', 'mu', 'sigma']);
  });
});
