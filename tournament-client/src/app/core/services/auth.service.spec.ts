import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';

// ─── JWT helpers ─────────────────────────────────────────────────────────────

/** Build a minimal JWT with the given payload (header + body + stub signature). */
function makeJwt(payload: Record<string, unknown>): string {
  const header  = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body    = btoa(JSON.stringify(payload));
  return `${header}.${body}.stub-signature`;
}

/** Unix timestamp in seconds, offset from now. */
function nowSec(offsetSeconds = 0): number {
  return Math.floor(Date.now() / 1000) + offsetSeconds;
}

// ─── window.location.href mock (login() navigation) ──────────────────────────
// Uses the Symbol(impl) pattern — see MEMORY.md for explanation.

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

describe('AuthService', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  /** Create a fresh service instance (constructor runs after localStorage is set up). */
  function createService(): AuthService {
    TestBed.configureTestingModule({});
    return TestBed.inject(AuthService);
  }

  // ─── Constructor / loadFromStorage ──────────────────────────────────────

  describe('constructor (loadFromStorage)', () => {
    it('emits null when no token in localStorage', () => {
      const service = createService();
      expect(service.currentUser).toBeNull();
    });

    it('emits the decoded user when a valid token is stored', () => {
      const token = makeJwt({ sub: '1', email: 'a@b.com', name: 'Alice', role: 'User' });
      localStorage.setItem('auth_token', token);
      const service = createService();
      expect(service.currentUser).toEqual({
        id: 1, email: 'a@b.com', name: 'Alice', role: 'User',
        playerId: undefined, storeId: undefined,
      });
    });

    it('maps numeric playerId and storeId from JWT claims', () => {
      const token = makeJwt({ sub: '5', email: 'b@c.com', name: 'Bob', role: 'StoreEmployee', playerId: '3', storeId: '7' });
      localStorage.setItem('auth_token', token);
      const service = createService();
      expect(service.currentUser?.playerId).toBe(3);
      expect(service.currentUser?.storeId).toBe(7);
    });

    it('removes an expired token and emits null', () => {
      const token = makeJwt({ sub: '1', email: 'a@b.com', name: 'Alice', role: 'User', exp: nowSec(-3600) });
      localStorage.setItem('auth_token', token);
      const service = createService();
      expect(service.currentUser).toBeNull();
      expect(localStorage.getItem('auth_token')).toBeNull();
    });

    it('accepts a token with no exp claim', () => {
      const token = makeJwt({ sub: '2', email: 'c@d.com', name: 'Carol', role: 'User' });
      localStorage.setItem('auth_token', token);
      const service = createService();
      expect(service.currentUser?.name).toBe('Carol');
    });

    it('removes a malformed token and emits null', () => {
      localStorage.setItem('auth_token', 'not-a-jwt');
      const service = createService();
      expect(service.currentUser).toBeNull();
      expect(localStorage.getItem('auth_token')).toBeNull();
    });
  });

  // ─── storeToken ─────────────────────────────────────────────────────────

  describe('storeToken()', () => {
    it('saves the token to localStorage', () => {
      const service = createService();
      const token = makeJwt({ sub: '1', email: 'a@b.com', name: 'Alice', role: 'User' });
      service.storeToken(token);
      expect(localStorage.getItem('auth_token')).toBe(token);
    });

    it('emits the decoded CurrentUser on currentUser$', () => {
      const service = createService();
      const token = makeJwt({ sub: '10', email: 'x@y.com', name: 'Xavier', role: 'Administrator' });
      const emitted: any[] = [];
      service.currentUser$.subscribe(u => emitted.push(u));

      service.storeToken(token);

      expect(emitted[emitted.length - 1]).toMatchObject({ id: 10, email: 'x@y.com', role: 'Administrator' });
    });

    it('updates currentUser synchronously', () => {
      const service = createService();
      const token = makeJwt({ sub: '3', email: 'z@z.com', name: 'Zara', role: 'StoreManager' });
      service.storeToken(token);
      expect(service.currentUser?.name).toBe('Zara');
    });
  });

  // ─── logout ─────────────────────────────────────────────────────────────

  describe('logout()', () => {
    it('removes the token from localStorage', () => {
      const token = makeJwt({ sub: '1', email: 'a@b.com', name: 'Alice', role: 'User' });
      localStorage.setItem('auth_token', token);
      const service = createService();

      service.logout();

      expect(localStorage.getItem('auth_token')).toBeNull();
    });

    it('emits null on currentUser$', () => {
      const token = makeJwt({ sub: '1', email: 'a@b.com', name: 'Alice', role: 'User' });
      localStorage.setItem('auth_token', token);
      const service = createService();

      service.logout();

      expect(service.currentUser).toBeNull();
    });
  });

  // ─── getToken ───────────────────────────────────────────────────────────

  describe('getToken()', () => {
    it('returns null when no token in localStorage', () => {
      expect(createService().getToken()).toBeNull();
    });

    it('returns the token string when valid', () => {
      const token = makeJwt({ sub: '1', email: 'a@b.com', name: 'Alice', role: 'User', exp: nowSec(3600) });
      localStorage.setItem('auth_token', token);
      expect(createService().getToken()).toBe(token);
    });

    it('returns null and clears state when token is expired', () => {
      const token = makeJwt({ sub: '1', email: 'a@b.com', name: 'Alice', role: 'User', exp: nowSec(-3600) });
      // loadFromStorage removes it, so storeToken directly for this edge case
      const service = createService();
      // Bypass loadFromStorage by directly writing to storage after init
      localStorage.setItem('auth_token', token);

      const result = service.getToken();

      expect(result).toBeNull();
      expect(localStorage.getItem('auth_token')).toBeNull();
      expect(service.currentUser).toBeNull();
    });

    it('returns null and clears state for a malformed token', () => {
      const service = createService();
      localStorage.setItem('auth_token', 'bad.token.here');

      const result = service.getToken();

      expect(result).toBeNull();
      expect(localStorage.getItem('auth_token')).toBeNull();
      expect(service.currentUser).toBeNull();
    });
  });

  // ─── currentUser getter ──────────────────────────────────────────────────

  describe('currentUser getter', () => {
    it('returns null initially with no token', () => {
      expect(createService().currentUser).toBeNull();
    });

    it('returns the user set by storeToken', () => {
      const service = createService();
      const token = makeJwt({ sub: '2', email: 'b@c.com', name: 'Bob', role: 'User' });
      service.storeToken(token);
      expect(service.currentUser?.email).toBe('b@c.com');
    });

    it('returns null after logout', () => {
      const token = makeJwt({ sub: '1', email: 'a@b.com', name: 'Alice', role: 'User' });
      localStorage.setItem('auth_token', token);
      const service = createService();
      service.logout();
      expect(service.currentUser).toBeNull();
    });
  });

  // ─── isStoreEmployee getter ──────────────────────────────────────────────

  describe('isStoreEmployee getter', () => {
    it.each(['StoreEmployee', 'StoreManager', 'Administrator'])(
      'returns true for role "%s"',
      (role) => {
        const token = makeJwt({ sub: '1', email: 'a@b.com', name: 'A', role });
        localStorage.setItem('auth_token', token);
        expect(createService().isStoreEmployee).toBe(true);
      }
    );

    it.each(['User', 'Player'])(
      'returns false for role "%s"',
      (role) => {
        const token = makeJwt({ sub: '1', email: 'a@b.com', name: 'A', role });
        localStorage.setItem('auth_token', token);
        expect(createService().isStoreEmployee).toBe(false);
      }
    );

    it('returns false when no user is logged in', () => {
      expect(createService().isStoreEmployee).toBe(false);
    });
  });

  // ─── isStoreManager getter ───────────────────────────────────────────────

  describe('isStoreManager getter', () => {
    it.each(['StoreManager', 'Administrator'])(
      'returns true for role "%s"',
      (role) => {
        const token = makeJwt({ sub: '1', email: 'a@b.com', name: 'A', role });
        localStorage.setItem('auth_token', token);
        expect(createService().isStoreManager).toBe(true);
      }
    );

    it.each(['StoreEmployee', 'User'])(
      'returns false for role "%s"',
      (role) => {
        const token = makeJwt({ sub: '1', email: 'a@b.com', name: 'A', role });
        localStorage.setItem('auth_token', token);
        expect(createService().isStoreManager).toBe(false);
      }
    );

    it('returns false when no user is logged in', () => {
      expect(createService().isStoreManager).toBe(false);
    });
  });

  // ─── isAdmin getter ──────────────────────────────────────────────────────

  describe('isAdmin getter', () => {
    it('returns true for role "Administrator"', () => {
      const token = makeJwt({ sub: '1', email: 'a@b.com', name: 'A', role: 'Administrator' });
      localStorage.setItem('auth_token', token);
      expect(createService().isAdmin).toBe(true);
    });

    it.each(['StoreManager', 'StoreEmployee', 'User'])(
      'returns false for role "%s"',
      (role) => {
        const token = makeJwt({ sub: '1', email: 'a@b.com', name: 'A', role });
        localStorage.setItem('auth_token', token);
        expect(createService().isAdmin).toBe(false);
      }
    );

    it('returns false when no user is logged in', () => {
      expect(createService().isAdmin).toBe(false);
    });
  });

  // ─── login ──────────────────────────────────────────────────────────────

  describe('login()', () => {
    it('navigates to the Google OAuth login endpoint via relative URL (proxied in dev)', () => {
      createService().login();
      expect(navigateSpy).toHaveBeenCalledTimes(1);
      // With apiBase = '' the URL is relative: /api/auth/google-login
      // JSDOM parses a relative path keeping the existing host (localhost from jsdom),
      // NOT overriding to port 5021. Confirm no hardcoded port is present.
      const [parsedUrl] = navigateSpy.mock.calls[0];
      expect(parsedUrl?.path).toEqual(['api', 'auth', 'google-login']);
      expect(parsedUrl?.port).not.toBe(5021);
    });
  });

  // ─── licenseTier / isTier1 / isTier2 getters ────────────────────────────

  describe('licenseTier / isTier1 / isTier2 getters', () => {
    it('JWT with licenseTier="Tier1" → isTier1=true, isTier2=false', () => {
      const token = makeJwt({ sub: '1', email: 'a@b.com', name: 'A', role: 'StoreEmployee', storeId: '1', licenseTier: 'Tier1' });
      localStorage.setItem('auth_token', token);
      const service = createService();
      expect(service.isTier1).toBe(true);
      expect(service.isTier2).toBe(false);
      expect(service.licenseTier).toBe('Tier1');
    });

    it('JWT with licenseTier="Tier2" → isTier1=true, isTier2=true', () => {
      const token = makeJwt({ sub: '1', email: 'a@b.com', name: 'A', role: 'StoreEmployee', storeId: '1', licenseTier: 'Tier2' });
      localStorage.setItem('auth_token', token);
      const service = createService();
      expect(service.isTier1).toBe(true);
      expect(service.isTier2).toBe(true);
      expect(service.licenseTier).toBe('Tier2');
    });

    it('JWT with no licenseTier → isTier1=false, isTier2=false, licenseTier==="Free"', () => {
      const token = makeJwt({ sub: '1', email: 'a@b.com', name: 'A', role: 'StoreEmployee', storeId: '1' });
      localStorage.setItem('auth_token', token);
      const service = createService();
      expect(service.isTier1).toBe(false);
      expect(service.isTier2).toBe(false);
      expect(service.licenseTier).toBe('Free');
    });

    it('Admin role → isTier1=true, isTier2=true regardless of licenseTier claim', () => {
      const token = makeJwt({ sub: '1', email: 'a@b.com', name: 'A', role: 'Administrator' });
      localStorage.setItem('auth_token', token);
      const service = createService();
      expect(service.isTier1).toBe(true);
      expect(service.isTier2).toBe(true);
      expect(service.licenseTier).toBe('Tier2');
    });
  });
});
