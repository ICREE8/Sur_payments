# Sur Payments | LatAm Control Plane

Operational console for cross border payments with real maker checker controls, audit trail, and role based access.

Built for nearshore / LatAm fintech teams that need clear operational visibility and compliance friendly workflows.



# 🏛️ System Architecture

## Component A: Payment Core (Fastify + Postgres + Redis)

- **Runtime**: Node.js 22 with Fastify for sub 10ms routing
- **Storage**: Postgres 16 with row level security patterns
- **Cache & State**: Redis for idempotency keys and session management
- **Domain Model**:
  - Payment lifecycle: `DRAFT` → `PENDING_APPROVAL` → `APPROVED` → `PROCESSING` → `SETTLED`
  - Maker checker enforcement: `creator_id` stored, compared against `approver_id`
  - Audit log: append only table with JSONB metadata
  - Role matrix: `OPERATOR`, `APPROVER`, `AUDITOR`, `ADMIN`

## Component B: Operational Cockpit (Next.js 14 + Tailwind)

- **Aesthetic**: Clean institutional. Slate grays, emerald accents for success, amber for pending.
- **Core Panels**:
  - **Payment Pipeline**: Sortable table with corridor badges, amount formatting, status pills
  - **Action Console**: Context aware buttons. Submit, approve, reject, void. Disabled states enforced by role.
  - **Audit Trail**: Immutable log with actor, timestamp, diff view
  - **Export**: CSV generation with streaming for large datasets
  - **RBAC**: Role switcher in header. Real time permission recalculation.

## Component C: Infrastructure (Docker Compose)

- **Orchestration**: Single compose file for full stack
- **Networking**: Internal bridge network. Services communicate by container name.
- **Healthchecks**: Postgres readiness probe before API start
- **Volumes**: Named volume for Postgres persistence

## 📋 API Contract Highlights

- `POST /payments`  
  Creates draft. Returns 201 with id and initial status.

- `POST /payments/:id/transition`  
  Body: `{ action, actor_email }`  
  Actions: `submit`, `approve`, `reject`, `void`, `settle`  
  Enforcement: `submit` requires `OPERATOR`. `approve` requires `APPROVER` and `creator != approver`.

- `GET /payments/:id/audit`  
  Returns chronological list of all state changes.

- `GET /payments/export?format=csv`  
  Streaming CSV with all visible fields.

## 🚀 Quickstart

**Prerequisites**: Docker, Docker Compose, git

**Clone and start**:

```bash
git clone <your_repo>
cd Sur_payments
docker compose up --build
```

**Services available**:

- Web: [http://localhost:3000](http://localhost:3000)
- API: [http://localhost:4000](http://localhost:4000)
- API Health: [http://localhost:4000/health](http://localhost:4000/health)

## 🧪 Smoke Test

```bash
./scripts/smoke_test.sh
```

**Verifies**:
- Health endpoint responds
- Payment creation
- State transitions (submit → approve)
- Maker checker enforcement
- Audit log population

## 📂 Repository Layout

```
Sur_payments/
├── apps/
│   ├── api/              # Fastify payment core
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   ├── domain/
│   │   │   └── infra/
│   │   └── Dockerfile
│   └── web/              # Next.js cockpit
│       ├── src/
│       │   ├── app/
│       │   └── components/
│       └── Dockerfile
├── scripts/
│   └── smoke_test.sh
├── docker-compose.yml
└── README.md
```

## 🔒 Security Model

- **Authentication**: Email based role resolution (production: connect your SSO)
- **Authorization**: Role checked at API boundary, not just UI
- **Audit**: Every transition creates immutable log entry
- **No soft deletes**: Void action creates new state, preserves history

## 🛠️ Environment Variables

### API

```env
DATABASE_URL=postgres://sur:sur_secret@postgres:5432/sur_payments
REDIS_URL=redis://redis:6379
PORT=4000
HOST=0.0.0.0
```

### Web

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

## 📊 Operational Patterns

### Maker Checker

1. Operator creates payment → status `DRAFT`
2. Operator submits → status `PENDING_APPROVAL`
3. Approver reviews and approves → status `APPROVED`
4. System processes → status `PROCESSING` → `SETTLED`

Any attempt by creator to approve returns 403.

### Corridor Management

Supported: `USD_MXN`, `USD_COP`, `USD_BRL`, `USD_ARS`, `USD_CLP`

Each corridor has configurable limits and SLA targets.

## 📈 Production Deployment

See deployment section below for server setup with Cloudflare tunnel.

---

License: Private — All rights reserved
