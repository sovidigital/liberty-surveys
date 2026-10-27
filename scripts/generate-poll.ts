#!/usr/bin/env npx tsx

import { runPollGeneration } from '../src/lib/poll-generator';

async function main() {
  console.log('='.repeat(60));
  console.log('Liberty Surveys - Manual Poll Generation');
  console.log('='.repeat(60));
  console.log('');
  
  const forceNew = process.argv.includes('--force');
  
  if (forceNew) {
    console.log('Mode: Force new generation (ignoring existing polls for today)');
  } else {
    console.log('Mode: Standard generation');
  }
  
  console.log('');
  console.log('Starting generation...');
  console.log('');
  
  try {
    const result = await runPollGeneration();
    
    console.log('');
    console.log('='.repeat(60));
    console.log('RESULT');
    console.log('='.repeat(60));
    
    if (result.success) {
      console.log('Status: SUCCESS');
      console.log(`Run ID: ${result.runId}`);
      
      if (result.usedFallback) {
        console.log('Note: Used evergreen fallback poll');
      }
      
      if (result.poll) {
        console.log('');
        console.log('Generated Poll:');
        console.log(`  Question: ${result.poll.question}`);
        console.log(`  Options: ${result.poll.options.length}`);
        result.poll.options.forEach((opt, i) => {
          console.log(`    ${i + 1}. ${opt.text}`);
        });
        console.log('');
        console.log(`  Topic: ${result.poll.topicSummary}`);
      }
      
      if (result.biasCheck) {
        console.log('');
        console.log('Bias Check:');
        console.log(`  Overall Score: ${(result.biasCheck.overallScore * 100).toFixed(1)}%`);
        console.log(`  Passes Threshold: ${result.biasCheck.passesThreshold ? 'YES' : 'NO'}`);
        
        if (result.biasCheck.issues.length > 0) {
          console.log('  Issues:');
          result.biasCheck.issues.forEach(issue => {
            console.log(`    - ${issue}`);
          });
        }
      }
    } else {
      console.log('Status: FAILED');
      console.log(`Run ID: ${result.runId}`);
      console.log(`Error: ${result.error}`);
    }
    
    console.log('');
    console.log('='.repeat(60));
    
    process.exit(result.success ? 0 : 1);
    
  } catch (error) {
    console.error('');
    console.error('FATAL ERROR:', error);
    process.exit(1);
  }
}

main();
