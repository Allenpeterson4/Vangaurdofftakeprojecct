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
        <section id="home" className="hero-section">
          <div aria-hidden="true" className="hero-lines absolute inset-0 -z-10" />
          <div aria-hidden="true" className="hero-orbit hero-orbit-outer absolute -right-36 -top-32 -z-10 h-[34rem] w-[34rem]" />
          <div aria-hidden="true" className="hero-orbit hero-orbit-inner absolute -right-8 -top-8 -z-10 h-[26rem] w-[26rem]" />
          <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-[1.08fr_.92fr] lg:items-center lg:px-8">
            <div>
              <p className="hero-pill mb-5 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[.16em]">
                <span aria-hidden="true" className="hero-pill-dot h-2 w-2 rounded-full" />
                Off-take partnerships · distribution · delivery
              </p>
              <h1 className="max-w-3xl text-4xl font-semibold leading-[1.08] tracking-tight sm:text-6xl">
                Guaranteed daily off-take. <span className="hero-accent">A clearer path to market.</span>
              </h1>
              <p className="hero-copy mt-6 max-w-2xl text-base leading-7 sm:text-lg">
                We connect manufacturers to committed purchasing and coordinated distribution—helping your business plan with greater confidence while we manage the movement of goods.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link href="/login/" className="hero-primary-link inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-bold">
                  Portal login <ArrowRight size={17} />
                </Link>
                <Link href="/register/" className="hero-secondary-link inline-flex items-center justify-center rounded-xl px-5 py-3.5 text-sm font-bold">
                  Partner registration
                </Link>
              </div>
              <p className="hero-note mt-4 text-xs">Partner managers can register for portal access. Access is enabled after company assignment.</p>
            </div>

            <div className="hero-diagram-panel relative overflow-hidden rounded-3xl p-5 shadow-2xl backdrop-blur sm:p-7">
              <div className="hero-diagram-heading flex items-start justify-between pb-5">
                <div>
                  <p className="hero-diagram-kicker text-xs font-semibold uppercase tracking-[.15em]">From production floor to destination</p>
                  <p className="mt-2 text-xl font-semibold">One connected supply chain</p>
                </div>
                <span className="hero-diagram-mark grid h-11 w-11 place-items-center rounded-xl"><Boxes size={22} /></span>
              </div>
              <div className="relative mt-7 space-y-5">
                <div className="hero-flow-card hero-flow-card-muted flex items-center gap-4 rounded-2xl p-4">
                  <span className="hero-flow-icon hero-flow-icon-muted grid h-11 w-11 shrink-0 place-items-center rounded-xl"><Factory size={21} /></span>
                  <div><p className="hero-flow-label text-[11px] font-semibold uppercase tracking-wider">Production partner</p><p className="mt-1 font-semibold">Your factory, focused on making</p></div>
                </div>
                <div aria-hidden="true" className="hero-flow-connector ml-9 h-5 border-l border-dashed" />
                <div className="hero-flow-card hero-flow-card-highlight flex items-center gap-4 rounded-2xl p-4">
                  <span className="hero-flow-icon hero-flow-icon-highlight grid h-11 w-11 shrink-0 place-items-center rounded-xl"><Truck size={21} /></span>
                  <div><p className="hero-flow-label text-[11px] font-semibold uppercase tracking-wider">Coordinated dispatch</p><p className="mt-1 font-semibold">Loading, movement, and delivery</p></div>
                </div>
                <div aria-hidden="true" className="hero-flow-connector ml-9 h-5 border-l border-dashed" />
                <div className="hero-flow-card hero-flow-card-muted hero-flow-card-complete flex items-center gap-4 rounded-2xl p-4">
                  <span className="hero-flow-icon hero-flow-icon-muted grid h-11 w-11 shrink-0 place-items-center rounded-xl"><CheckCircle2 size={21} /></span>
                  <div><p className="hero-flow-label text-[11px] font-semibold uppercase tracking-wider">A clear handoff</p><p className="mt-1 font-semibold">Track progress and reconcile</p></div>
                </div>
              </div>
              <p className="hero-diagram-footer mt-6 flex items-center gap-2 text-xs"><ArrowDownRight size={15} /> Built around your production rhythm</p>
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
