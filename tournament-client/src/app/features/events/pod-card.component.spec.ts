import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterModule } from '@angular/router';
import { of, throwError } from 'rxjs';

import { PodCardComponent, PodResultState } from './pod-card.component';
import { EventService } from '../../core/services/event.service';
import { PodDto, EventDto } from '../../core/models/api.models';

// MatSnackBar is provided by Angular Material's root injector and can't be
// fully replaced via TestBed providers in a standalone-component test.
// We spy on the real injected instance instead.

// ─── Helpers ────────────────────────────────────────────────────────────────

function makePod(overrides: Partial<PodDto> = {}): PodDto {
  return {
    podId: 10,
    podNumber: 1,
    finishGroup: null,
    gameId: 99,
    gameStatus: 'Pending',
    winnerPlayerId: null,
    players: [
      { playerId: 1, name: 'Alice', seatOrder: 1 },
      { playerId: 2, name: 'Bob',   seatOrder: 2 },
      { playerId: 3, name: 'Carol', seatOrder: 3 },
      { playerId: 4, name: 'Dave',  seatOrder: 4 },
    ],
    ...overrides,
  } as PodDto;
}

function makeEvent(overrides: Partial<EventDto> = {}): EventDto {
  return {
    id: 7,
    name: 'Test Event',
    status: 'InProgress',
    pointSystem: 'ScoreBased',
    defaultRoundTimeMinutes: 50,
    ...overrides,
  } as EventDto;
}

function makePodState(overrides: Partial<PodResultState> = {}): PodResultState {
  return {
    winnerId: null,
    placements: [],
    submitted: false,
    isDraw: false,
    ...overrides,
  };
}

// ─── Suite ──────────────────────────────────────────────────────────────────

describe('PodCardComponent', () => {
  let fixture: ComponentFixture<PodCardComponent>;
  let component: PodCardComponent;
  let mockEventService: { submitGameResult: jest.Mock; revertGameResult: jest.Mock };
  let snackBarOpenSpy: jest.SpyInstance;

  beforeEach(async () => {
    mockEventService = {
      submitGameResult: jest.fn().mockReturnValue(of(undefined)),
      revertGameResult: jest.fn().mockReturnValue(of(undefined)),
    };

    await TestBed.configureTestingModule({
      imports: [PodCardComponent, RouterModule.forRoot([])],
      providers: [
        provideAnimationsAsync(),
        { provide: EventService, useValue: mockEventService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PodCardComponent);
    component = fixture.componentInstance;

    // Spy on the exact MatSnackBar instance injected into this component instance
    snackBarOpenSpy = jest.spyOn((component as any).snackBar, 'open').mockReturnValue({} as any);

    // Provide mandatory inputs before detectChanges
    component.pod           = makePod();
    component.event         = makeEvent();
    component.eventId       = 7;
    component.podState      = makePodState();
    component.isStoreEmployee = true;

    fixture.detectChanges();
  });

  // ─── Creation ─────────────────────────────────────────────────────────────

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // ─── timerState getter ────────────────────────────────────────────────────

  describe('timerState', () => {
    it('returns "idle" when podTimer ViewChild is absent (not yet rendered)', () => {
      // ViewChild is rendered only when isStoreEmployee && !submitted — already true,
      // but in a shallow unit test the inner component may not be instantiated yet.
      // We can test by temporarily removing the ViewChild reference.
      (component as any).podTimer = undefined;
      expect(component.timerState).toBe('idle');
    });

    it('delegates to podTimer.state when podTimer is present', () => {
      const fakeTimer = { state: 'running' as const };
      (component as any).podTimer = fakeTimer;
      expect(component.timerState).toBe('running');
    });
  });

  // ─── Timer delegation methods ─────────────────────────────────────────────

  describe('timer delegation', () => {
    let fakeTimer: { start: jest.Mock; pause: jest.Mock; resume: jest.Mock; addTime: jest.Mock };

    beforeEach(() => {
      fakeTimer = {
        start:   jest.fn(),
        pause:   jest.fn(),
        resume:  jest.fn(),
        addTime: jest.fn(),
      };
      (component as any).podTimer = fakeTimer;
    });

    it('startTimer() delegates to podTimer.start()', () => {
      component.startTimer();
      expect(fakeTimer.start).toHaveBeenCalledTimes(1);
    });

    it('pauseTimer() delegates to podTimer.pause()', () => {
      component.pauseTimer();
      expect(fakeTimer.pause).toHaveBeenCalledTimes(1);
    });

    it('resumeTimer() delegates to podTimer.resume()', () => {
      component.resumeTimer();
      expect(fakeTimer.resume).toHaveBeenCalledTimes(1);
    });

    it('addTime(90) delegates to podTimer.addTime(90)', () => {
      component.addTime(90);
      expect(fakeTimer.addTime).toHaveBeenCalledWith(90);
    });

    it('timer methods are safe when podTimer is absent', () => {
      (component as any).podTimer = undefined;
      expect(() => {
        component.startTimer();
        component.pauseTimer();
        component.resumeTimer();
        component.addTime(30);
      }).not.toThrow();
    });
  });

  // ─── onWinnerChanged ──────────────────────────────────────────────────────

  describe('onWinnerChanged()', () => {
    it('fills placements with non-winner players starting at position 2', () => {
      component.podState.winnerId = 1; // Alice wins
      component.onWinnerChanged();

      expect(component.podState.placements).toEqual([
        { playerId: 2, name: 'Bob',   position: 2, seatOrder: 2 },
        { playerId: 3, name: 'Carol', position: 3, seatOrder: 3 },
        { playerId: 4, name: 'Dave',  position: 4, seatOrder: 4 },
      ]);
    });

    it('excludes only the current winner from placements', () => {
      component.podState.winnerId = 3; // Carol wins
      component.onWinnerChanged();

      const ids = component.podState.placements.map(p => p.playerId);
      expect(ids).not.toContain(3);
      expect(ids).toEqual([1, 2, 4]);
    });

    it('re-sequences positions from 2 regardless of which player won', () => {
      component.podState.winnerId = 4; // Dave wins
      component.onWinnerChanged();

      const positions = component.podState.placements.map(p => p.position);
      expect(positions).toEqual([2, 3, 4]);
    });

    it('works for a 3-player pod — produces 2 placements', () => {
      component.pod = makePod({
        players: [
          { playerId: 1, name: 'Alice', seatOrder: 1 },
          { playerId: 2, name: 'Bob',   seatOrder: 2 },
          { playerId: 3, name: 'Carol', seatOrder: 3 },
        ],
      } as Partial<PodDto>);
      component.podState.winnerId = 1;
      component.onWinnerChanged();

      expect(component.podState.placements).toHaveLength(2);
      expect(component.podState.placements.map(p => p.position)).toEqual([2, 3]);
    });
  });

  // ─── getPositionOptions ───────────────────────────────────────────────────

  describe('getPositionOptions()', () => {
    it('returns [2, 3, 4] for a 4-player pod', () => {
      expect(component.getPositionOptions()).toEqual([2, 3, 4]);
    });

    it('returns [2, 3] for a 3-player pod', () => {
      component.pod = makePod({
        players: [
          { playerId: 1, name: 'Alice', seatOrder: 1 },
          { playerId: 2, name: 'Bob',   seatOrder: 2 },
          { playerId: 3, name: 'Carol', seatOrder: 3 },
        ],
      } as Partial<PodDto>);
      expect(component.getPositionOptions()).toEqual([2, 3]);
    });

    it('returns [2, 3, 4, 5] for a 5-player pod', () => {
      component.pod = makePod({
        players: [
          { playerId: 1, name: 'A', seatOrder: 1 },
          { playerId: 2, name: 'B', seatOrder: 2 },
          { playerId: 3, name: 'C', seatOrder: 3 },
          { playerId: 4, name: 'D', seatOrder: 4 },
          { playerId: 5, name: 'E', seatOrder: 5 },
        ],
      } as Partial<PodDto>);
      expect(component.getPositionOptions()).toEqual([2, 3, 4, 5]);
    });
  });

  // ─── getPositionLabel ─────────────────────────────────────────────────────

  describe('getPositionLabel()', () => {
    it.each([
      [1, '1st'],
      [2, '2nd'],
      [3, '3rd'],
      [4, '4th'],
      [5, '5th'],
    ])('position %i → "%s"', (pos, expected) => {
      expect(component.getPositionLabel(pos)).toBe(expected);
    });

    it('falls back to "${pos}th" for positions beyond index 5', () => {
      expect(component.getPositionLabel(6)).toBe('6th');
    });
  });

  // ─── submitPodResult ──────────────────────────────────────────────────────

  describe('submitPodResult()', () => {
    beforeEach(() => {
      component.podState.winnerId = 1;
      component.podState.placements = [
        { playerId: 2, name: 'Bob',   position: 2, seatOrder: 2 },
        { playerId: 3, name: 'Carol', position: 3, seatOrder: 3 },
        { playerId: 4, name: 'Dave',  position: 4, seatOrder: 4 },
      ];
    });

    it('does nothing when winnerId is null', () => {
      component.podState.winnerId = null;
      component.submitPodResult();
      expect(mockEventService.submitGameResult).not.toHaveBeenCalled();
    });

    it('calls submitGameResult with the correct gameId and eventId', () => {
      component.submitPodResult();
      expect(mockEventService.submitGameResult).toHaveBeenCalledWith(
        99, // pod.gameId
        expect.any(Array),
        7   // eventId
      );
    });

    it('sends winner as finishPosition 1 and others at their placement position', () => {
      component.submitPodResult();
      const [, results] = mockEventService.submitGameResult.mock.calls[0];
      expect(results[0]).toMatchObject({ playerId: 1, finishPosition: 1 });
      expect(results[1]).toMatchObject({ playerId: 2, finishPosition: 2 });
      expect(results[2]).toMatchObject({ playerId: 3, finishPosition: 3 });
      expect(results[3]).toMatchObject({ playerId: 4, finishPosition: 4 });
    });

    it('sets submitted = true on success', () => {
      component.submitPodResult();
      expect(component.podState.submitted).toBe(true);
    });

    it('emits stateChanged on success', () => {
      const spy = jest.spyOn(component.stateChanged, 'emit');
      component.submitPodResult();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('shows success snackbar on success', () => {
      component.submitPodResult();
      expect(snackBarOpenSpy).toHaveBeenCalledWith('Results submitted!', 'OK', { duration: 3000 });
    });

    it('shows error snackbar and does not set submitted on failure', () => {
      mockEventService.submitGameResult.mockReturnValue(
        throwError(() => ({ error: { error: 'Server error' } }))
      );
      component.submitPodResult();
      expect(component.podState.submitted).toBe(false);
      expect(snackBarOpenSpy).toHaveBeenCalledWith('Server error', 'OK', { duration: 3000 });
    });

    it('falls back to generic message when error has no error.error', () => {
      mockEventService.submitGameResult.mockReturnValue(throwError(() => ({})));
      component.submitPodResult();
      expect(snackBarOpenSpy).toHaveBeenCalledWith(
        'Failed to submit results', 'OK', { duration: 3000 }
      );
    });

    it('does not emit stateChanged on failure', () => {
      mockEventService.submitGameResult.mockReturnValue(throwError(() => ({})));
      const spy = jest.spyOn(component.stateChanged, 'emit');
      component.submitPodResult();
      expect(spy).not.toHaveBeenCalled();
    });
  });

  // ─── submitDraw ───────────────────────────────────────────────────────────

  describe('submitDraw()', () => {
    it('calls submitGameResult with all players at position = playerCount', () => {
      component.submitDraw();
      const [, results] = mockEventService.submitGameResult.mock.calls[0];
      expect(results).toHaveLength(4);
      results.forEach((r: any) => expect(r.finishPosition).toBe(4));
    });

    it('includes every player in the draw results', () => {
      component.submitDraw();
      const [, results] = mockEventService.submitGameResult.mock.calls[0];
      const ids = results.map((r: any) => r.playerId);
      expect(ids).toEqual([1, 2, 3, 4]);
    });

    it('sets submitted = true on success', () => {
      component.submitDraw();
      expect(component.podState.submitted).toBe(true);
    });

    it('sets isDraw = true on success', () => {
      component.submitDraw();
      expect(component.podState.isDraw).toBe(true);
    });

    it('emits stateChanged on success', () => {
      const spy = jest.spyOn(component.stateChanged, 'emit');
      component.submitDraw();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('shows draw snackbar on success', () => {
      component.submitDraw();
      expect(snackBarOpenSpy).toHaveBeenCalledWith(
        'Draw recorded — 1 point each', 'OK', { duration: 3000 }
      );
    });

    it('shows error snackbar on failure and does not set submitted', () => {
      mockEventService.submitGameResult.mockReturnValue(
        throwError(() => ({ error: { error: 'Draw failed' } }))
      );
      component.submitDraw();
      expect(component.podState.submitted).toBe(false);
      expect(component.podState.isDraw).toBe(false);
      expect(snackBarOpenSpy).toHaveBeenCalledWith('Draw failed', 'OK', { duration: 3000 });
    });

    it('falls back to generic message when error has no error.error', () => {
      mockEventService.submitGameResult.mockReturnValue(throwError(() => ({})));
      component.submitDraw();
      expect(snackBarOpenSpy).toHaveBeenCalledWith(
        'Failed to submit draw', 'OK', { duration: 3000 }
      );
    });
  });

  // ─── revertPod ────────────────────────────────────────────────────────────

  describe('revertPod()', () => {
    beforeEach(() => {
      // Start with a submitted pod
      component.podState.submitted = true;
      component.podState.isDraw    = true;
      component.podState.winnerId  = 2;
      component.podState.placements = [
        { playerId: 1, name: 'Alice', position: 2, seatOrder: 1 },
      ];
    });

    it('calls revertGameResult with the correct gameId and eventId', () => {
      component.revertPod();
      expect(mockEventService.revertGameResult).toHaveBeenCalledWith(99, 7);
    });

    it('sets submitted = false on success', () => {
      component.revertPod();
      expect(component.podState.submitted).toBe(false);
    });

    it('sets isDraw = false on success', () => {
      component.revertPod();
      expect(component.podState.isDraw).toBe(false);
    });

    it('sets winnerId = null on success', () => {
      component.revertPod();
      expect(component.podState.winnerId).toBeNull();
    });

    it('clears placements on success', () => {
      component.revertPod();
      expect(component.podState.placements).toEqual([]);
    });

    it('emits stateChanged on success', () => {
      const spy = jest.spyOn(component.stateChanged, 'emit');
      component.revertPod();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('shows revert snackbar on success', () => {
      component.revertPod();
      expect(snackBarOpenSpy).toHaveBeenCalledWith('Result reverted', 'OK', { duration: 3000 });
    });

    it('shows error snackbar on failure and leaves podState unchanged', () => {
      mockEventService.revertGameResult.mockReturnValue(
        throwError(() => ({ error: { error: 'Cannot revert' } }))
      );
      component.revertPod();
      expect(component.podState.submitted).toBe(true); // unchanged
      expect(snackBarOpenSpy).toHaveBeenCalledWith('Cannot revert', 'OK', { duration: 3000 });
    });

    it('falls back to generic message when error has no error.error', () => {
      mockEventService.revertGameResult.mockReturnValue(throwError(() => ({})));
      component.revertPod();
      expect(snackBarOpenSpy).toHaveBeenCalledWith(
        'Failed to revert result', 'OK', { duration: 3000 }
      );
    });

    it('does not emit stateChanged on failure', () => {
      mockEventService.revertGameResult.mockReturnValue(throwError(() => ({})));
      const spy = jest.spyOn(component.stateChanged, 'emit');
      component.revertPod();
      expect(spy).not.toHaveBeenCalled();
    });
  });

  // ─── buildDefaultResult (via submitPodResult) ────────────────────────────

  describe('buildDefaultResult (verified through submitPodResult)', () => {
    it('always sends eliminations=0, turnsSurvived=0, conceded=false, null commander/colors', () => {
      component.podState.winnerId = 1;
      component.podState.placements = [];
      component.submitPodResult();
      const [, results] = mockEventService.submitGameResult.mock.calls[0];
      expect(results[0]).toEqual({
        playerId: 1,
        finishPosition: 1,
        eliminations: 0,
        turnsSurvived: 0,
        commanderPlayed: null,
        deckColors: null,
        conceded: false,
      });
    });
  });
});
