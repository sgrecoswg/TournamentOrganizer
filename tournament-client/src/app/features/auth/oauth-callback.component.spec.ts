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

beforeEach(() => {
  const impl = getLocationImpl();
  navigateSpy = jest
    .spyOn(impl, '_locationObjectSetterNavigate')
    .mockImplementation(() => {}); // suppress JSDOM "not implemented: navigation" noise
});

afterEach(() => {
  navigateSpy.mockRestore();
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

  function setup(params: Record<string, string>) {
    TestBed.configureTestingModule({
      imports: [OAuthCallbackComponent],
      providers: [
        { provide: ActivatedRoute, useValue: makeRoute(params) },
        { provide: AuthService, useValue: mockAuthService },
      ],
    });

    const fixture = TestBed.createComponent(OAuthCallbackComponent);
    fixture.detectChanges(); // triggers ngOnInit
    return fixture;
  }

  // ─── Creation ─────────────────────────────────────────────────────────

  it('should create', () => {
    expect(setup({ token: 'abc' }).componentInstance).toBeTruthy();
  });

  it('renders the "Signing in…" message', () => {
    const fixture = setup({ token: 'abc' });
    expect(fixture.nativeElement.textContent).toContain('Signing in');
  });

  // ─── Token present path ────────────────────────────────────────────────

  it('calls authService.storeToken with the provided token', () => {
    setup({ token: 'my-jwt-token' });
    expect(mockAuthService.storeToken).toHaveBeenCalledWith('my-jwt-token');
    expect(mockAuthService.storeToken).toHaveBeenCalledTimes(1);
  });

  it('redirects to "/" after storing the token', () => {
    setup({ token: 'my-jwt-token' });
    expect(navigateSpy).toHaveBeenCalledTimes(1);
    const [parsedUrl] = navigateSpy.mock.calls[0];
    expect(isRootPath(parsedUrl)).toBe(true);
  });

  it('stores the token before redirecting', () => {
    const order: string[] = [];
    mockAuthService.storeToken.mockImplementation(() => order.push('storeToken'));
    navigateSpy.mockImplementation(() => order.push('redirect'));

    setup({ token: 'my-jwt-token' });

    expect(order).toEqual(['storeToken', 'redirect']);
  });

  // ─── Error / no-token path ─────────────────────────────────────────────

  it('does NOT call storeToken when token param is absent', () => {
    setup({ error: 'access_denied' });
    expect(mockAuthService.storeToken).not.toHaveBeenCalled();
  });

  it('redirects to "/" when there is no token', () => {
    setup({ error: 'access_denied' });
    expect(navigateSpy).toHaveBeenCalledTimes(1);
    const [parsedUrl] = navigateSpy.mock.calls[0];
    expect(isRootPath(parsedUrl)).toBe(true);
  });

  it('redirects to "/" when both token and error are absent', () => {
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
});
