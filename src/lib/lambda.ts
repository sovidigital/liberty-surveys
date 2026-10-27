/**
 * Lambda invocation client for async poll generation
 */

import { LambdaClient, InvokeCommand, InvocationType } from '@aws-sdk/client-lambda';

const LAMBDA_FUNCTION_NAME = process.env.POLL_GENERATOR_LAMBDA_NAME || 'liberty-surveys-poll-generator';
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

let lambdaClient: LambdaClient | null = null;

function getClient(): LambdaClient {
  if (!lambdaClient) {
    lambdaClient = new LambdaClient({
      region: AWS_REGION,
    });
  }
  return lambdaClient;
}

export interface AsyncGenerationPayload {
  forceNew?: boolean;
  schedulerSecret?: string;
}

/**
 * Invoke the poll generation Lambda asynchronously.
 * Returns immediately after queueing the invocation.
 */
export async function invokeGenerationLambdaAsync(
  payload: AsyncGenerationPayload
): Promise<{ invoked: boolean; requestId?: string; error?: string }> {
  const functionName = LAMBDA_FUNCTION_NAME;
  
  console.log(`[LAMBDA-CLIENT] Invoking ${functionName} async with payload:`, JSON.stringify(payload));
  
  try {
    const client = getClient();
    const command = new InvokeCommand({
      FunctionName: functionName,
      InvocationType: InvocationType.Event, // Async invocation
      Payload: Buffer.from(JSON.stringify(payload)),
    });

    const response = await client.send(command);
    
    // For async invocation, StatusCode 202 means accepted
    if (response.StatusCode === 202) {
      console.log(`[LAMBDA-CLIENT] Successfully queued async invocation`);
      return {
        invoked: true,
        requestId: response.$metadata.requestId,
      };
    }

    console.warn(`[LAMBDA-CLIENT] Unexpected status code: ${response.StatusCode}`);
    return {
      invoked: false,
      error: `Unexpected status code: ${response.StatusCode}`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[LAMBDA-CLIENT] Failed to invoke Lambda:`, errorMessage);
    
    return {
      invoked: false,
      error: errorMessage,
    };
  }
}

/**
 * Check if async Lambda invocation is enabled.
 * Falls back to sync mode if POLL_GENERATOR_LAMBDA_NAME is not set.
 */
export function isAsyncGenerationEnabled(): boolean {
  return !!process.env.POLL_GENERATOR_LAMBDA_NAME;
}
