import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-card-demand-dialog',
  imports: [CommonModule, MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>{{ data.cardName }}</h2>
    <mat-dialog-content>
      @if (data.playerNames.length > 0) {
        <p class="demand-subtitle">Players wanting this card:</p>
        <ul class="player-list">
          @for (name of data.playerNames; track name) {
            <li>{{ name }}</li>
          }
        </ul>
      } @else {
        <p class="no-demand">No other players currently want this card.</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Close</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .demand-subtitle { color: #666; font-size: 13px; margin: 0 0 8px; }
    .player-list { margin: 0; padding-left: 20px; }
    .player-list li { padding: 2px 0; }
    .no-demand { color: #666; font-style: italic; }
  `]
})
export class CardDemandDialogComponent {
  constructor(@Inject(MAT_DIALOG_DATA) public data: { cardName: string; playerNames: string[] }) {}
}
