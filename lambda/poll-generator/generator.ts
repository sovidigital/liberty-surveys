/**
 * Re-export poll generator functions for Lambda bundling
 * 
 * This file imports from the main src directory and re-exports
 * for the Lambda handler. esbuild will bundle everything together.
 */

// Re-export the main generation functions
export { runPollGeneration, runScheduledGeneration } from '../../src/lib/poll-generator';
