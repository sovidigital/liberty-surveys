import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { AuroraDSQLPool } from '@aws/aurora-dsql-node-postgres-connector';

let pool: Pool | AuroraDSQLPool | null = null;
let connectionError: Error | null = null;

function logError(context: string, error: unknown): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorName = error instanceof Error ? error.name : 'Unknown';
  const errorStack = error instanceof Error ? error.stack?.split('\n').slice(0, 3).join('\n') : '';
  
  console.error(`[DB ${context}]`, {
    error: errorName,
    message: errorMessage,
    stack: errorStack,
    timestamp: new Date().toISOString(),
  });
}

function logInfo(context: string, message: string, data?: Record<string, unknown>): void {
  console.log(`[DB ${context}]`, {
    message,
    ...data,
    timestamp: new Date().toISOString(),
  });
}

async function getPool(): Promise<Pool | AuroraDSQLPool> {
  if (connectionError) {
    throw connectionError;
  }

  if (!pool) {
    const useMockDb = process.env.USE_MOCK_DB === 'true';

    if (useMockDb) {
      logInfo('INIT', 'Using mock database (USE_MOCK_DB=true)');
      return createMockPool();
    }

    const endpoint = process.env.DSQL_ENDPOINT;
    const user = process.env.DSQL_USER || 'admin';
    const region = process.env.DSQL_REGION || process.env.AWS_REGION || 'us-east-1';

    if (!endpoint) {
      connectionError = new Error(
        'DSQL_ENDPOINT not set. Configure DSQL_ENDPOINT in Amplify environment variables.'
      );
      logError('INIT', connectionError);
      throw connectionError;
    }

    logInfo('INIT', 'Configuring DSQL pool', { endpoint, user, region });

    try {
      pool = new AuroraDSQLPool({
        host: endpoint,
        user,
        region,
        database: 'postgres',
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 15000,
        logger: {
          warn: (msg: string) => console.warn(`[DSQL] ${msg}`),
          error: (msg: string) => console.error(`[DSQL] ${msg}`),
        },
      });

      logInfo('INIT', 'DSQL pool created successfully', { endpoint, region, user });
    } catch (err) {
      connectionError = new Error(
        `Failed to create DSQL pool: ${err instanceof Error ? err.message : String(err)}`
      );
      logError('INIT', connectionError);
      throw connectionError;
    }
  }

  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const queryId = Math.random().toString(36).substring(2, 8);
  const start = Date.now();
  const textPreview = text.substring(0, 100).replace(/\s+/g, ' ');

  try {
    const client = await getPool();
    const result = await client.query<T>(text, params);
    const duration = Date.now() - start;

    if (process.env.NODE_ENV === 'development' || duration > 1000) {
      logInfo('QUERY', `[${queryId}] OK`, { 
        query: textPreview, 
        duration: `${duration}ms`, 
        rows: result.rowCount 
      });
    }

    return result;
  } catch (error) {
    const duration = Date.now() - start;
    
    logError('QUERY', {
      message: `[${queryId}] Query failed after ${duration}ms`,
      query: textPreview,
      error: error instanceof Error ? error.message : String(error),
      errorType: error instanceof Error ? error.name : 'Unknown',
    } as unknown as Error);

    if (error instanceof Error) {
      if (error.message.includes('credential') || 
          error.message.includes('token') ||
          error.message.includes('IAM') ||
          error.message.includes('authorization')) {
        throw new Error('Database authentication failed. Check IAM role configuration.');
      }
      if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
        throw new Error('Database connection timed out. Check network configuration.');
      }
      if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
        throw new Error('Database host not found. Check DSQL_ENDPOINT configuration.');
      }
    }

    throw error;
  }
}

export async function getClient(): Promise<PoolClient> {
  const p = await getPool();
  return p.connect();
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
  connectionError = null;
}

export async function testConnection(): Promise<{ ok: boolean; error?: string; latency?: number }> {
  const start = Date.now();
  try {
    await query('SELECT 1 as ping');
    return { ok: true, latency: Date.now() - start };
  } catch (error) {
    return { 
      ok: false, 
      error: error instanceof Error ? error.message : String(error),
      latency: Date.now() - start,
    };
  }
}

function createMockPool(): Pool {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const mockPolls = [
    {
      id: '01MOCK0001',
      question: '[SAMPLE] Should Congress pass the proposed infrastructure modernization bill?',
      status: 'active',
      scheduled_for: null,
      published_at: new Date(now.getTime() - 6 * 60 * 60 * 1000),
      closed_at: null,
      created_by: null,
      created_at: yesterday,
      updated_at: now,
      briefing_background: '[SAMPLE DATA] Congress is currently debating a $500 billion infrastructure modernization bill that would fund repairs to roads, bridges, and broadband expansion. The bill has bipartisan sponsors but faces opposition over spending levels and funding mechanisms. A vote is expected within the next two weeks.',
      briefing_conservative: '[SAMPLE DATA] Conservative lawmakers argue the bill\'s price tag is excessive and would add to the national debt. They advocate for more targeted spending focused on traditional infrastructure like roads and bridges, with greater involvement from private sector investment. Some prefer state-level solutions over federal programs.',
      briefing_liberal: '[SAMPLE DATA] Progressive advocates support the bill but argue it should go further to address climate change and expand public transit. They contend that infrastructure investment creates jobs and that the spending is necessary to compete globally. Some push for amendments to include more green energy provisions.',
      briefing_centrist: '[SAMPLE DATA] Moderate voices see the bill as a starting point for compromise. They support the core infrastructure goals while acknowledging concerns about cost and implementation. Many centrists advocate for amendments that could broaden bipartisan support without gutting the bill\'s key provisions.',
      generation_run_id: '01MOCKRUN01',
      is_auto_generated: true,
    },
    {
      id: '01MOCK0002',
      question: '[SAMPLE] Should the federal minimum wage be increased to $15 per hour?',
      status: 'closed',
      scheduled_for: null,
      published_at: new Date(yesterday.getTime() - 6 * 60 * 60 * 1000),
      closed_at: new Date(now.getTime() - 6 * 60 * 60 * 1000),
      created_by: null,
      created_at: new Date(yesterday.getTime() - 12 * 60 * 60 * 1000),
      updated_at: now,
      briefing_background: '[SAMPLE DATA] The federal minimum wage has been $7.25 per hour since 2009. Many states and cities have enacted higher minimum wages, with some reaching $15 or more. Economists debate the effects on employment, cost of living, and business competitiveness.',
      briefing_conservative: '[SAMPLE DATA] Conservative economists warn that a $15 minimum wage could lead to job losses, reduced hours, and higher prices for consumers. They argue small businesses in low-cost areas would be particularly affected and prefer state-level decisions based on local economic conditions.',
      briefing_liberal: '[SAMPLE DATA] Progressive advocates argue the current minimum wage has not kept pace with inflation or productivity gains. They contend a higher wage would reduce poverty, increase consumer spending, and decrease reliance on government assistance programs.',
      briefing_centrist: '[SAMPLE DATA] Centrist economists suggest a phased approach with regional adjustments might balance worker welfare with employment concerns. Many support indexing the minimum wage to inflation to prevent future purchasing power erosion.',
      generation_run_id: '01MOCKRUN02',
      is_auto_generated: true,
    },
  ];

  const mockOptions = [
    { id: '01MOCKOPT01', poll_id: '01MOCK0001', option_text: 'Yes, pass the bill as proposed', display_order: 1 },
    { id: '01MOCKOPT02', poll_id: '01MOCK0001', option_text: 'Yes, but with spending reductions', display_order: 2 },
    { id: '01MOCKOPT03', poll_id: '01MOCK0001', option_text: 'No, reject the proposal', display_order: 3 },
    { id: '01MOCKOPT04', poll_id: '01MOCK0001', option_text: 'Undecided / Need more information', display_order: 4 },
    { id: '01MOCKOPT05', poll_id: '01MOCK0002', option_text: 'Yes, increase to $15 nationally', display_order: 1 },
    { id: '01MOCKOPT06', poll_id: '01MOCK0002', option_text: 'Yes, but phase in gradually', display_order: 2 },
    { id: '01MOCKOPT07', poll_id: '01MOCK0002', option_text: 'No, leave it to states', display_order: 3 },
    { id: '01MOCKOPT08', poll_id: '01MOCK0002', option_text: 'No, keep current federal minimum', display_order: 4 },
  ];

  const mockVotes = [
    { id: '01MOCKVOTE01', poll_id: '01MOCK0001', option_id: '01MOCKOPT01', subscriber_id: '01MOCKSUB01' },
    { id: '01MOCKVOTE02', poll_id: '01MOCK0001', option_id: '01MOCKOPT01', subscriber_id: '01MOCKSUB02' },
    { id: '01MOCKVOTE03', poll_id: '01MOCK0001', option_id: '01MOCKOPT01', subscriber_id: '01MOCKSUB03' },
    { id: '01MOCKVOTE04', poll_id: '01MOCK0001', option_id: '01MOCKOPT02', subscriber_id: '01MOCKSUB04' },
    { id: '01MOCKVOTE05', poll_id: '01MOCK0001', option_id: '01MOCKOPT02', subscriber_id: '01MOCKSUB05' },
    { id: '01MOCKVOTE06', poll_id: '01MOCK0001', option_id: '01MOCKOPT03', subscriber_id: '01MOCKSUB06' },
    { id: '01MOCKVOTE07', poll_id: '01MOCK0001', option_id: '01MOCKOPT04', subscriber_id: '01MOCKSUB07' },
    { id: '01MOCKVOTE08', poll_id: '01MOCK0002', option_id: '01MOCKOPT05', subscriber_id: '01MOCKSUB01' },
    { id: '01MOCKVOTE09', poll_id: '01MOCK0002', option_id: '01MOCKOPT05', subscriber_id: '01MOCKSUB02' },
    { id: '01MOCKVOTE10', poll_id: '01MOCK0002', option_id: '01MOCKOPT06', subscriber_id: '01MOCKSUB03' },
    { id: '01MOCKVOTE11', poll_id: '01MOCK0002', option_id: '01MOCKOPT06', subscriber_id: '01MOCKSUB04' },
    { id: '01MOCKVOTE12', poll_id: '01MOCK0002', option_id: '01MOCKOPT06', subscriber_id: '01MOCKSUB05' },
    { id: '01MOCKVOTE13', poll_id: '01MOCK0002', option_id: '01MOCKOPT07', subscriber_id: '01MOCKSUB06' },
    { id: '01MOCKVOTE14', poll_id: '01MOCK0002', option_id: '01MOCKOPT08', subscriber_id: '01MOCKSUB07' },
  ];

  const mockSources = [
    { id: '01MOCKSRC01', poll_id: '01MOCK0001', source_name: 'Associated Press', source_url: 'https://apnews.com/article/infrastructure-bill', article_title: 'Congress Debates Infrastructure Package', article_snippet: 'Bipartisan group pushes for compromise...', political_lean: 'center', perspective_used: 'background', fetched_at: now, created_at: now },
    { id: '01MOCKSRC02', poll_id: '01MOCK0001', source_name: 'Fox News', source_url: 'https://foxnews.com/politics/infrastructure', article_title: 'GOP Raises Concerns Over Spending', article_snippet: 'Republican leaders question price tag...', political_lean: 'right', perspective_used: 'conservative', fetched_at: now, created_at: now },
    { id: '01MOCKSRC03', poll_id: '01MOCK0001', source_name: 'CNN', source_url: 'https://cnn.com/politics/infrastructure', article_title: 'Democrats Push for Broader Investment', article_snippet: 'Progressive caucus seeks climate provisions...', political_lean: 'left', perspective_used: 'liberal', fetched_at: now, created_at: now },
  ];

  const mockSubscribers = [
    { id: '01MOCKSUB01', email: 'test1@example.com', status: 'active', subscribed_at: yesterday },
    { id: '01MOCKSUB02', email: 'test2@example.com', status: 'active', subscribed_at: yesterday },
    { id: '01MOCKSUB03', email: 'test3@example.com', status: 'active', subscribed_at: yesterday },
  ];

  const mockPool = {
    query: async (text: string, params?: unknown[]): Promise<QueryResult> => {
      logInfo('MOCK', 'Query', { query: text.substring(0, 80), params: params?.length });

      const textLower = text.toLowerCase();
      let rows: Record<string, unknown>[] = [];

      if (textLower.includes('from polls') && textLower.includes('select')) {
        if (params && params[0] && typeof params[0] === 'string' && params[0].startsWith('01')) {
          rows = mockPolls.filter(p => p.id === params[0]);
        } else if (textLower.includes('active') || textLower.includes('closed')) {
          rows = mockPolls.filter(p => p.status === 'active' || p.status === 'closed');
        } else {
          rows = [...mockPolls];
        }
      } else if (textLower.includes('from poll_options') && textLower.includes('select')) {
        if (params?.[0] && Array.isArray(params[0])) {
          const pollIds = params[0] as string[];
          rows = mockOptions.filter(o => pollIds.includes(o.poll_id));
        } else {
          const pollId = params?.[0] as string;
          rows = mockOptions.filter(o => o.poll_id === pollId);
        }
      } else if (textLower.includes('from votes') && textLower.includes('select')) {
        if (params?.[0] && Array.isArray(params[0])) {
          const pollIds = params[0] as string[];
          const voteCounts = new Map<string, number>();
          mockVotes.filter(v => pollIds.includes(v.poll_id)).forEach(v => {
            const key = `${v.poll_id}:${v.option_id}`;
            voteCounts.set(key, (voteCounts.get(key) || 0) + 1);
          });
          rows = Array.from(voteCounts.entries()).map(([key, count]) => {
            const [poll_id, option_id] = key.split(':');
            return { poll_id, option_id, count: count.toString() };
          });
        } else if (textLower.includes('count')) {
          rows = [{ count: mockVotes.length.toString() }];
        }
      } else if (textLower.includes('from poll_sources') && textLower.includes('select')) {
        const pollId = params?.[0] as string;
        rows = mockSources.filter(s => s.poll_id === pollId);
      } else if (textLower.includes('from subscribers') && textLower.includes('select')) {
        if (textLower.includes('group by status')) {
          rows = [
            { status: 'active', count: '3' },
            { status: 'pending', count: '1' },
          ];
        } else if (params?.[0]) {
          rows = mockSubscribers.filter(s => s.email === params[0]);
        } else {
          rows = [...mockSubscribers];
        }
      } else if (textLower.includes('count(*)') && textLower.includes('from polls')) {
        rows = [{ count: mockPolls.length.toString() }];
      } else if (textLower.includes('from generation_runs')) {
        rows = [];
      } else if (textLower.includes('from evergreen_polls')) {
        rows = [];
      } else if (textLower.includes('insert into subscribers')) {
        rows = [];
      } else if (textLower.includes('update subscribers')) {
        rows = [];
      }

      return {
        rows,
        rowCount: rows.length,
        command: textLower.includes('select') ? 'SELECT' : textLower.includes('insert') ? 'INSERT' : 'UPDATE',
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
