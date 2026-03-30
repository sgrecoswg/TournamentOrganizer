import { HttpInterceptorFn, HttpErrorResponse, HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { environment } from '../../../environments/environment';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router      = inject(Router);
  // Inject HttpClient directly to avoid circular DI (AuthService also injects HttpClient
  // and is injected by this interceptor — delegating through AuthService.refresh() would
  // create a cycle that Angular cannot resolve).
  const http        = inject(HttpClient);

  const token = authService.getToken();
  const authedReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authedReq).pipe(
    catchError((err: HttpErrorResponse) => {
      // Only attempt refresh on 401, and never for the refresh/logout endpoints to avoid loops.
      if (
        err.status === 401 &&
        !req.url.includes('/api/auth/refresh') &&
        !req.url.includes('/api/auth/logout')
      ) {
        return http.post<{ token: string }>(
          `${environment.apiBase}/api/auth/refresh`,
          {},
          { withCredentials: true }
        ).pipe(
          tap(res => authService.storeToken(res.token)),
          switchMap(res => {
            const retried = req.clone({
              setHeaders: { Authorization: `Bearer ${res.token}` },
            });
            return next(retried);
          }),
          catchError(() => {
            authService.logout();
            router.navigate(['/login']);
            return throwError(() => err);
          })
        );
      }
      return throwError(() => err);
    })
  );
};
