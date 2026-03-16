import { Injectable } from '@angular/core';
import { Observable, of, throwError, EMPTY } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { BehaviorSubject } from 'rxjs';
import { ApiService } from './api.service';
import { LocalStorageContext } from './local-storage-context.service';
import { PlayerDto, LeaderboardEntry, CreatePlayerDto, UpdatePlayerDto } from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class PlayerService {
  private playersSubject     = new BehaviorSubject<PlayerDto[]>([]);
  private leaderboardSubject = new BehaviorSubject<LeaderboardEntry[]>([]);

  players$     = this.playersSubject.asObservable();
  leaderboard$ = this.leaderboardSubject.asObservable();

  constructor(private api: ApiService, private ctx: LocalStorageContext) {}

  // ── Reads ──────────────────────────────────────────────────────────────────

  /**
   * Emit local players immediately.
   * If the local table is empty, seeds from the API first.
   */
  loadAllPlayers(): void {
    const cached = this.ctx.players.getAll();
    if (cached.length > 0) {
      this.playersSubject.next(cached);
      return;
    }
    this.api.getAllPlayers().pipe(
      catchError(() => EMPTY)   // network unavailable — leave subject empty
    ).subscribe(data => {
      this.ctx.players.seed(data);
      this.playersSubject.next(this.ctx.players.getAll());
    });
  }

  /**
   * Pull fresh player data from the API and overwrite the local table.
   * Use this from the SyncService "Pull from server" action.
   */
  refreshPlayersFromApi(): Observable<void> {
    return this.api.getAllPlayers().pipe(
      tap(data => {
        this.ctx.players.seed(data);
        this.playersSubject.next(this.ctx.players.getAll());
      }),
      map((): void => {})
    );
  }

  /** Leaderboard is computed server-side — fetched from API, falls back to local cache. */
  loadLeaderboard(): void {
    this.api.getLeaderboard().pipe(
      catchError(() => {
        const ranked = this.ctx.players.getAll()
          .filter(p => p.isRanked)
          .sort((a, b) => b.conservativeScore - a.conservativeScore)
          .map((p, i): LeaderboardEntry => ({
            rank:              i + 1,
            playerId:          p.id,
            name:              p.name,
            conservativeScore: p.conservativeScore,
            mu:                p.mu,
            sigma:             p.sigma,
          }));
        return of(ranked);
      })
    ).subscribe(data => this.leaderboardSubject.next(data));
  }

  /** Player profile is a computed view — always fetched from the API. */
  getProfile(id: number) {
    return this.api.getPlayerProfile(id);
  }

  // ── Writes (local-first) ──────────────────────────────────────────────────

  /**
   * Add a new player to localStorage with a temporary negative ID.
   * Defaults mirror the backend's initial values.
   * The record is pushed to the backend on the next explicit sync.
   */
  registerPlayer(dto: CreatePlayerDto): Observable<PlayerDto> {
    const newPlayer = this.ctx.players.add({
      name:                dto.name,
      email:               dto.email,
      mu:                  25.0,
      sigma:               8.333,
      conservativeScore:   0.001,   // mu - 3*sigma ≈ 0
      isRanked:            false,
      placementGamesLeft:  5,
      isActive:            true,
    });
    this.playersSubject.next(this.ctx.players.getAll());
    return of(newPlayer);
  }

  /**
   * Update an existing player in localStorage.
   * The change is pushed to the backend on the next explicit sync.
   */
  updatePlayer(id: number, dto: UpdatePlayerDto): Observable<PlayerDto> {
    const existing = this.ctx.players.getById(id);
    if (!existing) return throwError(() => new Error(`Player ${id} not found in local store`));
    const updated: PlayerDto = { ...existing, name: dto.name, email: dto.email, isActive: dto.isActive };
    this.ctx.players.update(updated);
    this.playersSubject.next(this.ctx.players.getAll());
    return of(updated);
  }
}
