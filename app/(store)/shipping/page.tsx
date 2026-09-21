import Link from 'next/link';
import EditorialHero from '@/components/EditorialHero';
import { PAGE_HERO_IMAGES } from '@/lib/brand';

const DELIVERY_OPTIONS = [
  {
    type: 'Standard Delivery',
    time: '2 to 5 business days',
    cost: 'GH₵20',
    description: 'For regular orders with no rush.',
    icon: 'ri-truck-line',
  },
  {
    type: 'Express Delivery',
    time: 'Next day',
    cost: 'GH₵40',
    description: 'Accra and Kumasi orders placed before 2pm.',
    icon: 'ri-flashlight-line',
  },
  {
    type: 'Store Pickup',
    time: 'Same day',
    cost: 'Free',
    description: 'Collect from our Accra location.',
    icon: 'ri-store-2-line',
  },
] as const;

const ZONES = [
  {
    zone: 'Accra Metro',
    areas: 'East Legon, Osu, Labone, Airport, Dzorwulu, Cantonments, Adabraka, Tema',
    standard: '1 to 2 days',
    express: 'Next day',
  },
  {
    zone: 'Greater Accra',
    areas: 'Madina, Legon, Haatso, Achimota, Dansoman, Spintex, Teshie, Kasoa',
    standard: '2 to 3 days',
    express: 'Next day',
  },
  {
    zone: 'Major cities',
    areas: 'Kumasi, Takoradi, Cape Coast, Tamale, Sunyani, Ho, Koforidua',
    standard: '3 to 4 days',
    express: '1 to 2 days',
  },
  {
    zone: 'Other areas',
    areas: 'All other locations within Ghana',
    standard: '4 to 5 days',
    express: 'Not available',
  },
] as const;

const STEPS = [
  {
    title: 'Order processing',
    body: 'Orders placed before 2pm are processed the same day. We pack each piece with care before it leaves the store.',
  },
  {
    title: 'Dispatch',
    body: 'Your order is handed to our delivery partner. You receive a tracking number by email and SMS.',
  },
  {
    title: 'Track it',
    body: 'Use your order number and email to follow each stage, from packing through delivery.',
  },
  {
    title: 'Delivery',
    body: 'Our partner calls before arrival. Sign for the package, then enjoy what you chose.',
  },
] as const;

const NOTES = [
  {
    icon: 'ri-time-line',
    title: 'Cut-off times',
    body: 'Orders placed before 2pm dispatch the same day. Later orders go out the next business day.',
  },
  {
    icon: 'ri-calendar-line',
    title: 'Business days',
    body: 'Timeframes exclude weekends and public holidays. We process orders Monday to Friday.',
  },
  {
    icon: 'ri-phone-line',
    title: 'Delivery contact',
    body: 'The rider calls before arrival. Keep the phone number on your order reachable.',
  },
  {
    icon: 'ri-home-line',
    title: 'Failed deliveries',
    body: 'We attempt delivery twice. After that, the package is held at a collection point for 5 days.',
  },
  {
    icon: 'ri-shield-check-line',
    title: 'Package security',
    body: 'Packages are insured in transit. Report damage or missing items within 48 hours of delivery.',
  },
] as const;

const TRACKING_STAGES = ['Order confirmed', 'Processing', 'Out for delivery', 'Delivered'] as const;

export default function ShippingPage() {
  return (
    <main className="bg-white">
      <EditorialHero
        eyebrow="Delivery"
        title="Shipping across Ghana"
        subtitle="Standard, express, and store pickup. Free standard delivery on orders over GH₵300."
        image={PAGE_HERO_IMAGES.shop}
      />

      <section className="mx-auto max-w-[1400px] px-4 py-14 sm:px-6 lg:px-10 md:py-16">
        <p className="text-sm font-medium text-brand-champagne">How it arrives</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-brand-espresso sm:text-4xl">Delivery options</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {DELIVERY_OPTIONS.map((option) => (
            <article key={option.type} className="rounded-[1.5rem] border border-black/[0.08] bg-white p-7">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#F4F2EE] text-brand-champagne">
                <i className={`${option.icon} text-xl`} aria-hidden />
              </span>
              <h3 className="mt-5 text-xl font-semibold tracking-tight">{option.type}</h3>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-brand-champagne">{option.cost}</p>
              <p className="mt-1 text-sm font-medium text-brand-espresso">{option.time}</p>
              <p className="mt-3 text-sm leading-relaxed text-brand-cocoa/75">{option.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-black">
        <div className="mx-auto flex max-w-[1400px] flex-col items-start justify-between gap-4 px-4 py-10 sm:px-6 md:flex-row md:items-center lg:px-10">
          <div>
            <p className="text-sm font-medium text-brand-champagne">On orders over GH₵300</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Free standard shipping</h2>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-white/70">
            Spend GH₵300 or more and standard delivery is free anywhere in Ghana.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-[1400px] px-4 py-14 sm:px-6 lg:px-10 md:py-16">
        <p className="text-sm font-medium text-brand-champagne">Where we deliver</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-brand-espresso sm:text-4xl">Zones and timeframes</h2>
        <div className="mt-8 overflow-hidden rounded-[1.5rem] border border-black/[0.08]">
          <div className="hidden grid-cols-[1.1fr_1.6fr_0.7fr_0.7fr] gap-4 border-b border-black/[0.08] px-6 py-4 text-xs font-medium uppercase tracking-[0.16em] text-brand-champagne md:grid">
            <span>Zone</span>
            <span>Areas</span>
            <span>Standard</span>
            <span>Express</span>
          </div>
          {ZONES.map((zone) => (
            <div
              key={zone.zone}
              className="grid gap-2 border-b border-black/[0.06] px-6 py-5 last:border-b-0 md:grid-cols-[1.1fr_1.6fr_0.7fr_0.7fr] md:items-center md:gap-4"
            >
              <p className="font-medium text-brand-espresso">{zone.zone}</p>
              <p className="text-sm leading-relaxed text-brand-cocoa/75">{zone.areas}</p>
              <p className="text-sm">
                <span className="mr-2 text-brand-mauve md:hidden">Standard</span>
                {zone.standard}
              </p>
              <p className="text-sm">
                <span className="mr-2 text-brand-mauve md:hidden">Express</span>
                {zone.express}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-black/[0.06] bg-[#F4F2EE]">
        <div className="mx-auto grid max-w-[1400px] gap-12 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:px-10 md:py-16">
          <div>
            <p className="text-sm font-medium text-brand-champagne">From checkout to door</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-brand-espresso">How shipping works</h2>
            <ol className="mt-8 space-y-6">
              {STEPS.map((step, index) => (
                <li key={step.title} className="grid grid-cols-[2.5rem_1fr] gap-4">
                  <span className="text-sm tabular-nums text-brand-champagne">{String(index + 1).padStart(2, '0')}</span>
                  <span>
                    <span className="block font-medium text-brand-espresso">{step.title}</span>
                    <span className="mt-1 block text-sm leading-relaxed text-brand-cocoa/75">{step.body}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <p className="text-sm font-medium text-brand-champagne">Before you order</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-brand-espresso">Good to know</h2>
            <ul className="mt-8 space-y-5">
              {NOTES.map((note) => (
                <li key={note.title} className="rounded-2xl bg-white p-5">
                  <p className="flex items-center gap-2 font-medium text-brand-espresso">
                    <i className={`${note.icon} text-brand-champagne`} aria-hidden />
                    {note.title}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-brand-cocoa/75">{note.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1400px] px-4 py-14 sm:px-6 lg:px-10 md:py-16">
        <div className="rounded-[1.5rem] border border-black/[0.08] px-6 py-10 sm:px-10">
          <p className="text-sm font-medium text-brand-champagne">Follow an order</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-brand-espresso">Order tracking</h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-brand-cocoa/75">
            Track anytime with your order number and the email used at checkout.
          </p>
          <ol className="mt-8 grid gap-4 sm:grid-cols-4">
            {TRACKING_STAGES.map((stage, index) => (
              <li key={stage} className="rounded-2xl bg-[#F4F2EE] px-4 py-5">
                <span className="text-sm tabular-nums text-brand-champagne">{String(index + 1).padStart(2, '0')}</span>
                <p className="mt-2 font-medium text-brand-espresso">{stage}</p>
              </li>
            ))}
          </ol>
          <Link
            href="/order-tracking"
            className="mt-8 inline-flex h-12 items-center rounded-full bg-black px-7 text-sm font-semibold text-white transition-colors duration-150 hover:bg-brand-champagne hover:text-black"
          >
            Track your order
          </Link>
        </div>
      </section>

      <section className="bg-black">
        <div className="mx-auto flex max-w-[1400px] flex-col items-start justify-between gap-6 px-4 py-12 sm:px-6 md:flex-row md:items-center lg:px-10 md:py-14">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Need help with a delivery?</h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-white/65">
              Questions about cost, timing, or a parcel already on the way.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/contact" className="inline-flex h-12 items-center rounded-full bg-white px-6 text-sm font-semibold text-black">
              Contact us
            </Link>
            <Link
              href="/faqs"
              className="inline-flex h-12 items-center rounded-full border border-brand-champagne/70 px-6 text-sm font-semibold text-brand-champagne"
            >
              View FAQs
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
