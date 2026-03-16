import { firstValueFrom, of, throwError } from 'rxjs';
import { EventService } from './event.service';
import {
  EventDto, EventPlayerDto, GameResultSubmit,
  RegisterPlayerDto, RoundDto, StandingsEntry,
} from '../models/api.models';

describe('EventService', () => {
  let service: EventService;

  let mockApi: {
    getAllEvents: jest.Mock;
    getEvent: jest.Mock;
    createEvent: jest.Mock;
    registerForEvent: jest.Mock;
    updateEventStatus: jest.Mock;
    getEventPlayers: jest.Mock;
    removeEvent: jest.Mock;
    dropPlayer: jest.Mock;
    disqualifyPlayer: jest.Mock;
    getRounds: jest.Mock;
    generateNextRound: jest.Mock;
    submitGameResult: jest.Mock;
    getStandings: jest.Mock;
    revertGameResult: jest.Mock;
  };

  let mockCtx: {
    events: { getAll: jest.Mock; getById: jest.Mock; add: jest.Mock; update: jest.Mock; seed: jest.Mock };
    players: { getAll: jest.Mock; getById: jest.Mock };
    rounds: { getAll: jest.Mock };
    gameResults: { getAll: jest.Mock; getPending: jest.Mock };
    activeStorePrefix: string;
  };

  let mockStorage: { getItem: jest.Mock; setItem: jest.Mock };

  const eventStub: EventDto = {
    id: 1, name: 'Test Event', date: '2025-01-01',
    status: 'Registration', playerCount: 0,
    defaultRoundTimeMinutes: 60, maxPlayers: null,
  };

  const roundStub: RoundDto = { roundId: 1, roundNumber: 1, pods: [] };

  const standingsStub: StandingsEntry[] = [
    { rank: 1, playerId: 1, playerName: 'Alice', totalPoints: 3, tiebreaker: 0, finishPositions: [1], gameResults: [] },
  ];

  beforeEach(() => {
    mockApi = {
      getAllEvents:      jest.fn().mockReturnValue(of([])),
      getEvent:         jest.fn().mockReturnValue(of(eventStub)),
      createEvent:      jest.fn().mockReturnValue(of(eventStub)),
      registerForEvent: jest.fn().mockReturnValue(of({})),
      updateEventStatus: jest.fn().mockReturnValue(of(eventStub)),
      getEventPlayers:  jest.fn().mockReturnValue(of([])),
      removeEvent:      jest.fn().mockReturnValue(of({})),
      dropPlayer:       jest.fn().mockReturnValue(of({})),
      disqualifyPlayer: jest.fn().mockReturnValue(of({})),
      getRounds:        jest.fn().mockReturnValue(of([])),
      generateNextRound: jest.fn().mockReturnValue(of(roundStub)),
      submitGameResult: jest.fn().mockReturnValue(of({})),
      getStandings:     jest.fn().mockReturnValue(of([])),
      revertGameResult: jest.fn().mockReturnValue(of({})),
    };

    mockCtx = {
      events: {
        getAll:  jest.fn().mockReturnValue([]),
        getById: jest.fn().mockReturnValue(null),
        add:     jest.fn().mockImplementation(dto => ({ id: -1, ...dto })),
        update:  jest.fn(),
        remove:  jest.fn(),
        seed:    jest.fn(),
      },
      players: {
        getAll:  jest.fn().mockReturnValue([]),
        getById: jest.fn().mockReturnValue(null),
      },
      rounds:      { getAll: jest.fn().mockReturnValue([]) },
      gameResults: { getAll: jest.fn().mockReturnValue([]), getPending: jest.fn().mockReturnValue({ added: [] }) },
      activeStorePrefix: 'to_store_1',
    };

    mockStorage = {
      getItem: jest.fn().mockReturnValue(null),
      setItem: jest.fn(),
    };

    service = new EventService(mockApi as any, mockCtx as any, mockStorage as any);
  });

  // ── Initial state ─────────────────────────────────────────────────────────

  describe('initial state', () => {
    it('events$ starts as empty array', async () => {
      expect(await firstValueFrom(service.events$)).toEqual([]);
    });

    it('currentEvent$ starts as null', async () => {
      expect(await firstValueFrom(service.currentEvent$)).toBeNull();
    });

    it('eventPlayers$ starts as empty array', async () => {
      expect(await firstValueFrom(service.eventPlayers$)).toEqual([]);
    });

    it('rounds$ starts as empty array', async () => {
      expect(await firstValueFrom(service.rounds$)).toEqual([]);
    });

    it('standings$ starts as empty array', async () => {
      expect(await firstValueFrom(service.standings$)).toEqual([]);
    });
  });

  // ── loadAllEvents (local-first) ───────────────────────────────────────────

  describe('loadAllEvents', () => {
    it('emits from cache without calling the API when cache has data', async () => {
      mockCtx.events.getAll.mockReturnValue([eventStub]);

      service.loadAllEvents();

      expect(mockApi.getAllEvents).not.toHaveBeenCalled();
      expect(await firstValueFrom(service.events$)).toEqual([eventStub]);
    });

    it('calls the API when cache is empty and seeds ctx', async () => {
      mockApi.getAllEvents.mockReturnValue(of([eventStub]));
      mockCtx.events.getAll
        .mockReturnValueOnce([])
        .mockReturnValue([eventStub]);

      service.loadAllEvents();

      expect(mockApi.getAllEvents).toHaveBeenCalledTimes(1);
      expect(mockCtx.events.seed).toHaveBeenCalledWith([eventStub]);
    });
  });

  // ── loadEvent (local-first) ───────────────────────────────────────────────

  describe('loadEvent', () => {
    it('emits from local ctx when event is cached', async () => {
      mockCtx.events.getById.mockReturnValue(eventStub);

      service.loadEvent(1);

      expect(mockApi.getEvent).not.toHaveBeenCalled();
      expect(await firstValueFrom(service.currentEvent$)).toEqual(eventStub);
    });

    it('calls API when event is not in local ctx', async () => {
      service.loadEvent(1);

      expect(mockApi.getEvent).toHaveBeenCalledWith(1);
    });
  });

  // ── createEvent (local-first) ─────────────────────────────────────────────

  describe('createEvent', () => {
    it('adds the event to ctx and returns it — does NOT call api.createEvent', async () => {
      const dto = { name: 'New Event', date: '2025-06-01', defaultRoundTimeMinutes: 60 };
      const newEvent = { id: -1, ...dto, status: 'Registration', playerCount: 0 };
      mockCtx.events.add.mockReturnValue(newEvent);
      mockCtx.events.getAll.mockReturnValue([newEvent]);

      const result = await firstValueFrom(service.createEvent(dto));

      expect(mockCtx.events.add).toHaveBeenCalled();
      expect(mockApi.createEvent).not.toHaveBeenCalled();
      expect(result.name).toBe('New Event');
    });
  });

  // ── removeEvent ───────────────────────────────────────────────────────────

  describe('removeEvent', () => {
    it('delegates to api.removeEvent for positive IDs', async () => {
      await firstValueFrom(service.removeEvent(5));
      expect(mockApi.removeEvent).toHaveBeenCalledWith(5);
    });
  });

  // ── dropPlayer ────────────────────────────────────────────────────────────

  describe('dropPlayer', () => {
    it('delegates to api.dropPlayer', async () => {
      await firstValueFrom(service.dropPlayer(1, 7));
      expect(mockApi.dropPlayer).toHaveBeenCalledWith(1, 7);
    });
  });

  // ── disqualifyPlayer ──────────────────────────────────────────────────────

  describe('disqualifyPlayer', () => {
    it('delegates to api.disqualifyPlayer', async () => {
      await firstValueFrom(service.disqualifyPlayer(1, 7));
      expect(mockApi.disqualifyPlayer).toHaveBeenCalledWith(1, 7);
    });
  });

  // ── loadRounds ────────────────────────────────────────────────────────────

  describe('loadRounds', () => {
    it('calls api.getRounds for positive event IDs and pushes result', async () => {
      mockApi.getRounds.mockReturnValue(of([roundStub]));

      service.loadRounds(1);
      const result = await firstValueFrom(service.rounds$);

      expect(mockApi.getRounds).toHaveBeenCalledWith(1);
      expect(result).toEqual([roundStub]);
    });
  });

  // ── generateNextRound$ ────────────────────────────────────────────────────

  describe('generateNextRound$', () => {
    it('returns the api.generateNextRound observable', async () => {
      const result = await firstValueFrom(service.generateNextRound$(1));
      expect(mockApi.generateNextRound).toHaveBeenCalledWith(1);
      expect(result).toEqual(roundStub);
    });
  });

  // ── submitGameResult ──────────────────────────────────────────────────────

  describe('submitGameResult', () => {
    it('delegates to api.submitGameResult for positive game IDs', async () => {
      const results: GameResultSubmit[] = [
        { playerId: 1, finishPosition: 1, eliminations: 2, turnsSurvived: 10,
          commanderPlayed: null, deckColors: null, conceded: false },
      ];

      await firstValueFrom(service.submitGameResult(99, results));

      expect(mockApi.submitGameResult).toHaveBeenCalledWith(99, results);
    });
  });

  // ── loadStandings ─────────────────────────────────────────────────────────

  describe('loadStandings', () => {
    it('calls api.getStandings for positive event IDs and pushes result', async () => {
      mockApi.getStandings.mockReturnValue(of(standingsStub));

      service.loadStandings(1);
      const result = await firstValueFrom(service.standings$);

      expect(mockApi.getStandings).toHaveBeenCalledWith(1);
      expect(result).toEqual(standingsStub);
    });
  });

  // ── addRound / clearRounds ────────────────────────────────────────────────

  // ── updateStatus ─────────────────────────────────────────────────────────

  describe('updateStatus()', () => {
    describe('online path (API succeeds)', () => {
      it('delegates to api.updateEventStatus', async () => {
        await firstValueFrom(service.updateStatus(1, 'InProgress', 4));
        expect(mockApi.updateEventStatus).toHaveBeenCalledWith(1, 'InProgress', 4);
      });
    });

    describe('offline path (API fails) — positive event ID', () => {
      beforeEach(() => {
        mockApi.updateEventStatus.mockReturnValue(throwError(() => ({ status: 500 })));
        mockCtx.events.getById.mockReturnValue({ ...eventStub, id: 1, status: 'Registration', plannedRounds: null });
      });

      it('completes without throwing', async () => {
        await expect(firstValueFrom(service.updateStatus(1, 'InProgress', 4))).resolves.not.toThrow();
      });

      it('updates the event status in ctx', async () => {
        await firstValueFrom(service.updateStatus(1, 'InProgress', 4));
        expect(mockCtx.events.update).toHaveBeenCalledWith(
          expect.objectContaining({ status: 'InProgress' })
        );
      });

      it('stores plannedRounds when provided', async () => {
        await firstValueFrom(service.updateStatus(1, 'InProgress', 4));
        expect(mockCtx.events.update).toHaveBeenCalledWith(
          expect.objectContaining({ plannedRounds: 4 })
        );
      });

      it('emits the updated event on currentEvent$', async () => {
        await firstValueFrom(service.updateStatus(1, 'InProgress', 4));
        const evt = await firstValueFrom(service.currentEvent$);
        expect(evt?.status).toBe('InProgress');
      });
    });
  });

  // ── registerPlayer ───────────────────────────────────────────────────────

  describe('registerPlayer()', () => {
    const playerStub = {
      id: 42, name: 'Alice', email: 'a@b.com',
      isActive: true, isRanked: true, conservativeScore: 20,
      mu: 25, sigma: 8.333, placementGamesLeft: 0,
    };
    const dto: RegisterPlayerDto = { playerId: 42 };

    describe('online path (API succeeds)', () => {
      it('calls api.registerForEvent with the correct args', async () => {
        mockCtx.players.getById.mockReturnValue(playerStub);
        await firstValueFrom(service.registerPlayer(1, dto));
        expect(mockApi.registerForEvent).toHaveBeenCalledWith(1, dto);
      });

      it('adds the player to eventPlayers$ on success', async () => {
        mockCtx.players.getById.mockReturnValue(playerStub);
        await firstValueFrom(service.registerPlayer(1, dto));
        const players = await firstValueFrom(service.eventPlayers$);
        expect(players.some(p => p.playerId === 42)).toBe(true);
      });
    });

    describe('offline path (network unreachable — no HTTP status) — positive event ID', () => {
      beforeEach(() => {
        // Simulate a true network failure: no HTTP status (e.g. ERR_CONNECTION_REFUSED).
        // HTTP 4xx/5xx errors from a running API are rethrown and should NOT fall back locally.
        mockApi.registerForEvent.mockReturnValue(throwError(() => new Error('Network error')));
        mockCtx.players.getById.mockReturnValue(playerStub);
        mockCtx.events.getById.mockReturnValue({ ...eventStub, id: 1, playerCount: 2 });
      });

      it('completes without throwing', async () => {
        await expect(firstValueFrom(service.registerPlayer(1, dto))).resolves.not.toThrow();
      });

      it('adds the player to eventPlayers$ from local cache', async () => {
        await firstValueFrom(service.registerPlayer(1, dto));
        const players = await firstValueFrom(service.eventPlayers$);
        expect(players.some(p => p.playerId === 42)).toBe(true);
      });

      it('writes the updated player list to the cache', async () => {
        await firstValueFrom(service.registerPlayer(1, dto));
        expect(mockStorage.setItem).toHaveBeenCalledWith(
          expect.stringContaining('ep_1'),
          expect.stringContaining('"playerId":42')
        );
      });

      it('increments the event playerCount in ctx', async () => {
        await firstValueFrom(service.registerPlayer(1, dto));
        expect(mockCtx.events.update).toHaveBeenCalledWith(
          expect.objectContaining({ playerCount: 3 })
        );
      });

      it('emits the updated event on currentEvent$', async () => {
        await firstValueFrom(service.registerPlayer(1, dto));
        const evt = await firstValueFrom(service.currentEvent$);
        expect(evt?.playerCount).toBe(3);
      });
    });
  });

  // ── clearAllPlayers ───────────────────────────────────────────────────────

  describe('clearAllPlayers', () => {
    const activePlayer: EventPlayerDto = {
      playerId: 10, name: 'Bob', conservativeScore: 20, isRanked: true,
      decklistUrl: null, commanders: null, isDropped: false, isDisqualified: false, isCheckedIn: false,
    };
    const droppedPlayer: EventPlayerDto = {
      playerId: 11, name: 'Carol', conservativeScore: 15, isRanked: true,
      decklistUrl: null, commanders: null, isDropped: true, isDisqualified: false, isCheckedIn: false,
    };

    describe('local-only event (negative ID)', () => {
      beforeEach(() => {
        mockCtx.events.getById.mockReturnValue({ ...eventStub, id: -1, playerCount: 1 });
        // Seed eventPlayers$ with one active player via private subject
        service['eventPlayersSubject'].next([activePlayer]);
      });

      it('clears eventPlayers$ without calling any API', async () => {
        await firstValueFrom(service.clearAllPlayers(-1));
        expect(await firstValueFrom(service.eventPlayers$)).toEqual([]);
        expect(mockApi.dropPlayer).not.toHaveBeenCalled();
      });

      it('resets playerCount to 0 in ctx', async () => {
        await firstValueFrom(service.clearAllPlayers(-1));
        expect(mockCtx.events.update).toHaveBeenCalledWith(
          expect.objectContaining({ playerCount: 0 })
        );
      });

      it('emits updated event on currentEvent$', async () => {
        await firstValueFrom(service.clearAllPlayers(-1));
        const evt = await firstValueFrom(service.currentEvent$);
        expect(evt?.playerCount).toBe(0);
      });
    });

    describe('API-backed event (positive ID)', () => {
      beforeEach(() => {
        // Seed eventPlayers$ with one active and one dropped player via private subject
        service['eventPlayersSubject'].next([activePlayer, droppedPlayer]);
        mockCtx.events.getById.mockReturnValue({ ...eventStub, id: 1, playerCount: 2 });
      });

      it('calls api.dropPlayer only for active (non-dropped, non-disqualified) players', async () => {
        await firstValueFrom(service.clearAllPlayers(1));
        expect(mockApi.dropPlayer).toHaveBeenCalledWith(1, activePlayer.playerId);
        expect(mockApi.dropPlayer).not.toHaveBeenCalledWith(1, droppedPlayer.playerId);
      });

      it('returns an observable that completes', async () => {
        await expect(firstValueFrom(service.clearAllPlayers(1))).resolves.not.toThrow();
      });

      it('returns immediately when there are no active players', async () => {
        service['eventPlayersSubject'].next([droppedPlayer]);
        await firstValueFrom(service.clearAllPlayers(1));
        expect(mockApi.dropPlayer).not.toHaveBeenCalled();
      });
    });
  });

  describe('addRound', () => {
    it('appends a round to rounds$', async () => {
      service.addRound(roundStub);
      expect(await firstValueFrom(service.rounds$)).toEqual([roundStub]);
    });

    it('preserves existing rounds when adding a second', async () => {
      const round2: RoundDto = { roundId: 2, roundNumber: 2, pods: [] };
      service.addRound(roundStub);
      service.addRound(round2);
      expect(await firstValueFrom(service.rounds$)).toHaveLength(2);
    });
  });

  describe('clearRounds', () => {
    it('empties rounds$', async () => {
      service.addRound(roundStub);
      service.clearRounds();
      expect(await firstValueFrom(service.rounds$)).toEqual([]);
    });
  });
});
