import { Component, Input, Output, EventEmitter, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { EventDto, PodDto, GameResultSubmit } from '../../core/models/api.models';
import { EventService } from '../../core/services/event.service';
import { PodTimerComponent } from '../../shared/components/pod-timer.component';

export interface PodResultState {
  winnerId: number | null;
  placements: { playerId: number; name: string; position: number; seatOrder: number }[];
  submitted: boolean;
  isDraw: boolean;
}

@Component({
  selector: 'app-pod-card',
  imports: [
    CommonModule, RouterLink,
    MatCardModule, MatButtonModule, MatFormFieldModule, MatSelectModule,
    MatIconModule, MatChipsModule, MatSnackBarModule, PodTimerComponent
  ],
  template: `
    <mat-card class="pod-card" [class.pod-completed]="podState.submitted">
      <mat-card-header>
        <mat-card-title>Pod {{ pod.podNumber }}</mat-card-title>
        <mat-card-subtitle>
          Game #{{ pod.gameId }}
          @if (pod.finishGroup) { — Group {{ pod.finishGroup }} }
        </mat-card-subtitle>
      </mat-card-header>
      <mat-card-content>
        @if (isStoreEmployee && !podState.submitted) {
          <app-pod-timer #podTimerRef
            [podId]="pod.podId"
            [defaultMinutes]="event.defaultRoundTimeMinutes">
          </app-pod-timer>

          <div class="pod-players-list">
            @for (player of pod.players; track player.playerId) {
              <div class="pod-player">
                <span class="seat-number">{{ player.seatOrder }}.</span>
                <span>{{ player.name }}</span>
              </div>
            }
          </div>

          <div class="pod-results-form">
            <mat-form-field class="winner-select">
              <mat-label>Winner</mat-label>
              <mat-select [(value)]="podState.winnerId" (selectionChange)="onWinnerChanged()">
                @for (player of pod.players; track player.playerId) {
                  <mat-option [value]="player.playerId">
                    {{ player.seatOrder }}. {{ player.name }}
                  </mat-option>
                }
              </mat-select>
            </mat-form-field>

            @if (event.pointSystem !== 'WinBased' && event.pointSystem !== 'PointWager') {
              @for (p of podState.placements; track p.playerId) {
                <div class="placement-row">
                  <span class="placement-name">{{ p.seatOrder }}. {{ p.name }}</span>
                  <mat-form-field class="placement-field">
                    <mat-label>Place</mat-label>
                    <mat-select [(value)]="p.position">
                      @for (pos of getPositionOptions(); track pos) {
                        <mat-option [value]="pos">{{ getPositionLabel(pos) }}</mat-option>
                      }
                    </mat-select>
                  </mat-form-field>
                </div>
              }
            }
          </div>

          <div class="pod-actions">
            <button mat-raised-button color="primary"
                    (click)="submitPodResult()"
                    [disabled]="!podState.winnerId">
              <mat-icon>check</mat-icon> Submit Results
            </button>
            <button mat-stroked-button (click)="submitDraw()">
              <mat-icon>handshake</mat-icon> Draw
            </button>
            <a mat-button [routerLink]="['/events', eventId, 'games', pod.gameId]">
              Advanced
            </a>
          </div>
        } @else if (podState.submitted) {
          @for (player of pod.players; track player.playerId) {
            <div class="pod-player">
              <span class="seat-number">{{ player.seatOrder }}.</span>
              <span>{{ player.name }}</span>
              @if (event.pointSystem === 'WinBased') {
                @if (podState.isDraw) {
                  <mat-chip class="draw-badge">Draw</mat-chip>
                } @else if (podState.winnerId === player.playerId) {
                  <mat-chip class="winner-badge" color="primary" highlighted>Winner</mat-chip>
                } @else {
                  <mat-chip class="loss-badge">Loss</mat-chip>
                }
              } @else {
                @if (podState.winnerId === player.playerId) {
                  <mat-chip class="winner-badge" color="primary" highlighted>Winner</mat-chip>
                }
              }
            </div>
          }
          <div class="pod-submitted-row">
            <span class="pod-submitted">Results submitted</span>
            @if (isStoreEmployee && event.status !== 'Completed') {
              <button mat-stroked-button color="warn" (click)="revertPod()">
                <mat-icon>undo</mat-icon> Revert
              </button>
            }
          </div>
        } @else {
          @for (player of pod.players; track player.playerId) {
            <div class="pod-player">
              <span class="seat-number">{{ player.seatOrder }}.</span>
              <span>{{ player.name }}</span>
            </div>
          }
        }
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .pod-completed { opacity: 0.7; }
    .pod-player { display: flex; align-items: center; padding: 4px 0; gap: 8px; }
    .seat-number { font-weight: bold; color: #666; min-width: 20px; }
    .pod-players-list { margin: 8px 0; padding-bottom: 8px; border-bottom: 1px solid #e0e0e0; }
    .pod-results-form { margin: 8px 0; }
    .winner-select { width: 100%; }
    .placement-row { display: flex; align-items: center; gap: 8px; }
    .placement-name { flex: 1; font-size: 0.9rem; }
    .placement-field { width: 80px; }
    .pod-actions { display: flex; gap: 8px; align-items: center; margin-top: 8px; }
    .pod-submitted-row { display: flex; align-items: center; justify-content: space-between; margin-top: 8px; }
    .pod-submitted { color: #4caf50; font-weight: bold; font-size: 0.85rem; }
    .winner-badge { font-size: 0.75rem; }
    .draw-badge { font-size: 0.75rem; background-color: #ff9800 !important; color: white !important; }
    .loss-badge { font-size: 0.75rem; background-color: #9e9e9e !important; color: white !important; }
  `]
})
export class PodCardComponent {
  @Input() pod!: PodDto;
  @Input() event!: EventDto;
  @Input() eventId!: number;
  @Input() podState!: PodResultState;
  @Input() isStoreEmployee = false;
  @Output() stateChanged = new EventEmitter<void>();

  @ViewChild('podTimerRef') private podTimer?: PodTimerComponent;

  constructor(
    private eventService: EventService,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef
  ) {}

  // Timer API exposed for parent's "All Timers" round controls
  get timerState(): 'idle' | 'running' | 'paused' | 'extraTurns' {
    return this.podTimer?.state ?? 'idle';
  }

  startTimer() { this.podTimer?.start(); }
  pauseTimer() { this.podTimer?.pause(); }
  resumeTimer() { this.podTimer?.resume(); }
  addTime(seconds: number) { this.podTimer?.addTime(seconds); }

  onWinnerChanged() {
    const others = this.pod.players.filter(p => p.playerId !== this.podState.winnerId);
    this.podState.placements = others.map((p, i) => ({
      playerId: p.playerId,
      name: p.name,
      position: i + 2,
      seatOrder: p.seatOrder
    }));
    this.cdr.detectChanges();
  }

  getPositionOptions(): number[] {
    return Array.from({ length: this.pod.players.length - 1 }, (_, i) => i + 2);
  }

  getPositionLabel(pos: number): string {
    return ['', '1st', '2nd', '3rd', '4th', '5th'][pos] || `${pos}th`;
  }

  submitPodResult() {
    if (!this.podState.winnerId) return;
    const results: GameResultSubmit[] = [
      this.buildDefaultResult(this.podState.winnerId, 1),
      ...this.podState.placements.map(p => this.buildDefaultResult(p.playerId, p.position))
    ];
    this.eventService.submitGameResult(this.pod.gameId, results, this.eventId).subscribe({
      next: () => {
        this.podState.submitted = true;
        this.podTimer?.reset();
        this.stateChanged.emit();
        this.cdr.detectChanges();
        this.snackBar.open('Results submitted!', 'OK', { duration: 3000 });
      },
      error: (err) => {
        this.snackBar.open(err.error?.error || 'Failed to submit results', 'OK', { duration: 3000 });
      }
    });
  }

  submitDraw() {
    const playerCount = this.pod.players.length;
    const results = this.pod.players.map(p => this.buildDefaultResult(p.playerId, playerCount));
    this.eventService.submitGameResult(this.pod.gameId, results, this.eventId).subscribe({
      next: () => {
        this.podState.submitted = true;
        this.podState.isDraw = true;
        this.podTimer?.reset();
        this.stateChanged.emit();
        this.cdr.detectChanges();
        this.snackBar.open('Draw recorded — 1 point each', 'OK', { duration: 3000 });
      },
      error: (err) => {
        this.snackBar.open(err.error?.error || 'Failed to submit draw', 'OK', { duration: 3000 });
      }
    });
  }

  revertPod() {
    this.eventService.revertGameResult(this.pod.gameId, this.eventId).subscribe({
      next: () => {
        this.podState.submitted = false;
        this.podState.isDraw = false;
        this.podState.winnerId = null;
        this.podState.placements = [];
        this.stateChanged.emit();
        this.cdr.detectChanges();
        this.snackBar.open('Result reverted', 'OK', { duration: 3000 });
      },
      error: (err) => {
        this.snackBar.open(err.error?.error || 'Failed to revert result', 'OK', { duration: 3000 });
      }
    });
  }

  private buildDefaultResult(playerId: number, finishPosition: number): GameResultSubmit {
    return {
      playerId,
      finishPosition,
      eliminations: 0,
      turnsSurvived: 0,
      commanderPlayed: null,
      deckColors: null,
      conceded: false
    };
  }
}
