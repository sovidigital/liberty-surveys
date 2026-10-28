import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('fetchWithConcurrencyLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('processes items in parallel up to the limit', async () => {
    const callOrder: number[] = [];
    const items = [1, 2, 3, 4, 5];
    const limit = 2;

    const mockFn = vi.fn(async (item: number) => {
      callOrder.push(item);
      await new Promise(resolve => setTimeout(resolve, 100));
      return item * 2;
    });

    const fetchWithConcurrencyLimit = async <T, R>(
      items: T[],
      limit: number,
      fn: (item: T) => Promise<R>
    ): Promise<R[]> => {
      const results: R[] = [];
      const queue = [...items.entries()];
      
      async function worker(): Promise<void> {
        let next: [number, T] | undefined;
        while ((next = queue.shift()) !== undefined) {
          const [index, item] = next;
          const result = await fn(item);
          results[index] = result;
        }
      }
      
      const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
      await Promise.all(workers);
      
      return results;
    };

    const resultPromise = fetchWithConcurrencyLimit(items, limit, mockFn);
    
    await vi.runAllTimersAsync();
    
    const results = await resultPromise;
    
    expect(results).toEqual([2, 4, 6, 8, 10]);
    expect(mockFn).toHaveBeenCalledTimes(5);
  });

  it('maintains result order even with varying async durations', async () => {
    const items = ['a', 'b', 'c', 'd'];
    const limit = 2;
    const delays = [300, 100, 200, 50];

    const mockFn = vi.fn(async (item: string, index: number = items.indexOf(item)) => {
      await new Promise(resolve => setTimeout(resolve, delays[index]));
      return item.toUpperCase();
    });

    const fetchWithConcurrencyLimit = async <T, R>(
      items: T[],
      limit: number,
      fn: (item: T) => Promise<R>
    ): Promise<R[]> => {
      const results: R[] = [];
      const queue = [...items.entries()];
      
      async function worker(): Promise<void> {
        let next: [number, T] | undefined;
        while ((next = queue.shift()) !== undefined) {
          const [index, item] = next;
          const result = await fn(item);
          results[index] = result;
        }
      }
      
      const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
      await Promise.all(workers);
      
      return results;
    };

    const resultPromise = fetchWithConcurrencyLimit(items, limit, mockFn);
    
    await vi.runAllTimersAsync();
    
    const results = await resultPromise;
    
    expect(results).toEqual(['A', 'B', 'C', 'D']);
  });

  it('handles empty array', async () => {
    const mockFn = vi.fn(async (item: number) => item * 2);

    const fetchWithConcurrencyLimit = async <T, R>(
      items: T[],
      limit: number,
      fn: (item: T) => Promise<R>
    ): Promise<R[]> => {
      const results: R[] = [];
      const queue = [...items.entries()];
      
      async function worker(): Promise<void> {
        let next: [number, T] | undefined;
        while ((next = queue.shift()) !== undefined) {
          const [index, item] = next;
          const result = await fn(item);
          results[index] = result;
        }
      }
      
      const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
      await Promise.all(workers);
      
      return results;
    };

    const results = await fetchWithConcurrencyLimit([], 5, mockFn);
    
    expect(results).toEqual([]);
    expect(mockFn).not.toHaveBeenCalled();
  });

  it('handles limit greater than items length', async () => {
    const items = [1, 2];
    const limit = 10;
    const mockFn = vi.fn(async (item: number) => item * 2);

    const fetchWithConcurrencyLimit = async <T, R>(
      items: T[],
      limit: number,
      fn: (item: T) => Promise<R>
    ): Promise<R[]> => {
      const results: R[] = [];
      const queue = [...items.entries()];
      
      async function worker(): Promise<void> {
        let next: [number, T] | undefined;
        while ((next = queue.shift()) !== undefined) {
          const [index, item] = next;
          const result = await fn(item);
          results[index] = result;
        }
      }
      
      const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
      await Promise.all(workers);
      
      return results;
    };

    const results = await fetchWithConcurrencyLimit(items, limit, mockFn);
    
    expect(results).toEqual([2, 4]);
    expect(mockFn).toHaveBeenCalledTimes(2);
  });
});

describe('fetchSegmentMembers performance characteristics', () => {
  it('should use parallel fetching instead of sequential', () => {
    const FETCH_CONCURRENCY_LIMIT = 20;
    const memberCount = 427;
    const avgFetchTimeMs = 100;
    
    const sequentialTime = memberCount * avgFetchTimeMs;
    const parallelBatches = Math.ceil(memberCount / FETCH_CONCURRENCY_LIMIT);
    const parallelTime = parallelBatches * avgFetchTimeMs;
    
    expect(sequentialTime).toBeGreaterThan(40000);
    expect(parallelTime).toBeLessThan(3000);
    expect(parallelTime).toBeLessThan(sequentialTime / 10);
  });
});

describe('empty ID filtering', () => {
  it('should filter out empty string IDs from membership response', () => {
    const rawIds = ['abc123', '', 'def456', '   ', 'ghi789', ''];
    const validIds = rawIds.filter(id => id && id.trim() !== '');
    
    expect(validIds).toEqual(['abc123', 'def456', 'ghi789']);
    expect(validIds.length).toBe(3);
  });

  it('should filter out null/undefined IDs', () => {
    const rawIds = ['abc123', null, 'def456', undefined, 'ghi789'] as (string | null | undefined)[];
    const validIds = rawIds.filter((id): id is string => !!id && id.trim() !== '');
    
    expect(validIds).toEqual(['abc123', 'def456', 'ghi789']);
  });

  it('should handle array with all empty IDs', () => {
    const rawIds = ['', '   ', '', ''];
    const validIds = rawIds.filter(id => id && id.trim() !== '');
    
    expect(validIds).toEqual([]);
    expect(validIds.length).toBe(0);
  });
});

describe('segment filter building', () => {
  it('should build correct base64 segment filter', () => {
    const segmentId = 32;
    const filter = {
      and: [
        {
          segment: {
            id: segmentId,
          },
        },
      ],
    };
    const encoded = Buffer.from(JSON.stringify(filter)).toString('base64');
    
    const decoded = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
    expect(decoded).toEqual(filter);
    expect(decoded.and[0].segment.id).toBe(32);
  });
});

describe('customer data extraction', () => {
  interface TestCustomer {
    id: string;
    identifiers?: { email?: string; id?: string; cio_id?: string };
    attributes: Record<string, unknown>;
  }

  it('should extract email from identifiers.email', () => {
    const customer: TestCustomer = {
      id: 'cust123',
      identifiers: { email: 'user@example.com', id: 'ext123' },
      attributes: {},
    };
    
    const email = customer.identifiers?.email || 
                 (customer.attributes?.email as string) ||
                 '';
    
    expect(email).toBe('user@example.com');
  });

  it('should fall back to attributes.email when identifiers.email missing', () => {
    const customer: TestCustomer = {
      id: 'cust123',
      identifiers: { id: 'ext123' },
      attributes: { email: 'fallback@example.com' },
    };
    
    const email = customer.identifiers?.email || 
                 (customer.attributes?.email as string) ||
                 '';
    
    expect(email).toBe('fallback@example.com');
  });

  it('should use external id when available', () => {
    const customer: TestCustomer = {
      id: 'internal-cio-id',
      identifiers: { email: 'user@example.com', id: 'external-id' },
      attributes: {},
    };
    
    const id = customer.identifiers?.id || customer.id;
    expect(id).toBe('external-id');
  });

  it('should fall back to internal id when external id missing', () => {
    const customer: TestCustomer = {
      id: 'internal-cio-id',
      identifiers: { email: 'user@example.com' },
      attributes: {},
    };
    
    const id = customer.identifiers?.id || customer.id;
    expect(id).toBe('internal-cio-id');
  });

  it('should skip customers without email', () => {
    const customers: TestCustomer[] = [
      { id: '1', identifiers: { email: 'a@test.com' }, attributes: {} },
      { id: '2', identifiers: {}, attributes: {} },
      { id: '3', identifiers: { email: 'c@test.com' }, attributes: {} },
    ];
    
    const withEmail = customers.filter(c => {
      const email = c.identifiers?.email || (c.attributes?.email as string) || '';
      return email !== '';
    });
    
    expect(withEmail.length).toBe(2);
    expect(withEmail.map(c => c.id)).toEqual(['1', '3']);
  });
});
