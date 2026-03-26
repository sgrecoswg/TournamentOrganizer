import { Component, Input, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { ApiService } from '../../core/services/api.service';
import { StoreAnalyticsDto } from '../../core/models/api.models';

@Component({
  selector: 'app-store-analytics',
  standalone: true,
  imports: [CommonModule, MatProgressSpinnerModule, MatCardModule, MatTableModule],
  template: `
    @if (loading) {
      <div class="spinner-wrap"><mat-spinner diameter="40"></mat-spinner></div>
    } @else if (analytics) {
      <div class="analytics-wrap">

        <!-- Event Trends -->
        <h3>Event Trends</h3>
        @if (analytics.eventTrends.length) {
          <table class="analytics-table">
            <thead><tr><th>Month</th><th>Events</th><th>Avg Players</th></tr></thead>
            <tbody>
              @for (t of analytics.eventTrends; track t.month) {
                <tr>
                  <td>{{ t.year }}-{{ t.month | number:'2.0-0' }}</td>
                  <td>{{ t.eventCount }}</td>
                  <td>{{ t.avgPlayerCount | number:'1.1-1' }}</td>
                </tr>
              }
            </tbody>
          </table>
        } @else {
          <p class="empty-state">Not enough data yet.</p>
        }

        <!-- Top Commanders -->
        <h3>Top Commanders</h3>
        @if (analytics.topCommanders.length) {
          <table class="analytics-table">
            <thead><tr><th>Commander</th><th>Win %</th><th>W/GP</th></tr></thead>
            <tbody>
              @for (c of analytics.topCommanders; track c.commanderName) {
                <tr>
                  <td>{{ c.commanderName }}</td>
                  <td>{{ c.winPercent }}%</td>
                  <td>{{ c.wins }}/{{ c.gamesPlayed }}</td>
                </tr>
              }
            </tbody>
          </table>
        } @else {
          <p class="empty-state">Not enough data yet.</p>
        }

        <!-- Top Players -->
        <h3>Top Players</h3>
        @if (analytics.topPlayers.length) {
          <table class="analytics-table">
            <thead><tr><th>Player</th><th>Points</th><th>Events</th></tr></thead>
            <tbody>
              @for (p of analytics.topPlayers; track p.playerId) {
                <tr>
                  <td>{{ p.playerName }}</td>
                  <td>{{ p.totalPoints }}</td>
                  <td>{{ p.eventsPlayed }}</td>
                </tr>
              }
            </tbody>
          </table>
        } @else {
          <p class="empty-state">Not enough data yet.</p>
        }

        <!-- Finish Distribution -->
        <h3>Finish Distribution</h3>
        <div class="finish-dist">
          <span>1st: {{ analytics.finishDistribution.first }}%</span>
          <span>2nd: {{ analytics.finishDistribution.second }}%</span>
          <span>3rd: {{ analytics.finishDistribution.third }}%</span>
          <span>4th: {{ analytics.finishDistribution.fourth }}%</span>
        </div>

        <!-- Color Frequency -->
        <h3>Most Played Colors</h3>
        @if (analytics.colorFrequency.length) {
          <div class="color-row">
            @for (c of analytics.colorFrequency; track c.colorCode) {
              <span class="color-chip">{{ c.colorCode }}: {{ c.count }}</span>
            }
          </div>
        } @else {
          <p class="empty-state">Not enough data yet.</p>
        }

      </div>
    }
  `,
  styles: [`
    .spinner-wrap { display: flex; justify-content: center; padding: 32px; }
    .analytics-wrap { padding: 16px 0; }
    h3 { margin: 20px 0 8px; font-size: 1rem; font-weight: 600; }
    .analytics-table { width: 100%; max-width: 560px; border-collapse: collapse; margin-bottom: 8px; }
    .analytics-table th, .analytics-table td { text-align: left; padding: 4px 12px 4px 0; font-size: 0.875rem; }
    .analytics-table thead th { color: #666; border-bottom: 1px solid #e0e0e0; }
    .empty-state { color: #888; font-style: italic; margin: 4px 0 12px; font-size: 0.875rem; }
    .finish-dist { display: flex; gap: 24px; flex-wrap: wrap; font-size: 0.875rem; }
    .color-row { display: flex; gap: 12px; flex-wrap: wrap; }
    .color-chip { background: #e3f2fd; border-radius: 12px; padding: 2px 10px; font-size: 0.85rem; }
  `]
})
export class StoreAnalyticsComponent implements OnInit {
  @Input() storeId!: number;

  loading = true;
  analytics: StoreAnalyticsDto | null = null;

  constructor(private api: ApiService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.api.getStoreAnalytics(this.storeId).subscribe({
      next: data => {
        this.analytics = data;
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
