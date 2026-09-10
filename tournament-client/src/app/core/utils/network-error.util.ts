/**
 * True when an error indicates the backend itself is unreachable/absent
 * (no status, status 0, a static-host 404 for an /api/** route, or the
 * Angular CLI dev-proxy's synthesized 500 for a refused connection) as
 * opposed to a real error surfaced by a live, reachable API. 400/401/409
 * and any 500 that actually carries a body prove the backend processed
 * the request and must still surface as errors.
 */
export function isBackendUnreachable(err: unknown): boolean {
  const e = err as { status?: number; headers?: { get(name: string): string | null }; error?: unknown } | null | undefined;
  const status = e?.status;
  if (status == null || status === 0 || status === 404) return true;

  // The dev-server proxy (webpack-dev-server) synthesizes a bare 500 with no body
  // when the backend it's forwarding to refuses the connection — distinct from a
  // real backend 500, which always carries a body (ProblemDetails JSON in prod,
  // the developer exception HTML page in dev).
  if (status === 500) {
    const contentType = e?.headers?.get('content-type') ?? '';
    const hasBody = e?.error != null && e.error !== '';
    if (contentType.startsWith('text/plain') && !hasBody) return true;
  }

  return false;
}
