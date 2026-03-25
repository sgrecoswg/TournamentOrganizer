import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { Router } from '@angular/router';
import { Subscription, interval } from 'rxjs';
import { switchMap, startWith } from 'rxjs/operators';
import { DatePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatBadgeModule } from '@angular/material/badge';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationDto } from '../../core/models/api.models';

@Component({
  selector: 'app-notification-bell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, MatButtonModule, MatMenuModule, MatBadgeModule, DatePipe],
  template: `
    @if (authService.currentUser && authService.isTier2) {
      <button mat-icon-button [matMenuTriggerFor]="notifMenu" (click)="loadNotifications()" aria-label="Notifications">
        <mat-icon [matBadge]="unreadCount || null" matBadgeColor="warn">notifications</mat-icon>
      </button>
      <mat-menu #notifMenu>
        <div class="notif-panel" (click)="$event.stopPropagation()">
          <div class="notif-header">
            <span>Notifications</span>
            <button mat-button (click)="markAllRead()">Mark all read</button>
          </div>
          @for (n of notifications; track n.id) {
            <div class="notif-item" [class.unread]="!n.isRead" (click)="onNotifClick(n)">
              <div class="notif-message">{{ n.message }}</div>
              <small>{{ n.createdAt | date:'shortDate' }}</small>
            </div>
          }
          @if (!notifications.length) {
            <div class="notif-empty">No notifications</div>
          }
        </div>
      </mat-menu>
    }
  `,
  styles: [`
    .notif-panel {
      min-width: 300px;
      max-width: 380px;
      padding: 8px 0;
    }
    .notif-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 4px 16px;
      font-weight: 500;
    }
    .notif-item {
      padding: 8px 16px;
      cursor: pointer;
      border-bottom: 1px solid rgba(0,0,0,0.08);
    }
    .notif-item:hover { background: rgba(0,0,0,0.04); }
    .notif-item.unread { background: rgba(25,118,210,0.06); }
    .notif-message { font-size: 14px; }
    .notif-empty { padding: 16px; color: rgba(0,0,0,0.54); text-align: center; }
    small { font-size: 11px; color: rgba(0,0,0,0.54); }
  `],
})
export class NotificationBellComponent implements OnInit, OnDestroy {
  readonly authService = inject(AuthService);
  private readonly apiService = inject(ApiService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);

  notifications: NotificationDto[] = [];
  unreadCount = 0;

  readonly POLL_INTERVAL_MS = 60_000;
  private pollSub: Subscription | null = null;

  ngOnInit(): void {
    if (!this.authService.currentUser || !this.authService.isTier2) return;
    this.pollSub = interval(this.POLL_INTERVAL_MS)
      .pipe(
        startWith(0),
        switchMap(() => this.apiService.getNotificationCount()),
      )
      .subscribe({
        next: count => {
          this.unreadCount = count.unread;
          this.cdr.detectChanges();
        },
        error: () => {
          this.cdr.detectChanges();
        },
      });
  }

  ngOnDestroy(): void {
    this.pollSub?.unsubscribe();
  }

  loadNotifications(): void {
    this.apiService.getNotifications().subscribe({
      next: notifs => {
        this.notifications = notifs;
        this.cdr.detectChanges();
      },
      error: () => {
        this.cdr.detectChanges();
      },
    });
  }

  onNotifClick(n: NotificationDto): void {
    if (!n.isRead) {
      this.apiService.markNotificationRead(n.id).subscribe({
        next: () => {
          n.isRead = true;
          this.unreadCount = Math.max(0, this.unreadCount - 1);
          this.cdr.detectChanges();
        },
        error: () => {
          this.cdr.detectChanges();
        },
      });
    }
    if (n.linkPath) {
      this.router.navigateByUrl(n.linkPath);
    }
    this.cdr.detectChanges();
  }

  markAllRead(): void {
    this.apiService.markAllNotificationsRead().subscribe({
      next: () => {
        this.notifications.forEach(n => (n.isRead = true));
        this.unreadCount = 0;
        this.cdr.detectChanges();
      },
      error: () => {
        this.cdr.detectChanges();
      },
    });
  }
}
