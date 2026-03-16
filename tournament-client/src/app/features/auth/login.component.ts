import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  imports: [MatButtonModule, MatIconModule],
  template: `
    <div class="login-page">
      <div class="login-card">
        <mat-icon class="login-icon">emoji_events</mat-icon>
        <h1>Commander Tournament Organizer</h1>
        <p class="login-subtitle">Sign in to manage stores, events, and game results.</p>
        <button mat-raised-button color="primary" (click)="login()">
          <mat-icon>login</mat-icon>
          Login with Google
        </button>
      </div>
    </div>
  `,
  styles: [`
    .login-page {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      min-height: 60vh;
    }
    .login-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      padding: 48px;
      text-align: center;
    }
    .login-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      color: var(--mat-sys-primary);
    }
    h1 { margin: 0; font-size: 1.5rem; }
    .login-subtitle { color: var(--mat-sys-on-surface-variant); margin: 0; }
  `]
})
export class LoginComponent {
  private authService = inject(AuthService);
  private route       = inject(ActivatedRoute);

  login(): void {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    if (returnUrl) sessionStorage.setItem('auth_return_url', returnUrl);
    this.authService.login();
  }
}
