-- Liberty Surveys Initial Schema
-- Designed for Aurora DSQL (PostgreSQL-compatible, no foreign keys, no sequences)
-- Primary keys use ULIDs for distributed ID generation

-- ============================================================================
-- SUBSCRIBERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS subscribers (
  id VARCHAR(26) PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  confirmation_token VARCHAR(64),
  confirmation_expires_at TIMESTAMP WITH TIME ZONE,
  subscribed_at TIMESTAMP WITH TIME ZONE,
  unsubscribed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  CONSTRAINT subscribers_status_check CHECK (status IN ('pending', 'active', 'unsubscribed'))
);

CREATE INDEX IF NOT EXISTS idx_subscribers_email ON subscribers(email);
CREATE INDEX IF NOT EXISTS idx_subscribers_status ON subscribers(status);
CREATE INDEX IF NOT EXISTS idx_subscribers_confirmation_token ON subscribers(confirmation_token);

-- ============================================================================
-- POLLS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS polls (
  id VARCHAR(26) PRIMARY KEY,
  question TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  scheduled_for TIMESTAMP WITH TIME ZONE,
  published_at TIMESTAMP WITH TIME ZONE,
  closed_at TIMESTAMP WITH TIME ZONE,
  created_by VARCHAR(26),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  CONSTRAINT polls_status_check CHECK (status IN ('draft', 'scheduled', 'active', 'closed'))
);

CREATE INDEX IF NOT EXISTS idx_polls_status ON polls(status);
CREATE INDEX IF NOT EXISTS idx_polls_scheduled_for ON polls(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_polls_published_at ON polls(published_at);

-- ============================================================================
-- POLL OPTIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS poll_options (
  id VARCHAR(26) PRIMARY KEY,
  poll_id VARCHAR(26) NOT NULL,
  option_text VARCHAR(500) NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
  
  -- Note: Foreign key to polls(id) would be here, but DSQL doesn't support FK
  -- Application layer must enforce referential integrity
);

CREATE INDEX IF NOT EXISTS idx_poll_options_poll_id ON poll_options(poll_id);

-- ============================================================================
-- VOTES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS votes (
  id VARCHAR(26) PRIMARY KEY,
  poll_id VARCHAR(26) NOT NULL,
  option_id VARCHAR(26) NOT NULL,
  subscriber_id VARCHAR(26) NOT NULL,
  voted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Enforce one vote per subscriber per poll
  CONSTRAINT votes_unique_subscriber_poll UNIQUE(poll_id, subscriber_id)
  
  -- Note: Foreign keys to polls(id), poll_options(id), subscribers(id) would be here
  -- Application layer must enforce referential integrity
);

CREATE INDEX IF NOT EXISTS idx_votes_poll_id ON votes(poll_id);
CREATE INDEX IF NOT EXISTS idx_votes_option_id ON votes(option_id);
CREATE INDEX IF NOT EXISTS idx_votes_subscriber_id ON votes(subscriber_id);

-- ============================================================================
-- ADMIN USERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS admin_users (
  id VARCHAR(26) PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- SEED DATA (Sample polls for development - clearly marked as examples)
-- ============================================================================

-- Note: In production, remove or comment out this seed data section.
-- These are sample polls for development purposes only.

-- Sample admin user (password: "admin123" - CHANGE IN PRODUCTION)
-- Password hash generated with bcrypt, 12 rounds
INSERT INTO admin_users (id, email, password_hash, created_at)
VALUES (
  '01JARQVX0000000000000001',
  'admin@example.com',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4d4R6GmJfIqrGPzG', -- "admin123"
  NOW()
) ON CONFLICT (email) DO NOTHING;

-- Sample poll 1 (balanced, non-partisan example)
INSERT INTO polls (id, question, status, published_at, created_at, updated_at)
VALUES (
  '01JARQVX0000000000POLL01',
  '[SAMPLE] Should daylight saving time be made permanent year-round?',
  'active',
  NOW() - INTERVAL '1 day',
  NOW() - INTERVAL '1 day',
  NOW() - INTERVAL '1 day'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO poll_options (id, poll_id, option_text, display_order)
VALUES 
  ('01JARQVX000000000OPT0101', '01JARQVX0000000000POLL01', 'Yes, keep daylight saving time permanent', 1),
  ('01JARQVX000000000OPT0102', '01JARQVX0000000000POLL01', 'No, keep standard time permanent', 2),
  ('01JARQVX000000000OPT0103', '01JARQVX0000000000POLL01', 'Keep the current system of changing clocks', 3),
  ('01JARQVX000000000OPT0104', '01JARQVX0000000000POLL01', 'Undecided / No opinion', 4)
ON CONFLICT (id) DO NOTHING;

-- Sample poll 2 (archived example)
INSERT INTO polls (id, question, status, published_at, closed_at, created_at, updated_at)
VALUES (
  '01JARQVX0000000000POLL02',
  '[SAMPLE] Should Election Day be a federal holiday?',
  'closed',
  NOW() - INTERVAL '7 days',
  NOW() - INTERVAL '6 days',
  NOW() - INTERVAL '8 days',
  NOW() - INTERVAL '6 days'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO poll_options (id, poll_id, option_text, display_order)
VALUES 
  ('01JARQVX000000000OPT0201', '01JARQVX0000000000POLL02', 'Yes', 1),
  ('01JARQVX000000000OPT0202', '01JARQVX0000000000POLL02', 'No', 2),
  ('01JARQVX000000000OPT0203', '01JARQVX0000000000POLL02', 'Undecided', 3)
ON CONFLICT (id) DO NOTHING;

-- Sample votes for poll 2 (demonstration data)
INSERT INTO votes (id, poll_id, option_id, subscriber_id, voted_at)
VALUES 
  ('01JARQVX00000000VOTE0001', '01JARQVX0000000000POLL02', '01JARQVX000000000OPT0201', '01JARQVX000000000SUB0001', NOW() - INTERVAL '7 days'),
  ('01JARQVX00000000VOTE0002', '01JARQVX0000000000POLL02', '01JARQVX000000000OPT0201', '01JARQVX000000000SUB0002', NOW() - INTERVAL '7 days'),
  ('01JARQVX00000000VOTE0003', '01JARQVX0000000000POLL02', '01JARQVX000000000OPT0202', '01JARQVX000000000SUB0003', NOW() - INTERVAL '7 days'),
  ('01JARQVX00000000VOTE0004', '01JARQVX0000000000POLL02', '01JARQVX000000000OPT0201', '01JARQVX000000000SUB0004', NOW() - INTERVAL '6 days'),
  ('01JARQVX00000000VOTE0005', '01JARQVX0000000000POLL02', '01JARQVX000000000OPT0203', '01JARQVX000000000SUB0005', NOW() - INTERVAL '6 days')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- NOTES FOR PRODUCTION
-- ============================================================================
-- 1. Remove all sample/seed data above before deploying to production
-- 2. Create admin user via secure process, not SQL migration
-- 3. Configure appropriate SSL/TLS for Aurora DSQL connections
-- 4. Set up appropriate IAM roles for database access
-- 5. Consider adding audit columns or tables for compliance
