import type { ReactNode } from 'react';
import { APP_TITLE, CONTACT_ADDRESS, CONTACT_PHONE, CONTACT_PHONE_DISPLAY, SUPPORT_EMAIL, WHATSAPP_LINK } from '@/lib/brand';

interface PolicySectionProps {
  number: string;
  title: string;
  children: ReactNode;
}

export default function PolicySection({ number, title, children }: PolicySectionProps) {
  return (
    <section className="border-b border-black/[0.08] py-10 last:border-b-0">
      <p className="text-sm tabular-nums text-brand-champagne">{number}</p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-brand-espresso sm:text-3xl">{title}</h2>
      <div className="mt-5 space-y-4 text-[15px] leading-relaxed text-brand-cocoa/80 [&_a]:font-medium [&_a]:text-brand-champagne [&_a]:underline-offset-4 hover:[&_a]:underline [&_h3]:mt-8 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:tracking-tight [&_h3]:text-brand-espresso [&_li]:pl-1 [&_strong]:font-semibold [&_strong]:text-brand-espresso [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5 [&_ul]:marker:text-brand-champagne">
        {children}
      </div>
    </section>
  );
}

export function PolicyContact() {
  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-3">
      <a href={`mailto:${SUPPORT_EMAIL}`} className="rounded-2xl bg-[#F4F2EE] p-5">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-brand-champagne">Email</p>
        <p className="mt-2 text-sm font-medium text-brand-espresso">{SUPPORT_EMAIL}</p>
      </a>
      <div className="rounded-2xl bg-[#F4F2EE] p-5">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-brand-champagne">Phone</p>
        <a href={`tel:${CONTACT_PHONE}`} className="mt-2 block text-sm font-medium text-brand-espresso hover:text-brand-champagne">
          {CONTACT_PHONE_DISPLAY}
        </a>
        <a href={WHATSAPP_LINK} className="mt-1 block text-xs text-brand-mauve hover:text-brand-champagne">
          WhatsApp {CONTACT_PHONE_DISPLAY}
        </a>
      </div>
      <div className="rounded-2xl bg-[#F4F2EE] p-5">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-brand-champagne">Address</p>
        <p className="mt-2 text-sm font-medium leading-relaxed text-brand-espresso">
          {APP_TITLE}
          <br />
          {CONTACT_ADDRESS}
        </p>
      </div>
    </div>
  );
}
