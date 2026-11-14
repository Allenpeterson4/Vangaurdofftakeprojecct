'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Clock3, PackageCheck, Route, Wallet } from 'lucide-react';
import { ManagerBatchActions } from '@/components/action-forms';
import { PortalHeader } from '@/components/portal-header';
import { PortalApiError, apiRequest } from '@/lib/portal-api';
import type { PortalUser } from '@/lib/auth';
import { dateTime, money, statusLabel } from '@/lib/format';
import type { Batch, WeeklySummary } from '@/lib/types';

interface ManagerDashboardData {
  user: PortalUser;
  supplier: { id: string; name: string } | null;
  batches: Batch[];
  summary: WeeklySummary;
}

function StatusBadge({ status }: { status: string }) {
  const classes = status === 'completed' ? 'bg-emerald-100 text-emerald-800'
    : status === 'in_transit' ? 'bg-sky-100 text-sky-800'
      : status === 'disputed' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800';
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${classes}`}>{statusLabel(status)}</span>;
}

export default function ManagerPage() {
  const router = useRouter();
  const [dashboard, setDashboard] = useState<ManagerDashboardData | null>(null);
  const [profile, setProfile] = useState<PortalUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    async function loadDashboard() {
      setLoading(true);
      setError('');
      try {
        const data = await apiRequest<ManagerDashboardData>('offtake.php?action=manager_dashboard');
        if (data.user.role !== 'manager') {
          router.replace(data.user.role === 'admin' ? '/admin/' : '/login/');
          return;
        }
        if (active) {
          setProfile(data.user);
          setDashboard(data);
        }
      } catch (reason) {
        if (reason instanceof PortalApiError && reason.status === 401) {
          router.replace('/login/');
          return;
        }
        if (active) setError(reason instanceof Error ? reason.message : 'Unable to load the company dashboard.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadDashboard();
    return () => { active = false; };
  }, [refreshKey, router]);

  if (loading) return (
    <main className="grid min-h-screen place-items-center px-4" role="status" aria-live="polite">
      <div className="flex items-center gap-3 text-sm text-[var(--muted)]">
        <span aria-hidden="true" className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--line)] border-t-[var(--green)]" />
        Loading company dashboard…
      </div>
    </main>
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
        <PortalHeader name={profile.full_name || profile.email} role="manager" />
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
  const activeBatches = batches.filter((batch) => batch.status === 'pending' || batch.status === 'in_transit');

  return (
    <>
      <PortalHeader name={profile.full_name || profile.email} role="manager" />
      <main className="mx-auto max-w-6xl space-y-7 px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
        <section className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div><p className="text-xs font-bold uppercase tracking-[.15em] text-[var(--green)]">Company operations</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">{supplier.name}</h1><p className="mt-2 text-sm text-[var(--muted)]">Daily allocations, vehicle dispatch, and weekly credit summary.</p></div>
          <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-800">Manager access</span>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          <article className="surface p-5"><div className="flex items-center justify-between"><p className="text-sm text-[var(--muted)]">Weekly net credit</p><Wallet size={19} className="text-[var(--green)]" /></div><p className="mt-3 text-2xl font-semibold">{money(summary.net_credit_due)}</p><p className="mt-1 text-xs text-[var(--muted)]">Completed batches since {summary.week_start}</p></article>
          <article className="surface p-5"><div className="flex items-center justify-between"><p className="text-sm text-[var(--muted)]">Completed this week</p><PackageCheck size={19} className="text-[var(--green)]" /></div><p className="mt-3 text-2xl font-semibold">{summary.completed_batches}</p><p className="mt-1 text-xs text-[var(--muted)]">Locked in the settlement ledger</p></article>
          <article className="surface p-5"><div className="flex items-center justify-between"><p className="text-sm text-[var(--muted)]">Active allocations</p><Route size={19} className="text-[var(--green)]" /></div><p className="mt-3 text-2xl font-semibold">{activeBatches.length}</p><p className="mt-1 text-xs text-[var(--muted)]">Pending or currently in transit</p></article>
        </section>

        <section>
          <div className="mb-4 flex items-end justify-between gap-3"><div><h2 className="text-xl font-semibold tracking-tight">Daily allocations</h2><p className="mt-1 text-sm text-[var(--muted)]">Use the status action as the load leaves and when delivery is complete.</p></div><span className="text-xs text-[var(--muted)]">{batches.length} recent records</span></div>
          <div className="grid gap-4">
            {batches.map((batch) => (
              <article key={batch.id} className="surface p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Allocation · {dateTime(batch.created_at)}</p><h3 className="mt-2 text-lg font-semibold">{batch.unit_quantity.toLocaleString()} units</h3></div>
                  <StatusBadge status={batch.status} />
                </div>
                <div className="mt-5 grid grid-cols-2 gap-4 border-y border-[var(--line)] py-4 sm:grid-cols-4">
                  <div><p className="text-[11px] text-[var(--muted)]">CAPITAL DEPLOYED</p><p className="mt-1 font-semibold">{money(batch.total_capital)}</p></div>
                  <div><p className="text-[11px] text-[var(--muted)]">GROSS REVENUE</p><p className="mt-1 font-semibold">{money(batch.total_revenue)}</p></div>
                  <div><p className="text-[11px] text-[var(--muted)]">NET INVESTOR CREDIT</p><p className="mt-1 font-semibold text-[var(--green)]">{money(batch.net_investor_credit)}</p></div>
                  <div><p className="text-[11px] text-[var(--muted)]">ROUTE</p><p className="mt-1 font-semibold">{batch.destination_route || 'Route not set'}</p></div>
                </div>
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
              </article>
            ))}
            {!batches.length && <div className="surface p-10 text-center"><PackageCheck className="mx-auto text-[var(--muted)]" /><p className="mt-3 font-semibold">No allocations yet</p><p className="mt-1 text-sm text-[var(--muted)]">Your company administrator will add today’s batch here.</p></div>}
          </div>
        </section>
        <p className="text-center text-xs text-[var(--muted)]">Completed allocations are locked and included in weekly settlement summaries.</p>
      </main>
    </>
  );
}
