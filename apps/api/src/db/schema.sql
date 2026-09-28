CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE payment_status AS ENUM (
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'PROCESSING',
  'SETTLED',
  'FAILED',
  'CANCELLED'
);

CREATE TYPE user_role AS ENUM (
  'OPERATOR',
  'APPROVER',
  'AUDITOR',
  'ADMIN'
);

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  full_name     TEXT NOT NULL,
  role          user_role NOT NULL DEFAULT 'OPERATOR',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE payments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key   TEXT UNIQUE NOT NULL,
  amount_cents      BIGINT NOT NULL CHECK (amount_cents > 0),
  currency          CHAR(3) NOT NULL,
  beneficiary_name  TEXT NOT NULL,
  beneficiary_account TEXT NOT NULL,
  corridor          TEXT NOT NULL, -- e.g. USD-MXN, USD-BRL
  status            payment_status NOT NULL DEFAULT 'DRAFT',
  created_by        UUID NOT NULL REFERENCES users(id),
  approved_by       UUID REFERENCES users(id),
  failure_reason    TEXT,
  metadata          JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id    UUID NOT NULL REFERENCES payments(id),
  actor_id      UUID NOT NULL REFERENCES users(id),
  action        TEXT NOT NULL,
  from_status   payment_status,
  to_status     payment_status,
  note          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_created_at ON payments(created_at DESC);
CREATE INDEX idx_audit_payment ON audit_log(payment_id);
