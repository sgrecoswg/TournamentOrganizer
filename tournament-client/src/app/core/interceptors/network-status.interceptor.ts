import { HttpInterceptorFn, HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, tap, throwError } from 'rxjs';
import { NetworkStatusService } from '../services/network-status.service';
import { isBackendUnreachable } from '../utils/network-error.util';

export const networkStatusInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.includes('/api/')) return next(req);

  const netStatus = inject(NetworkStatusService);

  return next(req).pipe(
    // Interceptors see the full raw HttpEvent stream (Sent, UploadProgress, etc.)
    // regardless of the caller's `observe` option — only a genuine HttpResponse
    // proves the backend answered; the Sent pseudo-event fires on every request,
    // including ones that go on to fail.
    tap((event) => { if (event instanceof HttpResponse) netStatus.reportReachable(); }),
    catchError((err: HttpErrorResponse) => {
      if (isBackendUnreachable(err)) netStatus.reportUnreachable();
      return throwError(() => err);
    })
  );
};
