# Liberty Surveys

A daily political polling platform at **libertysurveys.com** that sends subscribers polls via email at 7:00 AM ET daily and displays results publicly.

## Features

- **Automated Poll Generation**: Daily polls created automatically using xAI Grok API
- **Email Subscription**: Double opt-in subscription flow
- **Daily Polls**: Delivered at 7:00 AM ET every day with briefing content
- **Three Perspectives**: Conservative, liberal, and centrist viewpoints on each topic
- **One-Click Voting**: Tamper-resistant signed links for frictionless voting
- **Nightly Recap**: 8:00 PM ET email with poll results (percentages only)
- **Results Display**: Real-time vote percentages (no raw counts for privacy)
- **Poll Archive**: Browse historical polls and results
- **Admin Dashboard**: Create, schedule, and manage polls

## Tech Stack

- **Frontend/Backend**: Next.js 16 (App Router, TypeScript)
- **Database**: Amazon Aurora DSQL (PostgreSQL-compatible, us-east-1)
- **LLM**: xAI Grok API (grok-4.7 for poll generation, bias checking, and web search)
- **News**: RSS feeds from 22+ politically balanced sources + xAI web search
- **Email**: Customer.io (Track API, Transactional API, Broadcasts)
- **Hosting**: AWS Amplify (us-east-1)
- **Styling**: Tailwind CSS

## Brand Colors

| Color | Hex | Usage |
|-------|-----|-------|
| Charcoal | `#1a1a1a` | Primary text, headers, nav |
| Red | `#e31c23` | Accent, CTAs, buttons |
| Blue | `#0066b3` | Links, secondary accents |
| White | `#ffffff` | Backgrounds |

## Quick Start

### Prerequisites

- Node.js 20+
- npm or yarn
- (Optional) PostgreSQL database or Aurora DSQL cluster
- (Optional) Customer.io account

### Local Development

1. **Clone and install dependencies**:
   ```bash
   git clone <repo-url>
   cd liberty-surveys
   npm install
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env.local
   ```

   For local development without external services:
   ```bash
   # In .env.local
   USE_MOCK_DB=true
   NODE_ENV=development
   ```

3. **Run the development server**:
   ```bash
   npm run dev
   ```

4. **Open the app**: http://localhost:3000

5. **Access admin panel**: http://localhost:3000/admin/login
   - **Mock mode only**: Test credentials `admin@example.com` / `admin123`
   - These credentials only work when `USE_MOCK_DB=true`
   - **Production**: Requires database-configured admin users

### Database Setup

If using a real database:

1. Create an Aurora DSQL cluster or PostgreSQL database
2. Set `DATABASE_URL` in `.env.local`
3. Run migrations:
   ```bash
   npm run db:migrate
   ```

### Customer.io Setup

Create a new workspace named "Liberty Surveys" in the **US region**:

1. **Create workspace** at https://customer.io (select US region)
2. **Configure sending domain**:
   - Add `libertysurveys.com` as sending domain
   - Set up DNS records (DKIM, SPF, Return-Path)
   - Sender: "Liberty Surveys" `<polls@libertysurveys.com>`
3. **Generate API credentials** (Settings > API & Webhook Credentials):
   - Copy Site ID → `CUSTOMERIO_SITE_ID`
   - Copy API Key → `CUSTOMERIO_API_KEY`
   - Create App API Key → `CUSTOMERIO_APP_API_KEY`
   - Note Environment ID → `CUSTOMERIO_ENVIRONMENT_ID`
4. **Create transactional message** for confirmation emails:
   - Include `{{ trigger.confirm_url }}` for the confirmation link
   - Note message ID → `CUSTOMERIO_CONFIRM_MESSAGE_ID`
5. **Create API-triggered broadcast** for daily polls:
   - Audience: subscribers where `subscription_status = active`
   - Template uses `trigger.poll_question` and `trigger.options` array
   - Note campaign ID → `CUSTOMERIO_BROADCAST_CAMPAIGN_ID`

See [PLAN.md](./PLAN.md) for detailed template variables and setup instructions.

## Project Structure

```
liberty-surveys/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── api/               # API routes
│   │   │   ├── subscribe/     # Email subscription
│   │   │   ├── confirm/       # Email confirmation
│   │   │   ├── vote/          # Vote recording
│   │   │   ├── unsubscribe/   # Unsubscription
│   │   │   ├── polls/         # Poll CRUD
│   │   │   └── admin/         # Admin authentication
│   │   ├── admin/             # Admin pages
│   │   ├── polls/             # Public poll pages
│   │   ├── archive/           # Poll archive
│   │   ├── confirm/           # Confirmation page
│   │   └── unsubscribe/       # Unsubscribe page
│   ├── components/            # React components
│   ├── lib/                   # Utilities
│   │   ├── db.ts             # Database connection
│   │   ├── customerio.ts     # Customer.io client
│   │   ├── signatures.ts     # HMAC signing
│   │   ├── auth.ts           # Admin authentication
│   │   └── ulid.ts           # ID generation
│   └── types/                 # TypeScript types
├── migrations/                # Database migrations
├── scripts/                   # Utility scripts
├── PLAN.md                   # Detailed product plan
└── .env.example              # Environment template
```

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/subscribe` | POST | Subscribe new email |
| `/api/confirm` | GET | Confirm subscription |
| `/api/vote` | GET | Record a vote (signed link) |
| `/api/unsubscribe` | GET | Unsubscribe (signed link) |
| `/api/polls` | GET | List public polls |
| `/api/polls` | POST | Create poll (admin) |
| `/api/admin/login` | POST | Admin login |
| `/api/admin/logout` | POST | Admin logout |
| `/api/admin/broadcast` | POST | Trigger poll broadcast |

## Vote Security

Votes use HMAC-SHA256 signed links:
- Each subscriber gets unique vote URLs per poll
- Signatures include poll ID, option ID, and subscriber ID
- Duplicate votes are prevented at the database level
- Invalid signatures are rejected

## Deployment (AWS Amplify)

1. **Connect repository** to AWS Amplify
2. **Configure environment variables** in Amplify console
3. **Set build settings**:
   ```yaml
   version: 1
   frontend:
     phases:
       preBuild:
         commands:
           - npm ci
       build:
         commands:
           - npm run build
     artifacts:
       baseDirectory: .next
       files:
         - '**/*'
     cache:
       paths:
         - node_modules/**/*
   ```

4. **Set up Aurora DSQL** and configure `DATABASE_URL`
5. **Configure Customer.io** credentials
6. **Deploy**

## Development Notes

### Mock Mode

When running without external services:
- Database queries return mock data
- Customer.io calls are logged to console
- Vote links are generated but emails aren't sent

### Adding Polls

1. Log in to admin at `/admin/login`
2. Click "Create Poll"
3. Enter question and 2-6 options
4. Save as draft or schedule
5. Publish and trigger broadcast when ready

### Aurora DSQL Limitations

This schema is designed for Aurora DSQL:
- No foreign keys (application-level integrity)
- ULIDs instead of sequences/serial
- No specialized extensions

## Environment Variables

See `.env.example` for all required variables and documentation.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes
4. Submit a pull request

## License

MIT

---

See [PLAN.md](./PLAN.md) for the complete product specification, user flows, and roadmap.
