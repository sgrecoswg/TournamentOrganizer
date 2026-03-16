import { Component, OnInit, ViewChildren, QueryList, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatTabsModule, MatTabChangeEvent } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatCardModule } from '@angular/material/card';
import * as QRCode from 'qrcode';
import { EventService } from '../../core/services/event.service';
import { PlayerService } from '../../core/services/player.service';
import { AuthService } from '../../core/services/auth.service';
import { EventDto, RoundDto, StandingsEntry, EventPlayerDto, PlayerDto, POINT_SYSTEM_LABELS } from '../../core/models/api.models';
import { PodCardComponent, PodResultState } from './pod-card.component';
import { EventStandingsComponent } from './event-standings.component';

@Component({
  selector: 'app-event-detail',
  imports: [
    CommonModule, FormsModule, RouterLink,
    MatTabsModule, MatButtonModule, MatFormFieldModule, MatInputModule,
    MatTableModule, MatChipsModule, MatExpansionModule, MatIconModule,
    MatAutocompleteModule, MatSnackBarModule,
    PodCardComponent, EventStandingsComponent,
    MatCheckboxModule, MatCardModule,
  ],
  template: `
    @if (event) {
      <div class="event-header">
        <div class="event-info">
          <h2>{{ event.name }}</h2>
          @if (event.storeName) {
            <p class="store-label">{{ event.storeName }}</p>
          }
          <p>
            {{ event.date | date:'fullDate' }} —
            <mat-chip>{{ event.status }}</mat-chip>
            <mat-chip>{{ pointSystemLabel }}</mat-chip>
            —
            {{ event.playerCount }}{{ event.maxPlayers ? '/' + event.maxPlayers : '' }} players
            @if (event.maxPlayers && event.status === 'Registration' && event.playerCount < event.maxPlayers) {
              <span class="slots-remaining">({{ event.maxPlayers - event.playerCount }} remaining)</span>
            }
            — {{ event.defaultRoundTimeMinutes }}min rounds
            @if (event.plannedRounds) {
              — <span class="round-progress">{{ rounds.length }}/{{ event.plannedRounds }} rounds planned</span>
            }
          </p>
          @if (authService.isStoreEmployee) {
            <div class="status-actions">
              @if (event.status === 'Registration') {
                @if (!showStartConfirm) {
                  <button mat-raised-button color="primary" (click)="prepareStart()" [disabled]="!allCheckedIn">
                    <mat-icon>play_arrow</mat-icon> Start Event
                  </button>
                } @else {
                  <div class="start-confirm">
                    <span class="start-confirm-label">Rounds:</span>
                    <input type="number" [(ngModel)]="confirmedRounds" min="1" max="20" class="rounds-input">
                    <span class="rounds-hint">Suggested for {{ event.playerCount }} players: {{ getRecommendedRounds(event.playerCount) }}</span>
                    <button mat-raised-button color="primary" (click)="confirmStart()">
                      <mat-icon>play_arrow</mat-icon> Confirm Start
                    </button>
                    <button mat-button (click)="cancelStart()">Cancel</button>
                  </div>
                }
              }
              @if (event.status === 'InProgress') {
                <button mat-raised-button color="accent" (click)="updateStatus('Paused')">
                  <mat-icon>pause</mat-icon> Pause
                </button>
                <button mat-raised-button color="warn" (click)="updateStatus('Completed')">
                  <mat-icon>stop</mat-icon> End Event
                </button>
              }
              @if (event.status === 'Paused') {
                <button mat-raised-button color="primary" (click)="updateStatus('InProgress')">
                  <mat-icon>play_arrow</mat-icon> Resume
                </button>
                <button mat-raised-button color="warn" (click)="updateStatus('Completed')">
                  <mat-icon>stop</mat-icon> End Event
                </button>
              }
              @if (event.status !== 'Removed') {
                <button mat-stroked-button color="warn" (click)="removeEvent()">
                  <mat-icon>delete</mat-icon> Remove
                </button>
              }
              <a mat-stroked-button [routerLink]="['/events', event.id, 'pairings']" target="_blank">
                <mat-icon>table_chart</mat-icon> Pairings
              </a>
            </div>
          }
        </div>
        @if (event.status === 'Registration' && qrCodeDataUrl) {
          <mat-card class="qr-card">
            <mat-card-title>Player Check-In QR Code</mat-card-title>
            <mat-card-content>
              <img [src]="qrCodeDataUrl" alt="Check-in QR Code" class="qr-image" />
              @if (authService.isStoreEmployee) {
                <button mat-stroked-button (click)="printQrCode()">Print</button>
              }
            </mat-card-content>
          </mat-card>
        }
      </div>

      <mat-tab-group (selectedTabChange)="onTabChange($event)">
        <!-- Players Tab -->
        <mat-tab label="Players">
          <div class="tab-content">
            <!-- Registration controls sit above the sub-tabs -->
            @if (event.status === 'Registration') {
              @if (authService.isStoreEmployee) {
                @if (isEventFull) {
                  <div class="event-full-notice">
                    <mat-chip color="warn" highlighted>Full</mat-chip>
                    <span>Event is at capacity — new registrations will be added to the waitlist.</span>
                  </div>
                }
                <div class="form-row">
                  <mat-form-field>
                    <mat-label>Player Name</mat-label>
                    <input matInput
                           [(ngModel)]="playerSearchText"
                           [matAutocomplete]="playerAuto"
                           placeholder="Type to search...">
                    <mat-autocomplete #playerAuto="matAutocomplete"
                                      [displayWith]="displayPlayerName"
                                      (optionSelected)="onPlayerSelected($event)">
                      @for (player of filteredPlayers; track player.id) {
                        <mat-option [value]="player">
                          {{ player.name }} ({{ player.email }})
                        </mat-option>
                      }
                    </mat-autocomplete>
                  </mat-form-field>
                  <mat-form-field>
                    <mat-label>Decklist URL (optional)</mat-label>
                    <input matInput [(ngModel)]="decklistUrl" placeholder="https://...">
                  </mat-form-field>
                  <mat-form-field>
                    <mat-label>Commander(s) (optional)</mat-label>
                    <input matInput [(ngModel)]="commandersInput" placeholder="e.g. Atraxa, Praetors' Voice">
                  </mat-form-field>
                  <button mat-raised-button color="primary" (click)="registerPlayer()" [disabled]="!playerIdToRegister">
                    {{ isEventFull ? 'Add to Waitlist' : 'Register Player' }}
                  </button>
                </div>
                @if (eventPlayers.length > 0) {
                  <div class="clear-players-row">
                    <button mat-stroked-button color="warn" (click)="clearAllPlayers()">
                      <mat-icon>clear_all</mat-icon> Clear All Players
                    </button>
                  </div>
                }
              }
              @if (!authService.isStoreEmployee && authService.currentUser?.playerId && !isAlreadyRegistered(authService.currentUser!.playerId!) && !isEventFull) {
                <div class="self-register-row">
                  <button mat-raised-button color="primary" (click)="selfRegister()">
                    <mat-icon>how_to_reg</mat-icon> Register for This Event
                  </button>
                </div>
              }
              @if (!authService.isStoreEmployee && authService.currentUser?.playerId && isAlreadyRegistered(authService.currentUser!.playerId!) && !myRegistration?.isWaitlisted) {
                <div class="self-register-row">
                  <mat-chip color="primary" highlighted>You are registered</mat-chip>
                  <button mat-button color="warn" (click)="dropPlayer(authService.currentUser!.playerId!)">
                    Drop Out
                  </button>
                </div>
              }
              @if (!authService.currentUser) {
                <p class="login-hint">Log in to register for this event.</p>
              }
            }

            <!-- Sub-tabs: Registered Players | Waitlist -->
            <mat-tab-group class="player-sub-tabs">
              <mat-tab label="Registered ({{ displayedPlayers.length }})">
                <div class="sub-tab-content">
                  @if (event.status === 'Registration' && (authService.isStoreEmployee || authService.currentUser?.playerId != null)) {
                    <div class="checkin-section">
                      <span class="checkin-count">Check-In: {{ checkedInCount }} / {{ displayedPlayers.length }}</span>
                      @if (authService.isStoreEmployee) {
                        <button mat-button (click)="checkAllIn()">Check In All</button>
                        <button mat-button (click)="uncheckAll()">Uncheck All</button>
                      }
                    </div>
                  }

                  @if (displayedPlayers.length > 0) {
                    <table mat-table [dataSource]="displayedPlayers" class="full-width">
                      <ng-container matColumnDef="index">
                        <th mat-header-cell *matHeaderCellDef class="index-col">#</th>
                        <td mat-cell *matCellDef="let row; index as i" class="index-col">{{ i + 1 }}</td>
                      </ng-container>
                      <ng-container matColumnDef="name">
                        <th mat-header-cell *matHeaderCellDef>Player</th>
                        <td mat-cell *matCellDef="let row">
                          <a [routerLink]="['/players', row.playerId]">{{ row.name }}</a>
                        </td>
                      </ng-container>
                      <ng-container matColumnDef="decklist">
                        <th mat-header-cell *matHeaderCellDef>Decklist</th>
                        <td mat-cell *matCellDef="let row">
                          @if (row.decklistUrl) {
                            <a [href]="row.decklistUrl" target="_blank" rel="noopener">View</a>
                          } @else {
                            —
                          }
                        </td>
                      </ng-container>
                      <ng-container matColumnDef="commander">
                        <th mat-header-cell *matHeaderCellDef>Commander(s)</th>
                        <td mat-cell *matCellDef="let row">
                          @if (editingCommanderPlayerId === row.playerId) {
                            <div class="commander-edit">
                              <input matInput [(ngModel)]="editCommanderValue"
                                     placeholder="Commander name"
                                     class="commander-input"
                                     (keyup.enter)="saveCommander(row)"
                                     (keyup.escape)="cancelEditCommander()">
                              <button mat-icon-button color="primary" (click)="saveCommander(row)" title="Save">
                                <mat-icon>check</mat-icon>
                              </button>
                              <button mat-icon-button (click)="cancelEditCommander()" title="Cancel">
                                <mat-icon>close</mat-icon>
                              </button>
                            </div>
                          } @else {
                            <span>{{ row.commanders ?? '—' }}</span>
                            @if (canEditCommander(row)) {
                              <button mat-icon-button (click)="startEditCommander(row)" title="Edit commander" class="edit-commander-btn">
                                <mat-icon>edit</mat-icon>
                              </button>
                            }
                          }
                        </td>
                      </ng-container>
                      <ng-container matColumnDef="status">
                        <th mat-header-cell *matHeaderCellDef>Status</th>
                        <td mat-cell *matCellDef="let row">
                          @if (row.isDisqualified) {
                            <mat-chip color="warn">DQ</mat-chip>
                          } @else if (row.isDropped) {
                            <mat-chip>Dropped</mat-chip>
                          } @else {
                            <mat-chip color="primary">Active</mat-chip>
                          }
                        </td>
                      </ng-container>
                      <ng-container matColumnDef="actions">
                        <th mat-header-cell *matHeaderCellDef></th>
                        <td mat-cell *matCellDef="let row">
                          @if (event!.status === 'Registration' && (authService.isStoreEmployee || row.playerId === authService.currentUser?.playerId)) {
                            <mat-checkbox [checked]="row.isCheckedIn" (change)="toggleCheckIn(row)">
                              Checked In
                            </mat-checkbox>
                          }
                          @if (authService.isStoreEmployee && !row.isDropped && !row.isDisqualified && event!.status !== 'Completed') {
                            @if (event!.status === 'Registration') {
                              <button mat-button color="warn" (click)="dropPlayer(row.playerId)">Drop</button>
                            } @else if (event!.status === 'InProgress') {
                              <button mat-button color="warn" (click)="setDropped(row, true)">Drop</button>
                            }
                            <button mat-button color="warn" (click)="disqualifyPlayer(row.playerId)">DQ</button>
                          }
                          @if (authService.isStoreEmployee && row.isDropped && event!.status === 'InProgress') {
                            <button mat-button (click)="setDropped(row, false)">Un-drop</button>
                          }
                          @if (!authService.isStoreEmployee && row.playerId === authService.currentUser?.playerId && !row.isDropped && event!.status === 'InProgress') {
                            <button mat-button color="warn" (click)="setDropped(row, true)">Withdraw</button>
                          }
                        </td>
                      </ng-container>
                      <tr mat-header-row *matHeaderRowDef="playerColumns"></tr>
                      <tr mat-row *matRowDef="let row; columns: playerColumns;"
                          [class.dropped]="row.isDropped" [class.dq]="row.isDisqualified"></tr>
                    </table>
                  } @else {
                    <p>No players registered yet.</p>
                  }
                </div>
              </mat-tab>

              <mat-tab label="Waitlist ({{ waitlistedPlayers.length }})">
                <div class="sub-tab-content">
                  @if (!authService.isStoreEmployee && myRegistration?.isWaitlisted) {
                    <div class="waitlist-notice">
                      <mat-chip color="warn" highlighted>Waitlisted</mat-chip>
                      <span>You are #{{ myRegistration!.waitlistPosition }} on the waitlist.</span>
                    </div>
                  }
                  @if (waitlistedPlayers.length > 0) {
                    <div class="waitlist-section">
                      @for (player of waitlistedPlayers; track player.playerId) {
                        <div class="waitlist-row">
                          <mat-chip>{{ player.waitlistPosition }}</mat-chip>
                          <span>{{ player.name }}</span>
                          @if (authService.isStoreEmployee) {
                            <button mat-button color="primary" (click)="promotePlayer(player.playerId)">Promote</button>
                          }
                        </div>
                      }
                    </div>
                  } @else {
                    <p>No players on the waitlist.</p>
                  }
                </div>
              </mat-tab>
            </mat-tab-group>
          </div>
        </mat-tab>

        <!-- Rounds Tab -->
        @if (event.status !== 'Registration') {
        <mat-tab label="Rounds">
          <div class="tab-content">
            @if (authService.isStoreEmployee) {
              <div class="round-actions">
                @if (rounds.length === 0 || isRoundComplete(rounds[rounds.length - 1])) {
                  <button mat-raised-button color="primary" (click)="generateRound()" class="action-btn"
                          [disabled]="event.status === 'Completed' || event.status === 'Paused' || (event.plannedRounds != null && rounds.length >= event.plannedRounds)">
                    <mat-icon>add</mat-icon> Generate Next Round
                  </button>
                }
                @if (event.plannedRounds) {
                  <span class="round-progress-label">{{ rounds.length }}/{{ event.plannedRounds }} rounds</span>
                }
              </div>
            }

            @for (round of rounds; track round.roundId) {
              <mat-expansion-panel [expanded]="round === rounds[rounds.length - 1]">
                <mat-expansion-panel-header>
                  <mat-panel-title>Round {{ round.roundNumber }}</mat-panel-title>
                  <mat-panel-description>
                    {{ round.pods.length }} pods
                    @if (isRoundComplete(round)) {
                      <mat-chip class="round-complete-badge" color="primary" highlighted>Complete</mat-chip>
                    }
                  </mat-panel-description>
                </mat-expansion-panel-header>

                @if (authService.isStoreEmployee) {
                  <div class="round-controls">
                    <button mat-stroked-button (click)="startAllTimers(round)">
                      <mat-icon>play_arrow</mat-icon> Start All
                    </button>
                    <button mat-stroked-button (click)="pauseAllTimers(round)">
                      <mat-icon>pause</mat-icon> Pause All
                    </button>
                    <button mat-stroked-button (click)="resumeAllTimers(round)">
                      <mat-icon>play_circle</mat-icon> Resume All
                    </button>
                    <button mat-stroked-button (click)="addTimeAll(round, 60)">
                      <mat-icon>add</mat-icon> +1 min
                    </button>
                    <button mat-stroked-button (click)="addTimeAll(round, -60)">
                      <mat-icon>remove</mat-icon> -1 min
                    </button>
                  </div>
                }

                <div class="pod-grid">
                  @for (pod of round.pods; track pod.podId) {
                    <app-pod-card
                      [pod]="pod"
                      [event]="event!"
                      [eventId]="eventId"
                      [podState]="getPodState(pod.podId)"
                      [isStoreEmployee]="authService.isStoreEmployee"
                      (stateChanged)="onPodStateChanged()">
                    </app-pod-card>
                  }
                </div>
              </mat-expansion-panel>
            }
          </div>
        </mat-tab>
        }

        <!-- Standings Tab -->
        @if (event.status !== 'Registration') {
        <mat-tab label="Standings">
          <div class="tab-content">
            <app-event-standings
              [standings]="standings"
              [pointSystem]="event.pointSystem"
              (refresh)="loadStandings()">
            </app-event-standings>
          </div>
        </mat-tab>
        }
      </mat-tab-group>
    }
  `,
  styles: [`
    .event-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px; margin-bottom: 0; }
    .event-info { flex: 1; }
    .store-label { margin: 0 0 2px; font-size: 1rem; color: #666; font-weight: 500; letter-spacing: 0.02em; text-transform: uppercase; }
    .status-actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 12px; }
    .self-register-row { display: flex; gap: 12px; align-items: center; margin-bottom: 16px; }
    .checkin-section { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
    .checkin-count { font-weight: 500; }
    .login-hint { color: #666; font-style: italic; }
    .pod-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; margin-top: 16px; }
    .dropped { opacity: 0.5; }
    .dq { opacity: 0.4; text-decoration: line-through; }
    .round-controls { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin: 12px 0; }
    .round-complete-badge { margin-left: 8px; font-size: 0.75rem; }
    .event-full-notice { display: flex; align-items: center; gap: 12px; padding: 8px 0; margin-bottom: 16px; color: #666; }
    .slots-remaining { color: #888; font-size: 0.85rem; margin-left: 2px; }
    .round-progress { color: #1976d2; font-weight: 500; }
    .start-confirm { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; background: #f5f5f5; padding: 8px 12px; border-radius: 6px; }
    .start-confirm-label { font-weight: 500; }
    .rounds-input { width: 56px; padding: 4px 6px; border: 1px solid #bbb; border-radius: 4px; font-size: 14px; text-align: center; }
    .rounds-hint { color: #666; font-size: 0.85rem; }
    .round-actions { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
    .round-progress-label { color: #1976d2; font-weight: 500; font-size: 0.9rem; }
    .qr-card { max-width: 320px; margin: 16px 0; }
    .qr-card mat-card-content { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 16px; }
    .qr-image { width: 256px; height: 256px; }
    .player-sub-tabs { margin-top: 16px; }
    .sub-tab-content { padding: 16px 0; }
    .waitlist-notice { display: flex; align-items: center; gap: 12px; padding: 8px 0; margin-bottom: 16px; }
    .waitlist-section { }
    .waitlist-row { display: flex; align-items: center; gap: 12px; padding: 4px 0; }
    .index-col { width: 36px; min-width: 36px; color: #888; font-size: 0.85rem; padding-right: 4px; }
    .commander-edit { display: flex; align-items: center; gap: 4px; }
    .commander-input { width: 160px; font-size: 0.9rem; border: 1px solid #ccc; border-radius: 4px; padding: 2px 6px; }
    .edit-commander-btn { opacity: 0.4; transition: opacity 0.15s; }
    .edit-commander-btn:hover { opacity: 1; }
  `]
})
export class EventDetailComponent implements OnInit {
  eventId!: number;
  event: EventDto | null = null;
  eventPlayers: EventPlayerDto[] = [];
  allPlayers: PlayerDto[] = [];
  rounds: RoundDto[] = [];
  standings: StandingsEntry[] = [];
  playerIdToRegister: number | null = null;
  playerSearchText: string = '';
  decklistUrl: string | null = null;
  commandersInput: string = '';
  readonly playerColumns = ['index', 'name', 'decklist', 'commander', 'status', 'actions'];
  private readonly PLAYERS_TAB = 0;

  get pointSystemLabel(): string {
    return POINT_SYSTEM_LABELS[this.event!.pointSystem] ?? this.event!.pointSystem;
  }
  private readonly STANDINGS_TAB = 2;

  qrCodeDataUrl: string | null = null;
  podStates = new Map<number, PodResultState>();
  @ViewChildren(PodCardComponent) podCards!: QueryList<PodCardComponent>;

  showStartConfirm = false;
  confirmedRounds = 5;

  editingCommanderPlayerId: number | null = null;
  editCommanderValue = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private eventService: EventService,
    private playerService: PlayerService,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef,
    public authService: AuthService
  ) {}

  ngOnInit() {
    this.eventId = Number(this.route.snapshot.paramMap.get('id'));
    this.initSubscriptions();
    this.loadData();
  }

  private initSubscriptions() {
    this.eventService.currentEvent$.subscribe(evt => {
      this.event = evt;
      if (evt?.status === 'Registration' && evt.checkInToken && this.authService.isStoreEmployee) {
        this.generateQrCode(evt.checkInToken);
      }
      this.cdr.detectChanges();
    });
    this.eventService.eventPlayers$.subscribe(p => { this.eventPlayers = p; this.cdr.detectChanges(); });
    this.playerService.players$.subscribe(p => { this.allPlayers = p; this.cdr.detectChanges(); });
    this.eventService.rounds$.subscribe(r => {
      this.rounds = r;
      this.syncPodStates(r);
      this.cdr.detectChanges();
    });
    this.eventService.standings$.subscribe(s => { this.standings = s; this.cdr.detectChanges(); });
  }

  private loadData() {
    this.eventService.loadEvent(this.eventId);
    this.eventService.loadEventPlayers(this.eventId);
    this.eventService.loadRounds(this.eventId);
    this.playerService.loadAllPlayers();
    this.loadStandings();
  }

  private syncPodStates(rounds: RoundDto[]) {
    for (const round of rounds) {
      for (const pod of round.pods) {
        if (pod.gameStatus === 'Completed') {
          const state = this.getPodState(pod.podId);
          state.submitted = true;
          state.winnerId = pod.winnerPlayerId;
        }
      }
    }
  }

  isAlreadyRegistered(playerId: number): boolean {
    return this.eventPlayers.some(p => p.playerId === playerId && !p.isDropped && !p.isDisqualified);
  }

  selfRegister() {
    const playerId = this.authService.currentUser?.playerId;
    if (!playerId) return;
    this.eventService.registerPlayer(this.eventId, { playerId }).subscribe({
      next: () => {
        this.snackBar.open('You are registered!', 'OK', { duration: 3000 });
        this.eventService.loadEvent(this.eventId);
        this.eventService.loadEventPlayers(this.eventId);
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.snackBar.open(err.error?.error || 'Failed to register', 'OK', { duration: 3000 });
      }
    });
  }

  getPodState(podId: number): PodResultState {
    if (!this.podStates.has(podId)) {
      this.podStates.set(podId, { winnerId: null, placements: [], submitted: false, isDraw: false });
    }
    return this.podStates.get(podId)!;
  }

  onPodStateChanged() {
    this.cdr.detectChanges();
  }

  private getCardsForRound(round: RoundDto): PodCardComponent[] {
    const podIds = new Set(round.pods.map(p => p.podId));
    return this.podCards?.filter(c => podIds.has(c.pod.podId)) ?? [];
  }

  isRoundComplete(round: RoundDto): boolean {
    return round.pods.length > 0 && round.pods.every(pod => this.getPodState(pod.podId).submitted);
  }

  startAllTimers(round: RoundDto) {
    this.getCardsForRound(round).filter(c => c.timerState === 'idle').forEach(c => c.startTimer());
  }

  pauseAllTimers(round: RoundDto) {
    this.getCardsForRound(round).filter(c => c.timerState === 'running').forEach(c => c.pauseTimer());
  }

  resumeAllTimers(round: RoundDto) {
    this.getCardsForRound(round).filter(c => c.timerState === 'paused').forEach(c => c.resumeTimer());
  }

  addTimeAll(round: RoundDto, seconds: number) {
    this.getCardsForRound(round)
      .filter(c => c.timerState === 'running' || c.timerState === 'paused')
      .forEach(c => c.addTime(seconds));
  }

  get players(): EventPlayerDto[] {
    return this.eventPlayers;
  }

  get checkedInCount(): number {
    return this.eventPlayers.filter(p => p.isCheckedIn && !p.isDropped && !p.isDisqualified && !p.isWaitlisted).length;
  }

  toggleCheckIn(player: EventPlayerDto): void {
    this.eventService.setCheckIn(this.eventId, player.playerId, !player.isCheckedIn).subscribe({
      next: (updated) => {
        const idx = this.eventPlayers.findIndex(p => p.playerId === updated.playerId);
        if (idx >= 0) this.eventPlayers[idx] = updated;
        this.cdr.detectChanges();
      },
      error: () => {
        this.snackBar.open('Failed to update check-in.', 'Close', { duration: 3000 });
        this.cdr.detectChanges();
      },
    });
  }

  checkAllIn(): void {
    const unchecked = this.eventPlayers.filter(p => !p.isCheckedIn && !p.isDropped && !p.isDisqualified && !p.isWaitlisted);
    unchecked.forEach(player => {
      this.eventService.setCheckIn(this.eventId, player.playerId, true).subscribe({
        next: (updated) => {
          const idx = this.eventPlayers.findIndex(p => p.playerId === updated.playerId);
          if (idx >= 0) this.eventPlayers[idx] = updated;
          this.cdr.detectChanges();
        },
        error: () => {
          this.snackBar.open('Failed to check in all players.', 'Close', { duration: 3000 });
          this.cdr.detectChanges();
        },
      });
    });
  }

  clearAllPlayers(): void {
    this.eventService.clearAllPlayers(this.eventId).subscribe({
      next: () => {
        this.snackBar.open('All players cleared.', 'OK', { duration: 3000 });
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.snackBar.open(err.error?.error || 'Failed to clear players.', 'OK', { duration: 3000 });
        this.cdr.detectChanges();
      },
    });
  }

  uncheckAll(): void {
    const checked = this.eventPlayers.filter(p => p.isCheckedIn);
    checked.forEach(player => {
      this.eventService.setCheckIn(this.eventId, player.playerId, false).subscribe({
        next: (updated) => {
          const idx = this.eventPlayers.findIndex(p => p.playerId === updated.playerId);
          if (idx >= 0) this.eventPlayers[idx] = updated;
          this.cdr.detectChanges();
        },
        error: () => { this.cdr.detectChanges(); },
      });
    });
  }

  get displayedPlayers(): EventPlayerDto[] {
    if (this.event?.status === 'Registration') {
      return this.eventPlayers.filter(p => !p.isDropped && !p.isDisqualified && !p.isWaitlisted);
    }
    return this.eventPlayers.filter(p => !p.isWaitlisted);
  }

  get waitlistedPlayers(): EventPlayerDto[] {
    return this.eventPlayers
      .filter(p => p.isWaitlisted)
      .sort((a, b) => (a.waitlistPosition ?? 0) - (b.waitlistPosition ?? 0));
  }

  get myRegistration(): EventPlayerDto | undefined {
    return this.eventPlayers.find(p => p.playerId === this.authService.currentUser?.playerId);
  }

  get allCheckedIn(): boolean {
    const active = this.eventPlayers.filter(p => !p.isDropped && !p.isDisqualified && !p.isWaitlisted);
    return active.length > 0 && active.every(p => p.isCheckedIn);
  }

  get isEventFull(): boolean {
    if (!this.event?.maxPlayers) return false;
    const activeCount = this.eventPlayers.filter(p => !p.isDropped && !p.isDisqualified && !p.isWaitlisted).length;
    return activeCount >= this.event.maxPlayers;
  }

  get filteredPlayers(): PlayerDto[] {
    const registeredIds = new Set(this.eventPlayers.filter(ep => !ep.isDropped && !ep.isDisqualified).map(ep => ep.playerId));
    const search = (this.playerSearchText || '').toLowerCase();
    return this.allPlayers
      .filter(p => p.isActive && !registeredIds.has(p.id))
      .filter(p => p.name.toLowerCase().includes(search) || p.email.toLowerCase().includes(search));
  }

  displayPlayerName(player: PlayerDto | string): string {
    return typeof player === 'string' ? player : player?.name ?? '';
  }

  onPlayerSelected(event: MatAutocompleteSelectedEvent) {
    const player: PlayerDto = event.option.value;
    this.playerIdToRegister = player.id;
    this.playerSearchText = player.name;
    this.cdr.detectChanges();
  }

  registerPlayer() {
    if (!this.playerIdToRegister) return;
    this.eventService.registerPlayer(this.eventId, {
      playerId: this.playerIdToRegister,
      decklistUrl: this.decklistUrl || undefined,
      commanders: this.commandersInput || null
    }).subscribe({
      next: () => {
        this.snackBar.open('Player registered!', 'OK', { duration: 3000 });
        this.eventService.loadEvent(this.eventId);
        this.eventService.loadEventPlayers(this.eventId);
        this.playerIdToRegister = null;
        this.playerSearchText = '';
        this.decklistUrl = null;
        this.commandersInput = '';
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.snackBar.open(err.error?.error || 'Failed to register player', 'OK', { duration: 3000 });
      }
    });
  }

  canEditCommander(row: EventPlayerDto): boolean {
    if (this.event?.status !== 'Registration' && this.event?.status !== 'InProgress') return false;
    if (this.authService.isStoreEmployee) return true;
    return row.playerId === this.authService.currentUser?.playerId;
  }

  startEditCommander(row: EventPlayerDto): void {
    this.editingCommanderPlayerId = row.playerId;
    this.editCommanderValue = row.commanders ?? '';
    this.cdr.detectChanges();
  }

  cancelEditCommander(): void {
    this.editingCommanderPlayerId = null;
    this.editCommanderValue = '';
    this.cdr.detectChanges();
  }

  saveCommander(row: EventPlayerDto): void {
    const commanders = this.editCommanderValue.trim() || null;
    this.eventService.declareCommander(this.eventId, row.playerId, commanders, row.decklistUrl).subscribe({
      next: (updated) => {
        const idx = this.eventPlayers.findIndex(p => p.playerId === updated.playerId);
        if (idx >= 0) this.eventPlayers[idx] = updated;
        this.editingCommanderPlayerId = null;
        this.editCommanderValue = '';
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.snackBar.open(err.error?.error || 'Failed to save commander', 'OK', { duration: 3000 });
        this.cdr.detectChanges();
      },
    });
  }

  getRecommendedRounds(playerCount: number): number {
    if (playerCount <= 4) return 2;
    if (playerCount <= 8) return 3;
    if (playerCount <= 32) return 5;
    if (playerCount <= 64) return 6;
    if (playerCount <= 128) return 7;
    if (playerCount <= 226) return 8;
    if (playerCount <= 409) return 9;
    return 10;
  }

  prepareStart() {
    this.confirmedRounds = this.getRecommendedRounds(this.event!.playerCount);
    this.showStartConfirm = true;
    this.cdr.detectChanges();
  }

  cancelStart() {
    this.showStartConfirm = false;
    this.cdr.detectChanges();
  }

  confirmStart() {
    this.showStartConfirm = false;
    this.cdr.detectChanges();
    this.eventService.updateStatus(this.eventId, 'InProgress', this.confirmedRounds).subscribe({
      next: () => {
        this.eventService.generateNextRound$(this.eventId).subscribe({
          next: (round) => {
            this.eventService.addRound(round);
            this.eventService.loadEvent(this.eventId);
            this.snackBar.open('Event started — Round 1 generated!', 'OK', { duration: 3000 });
            this.cdr.detectChanges();
          },
          error: (err) => {
            this.snackBar.open(err.error?.error || 'Event started but failed to generate round', 'OK', { duration: 5000 });
            this.eventService.loadEvent(this.eventId);
            this.cdr.detectChanges();
          }
        });
      },
      error: (err) => {
        this.showStartConfirm = true;
        this.snackBar.open(err.error?.error || 'Failed to start event', 'OK', { duration: 3000 });
        this.cdr.detectChanges();
      }
    });
  }

  removeEvent() {
    this.eventService.removeEvent(this.eventId).subscribe({
      next: () => {
        this.snackBar.open('Event removed', 'OK', { duration: 3000 });
        this.router.navigate(['/events']);
      },
      error: (err) => {
        this.snackBar.open(err.error?.error || 'Failed to remove event', 'OK', { duration: 3000 });
      }
    });
  }

  updateStatus(status: string) {
    this.eventService.updateStatus(this.eventId, status).subscribe({
      next: () => {
        this.snackBar.open(`Event status: ${status}`, 'OK', { duration: 3000 });
        this.eventService.loadEvent(this.eventId);
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.snackBar.open(err.error?.error || 'Failed to update status', 'OK', { duration: 3000 });
      }
    });
  }

  dropPlayer(playerId: number) {
    this.eventService.dropPlayer(this.eventId, playerId).subscribe({
      next: () => {
        this.snackBar.open('Player dropped', 'OK', { duration: 3000 });
        this.eventService.loadEvent(this.eventId);
        this.eventService.loadEventPlayers(this.eventId);
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.snackBar.open(err.error?.error || 'Failed to drop player', 'OK', { duration: 3000 });
      }
    });
  }

  setDropped(player: EventPlayerDto, isDropped: boolean) {
    if (!confirm(`${isDropped ? 'Drop' : 'Un-drop'} ${player.name} from this event?`)) return;
    this.eventService.setPlayerDropped(this.eventId, player.playerId, isDropped).subscribe({
      next: (updated) => {
        const idx = this.eventPlayers.findIndex(p => p.playerId === updated.playerId);
        if (idx >= 0) this.eventPlayers[idx] = updated;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.snackBar.open(err.error?.error || 'Failed to update player status', 'OK', { duration: 3000 });
        this.cdr.detectChanges();
      },
    });
  }

  promotePlayer(playerId: number) {
    this.eventService.promotePlayer(this.eventId, playerId).subscribe({
      next: (updated) => {
        const idx = this.eventPlayers.findIndex(p => p.playerId === updated.playerId);
        if (idx >= 0) this.eventPlayers[idx] = updated;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.snackBar.open(err.error?.error || 'Failed to promote player', 'OK', { duration: 3000 });
        this.cdr.detectChanges();
      },
    });
  }

  disqualifyPlayer(playerId: number) {
    this.eventService.disqualifyPlayer(this.eventId, playerId).subscribe({
      next: () => {
        this.snackBar.open('Player disqualified', 'OK', { duration: 3000 });
        this.eventService.loadEventPlayers(this.eventId);
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.snackBar.open(err.error?.error || 'Failed to disqualify player', 'OK', { duration: 3000 });
      }
    });
  }

  generateRound() {
    this.eventService.generateNextRound(this.eventId);
  }

  async generateQrCode(token: string): Promise<void> {
    const url = `${window.location.origin}/checkin/${token}`;
    this.qrCodeDataUrl = await QRCode.toDataURL(url, { width: 256 });
    this.cdr.detectChanges();
  }

  printQrCode(): void {
    const div = document.createElement('div');
    div.style.cssText = 'position:fixed;top:0;left:0;width:100%;background:#fff;z-index:99999;text-align:center;padding:32px';
    div.innerHTML = `<h2>${this.event?.name ?? 'Check-In'}</h2><img src="${this.qrCodeDataUrl}" />`;
    document.body.appendChild(div);
    window.print();
    document.body.removeChild(div);
  }

  loadStandings() {
    this.eventService.loadStandings(this.eventId);
  }

  onTabChange(event: MatTabChangeEvent) {
    if (event.index === this.STANDINGS_TAB) {
      this.loadStandings();
    }
    if (event.index === this.PLAYERS_TAB) {
      this.eventService.loadEventPlayers(this.eventId);
    }
  }
}
