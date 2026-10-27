# Liberty Surveys — Deployment Guide

## AWS Amplify Hosting Setup (us-east-1)

### Prerequisites
- AWS account with Amplify access
- GitHub repository: `github.com/sovidigital/liberty-surveys`
- Customer.io workspace configured (see Customer.io section below)
- Aurora DSQL cluster created (or create during setup)
- xAI API key from https://console.x.ai

---

## Step 1: Create Amplify App

1. Open **AWS Amplify Console** in **us-east-1**
2. Click **"Create new app"** → **"Host web app"**
3. Select **GitHub** as the source
4. Authorize AWS Amplify to access your GitHub account
5. Select repository: `sovidigital/liberty-surveys`
6. Select branch: `main` (or your production branch)
7. App name: `liberty-surveys`
8. **Build settings**: Amplify should auto-detect Next.js. The `amplify.yml` in the repo configures:
   - Node.js 20
   - `npm ci` for dependencies
   - `npm run build` for Next.js SSR
9. Click **"Save and deploy"**

### Amplify App Settings
After creation, note:
- **App ID**: `d1234abcd` (from URL or app settings)
- **Default URL**: `https://main.d1234abcd.amplifyapp.com`

---

## Step 2: Configure Environment Variables

In Amplify Console → Your App → **"Environment variables"**, add:

### Required Secrets (set values from secure storage)

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Aurora DSQL connection string |
| `XAI_API_KEY` | xAI API key for poll generation |
| `CUSTOMERIO_API_KEY` | Customer.io Track API key |
| `CUSTOMERIO_APP_API_KEY` | Customer.io App API key (Bearer) |
| `VOTE_SIGNING_SECRET` | HMAC secret (generate with `openssl rand -hex 32`) |
| `CONFIRM_SIGNING_SECRET` | HMAC secret for confirmation links |
| `UNSUBSCRIBE_SIGNING_SECRET` | HMAC secret for unsubscribe links |
| `JWT_SECRET` | Admin session secret (min 32 chars) |
| `SCHEDULER_SECRET` | EventBridge scheduler auth secret |

### Non-Secret Configuration

| Variable | Value |
|----------|-------|
| `CUSTOMERIO_SITE_ID` | `dd09dc6a20a7e9534d2e` |
| `CUSTOMERIO_ENVIRONMENT_ID` | `237678` |
| `CUSTOMERIO_BROADCAST_CAMPAIGN_ID` | `8` |
| `CUSTOMERIO_RECAP_CAMPAIGN_ID` | `9` |
| `CUSTOMERIO_CONFIRM_MESSAGE_ID` | `2` |
| `NEXT_PUBLIC_BASE_URL` | `https://libertysurveys.com` (or Amplify URL initially) |
| `AWS_REGION` | `us-east-1` |
| `USE_MOCK_DB` | `false` |
| `USE_MOCK_NEWS` | `false` |
| `USE_MOCK_LLM` | `false` |
| `NODE_ENV` | `production` |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `XAI_MODEL` | `grok-4.7` | Model for poll generation |
| `XAI_BIAS_CHECK_MODEL` | `grok-4.7` | Model for bias checking |
| `RECAP_MIN_VOTES` | `10` | Min votes to send recap |
| `DATABASE_SSL` | `true` | SSL for database connection |

---

## Step 3: Custom Domain (libertysurveys.com)

1. In Amplify Console → **"Domain management"**
2. Click **"Add domain"**
3. Enter: `libertysurveys.com`
4. Configure subdomains:
   - `libertysurveys.com` → branch `main`
   - `www.libertysurveys.com` → redirect to `libertysurveys.com`
5. Amplify provides DNS records to add:
   - CNAME for `www`
   - CNAME or ALIAS for root domain
6. Add records to your DNS provider
7. Wait for SSL certificate provisioning (~20-30 mins)

After domain is active, update:
- `NEXT_PUBLIC_BASE_URL` = `https://libertysurveys.com`

---

## Step 4: EventBridge Scheduler Rules

Create three scheduled rules in **Amazon EventBridge Scheduler** (us-east-1):

### 4.1 Poll Generation (5:00 AM ET daily)

- **Name**: `liberty-surveys-generate`
- **Schedule**: `cron(0 5 * * ? *)` 
- **Timezone**: `America/New_York`
- **Target**: HTTP endpoint
  - URL: `https://libertysurveys.com/api/admin/generate`
  - Method: `POST`
  - Headers:
    - `Content-Type: application/json`
    - `x-scheduled-job: true`
    - `x-scheduler-secret: <your SCHEDULER_SECRET value>`

### 4.2 Daily Poll Broadcast (7:00 AM ET daily)

- **Name**: `liberty-surveys-broadcast`
- **Schedule**: `cron(0 7 * * ? *)`
- **Timezone**: `America/New_York`
- **Target**: HTTP endpoint
  - URL: `https://libertysurveys.com/api/admin/broadcast`
  - Method: `POST`
  - Headers:
    - `Content-Type: application/json`
    - `x-scheduled-job: true`
    - `x-scheduler-secret: <your SCHEDULER_SECRET value>`

### 4.3 Nightly Recap (8:00 PM ET daily)

- **Name**: `liberty-surveys-recap`
- **Schedule**: `cron(0 20 * * ? *)`
- **Timezone**: `America/New_York`
- **Target**: HTTP endpoint
  - URL: `https://libertysurveys.com/api/admin/recap`
  - Method: `POST`
  - Headers:
    - `Content-Type: application/json`
    - `x-scheduled-job: true`
    - `x-scheduler-secret: <your SCHEDULER_SECRET value>`

---

## Step 5: Database Setup (Aurora DSQL)

1. Create Aurora DSQL cluster in us-east-1 (if not already done)
2. Note the connection endpoint
3. Set `DATABASE_URL` in Amplify env vars:
   ```
   postgres://admin:<password>@<endpoint>:5432/liberty_surveys?sslmode=require
   ```
4. Run migrations:
   ```bash
   # From local machine with DATABASE_URL set
   npm run db:migrate
   ```

---

## Step 6: Create Admin User

After database is set up, create a production admin user:

```sql
-- Generate password hash first:
-- npx bcryptjs hash "your-secure-password"

INSERT INTO admin_users (id, email, password_hash, created_at)
VALUES (
  '01JBXXXXXXXXXXXXXXXXXXXXXX',  -- Generate ULID
  'admin@yourcompany.com',
  '$2a$10$...',  -- bcrypt hash from above
  NOW()
);
```

**Never use the mock credentials (admin@example.com) in production.**

---

## Customer.io Configuration (Already Done)

The Customer.io workspace "Liberty Surveys" is configured with:

| Item | ID | Status |
|------|-----|--------|
| Environment ID | `237678` | ✅ |
| Site ID | `dd09dc6a20a7e9534d2e` | ✅ |
| Daily Poll Broadcast | Campaign `8` | Draft (start in CIO UI) |
| Nightly Recap Broadcast | Campaign `9` | Draft (start in CIO UI) |
| Confirmation Email | Message `2` | ✅ |
| Active Subscribers Segment | `31` | ✅ |
| Sender Identity | `polls@libertysurveys.com` | DNS pending |

### Before Go-Live
1. Complete DNS verification for `libertysurveys.com` in Customer.io
2. Start campaigns 8 and 9 in Customer.io UI (API lacks write:live permission)

---

## Verification Checklist

After deployment:

- [ ] Amplify build succeeds
- [ ] App loads at Amplify URL
- [ ] Database connection works (check `/api/polls` returns data)
- [ ] Admin login works at `/admin/login`
- [ ] Custom domain SSL active
- [ ] Customer.io DNS verified
- [ ] Test subscription flow end-to-end
- [ ] EventBridge schedules created
- [ ] Campaigns 8 and 9 started in Customer.io

---

## Troubleshooting

### Build Fails
- Check Node.js version (requires 20+)
- Verify `amplify.yml` is in repo root
- Check build logs in Amplify Console

### Database Connection Fails
- Verify `DATABASE_URL` format includes `?sslmode=require`
- Check Aurora DSQL security group allows Amplify IPs
- Ensure `DATABASE_SSL=true`

### Customer.io Errors
- Verify API keys are set correctly
- Check Campaign IDs match (8, 9, 2)
- Ensure sender domain DNS is verified

### Scheduler Not Triggering
- Verify `SCHEDULER_SECRET` matches in EventBridge headers
- Check API routes return 200 for valid requests
- Review CloudWatch logs for scheduler execution
