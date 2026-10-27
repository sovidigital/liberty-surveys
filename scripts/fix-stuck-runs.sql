-- Liberty Surveys: Fix stuck generation_runs
-- Run this to mark any runs stuck in intermediate states as failed
-- 
-- Background: Before the async Lambda fix, runs could get stuck in
-- 'generating' or 'validating' status if the Amplify request timed out.
--
-- Usage: 
--   1. Connect to Aurora DSQL
--   2. Review the SELECT queries first to see what will be affected
--   3. Run the UPDATE statement to fix stuck runs

-- Preview: Find stuck runs (status not terminal, started > 10 minutes ago)
SELECT 
  id,
  run_date,
  status,
  selected_topic,
  started_at,
  NOW() - started_at AS age,
  error_message
FROM generation_runs
WHERE status NOT IN ('success', 'failed', 'fallback')
  AND started_at < NOW() - INTERVAL '10 minutes'
ORDER BY started_at DESC;

-- Preview: Specifically the run mentioned in the issue
SELECT 
  id,
  run_date,
  status,
  selected_topic,
  articles_fetched_count,
  articles_used_count,
  retry_count,
  error_message,
  started_at
FROM generation_runs
WHERE id = '01M5Z6ZRZMYCS8J3SHM2CBQ3KB';

-- Fix: Mark stuck runs as failed
-- Uncomment and run this after reviewing the preview
/*
UPDATE generation_runs
SET 
  status = 'failed',
  error_message = COALESCE(error_message, '') || 
    CASE WHEN error_message IS NULL THEN '' ELSE '; ' END ||
    'Marked as failed by cleanup script: stuck in ''' || status || ''' status for > 10 minutes (likely Amplify 504 timeout)',
  completed_at = NOW()
WHERE status NOT IN ('success', 'failed', 'fallback')
  AND started_at < NOW() - INTERVAL '10 minutes';
*/

-- One-shot fix for the specific stuck run (01M5Z6ZRZMYCS8J3SHM2CBQ3KB)
-- Uncomment and run if you want to fix just this one run
/*
UPDATE generation_runs
SET 
  status = 'failed',
  error_message = 'Marked failed: Amplify 504 timeout killed run mid-LLM-call on 2026-10-27',
  completed_at = NOW()
WHERE id = '01M5Z6ZRZMYCS8J3SHM2CBQ3KB';
*/
