import { NextResponse } from 'next/server';
import { testConnection } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const startTime = Date.now();
  
  const allEnvKeys = Object.keys(process.env);
  const appEnvKeys = allEnvKeys.filter(k => 
    k.startsWith('DSQL_') || 
    k.startsWith('USE_MOCK') || 
    k.startsWith('CUSTOMERIO_') || 
    k.startsWith('CONFIRM_') ||
    k.startsWith('UNSUBSCRIBE_') ||
    k.startsWith('VOTE_') ||
    k.startsWith('JWT_') ||
    k.startsWith('SCHEDULER_') ||
    k.startsWith('XAI_') ||
    k.startsWith('NEXT_PUBLIC_')
  );
  
  const envFlags = {
    hasDsqlEndpoint: !!process.env.DSQL_ENDPOINT,
    hasDsqlUser: !!process.env.DSQL_USER,
    hasDsqlRegion: !!process.env.DSQL_REGION,
    useMockDb: process.env.USE_MOCK_DB === 'true',
    hasAwsAccessKeyId: !!process.env.AWS_ACCESS_KEY_ID,
    hasAwsSecretAccessKey: !!process.env.AWS_SECRET_ACCESS_KEY,
    hasAwsSessionToken: !!process.env.AWS_SESSION_TOKEN,
    hasAwsRoleArn: !!process.env.AWS_ROLE_ARN,
    hasAwsWebIdentityTokenFile: !!process.env.AWS_WEB_IDENTITY_TOKEN_FILE,
    hasAwsExecutionEnv: !!process.env.AWS_EXECUTION_ENV,
    hasAwsRegion: !!process.env.AWS_REGION,
    hasAwsDefaultRegion: !!process.env.AWS_DEFAULT_REGION,
    awsExecutionEnv: process.env.AWS_EXECUTION_ENV || null,
    nodeEnv: process.env.NODE_ENV || null,
    envKeyCount: allEnvKeys.length,
    appEnvKeys: appEnvKeys.sort(),
  };

  const config = {
    endpointHost: process.env.DSQL_ENDPOINT 
      ? process.env.DSQL_ENDPOINT.substring(0, 20) + '...' 
      : null,
    user: process.env.DSQL_USER || 'admin',
    region: process.env.DSQL_REGION || process.env.AWS_REGION || 'us-east-1',
  };

  if (process.env.USE_MOCK_DB === 'true') {
    return NextResponse.json({
      ok: true,
      mode: 'mock',
      message: 'Using mock database (USE_MOCK_DB=true)',
      latency: Date.now() - startTime,
      config,
      envFlags,
      timestamp: new Date().toISOString(),
    });
  }

  if (!process.env.DSQL_ENDPOINT) {
    return NextResponse.json({
      ok: false,
      error: 'DSQL_ENDPOINT not configured',
      config,
      envFlags,
      timestamp: new Date().toISOString(),
    }, { status: 503 });
  }

  try {
    const result = await testConnection();
    
    let subscriberCount: number | null = null;
    if (result.ok) {
      try {
        const { query } = await import('@/lib/db');
        const countResult = await query<{ count: string }>('SELECT count(*) as count FROM subscribers');
        subscriberCount = parseInt(countResult.rows[0]?.count || '0', 10);
      } catch {
        subscriberCount = null;
      }
    }
    
    return NextResponse.json({
      ok: result.ok,
      mode: 'dsql',
      error: result.error,
      latency: result.latency,
      subscriberCount,
      config,
      envFlags,
      timestamp: new Date().toISOString(),
    }, { status: result.ok ? 200 : 503 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorName = error instanceof Error ? error.name : 'Unknown';
    
    console.error('[API /db-health]', {
      error: errorName,
      message: errorMessage,
      stack: error instanceof Error ? error.stack?.split('\n').slice(0, 5).join('\n') : '',
      timestamp: new Date().toISOString(),
    });
    
    return NextResponse.json({
      ok: false,
      mode: 'dsql',
      error: errorMessage,
      errorType: errorName,
      latency: Date.now() - startTime,
      config,
      envFlags,
      timestamp: new Date().toISOString(),
    }, { status: 503 });
  }
}
