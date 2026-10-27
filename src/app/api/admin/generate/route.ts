import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { runPollGeneration, runScheduledGeneration } from '@/lib/poll-generator';
import { invokeGenerationLambdaAsync, isAsyncGenerationEnabled } from '@/lib/lambda';

export async function POST(request: NextRequest) {
  try {
    const isScheduledJob = request.headers.get('x-scheduled-job') === 'true';
    const schedulerSecret = request.headers.get('x-scheduler-secret');
    const expectedSecret = process.env.SCHEDULER_SECRET;
    
    if (isScheduledJob) {
      if (expectedSecret && schedulerSecret !== expectedSecret) {
        return NextResponse.json(
          { error: 'Invalid scheduler secret' },
          { status: 401 }
        );
      }
    } else {
      const session = await getSession();
      if (!session) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }
    
    const body = await request.json().catch(() => ({}));
    const forceNew = body.forceNew === true;
    // Allow explicit sync mode via query param or body (useful for testing)
    const forceSync = body.sync === true || request.nextUrl.searchParams.get('sync') === 'true';
    
    console.log(`[API] Poll generation triggered (scheduled: ${isScheduledJob}, forceNew: ${forceNew}, forceSync: ${forceSync})`);
    
    // Use async Lambda invocation if enabled (production mode)
    // This returns 202 immediately while Lambda runs generation in background
    if (isAsyncGenerationEnabled() && !forceSync) {
      console.log('[API] Async mode enabled, invoking Lambda...');
      
      const invokeResult = await invokeGenerationLambdaAsync({
        forceNew,
        schedulerSecret: schedulerSecret || undefined,
      });
      
      if (invokeResult.invoked) {
        return NextResponse.json({
          accepted: true,
          message: 'Poll generation started asynchronously',
          requestId: invokeResult.requestId,
        }, { status: 202 });
      }
      
      // If Lambda invocation failed, log and fall through to sync mode
      console.warn('[API] Lambda invocation failed, falling back to sync mode:', invokeResult.error);
    }
    
    // Sync mode: run generation inline (for local dev or when Lambda not configured)
    console.log('[API] Running generation synchronously...');
    
    let result;
    
    if (forceNew) {
      result = await runPollGeneration();
    } else {
      result = await runScheduledGeneration();
    }
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        runId: result.runId,
        usedFallback: result.usedFallback || false,
        poll: result.poll ? {
          question: result.poll.question,
          optionCount: result.poll.options.length,
          topicSummary: result.poll.topicSummary,
        } : undefined,
        biasCheck: result.biasCheck ? {
          overallScore: result.biasCheck.overallScore,
          passesThreshold: result.biasCheck.passesThreshold,
        } : undefined,
      });
    } else {
      return NextResponse.json({
        success: false,
        runId: result.runId,
        error: result.error,
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('[API] Generation error:', error);
    return NextResponse.json(
      { error: 'Generation failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function GET() {
  const session = await getSession();
  
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  return NextResponse.json({
    message: 'Poll generation endpoint',
    asyncEnabled: isAsyncGenerationEnabled(),
    usage: {
      method: 'POST',
      body: {
        forceNew: 'boolean - force a new generation even if one exists for today',
        sync: 'boolean - force synchronous execution (skip Lambda, run inline)',
      },
      queryParams: {
        sync: 'true - same as body.sync',
      },
      headers: {
        'x-scheduled-job': 'true - for EventBridge scheduled jobs',
        'x-scheduler-secret': 'secret - required for scheduled jobs if SCHEDULER_SECRET is set',
      },
      responses: {
        '200': 'Sync mode: generation completed inline',
        '202': 'Async mode: generation started in background Lambda',
        '401': 'Unauthorized (missing session or invalid scheduler secret)',
        '500': 'Generation failed',
      },
    },
  });
}
