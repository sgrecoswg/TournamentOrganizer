import { TestBed } from '@angular/core/testing';
import { HttpRequest, HttpResponse, HttpErrorResponse, HttpEventType } from '@angular/common/http';
import { of, concat, throwError, firstValueFrom, lastValueFrom } from 'rxjs';
import { networkStatusInterceptor } from './network-status.interceptor';
import { NetworkStatusService } from '../services/network-status.service';

describe('networkStatusInterceptor', () => {
  let netStatus: NetworkStatusService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [NetworkStatusService] });
    netStatus = TestBed.inject(NetworkStatusService);
  });

  function run(req: HttpRequest<unknown>, next: (r: HttpRequest<unknown>) => any) {
    return TestBed.runInInjectionContext(() => networkStatusInterceptor(req, next));
  }

  it('passes through non-/api/** requests untouched, without touching NetworkStatusService', async () => {
    const req = new HttpRequest('GET', '/assets/logo.png');
    const next = jest.fn().mockReturnValue(of(new HttpResponse({ status: 200 })));

    await firstValueFrom(run(req, next));

    expect(next).toHaveBeenCalledWith(req);
    expect(netStatus.degraded).toBe(false);
  });

  it('reports reachable on a successful /api/** response', async () => {
    netStatus.reportUnreachable();
    const req = new HttpRequest('GET', '/api/events');
    const next = jest.fn().mockReturnValue(of(new HttpResponse({ status: 200 })));

    await firstValueFrom(run(req, next));

    expect(netStatus.degraded).toBe(false);
  });

  it('reports unreachable and rethrows on a 404 /api/** response', async () => {
    const req = new HttpRequest('GET', '/api/events');
    const err = new HttpErrorResponse({ status: 404 });
    const next = jest.fn().mockReturnValue(throwError(() => err));

    await expect(firstValueFrom(run(req, next))).rejects.toBe(err);
    expect(netStatus.degraded).toBe(true);
  });

  it('does NOT report unreachable on a real 401 /api/** error, but still rethrows', async () => {
    const req = new HttpRequest('GET', '/api/events');
    const err = new HttpErrorResponse({ status: 401 });
    const next = jest.fn().mockReturnValue(throwError(() => err));

    await expect(firstValueFrom(run(req, next))).rejects.toBe(err);
    expect(netStatus.degraded).toBe(false);
  });

  // Angular always surfaces the full raw HttpEvent stream to interceptors —
  // including the Sent pseudo-event (type 0), fired the instant a request goes
  // out — regardless of what `observe` option the caller used. A request that
  // is ultimately unreachable still emits Sent before erroring, so treating any
  // next() as proof of reachability wrongly flips degraded false-then-true on
  // every single call, even when the backend never actually responded.
  it('does NOT report reachable from the Sent pseudo-event alone; only a genuine HttpResponse counts', async () => {
    netStatus.reportUnreachable();
    const reachableSpy = jest.spyOn(netStatus, 'reportReachable');
    const req = new HttpRequest('POST', '/api/games/-1/result', {});
    const err = new HttpErrorResponse({ status: 404 });
    const next = jest.fn().mockReturnValue(
      concat(of({ type: HttpEventType.Sent }), throwError(() => err))
    );

    await expect(lastValueFrom(run(req, next))).rejects.toBe(err);
    expect(reachableSpy).not.toHaveBeenCalled();
    expect(netStatus.degraded).toBe(true);
  });

  it('still reports reachable when a genuine HttpResponse follows a Sent event', async () => {
    netStatus.reportUnreachable();
    const req = new HttpRequest('GET', '/api/events');
    const next = jest.fn().mockReturnValue(
      concat(of({ type: HttpEventType.Sent }), of(new HttpResponse({ status: 200 })))
    );

    await lastValueFrom(run(req, next));

    expect(netStatus.degraded).toBe(false);
  });
});
