# Sur Payments – LatAm Nearshore Payments Control Plane

Operational console for cross-border payments with real maker-checker controls, audit trail, and role-based access. Built for nearshore / LatAm fintech teams that need clear operational visibility and compliance-friendly workflows.

## Features

- Payment instruction lifecycle (DRAFT → PENDING_APPROVAL → APPROVED → PROCESSING → SETTLED)
- Maker-checker enforcement (creator cannot approve)
- Role-based access: OPERATOR, APPROVER, AUDITOR, ADMIN
- Immutable audit log
- CSV export
- Clean operational dashboard

## Quick Start

### Option 1 – Local development (recommended while building)

```bash
# Start infrastructure
docker compose up -d postgres redis

# API
cd apps/api
npm install
npm run dev

# Frontend (new terminal)
cd apps/web
pnpm install
pnpm dev
```

Dashboard: [http://localhost:3000](http://localhost:3000)  
API: [http://localhost:4000](http://localhost:4000)

### Option 2 – Full stack with Docker

```bash
docker compose up --build
```

## Project Structure

```
Sur_payments/
├── apps/
│   ├── api/          # Fastify + Postgres + Redis
│   └── web/          # Next.js 14 dashboard
├── scripts/
│   └── smoke_test.sh
├── docker-compose.yml
└── README.md
```

## Smoke Test

With the API running:

```bash
./scripts/smoke_test.sh
```

## Tech Stack

- **Backend**: Node.js, Fastify, TypeScript, Postgres, Redis
- **Frontend**: Next.js 14, Tailwind CSS, Lucide
- **Infra**: Docker Compose

## License

Private – All rights reserved
