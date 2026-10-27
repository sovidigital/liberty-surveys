/**
 * URL utilities for email link generation and redirects.
 * 
 * Ensures email links never silently use localhost in production.
 */

import { NextRequest } from 'next/server';

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Get the base URL for email links.
 * 
 * In production, throws if NEXT_PUBLIC_BASE_URL is missing or set to localhost.
 * In development, falls back to localhost:3000 for local testing.
 */
export function getRequiredBaseUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  
  if (!baseUrl) {
    if (isProduction) {
      throw new Error(
        'NEXT_PUBLIC_BASE_URL must be set in production. ' +
        'Email links require a valid public URL.'
      );
    }
    console.warn('[DEV] NEXT_PUBLIC_BASE_URL not set, using localhost:3000');
    return 'http://localhost:3000';
  }
  
  const isLocalhost = baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1');
  
  if (isLocalhost && isProduction) {
    throw new Error(
      `NEXT_PUBLIC_BASE_URL is set to localhost (${baseUrl}) in production. ` +
      'Email links require a valid public URL like https://www.libertysurveys.com'
    );
  }
  
  if (isLocalhost) {
    console.warn(`[DEV] Using localhost base URL: ${baseUrl}`);
  }
  
  return baseUrl;
}

/**
 * Get base URL or null if unavailable.
 * Use this for non-critical operations that can gracefully degrade.
 */
export function getBaseUrlOrNull(): string | null {
  try {
    return getRequiredBaseUrl();
  } catch {
    return null;
  }
}

/**
 * Public origin for user-facing redirects.
 *
 * Never use request.url here: on Amplify SSR the Lambda sees an internal
 * origin (https://localhost:3000), which leaked into post-vote redirects.
 * Order: NEXT_PUBLIC_BASE_URL (non-localhost) -> x-forwarded-host/host
 * (non-localhost) -> getRequiredBaseUrl() dev fallback.
 */
export function getPublicOrigin(request?: NextRequest): string {
  const env = process.env.NEXT_PUBLIC_BASE_URL;
  if (env && !/localhost|127\.0\.0\.1/.test(env)) {
    return env.replace(/\/+$/, '');
  }
  const host =
    request?.headers.get('x-forwarded-host')?.split(',')[0].trim() ||
    request?.headers.get('host') ||
    '';
  if (host && !/^(localhost|127\.0\.0\.1)(:|$)/.test(host)) {
    const proto =
      request?.headers.get('x-forwarded-proto')?.split(',')[0].trim() || 'https';
    return `${proto}://${host}`;
  }
  if (!isProduction) return getRequiredBaseUrl().replace(/\/+$/, '');
  return 'https://www.libertysurveys.com';
}

/**
 * Build an absolute redirect URL for a path on the public site.
 */
export function buildRedirectUrl(request: NextRequest, path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${getPublicOrigin(request)}${normalized}`;
}
