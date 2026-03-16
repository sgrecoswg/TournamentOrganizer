import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { ApiService } from '../../core/services/api.service';
import { PairingsDto } from '../../core/models/api.models';

@Component({
  selector: 'app-pairings-display',
  standalone: true,
  imports: [MatCardModule],
  template: `
    <div class="pairings-page">
      <h1>{{ pairings?.eventName }} — Round {{ pairings?.currentRound }}</h1>

      @if (!pairings?.currentRound) {
        <p class="waiting-message">Waiting for pairings...</p>
      }

      @for (pod of pairings?.pods ?? []; track pod.podId) {
        <mat-card class="pod-card" [class.pod-completed]="pod.gameStatus === 'Completed' || pod.gameStatus === 'Draw'">
          <mat-card-header>
            <mat-card-title>
              Pod {{ pod.podNumber }}
              @if (pod.gameStatus === 'Draw') {
                <span class="game-status draw">Draw</span>
              } @else if (pod.gameStatus === 'Completed') {
                <span class="game-status completed">Done</span>
              }
            </mat-card-title>
          </mat-card-header>
          <mat-card-content>
            @for (player of pod.players; track player.playerId) {
              <div class="player-row" [class.winner]="pod.winnerPlayerId === player.playerId">
                <span class="seat-number">{{ player.seatOrder }}.</span>
                <span class="player-name">{{ player.name }}</span>
                @if (pod.winnerPlayerId === player.playerId) {
                  <span class="winner-badge">Winner</span>
                }
                @if (player.commanderName) {
                  <span class="commander-name">{{ player.commanderName }}</span>
                }
              </div>
            }
          </mat-card-content>
        </mat-card>
      }
    </div>
  `,
  styles: [`
    .pairings-page {
      padding: 24px;
      max-width: 960px;
      margin: 0 auto;
    }
    h1 {
      font-size: 2rem;
      margin-bottom: 24px;
    }
    .waiting-message {
      font-size: 1.5rem;
      color: #888;
      margin-top: 40px;
      text-align: center;
    }
    .pod-card {
      margin-bottom: 20px;
    }
    .player-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 0;
      font-size: 1.4rem;
    }
    .seat-number {
      min-width: 2rem;
      font-weight: 600;
      color: #888;
      flex-shrink: 0;
    }
    .commander-name {
      color: #888;
      font-size: 1rem;
    }
    .game-status {
      margin-left: 12px;
      font-size: 0.85rem;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 12px;
      vertical-align: middle;
    }
    .game-status.completed {
      background: #4caf50;
      color: #fff;
    }
    .game-status.draw {
      background: #9e9e9e;
      color: #fff;
    }
    .pod-completed {
      opacity: 0.75;
    }
    .player-row.winner .player-name {
      font-weight: 700;
    }
    .winner-badge {
      font-size: 0.8rem;
      font-weight: 600;
      color: #ffa000;
      background: #fff8e1;
      padding: 2px 6px;
      border-radius: 8px;
    }
  `],
})
export class PairingsDisplayComponent implements OnInit, OnDestroy {
  readonly REFRESH_INTERVAL_MS = 30_000;

  pairings: PairingsDto | null = null;
  loading = true;

  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private route = inject(ActivatedRoute);
  private api = inject(ApiService);
  private cdr = inject(ChangeDetectorRef);

  ngOnInit(): void {
    this.loadPairings();
    this.refreshTimer = setInterval(() => this.loadPairings(), this.REFRESH_INTERVAL_MS);
  }

  ngOnDestroy(): void {
    if (this.refreshTimer !== null) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  private loadPairings(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.api.getEventPairings(id).subscribe({
      next: result => {
        this.pairings = result;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }
}
