import { Component, Input } from '@angular/core';
import { MatChipsModule } from '@angular/material/chips';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-rating-badge',
  imports: [CommonModule, MatChipsModule],
  template: `
    <mat-chip [style.background-color]="getColor()">
      {{ score | number:'1.1-1' }}
    </mat-chip>
  `
})
export class RatingBadgeComponent {
  @Input() score = 0;

  getColor(): string {
    if (this.score >= 30) return '#4caf50';
    if (this.score >= 20) return '#8bc34a';
    if (this.score >= 10) return '#ffc107';
    if (this.score >= 0) return '#ff9800';
    return '#f44336';
  }
}
