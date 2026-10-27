import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { buildRedirectUrl, getPublicOrigin } from './url';

function createMockRequest(
  url: string,
  headers: Record<string, string> = {}
): NextRequest {
  const request = new NextRequest(url);
  for (const [key, value] of Object.entries(headers)) {
    request.headers.set(key, value);
  }
  return request;
}

describe('getPublicOrigin', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('uses NEXT_PUBLIC_BASE_URL when set to a valid public URL', () => {
    process.env.NEXT_PUBLIC_BASE_URL = 'https://www.libertysurveys.com';
    const request = createMockRequest('https://localhost:3000/api/vote');
    expect(getPublicOrigin(request)).toBe('https://www.libertysurveys.com');
  });

  it('strips trailing slashes from NEXT_PUBLIC_BASE_URL', () => {
    process.env.NEXT_PUBLIC_BASE_URL = 'https://www.libertysurveys.com/';
    const request = createMockRequest('https://localhost:3000/api/vote');
    expect(getPublicOrigin(request)).toBe('https://www.libertysurveys.com');
  });

  it('ignores NEXT_PUBLIC_BASE_URL when set to localhost', () => {
    process.env.NEXT_PUBLIC_BASE_URL = 'http://localhost:3000';
    const request = createMockRequest('https://localhost:3000/api/vote', {
      'x-forwarded-host': 'www.libertysurveys.com',
      'x-forwarded-proto': 'https',
    });
    expect(getPublicOrigin(request)).toBe('https://www.libertysurveys.com');
  });

  it('uses x-forwarded-host when NEXT_PUBLIC_BASE_URL is not set', () => {
    delete process.env.NEXT_PUBLIC_BASE_URL;
    const request = createMockRequest('https://localhost:3000/api/vote', {
      'x-forwarded-host': 'www.libertysurveys.com',
      'x-forwarded-proto': 'https',
    });
    expect(getPublicOrigin(request)).toBe('https://www.libertysurveys.com');
  });

  it('uses host header when x-forwarded-host is not present', () => {
    delete process.env.NEXT_PUBLIC_BASE_URL;
    const request = createMockRequest('https://localhost:3000/api/vote', {
      host: 'www.libertysurveys.com',
    });
    expect(getPublicOrigin(request)).toBe('https://www.libertysurveys.com');
  });

  it('handles comma-separated x-forwarded-host (multiple proxies)', () => {
    delete process.env.NEXT_PUBLIC_BASE_URL;
    const request = createMockRequest('https://localhost:3000/api/vote', {
      'x-forwarded-host': 'www.libertysurveys.com, internal.proxy.local',
      'x-forwarded-proto': 'https, http',
    });
    expect(getPublicOrigin(request)).toBe('https://www.libertysurveys.com');
  });

  it('defaults to https when x-forwarded-proto is not present', () => {
    delete process.env.NEXT_PUBLIC_BASE_URL;
    const request = createMockRequest('https://localhost:3000/api/vote', {
      'x-forwarded-host': 'www.libertysurveys.com',
    });
    expect(getPublicOrigin(request)).toBe('https://www.libertysurveys.com');
  });
});

describe('buildRedirectUrl', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('ignores localhost request URL when NEXT_PUBLIC_BASE_URL is www', () => {
    process.env.NEXT_PUBLIC_BASE_URL = 'https://www.libertysurveys.com';
    const request = createMockRequest('https://localhost:3000/api/vote?p=123');
    const result = buildRedirectUrl(request, '/polls/123?status=voted');
    expect(result).toBe('https://www.libertysurveys.com/polls/123?status=voted');
    expect(result).not.toContain('localhost');
  });

  it('normalizes paths without leading slash', () => {
    process.env.NEXT_PUBLIC_BASE_URL = 'https://www.libertysurveys.com';
    const request = createMockRequest('https://localhost:3000/api/vote');
    const result = buildRedirectUrl(request, 'polls/123?status=voted');
    expect(result).toBe('https://www.libertysurveys.com/polls/123?status=voted');
  });

  it('does not double-slash paths with leading slash', () => {
    process.env.NEXT_PUBLIC_BASE_URL = 'https://www.libertysurveys.com';
    const request = createMockRequest('https://localhost:3000/api/vote');
    const result = buildRedirectUrl(request, '/polls/123?status=voted');
    expect(result).toBe('https://www.libertysurveys.com/polls/123?status=voted');
  });

  it('prefers NEXT_PUBLIC_BASE_URL over amplifyapp.com host', () => {
    process.env.NEXT_PUBLIC_BASE_URL = 'https://www.libertysurveys.com';
    const request = createMockRequest('https://localhost:3000/api/vote', {
      'x-forwarded-host': 'main.d123abc.amplifyapp.com',
    });
    const result = buildRedirectUrl(request, '/polls/123?status=voted');
    expect(result).toBe('https://www.libertysurveys.com/polls/123?status=voted');
    expect(result).not.toContain('amplifyapp.com');
  });

  it('uses forwarded host when NEXT_PUBLIC_BASE_URL is localhost', () => {
    process.env.NEXT_PUBLIC_BASE_URL = 'http://localhost:3000';
    const request = createMockRequest('https://localhost:3000/api/vote', {
      'x-forwarded-host': 'www.libertysurveys.com',
      'x-forwarded-proto': 'https',
    });
    const result = buildRedirectUrl(request, '/polls/123?status=voted');
    expect(result).toBe('https://www.libertysurveys.com/polls/123?status=voted');
  });
});
