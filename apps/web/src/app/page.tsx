'use client';

import { useState, useEffect } from 'react';
import {
  fetchPayments,
  fetchPaymentDetail,
  transitionPayment,
  createPayment,
  Payment,
  AuditEntry,
  API_BASE
} from '../lib/api';
import {
  Plus,
  RefreshCw,
  Download,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRightLeft
} from 'lucide-react';

const ACTORS = [
  { email: 'operator@sur.payments', name: 'Ana Operator', role: 'OPERATOR' },
  { email: 'approver@sur.payments', name: 'Carlos Approver', role: 'APPROVER' },
  { email: 'admin@sur.payments', name: 'Diego Admin', role: 'ADMIN' },
];

export default function Dashboard() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [activeActor, setActiveActor] = useState(ACTORS[0]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);

  const [formBeneficiary, setFormBeneficiary] = useState('Mariana Silva');
  const [formAccount, setFormAccount] = useState('BR5511988887777');
  const [formAmount, setFormAmount] = useState('1850.00');
  const [formCorridor, setFormCorridor] = useState('USD-BRL');

  const loadData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const filters: Record<string, string> = {};
      if (statusFilter !== 'ALL') filters.status = statusFilter;
      const res = await fetchPayments(filters);
      setPayments(res.data || []);
      if (selectedPayment) {
        const detail = await fetchPaymentDetail(selectedPayment.id);
        setSelectedPayment(detail.data);
        setAuditLog(detail.audit || []);
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const selectPayment = async (p: Payment) => {
    setSelectedPayment(p);
    try {
      const res = await fetchPaymentDetail(p.id);
      setAuditLog(res.audit || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleTransition = async (action: string) => {
    if (!selectedPayment) return;
    setErrorMsg(null);
    try {
      await transitionPayment(selectedPayment.id, action, activeActor.email);
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      await createPayment({
        amount_cents: Math.round(parseFloat(formAmount) * 100),
        currency: 'USD',
        beneficiary_name: formBeneficiary,
        beneficiary_account: formAccount,
        corridor: formCorridor,
        actor_email: activeActor.email,
      });
      setIsNewModalOpen(false);
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const isCreator = selectedPayment && selectedPayment.created_by_name === activeActor.name;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-30 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 text-white px-2.5 py-1.5 rounded-lg font-bold text-sm">SUR</div>
          <div>
            <h1 className="font-bold text-slate-900">LatAm Payments Control Plane</h1>
            <p className="text-xs text-slate-500">Maker-Checker • SPEI / PIX Orchestration</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
            {ACTORS.map((act) => (
              <button
                key={act.email}
                onClick={() => setActiveActor(act)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium ${
                  activeActor.email === act.email
                    ? 'bg-white shadow text-slate-900'
                    : 'text-slate-600'
                }`}
              >
                {act.name}
              </button>
            ))}
          </div>

          <button
            onClick={() => setIsNewModalOpen(true)}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg"
          >
            <Plus className="w-4 h-4" /> New Instruction
          </button>
        </div>
      </header>

      <main className="p-6 max-w-7xl mx-auto space-y-5">
        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {errorMsg}
          </div>
        )}

        {/* Filters */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex gap-2">
            {['ALL', 'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PROCESSING', 'SETTLED'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                  statusFilter === st ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {st.replace('_', ' ')}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <a
              href={`${API_BASE}/payments/export?format=csv`}
              className="flex items-center gap-1.5 border border-slate-300 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-50"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </a>
            <button onClick={loadData} className="p-2 border border-slate-300 rounded-lg hover:bg-slate-50">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-5">
          {/* Payment List */}
          <div className="col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase">
              Live Instruction Queue ({payments.length})
            </div>
            <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
              {payments.map((p) => (
                <div
                  key={p.id}
                  onClick={() => selectPayment(p)}
                  className={`p-4 cursor-pointer hover:bg-slate-50 ${
                    selectedPayment?.id === p.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                  }`}
                >
                  <div className="flex justify-between">
                    <span className="font-semibold">{p.beneficiary_name}</span>
                    <span className="font-mono font-bold">
                      ${(parseInt(p.amount_cents) / 100).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between mt-1 text-xs text-slate-500">
                    <span>{p.corridor} • {p.beneficiary_account}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      p.status === 'SETTLED' ? 'bg-emerald-100 text-emerald-800' :
                      p.status === 'PENDING_APPROVAL' ? 'bg-amber-100 text-amber-800' :
                      p.status === 'APPROVED' ? 'bg-blue-100 text-blue-800' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {p.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Detail Panel */}
          <div className="col-span-5 bg-white border border-slate-200 rounded-xl p-5">
            {selectedPayment ? (
              <div className="space-y-5">
                <div>
                  <div className="text-xs text-slate-400 font-mono">{selectedPayment.id}</div>
                  <h2 className="text-2xl font-bold mt-1">
                    ${(parseInt(selectedPayment.amount_cents) / 100).toLocaleString()}
                  </h2>
                  <p className="text-sm text-slate-600">
                    {selectedPayment.beneficiary_name} • {selectedPayment.corridor}
                  </p>
                </div>

                {/* Actions */}
                <div className="bg-slate-50 p-4 rounded-xl border space-y-3">
                  <div className="text-xs font-bold text-slate-500 uppercase">Actions ({activeActor.role})</div>
                  
                  {selectedPayment.status === 'DRAFT' && (
                    <button
                      onClick={() => handleTransition('submit')}
                      className="w-full py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg"
                    >
                      Submit for Approval
                    </button>
                  )}

                  {selectedPayment.status === 'PENDING_APPROVAL' && (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleTransition('approve')}
                        disabled={!!isCreator}
                        className={`py-2 text-sm font-semibold rounded-lg flex items-center justify-center gap-1 ${
                          isCreator
                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            : 'bg-emerald-600 text-white'
                        }`}
                      >
                        <CheckCircle2 className="w-4 h-4" /> Approve
                      </button>
                      <button
                        onClick={() => handleTransition('reject')}
                        className="py-2 bg-red-600 text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-1"
                      >
                        <XCircle className="w-4 h-4" /> Reject
                      </button>
                      {isCreator && (
                        <p className="col-span-2 text-xs text-amber-700 bg-amber-50 p-2 rounded">
                          Maker-Checker: You created this payment. Another user must approve.
                        </p>
                      )}
                    </div>
                  )}

                  {selectedPayment.status === 'APPROVED' && (
                    <button
                      onClick={() => handleTransition('process')}
                      className="w-full py-2 bg-purple-600 text-white text-sm font-semibold rounded-lg"
                    >
                      Process Payment
                    </button>
                  )}

                  {selectedPayment.status === 'PROCESSING' && (
                    <button
                      onClick={() => handleTransition('settle')}
                      className="w-full py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg"
                    >
                      Mark as Settled
                    </button>
                  )}
                </div>

                {/* Audit Log */}
                <div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase mb-2">Audit Trail</h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {auditLog.map((log) => (
                      <div key={log.id} className="text-xs p-2 bg-slate-50 rounded border">
                        <div className="flex justify-between">
                          <span className="font-semibold">{log.action}</span>
                          <span className="text-slate-400">{new Date(log.created_at).toLocaleTimeString()}</span>
                        </div>
                        <div className="text-slate-600">{log.actor_name} ({log.actor_role})</div>
                        {log.note && <div className="italic text-slate-500">"{log.note}"</div>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-slate-400 text-sm">
                Select a payment to view details and take actions
              </div>
            )}
          </div>
        </div>
      </main>

      {/* New Payment Modal */}
      {isNewModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-4">
            <h2 className="font-bold text-lg">New Payment Instruction</h2>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600">Beneficiary</label>
                <input
                  value={formBeneficiary}
                  onChange={(e) => setFormBeneficiary(e.target.value)}
                  className="w-full mt-1 border rounded-lg px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Account / PIX / CLABE</label>
                <input
                  value={formAccount}
                  onChange={(e) => setFormAccount(e.target.value)}
                  className="w-full mt-1 border rounded-lg px-3 py-2 text-sm font-mono"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Amount (USD)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  className="w-full mt-1 border rounded-lg px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Corridor</label>
                <select
                  value={formCorridor}
                  onChange={(e) => setFormCorridor(e.target.value)}
                  className="w-full mt-1 border rounded-lg px-3 py-2 text-sm"
                >
                  <option value="USD-BRL">USD → BRL (PIX)</option>
                  <option value="USD-MXN">USD → MXN (SPEI)</option>
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="flex-1 border py-2 rounded-lg text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-semibold"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
