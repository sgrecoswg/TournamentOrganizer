import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-oauth-callback',
  standalone: true,
  imports: [],
  template: `<p>Signing in…</p>`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OAuthCallbackComponent implements OnInit {
  constructor(
    private route: ActivatedRoute,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    const error = this.route.snapshot.queryParamMap.get('error');

    if (token) {
      this.authService.storeToken(token);
      // Full page reload so AuthService.loadFromStorage() runs fresh
      // and the toolbar renders with the correct user state from the start.
      const returnUrl = sessionStorage.getItem('auth_return_url') || '/';
      sessionStorage.removeItem('auth_return_url');
      window.location.href = returnUrl;
    } else {
      console.error('OAuth callback error:', error);
      window.location.href = '/';
    }
  }
}
