import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Compass, Handshake, ShieldCheck } from 'lucide-react';
import { PortalHeader } from '@/components/portal-header';

export const metadata: Metadata = {
  title: 'About Us',
  description: 'Learn how Vanguard Velocity Delivery supports manufacturers through dependable off-take and logistics partnerships.',
};

const principles = [
  { icon: ShieldCheck, title: 'Reliability in every handoff', body: 'We value clear commitments, careful coordination, and follow-through from the first planning conversation to delivery.' },
  { icon: Compass, title: 'Local market understanding', body: 'Strong supply partnerships depend on understanding the people, timing, and practical realities of the markets they serve.' },
  { icon: Handshake, title: 'Growth through partnership', body: 'We work alongside manufacturers and suppliers, helping partner businesses connect production capacity with distribution.' },
];

export default function AboutPage() {
  return (
    <>
      <PortalHeader name="Vanguard Velocity Delivery" />
      <main>
        <section className="bg-[#102c23] text-white">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
            <p className="text-xs font-bold uppercase tracking-[.16em] text-emerald-200">About Vanguard Velocity Delivery</p>
            <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">Connecting the people who make goods with the markets that need them.</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-emerald-50/75">Our off-take and wholesale distribution work extends the Vanguard Velocity Delivery approach into business-to-business supply partnerships—bringing purchasing coordination, logistics, and visibility closer together.</p>
          </div>
        </section>
        <section className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 sm:py-18 lg:grid-cols-[.9fr_1.1fr] lg:px-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--green)]">Who we are</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">A practical partner for supply-chain growth.</h2>
          </div>
          <div className="space-y-5 text-sm leading-7 text-[var(--muted)]">
            <p>Manufacturers need more than a buyer. They need a partner who understands that production schedules, loading windows, transport, and delivery all have to work together.</p>
            <p>Vanguard Velocity Delivery brings those pieces into one operating relationship. Our teams coordinate bulk off-take and movement of goods, while our partner portal gives assigned managers a straightforward way to follow allocations and delivery status.</p>
            <p>We focus on operational reliability, local market knowledge, and relationships that help partner businesses plan with greater confidence.</p>
          </div>
        </section>
        <section className="border-y border-[var(--line)] bg-white">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-18 lg:px-8">
            <p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--green)]">How we work</p>
            <div className="mt-7 grid gap-4 md:grid-cols-3">
              {principles.map(({ icon: Icon, title, body }) => (
                <article key={title} className="rounded-2xl border border-[var(--line)] p-6">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--mint)] text-[var(--green)]"><Icon size={21} /></span>
                  <h3 className="mt-5 font-bold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{body}</p>
                </article>
              ))}
            </div>
            <Link href="/mission/" className="mt-8 inline-flex items-center gap-2 text-sm font-bold text-[var(--green)]">Our mission and value <ArrowRight size={16} /></Link>
          </div>
        </section>
      </main>
    </>
  );
}
