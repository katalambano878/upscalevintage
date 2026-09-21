import Link from 'next/link';
import EditorialHero from '@/components/EditorialHero';
import PolicySection, { PolicyContact } from '@/components/PolicySection';
import { APP_TITLE, PAGE_HERO_IMAGES } from '@/lib/brand';

export default function TermsPage() {
  return (
    <main className="bg-white">
      <EditorialHero
        eyebrow="The house rules"
        title="Terms & conditions"
        subtitle="Please read these terms before using the website and placing an order."
        image={PAGE_HERO_IMAGES.about}
      />

      <article className="mx-auto max-w-3xl px-4 py-6 sm:px-6 md:py-10">
        <p className="text-sm text-brand-mauve">Last updated: February 2026</p>

        <PolicySection number="01" title="Agreement to terms">
          <p>
            By accessing and using this website ({APP_TITLE}), you accept and agree to be bound by these Terms and Conditions. If you do not agree with any part of these terms, you must not use our website or services.
          </p>
          <p>
            These terms apply to all visitors, users, and customers who access or use our service. We reserve the right to update or modify these terms at any time without prior notice. Your continued use of the website following any changes indicates your acceptance of the new terms.
          </p>
        </PolicySection>

        <PolicySection number="02" title="Use of website">
          <h3>Permitted use</h3>
          <p>You may use our website for lawful purposes only. You agree not to:</p>
          <ul>
            <li>Violate any local, national, or international law or regulation</li>
            <li>Transmit any harmful code, viruses, or malicious software</li>
            <li>Attempt to gain unauthorised access to our systems or networks</li>
            <li>Use the website for fraudulent purposes or in connection with any criminal activity</li>
            <li>Impersonate any person or entity or misrepresent your affiliation</li>
            <li>Interfere with or disrupt the website or servers</li>
          </ul>
          <h3>Account responsibility</h3>
          <p>
            If you create an account, you are responsible for maintaining the confidentiality of your login credentials and for all activities that occur under your account. You must notify us immediately of any unauthorised use of your account or any other security breach.
          </p>
        </PolicySection>

        <PolicySection number="03" title="Products & pricing">
          <h3>Product information</h3>
          <p>
            We make every effort to display our products accurately, including colours, descriptions, and specifications. However, we cannot guarantee that your device&apos;s display will accurately reflect product colours or that product descriptions are error-free.
          </p>
          <h3>Pricing</h3>
          <p>All prices are listed in Ghana Cedis (GHS) and include VAT where applicable. We reserve the right to:</p>
          <ul>
            <li>Modify prices at any time without notice</li>
            <li>Correct pricing errors, even after an order is placed</li>
            <li>Limit quantities available for purchase</li>
            <li>Discontinue products at any time</li>
          </ul>
          <p>
            If a product is listed at an incorrect price due to an error, we will contact you before processing your order. You may choose to cancel the order or proceed at the correct price.
          </p>
          <h3>Availability</h3>
          <p>
            Product availability is subject to change without notice. If an ordered item becomes unavailable, we will notify you and offer a refund or replacement option.
          </p>
        </PolicySection>

        <PolicySection number="04" title="Orders & payment">
          <h3>Order acceptance</h3>
          <p>Placing an order does not guarantee acceptance. We reserve the right to refuse or cancel any order for reasons including:</p>
          <ul>
            <li>Product unavailability or pricing errors</li>
            <li>Suspected fraudulent or unauthorised transactions</li>
            <li>Inaccuracies in product or pricing information</li>
            <li>Failure to meet age or eligibility requirements</li>
          </ul>
          <h3>Payment</h3>
          <p>We accept the following payment methods. We do not accept payment on delivery:</p>
          <ul>
            <li>MOMO (Mobile Money)</li>
            <li>Instant bank transfer</li>
            <li>Cash, in store only</li>
            <li>Visa card payment</li>
          </ul>
          <p>
            Payment must be received in full before order dispatch. By providing payment information, you confirm that you are authorised to use the payment method and that there are sufficient funds available.
          </p>
          <h3>Order modifications</h3>
          <p>
            You may modify or cancel your order within 1 hour of placement. After this time, orders enter processing and cannot be changed. Contact customer service immediately if you need to make changes.
          </p>
        </PolicySection>

        <PolicySection number="05" title="Shipping & delivery">
          <p>
            Delivery times and costs vary by location and shipping method selected. See our{' '}
            <Link href="/shipping">shipping page</Link> for details.
          </p>
          <p>
            Risk of loss and title for products pass to you upon delivery to the carrier. We are not responsible for delays caused by the shipping carrier or circumstances beyond our control, including weather, strikes, and customs.
          </p>
          <p>
            You must provide accurate and complete delivery information. We are not responsible for delivery failures due to incorrect addresses.
          </p>
        </PolicySection>

        <PolicySection number="06" title="Returns & refunds">
          <p>
            Refunds and exchanges are governed by our official refund policy on the{' '}
            <Link href="/returns#refund-policy">returns and refunds</Link> page. Refunds may be approved for defective delivery, order mix ups, payment for sold out items, or misplaced in store packages.
          </p>
          <p>
            Exchanges require items to be unworn, undamaged, in original packaging with tags, and requested within 24 hours of purchase.
          </p>
          <p>
            Items received outside these criteria cannot be returned or exchanged. Approved refunds are issued to the original payment method.
          </p>
        </PolicySection>

        <PolicySection number="07" title="Intellectual property">
          <p>
            All content on this website, including text, graphics, logos, images, videos, and software, is the property of {APP_TITLE} or its content suppliers and is protected by copyright, trademark, and other intellectual property laws.
          </p>
          <p>
            You may not reproduce, distribute, modify, create derivative works of, publicly display, or otherwise use any content from this website without our express written permission.
          </p>
          <p>Product names, logos, and brands are the property of their respective owners and are used for identification purposes only.</p>
        </PolicySection>

        <PolicySection number="08" title="User content">
          <p>
            You may submit reviews, comments, and other content to our website. By doing so, you grant us a non-exclusive, royalty-free, perpetual, worldwide licence to use, reproduce, modify, and display such content.
          </p>
          <p>You are solely responsible for your content and must ensure it:</p>
          <ul>
            <li>Does not violate any laws or third party rights</li>
            <li>Is not defamatory, offensive, or inappropriate</li>
            <li>Does not contain viruses or malicious code</li>
            <li>Is truthful and based on your genuine experience</li>
          </ul>
          <p>We reserve the right to remove any content that violates these terms or that we deem inappropriate.</p>
        </PolicySection>

        <PolicySection number="09" title="Limitation of liability">
          <p>To the fullest extent permitted by law, {APP_TITLE} shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from:</p>
          <ul>
            <li>Your use or inability to use the website or services</li>
            <li>Unauthorised access to or alteration of your data</li>
            <li>Errors or omissions in website content</li>
            <li>Product defects or performance issues</li>
            <li>Delivery delays or failures</li>
          </ul>
          <p>
            Our total liability for any claim arising from your use of the website or purchase of products shall not exceed the amount you paid for the product or service in question.
          </p>
        </PolicySection>

        <PolicySection number="10" title="Indemnification">
          <p>
            You agree to indemnify and hold harmless {APP_TITLE}, its affiliates, officers, directors, employees, and agents from any claims, damages, losses, liabilities, and expenses (including legal fees) arising from your use of the website, violation of these terms, or infringement of any third party rights.
          </p>
        </PolicySection>

        <PolicySection number="11" title="Governing law & disputes">
          <p>
            These terms are governed by the laws of Ghana. Any disputes arising from these terms or your use of the website shall be subject to the exclusive jurisdiction of the courts of Ghana.
          </p>
          <p>Before initiating any legal action, you agree to first contact us to seek resolution through informal negotiation.</p>
        </PolicySection>

        <PolicySection number="12" title="Severability">
          <p>
            If any provision of these terms is found to be invalid or unenforceable, the remaining provisions shall continue in full force and effect.
          </p>
        </PolicySection>

        <PolicySection number="13" title="Contact">
          <p>For questions about these terms, reach us here:</p>
          <PolicyContact />
        </PolicySection>

        <p className="mt-10 rounded-[1.5rem] bg-black px-6 py-8 text-center text-sm leading-relaxed text-white/80">
          By using this website, you acknowledge that you have read, understood, and agree to these terms.
        </p>
      </article>
    </main>
  );
}
