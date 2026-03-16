import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { StandingsEntry, PointSystem } from '../../core/models/api.models';
import { TiebreakerInfoDialogComponent } from './dialogs/tiebreaker-info-dialog.component';

@Component({
  selector: 'app-event-standings',
  imports: [
    CommonModule, RouterLink,
    MatTableModule, MatButtonModule, MatIconModule, MatChipsModule, MatDialogModule
  ],
  template: `
    <button mat-button (click)="refresh.emit()" class="action-btn">
      <mat-icon>refresh</mat-icon> Refresh
    </button>

    @if (standings.length > 0) {
      <table mat-table [dataSource]="standings" class="full-width">
        <ng-container matColumnDef="rank">
          <th mat-header-cell *matHeaderCellDef>#</th>
          <td mat-cell *matCellDef="let row">{{ row.rank }}</td>
        </ng-container>
        <ng-container matColumnDef="name">
          <th mat-header-cell *matHeaderCellDef>Player</th>
          <td mat-cell *matCellDef="let row">
            <a [routerLink]="['/players', row.playerId]">{{ row.playerName }}</a>
          </td>
        </ng-container>
        <ng-container matColumnDef="points">
          <th mat-header-cell *matHeaderCellDef>Points</th>
          <td mat-cell *matCellDef="let row">{{ row.totalPoints }}</td>
        </ng-container>
        <ng-container matColumnDef="tiebreaker">
          <th mat-header-cell *matHeaderCellDef>
            Tiebreaker
            <button mat-icon-button style="width:20px;height:20px;line-height:20px;" (click)="openTiebreakerInfo()">
              <mat-icon style="font-size:16px;width:16px;height:16px;line-height:16px;">info_outline</mat-icon>
            </button>
          </th>
          <td mat-cell *matCellDef="let row">{{ row.tiebreaker | number:'1.2-2' }}</td>
        </ng-container>
        <ng-container matColumnDef="finishes">
          <th mat-header-cell *matHeaderCellDef>Finishes</th>
          <td mat-cell *matCellDef="let row">{{ row.finishPositions.join(', ') }}</td>
        </ng-container>
        <ng-container matColumnDef="wdl">
          <th mat-header-cell *matHeaderCellDef>Results</th>
          <td mat-cell *matCellDef="let row">
            <div class="wdl-cell">
              @for (r of row.gameResults; track $index) {
                @if (r === 'W') {
                  <mat-chip class="winner-badge" color="primary" highlighted>W</mat-chip>
                } @else if (r === 'D') {
                  <mat-chip class="draw-badge">D</mat-chip>
                } @else {
                  <mat-chip class="loss-badge">L</mat-chip>
                }
              }
            </div>
          </td>
        </ng-container>
        <tr mat-header-row *matHeaderRowDef="standingsColumns"></tr>
        <tr mat-row *matRowDef="let row; columns: standingsColumns;"></tr>
      </table>
    } @else {
      <p>No results yet. Submit game results to see standings.</p>
    }
  `,
  styles: [`
    .wdl-cell { display: flex; gap: 4px; align-items: center; }
    .winner-badge { font-size: 0.75rem; }
    .draw-badge { font-size: 0.75rem; background-color: #ff9800 !important; color: white !important; }
    .loss-badge { font-size: 0.75rem; background-color: #9e9e9e !important; color: white !important; }
  `]
})
export class EventStandingsComponent {
  @Input() standings: StandingsEntry[] = [];
  @Input() pointSystem: PointSystem = 'ScoreBased';
  @Output() refresh = new EventEmitter<void>();

  constructor(private dialog: MatDialog) {}

  get standingsColumns(): string[] {
    return this.pointSystem === 'WinBased'
      ? ['rank', 'name', 'points', 'tiebreaker', 'wdl']
      : ['rank', 'name', 'points', 'tiebreaker', 'finishes'];
  }

  openTiebreakerInfo() {
    this.dialog.open(TiebreakerInfoDialogComponent);
  }
}
