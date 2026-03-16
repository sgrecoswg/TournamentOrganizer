import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { EventService } from '../../core/services/event.service';
import { GameResultSubmit } from '../../core/models/api.models';

interface PlayerResult {
  playerId: number;
  playerName: string;
  finishPosition: number;
  eliminations: number;
  turnsSurvived: number;
  commanderPlayed: string;
  deckColors: string;
  conceded: boolean;
}

@Component({
  selector: 'app-game-result',
  imports: [
    CommonModule, FormsModule,
    MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatCheckboxModule, MatButtonModule, MatSnackBarModule, RouterLink
  ],
  template: `
    <h2>Submit Game Results — Game #{{ gameId }}</h2>

    <mat-card>
      <mat-card-header>
        <mat-card-title>Add Players & Results</mat-card-title>
      </mat-card-header>
      <mat-card-content>
        <!-- Add player to this game -->
        <div class="add-player-row">
          <mat-form-field>
            <mat-label>Player ID</mat-label>
            <input matInput [(ngModel)]="newPlayerId" type="number">
          </mat-form-field>
          <mat-form-field>
            <mat-label>Player Name</mat-label>
            <input matInput [(ngModel)]="newPlayerName">
          </mat-form-field>
          <button mat-raised-button (click)="addPlayer()" [disabled]="!newPlayerId || !newPlayerName">
            Add Player
          </button>
        </div>

        @for (result of results; track result.playerId; let i = $index) {
          <mat-card class="result-row">
            <mat-card-content>
              <div class="result-header">
                <strong>{{ result.playerName }}</strong> (ID: {{ result.playerId }})
                <button mat-button color="warn" (click)="removePlayer(i)">Remove</button>
              </div>
              <div class="result-fields">
                <mat-form-field>
                  <mat-label>Finish Position</mat-label>
                  <mat-select [(ngModel)]="result.finishPosition">
                    @for (pos of [1,2,3,4,5]; track pos) {
                      <mat-option [value]="pos">{{ getPositionLabel(pos) }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
                <mat-form-field>
                  <mat-label>Eliminations</mat-label>
                  <input matInput [(ngModel)]="result.eliminations" type="number" min="0">
                </mat-form-field>
                <mat-form-field>
                  <mat-label>Turns Survived</mat-label>
                  <input matInput [(ngModel)]="result.turnsSurvived" type="number" min="0">
                </mat-form-field>
                <mat-form-field>
                  <mat-label>Commander</mat-label>
                  <input matInput [(ngModel)]="result.commanderPlayed">
                </mat-form-field>
                <mat-form-field>
                  <mat-label>Deck Colors</mat-label>
                  <input matInput [(ngModel)]="result.deckColors" placeholder="WUBRG">
                </mat-form-field>
                <mat-checkbox [(ngModel)]="result.conceded">Conceded</mat-checkbox>
              </div>
            </mat-card-content>
          </mat-card>
        }
      </mat-card-content>
      <mat-card-actions>
        <button mat-raised-button color="primary" (click)="submit()" [disabled]="results.length < 3">
          Submit Results
        </button>
        <button mat-button [routerLink]="['/events', eventId]">Back to Event</button>
      </mat-card-actions>
    </mat-card>
  `,
  styles: [`
    .add-player-row { display: flex; gap: 16px; align-items: baseline; margin-bottom: 16px; }
    .result-row { margin-bottom: 12px; }
    .result-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .result-fields { display: flex; gap: 12px; flex-wrap: wrap; align-items: baseline; }
    mat-form-field { flex: 1; min-width: 120px; }
  `]
})
export class GameResultComponent implements OnInit {
  eventId!: number;
  gameId!: number;
  results: PlayerResult[] = [];
  newPlayerId: number | null = null;
  newPlayerName = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private eventService: EventService,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.eventId = Number(this.route.snapshot.paramMap.get('eventId'));
    this.gameId = Number(this.route.snapshot.paramMap.get('gameId'));
  }

  addPlayer() {
    if (!this.newPlayerId || !this.newPlayerName) return;
    this.results.push({
      playerId: this.newPlayerId,
      playerName: this.newPlayerName,
      finishPosition: this.results.length + 1,
      eliminations: 0,
      turnsSurvived: 0,
      commanderPlayed: '',
      deckColors: '',
      conceded: false
    });
    this.newPlayerId = null;
    this.newPlayerName = '';
    this.cdr.detectChanges();
  }

  removePlayer(index: number) {
    this.results.splice(index, 1);
    this.cdr.detectChanges();
  }

  submit() {
    const payload: GameResultSubmit[] = this.results.map(r => ({
      playerId: r.playerId,
      finishPosition: r.finishPosition,
      eliminations: r.eliminations,
      turnsSurvived: r.turnsSurvived,
      commanderPlayed: r.commanderPlayed || null,
      deckColors: r.deckColors || null,
      conceded: r.conceded
    }));

    this.eventService.submitGameResult(this.gameId, payload).subscribe({
      next: () => {
        this.snackBar.open('Results submitted! Ratings updated.', 'OK', { duration: 3000 });
        this.router.navigate(['/events', this.eventId]);
      },
      error: (err) => {
        this.snackBar.open(err.error?.error || 'Failed to submit results', 'OK', { duration: 3000 });
      }
    });
  }

  getPositionLabel(pos: number): string {
    return ['', '1st', '2nd', '3rd', '4th', '5th'][pos] || `${pos}th`;
  }
}
