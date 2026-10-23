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

#### 5. Create API-Triggered Broadcast
- [ ] Go to **Campaigns > Broadcasts**
- [ ] Create new API-triggered broadcast named "Daily Poll"
- [ ] Set audience: Segment where `subscription_status = active`
- [ ] Design email template:
  - Subject: "Today's Poll: {{ trigger.poll_question | truncate: 50 }}"
  - Body: Include poll question and vote buttons using `trigger.options` array
  - Each button links to option's `vote_url`
  - Include unsubscribe link in footer
- [ ] Note the campaign ID → set as `CUSTOMERIO_BROADCAST_CAMPAIGN_ID`

#### 6. Email Template Variables

**Confirmation Email:**
```liquid
{{ trigger.confirm_url }}        - Signed confirmation link
{{ trigger.subscriber_email }}   - Subscriber's email
```

**Daily Poll Broadcast:**
```liquid
{{ trigger.poll_id }}            - Poll identifier
{{ trigger.poll_question }}      - The poll question
{{ trigger.options }}            - Array of vote options
{{ trigger.options[0].text }}    - Option text
{{ trigger.options[0].vote_url }} - Signed vote URL
{{ trigger.results_url }}        - Link to results page
{{ customer.unsubscribe_url }}   - Unsubscribe link (auto-generated)
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
   - Cron job or scheduled function runs at send time (e.g., 8 AM ET)
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
