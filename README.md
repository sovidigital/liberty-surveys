# Liberty Surveys

A daily political polling platform that sends subscribers polls via email and displays results publicly.

## Features

- **Email Subscription**: Double opt-in subscription flow
- **Daily Polls**: Scheduled polls delivered via email
- **One-Click Voting**: Tamper-resistant signed links for frictionless voting
- **Results Display**: Real-time vote tallies and percentages
- **Poll Archive**: Browse historical polls and results
- **Admin Dashboard**: Create, schedule, and manage polls

## Tech Stack

- **Frontend/Backend**: Next.js 16 (App Router, TypeScript)
- **Database**: Amazon Aurora DSQL (PostgreSQL-compatible)
- **Email**: Customer.io (Track API, Transactional API, Broadcasts)
- **Hosting**: AWS Amplify (recommended)
- **Styling**: Tailwind CSS

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
   - Default credentials: `admin@example.com` / `admin123`

### Database Setup

If using a real database:

1. Create an Aurora DSQL cluster or PostgreSQL database
2. Set `DATABASE_URL` in `.env.local`
3. Run migrations:
   ```bash
   npm run db:migrate
   ```

### Customer.io Setup

1. Create a Customer.io account at https://customer.io
2. Get API credentials from Settings > API & Webhook Credentials
3. Set in `.env.local`:
   ```
   CUSTOMERIO_SITE_ID=your_site_id
   CUSTOMERIO_API_KEY=your_api_key
   CUSTOMERIO_APP_API_KEY=app_your_api_key
   ```
4. Create a transactional message for confirmation emails
5. Create an API-triggered broadcast for daily polls

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
