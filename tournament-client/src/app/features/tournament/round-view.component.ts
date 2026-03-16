import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { RoundDto } from '../../core/models/api.models';
import { RatingBadgeComponent } from '../../shared/components/rating-badge.component';

@Component({
  selector: 'app-round-view',
  imports: [CommonModule, RouterLink, MatCardModule, MatButtonModule, RatingBadgeComponent],
  template: `
    @if (round) {
      <h3>Round {{ round.roundNumber }}</h3>
      <div class="pod-grid">
        @for (pod of round.pods; track pod.podId) {
          <mat-card>
            <mat-card-header>
              <mat-card-title>Pod {{ pod.podNumber }}</mat-card-title>
            </mat-card-header>
            <mat-card-content>
              @for (player of pod.players; track player.playerId) {
                <div class="pod-player">
                  <span>{{ player.name }}</span>
                  <app-rating-badge [score]="player.conservativeScore"></app-rating-badge>
                </div>
              }
            </mat-card-content>
            <mat-card-actions>
              <a mat-button color="primary" [routerLink]="['/events', eventId, 'games', pod.gameId]">
                Submit Results
              </a>
            </mat-card-actions>
          </mat-card>
        }
      </div>
    }
  `,
  styles: [`
    .pod-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 16px; }
    .pod-player { display: flex; justify-content: space-between; align-items: center; padding: 4px 0; }
  `]
})
export class RoundViewComponent {
  @Input() round: RoundDto | null = null;
  @Input() eventId!: number;
}
