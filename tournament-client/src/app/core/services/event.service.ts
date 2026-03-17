import { Injectable } from '@angular/core';
import { Observable, of, throwError, EMPTY, forkJoin } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { BehaviorSubject } from 'rxjs';
import { ApiService } from './api.service';
import { LocalStorageContext } from './local-storage-context.service';
import { StorageAdapter } from './storage-adapter.service';
import { StoreContextService } from './store-context.service';
import {
  EventDto, RoundDto, PodDto, StandingsEntry, CreateEventDto,
  GameResultSubmit, EventPlayerDto, RegisterPlayerDto
} from '../models/api.models';

// Minimal player shape used for local pod-seeding calculations.
interface LocalPlayer { playerId: number; name: string; conservativeScore: number; }

/** Returns the next available negative ID given a list of existing IDs. */
function _nextLocalId(ids: number[]): number {
  return Math.min(0, ...ids) - 1;
}

@Injectable({ providedIn: 'root' })
export class EventService {
  private eventsSubject       = new BehaviorSubject<EventDto[]>([]);
  private currentEventSubject = new BehaviorSubject<EventDto | null>(null);
  private eventPlayersSubject = new BehaviorSubject<EventPlayerDto[]>([]);
  private roundsSubject       = new BehaviorSubject<RoundDto[]>([]);
  private standingsSubject    = new BehaviorSubject<StandingsEntry[]>([]);

  events$       = this.eventsSubject.asObservable();
  currentEvent$ = this.currentEventSubject.asObservable();
  eventPlayers$ = this.eventPlayersSubject.asObservable();
  rounds$       = this.roundsSubject.asObservable();
  standings$    = this.standingsSubject.asObservable();

  constructor(
    private api:          ApiService,
    private ctx:          LocalStorageContext,
    private storage:      StorageAdapter,
    private storeContext: StoreContextService
  ) {}

  /** Events visible in the current store context. */
  private eventsForActiveStore(): EventDto[] {
    const storeId = this.storeContext.selectedStoreId;
    const all = this.ctx.events.getAll();
    // Admins with a store selected see only that store's events.
    // When no store is selected (or non-admin), return all local events.
    if (!storeId) return all;
    return all.filter(e => !e.storeId || e.storeId === storeId);
  }

  // ── Per-event localStorage cache helpers ───────────────────────────────────

  private cacheKey(name: string, eventId: number): string {
    return `${this.ctx.activeStorePrefix}_${name}_${eventId}`;
  }

  private readCache<T>(name: string, eventId: number): T[] {
    const raw = this.storage.getItem(this.cacheKey(name, eventId));
    return raw ? (JSON.parse(raw) as T[]) : [];
  }

  private writeCache<T>(name: string, eventId: number, data: T[]): void {
    this.storage.setItem(this.cacheKey(name, eventId), JSON.stringify(data));
  }

  // ── Event list ─────────────────────────────────────────────────────────────

  /**
   * Emit local events immediately.
   * If the local table is empty, seeds from the API first.
   */
  loadAllEvents(): void {
    const storeId = this.storeContext.selectedStoreId;
    const cached = this.eventsForActiveStore();
    if (cached.length > 0) {
      this.eventsSubject.next(cached);
      return;
    }
    this.api.getAllEvents(storeId).pipe(
      catchError(() => EMPTY)   // network unavailable — leave subject empty
    ).subscribe(events => {
      this.ctx.events.seed(events);
      this.eventsSubject.next(this.eventsForActiveStore());
    });
  }

  /**
   * Pull fresh events from the API and overwrite the local table.
   * Use this from the SyncService "Pull from server" action.
   */
  refreshEventsFromApi(): Observable<void> {
    const storeId = this.storeContext.selectedStoreId;
    return this.api.getAllEvents(storeId).pipe(
      tap(events => {
        this.ctx.events.seed(events);
        this.eventsSubject.next(this.eventsForActiveStore());
      }),
      map((): void => {})
    );
  }

  // ── Single event ───────────────────────────────────────────────────────────

  /**
   * Load a single event — checks local store first, falls back to the API.
   * API result is seeded into the local store for future offline access.
   */
  loadEvent(id: number): void {
    const local = this.ctx.events.getById(id);
    if (local) {
      this.currentEventSubject.next(local);
      // Don't return — always fetch fresh so fields like checkInToken stay current
    }
    this.api.getEvent(id).pipe(
      catchError(() => EMPTY)   // network unavailable — leave subject empty
    ).subscribe(evt => {
      this.ctx.events.seed([evt]);
      this.currentEventSubject.next(evt);
    });
  }

  // ── Write: create event (local-first) ─────────────────────────────────────

  /**
   * Create a new event in localStorage with a temporary negative ID.
   * The record is pushed to the backend on the next explicit sync.
   */
  createEvent(dto: CreateEventDto): Observable<EventDto> {
    const newEvent = this.ctx.events.add({
      name:                     dto.name,
      date:                     dto.date,
      status:                   'Registration',
      playerCount:              0,
      defaultRoundTimeMinutes:  dto.defaultRoundTimeMinutes ?? 60,
      maxPlayers:               dto.maxPlayers ?? null,
      pointSystem:              dto.pointSystem ?? 'ScoreBased',
      storeId:                  dto.storeId,
      storeName:                undefined,
      plannedRounds:            null,
    });
    this.eventsSubject.next(this.eventsForActiveStore());
    return of(newEvent);
  }

  // ── Write: pass-through to API ─────────────────────────────────────────────
  // The following operations involve backend state-machine logic (pod seeding,
  // TrueSkill, scoring) that cannot be replicated locally.  They continue to
  // call the API directly.  Once a sync is implemented, the API responses can
  // be used to refresh the local event/round data.

  registerPlayer(eventId: number, dto: RegisterPlayerDto) {
    if (eventId < 0) {
      const player = this.ctx.players.getById(dto.playerId);
      if (!player) return throwError(() => new Error('Player not found in local store'));
      const entry: EventPlayerDto = {
        playerId:         player.id,
        name:             player.name,
        conservativeScore: player.conservativeScore,
        isRanked:         player.isRanked,
        decklistUrl:      dto.decklistUrl ?? null,
        commanders:       dto.commanders ?? null,
        isDropped:        false,
        isDisqualified:   false,
        isCheckedIn:      false,
      };
      const updated = [...this.eventPlayersSubject.value, entry];
      this.writeCache('ep', eventId, updated);
      this.eventPlayersSubject.next(updated);
      const evt = this.ctx.events.getById(eventId);
      if (evt) {
        const updatedEvt = { ...evt, playerCount: evt.playerCount + 1 };
        this.ctx.events.update(updatedEvt);
        this.currentEventSubject.next(updatedEvt);
      }
      return of<void>(undefined);
    }
    const applyLocally = () => {
      const player = this.ctx.players.getById(dto.playerId);
      if (!player) return;
      const entry: EventPlayerDto = {
        playerId:          player.id,
        name:              player.name,
        conservativeScore: player.conservativeScore,
        isRanked:          player.isRanked,
        decklistUrl:       dto.decklistUrl ?? null,
        commanders:        dto.commanders ?? null,
        isDropped:         false,
        isDisqualified:    false,
        isCheckedIn:       false,
      };
      const updated = [...this.eventPlayersSubject.value, entry];
      this.writeCache('ep', eventId, updated);
      this.eventPlayersSubject.next(updated);
      const evt = this.ctx.events.getById(eventId);
      if (evt) {
        const updatedEvt = { ...evt, playerCount: evt.playerCount + 1 };
        this.ctx.events.update(updatedEvt);
        this.ctx.events.markClean(updatedEvt.id);
        this.currentEventSubject.next(updatedEvt);
      }
    };

    return this.api.registerForEvent(eventId, dto).pipe(
      tap(() => applyLocally()),
      map((): void => {}),
      catchError((err) => {
        // Only fall back to local when the API is genuinely unreachable (no HTTP status).
        // HTTP 4xx/5xx from a running API must surface to the caller so the UI shows the error.
        if (err?.status != null) return throwError(() => err);
        applyLocally();
        return of<void>(undefined);
      })
    );
  }

  updateStatus(eventId: number, status: string, plannedRounds?: number): Observable<void> {
    if (eventId < 0) {
      const evt = this.ctx.events.getById(eventId);
      if (!evt) return throwError(() => new Error('Event not found in local store'));
      const updated = { ...evt, status, ...(plannedRounds != null ? { plannedRounds } : {}) };
      this.ctx.events.update(updated);
      this.currentEventSubject.next(updated);
      this.eventsSubject.next(this.eventsForActiveStore());
      return of<void>(undefined);
    }
    const applyLocally = () => {
      const evt = this.ctx.events.getById(eventId);
      if (!evt) return;
      const updated = { ...evt, status, ...(plannedRounds != null ? { plannedRounds } : {}) };
      this.ctx.events.update(updated);
      this.ctx.events.markClean(updated.id);
      this.currentEventSubject.next(updated);
      this.eventsSubject.next(this.eventsForActiveStore());
    };
    return this.api.updateEventStatus(eventId, status, plannedRounds).pipe(
      tap(() => applyLocally()),
      map((): void => {}),
      catchError(() => {
        applyLocally();
        return of<void>(undefined);
      })
    );
  }

  loadEventPlayers(eventId: number): void {
    const cached = this.readCache<EventPlayerDto>('ep', eventId);
    // Always emit immediately (cached data or []) to clear any stale players from a previous event.
    this.eventPlayersSubject.next(cached);
    if (eventId < 0) return; // locally-created event — no server record exists

    this.api.getEventPlayers(eventId).pipe(
      catchError(() => EMPTY)
    ).subscribe(players => {
      this.writeCache('ep', eventId, players);
      this.eventPlayersSubject.next(players);
    });
  }

  removeEvent(id: number) {
    // Locally-created events (negative ID) were never sent to the server —
    // remove from local storage and complete immediately, no API call needed.
    if (id < 0) {
      this.ctx.events.remove(id as unknown as EventDto['id']);
      this.eventsSubject.next(this.eventsForActiveStore());
      return of<void>(undefined);
    }
    return this.api.removeEvent(id).pipe(
      tap(() => {
        this.ctx.events.remove(id as unknown as EventDto['id']);
        this.eventsSubject.next(this.eventsForActiveStore());
      }),
      map((): void => {})
    );
  }

  dropPlayer(eventId: number, playerId: number) {
    if (eventId < 0) {
      const current = this.eventPlayersSubject.value;
      const updated = current.filter(p => p.playerId !== playerId);
      this.writeCache('ep', eventId, updated);
      this.eventPlayersSubject.next(updated);
      const evt = this.ctx.events.getById(eventId);
      if (evt) {
        const updatedEvt = { ...evt, playerCount: Math.max(0, evt.playerCount - 1) };
        this.ctx.events.update(updatedEvt);
        this.currentEventSubject.next(updatedEvt);
      }
      return of<void>(undefined);
    }
    return this.api.dropPlayer(eventId, playerId);
  }

  disqualifyPlayer(eventId: number, playerId: number) {
    if (eventId < 0) {
      const current = this.eventPlayersSubject.value;
      const updated = current.map(p => p.playerId === playerId ? { ...p, isDisqualified: true } : p);
      this.writeCache('ep', eventId, updated);
      this.eventPlayersSubject.next(updated);
      return of<void>(undefined);
    }
    return this.api.disqualifyPlayer(eventId, playerId);
  }

  clearAllPlayers(eventId: number): Observable<void> {
    if (eventId < 0) {
      // Local-only event — wipe the registration cache entirely.
      this.writeCache('ep', eventId, []);
      this.eventPlayersSubject.next([]);
      const evt = this.ctx.events.getById(eventId);
      if (evt) {
        const updated = { ...evt, playerCount: 0 };
        this.ctx.events.update(updated);
        this.currentEventSubject.next(updated);
      }
      return of<void>(undefined);
    }
    // API-backed event — drop every active player.
    const active = this.eventPlayersSubject.value.filter(p => !p.isDropped && !p.isDisqualified);
    if (active.length === 0) return of<void>(undefined);
    return forkJoin(active.map(p => this.api.dropPlayer(eventId, p.playerId))).pipe(
      tap(() => {
        this.loadEvent(eventId);
        this.loadEventPlayers(eventId);
      }),
      map((): void => {})
    );
  }

  setCheckIn(eventId: number, playerId: number, checkedIn: boolean): Observable<EventPlayerDto> {
    if (eventId < 0) {
      // Local-only event — update in-memory list and cache directly.
      const players = this.eventPlayersSubject.value;
      const idx = players.findIndex(p => p.playerId === playerId);
      if (idx < 0) return throwError(() => new Error('Player not found'));
      const updated = { ...players[idx], isCheckedIn: checkedIn };
      const newPlayers = players.map((p, i) => i === idx ? updated : p);
      this.eventPlayersSubject.next(newPlayers);
      this.writeCache('ep', eventId, newPlayers);
      return of(updated);
    }
    return this.api.setCheckIn(eventId, playerId, checkedIn).pipe(
      tap(updated => {
        const players = this.eventPlayersSubject.value;
        const newPlayers = players.map(p => p.playerId === updated.playerId ? updated : p);
        this.eventPlayersSubject.next(newPlayers);
        this.writeCache('ep', eventId, newPlayers);
      })
    );
  }

  setPlayerDropped(eventId: number, playerId: number, isDropped: boolean): Observable<EventPlayerDto> {
    return this.api.setPlayerDropped(eventId, playerId, isDropped).pipe(
      tap(updated => {
        const players = this.eventPlayersSubject.value;
        const newPlayers = players.map(p => p.playerId === updated.playerId ? updated : p);
        this.eventPlayersSubject.next(newPlayers);
        this.writeCache('ep', eventId, newPlayers);
      })
    );
  }

  promotePlayer(eventId: number, playerId: number): Observable<EventPlayerDto> {
    return this.api.promoteFromWaitlist(eventId, playerId).pipe(
      tap(updated => {
        const players = this.eventPlayersSubject.value;
        const newPlayers = players.map(p => p.playerId === updated.playerId ? updated : p);
        this.eventPlayersSubject.next(newPlayers);
        this.writeCache('ep', eventId, newPlayers);
      })
    );
  }

  declareCommander(eventId: number, playerId: number, commanders: string | null, decklistUrl?: string | null): Observable<EventPlayerDto> {
    return this.api.declareCommander(eventId, playerId, { commanders, decklistUrl }).pipe(
      tap(updated => {
        const players = this.eventPlayersSubject.value;
        const newPlayers = players.map(p => p.playerId === updated.playerId ? updated : p);
        this.eventPlayersSubject.next(newPlayers);
        this.writeCache('ep', eventId, newPlayers);
      })
    );
  }

  loadRounds(eventId: number): void {
    const cached = this.readCache<RoundDto>('rounds', eventId);
    if (cached.length > 0) this.roundsSubject.next(cached);
    if (eventId < 0) return; // locally-created event — no server record exists

    this.api.getRounds(eventId).pipe(
      catchError(() => EMPTY)
    ).subscribe(rounds => {
      this.writeCache('rounds', eventId, rounds);
      this.roundsSubject.next(rounds);
    });
  }

  generateNextRound(eventId: number) {
    return this.generateNextRound$(eventId).subscribe({
      next: round => {
        const current = this.roundsSubject.value;
        if (!current.find(r => r.roundId === round.roundId)) {
          this.roundsSubject.next([...current, round]);
        }
        this.loadEvent(eventId);
      }
    });
  }

  /**
   * Generate the next round.
   * - eventId < 0 (locally-created event): always generated locally.
   * - eventId > 0: try API first; fall back to local generation if offline.
   * The generated round is written to the rounds cache before being returned
   * so it survives a page reload without an API call.
   */
  generateNextRound$(eventId: number): Observable<RoundDto> {
    const tryLocal = (): Observable<RoundDto> => {
      try {
        const round = this._generateRoundLocally(eventId);
        const updated = [...this.roundsSubject.value, round];
        this.writeCache('rounds', eventId, updated);
        return of(round);
      } catch (e: unknown) {
        return throwError(() => ({ error: { error: (e as Error).message } }));
      }
    };

    if (eventId < 0) return tryLocal();

    return this.api.generateNextRound(eventId).pipe(
      catchError(() => tryLocal())
    );
  }

  // ── Local pod-seeding (mirrors backend PodService + EventService) ──────────

  private _generateRoundLocally(eventId: number): RoundDto {
    const activePlayers: LocalPlayer[] = this.eventPlayersSubject.value
      .filter(ep => !ep.isDropped && !ep.isDisqualified)
      .map(ep => {
        const p = this.ctx.players.getById(ep.playerId);
        return { playerId: ep.playerId, name: ep.name, conservativeScore: p?.conservativeScore ?? 0 };
      });

    if (activePlayers.length < 4)
      throw new Error('Need at least 4 active players to generate a round.');

    const existingRounds  = this.roundsSubject.value;
    const roundNumber     = existingRounds.length + 1;
    const previousRound   = existingRounds.length > 0 ? existingRounds[existingRounds.length - 1] : null;

    if (previousRound) {
      const incomplete = previousRound.pods.some(p => p.gameStatus !== 'Completed');
      if (incomplete)
        throw new Error('All games in the current round must be completed before generating the next round.');
    }

    const podAssignments = previousRound
      ? this._generateNextRoundPods(previousRound, activePlayers)
      : this._generateRound1Pods(activePlayers);

    // Compute next available negative IDs
    const allRoundIds = existingRounds.map(r => r.roundId);
    const allPodIds   = existingRounds.flatMap(r => r.pods.map(p => p.podId));
    const allGameIds  = existingRounds.flatMap(r => r.pods.map(p => p.gameId));
    let nextPodId  = _nextLocalId(allPodIds);
    let nextGameId = _nextLocalId(allGameIds);

    const pods: PodDto[] = podAssignments.map((players, i) => {
      // Randomise seat order (mirrors backend Random.Shared.Next())
      const shuffled = [...players].sort(() => Math.random() - 0.5);
      return {
        podId:         nextPodId--,
        podNumber:     i + 1,
        finishGroup:   previousRound ? this._determineFinishGroup(players, previousRound) : null,
        gameId:        nextGameId--,
        players:       shuffled.map((p, seat) => ({
          playerId: p.playerId, name: p.name,
          conservativeScore: p.conservativeScore, seatOrder: seat + 1
        })),
        gameStatus:    'Pending',
        winnerPlayerId: null,
      };
    });

    return { roundId: _nextLocalId(allRoundIds), roundNumber, pods };
  }

  /** Round 1: snake draft by conservativeScore descending. */
  private _generateRound1Pods(players: LocalPlayer[]): LocalPlayer[][] {
    const sorted   = [...players].sort((a, b) => b.conservativeScore - a.conservativeScore);
    const podCount = Math.max(1, Math.floor(sorted.length / 4));
    const pods: LocalPlayer[][] = Array.from({ length: podCount }, () => []);

    let forward  = true;
    let podIndex = 0;
    for (const player of sorted) {
      pods[podIndex].push(player);
      if (forward) {
        podIndex++;
        if (podIndex >= podCount) { podIndex = podCount - 1; forward = false; }
      } else {
        podIndex--;
        if (podIndex < 0)         { podIndex = 0;            forward = true;  }
      }
    }
    return this._rebalancePods(pods);
  }

  /** Round 2+: group by previous finish position, sort by score within group. */
  private _generateNextRoundPods(previousRound: RoundDto, players: LocalPlayer[]): LocalPlayer[][] {
    // Build finish-position map: prefer locally-queued results, fall back to winnerPlayerId
    const posMap = new Map<number, number>();
    for (const pod of previousRound.pods) {
      if (pod.gameStatus !== 'Completed') continue;
      const local = this.ctx.gameResults.getAll().filter(r => r.gameId === pod.gameId);
      if (local.length > 0) {
        for (const r of local) posMap.set(r.playerId, r.finishPosition);
      } else if (pod.winnerPlayerId != null) {
        posMap.set(pod.winnerPlayerId, 1);
        for (const p of pod.players) {
          if (p.playerId !== pod.winnerPlayerId) posMap.set(p.playerId, 4);
        }
      }
    }

    // Group players by finish position (default 4 for anyone without a result)
    const groupMap = new Map<number, LocalPlayer[]>();
    for (const player of players) {
      const pos  = posMap.get(player.playerId) ?? 4;
      const list = groupMap.get(pos) ?? [];
      list.push(player);
      groupMap.set(pos, list);
    }
    const groups = [...groupMap.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, g]) => g);

    const allPods: LocalPlayer[][] = [];
    let overflow: LocalPlayer[] = [];

    for (const group of groups) {
      const groupPlayers = [...overflow, ...group].sort((a, b) => b.conservativeScore - a.conservativeScore);
      overflow = [];
      if (groupPlayers.length < 3) { overflow.push(...groupPlayers); continue; }

      let podCount = Math.max(1, Math.floor(groupPlayers.length / 4));
      const pods: LocalPlayer[][] = Array.from({ length: podCount }, () => []);
      for (let i = 0; i < groupPlayers.length; i++) pods[i % podCount].push(groupPlayers[i]);
      allPods.push(...this._rebalancePods(pods));
    }

    if (overflow.length > 0) {
      if (allPods.length > 0) {
        for (const player of overflow) {
          const smallest = allPods.sort((a, b) => a.length - b.length)[0];
          if (smallest.length < 5) smallest.push(player); else allPods.push([player]);
        }
      } else {
        allPods.push(overflow);
      }
    }

    // Balance 3/5 pairs into 4s
    const pods3 = allPods.filter(p => p.length === 3);
    const pods5 = allPods.filter(p => p.length === 5);
    const pairs = Math.min(pods3.length, pods5.length);
    for (let i = 0; i < pairs; i++) pods3[i].push(pods5[i].pop()!);

    return allPods;
  }

  private _rebalancePods(pods: LocalPlayer[][]): LocalPlayer[][] {
    pods = pods.filter(p => p.length > 0);
    if (pods.length <= 1) return pods;

    const result: LocalPlayer[][] = [];
    const stragglers: LocalPlayer[] = [];
    for (const pod of pods) {
      if (pod.length < 3) stragglers.push(...pod); else result.push(pod);
    }
    for (const player of stragglers) {
      const target = result.filter(p => p.length < 5).sort((a, b) => a.length - b.length)[0];
      if (target) target.push(player); else result.push([player]);
    }
    return result;
  }

  /** Most common finish position among podPlayers in the previous round. */
  private _determineFinishGroup(podPlayers: LocalPlayer[], previousRound: RoundDto): number | null {
    const playerIds = new Set(podPlayers.map(p => p.playerId));
    const allResults = this.ctx.gameResults.getAll();
    const relevant = previousRound.pods
      .filter(p => p.gameStatus === 'Completed')
      .flatMap(p => {
        const local = allResults.filter(r => r.gameId === p.gameId && playerIds.has(r.playerId));
        if (local.length > 0) return local.map(r => r.finishPosition);
        // Fall back: use winnerPlayerId if no local results
        if (p.winnerPlayerId != null && playerIds.has(p.winnerPlayerId)) return [1];
        return [];
      });

    if (relevant.length === 0) return null;
    const freq = new Map<number, number>();
    for (const pos of relevant) freq.set(pos, (freq.get(pos) ?? 0) + 1);
    return [...freq.entries()].sort((a, b) => b[1] - a[1])[0][0];
  }

  submitGameResult(gameId: number, results: GameResultSubmit[], eventId?: number): Observable<void> {
    return this.api.submitGameResult(gameId, results).pipe(
      map((): void => {}),
      catchError(() => {
        for (const r of results) {
          this.ctx.gameResults.add({
            gameId,
            playerId:       r.playerId,
            finishPosition: r.finishPosition,
            eliminations:   r.eliminations,
            turnsSurvived:  r.turnsSurvived,
            commanderPlayed: r.commanderPlayed,
            deckColors:     r.deckColors,
            conceded:       r.conceded,
          });
        }
        if (eventId != null) {
          const winnerId = results.find(r => r.finishPosition === 1)?.playerId ?? null;
          this._patchPodInRoundsCache(eventId, gameId, { gameStatus: 'Completed', winnerPlayerId: winnerId });
        }
        return of<void>(undefined);
      })
    );
  }

  revertGameResult(gameId: number, eventId?: number): Observable<void> {
    return this.api.revertGameResult(gameId).pipe(
      map((): void => {}),
      catchError(() => {
        const queued = this.ctx.gameResults.getAll().filter(r => r.gameId === gameId);
        for (const r of queued) this.ctx.gameResults.remove(r.id);
        if (eventId != null) {
          this._patchPodInRoundsCache(eventId, gameId, { gameStatus: 'Pending', winnerPlayerId: null });
        }
        return of<void>(undefined);
      })
    );
  }

  private _patchPodInRoundsCache(eventId: number, gameId: number, patch: Partial<PodDto>): void {
    const cached = this.readCache<RoundDto>('rounds', eventId);
    if (!cached.length) return;
    const updated = cached.map(round => ({
      ...round,
      pods: round.pods.map(pod => pod.gameId === gameId ? { ...pod, ...patch } : pod)
    }));
    this.writeCache('rounds', eventId, updated);
    this.roundsSubject.next(updated);
  }

  loadStandings(eventId: number): void {
    // For locally-created events (negative ID), always compute from local data.
    if (eventId < 0) {
      const standings = this._computeStandingsLocally(eventId);
      this.writeCache('standings', eventId, standings);
      this.standingsSubject.next(standings);
      return;
    }

    const cached = this.readCache<StandingsEntry>('standings', eventId);
    if (cached.length > 0) this.standingsSubject.next(cached);

    this.api.getStandings(eventId).pipe(
      catchError(() => {
        // API unavailable — derive standings from cached rounds + queued results.
        const standings = this._computeStandingsLocally(eventId);
        this.writeCache('standings', eventId, standings);
        this.standingsSubject.next(standings);
        return EMPTY;
      })
    ).subscribe(standings => {
      this.writeCache('standings', eventId, standings);
      this.standingsSubject.next(standings);
    });
  }

  // ── Local standings computation ─────────────────────────────────────────────

  private _computeStandingsLocally(eventId: number): StandingsEntry[] {
    const evt = this.ctx.events.getById(eventId);
    const rounds = this.readCache<RoundDto>('rounds', eventId);
    if (!rounds.length) return [];

    const players = this.eventPlayersSubject.value;
    const playerNames = new Map(players.map(p => [p.playerId, p.name]));
    const playerCSMap = new Map(players.map(p => [p.playerId, p.conservativeScore]));
    const pointSystem = evt?.pointSystem ?? 'ScoreBased';

    // Index locally-queued game results by gameId
    const queuedByGame = new Map<number, Array<{ playerId: number; finishPosition: number }>>();
    for (const r of this.ctx.gameResults.getAll()) {
      const list = queuedByGame.get(r.gameId) ?? [];
      list.push(r);
      queuedByGame.set(r.gameId, list);
    }

    type PlayerEntry = {
      name: string; points: number;
      positions: number[]; gameResults: string[]; oppScores: number[];
    };
    const accumulator = new Map<number, PlayerEntry>();
    const ensure = (id: number) => {
      if (!accumulator.has(id))
        accumulator.set(id, { name: playerNames.get(id) ?? `#${id}`, points: 0, positions: [], gameResults: [], oppScores: [] });
      return accumulator.get(id)!;
    };

    for (const round of rounds) {
      for (const pod of round.pods) {
        if (pod.gameStatus !== 'Completed') continue;

        // Prefer queued results; fall back to winnerPlayerId from the cached pod
        let results: { playerId: number; finishPosition: number }[];
        const queued = queuedByGame.get(pod.gameId);
        if (queued && queued.length > 0) {
          results = queued.map(r => ({ playerId: r.playerId, finishPosition: r.finishPosition }));
        } else if (pod.winnerPlayerId != null) {
          results = [
            { playerId: pod.winnerPlayerId, finishPosition: 1 },
            ...pod.players
              .filter(p => p.playerId !== pod.winnerPlayerId)
              .map((p, i) => ({ playerId: p.playerId, finishPosition: i + 2 })),
          ];
        } else {
          // Draw recorded without full results — give everyone last place
          const pos = pod.players.length;
          results = pod.players.map(p => ({ playerId: p.playerId, finishPosition: pos }));
        }

        const isDraw = results.length > 0 && results.every(r => r.finishPosition === results[0].finishPosition);
        for (const res of results) {
          const entry = ensure(res.playerId);
          entry.points += this._calcPoints(pointSystem, res.finishPosition, isDraw);
          entry.positions.push(res.finishPosition);
          entry.gameResults.push(isDraw ? 'D' : res.finishPosition === 1 ? 'W' : 'L');
          for (const opp of pod.players.filter(p => p.playerId !== res.playerId))
            entry.oppScores.push(playerCSMap.get(opp.playerId) ?? opp.conservativeScore);
        }
      }
    }

    const list: StandingsEntry[] = [];
    for (const [playerId, e] of accumulator.entries()) {
      const tiebreaker = e.oppScores.length ? e.oppScores.reduce((a, b) => a + b, 0) / e.oppScores.length : 0;
      list.push({ rank: 0, playerId, playerName: e.name, totalPoints: e.points,
        tiebreaker: Math.round(tiebreaker * 100) / 100,
        finishPositions: e.positions, gameResults: e.gameResults });
    }
    list.sort((a, b) => b.totalPoints - a.totalPoints || b.tiebreaker - a.tiebreaker);
    list.forEach((s, i) => { s.rank = i + 1; });
    return list;
  }

  /** Mirrors backend EventService.CalculatePoints. */
  private _calcPoints(system: string, position: number, isDraw: boolean): number {
    if (system === 'WinBased') return isDraw ? 1 : position === 1 ? 5 : 0;
    // ScoreBased (default)
    return position === 1 ? 4 : position === 2 ? 3 : position === 3 ? 2 : 1;
  }

  addRound(round: RoundDto): void {
    const current = this.roundsSubject.value;
    this.roundsSubject.next([...current, round]);
  }

  clearRounds(): void {
    this.roundsSubject.next([]);
  }
}
