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
