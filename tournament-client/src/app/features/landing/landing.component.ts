import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { EventDto, LeaderboardEntry, POINT_SYSTEM_LABELS, PointSystem } from '../../core/models/api.models';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterLink, MatButtonModule, MatCardModule, MatChipsModule, MatIconModule],
  template: `
    <div class="landing-hero">
      <h1>Commander Tournament Organizer</h1>
      <p class="hero-sub">Track your TrueSkill rating, compete in pods, and climb the leaderboard.</p>
      <div class="hero-actions">
        <a mat-raised-button color="primary" routerLink="/events">Browse Events</a>
        @if (authService.isStoreEmployee) {
          <a mat-stroked-button routerLink="/events">Host a Tournament</a>
        }
      </div>
    </div>

    <section class="landing-section">
      <h2>Find Events</h2>
      <h3>Featured Events</h3>

      @if (featuredEvents.length === 0) {
        <p class="empty-state">No upcoming events</p>
      } @else {
        <div class="event-cards">
          @for (evt of featuredEvents; track evt.id) {
            <mat-card class="event-card" [routerLink]="['/events', evt.id]">
              <div class="event-card-image">
                <mat-icon>event</mat-icon>
              </div>
              <mat-card-content>
                <h4 class="event-name">{{ evt.name }}</h4>
                <mat-chip-set>
                  <mat-chip>{{ pointLabel(evt.pointSystem) }}</mat-chip>
                </mat-chip-set>
                <div class="event-meta">
                  <mat-icon>calendar_today</mat-icon> {{ evt.date | date:'mediumDate' }}
                </div>
                @if (evt.storeName) {
                  <div class="event-meta"><mat-icon>location_on</mat-icon> {{ evt.storeName }}</div>
                }
                <div class="event-meta">
                  <mat-icon>person</mat-icon> {{ evt.playerCount }} registered
                </div>
              </mat-card-content>
            </mat-card>
          }
        </div>
      }
    </section>

    <section class="landing-section">
      <h2>Top Players</h2>
      <table>
        <tbody>
          @for (entry of leaderboard.slice(0, 5); track entry.playerId) {
            <tr class="leaderboard-row">
              <td>{{ entry.rank }}</td>
              <td><a [routerLink]="['/players', entry.playerId]">{{ entry.name }}</a></td>
              <td>{{ entry.conservativeScore | number:'1.1-1' }}</td>
            </tr>
          }
        </tbody>
      </table>
      <a routerLink="/leaderboard">View Full Leaderboard</a>
    </section>
  `,
  styles: [`
    .landing-hero {
      padding: 48px 24px;
      text-align: center;
    }
    h1 { font-size: 2rem; margin-bottom: 8px; }
    .hero-sub { margin-bottom: 24px; color: rgba(0,0,0,.6); }
    .hero-actions { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
    .landing-section { padding: 24px; }
    .event-cards { display: flex; flex-wrap: wrap; gap: 16px; }
    .event-card { width: 260px; cursor: pointer; }
    .event-card-image {
      height: 120px;
      background: rgba(0,0,0,.08);
      display: flex; align-items: center; justify-content: center;
    }
    .event-card-image mat-icon { font-size: 48px; width: 48px; height: 48px; }
    .event-name { margin: 8px 0 4px; }
    .event-meta { display: flex; align-items: center; gap: 4px; font-size: 0.85rem; margin-top: 4px; }
    .event-meta mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .empty-state { color: rgba(0,0,0,.5); font-style: italic; }
    table { width: 100%; border-collapse: collapse; }
    tr.leaderboard-row td { padding: 6px 8px; }
  `]
})
export class LandingComponent implements OnInit {
  events: EventDto[] = [];
  leaderboard: LeaderboardEntry[] = [];

  private api = inject(ApiService);
  authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);

  get featuredEvents(): EventDto[] {
    return this.events
      .filter(e => e.status === 'Registration')
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  ngOnInit(): void {
    forkJoin({
      events: this.api.getAllEvents(),
      leaderboard: this.api.getLeaderboard(),
    }).subscribe({
      next: ({ events, leaderboard }) => {
        this.events = events;
        this.leaderboard = leaderboard;
        this.cdr.detectChanges();
      },
      error: () => {
        this.cdr.detectChanges();
      }
    });
  }

  pointLabel(ps: PointSystem): string {
    return POINT_SYSTEM_LABELS[ps] ?? ps;
  }
}
