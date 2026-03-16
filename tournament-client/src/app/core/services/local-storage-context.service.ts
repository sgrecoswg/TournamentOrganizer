import { Injectable } from '@angular/core';
import {
  PlayerDto, StoreDto, EventDto, RoundDto, PodDto,
  ChangeSet, ChangeState, LocalGameResultDto
} from '../models/api.models';
import { StorageAdapter } from './storage-adapter.service';
import { AuthService } from './auth.service';

// ---------------------------------------------------------------------------
// LocalTable<T, K>
// ---------------------------------------------------------------------------
// Generic "table" backed by localStorage with change-tracking.
// Modelled after EF Core's DbSet — each write auto-persists to localStorage
// so data survives page refreshes.  Change states (added / modified / deleted)
// are stored separately so the SyncService knows what to push to the backend.
// ---------------------------------------------------------------------------

export class LocalTable<T, K extends keyof T> {
  private rows: T[] = [];
  private baseline: T[] = [];          // snapshot of last server-synced state
  private changeMap = new Map<T[K], ChangeState>();
  private _nextId = -1;                // negative IDs for offline-created records

  constructor(
    readonly tableName: string,
    private prefix: string,
    readonly idKey: K,
    private storage: StorageAdapter
  ) {
    this.reload();
  }

  // ── Keys ────────────────────────────────────────────────────────────────

  private get dataKey(): string { return `${this.prefix}_${this.tableName}`; }
  private get metaKey(): string { return `${this.prefix}_${this.tableName}_meta`; }

  // ── Loading ──────────────────────────────────────────────────────────────

  /** Re-read from localStorage (call after setActiveStore or a pull-from-server). */
  reload(): void {
    const raw = this.storage.getItem(this.dataKey);
    this.rows = raw ? (JSON.parse(raw) as T[]) : [];
    this.baseline = this.rows.map(r => ({ ...r }));

    const meta = this.storage.getItem(this.metaKey);
    const entries: Array<[T[K], ChangeState]> = meta ? JSON.parse(meta) : [];
    this.changeMap = new Map(entries);

    // Determine the next negative ID from existing local records
    this._nextId = this.rows.reduce((min, r) => {
      const id = r[this.idKey] as unknown as number;
      return id < min ? id : min;
    }, 0) - 1;
  }

  // ── Reads ────────────────────────────────────────────────────────────────

  /** All non-deleted rows. */
  getAll(): T[] {
    return this.rows.filter(r => this.changeMap.get(r[this.idKey]) !== 'deleted');
  }

  getById(id: T[K]): T | undefined {
    const row = this.rows.find(r => r[this.idKey] === id);
    return row && this.changeMap.get(id) !== 'deleted' ? row : undefined;
  }

  // ── Writes ───────────────────────────────────────────────────────────────

  /**
   * Add a new record.  A negative local ID is assigned automatically.
   * The record is immediately persisted to localStorage.
   */
  add(entity: Omit<T, K>): T {
    const id = this._nextId-- as unknown as T[K];
    const newRow = { ...entity, [this.idKey]: id } as T;
    this.rows.push(newRow);
    this.changeMap.set(id, 'added');
    this._persist();
    return newRow;
  }

  /**
   * Update an existing record.  Already-added records stay as 'added';
   * previously-synced records are marked 'modified'.
   */
  update(entity: T): void {
    const id = entity[this.idKey];
    const idx = this.rows.findIndex(r => r[this.idKey] === id);
    if (idx < 0) return;
    this.rows[idx] = { ...entity };
    if (this.changeMap.get(id) !== 'added') this.changeMap.set(id, 'modified');
    this._persist();
  }

  /**
   * Remove a record.
   * - If it was never synced (state = 'added'), it is dropped entirely.
   * - Otherwise it is marked 'deleted' so the SyncService can send a DELETE.
   */
  remove(id: T[K]): void {
    if (this.changeMap.get(id) === 'added') {
      this.rows = this.rows.filter(r => r[this.idKey] !== id);
      this.changeMap.delete(id);
    } else {
      this.changeMap.set(id, 'deleted');
    }
    this._persist();
  }

  // ── Baseline / discard ───────────────────────────────────────────────────

  /**
   * Update the baseline to match current state (call after a successful sync
   * so future diffs are clean).
   */
  saveChanges(): void {
    this.baseline = this.rows.map(r => ({ ...r }));
    this._persist();
  }

  /**
   * Throw away all in-memory mutations and revert to the last saved baseline.
   * Does NOT touch records that have already been persisted to the backend.
   */
  discardChanges(): void {
    this.rows = this.baseline.map(r => ({ ...r }));
    this.changeMap.clear();
    this._persist();
  }

  // ── Sync helpers ─────────────────────────────────────────────────────────

  /** Returns all pending adds / modifications / deletes for the SyncService. */
  getPending(): ChangeSet<T> {
    return {
      added:    this.rows.filter(r => this.changeMap.get(r[this.idKey]) === 'added'),
      modified: this.rows.filter(r => this.changeMap.get(r[this.idKey]) === 'modified'),
      deleted:  this.rows.filter(r => this.changeMap.get(r[this.idKey]) === 'deleted'),
    };
  }

  /** How many records have unsync'd changes. */
  pendingCount(): number {
    return this.changeMap.size;
  }

  /**
   * After the backend confirms a new record, swap the temporary negative ID
   * for the real server-assigned ID and clear the 'added' state.
   */
  acceptRemoteId(localId: T[K], serverId: T[K]): void {
    const idx = this.rows.findIndex(r => r[this.idKey] === localId);
    if (idx < 0) return;
    this.rows[idx] = { ...this.rows[idx], [this.idKey]: serverId };
    this.changeMap.delete(localId);
    this._persist();
  }

  /** Return the last-known server version of a record (before any local edits). */
  getBaselineById(id: T[K]): T | undefined {
    return this.baseline.find(r => r[this.idKey] === id);
  }

  /**
   * Mark a single record as clean after a successful sync push.
   * Updates the baseline entry and removes change tracking for that ID.
   * For deleted records, also removes the row entirely.
   */
  markClean(id: T[K]): void {
    this.changeMap.delete(id);
    const row = this.rows.find(r => r[this.idKey] === id);
    const bIdx = this.baseline.findIndex(r => r[this.idKey] === id);
    if (row) {
      // Still exists — update baseline snapshot
      if (bIdx >= 0) this.baseline[bIdx] = { ...row };
      else this.baseline.push({ ...row });
    } else {
      // Was deleted and successfully pushed — purge from baseline and rows
      if (bIdx >= 0) this.baseline.splice(bIdx, 1);
      this.rows = this.rows.filter(r => r[this.idKey] !== id);
    }
    this._persist();
  }

  /**
   * Populate the table from server data without marking records as changed.
   * - Positive-ID rows are replaced with the server versions.
   * - Negative-ID rows (locally created, not yet synced) are preserved.
   * Call this on first load (when localStorage is empty) or after a
   * "Pull from server" to refresh authoritative data.
   */
  seed(entities: T[]): void {
    const localOnly = this.rows.filter(r => (r[this.idKey] as unknown as number) < 0);
    // Clear change tracking for any positive-ID rows
    for (const id of Array.from(this.changeMap.keys())) {
      if ((id as unknown as number) > 0) this.changeMap.delete(id);
    }
    this.rows = [...entities, ...localOnly];
    this.baseline = this.rows.map(r => ({ ...r }));
    this._persist();
  }

  /**
   * Mark all records as clean (no pending changes).
   * Call this after a successful full sync.
   */
  clearAllPending(): void {
    this.changeMap.clear();
    this.baseline = this.rows.map(r => ({ ...r }));
    this._persist();
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private _persist(): void {
    this.storage.setItem(this.dataKey, JSON.stringify(this.rows));
    this.storage.setItem(this.metaKey, JSON.stringify(Array.from(this.changeMap.entries())));
  }
}


// ---------------------------------------------------------------------------
// LocalStorageContext
// ---------------------------------------------------------------------------
// Single injectable that exposes one LocalTable per entity.
// Modelled after EF Core's DbContext — call setActiveStore() to scope all
// tables to a specific store's namespace.
// ---------------------------------------------------------------------------

@Injectable({ providedIn: 'root' })
export class LocalStorageContext {

  private storePrefix = 'to_store_0';

  players!:     LocalTable<PlayerDto,         'id'>;
  stores!:      LocalTable<StoreDto,          'id'>;
  events!:      LocalTable<EventDto,          'id'>;
  rounds!:      LocalTable<RoundDto,          'roundId'>;
  pods!:        LocalTable<PodDto,            'podId'>;
  gameResults!: LocalTable<LocalGameResultDto,'id'>;

  private static readonly ACTIVE_PREFIX_KEY = 'to_active_store_prefix';

  constructor(private storage: StorageAdapter, private auth: AuthService) {
    // Auto-scope to the authenticated user's store so navigating directly to
    // /players or /events reads from the correct localStorage namespace.
    const storeId = auth.currentUser?.storeId;
    if (storeId) {
      // Non-admin: always use the storeId from the JWT.
      this.storePrefix = `to_store_${storeId}`;
    } else {
      // Admin (no storeId in JWT): restore the last-used store prefix so that
      // data written under a specific store survives a page refresh.
      const saved = storage.getItem(LocalStorageContext.ACTIVE_PREFIX_KEY);
      if (saved) this.storePrefix = saved;
    }
    this._initTables();
  }

  // ── Store scope ───────────────────────────────────────────────────────────

  /**
   * Switch all tables to a different store's namespace.
   * Data from other stores remains untouched in localStorage.
   * Persists the active prefix so it is restored after a page refresh.
   */
  setActiveStore(storeId: number): void {
    this.storePrefix = `to_store_${storeId}`;
    this.storage.setItem(LocalStorageContext.ACTIVE_PREFIX_KEY, this.storePrefix);
    this._initTables();
  }

  get activeStorePrefix(): string {
    return this.storePrefix;
  }

  // ── Aggregate helpers ─────────────────────────────────────────────────────

  /** Total unsync'd changes across all tables. */
  totalPendingCount(): number {
    return this.players.pendingCount()
      + this.stores.pendingCount()
      + this.events.pendingCount()
      + this.rounds.pendingCount()
      + this.pods.pendingCount()
      + this.gameResults.pendingCount();
  }

  /** Persist all in-memory state and update baselines. */
  saveAll(): void {
    this.players.saveChanges();
    this.stores.saveChanges();
    this.events.saveChanges();
    this.rounds.saveChanges();
    this.pods.saveChanges();
    this.gameResults.saveChanges();
  }

  /** Reload all tables from localStorage (e.g. after a pull-from-server). */
  reloadAll(): void {
    this.players.reload();
    this.stores.reload();
    this.events.reload();
    this.rounds.reload();
    this.pods.reload();
    this.gameResults.reload();
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private _initTables(): void {
    this.players     = new LocalTable('players',     this.storePrefix,    'id',      this.storage);
    // Stores are global (not store-scoped) — always use a fixed namespace so
    // they are accessible regardless of which store is currently active.
    this.stores      = new LocalTable('stores',      'to_store_global',   'id',      this.storage);
    this.events      = new LocalTable('events',      this.storePrefix,    'id',      this.storage);
    this.rounds      = new LocalTable('rounds',      this.storePrefix,    'roundId', this.storage);
    this.pods        = new LocalTable('pods',         this.storePrefix,   'podId',   this.storage);
    this.gameResults = new LocalTable('gameResults', this.storePrefix,    'id',      this.storage);
  }
}
