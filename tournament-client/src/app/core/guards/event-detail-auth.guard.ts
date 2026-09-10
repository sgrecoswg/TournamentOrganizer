import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { filter, map, take } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { NetworkStatusService } from '../services/network-status.service';

/**
 * Narrower than authGuard: lets a degraded, unauthenticated visitor reach
 * event-detail (local events are open to anyone offline, mirroring
 * EventListComponent.canCreateEvent — the component itself gates
 * employee-only actions via networkStatus.degraded). Other authGuard-protected
 * routes (stores, pairings, game-result) still bounce to /events when
 * degraded and unauthenticated.
 */
export const eventDetailAuthGuard: CanActivateFn = (route, state) => {
  const auth    = inject(AuthService);
  const network = inject(NetworkStatusService);
  const router  = inject(Router);

  return auth.authReady$.pipe(
    filter(ready => ready),
    take(1),
    map(() => {
      if (auth.getToken()) return true;
      if (network.degraded) return true;
      router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
      return false;
    })
  );
};
