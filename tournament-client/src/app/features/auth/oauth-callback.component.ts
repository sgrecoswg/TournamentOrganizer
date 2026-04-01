import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
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
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    // Token is delivered via URL fragment (#token=...) so it is never sent
    // to the server or recorded in access logs (OWASP A02:2021).
    const hash = this.readLocationHash();
    const hashParams = new URLSearchParams(hash.slice(1));
    const token = hashParams.get('token');
    const error = this.route.snapshot.queryParamMap.get('error');

    // Immediately clear the fragment from the address bar so it cannot be
    // bookmarked, copy-pasted, or leaked via the Referer header.
    if (hash) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }

    if (token) {
      this.authService.storeToken(token);
      // Token is now in-memory — no page reload needed.
      // Navigate to the return URL (or root) using the Angular Router.
      const returnUrl = sessionStorage.getItem('auth_return_url') ?? '/';
      sessionStorage.removeItem('auth_return_url');
      const safeUrl = returnUrl.startsWith('/') && !returnUrl.startsWith('//')
        ? returnUrl
        : '/';
      this.router.navigate([safeUrl]);
    } else {
      console.error('OAuth callback error:', error);
      this.router.navigate(['/']);
    }
  }

  // Extracted for testability: allows tests to supply a mock hash value.
  protected readLocationHash(): string {
    return window.location.hash;
  }
}
