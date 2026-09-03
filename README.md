# RevPilot

> AI-powered revenue recovery and risk response platform for merchants.

RevPilot helps merchants identify at-risk revenue, generate recovery playbooks, enforce policy controls, route risky actions for human approval, and maintain an auditable record of recovery decisions.

## Features

- **Revenue War Room** — View total revenue at risk, recovered revenue, recovery rate, and pending approvals.
- **Recovery Queue** — Monitor generated recovery playbooks with root cause, source, confidence, status, and recovery value.
- **Adaptive Recovery Playbooks** — Generate recommended recovery strategies through a multi-step waterfall workflow.
- **Policy Engine** — Validate recovery actions against merchant-defined limits such as ceiling amount, daily cap, and minimum confidence.
- **Human Approval Workflow** — Route high-risk or policy-breaching actions for manual approval.
- **Notifications** — Send approval notifications through Email and Slack.
- **Audit Ledger** — Maintain an auditable history of recovery decisions and actions.
- **Analytics** — Analyze recovery performance, timelines, funnels, and playbook performance.
- **Razorpay Webhooks** — Securely ingest and process revenue-related events with HMAC verification.
- **Authentication** — Secure merchant access using Clerk.

## Workflow

```text
Razorpay Event
      │
      ▼
Webhook Ingestion
      │
      ▼
Risk Event Created
      │
      ▼
Queue & Worker Processing
      │
      ▼
Recovery Playbook Generated
      │
      ▼
Policy Evaluation
      │
      ├── Allowed ───────► Recovery Waterfall ───────► Recovery Action
      │
      └── Policy Breach ─► Human Approval
                                  │
                         ┌────────┴────────┐
                         ▼                 ▼
                       Email             Slack
                         │
                         ▼
                    Audit Ledger
```

## Tech Stack

### Frontend
- React
- TypeScript
- Vite
- Clerk

### Backend
- Node.js
- Express
- TypeScript
- Prisma ORM

### Infrastructure & Processing
- PostgreSQL
- Redis
- BullMQ
- Docker Compose

### Integrations
- Razorpay Webhooks
- Clerk Authentication
- Email Notifications
- Slack Notifications
- Groq API

## Architecture

```text
React Client
     │
     ▼
Node.js / Express API
     │
 ┌───┴────┐
 ▼        ▼
PostgreSQL Redis
             │
             ▼
       BullMQ Workers
```

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/Radhika984/RevPilot.git
cd RevPilot
```

### 2. Start PostgreSQL and Redis

```bash
docker compose up -d
```

### 3. Configure environment variables

Create `.env` files using the provided `.env.example` files and add your own credentials.

> Never commit real API keys or credentials.

### 4. Install dependencies

#### Server

```bash
cd server
npm install
```

#### Client

```bash
cd ../client
npm install
```

### 5. Run database migrations

From the `server` directory:

```bash
npx prisma migrate dev
npx prisma generate
```

### 6. Seed demo data

Set your Clerk user ID:

```powershell
$env:DEMO_CLERK_USER_ID="your_clerk_user_id"
npm run seed:demo
```

### 7. Start the application

Start the backend:

```bash
cd server
npm run dev
```

Start the frontend:

```bash
cd client
npm run dev
```

Open:

```text
http://localhost:5173
```

## Security

Real credentials are excluded from the repository through `.gitignore`. Environment variable templates are provided through `.env.example`.

## Author

**Radhika Sharma**

GitHub: [@Radhika984](https://github.com/Radhika984)