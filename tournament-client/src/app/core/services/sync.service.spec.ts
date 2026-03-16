import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';
import { SyncService } from './sync.service';
import { ApiService } from './api.service';
import { LocalStorageContext } from './local-storage-context.service';
import { StorageAdapter } from './storage-adapter.service';
import { PlayerService } from './player.service';
import { EventService } from './event.service';

// ─── Mock factories ───────────────────────────────────────────────────────────

function makeTable(overrides: Record<string, unknown> = {}) {
  return {
    getAll:          jest.fn().mockReturnValue([]),
    getById:         jest.fn().mockReturnValue(undefined),
    getBaselineById: jest.fn().mockReturnValue(undefined),
    getPending:      jest.fn().mockReturnValue({ added: [], modified: [], deleted: [] }),
    pendingCount:    jest.fn().mockReturnValue(0),
    acceptRemoteId:  jest.fn(),
    markClean:       jest.fn(),
    seed:            jest.fn(),
    add:             jest.fn(),
    update:          jest.fn(),
    remove:          jest.fn(),
    ...overrides,
  };
}

function makeMocks() {
  const mockCtx = {
    totalPendingCount: jest.fn().mockReturnValue(0),
    activeStorePrefix: 'to_store_1',
    players:     makeTable(),
    stores:      makeTable(),
    events:      makeTable(),
    rounds:      makeTable(),
    pods:        makeTable(),
    gameResults: makeTable(),
  };

  const mockApi = {
    updateStore:          jest.fn().mockReturnValue(of({})),
    registerPlayer:       jest.fn().mockReturnValue(of({ id: 100, name: 'Alice', email: 'a@b.com' })),
    updatePlayer:         jest.fn().mockReturnValue(of({})),
    getPlayerProfile:     jest.fn().mockReturnValue(of({ id: 1, name: 'Alice', email: 'a@b.com', isActive: true })),
    createEvent:          jest.fn().mockReturnValue(of({ id: 200, name: 'GP London' })),
    removeEvent:          jest.fn().mockReturnValue(of(null)),
    updateEventStatus:    jest.fn().mockReturnValue(of({})),
    registerForEvent:     jest.fn().mockReturnValue(of({})),
    generateNextRound:    jest.fn().mockReturnValue(of({ roundId: 50, roundNumber: 1, pods: [] })),
    submitGameResult:     jest.fn().mockReturnValue(of({})),
    removeStoreEmployee:  jest.fn().mockReturnValue(of(null)),
    addStoreEmployee:     jest.fn().mockReturnValue(of({ id: 99, name: 'Dave', email: 'd@e.com', role: 'StoreEmployee' })),
  };

  const mockStorage = {
    getItem:    jest.fn().mockReturnValue(null),
    setItem:    jest.fn(),
    removeItem: jest.fn(),
    keys:       jest.fn().mockReturnValue([]),
  };

  const mockPlayerService = {
    refreshPlayersFromApi: jest.fn().mockReturnValue(of([])),
  };

  const mockEventService = {
    refreshEventsFromApi: jest.fn().mockReturnValue(of([])),
  };

  const mockDialog = {
    open: jest.fn().mockReturnValue({ afterClosed: jest.fn().mockReturnValue(of(null)) }),
  };

  return { mockCtx, mockApi, mockStorage, mockPlayerService, mockEventService, mockDialog };
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('SyncService', () => {
  let service: SyncService;
  let mocks: ReturnType<typeof makeMocks>;

  beforeEach(() => {
    mocks = makeMocks();
    TestBed.configureTestingModule({
      providers: [
        SyncService,
        { provide: LocalStorageContext, useValue: mocks.mockCtx },
        { provide: ApiService,          useValue: mocks.mockApi },
        { provide: StorageAdapter,      useValue: mocks.mockStorage },
        { provide: PlayerService,       useValue: mocks.mockPlayerService },
        { provide: EventService,        useValue: mocks.mockEventService },
        { provide: MatDialog,           useValue: mocks.mockDialog },
      ],
    });
    service = TestBed.inject(SyncService);
  });

  // ─── pendingCount ──────────────────────────────────────────────────────────

  describe('pendingCount getter', () => {
    it('delegates to ctx.totalPendingCount()', () => {
      mocks.mockCtx.totalPendingCount.mockReturnValue(7);
      expect(service.pendingCount).toBe(7);
    });

    it('returns 0 when there are no pending changes', () => {
      mocks.mockCtx.totalPendingCount.mockReturnValue(0);
      expect(service.pendingCount).toBe(0);
    });
  });

  // ─── pull ─────────────────────────────────────────────────────────────────

  describe('pull()', () => {
    it('calls refreshPlayersFromApi', async () => {
      await service.pull();
      expect(mocks.mockPlayerService.refreshPlayersFromApi).toHaveBeenCalledTimes(1);
    });

    it('calls refreshEventsFromApi', async () => {
      await service.pull();
      expect(mocks.mockEventService.refreshEventsFromApi).toHaveBeenCalledTimes(1);
    });

    it('returns a zeroed SyncResult', async () => {
      const result = await service.pull();
      expect(result).toEqual({ pushed: 0, conflicts: 0, errors: 0 });
    });
  });

  // ─── push: _pushStoreSettings ──────────────────────────────────────────────

  describe('push() → _pushStoreSettings', () => {
    it('does nothing when activeStorePrefix does not match to_store_N pattern', async () => {
      mocks.mockCtx.activeStorePrefix = 'no_match';
      await service.push();
      expect(mocks.mockApi.updateStore).not.toHaveBeenCalled();
    });

    it('does nothing when there is no pending settings key in storage', async () => {
      mocks.mockStorage.getItem.mockReturnValue(null);
      await service.push();
      expect(mocks.mockApi.updateStore).not.toHaveBeenCalled();
    });

    it('calls api.updateStore with the parsed dto when key exists', async () => {
      const dto = { storeName: 'Game Haven', allowableTradeDifferential: 5 };
      mocks.mockStorage.getItem.mockImplementation((key: string) =>
        key === 'to_store_settings_pending_1' ? JSON.stringify(dto) : null
      );
      await service.push();
      expect(mocks.mockApi.updateStore).toHaveBeenCalledWith(1, dto);
    });

    it('removes the pending settings key after a successful push', async () => {
      const dto = { storeName: 'Game Haven', allowableTradeDifferential: 5 };
      mocks.mockStorage.getItem.mockImplementation((key: string) =>
        key === 'to_store_settings_pending_1' ? JSON.stringify(dto) : null
      );
      await service.push();
      expect(mocks.mockStorage.removeItem).toHaveBeenCalledWith('to_store_settings_pending_1');
    });

    it('calls ctx.stores.markClean(storeId) after a successful push', async () => {
      const dto = { storeName: 'Game Haven', allowableTradeDifferential: 5 };
      mocks.mockStorage.getItem.mockImplementation((key: string) =>
        key === 'to_store_settings_pending_1' ? JSON.stringify(dto) : null
      );
      await service.push();
      expect(mocks.mockCtx.stores.markClean).toHaveBeenCalledWith(1);
    });

    it('increments pushed on success', async () => {
      mocks.mockStorage.getItem.mockImplementation((key: string) =>
        key === 'to_store_settings_pending_1'
          ? JSON.stringify({ storeName: 'X', allowableTradeDifferential: 0 })
          : null
      );
      const result = await service.push();
      expect(result.pushed).toBeGreaterThanOrEqual(1);
    });

    it('increments errors and does not remove the key when the API call fails', async () => {
      mocks.mockStorage.getItem.mockImplementation((key: string) =>
        key === 'to_store_settings_pending_1'
          ? JSON.stringify({ storeName: 'X', allowableTradeDifferential: 0 })
          : null
      );
      mocks.mockApi.updateStore.mockReturnValue(throwError(() => new Error('network')));
      const result = await service.push();
      expect(result.errors).toBeGreaterThanOrEqual(1);
      expect(mocks.mockStorage.removeItem).not.toHaveBeenCalledWith('to_store_settings_pending_1');
    });
  });

  // ─── push: _pushPlayers (added) ───────────────────────────────────────────

  describe('push() → _pushPlayers (added)', () => {
    const pendingPlayer = { id: -1, name: 'Alice', email: 'a@b.com', isActive: true };

    beforeEach(() => {
      mocks.mockCtx.players.getPending.mockReturnValue({ added: [pendingPlayer], modified: [], deleted: [] });
      mocks.mockApi.registerPlayer.mockReturnValue(of({ id: 50, name: 'Alice', email: 'a@b.com' }));
    });

    it('calls api.registerPlayer with name and email', async () => {
      await service.push();
      expect(mocks.mockApi.registerPlayer).toHaveBeenCalledWith({ name: 'Alice', email: 'a@b.com' });
    });

    it('calls ctx.players.acceptRemoteId to swap the temporary ID', async () => {
      await service.push();
      expect(mocks.mockCtx.players.acceptRemoteId).toHaveBeenCalledWith(-1, 50);
    });

    it('increments pushed', async () => {
      const result = await service.push();
      expect(result.pushed).toBeGreaterThanOrEqual(1);
    });

    it('increments errors when registerPlayer fails', async () => {
      mocks.mockApi.registerPlayer.mockReturnValue(throwError(() => new Error('fail')));
      const result = await service.push();
      expect(result.errors).toBeGreaterThanOrEqual(1);
      expect(mocks.mockCtx.players.acceptRemoteId).not.toHaveBeenCalled();
    });
  });

  // ─── push: _pushPlayers (modified, no conflict) ───────────────────────────

  describe('push() → _pushPlayers (modified, no conflict)', () => {
    const localPlayer  = { id: 5, name: 'Bob',      email: 'b@c.com', isActive: true };
    const serverPlayer = { id: 5, name: 'Bob',      email: 'b@c.com', isActive: true };
    const baseline     = { id: 5, name: 'Bob',      email: 'b@c.com', isActive: true };

    beforeEach(() => {
      mocks.mockCtx.players.getPending.mockReturnValue({ added: [], modified: [localPlayer], deleted: [] });
      mocks.mockApi.getPlayerProfile.mockReturnValue(of(serverPlayer));
      mocks.mockCtx.players.getBaselineById.mockReturnValue(baseline);
    });

    it('calls api.updatePlayer with the player dto', async () => {
      await service.push();
      expect(mocks.mockApi.updatePlayer).toHaveBeenCalledWith(5, {
        name: 'Bob', email: 'b@c.com', isActive: true,
      });
    });

    it('calls ctx.players.markClean after a successful update', async () => {
      await service.push();
      expect(mocks.mockCtx.players.markClean).toHaveBeenCalledWith(5);
    });

    it('increments pushed', async () => {
      const result = await service.push();
      expect(result.pushed).toBeGreaterThanOrEqual(1);
    });

    it('increments errors when updatePlayer fails', async () => {
      mocks.mockApi.updatePlayer.mockReturnValue(throwError(() => new Error('fail')));
      const result = await service.push();
      expect(result.errors).toBeGreaterThanOrEqual(1);
      expect(mocks.mockCtx.players.markClean).not.toHaveBeenCalled();
    });
  });

  // ─── push: _pushPlayers (conflict detected) ───────────────────────────────

  describe('push() → _pushPlayers (conflict detected)', () => {
    const localPlayer  = { id: 5, name: 'Bobby',  email: 'b@c.com', isActive: true };
    const serverPlayer = { id: 5, name: 'Robert', email: 'b@c.com', isActive: true };
    const baseline     = { id: 5, name: 'Bob',    email: 'b@c.com', isActive: true };

    beforeEach(() => {
      mocks.mockCtx.players.getPending.mockReturnValue({ added: [], modified: [localPlayer], deleted: [] });
      mocks.mockApi.getPlayerProfile.mockReturnValue(of(serverPlayer));
      mocks.mockCtx.players.getBaselineById.mockReturnValue(baseline);
    });

    it('increments conflicts when local and server both changed from baseline', async () => {
      // User cancels dialog (afterClosed returns null)
      mocks.mockDialog.open.mockReturnValue({ afterClosed: jest.fn().mockReturnValue(of(null)) });
      const result = await service.push();
      expect(result.conflicts).toBeGreaterThanOrEqual(1);
    });

    it('opens the SyncConflictDialog', async () => {
      mocks.mockDialog.open.mockReturnValue({ afterClosed: jest.fn().mockReturnValue(of(null)) });
      await service.push();
      expect(mocks.mockDialog.open).toHaveBeenCalledTimes(1);
    });

    it('skips the update when the user cancels the dialog', async () => {
      mocks.mockDialog.open.mockReturnValue({ afterClosed: jest.fn().mockReturnValue(of(null)) });
      await service.push();
      expect(mocks.mockApi.updatePlayer).not.toHaveBeenCalled();
    });

    it('pushes the resolved record when the user confirms', async () => {
      const resolved = { id: 5, name: 'Bobby', email: 'b@c.com', isActive: true };
      mocks.mockDialog.open.mockReturnValue({
        afterClosed: jest.fn().mockReturnValue(of(resolved)),
      });
      await service.push();
      expect(mocks.mockApi.updatePlayer).toHaveBeenCalledWith(5, {
        name: 'Bobby', email: 'b@c.com', isActive: true,
      });
    });
  });

  // ─── push: _pushGameResults ────────────────────────────────────────────────

  describe('push() → _pushGameResults', () => {
    it('does not push results with negative gameIds', async () => {
      const negResult = {
        id: 1, gameId: -10, playerId: 1,
        finishPosition: 1, eliminations: 0, turnsSurvived: 0,
        commanderPlayed: null, deckColors: null, conceded: false,
      };
      mocks.mockCtx.gameResults.getPending.mockReturnValue({ added: [negResult], modified: [], deleted: [] });
      await service.push();
      expect(mocks.mockApi.submitGameResult).not.toHaveBeenCalled();
    });

    it('groups positive-gameId results by gameId and calls submitGameResult once per game', async () => {
      const r1 = { id: 1, gameId: 42, playerId: 1, finishPosition: 1, eliminations: 0, turnsSurvived: 0, commanderPlayed: null, deckColors: null, conceded: false };
      const r2 = { id: 2, gameId: 42, playerId: 2, finishPosition: 2, eliminations: 0, turnsSurvived: 0, commanderPlayed: null, deckColors: null, conceded: false };
      mocks.mockCtx.gameResults.getPending.mockReturnValue({ added: [r1, r2], modified: [], deleted: [] });
      await service.push();
      expect(mocks.mockApi.submitGameResult).toHaveBeenCalledTimes(1);
      expect(mocks.mockApi.submitGameResult).toHaveBeenCalledWith(42, expect.arrayContaining([
        expect.objectContaining({ playerId: 1 }),
        expect.objectContaining({ playerId: 2 }),
      ]));
    });

    it('calls ctx.gameResults.markClean for each submitted result', async () => {
      const r1 = { id: 1, gameId: 42, playerId: 1, finishPosition: 1, eliminations: 0, turnsSurvived: 0, commanderPlayed: null, deckColors: null, conceded: false };
      mocks.mockCtx.gameResults.getPending.mockReturnValue({ added: [r1], modified: [], deleted: [] });
      await service.push();
      expect(mocks.mockCtx.gameResults.markClean).toHaveBeenCalledWith(1);
    });

    it('increments errors when submitGameResult fails', async () => {
      const r1 = { id: 1, gameId: 42, playerId: 1, finishPosition: 1, eliminations: 0, turnsSurvived: 0, commanderPlayed: null, deckColors: null, conceded: false };
      mocks.mockCtx.gameResults.getPending.mockReturnValue({ added: [r1], modified: [], deleted: [] });
      mocks.mockApi.submitGameResult.mockReturnValue(throwError(() => new Error('fail')));
      const result = await service.push();
      expect(result.errors).toBeGreaterThanOrEqual(1);
    });

    it('handles two different gameIds as two separate submissions', async () => {
      const r1 = { id: 1, gameId: 10, playerId: 1, finishPosition: 1, eliminations: 0, turnsSurvived: 0, commanderPlayed: null, deckColors: null, conceded: false };
      const r2 = { id: 2, gameId: 20, playerId: 2, finishPosition: 1, eliminations: 0, turnsSurvived: 0, commanderPlayed: null, deckColors: null, conceded: false };
      mocks.mockCtx.gameResults.getPending.mockReturnValue({ added: [r1, r2], modified: [], deleted: [] });
      await service.push();
      expect(mocks.mockApi.submitGameResult).toHaveBeenCalledTimes(2);
    });
  });

  // ─── push: _pushEvents (added) ────────────────────────────────────────────

  describe('push() → _pushEvents (added)', () => {
    const localEvent = {
      id: -5, name: 'GP London', date: '2025-01-01', storeId: 1,
      defaultRoundTimeMinutes: 50, maxPlayers: 32,
      pointSystem: 'WinBased', status: 'Registration', plannedRounds: null,
    };

    beforeEach(() => {
      mocks.mockCtx.events.getPending.mockReturnValue({ added: [localEvent], modified: [], deleted: [] });
      mocks.mockApi.createEvent.mockReturnValue(of({ id: 200, name: 'GP London' }));
    });

    it('calls api.createEvent with the event dto', async () => {
      await service.push();
      expect(mocks.mockApi.createEvent).toHaveBeenCalledWith(expect.objectContaining({ name: 'GP London' }));
    });

    it('calls ctx.events.acceptRemoteId to swap the temporary ID', async () => {
      await service.push();
      expect(mocks.mockCtx.events.acceptRemoteId).toHaveBeenCalledWith(-5, 200);
    });

    it('increments pushed', async () => {
      const result = await service.push();
      expect(result.pushed).toBeGreaterThanOrEqual(1);
    });

    it('increments errors when createEvent fails', async () => {
      mocks.mockApi.createEvent.mockReturnValue(throwError(() => new Error('fail')));
      const result = await service.push();
      expect(result.errors).toBeGreaterThanOrEqual(1);
      expect(mocks.mockCtx.events.acceptRemoteId).not.toHaveBeenCalled();
    });
  });

  // ─── push: _pushEvents (deleted) ──────────────────────────────────────────

  describe('push() → _pushEvents (deleted)', () => {
    const deletedEvent = { id: 7, name: 'Old Event' };

    beforeEach(() => {
      mocks.mockCtx.events.getPending.mockReturnValue({ added: [], modified: [], deleted: [deletedEvent] });
    });

    it('calls api.removeEvent with the event id', async () => {
      await service.push();
      expect(mocks.mockApi.removeEvent).toHaveBeenCalledWith(7);
    });

    it('calls ctx.events.markClean after deletion', async () => {
      await service.push();
      expect(mocks.mockCtx.events.markClean).toHaveBeenCalledWith(7);
    });

    it('increments pushed', async () => {
      const result = await service.push();
      expect(result.pushed).toBeGreaterThanOrEqual(1);
    });

    it('increments errors when removeEvent fails', async () => {
      mocks.mockApi.removeEvent.mockReturnValue(throwError(() => new Error('fail')));
      const result = await service.push();
      expect(result.errors).toBeGreaterThanOrEqual(1);
      expect(mocks.mockCtx.events.markClean).not.toHaveBeenCalled();
    });
  });

  // ─── push: _pushEmployees (deletions) ─────────────────────────────────────

  describe('push() → _pushEmployees (deletions)', () => {
    const cacheKey     = 'to_store_1_employees_1';
    const deletionsKey = `${cacheKey}_deletions`;

    it('does nothing when prefix does not match', async () => {
      mocks.mockCtx.activeStorePrefix = 'bad_prefix';
      await service.push();
      expect(mocks.mockApi.removeStoreEmployee).not.toHaveBeenCalled();
    });

    it('calls api.removeStoreEmployee for each queued deletion', async () => {
      mocks.mockStorage.getItem.mockImplementation((key: string) =>
        key === deletionsKey ? JSON.stringify([101, 102]) : null
      );
      await service.push();
      expect(mocks.mockApi.removeStoreEmployee).toHaveBeenCalledWith(1, 101);
      expect(mocks.mockApi.removeStoreEmployee).toHaveBeenCalledWith(1, 102);
    });

    it('writes an empty deletions array after all deletions succeed', async () => {
      mocks.mockStorage.getItem.mockImplementation((key: string) =>
        key === deletionsKey ? JSON.stringify([101]) : null
      );
      await service.push();
      expect(mocks.mockStorage.setItem).toHaveBeenCalledWith(deletionsKey, JSON.stringify([]));
    });

    it('keeps failed deletions in the queue', async () => {
      mocks.mockStorage.getItem.mockImplementation((key: string) =>
        key === deletionsKey ? JSON.stringify([101]) : null
      );
      mocks.mockApi.removeStoreEmployee.mockReturnValue(throwError(() => new Error('fail')));
      await service.push();
      expect(mocks.mockStorage.setItem).toHaveBeenCalledWith(deletionsKey, JSON.stringify([101]));
    });

    it('increments errors for each failed deletion', async () => {
      mocks.mockStorage.getItem.mockImplementation((key: string) =>
        key === deletionsKey ? JSON.stringify([101]) : null
      );
      mocks.mockApi.removeStoreEmployee.mockReturnValue(throwError(() => new Error('fail')));
      const result = await service.push();
      expect(result.errors).toBeGreaterThanOrEqual(1);
    });
  });

  // ─── push: _pushEmployees (additions) ─────────────────────────────────────

  describe('push() → _pushEmployees (additions)', () => {
    const cacheKey = 'to_store_1_employees_1';
    const negEmp   = { id: -1, name: 'Dave', email: 'd@e.com', role: 'StoreEmployee' };

    beforeEach(() => {
      mocks.mockStorage.getItem.mockImplementation((key: string) =>
        key === cacheKey ? JSON.stringify([negEmp]) : null
      );
      mocks.mockApi.addStoreEmployee.mockReturnValue(
        of({ id: 99, name: 'Dave', email: 'd@e.com', role: 'StoreEmployee' })
      );
    });

    it('calls api.addStoreEmployee for each negative-ID employee', async () => {
      await service.push();
      expect(mocks.mockApi.addStoreEmployee).toHaveBeenCalledWith(1, {
        name: 'Dave', email: 'd@e.com', role: 'StoreEmployee',
      });
    });

    it('replaces the negative ID with the server-assigned ID in the cache', async () => {
      await service.push();
      const written = JSON.parse(mocks.mockStorage.setItem.mock.calls
        .filter(([k]: [string]) => k === cacheKey)
        .at(-1)[1]);
      expect(written[0].id).toBe(99);
    });

    it('increments pushed', async () => {
      const result = await service.push();
      expect(result.pushed).toBeGreaterThanOrEqual(1);
    });

    it('increments errors when addStoreEmployee fails', async () => {
      mocks.mockApi.addStoreEmployee.mockReturnValue(throwError(() => new Error('fail')));
      const result = await service.push();
      expect(result.errors).toBeGreaterThanOrEqual(1);
    });

    it('does not push positive-ID employees', async () => {
      const posEmp = { id: 5, name: 'Eve', email: 'e@f.com', role: 'StoreEmployee' };
      mocks.mockStorage.getItem.mockImplementation((key: string) =>
        key === cacheKey ? JSON.stringify([posEmp]) : null
      );
      await service.push();
      expect(mocks.mockApi.addStoreEmployee).not.toHaveBeenCalled();
    });
  });

  // ─── validateImportFile ────────────────────────────────────────────────────

  describe('validateImportFile()', () => {
    // JSDOM's File does not implement .text() — wrap content in a plain object
    function makeFile(content: string): { text: () => Promise<string> } {
      return { text: () => Promise.resolve(content) } as unknown as File;
    }

    it('returns parseError when the file cannot be read as text (simulated)', async () => {
      // Override text() to reject
      const badFile = { text: () => Promise.reject(new Error('read fail')) } as unknown as File;
      const result = await service.validateImportFile(badFile, 1);
      expect(result.status).toBe('parseError');
    });

    it('returns parseError for invalid JSON', async () => {
      const result = await service.validateImportFile(makeFile('not json!'), 1);
      expect(result.status).toBe('parseError');
      expect((result as any).error).toContain('JSON');
    });

    it('returns invalidFormat when storeId field is missing', async () => {
      const result = await service.validateImportFile(
        makeFile(JSON.stringify({ exportedAt: new Date().toISOString() })), 1
      );
      expect(result.status).toBe('invalidFormat');
    });

    it('returns invalidFormat when exportedAt field is missing', async () => {
      const result = await service.validateImportFile(
        makeFile(JSON.stringify({ storeId: 1 })), 1
      );
      expect(result.status).toBe('invalidFormat');
    });

    it('returns storeIdMismatch when the file is for a different store', async () => {
      const data = { storeId: 99, exportedAt: new Date().toISOString() };
      const result = await service.validateImportFile(makeFile(JSON.stringify(data)), 1);
      expect(result.status).toBe('storeIdMismatch');
      expect((result as any).fileStoreId).toBe(99);
    });

    it('returns ok with the parsed data for a matching store', async () => {
      const data = { storeId: 1, exportedAt: new Date().toISOString(), players: [] };
      const result = await service.validateImportFile(makeFile(JSON.stringify(data)), 1);
      expect(result.status).toBe('ok');
      expect((result as any).data).toMatchObject({ storeId: 1 });
    });
  });

  // ─── applyImport ──────────────────────────────────────────────────────────

  describe('applyImport()', () => {
    it('seeds ctx.players when players array is present', () => {
      const data = { storeId: 1, exportedAt: '', players: [{ id: 1, name: 'A' }] } as any;
      service.applyImport(data);
      expect(mocks.mockCtx.players.seed).toHaveBeenCalledWith(data.players);
    });

    it('seeds ctx.stores when stores array is present', () => {
      const data = { storeId: 1, exportedAt: '', stores: [{ id: 1 }] } as any;
      service.applyImport(data);
      expect(mocks.mockCtx.stores.seed).toHaveBeenCalledWith(data.stores);
    });

    it('seeds ctx.events when events array is present', () => {
      const data = { storeId: 1, exportedAt: '', events: [{ id: 1 }] } as any;
      service.applyImport(data);
      expect(mocks.mockCtx.events.seed).toHaveBeenCalledWith(data.events);
    });

    it('seeds ctx.rounds when rounds array is present', () => {
      const data = { storeId: 1, exportedAt: '', rounds: [{ roundId: 1 }] } as any;
      service.applyImport(data);
      expect(mocks.mockCtx.rounds.seed).toHaveBeenCalledWith(data.rounds);
    });

    it('seeds ctx.pods when pods array is present', () => {
      const data = { storeId: 1, exportedAt: '', pods: [{ podId: 1 }] } as any;
      service.applyImport(data);
      expect(mocks.mockCtx.pods.seed).toHaveBeenCalledWith(data.pods);
    });

    it('seeds ctx.gameResults when gameResults array is present', () => {
      const data = { storeId: 1, exportedAt: '', gameResults: [{ id: 1 }] } as any;
      service.applyImport(data);
      expect(mocks.mockCtx.gameResults.seed).toHaveBeenCalledWith(data.gameResults);
    });

    it('does not crash when optional arrays are absent', () => {
      const data = { storeId: 1, exportedAt: '' } as any;
      expect(() => service.applyImport(data)).not.toThrow();
    });
  });

  // ─── exportStore ──────────────────────────────────────────────────────────

  describe('exportStore()', () => {
    let anchorClickSpy: jest.SpyInstance;
    let createObjectURLSpy: jest.SpyInstance;
    let revokeObjectURLSpy: jest.SpyInstance;
    let appendChildSpy: jest.SpyInstance;

    beforeEach(() => {
      // JSDOM does not implement these — assign stubs so jest.spyOn can wrap them
      if (!URL.createObjectURL) (URL as any).createObjectURL = jest.fn();
      if (!URL.revokeObjectURL) (URL as any).revokeObjectURL = jest.fn();

      anchorClickSpy      = jest.fn();
      createObjectURLSpy  = jest.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
      revokeObjectURLSpy  = jest.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
      appendChildSpy      = jest.spyOn(document.body, 'appendChild').mockImplementation((el) => el);

      jest.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        if (tag === 'a') {
          // Return a plain object — Object.create(HTMLAnchorElement.prototype) fails
          // JSDOM's instanceof check when setting href on an uninitialized element.
          return { href: '', download: '', click: anchorClickSpy } as unknown as HTMLAnchorElement;
        }
        return document.createElement(tag);
      });
    });

    afterEach(() => jest.restoreAllMocks());

    it('creates a Blob URL', () => {
      service.exportStore(1);
      expect(createObjectURLSpy).toHaveBeenCalledWith(expect.any(Blob));
    });

    it('triggers a download click on the anchor', () => {
      service.exportStore(1);
      expect(anchorClickSpy).toHaveBeenCalledTimes(1);
    });

    it('revokes the object URL after clicking', () => {
      service.exportStore(1);
      expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock');
    });

    it('sets the anchor download attribute to include the storeId', () => {
      let capturedAnchor: any;
      jest.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        if (tag === 'a') {
          capturedAnchor = { href: '', download: '', click: jest.fn() };
          return capturedAnchor;
        }
        return document.createElement(tag);
      });
      service.exportStore(42);
      expect(capturedAnchor.download).toMatch(/to_store_42/);
    });
  });
});
