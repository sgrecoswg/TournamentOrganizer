import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { OAuthCallbackComponent } from './oauth-callback.component';
import { AuthService } from '../../core/services/auth.service';

// ─── Helpers ─────────────────────────────────────────────────────────────────

let replaceStateSpy: jest.SpyInstance;
let routerNavigateSpy: jest.SpyInstance;

beforeEach(() => {
  replaceStateSpy = jest.spyOn(history, 'replaceState').mockImplementation(() => {});
});

afterEach(() => {
  replaceStateSpy.mockRestore();
  routerNavigateSpy?.mockRestore();
});

function makeRoute(params: Record<string, string>) {
  return {
    snapshot: { queryParamMap: convertToParamMap(params) },
  };
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('OAuthCallbackComponent', () => {
  let mockAuthService: { storeToken: jest.Mock };

  beforeEach(() => {
    mockAuthService = { storeToken: jest.fn() };
  });

  /**
   * Creates the component without triggering ngOnInit.
   * Call fixture.detectChanges() after setting any spies.
   */
  function createComponent(queryParams: Record<string, string>) {
    TestBed.configureTestingModule({
      imports: [OAuthCallbackComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: makeRoute(queryParams) },
        { provide: AuthService, useValue: mockAuthService },
      ],
    });
    const fixture = TestBed.createComponent(OAuthCallbackComponent);
    routerNavigateSpy = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    return fixture;
  }

  /** Creates and initialises the component with an optional hash fragment. */
  function setup(queryParams: Record<string, string>, hashValue = '') {
    const fixture = createComponent(queryParams);
    if (hashValue) {
      jest.spyOn(fixture.componentInstance as any, 'readLocationHash')
        .mockReturnValue(hashValue);
    }
    fixture.detectChanges(); // triggers ngOnInit
    return fixture;
  }

  // ─── Creation ─────────────────────────────────────────────────────────

  it('should create', () => {
    expect(setup({}, '#token=abc').componentInstance).toBeTruthy();
  });

  it('renders the "Signing in…" message', () => {
    const fixture = setup({}, '#token=abc');
    expect(fixture.nativeElement.textContent).toContain('Signing in');
  });

  // ─── Token present path (token in URL hash) ────────────────────────────

  it('calls authService.storeToken with the hash token', () => {
    setup({}, '#token=my-jwt-token');
    expect(mockAuthService.storeToken).toHaveBeenCalledWith('my-jwt-token');
    expect(mockAuthService.storeToken).toHaveBeenCalledTimes(1);
  });

  it('clears the hash from the URL bar after reading the token', () => {
    setup({}, '#token=my-jwt-token');
    expect(replaceStateSpy).toHaveBeenCalledTimes(1);
  });

  it('redirects to "/" after storing the hash token', () => {
    setup({}, '#token=my-jwt-token');
    expect(routerNavigateSpy).toHaveBeenCalledTimes(1);
    expect(routerNavigateSpy).toHaveBeenCalledWith(['/']);
  });

  it('stores the token before redirecting', () => {
    const fixture = createComponent({});
    jest.spyOn(fixture.componentInstance as any, 'readLocationHash')
      .mockReturnValue('#token=my-jwt-token');

    const order: string[] = [];
    mockAuthService.storeToken.mockImplementation(() => order.push('storeToken'));
    routerNavigateSpy.mockImplementation(() => { order.push('redirect'); return Promise.resolve(true); });

    fixture.detectChanges(); // triggers ngOnInit

    expect(order).toEqual(['storeToken', 'redirect']);
  });

  it('does NOT call storeToken when hash token is absent', () => {
    setup({ error: 'access_denied' });
    expect(mockAuthService.storeToken).not.toHaveBeenCalled();
  });

  // ─── Error / no-token path ─────────────────────────────────────────────

  it('redirects to "/" when there is no hash token', () => {
    setup({ error: 'access_denied' });
    expect(routerNavigateSpy).toHaveBeenCalledTimes(1);
    expect(routerNavigateSpy).toHaveBeenCalledWith(['/']);
  });

  it('redirects to "/" when both hash token and error are absent', () => {
    setup({});
    expect(routerNavigateSpy).toHaveBeenCalledTimes(1);
    expect(routerNavigateSpy).toHaveBeenCalledWith(['/']);
    expect(mockAuthService.storeToken).not.toHaveBeenCalled();
  });

  it('logs the error param to console.error when no token', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    setup({ error: 'access_denied' });
    expect(consoleSpy).toHaveBeenCalledWith('OAuth callback error:', 'access_denied');
  });

  it('logs null to console.error when neither token nor error is present', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    setup({});
    expect(consoleSpy).toHaveBeenCalledWith('OAuth callback error:', null);
  });

  // ─── Open redirect prevention (returnUrl validation) ──────────────────

  afterEach(() => sessionStorage.clear());

  it('redirects to a valid relative returnUrl from sessionStorage', () => {
    sessionStorage.setItem('auth_return_url', '/events/42');
    setup({}, '#token=my-jwt');
    expect(routerNavigateSpy).toHaveBeenCalledTimes(1);
    expect(routerNavigateSpy).toHaveBeenCalledWith(['/events/42']);
  });

  it('falls back to "/" when returnUrl is an absolute external URL', () => {
    sessionStorage.setItem('auth_return_url', 'https://evil.com/steal');
    setup({}, '#token=my-jwt');
    expect(routerNavigateSpy).toHaveBeenCalledTimes(1);
    expect(routerNavigateSpy).toHaveBeenCalledWith(['/']);
  });

  it('falls back to "/" when returnUrl starts with //', () => {
    sessionStorage.setItem('auth_return_url', '//evil.com/steal');
    setup({}, '#token=my-jwt');
    expect(routerNavigateSpy).toHaveBeenCalledTimes(1);
    expect(routerNavigateSpy).toHaveBeenCalledWith(['/']);
  });

  it('removes returnUrl from sessionStorage after redirect', () => {
    sessionStorage.setItem('auth_return_url', '/events');
    setup({}, '#token=my-jwt');
    expect(sessionStorage.getItem('auth_return_url')).toBeNull();
  });
});
