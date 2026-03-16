import { Component, Input } from '@angular/core';
import { MatChipsModule } from '@angular/material/chips';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-placement-badge',
  imports: [CommonModule, MatChipsModule],
  template: `
    @if (isRanked) {
      <mat-chip class="ranked">Ranked</mat-chip>
    } @else {
      <mat-chip class="unranked">Unranked ({{ gamesLeft }} left)</mat-chip>
    }
  `,
  styles: [`
    .ranked { background-color: #4caf50 !important; color: white; }
    .unranked { background-color: #9e9e9e !important; color: white; }
  `]
})
export class PlacementBadgeComponent {
  @Input() isRanked = false;
  @Input() gamesLeft = 0;
}
