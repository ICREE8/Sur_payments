export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export interface Payment {
  id: string;
  idempotency_key: string;
  amount_cents: string;
  currency: string;
  beneficiary_name: string;
  beneficiary_account: string;
  corridor: string;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'PROCESSING' | 'SETTLED' | 'FAILED' | 'CANCELLED';
  created_by: string;
  approved_by: string | null;
  failure_reason: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  created_by_name?: string;
  approved_by_name?: string | null;
}

export interface AuditEntry {
  id: string;
  payment_id: string;
  actor_id: string;
  action: string;
  from_status: string | null;
  to_status: string | null;
  note: string | null;
  created_at: string;
  actor_name: string;
  actor_role: string;
}

export async function fetchPayments(filters: Record<string, string> = {}) {
  const params = new URLSearchParams(filters);
  const res = await fetch(`${API_BASE}/payments?${params.toString()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch payments');
  return res.json();
}

export async function fetchPaymentDetail(id: string) {
  const res = await fetch(`${API_BASE}/payments/${id}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch payment details');
  return res.json();
}

export async function createPayment(data: {
  amount_cents: number;
  currency: string;
  beneficiary_name: string;
  beneficiary_account: string;
  corridor: string;
  actor_email: string;
}) {
  const res = await fetch(`${API_BASE}/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Creation failed');
  return json;
}

export async function transitionPayment(id: string, action: string, actor_email: string, note?: string) {
  const res = await fetch(`${API_BASE}/payments/${id}/transition`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, actor_email, note }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Transition failed');
  return json;
}
