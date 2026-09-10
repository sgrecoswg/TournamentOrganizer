import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { BehaviorSubject, firstValueFrom, Observable } from 'rxjs';
import { eventDetailAuthGuard } from './event-detail-auth.guard';
import { AuthService } from '../services/auth.service';
import { NetworkStatusService } from '../services/network-status.service';

// event-detail.component.ts renders its own "Register Player" form (and hides
// employee-only actions) based on networkStatus.degraded — this guard just needs
// to let a degraded, unauthenticated visitor reach the component at all, unlike
// the shared authGuard (which bounces them to /events, appropriate for
// employee-only routes like /stores).
describe('eventDetailAuthGuard', () => {
  let authReadySubject: BehaviorSubject<boolean>;
  let mockAuth: { authReady$: Observable<boolean>; getToken: jest.Mock };
  let mockNetwork: { degraded: boolean };
  let mockRouter: { navigate: jest.Mock };

  beforeEach(() => {
    authReadySubject = new BehaviorSubject<boolean>(false);
    mockAuth = { authReady$: authReadySubject.asObservable(), getToken: jest.fn() };
    mockNetwork = { degraded: false };
    mockRouter = { navigate: jest.fn() };

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: mockAuth },
        { provide: NetworkStatusService, useValue: mockNetwork },
        { provide: Router, useValue: mockRouter },
      ],
    });
  });

  function runGuard(): Observable<boolean> {
    return TestBed.runInInjectionContext(() =>
      eventDetailAuthGuard({} as any, { url: '/events/1' } as any)
    ) as Observable<boolean>;
  }

  it('does not decide while authReady$ is still false', () => {
    mockAuth.getToken.mockReturnValue('valid-token');
    let emitted = false;
    runGuard().subscribe(() => { emitted = true; });
    expect(emitted).toBe(false);
    expect(mockRouter.navigate).not.toHaveBeenCalled();
  });

  it('allows navigation once ready and a token exists', async () => {
    mockAuth.getToken.mockReturnValue('valid-token');
    const promise = firstValueFrom(runGuard());
    authReadySubject.next(true);
    const result = await promise;
    expect(result).toBe(true);
    expect(mockRouter.navigate).not.toHaveBeenCalled();
  });

  it('redirects to /login with returnUrl when online and no token', async () => {
    mockAuth.getToken.mockReturnValue(null);
    const promise = firstValueFrom(runGuard());
    authReadySubject.next(true);
    const result = await promise;
    expect(result).toBe(false);
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/login'], { queryParams: { returnUrl: '/events/1' } });
  });

  it('allows navigation when degraded, even with no token (local events are open to anyone offline)', async () => {
    mockAuth.getToken.mockReturnValue(null);
    mockNetwork.degraded = true;
    const promise = firstValueFrom(runGuard());
    authReadySubject.next(true);
    const result = await promise;
    expect(result).toBe(true);
    expect(mockRouter.navigate).not.toHaveBeenCalled();
  });

  it('still allows navigation when degraded and a valid token exists', async () => {
    mockAuth.getToken.mockReturnValue('valid-token');
    mockNetwork.degraded = true;
    const promise = firstValueFrom(runGuard());
    authReadySubject.next(true);
    const result = await promise;
    expect(result).toBe(true);
    expect(mockRouter.navigate).not.toHaveBeenCalled();
  });
});
