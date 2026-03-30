import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { OAuthCallbackComponent } from './oauth-callback.component';
import { AuthService } from '../../core/services/auth.service';

// ─── window.location.href mock ───────────────────────────────────────────────
// JSDOM's window.location.href is a configurable:false own accessor — it cannot
// be redefined or spied on via jest.spyOn or Object.defineProperty.
//
// The generated Location wrapper delegates to an internal LocationImpl instance
// stored at Symbol('impl') on the location object. We access that instance and
// spy on its _locationObjectSetterNavigate method, which is called (with the
// parsed URL object) every time location.href is set. Spying on the *instance*
// (not a prototype) is immune to Jest's per-file module isolation.
//
// Note: we do NOT set window.location.hash in tests because JSDOM's hash setter
// also routes through _locationObjectSetterNavigate, which our spy intercepts
// before the actual URL update is applied. Instead, we spy on the component's
// protected readLocationHash() method.

function getLocationImpl(): any {
  const implSym = Object.getOwnPropertySymbols(window.location)
    .find(s => s.toString() === 'Symbol(impl)');
  return implSym ? (window.location as any)[implSym] : null;
}

/** Returns true when the parsed JSDOM URL object represents the path '/'. */
function isRootPath(parsedUrl: { path?: string[] }): boolean {
  // '/' parses to { path: [''] } (single empty-string segment)
  return Array.isArray(parsedUrl?.path) &&
    parsedUrl.path.length === 1 &&
    parsedUrl.path[0] === '';
}

let navigateSpy: jest.SpyInstance;
let replaceStateSpy: jest.SpyInstance;

beforeEach(() => {
  const impl = getLocationImpl();
  navigateSpy = jest
    .spyOn(impl, '_locationObjectSetterNavigate')
    .mockImplementation(() => {}); // suppress JSDOM "not implemented: navigation" noise

  replaceStateSpy = jest.spyOn(history, 'replaceState').mockImplementation(() => {});
});

afterEach(() => {
  navigateSpy.mockRestore();
  replaceStateSpy.mockRestore();
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
        { provide: ActivatedRoute, useValue: makeRoute(queryParams) },
        { provide: AuthService, useValue: mockAuthService },
      ],
    });
    return TestBed.createComponent(OAuthCallbackComponent);
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
    expect(navigateSpy).toHaveBeenCalledTimes(1);
    const [parsedUrl] = navigateSpy.mock.calls[0];
    expect(isRootPath(parsedUrl)).toBe(true);
  });

  it('stores the token before redirecting', () => {
    const fixture = createComponent({});
    jest.spyOn(fixture.componentInstance as any, 'readLocationHash')
      .mockReturnValue('#token=my-jwt-token');

    const order: string[] = [];
    mockAuthService.storeToken.mockImplementation(() => order.push('storeToken'));
    navigateSpy.mockImplementation(() => order.push('redirect'));

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
    expect(navigateSpy).toHaveBeenCalledTimes(1);
    const [parsedUrl] = navigateSpy.mock.calls[0];
    expect(isRootPath(parsedUrl)).toBe(true);
  });

  it('redirects to "/" when both hash token and error are absent', () => {
    setup({});
    expect(navigateSpy).toHaveBeenCalledTimes(1);
    const [parsedUrl] = navigateSpy.mock.calls[0];
    expect(isRootPath(parsedUrl)).toBe(true);
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
    expect(navigateSpy).toHaveBeenCalledTimes(1);
    const [parsedUrl] = navigateSpy.mock.calls[0];
    // /events/42 should parse to a path with segments ['events', '42']
    expect(parsedUrl?.path).toEqual(['events', '42']);
  });

  it('falls back to "/" when returnUrl is an absolute external URL', () => {
    sessionStorage.setItem('auth_return_url', 'https://evil.com/steal');
    setup({}, '#token=my-jwt');
    expect(navigateSpy).toHaveBeenCalledTimes(1);
    const [parsedUrl] = navigateSpy.mock.calls[0];
    expect(isRootPath(parsedUrl)).toBe(true);
  });

  it('falls back to "/" when returnUrl starts with //', () => {
    sessionStorage.setItem('auth_return_url', '//evil.com/steal');
    setup({}, '#token=my-jwt');
    expect(navigateSpy).toHaveBeenCalledTimes(1);
    const [parsedUrl] = navigateSpy.mock.calls[0];
    expect(isRootPath(parsedUrl)).toBe(true);
  });

  it('removes returnUrl from sessionStorage after redirect', () => {
    sessionStorage.setItem('auth_return_url', '/events');
    setup({}, '#token=my-jwt');
    expect(sessionStorage.getItem('auth_return_url')).toBeNull();
  });
});
