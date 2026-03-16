import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { of } from 'rxjs';
import { PairingsDisplayComponent } from './pairings-display.component';
import { ApiService } from '../../core/services/api.service';
import { PairingsDto } from '../../core/models/api.models';

const makePairings = (overrides: Partial<PairingsDto> = {}): PairingsDto => ({
  eventId: 1,
  eventName: 'Friday Night Magic',
  currentRound: 1,
  pods: [
    {
      podId: 10,
      podNumber: 1,
      gameStatus: 'Pending',
      winnerPlayerId: null,
      players: [
        { playerId: 1, name: 'Alice', commanderName: 'Atraxa', seatOrder: 1 },
        { playerId: 2, name: 'Bob',   commanderName: null,     seatOrder: 2 },
        { playerId: 3, name: 'Carol', commanderName: null,     seatOrder: 3 },
        { playerId: 4, name: 'Dave',  commanderName: null,     seatOrder: 4 },
      ],
    },
  ],
  ...overrides,
});

describe('PairingsDisplayComponent', () => {
  let mockApiService: { getEventPairings: jest.Mock };

  beforeEach(async () => {
    jest.useFakeTimers();
    mockApiService = { getEventPairings: jest.fn().mockReturnValue(of(makePairings())) };

    await TestBed.configureTestingModule({
      imports: [PairingsDisplayComponent],
      providers: [
        provideAnimationsAsync(),
        { provide: ApiService, useValue: mockApiService },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => '1' } } } },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders pod cards with player names', () => {
    const fixture = TestBed.createComponent(PairingsDisplayComponent);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    const playerRows = el.querySelectorAll('.player-row');
    expect(playerRows.length).toBe(4);
    expect(el.querySelector('h1')?.textContent).toContain('Friday Night Magic');
    expect(el.querySelector('h1')?.textContent).toContain('1');
  });

  it('shows waiting message when currentRound is null', () => {
    mockApiService.getEventPairings.mockReturnValue(of(makePairings({ currentRound: null, pods: [] })));
    const fixture = TestBed.createComponent(PairingsDisplayComponent);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.waiting-message')).toBeTruthy();
    expect(el.querySelectorAll('mat-card.pod-card').length).toBe(0);
  });

  it('shows commander name when present', () => {
    const fixture = TestBed.createComponent(PairingsDisplayComponent);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    const commanderSpans = el.querySelectorAll('.commander-name');
    expect(commanderSpans.length).toBeGreaterThan(0);
    expect(commanderSpans[0].textContent).toContain('Atraxa');
  });

  it('calls getEventPairings again after REFRESH_INTERVAL_MS', () => {
    const fixture = TestBed.createComponent(PairingsDisplayComponent);
    fixture.detectChanges();
    expect(mockApiService.getEventPairings).toHaveBeenCalledTimes(1);

    const component = fixture.componentInstance;
    jest.advanceTimersByTime(component.REFRESH_INTERVAL_MS);
    fixture.detectChanges();
    expect(mockApiService.getEventPairings).toHaveBeenCalledTimes(2);

    fixture.destroy();
  });

  it('shows winner badge for the winning player', () => {
    const pairings = makePairings();
    pairings.pods[0].gameStatus = 'Completed';
    pairings.pods[0].winnerPlayerId = 1; // Alice wins
    mockApiService.getEventPairings.mockReturnValue(of(pairings));
    const fixture = TestBed.createComponent(PairingsDisplayComponent);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.winner-badge')).toBeTruthy();
    expect(el.querySelector('.player-row.winner .player-name')?.textContent).toContain('Alice');
    expect(el.querySelector('.game-status.completed')).toBeTruthy();
  });

  it('shows Draw badge when gameStatus is Draw', () => {
    const pairings = makePairings();
    pairings.pods[0].gameStatus = 'Draw';
    pairings.pods[0].winnerPlayerId = null;
    mockApiService.getEventPairings.mockReturnValue(of(pairings));
    const fixture = TestBed.createComponent(PairingsDisplayComponent);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.game-status.draw')).toBeTruthy();
    expect(el.querySelector('.winner-badge')).toBeFalsy();
  });

  it('clears interval on destroy', () => {
    const fixture = TestBed.createComponent(PairingsDisplayComponent);
    fixture.detectChanges();
    fixture.destroy();

    jest.advanceTimersByTime(60_000);
    // Still only the initial call — no more after destroy
    expect(mockApiService.getEventPairings).toHaveBeenCalledTimes(1);
  });
});
