import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatTableModule } from '@angular/material/table';
import { ApiService } from '../../core/services/api.service';
import { StorePublicDto } from '../../core/models/api.models';

@Component({
  selector: 'app-store-public-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatDividerModule,
    MatTableModule,
  ],
  template: `
    @if (loading) {
      <div class="loading-container">
        <mat-icon>hourglass_empty</mat-icon>
        <p>Loading...</p>
      </div>
    } @else if (notFound) {
      <div class="not-found">
        <mat-icon>store_off</mat-icon>
        <h2>Store not found</h2>
        <p>The store you're looking for doesn't exist or has no public page yet.</p>
        <a mat-button routerLink="/">Go Home</a>
      </div>
    } @else if (page) {
      <!-- Store Header -->
      <div class="store-header">
        @if (logoUrl) {
          <img [src]="logoUrl" alt="{{ page.storeName }} logo" class="store-logo" />
        }
        <div class="store-header-text">
          <h1>{{ page.storeName }}</h1>
          @if (page.location) {
            <p class="store-location">
              <mat-icon>location_on</mat-icon>
              {{ page.location }}
            </p>
          }
        </div>
      </div>

      <mat-divider></mat-divider>

      <!-- Upcoming Events -->
      <section class="section">
        <h2>Upcoming Events</h2>
        @if (page.upcomingEvents.length === 0) {
          <p class="empty-state">No upcoming events</p>
        } @else {
          <div class="event-cards">
            @for (event of page.upcomingEvents; track event.eventId) {
              <mat-card class="event-card">
                <mat-card-header>
                  <mat-card-title>{{ event.eventName }}</mat-card-title>
                  <mat-card-subtitle>{{ event.date | date:'mediumDate' }}</mat-card-subtitle>
                </mat-card-header>
                <mat-card-actions>
                  <a mat-button [routerLink]="['/events', event.eventId]">View Event</a>
                </mat-card-actions>
              </mat-card>
            }
          </div>
        }
      </section>

      <mat-divider></mat-divider>

      <!-- Recent Events -->
      <section class="section">
        <h2>Recent Results</h2>
        @if (page.recentEvents.length === 0) {
          <p class="empty-state">No completed events yet</p>
        } @else {
          <div class="event-cards">
            @for (event of page.recentEvents; track event.eventId) {
              <mat-card class="event-card">
                <mat-card-header>
                  <mat-card-title>{{ event.eventName }}</mat-card-title>
                  <mat-card-subtitle>{{ event.date | date:'mediumDate' }}</mat-card-subtitle>
                </mat-card-header>
                <mat-card-actions>
                  <a mat-button [routerLink]="['/events', event.eventId]">View Results</a>
                </mat-card-actions>
              </mat-card>
            }
          </div>
        }
      </section>

      <mat-divider></mat-divider>

      <!-- Top Players -->
      <section class="section">
        <h2>Store Leaderboard</h2>
        @if (page.topPlayers.length === 0) {
          <p class="empty-state">No ranked players yet</p>
        } @else {
          <table mat-table [dataSource]="page.topPlayers" class="players-table">
            <ng-container matColumnDef="rank">
              <th mat-header-cell *matHeaderCellDef>#</th>
              <td mat-cell *matCellDef="let player; let i = index">{{ i + 1 }}</td>
            </ng-container>
            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef>Player</th>
              <td mat-cell *matCellDef="let player">{{ player.name }}</td>
            </ng-container>
            <ng-container matColumnDef="conservativeScore">
              <th mat-header-cell *matHeaderCellDef>Rating</th>
              <td mat-cell *matCellDef="let player">{{ player.conservativeScore | number:'1.1-1' }}</td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="playerCols"></tr>
            <tr mat-row *matRowDef="let row; columns: playerCols;"></tr>
          </table>
        }
      </section>
    }
  `,
  styles: [`
    :host { display: block; max-width: 960px; margin: 0 auto; padding: 24px 16px; }
    .loading-container, .not-found { text-align: center; padding: 48px 0; }
    .not-found mat-icon { font-size: 64px; height: 64px; width: 64px; opacity: 0.4; }
    .store-header { display: flex; align-items: center; gap: 20px; padding: 24px 0; }
    .store-logo { width: 80px; height: 80px; object-fit: contain; border-radius: 8px; }
    .store-header-text h1 { margin: 0; }
    .store-location { display: flex; align-items: center; gap: 4px; margin: 4px 0 0; color: #666; }
    .store-location mat-icon { font-size: 16px; height: 16px; width: 16px; }
    .section { padding: 24px 0; }
    .section h2 { margin-top: 0; }
    .empty-state { color: #888; font-style: italic; }
    .event-cards { display: flex; flex-wrap: wrap; gap: 12px; }
    .event-card { min-width: 220px; }
    .players-table { width: 100%; max-width: 480px; }
  `]
})
export class StorePublicPageComponent implements OnInit {
  page: StorePublicDto | null = null;
  loading = true;
  notFound = false;

  readonly playerCols = ['rank', 'name', 'conservativeScore'];

  private readonly sessionTs = Date.now();

  get logoUrl(): string | null {
    const url = this.page?.logoUrl;
    if (!url) return null;
    return url.includes('?t=') ? url : `${url}?t=${this.sessionTs}`;
  }

  constructor(
    private route: ActivatedRoute,
    private apiService: ApiService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    const slug = this.route.snapshot.paramMap.get('slug') ?? '';
    this.apiService.getStorePublicPage(slug).subscribe({
      next: page => {
        this.page = page;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: err => {
        this.loading = false;
        this.notFound = err.status === 404;
        this.cdr.detectChanges();
      },
    });
  }
}
