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
 * Build a redirect URL from a request and path.
 * Uses the request's origin for the base URL.
 */
export function buildRedirectUrl(request: NextRequest, path: string): string {
  const url = new URL(request.url);
  return `${url.origin}${path}`;
}
