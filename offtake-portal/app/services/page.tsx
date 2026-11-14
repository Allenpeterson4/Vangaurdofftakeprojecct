import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Boxes, ClipboardCheck, Truck } from 'lucide-react';
import { PortalHeader } from '@/components/portal-header';

export const metadata: Metadata = {
  title: 'Our Services',
  description: 'Bulk off-take partnerships, dedicated logistics coordination, and digital supply tracking for manufacturers.',
};

const services = [
  {
    number: '01',
    icon: Boxes,
    title: 'Guaranteed bulk off-take contracts',
    summary: 'Structured purchase commitments that make demand easier to plan around.',
    details: [
      'Daily or weekly inventory commitments tailored to your agreed production capacity.',
      'Clear communication on product specifications, availability, and delivery timing.',
      'A consistent route to market designed to reduce uncertainty around each production run.',
    ],
  },
  {
    number: '02',
    icon: Truck,
    title: 'Dedicated fleet & priority dispatch',
    summary: 'Hands-on coordination from factory loading through the delivery handoff.',
    details: [
      'Dispatch coordination that fits your factory floor and loading schedule.',
      'Vehicle and driver details shared with assigned operations managers.',
      'Logistics support that helps goods move promptly without disrupting production.',
    ],
  },
  {
    number: '03',
    icon: ClipboardCheck,
    title: 'Digital supply & ledger management',
    summary: 'A practical digital workspace for partner managers and operations teams.',
    details: [
      'At-a-glance batch status from allocation through transit and delivery.',
      'Recorded status changes and delivery milestones for a traceable handoff.',
      'Weekly settlement summaries and a shared operational record for your team.',
    ],
  },
];

export default function ServicesPage() {
  return (
    <>
      <PortalHeader name="Vanguard Velocity Delivery" />
      <main>
        <section className="bg-[#102c23] text-white">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
            <p className="text-xs font-bold uppercase tracking-[.16em] text-emerald-200">Our services</p>
            <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">One partner for committed off-take and coordinated delivery.</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-emerald-50/75">We bring bulk purchasing and dedicated logistics together, giving manufacturers a more connected path from production planning to market.</p>
          </div>
        </section>
        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-18 lg:px-8">
          <div className="grid gap-5 lg:grid-cols-3">
            {services.map(({ number, icon: Icon, title, summary, details }) => (
              <article key={number} className="surface flex flex-col p-6 sm:p-7">
                <div className="flex items-center justify-between">
                  <span className="grid h-12 w-12 place-items-center rounded-xl bg-[var(--mint)] text-[var(--green)]"><Icon size={22} /></span>
                  <span className="text-xs font-bold tracking-widest text-[var(--green)]">{number}</span>
                </div>
                <h2 className="mt-6 text-xl font-bold">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{summary}</p>
                <ul className="mt-6 space-y-3 border-t border-[var(--line)] pt-5">
                  {details.map((detail) => <li key={detail} className="flex gap-3 text-sm leading-6 text-[var(--muted)]"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--green)]" />{detail}</li>)}
                </ul>
              </article>
            ))}
          </div>
          <div className="mt-10 flex flex-col justify-between gap-5 rounded-2xl bg-[var(--mint)] p-6 sm:flex-row sm:items-center sm:px-8">
            <div><h2 className="text-lg font-semibold">Let’s plan a partnership around your operation.</h2><p className="mt-1 text-sm text-[var(--muted)]">Start a conversation with our supply and logistics team.</p></div>
            <Link href="/register/" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-[var(--green)] px-4 py-3 text-sm font-bold text-white hover:bg-[var(--green-dark)]">Partner with us <ArrowRight size={16} /></Link>
          </div>
        </section>
      </main>
    </>
  );
}
