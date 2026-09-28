import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { query } from '../db/client.js';
import { v4 as uuidv4 } from 'uuid';
import { PaymentStatus, UserRole } from '../types/payment.js';

const createPaymentSchema = z.object({
  amount_cents: z.number().int().positive(),
  currency: z.string().length(3),
  beneficiary_name: z.string().min(2),
  beneficiary_account: z.string().min(5),
  corridor: z.string().min(3),
  idempotency_key: z.string().min(8).optional(),
  actor_email: z.string().email().default('operator@sur.payments'),
});

const transitionSchema = z.object({
  action: z.enum(['submit', 'approve', 'reject', 'process', 'settle', 'fail', 'cancel']),
  actor_email: z.string().email(),
  note: z.string().optional(),
});

const TRANSITIONS: Record<string, { from: PaymentStatus[]; to: PaymentStatus; roles: UserRole[] }> = {
  submit: { from: ['DRAFT'], to: 'PENDING_APPROVAL', roles: ['OPERATOR', 'ADMIN'] },
  approve: { from: ['PENDING_APPROVAL'], to: 'APPROVED', roles: ['APPROVER', 'ADMIN'] },
  reject: { from: ['PENDING_APPROVAL'], to: 'CANCELLED', roles: ['APPROVER', 'ADMIN'] },
  process: { from: ['APPROVED'], to: 'PROCESSING', roles: ['OPERATOR', 'ADMIN'] },
  settle: { from: ['PROCESSING'], to: 'SETTLED', roles: ['OPERATOR', 'ADMIN'] },
  fail: { from: ['PROCESSING'], to: 'FAILED', roles: ['OPERATOR', 'ADMIN'] },
  cancel: { from: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PROCESSING'], to: 'CANCELLED', roles: ['ADMIN'] },
};

function getClientMeta(request: FastifyRequest) {
  const forwarded = request.headers['x-forwarded-for'];
  const ip = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : request.ip || '127.0.0.1';
  const ua = (request.headers['user-agent'] as string) || 'unknown';
  return { ip, ua };
}

export async function paymentRoutes(app: FastifyInstance) {
  // 1. Search & Filter Payments (M3)
  app.get('/payments', async (request: FastifyRequest<{
    Querystring: {
      status?: string;
      corridor?: string;
      search?: string;
      min_amount?: string;
      max_amount?: string;
      from_date?: string;
      to_date?: string;
      limit?: string;
      offset?: string;
    }
  }>) => {
    const { status, corridor, search, min_amount, max_amount, from_date, to_date, limit = '50', offset = '0' } = request.query;

    const conditions: string[] = [];
    const params: any[] = [];
    let pIdx = 1;

    if (status) {
      conditions.push(`p.status = $${pIdx++}`);
      params.push(status.toUpperCase());
    }
    if (corridor) {
      conditions.push(`p.corridor = $${pIdx++}`);
      params.push(corridor.toUpperCase());
    }
    if (search) {
      conditions.push(`(p.beneficiary_name ILIKE $${pIdx} OR p.beneficiary_account ILIKE $${pIdx})`);
      params.push(`%${search}%`);
      pIdx++;
    }
    if (min_amount) {
      conditions.push(`p.amount_cents >= $${pIdx++}`);
      params.push(parseInt(min_amount, 10));
    }
    if (max_amount) {
      conditions.push(`p.amount_cents <= $${pIdx++}`);
      params.push(parseInt(max_amount, 10));
    }
    if (from_date) {
      conditions.push(`p.created_at >= $${pIdx++}`);
      params.push(new Date(from_date));
    }
    if (to_date) {
      conditions.push(`p.created_at <= $${pIdx++}`);
      params.push(new Date(to_date));
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(parseInt(limit, 10), parseInt(offset, 10));

    const rows = await query(`
      SELECT p.*, 
             cu.full_name as created_by_name,
             au.full_name as approved_by_name
      FROM payments p
      JOIN users cu ON cu.id = p.created_by
      LEFT JOIN users au ON au.id = p.approved_by
      ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT $${pIdx++} OFFSET $${pIdx}
    `, params);

    return { data: rows, count: rows.length };
  });

  // 2. Export All Payments to CSV or JSON (M3)
  app.get('/payments/export', async (request: FastifyRequest<{ Querystring: { format?: string } }>, reply) => {
    const format = (request.query.format || 'csv').toLowerCase();

    const rows = await query(`
      SELECT p.id, p.idempotency_key, p.amount_cents, p.currency, p.corridor,
             p.beneficiary_name, p.beneficiary_account, p.status,
             cu.full_name as created_by, au.full_name as approved_by,
             p.created_at, p.updated_at
      FROM payments p
      JOIN users cu ON cu.id = p.created_by
      LEFT JOIN users au ON au.id = p.approved_by
      ORDER BY p.created_at DESC
    `);

    if (format === 'json') {
      reply.header('Content-Type', 'application/json');
      reply.header('Content-Disposition', 'attachment; filename="payments_export.json"');
      return { data: rows };
    }

    const headers = ['id', 'idempotency_key', 'amount_cents', 'currency', 'corridor', 'beneficiary_name', 'beneficiary_account', 'status', 'created_by', 'approved_by', 'created_at', 'updated_at'];
    const csvLines = [headers.join(',')];

    for (const r of rows) {
      const line = [
        r.id,
        r.idempotency_key,
        r.amount_cents,
        r.currency,
        r.corridor,
        `"${(r.beneficiary_name || '').replace(/"/g, '""')}"`,
        `"${(r.beneficiary_account || '').replace(/"/g, '""')}"`,
        r.status,
        `"${(r.created_by || '').replace(/"/g, '""')}"`,
        `"${(r.approved_by || '').replace(/"/g, '""')}"`,
        r.created_at instanceof Date ? r.created_at.toISOString() : (r.created_at || ''),
        r.updated_at instanceof Date ? r.updated_at.toISOString() : (r.updated_at || '')
      ];
      csvLines.push(line.join(','));
    }

    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', 'attachment; filename="payments_export.csv"');
    return reply.send(csvLines.join('\n'));
  });

  // 3. Create Payment with Real IP & User-Agent Captured to Audit Table
  app.post('/payments', async (request, reply) => {
    const body = createPaymentSchema.parse(request.body);
    const idempotencyKey = body.idempotency_key || uuidv4();
    const { ip, ua } = getClientMeta(request);

    const users = await query(`SELECT id, role FROM users WHERE email = $1`, [body.actor_email]);
    if (users.length === 0) return reply.status(400).send({ error: 'Actor user not found' });

    const actor = users[0];

    try {
      const rows = await query(
        `INSERT INTO payments (
          idempotency_key, amount_cents, currency,
          beneficiary_name, beneficiary_account, corridor,
          status, created_by
        ) VALUES ($1,$2,$3,$4,$5,$6,'DRAFT',$7)
        RETURNING *`,
        [
          idempotencyKey,
          body.amount_cents,
          body.currency.toUpperCase(),
          body.beneficiary_name,
          body.beneficiary_account,
          body.corridor,
          actor.id,
        ]
      );

      await query(
        `INSERT INTO audit_log (payment_id, actor_id, action, to_status, note, ip_address, user_agent)
         VALUES ($1, $2, 'CREATE', 'DRAFT', 'Payment created', $3, $4)`,
        [rows[0].id, actor.id, ip, ua]
      );

      return reply.status(201).send({ data: rows[0] });
    } catch (err: any) {
      if (err.code === '23505') {
        const existing = await query(`SELECT * FROM payments WHERE idempotency_key = $1`, [idempotencyKey]);
        return reply.status(200).send({ data: existing[0], idempotent: true });
      }
      throw err;
    }
  });

  // 4. Transition State with Maker-Checker & Real Audit Tracking
  app.post<{ Params: { id: string } }>('/payments/:id([0-9a-fA-F-]{36})/transition', async (request, reply) => {
    const { id } = request.params;
    const body = transitionSchema.parse(request.body);
    const { ip, ua } = getClientMeta(request);

    const rule = TRANSITIONS[body.action];
    if (!rule) return reply.status(400).send({ error: 'Unknown action' });

    const actors = await query(`SELECT id, role, full_name FROM users WHERE email = $1`, [body.actor_email]);
    if (actors.length === 0) return reply.status(400).send({ error: 'Actor not found' });
    const actor = actors[0];

    if (!rule.roles.includes(actor.role)) {
      return reply.status(403).send({ error: `Role ${actor.role} cannot perform ${body.action}` });
    }

    const payments = await query(`SELECT * FROM payments WHERE id = $1`, [id]);
    if (payments.length === 0) return reply.status(404).send({ error: 'Payment not found' });
    const payment = payments[0];

    if (!rule.from.includes(payment.status)) {
      return reply.status(400).send({
        error: `Cannot ${body.action} from status ${payment.status}`,
      });
    }

    if (body.action === 'approve' && payment.created_by === actor.id) {
      return reply.status(403).send({ error: 'Maker-checker violation: creator cannot approve their own payment' });
    }

    const updated = await query(
      `UPDATE payments
       SET status = $1,
           approved_by = CASE WHEN $2 = 'approve' THEN $3 ELSE approved_by END,
           failure_reason = CASE WHEN $2 = 'fail' THEN $4 ELSE failure_reason END,
           updated_at = now()
       WHERE id = $5
       RETURNING *`,
      [rule.to, body.action, actor.id, body.note || null, id]
    );

    await query(
      `INSERT INTO audit_log (payment_id, actor_id, action, from_status, to_status, note, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, actor.id, body.action.toUpperCase(), payment.status, rule.to, body.note || null, ip, ua]
    );

    return { data: updated[0] };
  });

  // 5. Get Single Payment + Complete Real Audit Trail
  app.get<{ Params: { id: string } }>('/payments/:id([0-9a-fA-F-]{36})', async (request, reply) => {
    const { id } = request.params;

    const payments = await query(
      `SELECT p.*, 
              cu.full_name as created_by_name,
              au.full_name as approved_by_name
       FROM payments p
       JOIN users cu ON cu.id = p.created_by
       LEFT JOIN users au ON au.id = p.approved_by
       WHERE p.id = $1`,
      [id]
    );

    if (payments.length === 0) return reply.status(404).send({ error: 'Not found' });

    const audit = await query(
      `SELECT a.*, u.full_name as actor_name, u.role as actor_role
       FROM audit_log a
       JOIN users u ON u.id = a.actor_id
       WHERE a.payment_id = $1
       ORDER BY a.created_at ASC`,
      [id]
    );

    return { data: payments[0], audit };
  });

  // 6. Export Payment Audit Trail (CSV) (M3)
  app.get<{ Params: { id: string } }>('/payments/:id([0-9a-fA-F-]{36})/audit/export', async (request, reply) => {
    const { id } = request.params;

    const audit = await query(
      `SELECT a.id, a.payment_id, a.action, a.from_status, a.to_status, 
              a.note, a.ip_address, a.user_agent, a.created_at,
              u.full_name as actor_name, u.role as actor_role
       FROM audit_log a
       JOIN users u ON u.id = a.actor_id
       WHERE a.payment_id = $1
       ORDER BY a.created_at ASC`,
      [id]
    );

    const headers = ['id', 'action', 'from_status', 'to_status', 'actor_name', 'actor_role', 'note', 'ip_address', 'user_agent', 'created_at'];
    const csvLines = [headers.join(',')];

    for (const a of audit) {
      const line = [
        a.id,
        a.action,
        a.from_status || '',
        a.to_status || '',
        `"${(a.actor_name || '').replace(/"/g, '""')}"`,
        a.actor_role,
        `"${(a.note || '').replace(/"/g, '""')}"`,
        `"${a.ip_address || ''}"`,
        `"${(a.user_agent || '').replace(/"/g, '""')}"`,
        a.created_at instanceof Date ? a.created_at.toISOString() : (a.created_at || '')
      ];
      csvLines.push(line.join(','));
    }

    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', `attachment; filename="audit_${id}.csv"`);
    return reply.send(csvLines.join('\n'));
  });
}