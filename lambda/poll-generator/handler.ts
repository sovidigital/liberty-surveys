/**
 * Lambda handler for async poll generation
 * 
 * This Lambda is invoked asynchronously by the Amplify API route
 * to run the poll generation pipeline without blocking the HTTP response.
 * 
 * Environment variables required:
 * - DSQL_ENDPOINT: Aurora DSQL endpoint
 * - DSQL_REGION: AWS region for DSQL (default: us-east-1)
 * - DSQL_USER: Database user (default: admin)
 * - XAI_API_KEY: xAI API key for Grok
 * - XAI_MODEL: Model to use (default: grok-4.7)
 * - LLM_TIMEOUT_MS: Timeout for LLM calls in ms (default: 15000)
 * - NEWS_API_KEY: (optional) NewsAPI key
 */

import { Context } from 'aws-lambda';

interface GenerationEvent {
  forceNew?: boolean;
  schedulerSecret?: string;
  runId?: string;
}

interface GenerationResponse {
  success: boolean;
  runId?: string;
  pollId?: string;
  usedFallback?: boolean;
  error?: string;
}

export async function handler(
  event: GenerationEvent,
  context: Context
): Promise<GenerationResponse> {
  console.log('[LAMBDA] Poll generation invoked', {
    forceNew: event.forceNew,
    requestId: context.awsRequestId,
    remainingTimeMs: context.getRemainingTimeInMillis(),
  });

  try {
    // Dynamic import to allow bundling
    const { runPollGeneration, runScheduledGeneration } = await import('./generator');

    let result;
    if (event.forceNew) {
      result = await runPollGeneration();
    } else {
      result = await runScheduledGeneration();
    }

    console.log('[LAMBDA] Generation completed', {
      success: result.success,
      runId: result.runId,
      usedFallback: result.usedFallback,
    });

    return {
      success: result.success,
      runId: result.runId,
      pollId: result.poll ? undefined : undefined, // Poll ID is in generation_runs
      usedFallback: result.usedFallback || false,
      error: result.error,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[LAMBDA] Fatal error:', errorMessage);

    return {
      success: false,
      error: errorMessage,
    };
  }
}
