-- Liberty Surveys - Automated Poll Generation Schema
-- Migration 002: Add tables for briefing content, sources, and generation logs
-- Designed for Aurora DSQL (no foreign keys, no JSONB)

-- ============================================================================
-- EXTEND POLLS TABLE
-- ============================================================================
-- Add briefing content columns to polls table
ALTER TABLE polls ADD COLUMN IF NOT EXISTS briefing_background TEXT;
ALTER TABLE polls ADD COLUMN IF NOT EXISTS briefing_conservative TEXT;
ALTER TABLE polls ADD COLUMN IF NOT EXISTS briefing_liberal TEXT;
ALTER TABLE polls ADD COLUMN IF NOT EXISTS briefing_centrist TEXT;
ALTER TABLE polls ADD COLUMN IF NOT EXISTS generation_run_id VARCHAR(26);
ALTER TABLE polls ADD COLUMN IF NOT EXISTS is_auto_generated BOOLEAN DEFAULT FALSE;

-- ============================================================================
-- POLL SOURCES TABLE
-- ============================================================================
-- Stores cited sources for each poll's briefing
CREATE TABLE IF NOT EXISTS poll_sources (
  id VARCHAR(26) PRIMARY KEY,
  poll_id VARCHAR(26) NOT NULL,
  source_name VARCHAR(255) NOT NULL,
  source_url TEXT NOT NULL,
  article_title TEXT,
  article_snippet TEXT,
  political_lean VARCHAR(20),
  perspective_used VARCHAR(20),
  fetched_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  CONSTRAINT poll_sources_lean_check CHECK (political_lean IN ('left', 'center-left', 'center', 'center-right', 'right')),
  CONSTRAINT poll_sources_perspective_check CHECK (perspective_used IN ('background', 'conservative', 'liberal', 'centrist'))
);

CREATE INDEX IF NOT EXISTS idx_poll_sources_poll_id ON poll_sources(poll_id);

-- ============================================================================
-- GENERATION RUNS TABLE
-- ============================================================================
-- Logs every automated generation run for debugging and audit
CREATE TABLE IF NOT EXISTS generation_runs (
  id VARCHAR(26) PRIMARY KEY,
  run_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  
  -- Topic selection
  selected_topic TEXT,
  topic_reason TEXT,
  candidate_topics_json TEXT,
  recent_topics_avoided TEXT,
  
  -- News fetching
  news_sources_queried TEXT,
  articles_fetched_count INT DEFAULT 0,
  articles_used_count INT DEFAULT 0,
  
  -- Generation
  generated_poll_id VARCHAR(26),
  model_used VARCHAR(100),
  generation_prompt_hash VARCHAR(64),
  
  -- Quality scores (0.00 to 1.00)
  bias_score DECIMAL(5,2),
  balance_score DECIMAL(5,2),
  citation_validity_score DECIMAL(5,2),
  
  -- Retries and fallback
  retry_count INT DEFAULT 0,
  used_fallback BOOLEAN DEFAULT FALSE,
  fallback_reason TEXT,
  
  -- Debugging
  error_message TEXT,
  raw_llm_input TEXT,
  raw_llm_output TEXT,
  bias_check_output TEXT,
  
  -- Timing
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  CONSTRAINT generation_runs_status_check CHECK (status IN ('pending', 'fetching_news', 'selecting_topic', 'generating', 'validating', 'success', 'failed', 'fallback'))
);

CREATE INDEX IF NOT EXISTS idx_generation_runs_date ON generation_runs(run_date);
CREATE INDEX IF NOT EXISTS idx_generation_runs_status ON generation_runs(status);

-- ============================================================================
-- FETCHED ARTICLES TABLE
-- ============================================================================
-- Stores raw articles fetched for a generation run (for audit/debugging)
CREATE TABLE IF NOT EXISTS fetched_articles (
  id VARCHAR(26) PRIMARY KEY,
  generation_run_id VARCHAR(26) NOT NULL,
  source_name VARCHAR(255) NOT NULL,
  source_url TEXT NOT NULL,
  article_title TEXT NOT NULL,
  article_description TEXT,
  article_content TEXT,
  published_at TIMESTAMP WITH TIME ZONE,
  political_lean VARCHAR(20),
  topic_cluster VARCHAR(100),
  relevance_score DECIMAL(5,2),
  fetched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  CONSTRAINT fetched_articles_lean_check CHECK (political_lean IN ('left', 'center-left', 'center', 'center-right', 'right'))
);

CREATE INDEX IF NOT EXISTS idx_fetched_articles_run_id ON fetched_articles(generation_run_id);
CREATE INDEX IF NOT EXISTS idx_fetched_articles_topic ON fetched_articles(topic_cluster);

-- ============================================================================
-- EVERGREEN BACKUP POLLS TABLE
-- ============================================================================
-- Pre-written fallback polls for when generation fails
CREATE TABLE IF NOT EXISTS evergreen_polls (
  id VARCHAR(26) PRIMARY KEY,
  question TEXT NOT NULL,
  options_json TEXT NOT NULL,
  briefing_background TEXT,
  briefing_conservative TEXT,
  briefing_liberal TEXT,
  briefing_centrist TEXT,
  category VARCHAR(50),
  last_used_at TIMESTAMP WITH TIME ZONE,
  use_count INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- SEED EVERGREEN POLLS (fallback content)
-- ============================================================================
INSERT INTO evergreen_polls (id, question, options_json, briefing_background, briefing_conservative, briefing_liberal, briefing_centrist, category)
VALUES 
(
  '01EVERGREEN00000000001',
  'Should there be term limits for members of Congress?',
  '[{"text":"Yes, strict term limits (e.g., 12 years max)"},{"text":"Yes, but with longer limits (e.g., 18-24 years)"},{"text":"No, voters should decide through elections"},{"text":"Undecided"}]',
  'Members of Congress currently have no term limits, unlike the President who is limited to two terms by the 22nd Amendment. Some representatives and senators have served for decades, with the longest-serving member having held office for over 50 years.',
  'Term limits would bring fresh perspectives and prevent career politicians from becoming entrenched in Washington. They would reduce the influence of special interests and encourage citizen legislators who remain connected to their constituents.',
  'Term limits would remove experienced legislators who understand complex policy issues. Voters already have the power to remove representatives through elections, and arbitrary limits reduce democratic choice.',
  'Term limits involve tradeoffs between fresh perspectives and institutional knowledge. Any reform should consider how to balance accountability with the benefits of legislative experience.',
  'governance'
),
(
  '01EVERGREEN00000000002',
  'Should Election Day be a federal holiday?',
  '[{"text":"Yes, make it a paid federal holiday"},{"text":"Yes, but keep it optional for employers"},{"text":"No, expand early/mail voting instead"},{"text":"No change needed"}]',
  'The United States holds federal elections on the first Tuesday after the first Monday in November. Unlike many democracies, Election Day is not a national holiday, though some states have made it a state holiday.',
  'Making Election Day a holiday could burden small businesses and may not increase turnout among hourly workers who would still need to work. Expanding early voting and absentee options is more practical.',
  'A federal holiday would remove barriers for working Americans who struggle to find time to vote. It would signal that democracy is a priority and could increase civic participation.',
  'Both approaches aim to increase voter access. The question is whether a holiday or expanded voting windows better achieves this goal while minimizing economic disruption.',
  'elections'
),
(
  '01EVERGREEN00000000003',
  'Should the federal minimum wage be increased?',
  '[{"text":"Yes, increase to $15/hour or more"},{"text":"Yes, but increase gradually over several years"},{"text":"No, leave it to states to decide"},{"text":"No, keep the current federal minimum"}]',
  'The federal minimum wage has been $7.25 per hour since 2009. Many states and cities have enacted higher minimum wages, with some reaching $15 or more. Economists debate the effects on employment and cost of living.',
  'Higher minimum wages can lead to job losses, reduced hours, and higher prices. Small businesses in low-cost areas are particularly affected. States should set wages based on local economic conditions.',
  'The current minimum wage has not kept pace with inflation or productivity gains. A higher wage would reduce poverty, increase consumer spending, and reduce reliance on government assistance programs.',
  'The optimal minimum wage likely varies by region. A moderate increase with geographic flexibility might balance the goals of worker welfare and employment while allowing for local economic differences.',
  'economy'
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- RECAP SENDS TABLE
-- ============================================================================
-- Logs nightly recap email sends
CREATE TABLE IF NOT EXISTS recap_sends (
  id VARCHAR(26) PRIMARY KEY,
  poll_id VARCHAR(26) NOT NULL,
  send_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  
  -- Vote counts at time of send (for audit, not shown in email)
  total_votes INT NOT NULL,
  vote_threshold INT NOT NULL,
  
  -- Results snapshot (percentages)
  results_snapshot_json TEXT NOT NULL,
  
  -- Customer.io details
  broadcast_campaign_id VARCHAR(100),
  subscribers_sent_to INT,
  
  -- Timing
  scheduled_for TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  
  -- Errors
  skipped BOOLEAN DEFAULT FALSE,
  skip_reason TEXT,
  error_message TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  CONSTRAINT recap_sends_status_check CHECK (status IN ('pending', 'sending', 'sent', 'skipped', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_recap_sends_poll_id ON recap_sends(poll_id);
CREATE INDEX IF NOT EXISTS idx_recap_sends_date ON recap_sends(send_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_recap_sends_poll_date ON recap_sends(poll_id, send_date);

-- ============================================================================
-- NOTES
-- ============================================================================
-- 1. All tables use ULIDs for primary keys (DSQL compatible)
-- 2. No foreign keys (DSQL limitation) - app enforces referential integrity
-- 3. JSON stored as TEXT (DSQL doesn't support JSONB)
-- 4. Scores are DECIMAL(5,2) for values 0.00 to 100.00 (or 0.00 to 1.00 scaled)
-- 5. Evergreen polls provide fallback content when generation fails
-- 6. recap_sends tracks nightly recap emails (8 PM ET default)
