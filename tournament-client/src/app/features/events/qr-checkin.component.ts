import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { CheckInResponseDto } from '../../core/models/api.models';

@Component({
  selector: 'app-qr-checkin',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule, MatProgressSpinnerModule, MatIconModule, RouterLink],
  template: `
    <div class="checkin-container">
      @if (result) {
        <mat-card class="checkin-card">
          <mat-card-content>
            <mat-icon class="success-icon">check_circle</mat-icon>
            <p class="checkin-success">You're checked in for <strong>{{ result!.eventName }}</strong>!</p>
            <a mat-stroked-button [routerLink]="['/events', result!.eventId]">Go to Event</a>
          </mat-card-content>
        </mat-card>
      }
      @if (errorMessage) {
        <mat-card class="checkin-card">
          <mat-card-content>
            <mat-icon class="error-icon">error</mat-icon>
            <p class="checkin-error">{{ errorMessage }}</p>
            <a mat-stroked-button routerLink="/events">Back to Events</a>
          </mat-card-content>
        </mat-card>
      }
    </div>
  `,
  styles: [`
    .checkin-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 60vh;
      padding: 24px;
    }
    .checkin-card {
      max-width: 400px;
      width: 100%;
      text-align: center;
    }
    mat-card-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      padding: 24px;
    }
    .success-icon { color: #4caf50; font-size: 48px; width: 48px; height: 48px; }
    .error-icon   { color: #f44336; font-size: 48px; width: 48px; height: 48px; }
  `]
})
export class QrCheckinComponent implements OnInit {
  result: CheckInResponseDto | null = null;
  errorMessage: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: ApiService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    if (!this.authService.currentUser) {
      sessionStorage.setItem('auth_return_url', window.location.pathname);
      this.router.navigate(['/login']);
      return;
    }

    const token = this.route.snapshot.paramMap.get('token') ?? '';

    this.apiService.checkInByToken(token).subscribe({
      next: (res) => {
        this.result = res;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.errorMessage = this.toErrorMessage(err.status);
        this.cdr.detectChanges();
      },
    });
  }

  private toErrorMessage(status: number): string {
    if (status === 404) return 'You are not registered for this event.';
    if (status === 400) return 'Check-in is closed — registration period has ended.';
    return 'Something went wrong. Please try again.';
  }
}
