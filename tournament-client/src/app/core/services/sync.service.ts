import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { LocalStorageContext } from './local-storage-context.service';
import { StorageAdapter } from './storage-adapter.service';
import { PlayerService } from './player.service';
import { EventService } from './event.service';
import {
  SyncResult, ExportData, ImportValidation,
  CreatePlayerDto, UpdatePlayerDto, PlayerDto,
  CreateEventDto, GameResultSubmit,
  EventDto, EventPlayerDto, RoundDto, AppUserDto
} from '../models/api.models';
import {
  SyncConflictDialogComponent,
  ConflictDialogData
} from '../../features/stores/dialogs/sync-conflict-dialog.component';

@Injectable({ providedIn: 'root' })
export class SyncService {

  constructor(
    private ctx:           LocalStorageContext,
    private api:           ApiService,
    private storage:       StorageAdapter,
    private playerService: PlayerService,
    private eventService:  EventService,
    private dialog:        MatDialog
  ) {}

  // ── Public API ──────────────────────────────────────────────────────────────

  /** Total unsync'd changes across all tables. */
  get pendingCount(): number {
    return this.ctx.totalPendingCount();
  }

  /**
   * Push all pending local changes to the backend.
   *
   * - Added records   → POST  (temporary negative ID swapped for real server ID)
   * - Modified records → conflict-check then PUT
   * - Deleted records  → DELETE
   *
   * Returns a summary of pushed / conflicts / errors.
   */
  async push(): Promise<SyncResult> {
    const result: SyncResult = { pushed: 0, conflicts: 0, errors: 0 };

    await this._pushStoreSettings(result);
    await this._pushPlayers(result);
    await this._pushEvents(result);                      // includes players/rounds/results for new events
    await this._pushPendingRoundsForPositiveEvents(result); // rounds generated offline for existing events
    await this._pushGameResults(result);                 // game results submitted offline for server games
    await this._pushEmployees(result);

    return result;
  }

  /**
   * Pull authoritative data from the server and overwrite local tables.
   * Locally-created (negative-ID) records are preserved.
   *
   * Callers should warn the user if `pendingCount > 0` before calling this,
   * since pulling will discard pending changes for positive-ID records.
   */
  async pull(): Promise<SyncResult> {
    await firstValueFrom(this.playerService.refreshPlayersFromApi());
    await firstValueFrom(this.eventService.refreshEventsFromApi());
    return { pushed: 0, conflicts: 0, errors: 0 };
  }

  // ── Store Settings ─────────────────────────────────────────────────────────

  private async _pushStoreSettings(result: SyncResult): Promise<void> {
    const prefixMatch = this.ctx.activeStorePrefix.match(/to_store_(\d+)/);
    if (!prefixMatch) return;
    const storeId = parseInt(prefixMatch[1], 10);
    if (!storeId || storeId <= 0) return;

    const key = `to_store_settings_pending_${storeId}`;
    const raw = this.storage.getItem(key);
    if (!raw) return;

    try {
      const dto: { storeName: string; allowableTradeDifferential: number } = JSON.parse(raw);
      await firstValueFrom(this.api.updateStore(storeId, dto));
      this.storage.removeItem(key);
      // Also mark the cached store clean so ctx.stores.pendingCount() drops to 0
      this.ctx.stores.markClean(storeId);
      result.pushed++;
    } catch {
      result.errors++;
    }
  }

  // ── Players ────────────────────────────────────────────────────────────────

  private async _pushPlayers(result: SyncResult): Promise<void> {
    const pending = this.ctx.players.getPending();

    // ── Added ──────────────────────────────────────────────────────────────
    for (const player of pending.added) {
      try {
        const dto: CreatePlayerDto = { name: player.name, email: player.email };
        const created = await firstValueFrom(this.api.registerPlayer(dto));
        // Swap the temporary negative ID for the real server ID
        this.ctx.players.acceptRemoteId(player.id, created.id);
        result.pushed++;
      } catch {
        result.errors++;
      }
    }

    // ── Modified (with conflict detection) ────────────────────────────────
    for (const player of pending.modified) {
      try {
        // Fetch the current server version to detect independent changes
        const serverProfile = await firstValueFrom(this.api.getPlayerProfile(player.id));
        const baseline = this.ctx.players.getBaselineById(player.id);

        // A conflict exists when the server version differs from our baseline
        // (meaning someone else changed the server record since we last synced)
        const conflictFields = baseline
          ? diffFields(player as unknown as Record<string, unknown>,
                       serverProfile as unknown as Record<string, unknown>,
                       baseline as unknown as Record<string, unknown>,
                       ['name', 'email', 'isActive'])
          : [];

        let finalPlayer = player;

        if (conflictFields.length > 0) {
          result.conflicts++;
          const data: ConflictDialogData = {
            entityType: 'Player',
            entityId:   player.id,
            local:      player as unknown as Record<string, unknown>,
            server:     serverProfile as unknown as Record<string, unknown>,
            diffFields: conflictFields,
          };
          const resolved = await firstValueFrom(
            this.dialog.open(SyncConflictDialogComponent, { data, width: '620px' }).afterClosed()
          );
          if (!resolved) continue; // user cancelled this record
          finalPlayer = resolved as unknown as PlayerDto;
        }

        const dto: UpdatePlayerDto = {
          name:     finalPlayer.name,
          email:    finalPlayer.email,
          isActive: finalPlayer.isActive
        };
        await firstValueFrom(this.api.updatePlayer(player.id, dto));
        this.ctx.players.markClean(player.id);
        result.pushed++;
      } catch {
        result.errors++;
      }
    }

    // Note: there is no DELETE /api/players — deactivation is via PUT isActive=false.
    // Locally-deleted players are intentionally not pushed (they are deactivated instead
    // via updatePlayer with isActive=false, which is covered by the modified path above).
  }

  // ── Game Results ───────────────────────────────────────────────────────────

  private async _pushGameResults(result: SyncResult): Promise<void> {
    // Only handle results for server-side games (positive gameIds).
    // Results for locally-generated games (negative gameIds) are handled in _pushRoundsAndResults.
    const pending = this.ctx.gameResults.getPending().added
      .filter(r => (r.gameId as unknown as number) > 0);

    // Group by gameId — each game's results must be submitted together
    const byGame = new Map<number, typeof pending>();
    for (const r of pending) {
      const list = byGame.get(r.gameId) ?? [];
      list.push(r);
      byGame.set(r.gameId, list);
    }

    for (const [gameId, gameResults] of byGame) {
      try {
        const dto: GameResultSubmit[] = gameResults.map(r => ({
          playerId:        r.playerId,
          finishPosition:  r.finishPosition,
          eliminations:    r.eliminations,
          turnsSurvived:   r.turnsSurvived,
          commanderPlayed: r.commanderPlayed,
          deckColors:      r.deckColors,
          conceded:        r.conceded,
        }));
        await firstValueFrom(this.api.submitGameResult(gameId, dto));
        for (const r of gameResults) this.ctx.gameResults.markClean(r.id);
        result.pushed++;
      } catch {
        result.errors++;
      }
    }
  }

  // ── Events ─────────────────────────────────────────────────────────────────

  private async _pushEvents(result: SyncResult): Promise<void> {
    const pending = this.ctx.events.getPending();

    // ── Added ──────────────────────────────────────────────────────────────
    for (const evt of pending.added) {
      try {
        const dto: CreateEventDto = {
          name:                    evt.name,
          date:                    evt.date,
          storeId:                 evt.storeId,
          defaultRoundTimeMinutes: evt.defaultRoundTimeMinutes,
          maxPlayers:              evt.maxPlayers,
          pointSystem:             evt.pointSystem,
        };
        const created = await firstValueFrom(this.api.createEvent(dto));
        const oldId = evt.id as unknown as number;
        this.ctx.events.acceptRemoteId(evt.id, created.id);
        result.pushed++;
        // Push players, status, rounds, and game results that were recorded offline.
        await this._pushEventDetails(oldId, created.id as unknown as number, evt, result);
      } catch {
        result.errors++;
      }
    }

    // ── Deleted ────────────────────────────────────────────────────────────
    for (const evt of pending.deleted) {
      try {
        await firstValueFrom(this.api.removeEvent(evt.id));
        this.ctx.events.markClean(evt.id);
        result.pushed++;
      } catch {
        result.errors++;
      }
    }

    // ── Modified (stale entries) ───────────────────────────────────────────
    // Positive-ID events marked 'modified' are playerCount/status updates that
    // were already applied via direct API calls (registerPlayer, updateStatus).
    // There is nothing to push — just clear the stale tracking entries.
    for (const evt of pending.modified) {
      if ((evt.id as unknown as number) > 0) {
        this.ctx.events.markClean(evt.id);
      }
    }
  }

  // Push players, status changes, rounds and game results for a locally-created event
  // that was just created on the server (oldId → serverId).
  private async _pushEventDetails(
    localEventId: number,
    serverEventId: number,
    evt: EventDto,
    result: SyncResult
  ): Promise<void> {
    // 1. Register players that were signed up offline.
    const cachedPlayers = this._readEventCache<EventPlayerDto>('ep', localEventId);
    for (const player of cachedPlayers.filter(p => !p.isDropped && !p.isDisqualified)) {
      try {
        await firstValueFrom(this.api.registerForEvent(serverEventId, {
          playerId:    player.playerId,
          decklistUrl: player.decklistUrl ?? undefined,
          commanders:  player.commanders,
        }));
        result.pushed++;
      } catch { result.errors++; }
    }

    // 2. Push check-in states while the event is still in Registration status.
    // SetCheckIn on the server requires Registration; must happen before InProgress.
    for (const player of cachedPlayers.filter(p => !p.isDropped && !p.isDisqualified && p.isCheckedIn)) {
      try {
        await firstValueFrom(this.api.setCheckIn(serverEventId, player.playerId, true));
      } catch { /* best-effort */ }
    }

    // 3. Move event to InProgress if it was started locally.
    // generateNextRound for round 1 also sets InProgress automatically, but we call
    // this explicitly to carry across plannedRounds.
    if (evt.status === 'InProgress' || evt.status === 'Completed') {
      try {
        await firstValueFrom(
          this.api.updateEventStatus(serverEventId, 'InProgress', evt.plannedRounds ?? undefined)
        );
        result.pushed++;
      } catch { result.errors++; }
    }

    // 4. Generate rounds on the server and submit their game results.
    const cachedRounds = this._readEventCache<RoundDto>('rounds', localEventId)
      .sort((a, b) => a.roundNumber - b.roundNumber);
    await this._pushRoundsAndResults(localEventId, serverEventId, cachedRounds, result);

    // 5. Mark the event Completed on the server if it was finished locally.
    if (evt.status === 'Completed') {
      try {
        await firstValueFrom(this.api.updateEventStatus(serverEventId, 'Completed'));
        result.pushed++;
      } catch { result.errors++; }
    }
  }

  // Generate rounds on the server and submit any locally-queued game results
  // by matching local pods to server pods via player overlap.
  private async _pushRoundsAndResults(
    localEventId: number,
    serverEventId: number,
    localRounds: RoundDto[],
    result: SyncResult
  ): Promise<void> {
    for (const localRound of localRounds) {
      let serverRound: RoundDto;
      try {
        serverRound = await firstValueFrom(this.api.generateNextRound(serverEventId));
        result.pushed++;
      } catch { result.errors++; continue; }

      for (const localPod of localRound.pods) {
        if (localPod.gameStatus !== 'Completed') continue;

        const queuedResults = this.ctx.gameResults.getAll()
          .filter(r => r.gameId === (localPod.gameId as unknown as number));
        if (!queuedResults.length) continue;

        // Match server pod by greatest player-set overlap.
        const localPlayerIds = new Set(localPod.players.map(p => p.playerId));
        const serverPod = serverRound.pods
          .map(sp => ({ sp, overlap: sp.players.filter(p => localPlayerIds.has(p.playerId)).length }))
          .sort((a, b) => b.overlap - a.overlap)[0]?.sp;
        if (!serverPod) continue;

        try {
          const dto: GameResultSubmit[] = queuedResults.map(r => ({
            playerId:        r.playerId,
            finishPosition:  r.finishPosition,
            eliminations:    r.eliminations,
            turnsSurvived:   r.turnsSurvived,
            commanderPlayed: r.commanderPlayed,
            deckColors:      r.deckColors,
            conceded:        r.conceded,
          }));
          await firstValueFrom(this.api.submitGameResult(serverPod.gameId as unknown as number, dto));
          for (const r of queuedResults) this.ctx.gameResults.markClean(r.id);
          result.pushed++;
        } catch { result.errors++; }
      }
    }
  }

  // Push rounds that were generated offline for events that already existed on the server.
  private async _pushPendingRoundsForPositiveEvents(result: SyncResult): Promise<void> {
    const allEvents = this.ctx.events.getAll().filter(e => (e.id as unknown as number) > 0);
    for (const evt of allEvents) {
      const eventId = evt.id as unknown as number;
      const offlineRounds = this._readEventCache<RoundDto>('rounds', eventId)
        .filter(r => (r.roundId as unknown as number) < 0)
        .sort((a, b) => a.roundNumber - b.roundNumber);
      if (!offlineRounds.length) continue;

      // Round 1 on the server requires checked-in players. Push check-in state
      // for every player in the local ep cache before generating rounds.
      const cachedPlayers = this._readEventCache<EventPlayerDto>('ep', eventId);
      for (const player of cachedPlayers.filter(p => !p.isDropped && !p.isDisqualified && p.isCheckedIn)) {
        try {
          await firstValueFrom(this.api.setCheckIn(eventId, player.playerId, true));
        } catch { /* best-effort — generate round will fail if not enough check-ins */ }
      }

      await this._pushRoundsAndResults(eventId, eventId, offlineRounds, result);
    }
  }

  // ── Employees ──────────────────────────────────────────────────────────────

  private async _pushEmployees(result: SyncResult): Promise<void> {
    const prefixMatch = this.ctx.activeStorePrefix.match(/to_store_(\d+)/);
    if (!prefixMatch) return;
    const storeId = parseInt(prefixMatch[1], 10);
    if (!storeId || storeId <= 0) return;

    const cacheKey = `${this.ctx.activeStorePrefix}_employees_${storeId}`;
    const deletionsCacheKey = `${cacheKey}_deletions`;

    // ── Push queued deletions ─────────────────────────────────────────────────
    const deletionsRaw = this.storage.getItem(deletionsCacheKey);
    if (deletionsRaw) {
      const pendingDeletions: number[] = JSON.parse(deletionsRaw);
      const remaining: number[] = [];
      for (const userId of pendingDeletions) {
        try {
          await firstValueFrom(this.api.removeStoreEmployee(storeId, userId));
          result.pushed++;
        } catch {
          remaining.push(userId);
          result.errors++;
        }
      }
      this.storage.setItem(deletionsCacheKey, JSON.stringify(remaining));
    }

    // ── Push queued additions (negative IDs) ──────────────────────────────────
    const raw = this.storage.getItem(cacheKey);
    if (!raw) return;

    // Use a mutable copy so each successful push updates the array for the next
    // iteration (prevents a second negative-ID employee from overwriting the
    // positive ID assigned to the first one).
    const employees: AppUserDto[] = JSON.parse(raw);
    const pending = employees.filter(e => (e.id as unknown as number) < 0);
    for (const emp of pending) {
      try {
        const created = await firstValueFrom(this.api.addStoreEmployee(storeId, {
          name:  emp.name,
          email: emp.email,
          role:  emp.role as 'StoreEmployee' | 'StoreManager',
        }));
        const idx = employees.findIndex(e => e.id === emp.id);
        if (idx >= 0) employees[idx] = created;
        this.storage.setItem(cacheKey, JSON.stringify(employees));
        result.pushed++;
      } catch { result.errors++; }
    }
  }

  // Read a per-event localStorage cache (same key format as EventService).
  private _readEventCache<T>(name: string, eventId: number): T[] {
    const key = `${this.ctx.activeStorePrefix}_${name}_${eventId}`;
    const raw = this.storage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  }

  // ── Export / Import (Step 5) ───────────────────────────────────────────────

  /**
   * Serialise the active store's local tables to a JSON file and trigger
   * a browser download named `to_store_{storeId}_{date}.json`.
   */
  exportStore(storeId: number): void {
    const data: ExportData = {
      storeId,
      exportedAt:  new Date().toISOString(),
      players:     this.ctx.players.getAll(),
      stores:      this.ctx.stores.getAll(),
      events:      this.ctx.events.getAll(),
      rounds:      this.ctx.rounds.getAll(),
      pods:        this.ctx.pods.getAll(),
      gameResults: this.ctx.gameResults.getAll(),
    };
    const blob   = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url    = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href  = url;
    anchor.download = `to_store_${storeId}_${new Date().toISOString().split('T')[0]}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Parse and validate an imported JSON file.
   * Returns `status: 'storeIdMismatch'` when the file was exported for a
   * different store — callers should prompt the user to confirm before
   * calling `applyImport()`.
   */
  async validateImportFile(file: File, expectedStoreId: number): Promise<ImportValidation> {
    let text: string;
    try { text = await file.text(); }
    catch { return { status: 'parseError', error: 'Could not read file' }; }

    let raw: unknown;
    try { raw = JSON.parse(text); }
    catch { return { status: 'parseError', error: 'File is not valid JSON' }; }

    const d = raw as Record<string, unknown>;
    if (typeof d['storeId'] !== 'number' || typeof d['exportedAt'] !== 'string') {
      return { status: 'invalidFormat', error: 'Missing required fields: storeId, exportedAt' };
    }

    const data = raw as ExportData;
    if (data.storeId !== expectedStoreId) {
      return { status: 'storeIdMismatch', data, fileStoreId: data.storeId };
    }
    return { status: 'ok', data };
  }

  /**
   * Load parsed export data into the current active store's local tables.
   * Existing positive-ID records are replaced; negative-ID (local-only)
   * records are preserved.
   */
  applyImport(data: ExportData): void {
    if (data.players)     this.ctx.players.seed(data.players);
    if (data.stores)      this.ctx.stores.seed(data.stores);
    if (data.events)      this.ctx.events.seed(data.events);
    if (data.rounds)      this.ctx.rounds.seed(data.rounds);
    if (data.pods)        this.ctx.pods.seed(data.pods);
    if (data.gameResults) this.ctx.gameResults.seed(data.gameResults);
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns fields where both the local version AND the server version differ
 * from the baseline.  This is a genuine conflict — both sides changed
 * independently.  Fields where only the local version differs are not
 * conflicts (they're just our pending edits).
 */
function diffFields(
  local:    Record<string, unknown>,
  server:   Record<string, unknown>,
  baseline: Record<string, unknown>,
  watched:  string[]
): string[] {
  return watched.filter(k =>
    local[k] !== server[k] &&    // local and server differ
    server[k] !== baseline[k]    // server also changed from baseline → true conflict
  );
}
