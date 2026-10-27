#!/usr/bin/env npx tsx

import { sendNightlyRecap, getRecapPreview } from '../src/lib/recap-sender';

async function main() {
  console.log('='.repeat(60));
  console.log('Liberty Surveys - Nightly Recap Email');
  console.log('='.repeat(60));
  console.log('');
  
  const previewOnly = process.argv.includes('--preview');
  const minVotesArg = process.argv.find(arg => arg.startsWith('--min-votes='));
  const minVotes = minVotesArg ? parseInt(minVotesArg.split('=')[1], 10) : undefined;
  
  if (previewOnly) {
    console.log('Mode: Preview only (no email will be sent)');
    console.log('');
    
    const preview = await getRecapPreview();
    
    if (!preview) {
      console.log('No active poll found for recap preview.');
      process.exit(0);
    }
    
    console.log('Recap Preview:');
    console.log('');
    console.log(`Question: ${preview.question}`);
    console.log('');
    console.log('Results:');
    preview.options.forEach(opt => {
      const bar = '█'.repeat(Math.floor(opt.percentage / 5)) + '░'.repeat(20 - Math.floor(opt.percentage / 5));
      console.log(`  ${opt.optionText}`);
      console.log(`  ${bar} ${opt.percentage}%`);
      console.log('');
    });
    
    if (preview.briefingExcerpt) {
      console.log('Briefing Excerpt:');
      console.log(`  ${preview.briefingExcerpt}`);
      console.log('');
    }
    
    console.log(`Results URL: ${preview.resultsUrl}`);
    
    process.exit(0);
  }
  
  console.log('Mode: Send recap email');
  if (minVotes !== undefined) {
    console.log(`Minimum votes threshold: ${minVotes}`);
  }
  console.log('');
  
  try {
    const result = await sendNightlyRecap({ minVotes });
    
    console.log('');
    console.log('='.repeat(60));
    console.log('RESULT');
    console.log('='.repeat(60));
    
    if (result.success) {
      if (result.skipped) {
        console.log('Status: SKIPPED');
        console.log(`Reason: ${result.skipReason}`);
      } else {
        console.log('Status: SENT');
        console.log(`Recap ID: ${result.recapId}`);
        if (result.subscriberCount !== undefined) {
          console.log(`Subscribers: ${result.subscriberCount}`);
        }
      }
    } else {
      console.log('Status: FAILED');
      console.log(`Recap ID: ${result.recapId}`);
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
