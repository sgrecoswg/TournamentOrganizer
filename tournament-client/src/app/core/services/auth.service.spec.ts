import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { AuthService } from './auth.service';

// ─── JWT helpers ─────────────────────────────────────────────────────────────

/** Build a minimal JWT with the given payload (header + body + stub signature). */
function makeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body   = btoa(JSON.stringify(payload));
  return `${header}.${body}.stub-signature`;
}

/** Unix timestamp in seconds, offset from now. */
function nowSec(offsetSeconds = 0): number {
  return Math.floor(Date.now() / 1000) + offsetSeconds;
}

// ─── window.location.href mock (login() navigation) ──────────────────────────

function getLocationImpl(): any {
  const sym = Object.getOwnPropertySymbols(window.location)
    .find(s => s.toString() === 'Symbol(impl)');
  return sym ? (window.location as any)[sym] : null;
}

let navigateSpy: jest.SpyInstance;

beforeEach(() => {
  navigateSpy = jest
    .spyOn(getLocationImpl(), '_locationObjectSetterNavigate')
    .mockImplementation(() => {});
});

afterEach(() => {
  navigateSpy.mockRestore();
});

// ─── Suite ───────────────────────────────────────────────────────────────────

const REFRESH_URL = '/api/auth/refresh';

describe('AuthService', () => {
  let httpController: HttpTestingController;

  /**
   * Create a fresh service instance.
   * Always flushes (or errors) the constructor's silentRefresh request.
   *   flushWith = 'error'       → 401 response (no active session)
   *   flushWith = <token>       → 200 response with { token }
   *   flushWith = 'pending'     → does NOT flush; request stays pending
   */
  function createService(flushWith: string | 'error' | 'pending' = 'error'): AuthService {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpController = TestBed.inject(HttpTestingController);
    const service = TestBed.inject(AuthService);

    if (flushWith !== 'pending') {
      const req = httpController.expectOne(r => r.url.includes(REFRESH_URL));
      if (flushWith === 'error') {
        req.flush('', { status: 401, statusText: 'Unauthorized' });
      } else {
        req.flush({ token: flushWith });
      }
    }

    return service;
  }

  afterEach(() => {
    // Consume any remaining pending requests so verify() doesn't complain
    // in tests that use flushWith='pending'.
    httpController?.match(r => r.url.includes(REFRESH_URL));
    httpController?.verify();
  });

  // ─── Constructor / silentRefresh ──────────────────────────────────────

  describe('constructor (silentRefresh)', () => {
    it('emits null immediately before refresh response arrives', () => {
      const service = createService('pending');
      expect(service.currentUser).toBeNull();
    });

    it('emits the decoded user when refresh succeeds', () => {
      const token = makeJwt({ sub: '1', email: 'a@b.com', name: 'Alice', role: 'User' });
      const service = createService(token);
      expect(service.currentUser).toEqual({
        id: 1, email: 'a@b.com', name: 'Alice', role: 'User',
        playerId: undefined, storeId: undefined, licenseTier: undefined,
      });
    });

    it('remains null when refresh fails (no active session)', () => {
      const service = createService('error');
      expect(service.currentUser).toBeNull();
    });

    it('makes exactly one POST to /api/auth/refresh on construction', () => {
      TestBed.configureTestingModule({
        providers: [provideHttpClient(), provideHttpClientTesting()],
      });
      httpController = TestBed.inject(HttpTestingController);
      TestBed.inject(AuthService);
      const reqs = httpController.match(r => r.url.includes(REFRESH_URL));
      expect(reqs.length).toBe(1);
      expect(reqs[0].request.method).toBe('POST');
    });
  });

  // ─── storeToken ─────────────────────────────────────────────────────────

  describe('storeToken()', () => {
    it('emits the decoded CurrentUser on currentUser$', () => {
      const service = createService('error');
      const token = makeJwt({ sub: '10', email: 'x@y.com', name: 'Xavier', role: 'Administrator' });
      const emitted: any[] = [];
      service.currentUser$.subscribe(u => emitted.push(u));

      service.storeToken(token);

      expect(emitted[emitted.length - 1]).toMatchObject({ id: 10, email: 'x@y.com', role: 'Administrator' });
    });

    it('updates currentUser synchronously', () => {
      const service = createService('error');
      const token = makeJwt({ sub: '3', email: 'z@z.com', name: 'Zara', role: 'StoreManager' });
      service.storeToken(token);
      expect(service.currentUser?.name).toBe('Zara');
    });

    it('does NOT write to localStorage', () => {
      const service = createService('error');
      const token = makeJwt({ sub: '1', email: 'a@b.com', name: 'Alice', role: 'User' });

      service.storeToken(token);

      expect(localStorage.getItem('auth_token')).toBeNull();
    });
  });

  // ─── logout ─────────────────────────────────────────────────────────────

  describe('logout()', () => {
    it('clears the in-memory token (getToken returns null)', () => {
      const token = makeJwt({ sub: '1', email: 'a@b.com', name: 'Alice', role: 'User', exp: nowSec(3600) });
      const service = createService(token);
      service.logout();
      expect(service.getToken()).toBeNull();
    });

    it('emits null on currentUser$', () => {
      const token = makeJwt({ sub: '1', email: 'a@b.com', name: 'Alice', role: 'User' });
      const service = createService(token);
      service.logout();
      expect(service.currentUser).toBeNull();
    });

    it('does NOT touch localStorage', () => {
      const token = makeJwt({ sub: '1', email: 'a@b.com', name: 'Alice', role: 'User' });
      const service = createService(token);
      // Confirm logout doesn't write to or corrupt localStorage
      localStorage.setItem('unrelated_key', 'some-value');

      service.logout();

      // auth_token was never written, unrelated key untouched
      expect(localStorage.getItem('auth_token')).toBeNull();
      expect(localStorage.getItem('unrelated_key')).toBe('some-value');
    });
  });

  // ─── getToken ───────────────────────────────────────────────────────────

  describe('getToken()', () => {
    it('returns null when no token is stored', () => {
      expect(createService('error').getToken()).toBeNull();
    });

    it('returns the token string when valid', () => {
      const token = makeJwt({ sub: '1', email: 'a@b.com', name: 'Alice', role: 'User', exp: nowSec(3600) });
      const service = createService(token);
      expect(service.getToken()).toBe(token);
    });

    it('returns null and clears state when token is expired', () => {
      const validToken = makeJwt({ sub: '1', email: 'a@b.com', name: 'Alice', role: 'User', exp: nowSec(3600) });
      const service = createService(validToken);
      // Directly overwrite in-memory token with an expired one (bypassing expiry check in storeToken)
      const expiredToken = makeJwt({ sub: '1', email: 'a@b.com', name: 'Alice', role: 'User', exp: nowSec(-3600) });
      (service as any).token = expiredToken;

      const result = service.getToken();

      expect(result).toBeNull();
      expect(service.currentUser).toBeNull();
    });

    it('returns null and clears state for a malformed token', () => {
      const validToken = makeJwt({ sub: '1', email: 'a@b.com', name: 'Alice', role: 'User', exp: nowSec(3600) });
      const service = createService(validToken);
      (service as any).token = 'bad.token.here';

      const result = service.getToken();

      expect(result).toBeNull();
      expect(service.currentUser).toBeNull();
    });
  });

  // ─── currentUser getter ──────────────────────────────────────────────────

  describe('currentUser getter', () => {
    it('returns null initially with no active session', () => {
      expect(createService('error').currentUser).toBeNull();
    });

    it('returns the user set by storeToken', () => {
      const service = createService('error');
      const token = makeJwt({ sub: '2', email: 'b@c.com', name: 'Bob', role: 'User' });
      service.storeToken(token);
      expect(service.currentUser?.email).toBe('b@c.com');
    });

    it('returns null after logout', () => {
      const token = makeJwt({ sub: '1', email: 'a@b.com', name: 'Alice', role: 'User' });
      const service = createService(token);
      service.logout();
      expect(service.currentUser).toBeNull();
    });
  });

  // ─── isStoreEmployee getter ──────────────────────────────────────────────

  describe('isStoreEmployee getter', () => {
    it.each(['StoreEmployee', 'StoreManager', 'Administrator'])(
      'returns true for role "%s"',
      (role) => {
        const service = createService('error');
        service.storeToken(makeJwt({ sub: '1', email: 'a@b.com', name: 'A', role }));
        expect(service.isStoreEmployee).toBe(true);
      }
    );

    it.each(['User', 'Player'])(
      'returns false for role "%s"',
      (role) => {
        const service = createService('error');
        service.storeToken(makeJwt({ sub: '1', email: 'a@b.com', name: 'A', role }));
        expect(service.isStoreEmployee).toBe(false);
      }
    );

    it('returns false when no user is logged in', () => {
      expect(createService('error').isStoreEmployee).toBe(false);
    });
  });

  // ─── isStoreManager getter ───────────────────────────────────────────────

  describe('isStoreManager getter', () => {
    it.each(['StoreManager', 'Administrator'])(
      'returns true for role "%s"',
      (role) => {
        const service = createService('error');
        service.storeToken(makeJwt({ sub: '1', email: 'a@b.com', name: 'A', role }));
        expect(service.isStoreManager).toBe(true);
      }
    );

    it.each(['StoreEmployee', 'User'])(
      'returns false for role "%s"',
      (role) => {
        const service = createService('error');
        service.storeToken(makeJwt({ sub: '1', email: 'a@b.com', name: 'A', role }));
        expect(service.isStoreManager).toBe(false);
      }
    );

    it('returns false when no user is logged in', () => {
      expect(createService('error').isStoreManager).toBe(false);
    });
  });

  // ─── isAdmin getter ──────────────────────────────────────────────────────

  describe('isAdmin getter', () => {
    it('returns true for role "Administrator"', () => {
      const service = createService('error');
      service.storeToken(makeJwt({ sub: '1', email: 'a@b.com', name: 'A', role: 'Administrator' }));
      expect(service.isAdmin).toBe(true);
    });

    it.each(['StoreManager', 'StoreEmployee', 'User'])(
      'returns false for role "%s"',
      (role) => {
        const service = createService('error');
        service.storeToken(makeJwt({ sub: '1', email: 'a@b.com', name: 'A', role }));
        expect(service.isAdmin).toBe(false);
      }
    );

    it('returns false when no user is logged in', () => {
      expect(createService('error').isAdmin).toBe(false);
    });
  });

  // ─── login ──────────────────────────────────────────────────────────────

  describe('login()', () => {
    it('navigates to the Google OAuth login endpoint via relative URL (proxied in dev)', () => {
      createService('error').login();
      expect(navigateSpy).toHaveBeenCalledTimes(1);
      const [parsedUrl] = navigateSpy.mock.calls[0];
      expect(parsedUrl?.path).toEqual(['api', 'auth', 'google-login']);
      expect(parsedUrl?.port).not.toBe(5021);
    });
  });

  // ─── licenseTier / isTier1 / isTier2 getters ────────────────────────────

  describe('licenseTier / isTier1 / isTier2 getters', () => {
    it('JWT with licenseTier="Tier1" → isTier1=true, isTier2=false', () => {
      const service = createService('error');
      service.storeToken(makeJwt({ sub: '1', email: 'a@b.com', name: 'A', role: 'StoreEmployee', storeId: '1', licenseTier: 'Tier1' }));
      expect(service.isTier1).toBe(true);
      expect(service.isTier2).toBe(false);
      expect(service.licenseTier).toBe('Tier1');
    });

    it('JWT with licenseTier="Tier2" → isTier1=true, isTier2=true', () => {
      const service = createService('error');
      service.storeToken(makeJwt({ sub: '1', email: 'a@b.com', name: 'A', role: 'StoreEmployee', storeId: '1', licenseTier: 'Tier2' }));
      expect(service.isTier1).toBe(true);
      expect(service.isTier2).toBe(true);
      expect(service.licenseTier).toBe('Tier2');
    });

    it('JWT with no licenseTier → isTier1=false, isTier2=false, licenseTier==="Free"', () => {
      const service = createService('error');
      service.storeToken(makeJwt({ sub: '1', email: 'a@b.com', name: 'A', role: 'StoreEmployee', storeId: '1' }));
      expect(service.isTier1).toBe(false);
      expect(service.isTier2).toBe(false);
      expect(service.licenseTier).toBe('Free');
    });

    it('Admin role → isTier1=true, isTier2=true regardless of licenseTier claim', () => {
      const service = createService('error');
      service.storeToken(makeJwt({ sub: '1', email: 'a@b.com', name: 'A', role: 'Administrator' }));
      expect(service.isTier1).toBe(true);
      expect(service.isTier2).toBe(true);
      expect(service.licenseTier).toBe('Tier2');
    });
  });
});
