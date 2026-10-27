import { NextRequest } from 'next/server';

/**
 * Get the base URL for redirects.
 * 
 * On Amplify SSR, request.url returns the internal server origin (https://localhost:3000),
 * so we need to prefer NEXT_PUBLIC_BASE_URL or forwarded headers for redirects.
 * 
 * Priority:
 * 1. NEXT_PUBLIC_BASE_URL (if set and not localhost)
 * 2. x-forwarded-host header (set by reverse proxies like Amplify)
 * 3. host header
 * 4. request.url origin (localhost fallback for local dev)
 */
export function getBaseUrl(request: NextRequest): string {
  const envBaseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  if (envBaseUrl && !envBaseUrl.includes('localhost')) {
    return envBaseUrl.replace(/\/$/, '');
  }

  const forwardedHost = request.headers.get('x-forwarded-host');
  if (forwardedHost) {
    const protocol = request.headers.get('x-forwarded-proto') || 'https';
    return `${protocol}://${forwardedHost}`;
  }

  const host = request.headers.get('host');
  if (host && !host.includes('localhost')) {
    const protocol = request.headers.get('x-forwarded-proto') || 'https';
    return `${protocol}://${host}`;
  }

  return new URL(request.url).origin;
}

/**
 * Create a redirect URL using the proper base URL.
 */
export function buildRedirectUrl(request: NextRequest, path: string): URL {
  return new URL(path, getBaseUrl(request));
}
