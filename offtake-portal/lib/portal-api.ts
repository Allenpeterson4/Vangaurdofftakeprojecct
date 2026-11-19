import type { PortalUser } from '@/lib/auth';

const API_TIMEOUT_MS = 15_000;

export class PortalApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly redirectTo?: string) {
    super(message);
    this.name = 'PortalApiError';
  }
}

let csrfToken: string | null = null;

async function fetchPortalApi<T>(
  url: string,
  init: RequestInit,
  parseResponse: (response: Response) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const onAbort = () => controller.abort(init.signal?.reason);
  if (init.signal?.aborted) controller.abort(init.signal.reason);
  else init.signal?.addEventListener('abort', onAbort, { once: true });

  try {
    const request = fetch(url, { ...init, signal: controller.signal })
      .then(parseResponse);
    const deadline = new Promise<never>((_resolve, reject) => {
      timeout = setTimeout(() => {
        controller.abort();
        reject(new PortalApiError('The portal server did not respond in time. Please try again.', 408));
      }, API_TIMEOUT_MS);
    });
    return await Promise.race([request, deadline]);
  } catch (reason) {
    if (controller.signal.aborted && !init.signal?.aborted) {
      throw new PortalApiError('The portal server did not respond in time. Please try again.', 408);
    }
    throw reason;
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
    init.signal?.removeEventListener('abort', onAbort);
  }
}

async function readJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    const message = response.status === 404
      ? 'The portal API route was not found. Make sure the PHP API files are deployed under /api/.'
      : `The portal API returned an unexpected response (HTTP ${response.status}). Check /api/health.php and the PHP error log.`;
    throw new PortalApiError(message, response.status);
  }
  try {
    return await response.json();
  } catch {
    throw new PortalApiError(`The portal API returned invalid JSON (HTTP ${response.status}). Check /api/health.php.`, response.status);
  }
}

async function loadCsrfToken() {
  const result = await fetchPortalApi('/api/auth.php?action=csrf', {
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  }, async (response) => ({ response, payload: await readJson(response) }));
  const { response, payload } = result;
  const tokenPayload = payload as { csrfToken?: string; error?: string };
  if (!response.ok || !tokenPayload.csrfToken) {
    throw new PortalApiError(tokenPayload.error ?? 'Unable to start a secure session.', response.status);
  }
  csrfToken = tokenPayload.csrfToken;
  return csrfToken;
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? 'GET').toUpperCase();
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (method !== 'GET' && method !== 'HEAD') {
    headers.set('Content-Type', 'application/json');
    headers.set('X-CSRF-Token', await loadCsrfToken());
  }

  const result = await fetchPortalApi(`/api/${path}`, {
    ...init,
    method,
    headers,
    credentials: 'same-origin',
    cache: 'no-store',
  }, async (response) => ({ response, payload: await readJson(response) }));
  const { response, payload } = result;
  if (!response.ok) {
    const body = typeof payload === 'object' && payload !== null ? payload : null;
    const message = body && 'error' in body && typeof body.error === 'string'
      ? body.error
      : 'The request could not be completed.';
    const redirectTo = body && 'redirect_to' in body && typeof body.redirect_to === 'string'
      ? body.redirect_to
      : undefined;
    throw new PortalApiError(message, response.status, redirectTo);
  }
  if (method !== 'GET' && method !== 'HEAD') csrfToken = null;
  return payload as T;
}

export async function getCurrentPortalUser() {
  const response = await apiRequest<{ user: PortalUser }>('auth.php?action=me');
  return response.user;
}
