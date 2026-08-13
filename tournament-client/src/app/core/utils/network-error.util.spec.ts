import { HttpHeaders } from '@angular/common/http';
import { isBackendUnreachable } from './network-error.util';

describe('isBackendUnreachable', () => {
  it.each([
    ['undefined error', undefined],
    ['null error', null],
    ['status 0 (browser-level network failure)', { status: 0 }],
    ['status 404 (static host, no backend deployed)', { status: 404 }],
    [
      'status 500 with empty text/plain body (Angular CLI dev-proxy ECONNREFUSED)',
      { status: 500, headers: new HttpHeaders({ 'content-type': 'text/plain' }), error: '' },
    ],
  ])('returns true for %s', (_label, err) => {
    expect(isBackendUnreachable(err)).toBe(true);
  });

  it.each([
    ['status 400 (validation error)', { status: 400 }],
    ['status 401 (auth error)', { status: 401 }],
    ['status 409 (conflict)', { status: 409 }],
    ['status 500 (server error, no headers info)', { status: 500 }],
    [
      'status 500 with a real ProblemDetails JSON body (prod backend error)',
      {
        status: 500,
        headers: new HttpHeaders({ 'content-type': 'application/problem+json' }),
        error: { title: 'An unexpected error occurred.', status: 500 },
      },
    ],
    [
      'status 500 with a real dev exception HTML page body',
      {
        status: 500,
        headers: new HttpHeaders({ 'content-type': 'text/html' }),
        error: '<html>...stack trace...</html>',
      },
    ],
  ])('returns false for %s', (_label, err) => {
    expect(isBackendUnreachable(err)).toBe(false);
  });
});
