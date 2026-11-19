'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, CircleDollarSign, Clock3, PackageCheck, Route, Wallet } from 'lucide-react';
import { InventoryBatchEditor, ManagerBatchActions } from '@/components/action-forms';
import { PortalHeader } from '@/components/portal-header';
import { LoginForm } from '@/components/auth-form';
import { PortalApiError, apiRequest } from '@/lib/portal-api';
import type { PortalUser } from '@/lib/auth';
import { useHasHydrated } from '@/lib/use-hydrated';
import { dateTime, money, statusLabel } from '@/lib/format';
import type { Batch, WeeklySummary } from '@/lib/types';

interface ManagerDashboardData {
  user: PortalUser;
  supplier: { id: string; name: string } | null;
  workspaces: { id: string; name: string }[];
  active_workspace_id: string | null;
  batches: Batch[];
  summary: WeeklySummary;
}

function StatusBadge({ status }: { status: string }) {
  const classes = status === 'completed' ? 'bg-emerald-100 text-emerald-800'
    : status === 'in_transit' ? 'bg-sky-100 text-sky-800'
      : status === 'paid' ? 'bg-violet-100 text-violet-800'
      : status === 'disputed' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800';
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${classes}`}>{statusLabel(status)}</span>;
}

export default function ManagerPage() {
  const router = useRouter();
  const [dashboard, setDashboard] = useState<ManagerDashboardData | null>(null);
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
        const data = await apiRequest<ManagerDashboardData>('offtake.php?action=manager_dashboard');
        if (!active) return;
        if (data.user.role !== 'manager') {
          router.replace(data.user.role === 'admin' ? '/admin/' : '/login/');
          return;
        }
        if (active) {
          setNeedsLogin(false);
          setProfile(data.user);
          setDashboard(data);
        }
      } catch (reason) {
        if (!active) return;
        if (reason instanceof PortalApiError && reason.status === 403 && reason.redirectTo === '/admin/') {
          router.replace('/admin/');
          return;
        }
        if (reason instanceof PortalApiError && reason.status === 401) {
          setNeedsLogin(true);
          setProfile(null);
          setDashboard(null);
          return;
        }
        setNeedsLogin(false);
        setError(reason instanceof Error ? reason.message : 'Unable to load the company dashboard.');
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
          Loading company dashboard…
        </div>
        <p className="text-sm text-[var(--muted)]">Need to sign in? <Link href="/login/" className="font-semibold text-[var(--green)] underline">Go to manager sign in</Link></p>
      </div>
    </main>
  );

  if (needsLogin) return (
    <>
      <PortalHeader name="Company manager" />
      <main className="mx-auto grid min-h-[calc(100vh-73px)] max-w-7xl place-items-center px-4 py-12 sm:px-6">
        <section className="surface w-full max-w-md p-6 sm:p-8">
          <Link href="/" className="text-xs font-bold uppercase tracking-wider text-[var(--green)]">← Back to overview</Link>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight">Manager sign in</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">Sign in to open your company operations dashboard.</p>
          {error && <p role="alert" className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
          <div className="mt-7">
            <LoginForm
              expectedRole="manager"
            />
          </div>
        </section>
      </main>
    </>
  );

  if (error || !dashboard || !profile) return (
    <main className="mx-auto grid min-h-screen max-w-xl place-items-center px-4">
      <section className="surface w-full p-6 text-center">
        <h1 className="text-xl font-semibold">Dashboard unavailable</h1>
        <p role="alert" className="mt-2 text-sm text-rose-800">{error || 'Your manager session could not be verified.'}</p>
        <button className="button-primary mt-5" onClick={() => setRefreshKey((key) => key + 1)}>Try again</button>
      </section>
    </main>
  );
  const refresh = () => setRefreshKey((key) => key + 1);
  if (!dashboard.supplier) {
    return (
      <>
        <PortalHeader name={profile.full_name || profile.email} email={profile.email} role="manager" />
        <main className="mx-auto grid min-h-[70vh] max-w-3xl place-items-center px-4 py-12">
          <section className="surface w-full p-7 text-center sm:p-10">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-50 text-amber-700"><Clock3 size={25} /></span>
            <h1 className="mt-5 text-2xl font-semibold">Company assignment pending</h1>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-[var(--muted)]">Your account is registered, but a platform administrator has not assigned it to a supplier company yet. Your operations dashboard will appear after assignment.</p>
            <Link href="/" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-[var(--green)]">Back to portal overview <ArrowRight size={16} /></Link>
          </section>
        </main>
      </>
    );
  }

  const { supplier, batches, summary } = dashboard;
  const header = (workspaceProps = true) => (
    <PortalHeader
      name={profile.full_name || profile.email}
      email={profile.email}
      role="manager"
      workspaces={workspaceProps ? dashboard.workspaces : undefined}
      activeWorkspaceId={workspaceProps ? dashboard.active_workspace_id : undefined}
      onWorkspaceChange={refresh}
    />
  );

  return (
    <>
      {header()}
      <main className="mx-auto max-w-6xl space-y-7 px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
        <section className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div><p className="text-xs font-bold uppercase tracking-[.15em] text-[var(--green)]">Company operations</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">{supplier.name}</h1><p className="mt-2 text-sm text-[var(--muted)]">Daily allocations, vehicle dispatch, and weekly credit summary.</p></div>
          <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-800">Manager access</span>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <article className="surface p-5"><div className="flex items-center justify-between"><p className="text-sm text-[var(--muted)]">Total invested amount</p><Wallet size={19} className="text-[var(--green)]" /></div><p className="mt-3 text-2xl font-semibold">{money(summary.total_invested_amount)}</p><p className="mt-1 text-xs text-[var(--muted)]">Capital deployed across all batches</p></article>
          <article className="surface p-5"><div className="flex items-center justify-between"><p className="text-sm text-[var(--muted)]">Total sales revenue</p><PackageCheck size={19} className="text-[var(--green)]" /></div><p className="mt-3 text-2xl font-semibold">{money(summary.total_sales_revenue)}</p><p className="mt-1 text-xs text-[var(--muted)]">Revenue from completed batches</p></article>
          <article className="surface p-5"><div className="flex items-center justify-between"><p className="text-sm text-[var(--muted)]">Active product batches</p><Route size={19} className="text-[var(--green)]" /></div><p className="mt-3 text-2xl font-semibold">{summary.active_batches}</p><p className="mt-1 text-xs text-[var(--muted)]">Entered, funded, or in transit</p></article>
          <article className="surface p-5"><div className="flex items-center justify-between"><p className="text-sm text-[var(--muted)]">Weekly payout to the investor</p><CircleDollarSign size={19} className="text-[var(--green)]" /></div><p className="mt-3 text-2xl font-semibold">{money(summary.net_credit_due)}</p><p className="mt-1 text-xs text-[var(--muted)]">Completed batches since {summary.week_start}</p></article>
        </section>

        <InventoryBatchEditor key={`${profile.id}:${supplier.id}`} managerId={profile.id} supplierId={supplier.id} onSaved={refresh} />

        <section>
          <div className="mb-4 flex items-end justify-between gap-3"><div><h2 className="text-xl font-semibold tracking-tight">Inventory &amp; order lifecycle</h2><p className="mt-1 text-sm text-[var(--muted)]">Fund a batch, mark dispatch, then complete after all units are sold.</p></div><span className="text-xs text-[var(--muted)]">{batches.length} recent records</span></div>
          <div className="grid gap-4">
            {batches.map((batch) => (
              <article key={batch.id} className="surface p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Product batch · {dateTime(batch.created_at)}</p><h3 className="mt-2 text-lg font-semibold">{batch.product_name || 'Legacy allocation'}</h3><p className="mt-1 text-sm text-[var(--muted)]">{batch.unit_quantity.toLocaleString()} units</p></div>
                  <StatusBadge status={batch.status} />
                </div>
                <div className="mt-5 grid grid-cols-2 gap-4 border-y border-[var(--line)] py-4 sm:grid-cols-3 lg:grid-cols-5">
                  <div><p className="text-[11px] text-[var(--muted)]">INITIAL CAPITAL</p><p className="mt-1 font-semibold">{money(batch.accounting_model === 'inventory' ? batch.initial_purchase_amount : batch.total_capital)}</p></div>
                  <div><p className="text-[11px] text-[var(--muted)]">DISCOUNTED REVENUE</p><p className="mt-1 font-semibold">{money(batch.accounting_model === 'inventory' ? batch.discounted_revenue : batch.total_revenue)}</p></div>
                  <div><p className="text-[11px] text-[var(--muted)]">GROSS PROFIT</p><p className="mt-1 font-semibold">{money(batch.accounting_model === 'inventory' ? batch.gross_profit : batch.total_revenue - batch.total_capital)}</p></div>
                  <div><p className="text-[11px] text-[var(--muted)]">MANAGER ALLOWANCE</p><p className="mt-1 font-semibold">{money(batch.accounting_model === 'inventory' ? batch.manager_allowance_amount : batch.fuel_subsidy_per_unit * batch.unit_quantity)}</p></div>
                  <div><p className="text-[11px] text-[var(--muted)]">PAYOUT TO INVESTOR</p><p className="mt-1 font-semibold text-[var(--green)]">{money(batch.accounting_model === 'inventory' ? batch.net_company_payout : batch.net_investor_credit)}</p></div>
                </div>
                {batch.destination_route && <p className="mt-4 text-xs text-[var(--muted)]">Route: <strong className="text-[var(--ink)]">{batch.destination_route}</strong></p>}
                {(batch.vehicle_reference || batch.driver_name || batch.driver_phone) && (
                  <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-[var(--muted)]">
                    {batch.vehicle_reference && <span>Vehicle: <strong className="text-[var(--ink)]">{batch.vehicle_reference}</strong></span>}
                    {batch.driver_name && <span>Driver: <strong className="text-[var(--ink)]">{batch.driver_name}</strong></span>}
                    {batch.driver_phone && <span>Driver phone: <strong className="text-[var(--ink)]">{batch.driver_phone}</strong></span>}
                  </div>
                )}
                <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-xs text-[var(--muted)]"><p>Dispatched: {dateTime(batch.dispatched_at)}</p><p className="mt-1">Delivered: {dateTime(batch.completed_at)}</p></div>
                  <div className="w-full sm:w-64"><ManagerBatchActions batch={batch} onSaved={refresh} /></div>
                </div>
                {batch.accounting_model === 'inventory' && batch.status === 'pending' && (
                  <InventoryBatchEditor managerId={profile.id} supplierId={supplier.id} batch={batch} onSaved={refresh} />
                )}
              </article>
            ))}
            {!batches.length && <div className="surface p-10 text-center"><PackageCheck className="mx-auto text-[var(--muted)]" /><p className="mt-3 font-semibold">No product batches yet</p><p className="mt-1 text-sm text-[var(--muted)]">Add the first batch above to begin tracking inventory.</p></div>}
          </div>
        </section>
        <p className="text-center text-xs text-[var(--muted)]">Completed batches are locked and included in the purchasing company’s weekly payout.</p>
      </main>
    </>
  );
}
