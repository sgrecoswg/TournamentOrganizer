import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ApiService } from './api.service';

describe('ApiService', () => {
  let service: ApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify()); // ensure no unexpected requests

  // ─── Helpers ──────────────────────────────────────────────────────────────

  /** Subscribe so the observable is cold-started and a request is issued. */
  function flush(obs: any, body: any = null) {
    obs.subscribe();
    const req = http.expectOne(r => r.url === r.url); // grab via expectOne below
    return req;
  }

  // ─── Players ──────────────────────────────────────────────────────────────

  describe('getAllPlayers()', () => {
    it('makes GET /api/players', () => {
      service.getAllPlayers().subscribe();
      const req = http.expectOne('/api/players');
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  describe('registerPlayer()', () => {
    it('makes POST /api/players with the dto body', () => {
      const dto = { name: 'Alice', email: 'a@b.com' } as any;
      service.registerPlayer(dto).subscribe();
      const req = http.expectOne('/api/players');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(dto);
      req.flush({});
    });
  });

  describe('updatePlayer()', () => {
    it('makes PUT /api/players/5 with the dto body', () => {
      const dto = { name: 'Bob' } as any;
      service.updatePlayer(5, dto).subscribe();
      const req = http.expectOne('/api/players/5');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(dto);
      req.flush({});
    });
  });

  describe('getPlayerProfile()', () => {
    it('makes GET /api/players/7/profile', () => {
      service.getPlayerProfile(7).subscribe();
      const req = http.expectOne('/api/players/7/profile');
      expect(req.request.method).toBe('GET');
      req.flush({});
    });
  });

  // ─── Leaderboard ──────────────────────────────────────────────────────────

  describe('getLeaderboard()', () => {
    it('makes GET /api/leaderboard', () => {
      service.getLeaderboard().subscribe();
      const req = http.expectOne('/api/leaderboard');
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  // ─── Events ───────────────────────────────────────────────────────────────

  describe('getAllEvents()', () => {
    it('makes GET /api/events', () => {
      service.getAllEvents().subscribe();
      const req = http.expectOne('/api/events');
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  describe('createEvent()', () => {
    it('makes POST /api/events with the dto body', () => {
      const dto = { name: 'GP London' } as any;
      service.createEvent(dto).subscribe();
      const req = http.expectOne('/api/events');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(dto);
      req.flush({});
    });
  });

  describe('getEvent()', () => {
    it('makes GET /api/events/3', () => {
      service.getEvent(3).subscribe();
      const req = http.expectOne('/api/events/3');
      expect(req.request.method).toBe('GET');
      req.flush({});
    });
  });

  describe('registerForEvent()', () => {
    it('makes POST /api/events/3/register with the dto body', () => {
      const dto = { playerId: 9 } as any;
      service.registerForEvent(3, dto).subscribe();
      const req = http.expectOne('/api/events/3/register');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(dto);
      req.flush({});
    });
  });

  describe('updateEventStatus()', () => {
    it('makes PUT /api/events/3/status with status and plannedRounds', () => {
      service.updateEventStatus(3, 'InProgress', 4).subscribe();
      const req = http.expectOne('/api/events/3/status');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ status: 'InProgress', plannedRounds: 4 });
      req.flush({});
    });

    it('sends undefined plannedRounds when not provided', () => {
      service.updateEventStatus(3, 'Completed').subscribe();
      const req = http.expectOne('/api/events/3/status');
      expect(req.request.body).toEqual({ status: 'Completed', plannedRounds: undefined });
      req.flush({});
    });
  });

  describe('getEventPlayers()', () => {
    it('makes GET /api/events/3/players', () => {
      service.getEventPlayers(3).subscribe();
      const req = http.expectOne('/api/events/3/players');
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  describe('removeEvent()', () => {
    it('makes DELETE /api/events/3', () => {
      service.removeEvent(3).subscribe();
      const req = http.expectOne('/api/events/3');
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('dropPlayer()', () => {
    it('makes DELETE /api/events/3/players/9', () => {
      service.dropPlayer(3, 9).subscribe();
      const req = http.expectOne('/api/events/3/players/9');
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('disqualifyPlayer()', () => {
    it('makes POST /api/events/3/players/9/disqualify with empty body', () => {
      service.disqualifyPlayer(3, 9).subscribe();
      const req = http.expectOne('/api/events/3/players/9/disqualify');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({});
      req.flush({});
    });
  });

  describe('getRounds()', () => {
    it('makes GET /api/events/3/rounds', () => {
      service.getRounds(3).subscribe();
      const req = http.expectOne('/api/events/3/rounds');
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  describe('generateNextRound()', () => {
    it('makes POST /api/events/3/rounds with empty body', () => {
      service.generateNextRound(3).subscribe();
      const req = http.expectOne('/api/events/3/rounds');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({});
      req.flush({});
    });
  });

  // ─── Games ────────────────────────────────────────────────────────────────

  describe('submitGameResult()', () => {
    it('makes POST /api/games/42/result with the results array', () => {
      const results = [{ playerId: 1, finishPosition: 1 }] as any;
      service.submitGameResult(42, results).subscribe();
      const req = http.expectOne('/api/games/42/result');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(results);
      req.flush({});
    });
  });

  describe('revertGameResult()', () => {
    it('makes DELETE /api/games/42/result', () => {
      service.revertGameResult(42).subscribe();
      const req = http.expectOne('/api/games/42/result');
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  // ─── Standings ────────────────────────────────────────────────────────────

  describe('getStandings()', () => {
    it('makes GET /api/events/3/standings', () => {
      service.getStandings(3).subscribe();
      const req = http.expectOne('/api/events/3/standings');
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  // ─── Wishlist ─────────────────────────────────────────────────────────────

  describe('getWishlist()', () => {
    it('makes GET /api/players/7/wishlist', () => {
      service.getWishlist(7).subscribe();
      const req = http.expectOne('/api/players/7/wishlist');
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  describe('getWishlistSupply()', () => {
    it('makes GET /api/players/7/wishlist/supply', () => {
      service.getWishlistSupply(7).subscribe();
      const req = http.expectOne('/api/players/7/wishlist/supply');
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  describe('addToWishlist()', () => {
    it('makes POST /api/players/7/wishlist with the dto body', () => {
      const dto = { cardName: 'Black Lotus' } as any;
      service.addToWishlist(7, dto).subscribe();
      const req = http.expectOne('/api/players/7/wishlist');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(dto);
      req.flush({});
    });
  });

  describe('removeFromWishlist()', () => {
    it('makes DELETE /api/players/7/wishlist/12', () => {
      service.removeFromWishlist(7, 12).subscribe();
      const req = http.expectOne('/api/players/7/wishlist/12');
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('removeAllFromWishlist()', () => {
    it('makes DELETE /api/players/7/wishlist/removeall', () => {
      service.removeAllFromWishlist(7).subscribe();
      const req = http.expectOne('/api/players/7/wishlist/removeall');
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  // ─── Trade list ───────────────────────────────────────────────────────────

  describe('getTradeList()', () => {
    it('makes GET /api/players/7/trades', () => {
      service.getTradeList(7).subscribe();
      const req = http.expectOne('/api/players/7/trades');
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  describe('addToTradeList()', () => {
    it('makes POST /api/players/7/trades with the dto body', () => {
      const dto = { cardName: 'Mox Sapphire' } as any;
      service.addToTradeList(7, dto).subscribe();
      const req = http.expectOne('/api/players/7/trades');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(dto);
      req.flush({});
    });
  });

  describe('removeFromTradeList()', () => {
    it('makes DELETE /api/players/7/trades/15', () => {
      service.removeFromTradeList(7, 15).subscribe();
      const req = http.expectOne('/api/players/7/trades/15');
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('removeAllFromTradeList()', () => {
    it('makes DELETE /api/players/7/trades/removeall', () => {
      service.removeAllFromTradeList(7).subscribe();
      const req = http.expectOne('/api/players/7/trades/removeall');
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('getSuggestedTrades()', () => {
    it('makes GET /api/players/7/trades/suggestions', () => {
      service.getSuggestedTrades(7).subscribe();
      const req = http.expectOne('/api/players/7/trades/suggestions');
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  describe('getTradeDemand()', () => {
    it('makes GET /api/players/7/trades/demand', () => {
      service.getTradeDemand(7).subscribe();
      const req = http.expectOne('/api/players/7/trades/demand');
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  // ─── Bulk uploads ─────────────────────────────────────────────────────────

  describe('bulkUploadWishlist()', () => {
    it('makes POST /api/players/7/wishlist/bulkupload with FormData', () => {
      const file = new File(['content'], 'list.txt', { type: 'text/plain' });
      service.bulkUploadWishlist(7, file).subscribe();
      const req = http.expectOne('/api/players/7/wishlist/bulkupload');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toBeInstanceOf(FormData);
      expect((req.request.body as FormData).get('file')).toBe(file);
      req.flush({});
    });
  });

  describe('bulkUploadTradeList()', () => {
    it('makes POST /api/players/7/trades/bulkupload with FormData', () => {
      const file = new File(['content'], 'list.txt', { type: 'text/plain' });
      service.bulkUploadTradeList(7, file).subscribe();
      const req = http.expectOne('/api/players/7/trades/bulkupload');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toBeInstanceOf(FormData);
      expect((req.request.body as FormData).get('file')).toBe(file);
      req.flush({});
    });
  });

  // ─── Stores ───────────────────────────────────────────────────────────────

  describe('getStores()', () => {
    it('makes GET /api/stores', () => {
      service.getStores().subscribe();
      const req = http.expectOne('/api/stores');
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  describe('getStore()', () => {
    it('makes GET /api/stores/2', () => {
      service.getStore(2).subscribe();
      const req = http.expectOne('/api/stores/2');
      expect(req.request.method).toBe('GET');
      req.flush({});
    });
  });

  describe('createStore()', () => {
    it('makes POST /api/stores with the dto body', () => {
      const dto = { name: 'Game Haven' } as any;
      service.createStore(dto).subscribe();
      const req = http.expectOne('/api/stores');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(dto);
      req.flush({});
    });
  });

  describe('updateStore()', () => {
    it('makes PUT /api/stores/2 with the dto body', () => {
      const dto = { storeName: 'Game Haven Updated' } as any;
      service.updateStore(2, dto).subscribe();
      const req = http.expectOne('/api/stores/2');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(dto);
      req.flush({});
    });
  });

  // ─── Store employees ──────────────────────────────────────────────────────

  describe('getStoreEmployees()', () => {
    it('makes GET /api/stores/2/employees', () => {
      service.getStoreEmployees(2).subscribe();
      const req = http.expectOne('/api/stores/2/employees');
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  describe('addStoreEmployee()', () => {
    it('makes POST /api/stores/2/employees with the dto body', () => {
      const dto = { name: 'Dave', email: 'd@e.com', role: 'StoreEmployee' } as any;
      service.addStoreEmployee(2, dto).subscribe();
      const req = http.expectOne('/api/stores/2/employees');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(dto);
      req.flush({});
    });
  });

  describe('removeStoreEmployee()', () => {
    it('makes DELETE /api/stores/2/employees/99', () => {
      service.removeStoreEmployee(2, 99).subscribe();
      const req = http.expectOne('/api/stores/2/employees/99');
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  // ─── Admin users ──────────────────────────────────────────────────────────

  describe('getAllUsers()', () => {
    it('makes GET /api/users', () => {
      service.getAllUsers().subscribe();
      const req = http.expectOne('/api/users');
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  describe('updateUserRole()', () => {
    it('makes PUT /api/users/5/role with the role body', () => {
      service.updateUserRole(5, 'Admin').subscribe();
      const req = http.expectOne('/api/users/5/role');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ role: 'Admin' });
      req.flush({});
    });
  });

  // ─── Licenses ─────────────────────────────────────────────────────────────

  describe('getStoreLicense()', () => {
    it('makes GET /api/stores/2/license', () => {
      service.getStoreLicense(2).subscribe();
      const req = http.expectOne('/api/stores/2/license');
      expect(req.request.method).toBe('GET');
      req.flush({});
    });
  });

  describe('createLicense()', () => {
    it('makes POST /api/stores/2/license with the dto body', () => {
      const dto = { tier: 'Pro' } as any;
      service.createLicense(2, dto).subscribe();
      const req = http.expectOne('/api/stores/2/license');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(dto);
      req.flush({});
    });
  });

  describe('updateLicense()', () => {
    it('makes PUT /api/stores/2/license/7 with the dto body', () => {
      const dto = { tier: 'Enterprise' } as any;
      service.updateLicense(2, 7, dto).subscribe();
      const req = http.expectOne('/api/stores/2/license/7');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(dto);
      req.flush({});
    });
  });
});
