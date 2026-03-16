import { firstValueFrom, of, throwError } from 'rxjs';
import { PlayerService } from './player.service';
import { LeaderboardEntry, PlayerDto } from '../models/api.models';

describe('PlayerService', () => {
  let service: PlayerService;

  let mockApi: {
    getAllPlayers: jest.Mock;
    getLeaderboard: jest.Mock;
    getPlayerProfile: jest.Mock;
  };

  let mockCtx: {
    players: {
      getAll: jest.Mock;
      getById: jest.Mock;
      add: jest.Mock;
      update: jest.Mock;
      seed: jest.Mock;
    };
  };

  const playerStub: PlayerDto = {
    id: 1, name: 'Alice', email: 'alice@test.com',
    mu: 25, sigma: 8.333, conservativeScore: 0,
    isRanked: false, placementGamesLeft: 5, isActive: true,
  };

  beforeEach(() => {
    mockApi = {
      getAllPlayers:     jest.fn().mockReturnValue(of([])),
      getLeaderboard:   jest.fn().mockReturnValue(of([])),
      getPlayerProfile: jest.fn().mockReturnValue(of(playerStub)),
    };

    mockCtx = {
      players: {
        getAll:  jest.fn().mockReturnValue([]),
        getById: jest.fn().mockReturnValue(null),
        add:     jest.fn().mockImplementation(dto => ({ id: -1, ...dto })),
        update:  jest.fn(),
        seed:    jest.fn(),
      },
    };

    service = new PlayerService(mockApi as any, mockCtx as any);
  });

  it('initialises players$ as an empty array', async () => {
    expect(await firstValueFrom(service.players$)).toEqual([]);
  });

  it('initialises leaderboard$ as an empty array', async () => {
    expect(await firstValueFrom(service.leaderboard$)).toEqual([]);
  });

  // ── loadAllPlayers ─────────────────────────────────────────────────────────

  describe('loadAllPlayers', () => {
    it('emits from cache without calling the API when cache has data', async () => {
      mockCtx.players.getAll.mockReturnValue([playerStub]);

      service.loadAllPlayers();

      expect(mockApi.getAllPlayers).not.toHaveBeenCalled();
      expect(await firstValueFrom(service.players$)).toEqual([playerStub]);
    });

    it('calls the API when cache is empty, seeds ctx and emits the result', async () => {
      mockApi.getAllPlayers.mockReturnValue(of([playerStub]));
      mockCtx.players.getAll
        .mockReturnValueOnce([])        // initial cache-empty check
        .mockReturnValue([playerStub]); // after seed

      service.loadAllPlayers();

      expect(mockApi.getAllPlayers).toHaveBeenCalledTimes(1);
      expect(mockCtx.players.seed).toHaveBeenCalledWith([playerStub]);
      expect(await firstValueFrom(service.players$)).toEqual([playerStub]);
    });
  });

  // ── loadLeaderboard ────────────────────────────────────────────────────────

  describe('loadLeaderboard', () => {
    it('calls api.getLeaderboard and pushes result to leaderboard$', async () => {
      const entries: LeaderboardEntry[] = [
        { rank: 1, playerId: 1, name: 'Alice', conservativeScore: 20, mu: 25, sigma: 8.333 },
      ];
      mockApi.getLeaderboard.mockReturnValue(of(entries));

      service.loadLeaderboard();

      expect(mockApi.getLeaderboard).toHaveBeenCalledTimes(1);
      expect(await firstValueFrom(service.leaderboard$)).toEqual(entries);
    });

    it('offline — emits ranked players sorted by conservativeScore desc', async () => {
      mockApi.getLeaderboard.mockReturnValue(throwError(() => new Error('offline')));
      const cached: PlayerDto[] = [
        { id: 2, name: 'Bob',   email: 'bob@test.com',   mu: 26, sigma: 6, conservativeScore: 10, isRanked: true,  placementGamesLeft: 0, isActive: true },
        { id: 1, name: 'Alice', email: 'alice@test.com', mu: 30, sigma: 5, conservativeScore: 20, isRanked: true,  placementGamesLeft: 0, isActive: true },
      ];
      mockCtx.players.getAll.mockReturnValue(cached);

      service.loadLeaderboard();

      const result = await firstValueFrom(service.leaderboard$);
      expect(result).toHaveLength(2);
      expect(result[0].rank).toBe(1);
      expect(result[0].conservativeScore).toBe(20); // Alice (higher score) is rank 1
      expect(result[1].rank).toBe(2);
      expect(result[1].conservativeScore).toBe(10);
    });

    it('offline — excludes unranked players', async () => {
      mockApi.getLeaderboard.mockReturnValue(throwError(() => new Error('offline')));
      const cached: PlayerDto[] = [
        { id: 1, name: 'Alice', email: 'alice@test.com', mu: 25, sigma: 8.333, conservativeScore: 0, isRanked: false, placementGamesLeft: 3, isActive: true },
      ];
      mockCtx.players.getAll.mockReturnValue(cached);

      service.loadLeaderboard();

      expect(await firstValueFrom(service.leaderboard$)).toEqual([]);
    });

    it('offline — emits [] when no ranked players are cached', async () => {
      mockApi.getLeaderboard.mockReturnValue(throwError(() => new Error('offline')));
      mockCtx.players.getAll.mockReturnValue([]);

      service.loadLeaderboard();

      expect(await firstValueFrom(service.leaderboard$)).toEqual([]);
    });

    it('offline — LeaderboardEntry shape matches the cached PlayerDto', async () => {
      mockApi.getLeaderboard.mockReturnValue(throwError(() => new Error('offline')));
      const cached: PlayerDto[] = [
        { id: 7, name: 'Carol', email: 'carol@test.com', mu: 28, sigma: 4, conservativeScore: 16, isRanked: true, placementGamesLeft: 0, isActive: true },
      ];
      mockCtx.players.getAll.mockReturnValue(cached);

      service.loadLeaderboard();

      const [entry] = await firstValueFrom(service.leaderboard$);
      expect(entry).toEqual({ rank: 1, playerId: 7, name: 'Carol', conservativeScore: 16, mu: 28, sigma: 4 });
    });
  });

  // ── registerPlayer (local-first) ──────────────────────────────────────────

  describe('registerPlayer', () => {
    const newPlayer: PlayerDto = {
      id: -1, name: 'Bob', email: 'bob@test.com',
      mu: 25, sigma: 8.333, conservativeScore: 0.001,
      isRanked: false, placementGamesLeft: 5, isActive: true,
    };

    beforeEach(() => {
      mockCtx.players.add.mockReturnValue(newPlayer);
      mockCtx.players.getAll.mockReturnValue([newPlayer]);
    });

    it('adds the player to ctx and returns the new player', async () => {
      const result = await firstValueFrom(service.registerPlayer({ name: 'Bob', email: 'bob@test.com' }));
      expect(mockCtx.players.add).toHaveBeenCalled();
      expect(result).toEqual(newPlayer);
    });

    it('does NOT call any API endpoint', async () => {
      await firstValueFrom(service.registerPlayer({ name: 'Bob', email: 'bob@test.com' }));
      expect(mockApi.getAllPlayers).not.toHaveBeenCalled();
    });

    it('emits the updated players list after registration', async () => {
      await firstValueFrom(service.registerPlayer({ name: 'Bob', email: 'bob@test.com' }));
      expect(await firstValueFrom(service.players$)).toContainEqual(newPlayer);
    });
  });

  // ── updatePlayer (local-first) ────────────────────────────────────────────

  describe('updatePlayer', () => {
    it('updates the player in ctx and returns the updated player', async () => {
      mockCtx.players.getById.mockReturnValue(playerStub);
      mockCtx.players.getAll.mockReturnValue([{ ...playerStub, name: 'Alice 2' }]);

      const result = await firstValueFrom(
        service.updatePlayer(1, { name: 'Alice 2', email: 'alice@test.com', isActive: true })
      );

      expect(mockCtx.players.update).toHaveBeenCalled();
      expect(result.name).toBe('Alice 2');
    });

    it('throws when the player is not found in local store', async () => {
      mockCtx.players.getById.mockReturnValue(null);

      await expect(
        firstValueFrom(service.updatePlayer(99, { name: 'X', email: 'x@x.com', isActive: true }))
      ).rejects.toThrow();
    });
  });

  // ── getProfile ────────────────────────────────────────────────────────────

  describe('getProfile', () => {
    it('delegates to api.getPlayerProfile', async () => {
      const result = await firstValueFrom(service.getProfile(1));
      expect(mockApi.getPlayerProfile).toHaveBeenCalledWith(1);
      expect(result).toEqual(playerStub);
    });
  });
});
