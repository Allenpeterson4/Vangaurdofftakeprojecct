 'use client';

import { useEffect, useState } from 'react';
 import Link from 'next/link';
 import { useRouter } from 'next/navigation';
import { AlertTriangle, ArrowDownToLine, Building2, CircleDollarSign, Factory, PackageCheck, Users } from 'lucide-react';
import { AdminBatchStatusForm, AssignManagerForm, BatchForm, SupplierForm, WeeklyPayoutForm } from '@/components/action-forms';
import { PortalHeader } from '@/components/portal-header';
import { LoginForm } from '@/components/auth-form';
import { PortalApiError, apiRequest } from '@/lib/portal-api';
import type { PortalUser } from '@/lib/auth';
import { useHasHydrated } from '@/lib/use-hydrated';
import { dateTime, money, statusLabel } from '@/lib/format';
import type { AdminSettlement, Batch, ManagerProfile, Supplier } from '@/lib/types';

interface AdminDashboardData {
  user: PortalUser;
  suppliers: Supplier[];
  managers: ManagerProfile[];
  batches: (Batch & { supplier_name: string })[];
  metrics: { active_capital: number; weekly_net_yield: number; pending_weekly_payouts: number; active_batches: number };
  settlements: AdminSettlement[];
  payout_history: {
    id: number | string;
    supplier_id: string;
    supplier_name: string;
    week_start: string;
    amount: number;
    paid_by_email: string;
    transfer_reference: string;
    paid_at: string;
  }[];
  audit: { id: number | string; batch_id: string; old_status: string | null; new_status: string; actor_email: string | null; occurred_at: string }[];
}

function StatCard({ title, value, detail, icon: Icon }: { title: string; value: string; detail: string; icon: typeof Building2 }) {
  return (
    <article className="surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-sm font-medium text-[var(--muted)]">{title}</p><p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p><p className="mt-1 text-xs text-[var(--muted)]">{detail}</p></div>
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--mint)] text-[var(--green)]"><Icon size={19} /></span>
      </div>
    </article>
  );
}

function StatusBadge({ status }: { status: string }) {
  const classes = status === 'completed' ? 'bg-emerald-100 text-emerald-800'
    : status === 'in_transit' ? 'bg-sky-100 text-sky-800'
      : status === 'paid' ? 'bg-violet-100 text-violet-800'
      : status === 'disputed' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800';
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${classes}`}>{statusLabel(status)}</span>;
}

export default function AdminPage() {
  const router = useRouter();
  const [dashboard, setDashboard] = useState<AdminDashboardData | null>(null);
  const [profile, setProfile] = useState<PortalUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsLogin, setNeedsLogin] = useState(true);
  const hasMounted = useHasHydrated();
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    async function loadDashboard() {
      setLoading(true);
      setError('');
      try {
        const data = await apiRequest<AdminDashboardData>('offtake.php?action=admin_dashboard');
        if (!active) return;
        if (data.user.role !== 'admin') {
          router.replace(data.user.role === 'manager' ? '/manager/' : '/admin/');
          return;
        }
        if (active) {
          setNeedsLogin(false);
          setProfile(data.user);
          setDashboard(data);
        }
      } catch (reason) {
        if (!active) return;
        if (reason instanceof PortalApiError && reason.status === 403 && reason.redirectTo === '/manager/') {
          router.replace('/manager/');
          return;
        }
        if (reason instanceof PortalApiError && reason.status === 401) {
          setNeedsLogin(true);
          setProfile(null);
          setDashboard(null);
          return;
        }
        setNeedsLogin(false);
        setError(reason instanceof Error ? reason.message : 'Unable to load the admin dashboard.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadDashboard();
    return () => { active = false; };
  }, [refreshKey, router]);

  if (hasMounted && loading && !dashboard) return (
    <main className="grid min-h-screen place-items-center px-4" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center gap-3 text-sm text-[var(--muted)]">
          <span aria-hidden="true" className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--line)] border-t-[var(--green)]" />
          Loading platform dashboard…
        </div>
      </div>
    </main>
  );

  if (needsLogin) return (
    <>
      <PortalHeader name="Platform administrator" />
      <main className="mx-auto grid min-h-[calc(100vh-73px)] max-w-7xl place-items-center px-4 py-12 sm:px-6">
        <section className="surface w-full max-w-md p-6 sm:p-8">
          <Link href="/" className="text-xs font-bold uppercase tracking-wider text-[var(--green)]">← Back to overview</Link>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight">Administrator sign in</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">Sign in with your platform administrator account to manage suppliers and allocations.</p>
          {error && <p role="alert" className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
          <div className="mt-7">
            <LoginForm
              allowRegistration={false}
              expectedRole="admin"
            />
          </div>
          <p className="mt-5 text-center text-sm text-slate-600">Need administrator access? <Link href="/admin/setup/" className="font-bold text-[var(--green)] underline">View setup instructions</Link></p>
        </section>
      </main>
    </>
  );

  if (error || !dashboard || !profile) return (
    <main className="mx-auto grid min-h-screen max-w-xl place-items-center px-4">
      <section className="surface w-full p-6 text-center">
        <h1 className="text-xl font-semibold">Dashboard unavailable</h1>
        <p role="alert" className="mt-2 text-sm text-rose-800">{error || 'Your administrator session could not be verified.'}</p>
        <button className="button-primary mt-5" onClick={() => setRefreshKey((key) => key + 1)}>Try again</button>
      </section>
    </main>
  );

  const { suppliers, managers, batches, metrics, settlements, payout_history: payoutHistory, audit } = dashboard;
  const refresh = () => setRefreshKey((key) => key + 1);
  const supplierById = new Map(suppliers.map((supplier) => [supplier.id, supplier.name]));

  return (
    <>
      <PortalHeader name={profile.full_name || profile.email} email={profile.email} role="admin" />
      <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <section className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div><p className="text-xs font-bold uppercase tracking-[.15em] text-[var(--green)]">Platform control</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Operations overview</h1><p className="mt-2 text-sm text-[var(--muted)]">Manage company partners, daily allocations, managers, and settlement activity.</p></div>
          <div className="rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-xs text-[var(--muted)]"><span className="font-bold text-[var(--ink)]">{suppliers.length}</span> supplier companies · <span className="font-bold text-[var(--ink)]">{managers.length}</span> manager accounts</div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5" aria-label="Platform metrics">
          <StatCard title="Active capital" value={money(metrics.active_capital)} detail="Pending and in-transit allocations" icon={CircleDollarSign} />
          <StatCard title="Net yield this week" value={money(metrics.weekly_net_yield)} detail="Completed batches this week" icon={ArrowDownToLine} />
          <StatCard title="Weekly payouts due" value={money(metrics.pending_weekly_payouts)} detail="Completed but not recorded as paid" icon={CircleDollarSign} />
          <StatCard title="Active batches" value={String(metrics.active_batches)} detail="Currently open for operations" icon={PackageCheck} />
          <StatCard title="Company partners" value={String(suppliers.length)} detail="Independent supplier accounts" icon={Building2} />
        </section>

        <section className="grid gap-6 xl:grid-cols-[.8fr_1.2fr]">
          <article className="surface p-5 sm:p-6">
            <div className="mb-5 flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--mint)] text-[var(--green)]"><Factory size={18} /></span><div><h2 className="font-semibold">Add a company</h2><p className="text-xs text-[var(--muted)]">Register a supplier or factory partner.</p></div></div>
            <SupplierForm onSaved={refresh} />
          </article>
          <article className="surface p-5 sm:p-6">
            <div className="mb-5 flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--mint)] text-[var(--green)]"><Users size={18} /></span><div><h2 className="font-semibold">Add a company manager</h2><p className="text-xs text-[var(--muted)]">Managers register through the public registration page.</p></div></div>
            <p className="text-sm leading-6 text-[var(--muted)]">Once a manager creates an account, their name and email appear in the manager list below. Assign their account to a company there to grant access.</p>
          </article>
        </section>

        <section className="surface p-5 sm:p-6">
          <div className="mb-5 flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--mint)] text-[var(--green)]"><PackageCheck size={18} /></span><div><h2 className="font-semibold">Create a daily allocation</h2><p className="text-xs text-[var(--muted)]">Financial totals are calculated by Supabase. Managers can also add product batches from their workspace.</p></div></div>
          <BatchForm suppliers={suppliers} onSaved={refresh} />
        </section>

        <section id="manager-users" className="surface overflow-hidden">
          <div className="flex items-center justify-between gap-4 border-b border-[var(--line)] px-5 py-4 sm:px-6"><div><h2 className="font-semibold">Company managers</h2><p className="mt-1 text-xs text-[var(--muted)]">Select one or more authorized company workspaces for each manager.</p></div><Users className="text-[var(--muted)]" size={19} /></div>
          {managers.length ? (
            <div className="divide-y divide-[var(--line)]">
              {managers.map((manager) => (
                <div key={manager.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <div><p className="text-sm font-semibold">{manager.full_name || 'Manager account'}</p><p className="mt-0.5 text-xs text-[var(--muted)]">{manager.email} · {manager.supplier_ids.length ? manager.supplier_ids.map((id) => supplierById.get(id) ?? 'Company unavailable').join(', ') : 'No company assigned'}</p></div>
                  <AssignManagerForm manager={manager} suppliers={suppliers} onSaved={refresh} />
                </div>
              ))}
            </div>
          ) : <p className="px-6 py-8 text-sm text-[var(--muted)]">No manager accounts yet. Invite one above or ask managers to register.</p>}
        </section>

        <section className="surface overflow-hidden">
          <div className="border-b border-[var(--line)] px-5 py-4 sm:px-6"><h2 className="font-semibold">Automated batch ledger</h2><p className="mt-1 text-xs text-[var(--muted)]">Showing the latest {batches.length} allocations across all companies.</p></div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr>{['Company / product', 'Units', 'Capital', 'Revenue', 'Payout due', 'Status / timestamps'].map((head) => <th key={head} className="px-5 py-3 font-bold">{head}</th>)}<th className="px-5 py-3">Admin action</th></tr></thead>
              <tbody className="divide-y divide-[var(--line)]">
                {batches.map((batch) => (
                  <tr key={batch.id} className="align-top">
                    <td className="px-5 py-4"><p className="font-semibold">{supplierById.get(batch.supplier_id) ?? 'Unknown company'}</p><p className="mt-1 max-w-52 text-slate-500">{batch.product_name || batch.destination_route || 'Legacy allocation'}</p><p className="mt-1 text-[10px] text-slate-400">{[batch.destination_route, batch.vehicle_reference, batch.driver_name].filter(Boolean).join(' · ')}</p><p className="mt-1 text-[10px] text-slate-400">{dateTime(batch.created_at)}</p></td>
                    <td className="px-5 py-4 font-semibold">{batch.unit_quantity.toLocaleString()}</td>
                    <td className="px-5 py-4">{money(batch.accounting_model === 'inventory' ? batch.initial_purchase_amount : batch.total_capital)}</td>
                    <td className="px-5 py-4">{money(batch.accounting_model === 'inventory' ? batch.discounted_revenue : batch.total_revenue)}</td>
                    <td className="px-5 py-4 font-semibold text-[var(--green)]">{money(batch.accounting_model === 'inventory' ? batch.net_company_payout : batch.net_investor_credit)}</td>
                    <td className="px-5 py-4"><StatusBadge status={batch.status} /><p className="mt-2 text-slate-500">Dispatch: {dateTime(batch.dispatched_at)}</p>{batch.completed_at && <p className="mt-1 text-slate-500">Completed: {dateTime(batch.completed_at)}</p>}</td>
                    <td className="px-5 py-4"><AdminBatchStatusForm batch={batch} onSaved={refresh} /></td>
                  </tr>
                ))}
                {!batches.length && <tr><td colSpan={7} className="px-5 py-10 text-center text-sm text-[var(--muted)]">No allocations have been created.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
          <article className="surface overflow-hidden">
            <div className="border-b border-[var(--line)] px-5 py-4"><h2 className="font-semibold">Weekly settlement &amp; payout hub</h2><p className="mt-1 text-xs text-[var(--muted)]">Completed batches grouped by week and purchasing company. Record a company payout after it has been sent.</p></div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1500px] text-left text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr>{['Week', 'Purchasing company', 'Batches', 'Initial capital', 'Revenue', 'Gross profit', 'Manager allowance', 'Net profit', 'Payout due', 'Paid', 'Outstanding', 'Payout action'].map((head) => <th key={head} className="px-4 py-3">{head}</th>)}</tr></thead>
                <tbody className="divide-y divide-[var(--line)]">{settlements.map((settlement, index) => <tr key={`${settlement.week_start}-${settlement.supplier_id}-${index}`}>
                  <td className="px-4 py-3">{settlement.week_start}</td>
                  <td className="px-4 py-3 font-semibold">{settlement.supplier_name}</td>
                  <td className="px-4 py-3">{settlement.completed_batches}</td>
                  <td className="px-4 py-3">{money(settlement.deployed_capital)}</td>
                  <td className="px-4 py-3">{money(settlement.gross_sales_value)}</td>
                  <td className="px-4 py-3">{money(settlement.gross_profit)}</td>
                  <td className="px-4 py-3">{money(settlement.fuel_allowance)}</td>
                  <td className="px-4 py-3">{money(settlement.net_profit)}</td>
                  <td className="px-4 py-3 font-semibold text-[var(--green)]">{money(settlement.net_investor_credit)}</td>
                  <td className="px-4 py-3">{money(settlement.paid_amount)}</td>
                  <td className="px-4 py-3 font-semibold">{money(settlement.pending_payout)}</td>
                  <td className="px-4 py-3"><WeeklyPayoutForm supplierId={settlement.supplier_id} weekStart={settlement.week_start} amount={settlement.pending_payout} paidAmount={settlement.paid_amount} netCredit={settlement.net_investor_credit} onSaved={refresh} /></td>
                </tr>)}
                  {!settlements.length && <tr><td colSpan={12} className="px-4 py-8 text-center text-[var(--muted)]">No completed settlements this period.</td></tr>}
                </tbody>
              </table>
            </div>
          </article>
          <article className="surface p-5">
            <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-amber-50 text-amber-700"><AlertTriangle size={18} /></span><div><h2 className="font-semibold">Recent status audit</h2><p className="text-xs text-[var(--muted)]">Timestamped changes by portal account.</p></div></div>
            <ol className="mt-5 space-y-4">{audit.map((entry) => <li key={entry.id} className="border-l-2 border-[var(--line)] pl-3"><p className="text-xs font-semibold">{entry.old_status ? `${statusLabel(entry.old_status)} → ` : ''}{statusLabel(entry.new_status)}</p><p className="mt-1 text-[11px] text-[var(--muted)]">{entry.actor_email || 'System'} · {dateTime(entry.occurred_at)}</p></li>)}{!audit.length && <li className="text-sm text-[var(--muted)]">No status changes yet.</li>}</ol>
          </article>
        </section>

        <section className="surface overflow-hidden">
          <div className="border-b border-[var(--line)] px-5 py-4 sm:px-6"><h2 className="font-semibold">Weekly payout audit</h2><p className="mt-1 text-xs text-[var(--muted)]">Recorded payout to the purchasing company, settlement period, reference, and administrator.</p></div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr>{['Paid at', 'Company', 'Week', 'Amount', 'Transfer reference', 'Recorded by'].map((head) => <th key={head} className="px-4 py-3">{head}</th>)}</tr></thead>
              <tbody className="divide-y divide-[var(--line)]">{payoutHistory.map((payout) => <tr key={payout.id}>
                <td className="px-4 py-3">{dateTime(payout.paid_at)}</td>
                <td className="px-4 py-3 font-semibold">{payout.supplier_name}</td>
                <td className="px-4 py-3">{payout.week_start}</td>
                <td className="px-4 py-3 font-semibold text-[var(--green)]">{money(payout.amount)}</td>
                <td className="px-4 py-3">{payout.transfer_reference || 'Not provided'}</td>
                <td className="px-4 py-3">{payout.paid_by_email}</td>
              </tr>)}
                {!payoutHistory.length && <tr><td colSpan={6} className="px-4 py-8 text-center text-[var(--muted)]">No weekly payouts have been recorded.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </main>
      <footer className="mx-auto max-w-7xl px-4 py-8 text-xs text-[var(--muted)] sm:px-6 lg:px-8">Private operations space · All times shown in your browser’s local timezone</footer>
    </>
  );
}
