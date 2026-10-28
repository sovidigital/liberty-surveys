# Liberty Surveys - Product Plan

## Overview

Liberty Surveys is a daily political polling platform that engages subscribers through email-based voting on current events. Subscribers receive a daily email with a poll question, vote with a single click, and can view results and historical polls on the website.

### Key Value Propositions
- **Frictionless voting**: One-click voting directly from email (no login required)
- **Daily engagement**: Consistent touchpoint with subscribers through timely political polls
- **Transparency**: Open results visible to all visitors
- **Archive**: Historical record of polls and public sentiment over time

---

## Core User Flows

### 1. Sign-Up Flow (Double Opt-In)

```
Landing Page → Enter Email → Confirmation Email → Click Confirm Link → Subscribed
```

**Steps:**
1. User visits landing page, enters email address
2. System creates subscriber record in Aurora DSQL with `status: 'pending'`
3. System calls Customer.io Track API to identify the subscriber
4. Customer.io triggers a "confirm subscription" transactional email with a signed confirmation link
5. User clicks confirmation link
6. System verifies signature, updates subscriber status to `active`
7. System sends Customer.io event `subscription_confirmed`
8. Welcome email is triggered via Customer.io automation

**Anti-abuse:**
- Rate limit subscription attempts by IP (10/hour)
- Confirmation links expire after 24 hours
- HMAC-signed confirmation tokens prevent tampering

### 2. Daily Poll Email Flow

```
Scheduled Job → Fetch Active Poll → Customer.io Broadcast → Subscribers Receive Email
```

**Steps:**
1. Admin creates poll with question and options (2-4 choices)
2. Admin schedules poll for a specific date
3. At scheduled time (7:00 AM ET daily), system triggers Customer.io API-triggered broadcast
4. Broadcast includes poll question and signed vote links for each option
5. Each vote link contains: `poll_id`, `option_id`, `subscriber_id`, HMAC signature

**Email Content:**
- Poll question as headline
- 2-4 clickable buttons (one per option)
- Each button is a signed vote URL
- Footer with unsubscribe link

### 3. One-Click Voting Flow

```
Click Vote Link → Verify Signature → Check Duplicate → Record Vote → Redirect to Results
```

**Steps:**
1. Subscriber clicks vote option in email
2. System extracts and verifies HMAC signature from URL
3. System checks if subscriber already voted on this poll
4. If new vote: record vote in Aurora DSQL, send Customer.io event `poll_voted`
5. Redirect to results page for that poll
6. If duplicate: redirect to results with "already voted" message

**Signed Vote Token Structure:**
```
/vote?p={poll_id}&o={option_id}&s={subscriber_id}&sig={hmac_sha256}
```

**Anti-abuse:**
- One vote per subscriber per poll (enforced at DB level)
- Signatures expire after poll closes
- Invalid signatures return 400 error

### 4. Results Page Flow

```
Visit Results → Show Current Poll Results → Option to Browse Archive
```

**Content:**
- Current/latest poll question
- Bar chart showing vote distribution (percentages and counts)
- Total votes cast
- Link to full archive

### 5. Archive Page Flow

```
Visit Archive → Browse Past Polls → Click to View Results
```

**Content:**
- Paginated list of past polls (newest first)
- Each entry shows: question, date, total votes
- Click through to individual results page

**Visibility:**
- Only polls with sufficient engagement appear in the archive (default: 10 votes, configurable via `ARCHIVE_MIN_VOTES`)
- Low-vote polls are hidden from the public archive to maintain quality, but individual poll result URLs still work via direct link

### 6. Unsubscribe Flow

```
Click Unsubscribe → Verify Token → Update Status → Confirmation Page
```

**Steps:**
1. User clicks unsubscribe link in email footer
2. System verifies signed unsubscribe token
3. System updates subscriber status to `unsubscribed` in Aurora DSQL
4. System sends Customer.io event `unsubscribed`
5. Customer.io updates profile, stops future emails
6. Display confirmation page

---

## Automated Poll Generation (Core MVP Feature)

Liberty Surveys uses a fully automated pipeline to generate daily polls with no human intervention required. The system fetches current news, selects the best political topic, generates a balanced poll question with multiple perspectives, and validates the output before publishing.

### Pipeline Overview

```
5:00 AM ET: News Fetching → Topic Selection → Poll Generation → Bias Check → Save to DB
7:00 AM ET: Publish Poll → Trigger Daily Email Broadcast
8:00 PM ET: Send Nightly Recap Email with Results (percentages only)
```

### News Fetching

**Primary Source: RSS Feeds**
News is aggregated from 22+ politically balanced RSS feeds covering the full spectrum:

| Political Lean | Sources |
|----------------|---------|
| Left | CNN, The Guardian, MSNBC |
| Center-Left | NYT, Washington Post, NPR, Politico |
| Center | AP, Reuters, BBC, The Hill, Axios, PBS |
| Center-Right | WSJ, The Economist, RealClearPolitics |
| Right | Fox News, NY Post, National Review, Daily Wire, Washington Examiner, The Federalist |

**Supplementary: xAI Web Search**
- When RSS coverage is thin, xAI's `web_search` tool finds additional articles
- All search results are verified by fetching the URL and extracting content
- Every cited fact must map to a real, verified article URL

**Configuration:**
- `USE_MOCK_NEWS=true` - Use mock data for local development
- `NEWS_SOURCES_JSON` - Optional: Custom RSS sources as JSON array

### Topic Selection

The system clusters articles by topic and ranks them:

1. **Prominence Score**: Number of articles × number of unique sources
2. **Coverage Breadth**: Articles from left, center, AND right perspectives (minimum 2 of 3)
3. **Debatability Score**: Topics with genuine disagreement across perspectives
4. **Recent Topic Avoidance**: Skip topics covered in polls from the last 7 days

Topics must have at least 4 articles with coverage from multiple political perspectives.

### LLM Generation (xAI Grok API)

**Model Configuration:**
- Primary: Grok 4.7 (`grok-4.7`) - 500k context, $2/1M input, $6/1M output
- Bias Check: Grok 4.7 with low reasoning effort (same model, reduced tokens)
- Both configurable via environment variables (`XAI_MODEL`, `XAI_BIAS_CHECK_MODEL`)
- API endpoint: `https://api.x.ai/v1/responses` (OpenAI-compatible)

**Live Search for Supplementation**
When RSS feeds don't provide enough coverage for a topic, xAI's `web_search` tool automatically supplements with additional articles. All search results are verified by fetching the URL to confirm the article exists and extract its content. Every cited fact must map to a real, verified article URL.

**Generation Output (Structured JSON):**
```json
{
  "question": "Should Congress pass the proposed infrastructure bill?",
  "options": [
    {"text": "Yes, pass it as proposed"},
    {"text": "Yes, but with modifications"},
    {"text": "No, reject the proposal"},
    {"text": "Undecided / Need more information"}
  ],
  "briefing": {
    "background": "Neutral factual context (2-3 sentences)",
    "conservative": "Conservative perspective (2-3 sentences)",
    "liberal": "Liberal perspective (2-3 sentences)",
    "centrist": "Centrist/independent perspective (2-3 sentences)"
  },
  "sources": [
    {
      "sourceName": "Associated Press",
      "sourceUrl": "https://...",
      "articleTitle": "...",
      "snippet": "Relevant quote from article",
      "politicalLean": "center",
      "usedForPerspective": "background"
    }
  ],
  "topicSummary": "Why this topic was selected"
}
```

**Requirements:**
- 2-4 balanced, non-leading answer options
- Every factual claim must cite a source article
- Sources must match URLs from fetched articles

### Quality Guardrails

**1. Citation Validation**
- Every source URL must exist in fetched articles
- Minimum 50% valid citations required
- Regenerate if validation fails

**2. Bias Check (Second LLM Pass)**
- Question bias score (0-1): Is wording neutral?
- Option balance score (0-1): Are options fair?
- Perspective balance score (0-1): Are all views represented?
- Overall threshold: ≥0.7 with no dimension below 0.5

**3. Retry Logic**
- Up to 3 generation attempts per run
- Each retry uses the same topic with fresh generation

**4. Fallback System**
- If all retries fail, use an evergreen backup poll
- Pre-written polls stored in `evergreen_polls` table
- Covers timeless political topics (term limits, voting, etc.)
- Marked as fallback in logs

**5. Logging**
- Every run logged to `generation_runs` table
- Includes: articles fetched, topic selected, LLM inputs/outputs
- Bias scores, retry count, success/failure status

### Nightly Recap Email

At 8:00 PM ET (configurable), send results summary to all active subscribers.

**Content:**
- Poll question
- Percentage for each option (rounded, no vote counts)
- Visual percentage bars
- Brief excerpt from background briefing
- Link to full results page

**Skip Conditions:**
- No active poll for today
- Recap already sent for this poll
- Fewer than minimum votes (default: 10, configurable via `RECAP_MIN_VOTES`)

### Schedule Configuration (EventBridge Scheduler)

| Job | Time | Cron Expression | Timezone |
|-----|------|-----------------|----------|
| Poll Generation | 5:00 AM | `cron(0 5 * * ? *)` | America/New_York |
| Daily Poll Send | 7:00 AM | `cron(0 7 * * ? *)` | America/New_York |
| Nightly Recap | 8:00 PM | `cron(0 20 * * ? *)` | America/New_York |
| Close Previous Poll | 7:00 AM | (same job as send) | America/New_York |

### API Endpoints

| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `/api/admin/generate` | POST | Trigger poll generation | Admin or Scheduler |
| `/api/admin/recap` | POST | Trigger recap email | Admin or Scheduler |
| `/api/admin/recap` | GET | Preview recap content | Admin |

**Scheduler Authentication:**
- Set `x-scheduled-job: true` header
- Include `x-scheduler-secret` header matching `SCHEDULER_SECRET` env var

### Manual Execution

```bash
# Generate a poll (mock mode with USE_MOCK_DB=true)
npm run generate

# Force new generation even if today's poll exists
npm run generate:force

# Preview recap email content
npm run recap:preview

# Send recap email
npm run recap
```

### Estimated Monthly Costs

| Service | Cost | Notes |
|---------|------|-------|
| RSS Feeds | Free | Public feeds from news outlets |
| xAI Grok API | $30-80/month | Polls + web search, grok-4.7 at $2/1M in, $6/1M out |
| Aurora DSQL | Pay-per-use | Depends on traffic |
| Amplify Hosting | Pay-per-use | Depends on traffic |

### Environment Variables

```bash
# xAI Grok API (for poll generation AND web search)
XAI_API_KEY=your_xai_api_key
XAI_MODEL=grok-4.7
XAI_BIAS_CHECK_MODEL=grok-4.7
USE_MOCK_LLM=false

# News Sources
USE_MOCK_NEWS=false
# Optional: Custom sources as JSON array
# NEWS_SOURCES_JSON=[{"name":"...","domain":"...","politicalLean":"center","rssUrl":"..."}]

# Nightly Recap
RECAP_MIN_VOTES=10
CUSTOMERIO_RECAP_CAMPAIGN_ID=your_campaign_id

# Archive
ARCHIVE_MIN_VOTES=10

# Scheduler Security
SCHEDULER_SECRET=your_secret
```

### xAI API Setup

1. **Get API Key**: Go to https://console.x.ai and create an account
2. **Generate Key**: In the Console, create a new API key
3. **Set Environment Variable**: `XAI_API_KEY=your_key_here`
4. **Capabilities Used**: 
   - Poll generation with grok-4.7
   - Bias checking with low reasoning
   - Web search for supplementing RSS feeds
5. **Verify**: Run `npm run generate` in mock news mode to test the integration

---

## Data Model (Aurora DSQL)

### Design Considerations for DSQL

Aurora DSQL has these constraints that affect schema design:
- **No foreign keys**: Referential integrity must be enforced at application level
- **No sequences/serial**: Use UUIDs or ULIDs for primary keys
- **Limited extensions**: Design without relying on specialized extensions
- **PostgreSQL-compatible syntax**: Standard SQL works

### Tables

#### `subscribers`
```sql
CREATE TABLE subscribers (
  id VARCHAR(26) PRIMARY KEY,              -- ULID
  email VARCHAR(255) NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending, active, unsubscribed
  confirmation_token VARCHAR(64),
  confirmation_expires_at TIMESTAMP WITH TIME ZONE,
  subscribed_at TIMESTAMP WITH TIME ZONE,
  unsubscribed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subscribers_email ON subscribers(email);
CREATE INDEX idx_subscribers_status ON subscribers(status);
CREATE INDEX idx_subscribers_confirmation_token ON subscribers(confirmation_token);
```

#### `polls`
```sql
CREATE TABLE polls (
  id VARCHAR(26) PRIMARY KEY,              -- ULID
  question TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',  -- draft, scheduled, active, closed
  scheduled_for TIMESTAMP WITH TIME ZONE,
  published_at TIMESTAMP WITH TIME ZONE,
  closed_at TIMESTAMP WITH TIME ZONE,
  created_by VARCHAR(26),                  -- admin user id (nullable for MVP)
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_polls_status ON polls(status);
CREATE INDEX idx_polls_scheduled_for ON polls(scheduled_for);
CREATE INDEX idx_polls_published_at ON polls(published_at);
```

#### `poll_options`
```sql
CREATE TABLE poll_options (
  id VARCHAR(26) PRIMARY KEY,              -- ULID
  poll_id VARCHAR(26) NOT NULL,            -- references polls(id)
  option_text VARCHAR(500) NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_poll_options_poll_id ON poll_options(poll_id);
```

#### `votes`
```sql
CREATE TABLE votes (
  id VARCHAR(26) PRIMARY KEY,              -- ULID
  poll_id VARCHAR(26) NOT NULL,            -- references polls(id)
  option_id VARCHAR(26) NOT NULL,          -- references poll_options(id)
  subscriber_id VARCHAR(26) NOT NULL,      -- references subscribers(id)
  voted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(poll_id, subscriber_id)           -- one vote per subscriber per poll
);

CREATE INDEX idx_votes_poll_id ON votes(poll_id);
CREATE INDEX idx_votes_option_id ON votes(option_id);
CREATE INDEX idx_votes_subscriber_id ON votes(subscriber_id);
```

#### `admin_users` (MVP stub)
```sql
CREATE TABLE admin_users (
  id VARCHAR(26) PRIMARY KEY,              -- ULID
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

#### `poll_sources` (Automated Generation)
```sql
CREATE TABLE poll_sources (
  id VARCHAR(26) PRIMARY KEY,              -- ULID
  poll_id VARCHAR(26) NOT NULL,            -- references polls(id)
  source_name VARCHAR(255) NOT NULL,       -- e.g. "Associated Press"
  source_url TEXT NOT NULL,                -- article URL
  article_title TEXT,
  article_snippet TEXT,                    -- relevant quote
  political_lean VARCHAR(20),              -- left, center-left, center, center-right, right
  perspective_used VARCHAR(20),            -- background, conservative, liberal, centrist
  fetched_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_poll_sources_poll_id ON poll_sources(poll_id);
```

#### `generation_runs` (Automated Generation Logs)
```sql
CREATE TABLE generation_runs (
  id VARCHAR(26) PRIMARY KEY,              -- ULID
  run_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL,             -- pending, success, failed, fallback
  selected_topic TEXT,
  topic_reason TEXT,
  articles_fetched_count INT,
  articles_used_count INT,
  generated_poll_id VARCHAR(26),           -- references polls(id)
  model_used VARCHAR(100),
  bias_score DECIMAL(5,2),
  balance_score DECIMAL(5,2),
  retry_count INT DEFAULT 0,
  used_fallback BOOLEAN DEFAULT FALSE,
  fallback_reason TEXT,
  error_message TEXT,
  raw_llm_input TEXT,                      -- for debugging
  raw_llm_output TEXT,                     -- for debugging
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_generation_runs_date ON generation_runs(run_date);
CREATE INDEX idx_generation_runs_status ON generation_runs(status);
```

#### `evergreen_polls` (Fallback Content)
```sql
CREATE TABLE evergreen_polls (
  id VARCHAR(26) PRIMARY KEY,              -- ULID
  question TEXT NOT NULL,
  options_json TEXT NOT NULL,              -- JSON array of options
  briefing_background TEXT,
  briefing_conservative TEXT,
  briefing_liberal TEXT,
  briefing_centrist TEXT,
  category VARCHAR(50),                    -- e.g. "governance", "economy"
  last_used_at TIMESTAMP WITH TIME ZONE,
  use_count INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

#### `recap_sends` (Nightly Recap Logs)
```sql
CREATE TABLE recap_sends (
  id VARCHAR(26) PRIMARY KEY,              -- ULID
  poll_id VARCHAR(26) NOT NULL,            -- references polls(id)
  send_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL,             -- pending, sent, skipped, failed
  total_votes INT NOT NULL,
  vote_threshold INT NOT NULL,
  results_snapshot_json TEXT NOT NULL,     -- JSON with percentages
  subscribers_sent_to INT,
  skipped BOOLEAN DEFAULT FALSE,
  skip_reason TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_recap_sends_poll_id ON recap_sends(poll_id);
CREATE INDEX idx_recap_sends_date ON recap_sends(send_date);
```

### Polls Table Extensions (Automated Generation)

The `polls` table includes these additional columns for automated generation:

```sql
ALTER TABLE polls ADD COLUMN briefing_background TEXT;
ALTER TABLE polls ADD COLUMN briefing_conservative TEXT;
ALTER TABLE polls ADD COLUMN briefing_liberal TEXT;
ALTER TABLE polls ADD COLUMN briefing_centrist TEXT;
ALTER TABLE polls ADD COLUMN generation_run_id VARCHAR(26);
ALTER TABLE polls ADD COLUMN is_auto_generated BOOLEAN DEFAULT FALSE;
```

### Data Integrity Notes

Since DSQL doesn't support foreign keys, the application must:
1. Validate `poll_id` exists before inserting `poll_options` or `votes`
2. Validate `option_id` belongs to the specified `poll_id` before recording votes
3. Use transactions for multi-table operations
4. Consider soft deletes to maintain historical data integrity

---

## Customer.io Integration

### APIs Used

| API | Purpose |
|-----|---------|
| **Track API** | Identify subscribers, track events (votes, confirmations) |
| **Transactional API** | Send confirmation emails, password resets |
| **API-Triggered Broadcasts** | Send daily poll emails to all active subscribers |

### Subscriber Profile (Customer.io)

**Attributes:**
```json
{
  "id": "subscriber_ulid",
  "email": "user@example.com",
  "subscription_status": "active",
  "subscribed_at": 1700000000,
  "total_polls_voted": 15,
  "last_vote_at": 1700500000
}
```

### Events Tracked

| Event Name | Trigger | Data |
|------------|---------|------|
| `subscription_started` | User submits email | `{ email }` |
| `subscription_confirmed` | User clicks confirm link | `{ confirmed_at }` |
| `poll_voted` | User casts vote | `{ poll_id, option_id, poll_question }` |
| `unsubscribed` | User clicks unsubscribe | `{ unsubscribed_at }` |

### Daily Poll Broadcast

**Trigger:** API-triggered broadcast via `POST /v1/environments/{env}/campaigns/{campaign_id}/triggers`

**Audience:** Segment of subscribers where `subscription_status = 'active'`

**Message Data:**
```json
{
  "poll_id": "poll_ulid",
  "poll_question": "Should the federal minimum wage be increased?",
  "options": [
    { "id": "opt1_ulid", "text": "Yes", "vote_url": "https://..." },
    { "id": "opt2_ulid", "text": "No", "vote_url": "https://..." },
    { "id": "opt3_ulid", "text": "Undecided", "vote_url": "https://..." }
  ],
  "results_url": "https://libertysurveys.com/polls/poll_ulid"
}
```

### Transactional Messages

1. **Confirmation Email** - Sent when user signs up
2. **Welcome Email** - Sent after confirmation (via automation)
3. **Unsubscribe Confirmation** - Sent when user unsubscribes

### Customer.io Workspace Setup Checklist

The owner needs to complete these steps in Customer.io to set up the "Liberty Surveys" workspace:

#### 1. Create Workspace
- [ ] Sign up or log in at https://customer.io
- [ ] Create a new workspace named "Liberty Surveys"
- [ ] Select **US region** (track-api.customer.io)

#### 2. Configure Sending Domain
- [ ] Go to **Settings > Sending Domain**
- [ ] Add `libertysurveys.com` as the sending domain
- [ ] Add DNS records to your domain:
  - DKIM record (TXT)
  - SPF record (TXT)
  - Return-Path CNAME
- [ ] Wait for verification (can take up to 48 hours)
- [ ] Set sender email: `polls@libertysurveys.com`
- [ ] Set sender name: "Liberty Surveys"

#### 3. Generate API Credentials
- [ ] Go to **Settings > API & Webhook Credentials**
- [ ] Copy **Site ID** → set as `CUSTOMERIO_SITE_ID`
- [ ] Copy **API Key** (Track API) → set as `CUSTOMERIO_API_KEY`
- [ ] Create an **App API Key** → set as `CUSTOMERIO_APP_API_KEY`
- [ ] Note the **Environment ID** from workspace URL → set as `CUSTOMERIO_ENVIRONMENT_ID`

#### 4. Create Transactional Messages
- [ ] Go to **Transactional > Messages**
- [ ] Create "Confirmation Email" transactional message:
  - Subject: "Confirm your Liberty Surveys subscription"
  - Body: Include `{{ trigger.confirm_url }}` link
  - Note the message ID → set as `CUSTOMERIO_CONFIRM_MESSAGE_ID`

#### 5. Create Daily Poll Broadcast
- [ ] Go to **Campaigns > Broadcasts**
- [ ] Create new API-triggered broadcast named "Daily Poll"
- [ ] Set audience: Segment where `subscription_status = active`
- [ ] Design email template:
  - Subject: "Today's Poll: {{ trigger.poll_question | truncate: 50 }}"
  - Body layout (in order):
    1. Poll question
    2. Vote buttons (each links to option's `vote_url`)
    3. "View current results" link
    4. "Understanding the Issue" section with briefing background
    5. Three perspectives (conservative, liberal, centrist)
    6. Source citations
  - Include unsubscribe link in footer
- [ ] Note the campaign ID → set as `CUSTOMERIO_BROADCAST_CAMPAIGN_ID`

#### 6. Create Nightly Recap Broadcast
- [ ] Go to **Campaigns > Broadcasts**
- [ ] Create new API-triggered broadcast named "Nightly Recap"
- [ ] Set audience: Segment where `subscription_status = active`
- [ ] Design email template:
  - Subject: "Today's Results: {{ trigger.poll_question | truncate: 40 }}"
  - Body: Show poll question and percentage bars
  - Display percentages (NOT vote counts) for each option
  - Include brief excerpt from briefing
  - Link to full results page
- [ ] Note the campaign ID → set as `CUSTOMERIO_RECAP_CAMPAIGN_ID`

#### 7. Email Template Variables

**Confirmation Email:**
```liquid
{{ trigger.confirm_url }}        - Signed confirmation link
{{ trigger.subscriber_email }}   - Subscriber's email
```

**Daily Poll Broadcast:**
```liquid
{{ trigger.poll_id }}              - Poll identifier
{{ trigger.poll_question }}        - The poll question
{{ trigger.options }}              - Array of vote options
{{ trigger.options[0].text }}      - Option text
{{ trigger.options[0].vote_url }}  - Signed vote URL
{{ trigger.results_url }}          - Link to results page

{# Briefing content (from automated generation) #}
{{ trigger.briefing_background }}    - Neutral background
{{ trigger.briefing_conservative }}  - Conservative perspective
{{ trigger.briefing_liberal }}       - Liberal perspective
{{ trigger.briefing_centrist }}      - Centrist perspective

{# Source citations #}
{{ trigger.sources }}                - Array of cited sources
{{ trigger.sources[0].name }}        - Source outlet name
{{ trigger.sources[0].url }}         - Article URL
{{ trigger.sources[0].title }}       - Article title

{{ customer.unsubscribe_url }}     - Unsubscribe link (auto-generated)
```

**Nightly Recap Broadcast:**
```liquid
{{ trigger.poll_id }}              - Poll identifier
{{ trigger.poll_question }}        - The poll question
{{ trigger.results }}              - Array of results (sorted by display order)
{{ trigger.results[0].text }}      - Option text
{{ trigger.results[0].percentage }} - Percentage (integer, e.g. 42)
{{ trigger.results[0].bar_width }}  - Same as percentage (for CSS width)
{{ trigger.briefing_excerpt }}     - Short excerpt from background
{{ trigger.results_url }}          - Link to full results page
{{ customer.unsubscribe_url }}     - Unsubscribe link (auto-generated)
```

---

## Poll Creation & Scheduling (Admin)

### Admin Workflow

1. **Create Poll:**
   - Enter question text
   - Add 2-4 answer options
   - Save as draft

2. **Schedule Poll:**
   - Select date for the poll
   - Set as "scheduled"
   - System queues for broadcast

3. **Automatic Publishing:**
   - Cron job or scheduled function runs at send time (7:00 AM ET)
   - Finds polls scheduled for today
   - Triggers Customer.io broadcast
   - Updates poll status to "active"

4. **Close Poll:**
   - Manual close or auto-close after 24 hours
   - Updates status to "closed"
   - No more votes accepted

### Scheduling Implementation

**Option A: External Cron (Recommended for MVP)**
- AWS EventBridge Scheduler rule triggers Lambda at 7:00 AM ET daily
- Cron expression: `cron(0 7 * * ? *)` in `America/New_York` timezone
- Lambda calls internal API endpoint to process scheduled polls

**Option B: Database-Driven Polling**
- Long-running process checks for due polls every minute
- More complex, better for variable scheduling

---

## AWS Hosting & Deployment

### Recommended Approach: AWS Amplify Hosting

**Why Amplify over SST/OpenNext:**
- **Simplicity**: Managed platform with built-in CI/CD
- **Next.js Support**: Native App Router support
- **Cost-Effective**: Pay-per-use pricing ideal for polling traffic patterns
- **Integration**: Easy connection to other AWS services (RDS, Secrets Manager)
- **Existing Familiarity**: Owner already uses AWS

**Alternative Considered: SST/OpenNext**
- More control over infrastructure
- Better for complex custom requirements
- Higher operational overhead
- Consider if Amplify limitations are hit

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     AWS Cloud                                │
│  ┌──────────────┐    ┌──────────────┐    ┌───────────────┐ │
│  │   Amplify    │    │   Aurora     │    │  Customer.io  │ │
│  │   Hosting    │◄──►│   DSQL       │    │   (External)  │ │
│  │  (Next.js)   │    │  (Database)  │    └───────┬───────┘ │
│  └──────┬───────┘    └──────────────┘            │         │
│         │                                         │         │
│         │            ┌──────────────┐            │         │
│         │            │  EventBridge │────────────┘         │
│         │            │  (Scheduler) │                      │
│         │            └──────────────┘                      │
│         │                                                   │
│  ┌──────┴───────┐    ┌──────────────┐                      │
│  │   CloudFront │    │   Secrets    │                      │
│  │    (CDN)     │    │   Manager    │                      │
│  └──────────────┘    └──────────────┘                      │
└─────────────────────────────────────────────────────────────┘
```

### Environment Configuration

| Service | Purpose |
|---------|---------|
| **Amplify Hosting** | Next.js application hosting with automatic builds |
| **Aurora DSQL** | PostgreSQL-compatible serverless database |
| **Secrets Manager** | Store API keys, signing secrets |
| **EventBridge** | Schedule daily poll broadcasts |
| **CloudFront** | CDN (included with Amplify) |

### Deployment Pipeline

1. Push to `main` branch
2. Amplify detects change, triggers build
3. Next.js built with environment variables from Amplify
4. Deployed to Amplify hosting
5. CloudFront cache invalidated

---

## Admin Authentication

### MVP Approach: Simple Password Auth

For the initial release, use a simple password-based admin system:

1. **Single admin account** seeded in database
2. **Session-based auth** using encrypted cookies
3. **Protected routes** under `/admin/*`

### Implementation

- Use `jose` library for JWT-based session tokens
- Store hashed password with `bcrypt`
- Middleware checks session on admin routes
- Session expires after 24 hours

### Future Enhancement: OAuth

Consider adding OAuth (Google, GitHub) for multi-admin support and better security.

---

## Anti-Abuse Measures

### Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| `POST /api/subscribe` | 10 requests | 1 hour per IP |
| `GET /api/vote` | 100 requests | 1 minute per IP |
| `POST /api/admin/login` | 5 attempts | 15 minutes per IP |

**Implementation:** Use in-memory rate limiting (development) or Redis (production).

### Vote Integrity

1. **Signed Vote Links**: HMAC-SHA256 signature includes poll_id, option_id, subscriber_id
2. **One Vote Per Poll**: Unique constraint on (poll_id, subscriber_id)
3. **Subscriber Verification**: Only confirmed subscribers can vote
4. **Time Bounds**: Votes only accepted while poll is active

### Signature Generation

```typescript
function generateVoteSignature(pollId: string, optionId: string, subscriberId: string): string {
  const payload = `${pollId}:${optionId}:${subscriberId}`;
  return crypto.createHmac('sha256', VOTE_SECRET).update(payload).digest('hex');
}

function verifyVoteSignature(pollId: string, optionId: string, subscriberId: string, signature: string): boolean {
  const expected = generateVoteSignature(pollId, optionId, subscriberId);
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
```

---

## Analytics Hooks

### Events for Analytics

Track these events for understanding user engagement:

| Event | Trigger | Useful For |
|-------|---------|------------|
| `page_view` | Any page load | Traffic analysis |
| `signup_started` | Form submission | Conversion tracking |
| `signup_completed` | Confirmation click | Signup funnel |
| `poll_viewed` | Results page visit | Content engagement |
| `vote_cast` | Successful vote | Participation rate |
| `archive_browsed` | Archive page visit | Content discovery |

### Implementation Options

1. **Customer.io Analytics**: Already integrated, track in-app events
2. **PostHog**: Self-hosted option for detailed product analytics
3. **Plausible/Fathom**: Privacy-focused, lightweight page analytics

### MVP Recommendation

Start with Customer.io event tracking (already required) plus basic page view logging. Add dedicated analytics tool in Phase 2.

---

## Phased Roadmap

### Phase 1: MVP (Current Scope)

**Goal:** Working end-to-end flow with manual poll creation

- [x] Landing page with email signup
- [x] Double opt-in confirmation flow
- [x] Admin poll creation interface
- [x] Signed vote links
- [x] Vote recording with duplicate prevention
- [x] Results page with vote counts
- [x] Poll archive page
- [x] Customer.io integration (Track API)
- [x] Basic admin authentication
- [ ] Manual broadcast trigger (admin button)

**Deliverables:**
- Functional Next.js application
- Aurora DSQL schema
- Customer.io workspace setup guide
- Deployment instructions for Amplify

### Phase 2: Automation

**Goal:** Fully automated daily poll delivery

- Automated poll scheduling (EventBridge)
- API-triggered broadcast integration
- Poll auto-close after 24 hours
- Email template refinement in Customer.io
- Unsubscribe flow completion

### Phase 3: Polish

**Goal:** Production-ready with better UX

- Improved results visualization (charts)
- Social sharing for polls
- Email preference center
- A/B testing for email subject lines
- Performance optimization

### Phase 4: Growth

**Goal:** Scale and engage

- Multi-admin support with roles
- Poll categories/tags
- Subscriber segments (by voting history)
- Weekly digest emails
- API for embedding polls

---

## Owner's Configuration

The following settings have been confirmed by the owner:

### Domain & URLs
- **Domain**: `libertysurveys.com`
- **Base URL**: `https://libertysurveys.com`
- **Signed link base**: `https://libertysurveys.com`

### Scheduling
- **Daily send time**: 7:00 AM America/New_York (ET)
- **Frequency**: Every day including weekends
- **Poll duration**: 24 hours (until next poll)
- **EventBridge cron**: `cron(0 7 * * ? *)` (7 AM ET daily)

### AWS Configuration
- **Region**: us-east-1
- **Services**: Amplify Hosting, Aurora DSQL, Secrets Manager, EventBridge

### Customer.io Configuration
- **Workspace name**: "Liberty Surveys"
- **Region**: US (track-api.customer.io)
- **Sender name**: "Liberty Surveys"
- **Sender domain**: libertysurveys.com (requires DNS verification)

### Branding
- **Logo**: `public/logo.png`
- **Color palette**:
  - Charcoal (wordmark): `#1a1a1a`
  - Red (script "Surveys" and flame): `#e31c23`
  - Blue (flame accents): `#0066b3`
  - White (background): `#ffffff`

### Admin Authentication
- **Mock mode only**: Hardcoded test credentials (`admin@example.com` / `admin123`) are **only** available when `USE_MOCK_DB=true`
- **Production**: Requires database-configured admin users with environment-sourced credentials

---

## Remaining Open Questions

### Legal & Compliance (To Be Addressed)

1. **Privacy policy needed?** (Required for email collection)
2. **Terms of service?** 
3. **Data retention policy?** How long to keep vote history?

### Content Operations

4. **Who writes the polls?** Single admin, or multiple contributors?

---

## File Structure

```
liberty-surveys/
├── .cursor/
│   └── environment.json        # Cloud Agent environment config
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout
│   │   ├── page.tsx            # Landing page
│   │   ├── polls/
│   │   │   ├── page.tsx        # Current poll / latest results
│   │   │   └── [id]/
│   │   │       └── page.tsx    # Individual poll results
│   │   ├── archive/
│   │   │   └── page.tsx        # Poll archive
│   │   ├── confirm/
│   │   │   └── page.tsx        # Email confirmation handler
│   │   ├── unsubscribe/
│   │   │   └── page.tsx        # Unsubscribe handler
│   │   ├── admin/
│   │   │   ├── layout.tsx      # Admin layout with auth check
│   │   │   ├── page.tsx        # Admin dashboard
│   │   │   ├── login/
│   │   │   │   └── page.tsx    # Admin login
│   │   │   └── polls/
│   │   │       ├── page.tsx    # Poll list
│   │   │       ├── new/
│   │   │       │   └── page.tsx # Create poll
│   │   │       └── [id]/
│   │   │           └── page.tsx # Edit poll
│   │   └── api/
│   │       ├── subscribe/
│   │       │   └── route.ts    # POST: create subscriber
│   │       ├── confirm/
│   │       │   └── route.ts    # GET: confirm subscription
│   │       ├── vote/
│   │       │   └── route.ts    # GET: record vote
│   │       ├── unsubscribe/
│   │       │   └── route.ts    # GET: unsubscribe
│   │       ├── polls/
│   │       │   └── route.ts    # GET: list polls, POST: create poll
│   │       └── admin/
│   │           ├── login/
│   │           │   └── route.ts
│   │           └── broadcast/
│   │               └── route.ts # POST: trigger daily broadcast
│   ├── lib/
│   │   ├── db.ts               # Aurora DSQL connection
│   │   ├── customerio.ts       # Customer.io client
│   │   ├── signatures.ts       # HMAC signing utilities
│   │   ├── auth.ts             # Admin auth utilities
│   │   └── ulid.ts             # ULID generation
│   ├── components/
│   │   ├── ui/                 # Shared UI components
│   │   ├── SignupForm.tsx
│   │   ├── PollResults.tsx
│   │   ├── PollCard.tsx
│   │   └── AdminNav.tsx
│   └── types/
│       └── index.ts            # TypeScript types
├── migrations/
│   └── 001_initial_schema.sql  # Database migration
├── public/
│   └── ...                     # Static assets
├── .env.example                # Environment variables template
├── package.json
├── tsconfig.json
├── next.config.js
├── tailwind.config.js
├── PLAN.md                     # This file
└── README.md                   # Setup instructions
```

---

## Security Considerations

1. **Secrets Management**: All secrets in environment variables, not code
2. **Input Validation**: Validate all user input server-side
3. **SQL Injection**: Use parameterized queries
4. **XSS Prevention**: Next.js automatic escaping + CSP headers
5. **CSRF Protection**: Built into Next.js API routes
6. **HTTPS Only**: Enforce via Amplify/CloudFront
7. **Rate Limiting**: Prevent abuse of public endpoints
8. **Signed Tokens**: Tamper-resistant vote and confirmation links
