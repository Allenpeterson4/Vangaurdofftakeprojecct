import Link from 'next/link';
import { ArrowDownRight, ArrowRight, Boxes, Building2, CheckCircle2, Factory, Handshake, Truck } from 'lucide-react';
import { PortalHeader } from '@/components/portal-header';

const benefits = [
  {
    icon: Handshake,
    title: 'Confident off-take partnerships',
    body: 'Agree on reliable purchase commitments that help manufacturers plan production and focus on consistent quality.',
  },
  {
    icon: Building2,
    title: 'More dependable cash flow',
    body: 'Pre-agreed batch commitments can reduce the uncertainty of finding a buyer after goods leave the production line.',
  },
  {
    icon: Truck,
    title: 'Coordinated distribution',
    body: 'Coordinate loading, vehicle movement, and delivery handoffs without pulling your team away from core operations.',
  },
];

const steps = [
  { number: '01', title: 'Capital allocation', body: 'We align on your product, production schedule, and dedicated daily or weekly supply commitments.' },
  { number: '02', title: 'Priority dispatch', body: 'Our operations teams coordinate loading and onward movement so stock is ready to reach its destination.' },
  { number: '03', title: 'Clear reconciliation', body: 'Managers follow dispatch and delivery progress in the portal, with activity records for regular settlements.' },
];

export default function HomePage() {
  return (
    <>
      <PortalHeader name="Vanguard Velocity Delivery" />
      <main>
        <section id="home" className="relative isolate overflow-hidden bg-[#102c23] text-white">
          <div aria-hidden="true" className="absolute inset-0 -z-10 opacity-30 [background-image:linear-gradient(120deg,transparent_30%,#58a881_30.1%,transparent_30.4%),linear-gradient(30deg,transparent_62%,#58a881_62.1%,transparent_62.4%)]" />
          <div className="absolute -right-36 -top-32 -z-10 h-[34rem] w-[34rem] rounded-full border border-white/10" />
          <div className="absolute -right-8 -top-8 -z-10 h-[26rem] w-[26rem] rounded-full border border-white/10" />
          <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-[1.08fr_.92fr] lg:items-center lg:px-8">
            <div>
              <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-100/20 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-[.16em] text-emerald-100">
                <span className="h-2 w-2 rounded-full bg-emerald-300" />
                Off-take partnerships · distribution · delivery
              </p>
              <h1 className="max-w-3xl text-4xl font-semibold leading-[1.08] tracking-tight sm:text-6xl">
                Guaranteed daily off-take. <span className="text-emerald-300">A clearer path to market.</span>
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-emerald-50/75 sm:text-lg">
                We connect manufacturers to committed purchasing and coordinated distribution—helping your business plan with greater confidence while we manage the movement of goods.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link href="/register/" className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-300 px-5 py-3.5 text-sm font-bold text-[#102c23] transition hover:bg-emerald-200">
                  Partner with us <ArrowRight size={17} />
                </Link>
                <Link href="/login/" className="inline-flex items-center justify-center rounded-xl border border-white/20 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-white/5">
                  Portal login
                </Link>
              </div>
              <p className="mt-4 text-xs text-emerald-100/60">Partner managers can register for portal access. Access is enabled after company assignment.</p>
            </div>

            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[.06] p-5 shadow-2xl backdrop-blur sm:p-7">
              <div className="flex items-start justify-between border-b border-white/10 pb-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[.15em] text-emerald-100/60">From production floor to destination</p>
                  <p className="mt-2 text-xl font-semibold">One connected supply chain</p>
                </div>
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-300/15 text-emerald-200"><Boxes size={22} /></span>
              </div>
              <div className="relative mt-7 space-y-5">
                <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-black/10 p-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/10 text-emerald-200"><Factory size={21} /></span>
                  <div><p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-100/55">Production partner</p><p className="mt-1 font-semibold">Your factory, focused on making</p></div>
                </div>
                <div className="ml-9 h-5 border-l border-dashed border-emerald-200/50" />
                <div className="flex items-center gap-4 rounded-2xl border border-emerald-200/20 bg-emerald-200/10 p-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-300/15 text-emerald-200"><Truck size={21} /></span>
                  <div><p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-100/65">Coordinated dispatch</p><p className="mt-1 font-semibold">Loading, movement, and delivery</p></div>
                </div>
                <div className="ml-9 h-5 border-l border-dashed border-emerald-200/50" />
                <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-black/10 p-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/10 text-emerald-200"><CheckCircle2 size={21} /></span>
                  <div><p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-100/55">A clear handoff</p><p className="mt-1 font-semibold">Track progress and reconcile</p></div>
                </div>
              </div>
              <p className="mt-6 flex items-center gap-2 text-xs text-emerald-100/60"><ArrowDownRight size={15} /> Built around your production rhythm</p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--green)]">A partner for what comes next</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Make production easier to plan—and products easier to move.</h2>
            <p className="mt-4 leading-7 text-[var(--muted)]">Our bulk supply and logistics teams bring manufacturers, buyers, and delivery operations into one dependable working relationship.</p>
          </div>
          <div className="mt-9 grid gap-4 md:grid-cols-3">
            {benefits.map(({ icon: Icon, title, body }) => (
              <article key={title} className="surface p-6">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--mint)] text-[var(--green)]"><Icon size={21} /></span>
                <h3 className="mt-5 text-lg font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="how-it-works" className="border-y border-[var(--line)] bg-white">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--green)]">A straightforward process</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">From committed supply to confirmed delivery.</h2>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {steps.map((step) => (
                <article key={step.number} className="rounded-2xl border border-[var(--line)] bg-[var(--canvas)] p-6">
                  <p className="text-sm font-bold tracking-widest text-[var(--green)]">{step.number}</p>
                  <h3 className="mt-5 text-lg font-bold">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{step.body}</p>
                </article>
              ))}
            </div>
            <div className="mt-9 flex flex-col justify-between gap-4 rounded-2xl bg-[#102c23] p-6 text-white sm:flex-row sm:items-center sm:px-8">
              <div><h3 className="font-semibold">Ready to explore a supply partnership?</h3><p className="mt-1 text-sm text-emerald-50/70">Let’s discuss your product, production schedule, and delivery needs.</p></div>
              <Link href="/services/" className="inline-flex items-center gap-2 text-sm font-bold text-emerald-200">Explore our services <ArrowRight size={17} /></Link>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
