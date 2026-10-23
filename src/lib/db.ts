import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    
    if (!connectionString) {
      if (process.env.NODE_ENV === 'development' && process.env.USE_MOCK_DB === 'true') {
        console.warn('DATABASE_URL not set, using mock database for development');
        return createMockPool();
      }
      throw new Error('DATABASE_URL environment variable is not set');
    }

    pool = new Pool({
      connectionString,
      ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    pool.on('error', (err) => {
      console.error('Unexpected database pool error:', err);
    });
  }

  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const client = getPool();
  const start = Date.now();
  
  try {
    const result = await client.query<T>(text, params);
    const duration = Date.now() - start;
    
    if (process.env.NODE_ENV === 'development') {
      console.log('Executed query', { text: text.substring(0, 100), duration, rows: result.rowCount });
    }
    
    return result;
  } catch (error) {
    console.error('Database query error:', { text: text.substring(0, 100), error });
    throw error;
  }
}

export async function getClient(): Promise<PoolClient> {
  return getPool().connect();
}

export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

function createMockPool(): Pool {
  const mockData = {
    subscribers: new Map<string, Record<string, unknown>>(),
    polls: new Map<string, Record<string, unknown>>(),
    poll_options: new Map<string, Record<string, unknown>>(),
    votes: new Map<string, Record<string, unknown>>(),
    admin_users: new Map<string, Record<string, unknown>>(),
  };

  const mockPool = {
    query: async (text: string, params?: unknown[]): Promise<QueryResult> => {
      console.log('[MOCK DB] Query:', text.substring(0, 80), params);
      
      const rows: Record<string, unknown>[] = [];
      
      if (text.toLowerCase().includes('select') && text.toLowerCase().includes('from polls')) {
        rows.push(...Array.from(mockData.polls.values()));
      }
      
      return {
        rows,
        rowCount: rows.length,
        command: 'SELECT',
        oid: 0,
        fields: [],
      } as QueryResult;
    },
    connect: async () => ({
      query: mockPool.query,
      release: () => {},
    }),
    end: async () => {},
    on: () => mockPool,
  } as unknown as Pool;

  return mockPool;
}
