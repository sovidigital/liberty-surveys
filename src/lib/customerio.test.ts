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

describe('fetchSegmentMembers identifiers-based parsing', () => {
  interface MembershipIdentifier {
    id?: string;
    email?: string;
    cio_id?: string;
  }

  interface CIOSegmentMember {
    id: string;
    internalId: string;
    email: string;
    attributes: Record<string, unknown>;
  }

  function parseIdentifiers(identifiers: MembershipIdentifier[]): CIOSegmentMember[] {
    const members: CIOSegmentMember[] = [];
    
    for (const ident of identifiers) {
      const email = ident.email;
      if (!email) continue;
      
      const subscriberId = ident.id && ident.id.trim() !== '' 
        ? ident.id 
        : ident.cio_id || '';
      
      if (!subscriberId) continue;
      
      members.push({
        id: subscriberId,
        internalId: ident.cio_id || subscriberId,
        email,
        attributes: {},
      });
    }
    
    return members;
  }

  it('should extract member with id and email', () => {
    const identifiers: MembershipIdentifier[] = [
      { cio_id: 'eec00e000001', email: 'user@example.com', id: '01M5ABC' },
    ];
    
    const members = parseIdentifiers(identifiers);
    
    expect(members.length).toBe(1);
    expect(members[0].id).toBe('01M5ABC');
    expect(members[0].internalId).toBe('eec00e000001');
    expect(members[0].email).toBe('user@example.com');
  });

  it('should use cio_id when external id is missing (email-only profile)', () => {
    const identifiers: MembershipIdentifier[] = [
      { cio_id: 'eec00e000102', email: 'emailonly@example.com' },
    ];
    
    const members = parseIdentifiers(identifiers);
    
    expect(members.length).toBe(1);
    expect(members[0].id).toBe('eec00e000102');
    expect(members[0].internalId).toBe('eec00e000102');
    expect(members[0].email).toBe('emailonly@example.com');
  });

  it('should skip members without email', () => {
    const identifiers: MembershipIdentifier[] = [
      { cio_id: 'eec00e000001', email: 'has@email.com', id: '01M5ABC' },
      { cio_id: 'eec00e000002', id: '01M5DEF' },
      { cio_id: 'eec00e000003', email: 'another@email.com' },
    ];
    
    const members = parseIdentifiers(identifiers);
    
    expect(members.length).toBe(2);
    expect(members.map(m => m.email)).toEqual(['has@email.com', 'another@email.com']);
  });

  it('should handle mixed profiles (some with id, some without)', () => {
    const identifiers: MembershipIdentifier[] = [
      { cio_id: 'eec001', email: 'user1@test.com', id: '01SEEDS1' },
      { cio_id: 'eec002', email: 'user2@test.com' },
      { cio_id: 'eec003', email: 'user3@test.com', id: '01SEEDS2' },
      { cio_id: 'eec004', email: 'user4@test.com' },
      { cio_id: 'eec005', email: 'user5@test.com' },
    ];
    
    const members = parseIdentifiers(identifiers);
    
    expect(members.length).toBe(5);
    expect(members[0].id).toBe('01SEEDS1');
    expect(members[1].id).toBe('eec002');
    expect(members[2].id).toBe('01SEEDS2');
    expect(members[3].id).toBe('eec004');
    expect(members[4].id).toBe('eec005');
  });

  it('should handle empty identifiers array', () => {
    const members = parseIdentifiers([]);
    expect(members.length).toBe(0);
  });

  it('should skip member with empty string id and no cio_id', () => {
    const identifiers: MembershipIdentifier[] = [
      { email: 'noid@test.com', id: '' },
    ];
    
    const members = parseIdentifiers(identifiers);
    expect(members.length).toBe(0);
  });

  it('should use id over cio_id when both present', () => {
    const identifiers: MembershipIdentifier[] = [
      { cio_id: 'internal123', email: 'test@test.com', id: 'external456' },
    ];
    
    const members = parseIdentifiers(identifiers);
    
    expect(members[0].id).toBe('external456');
    expect(members[0].internalId).toBe('internal123');
  });
});

describe('empty ID filtering (legacy fallback)', () => {
  it('should filter out empty string IDs from ids array', () => {
    const rawIds = ['01M5ABC', '', '', '', '01M5DEF'];
    const validIds = rawIds.filter(id => id && id.trim() !== '');
    
    expect(validIds).toEqual(['01M5ABC', '01M5DEF']);
    expect(validIds.length).toBe(2);
  });

  it('should handle array with all empty IDs', () => {
    const rawIds = ['', '   ', '', ''];
    const validIds = rawIds.filter(id => id && id.trim() !== '');
    
    expect(validIds).toEqual([]);
    expect(validIds.length).toBe(0);
  });
});
