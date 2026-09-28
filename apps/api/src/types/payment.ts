export type PaymentStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'PROCESSING'
  | 'SETTLED'
  | 'FAILED'
  | 'CANCELLED';

export type UserRole = 'OPERATOR' | 'APPROVER' | 'AUDITOR' | 'ADMIN';

export interface Payment {
  id: string;
  idempotency_key: string;
  amount_cents: number;
  currency: string;
  beneficiary_name: string;
  beneficiary_account: string;
  corridor: string;
  status: PaymentStatus;
  created_by: string;
  approved_by: string | null;
  failure_reason: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface AuditLogEntry {
  id: string;
  payment_id: string;
  actor_id: string;
  action: string;
  from_status: PaymentStatus | null;
  to_status: PaymentStatus | null;
  note: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
}