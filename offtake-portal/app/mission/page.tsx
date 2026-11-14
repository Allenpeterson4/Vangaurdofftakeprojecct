import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BadgeCheck, Banknote, Factory, Gauge } from 'lucide-react';
import { PortalHeader } from '@/components/portal-header';

export const metadata: Metadata = {
  title: 'Our Mission & Value',
  description: 'Our mission is to connect production capacity with reliable off-take capital and efficient distribution.',
};

const values = [
  {
    icon: Factory,
    title: 'Zero sales friction',
    body: 'Suppliers can focus on production quality while we work to secure agreed purchase volumes and coordinate distribution.',
  },
  {
    icon: Banknote,
    title: 'Predictable cash flow',
    body: 'Upfront batch commitments can make cash flow more predictable and ease working-capital bottlenecks.',
  },
  {
    icon: Gauge,
    title: 'Operational elevation',
    body: 'Digital tools give plant managers a practical view of dispatches, delivery progress, and settlement activity.',
  },
];

export default function MissionPage() {
  return (
    <>
      <PortalHeader name="Vanguard Velocity Delivery" />
      <main>
        <section className="bg-[#102c23] text-white">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
            <p className="text-xs font-bold uppercase tracking-[.16em] text-emerald-200">Our mission &amp; value</p>
            <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">Bridge production capacity to the markets waiting for it.</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-emerald-50/75">Our mission is to provide reliable off-take capital and efficient logistics infrastructure—so businesses can make, move, and deliver with greater confidence.</p>
          </div>
        </section>
        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-18 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--green)]">The value we add to partners</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">More certainty around the work you already do well.</h2>
          </div>
          <div className="mt-9 grid gap-4 md:grid-cols-3">
            {values.map(({ icon: Icon, title, body }) => (
              <article key={title} className="surface p-6">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--mint)] text-[var(--green)]"><Icon size={21} /></span>
                <h3 className="mt-5 text-lg font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{body}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="border-y border-[var(--line)] bg-white">
          <div className="mx-auto flex max-w-7xl flex-col justify-between gap-5 px-4 py-12 sm:px-6 md:flex-row md:items-center lg:px-8">
            <div className="flex items-start gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--mint)] text-[var(--green)]"><BadgeCheck size={22} /></span>
              <div><h2 className="text-lg font-semibold">A transparent relationship, built for long-term value.</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--muted)]">We make operational expectations visible and keep partner teams connected throughout the supply journey.</p></div>
            </div>
            <Link href="/register/" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-[var(--green)] px-4 py-3 text-sm font-bold text-white hover:bg-[var(--green-dark)]">Explore a partnership <ArrowRight size={16} /></Link>
          </div>
        </section>
      </main>
    </>
  );
}
