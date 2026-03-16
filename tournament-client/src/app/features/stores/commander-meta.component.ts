import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { ApiService } from '../../core/services/api.service';
import { CommanderMetaReportDto } from '../../core/models/api.models';

@Component({
  selector: 'app-commander-meta',
  imports: [
    CommonModule, FormsModule, RouterLink,
    MatButtonToggleModule, MatTableModule, MatCardModule,
    MatIconModule, MatButtonModule,
  ],
  template: `
    <div class="page-header">
      <button mat-icon-button [routerLink]="['/stores', storeId]">
        <mat-icon>arrow_back</mat-icon>
      </button>
      <h2>Commander Meta Report</h2>
    </div>

    <div class="meta-controls">
      <mat-button-toggle-group [(ngModel)]="period" (change)="loadMeta()">
        <mat-button-toggle value="30d">Last 30 Days</mat-button-toggle>
        <mat-button-toggle value="90d">Last 90 Days</mat-button-toggle>
        <mat-button-toggle value="all">All Time</mat-button-toggle>
      </mat-button-toggle-group>
    </div>

    <h3>Most Played Commanders</h3>

    @if (report && report.topCommanders.length === 0) {
      <p class="empty-state">No commander data available for this period.</p>
    }

    @if (report && report.topCommanders.length > 0) {
      <table mat-table [dataSource]="report.topCommanders" class="meta-table">

        <ng-container matColumnDef="commanderName">
          <th mat-header-cell *matHeaderCellDef>Commander</th>
          <td mat-cell *matCellDef="let row">{{ row.commanderName }}</td>
        </ng-container>

        <ng-container matColumnDef="timesPlayed">
          <th mat-header-cell *matHeaderCellDef>Played</th>
          <td mat-cell *matCellDef="let row">{{ row.timesPlayed }}</td>
        </ng-container>

        <ng-container matColumnDef="wins">
          <th mat-header-cell *matHeaderCellDef>Wins</th>
          <td mat-cell *matCellDef="let row">{{ row.wins }}</td>
        </ng-container>

        <ng-container matColumnDef="winRate">
          <th mat-header-cell *matHeaderCellDef>Win %</th>
          <td mat-cell *matCellDef="let row">{{ row.winRate.toFixed(1) }}%</td>
        </ng-container>

        <ng-container matColumnDef="avgFinish">
          <th mat-header-cell *matHeaderCellDef>Avg Finish</th>
          <td mat-cell *matCellDef="let row">{{ row.avgFinish.toFixed(1) }}</td>
        </ng-container>

        <tr mat-header-row *matHeaderRowDef="columns"></tr>
        <tr mat-row *matRowDef="let row; columns: columns;"></tr>
      </table>
    }
  `,
  styles: [`
    .page-header { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
    .meta-controls { margin-bottom: 24px; }
    .meta-table { width: 100%; }
    .empty-state { color: #888; font-style: italic; }
  `]
})
export class CommanderMetaComponent implements OnInit {
  storeId = 0;
  period  = '30d';
  report: CommanderMetaReportDto | null = null;
  columns = ['commanderName', 'timesPlayed', 'wins', 'winRate', 'avgFinish'];

  constructor(
    private route: ActivatedRoute,
    private api: ApiService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.storeId = Number(this.route.snapshot.paramMap.get('id'));
    this.loadMeta();
  }

  loadMeta(): void {
    this.api.getCommanderMeta(this.storeId, this.period).subscribe({
      next: report => {
        this.report = report;
        this.cdr.detectChanges();
      },
      error: () => {
        this.report = null;
        this.cdr.detectChanges();
      },
    });
  }
}
