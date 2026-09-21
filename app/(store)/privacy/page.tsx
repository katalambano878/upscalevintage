import EditorialHero from '@/components/EditorialHero';
import PolicySection, { PolicyContact } from '@/components/PolicySection';
import { PAGE_HERO_IMAGES, SUPPORT_EMAIL } from '@/lib/brand';

export default function PrivacyPage() {
  return (
    <main className="bg-white">
      <EditorialHero
        eyebrow="Your information"
        title="Privacy policy"
        subtitle="How we collect, use, and protect the details you share with us."
        image={PAGE_HERO_IMAGES.contact}
      />

      <article className="mx-auto max-w-3xl px-4 py-6 sm:px-6 md:py-10">
        <p className="text-sm text-brand-mauve">Last updated: February 2026</p>

        <PolicySection number="01" title="Information we collect">
          <h3>Information you provide</h3>
          <p>When you create an account, place an order, or contact us, we collect:</p>
          <ul>
            <li><strong>Personal details:</strong> name, email address, phone number, date of birth</li>
            <li><strong>Delivery information:</strong> shipping and billing addresses</li>
            <li><strong>Payment details:</strong> payment method information, securely processed by third party providers</li>
            <li><strong>Communications:</strong> messages, reviews, and feedback you submit</li>
          </ul>
          <h3>Information collected automatically</h3>
          <p>When you visit our website, we automatically collect:</p>
          <ul>
            <li><strong>Device information:</strong> IP address, browser type, operating system, device identifiers</li>
            <li><strong>Usage data:</strong> pages viewed, products browsed, search queries, time spent on site</li>
            <li><strong>Cookies:</strong> small data files stored on your device to improve your experience</li>
          </ul>
        </PolicySection>

        <PolicySection number="02" title="How we use your information">
          <p>We use your personal information for the following purposes:</p>
          <h3>Order processing and fulfilment</h3>
          <p>
            Process your orders, arrange delivery, send order confirmations and updates, handle returns and refunds, and provide customer support.
          </p>
          <h3>Service improvement</h3>
          <p>
            Analyse website usage to improve our products, services, and user experience. Conduct research and development for new features and offerings.
          </p>
          <h3>Marketing and communication</h3>
          <p>
            Send promotional emails, special offers, and product recommendations only if you have opted in. Share relevant updates about your orders and our services.
          </p>
          <h3>Security and fraud prevention</h3>
          <p>
            Protect against fraudulent transactions, unauthorised access, and other security threats. Verify your identity for high-value purchases.
          </p>
          <h3>Legal compliance</h3>
          <p>
            Comply with legal obligations, respond to lawful requests from authorities, enforce our terms and conditions, and resolve disputes.
          </p>
        </PolicySection>

        <PolicySection number="03" title="Information sharing">
          <p>We do not sell your personal information. We may share your data with:</p>
          <h3>Service providers</h3>
          <p>
            Trusted third parties who help us operate our business, including payment processors, delivery partners, email service providers, and analytics tools. They are contractually bound to protect your data.
          </p>
          <h3>Business transfers</h3>
          <p>
            If we merge with or are acquired by another company, your information may be transferred as part of the transaction. We will notify you of any such change.
          </p>
          <h3>Legal requirements</h3>
          <p>
            When required by law, or to protect our rights, property, or safety, or that of our customers or others.
          </p>
          <h3>With your consent</h3>
          <p>Any other disclosures will be made only with your explicit consent.</p>
        </PolicySection>

        <PolicySection number="04" title="Data security">
          <p>We implement security measures to protect your personal information:</p>
          <ul>
            <li><strong>Encryption:</strong> data transmitted between your browser and our servers is encrypted using SSL/TLS.</li>
            <li><strong>Secure storage:</strong> data is stored on secure servers with restricted access and regular security audits.</li>
            <li><strong>Payment security:</strong> we never store your full payment card details. Payments are processed by PCI-DSS compliant providers.</li>
            <li><strong>Access controls:</strong> only authorised personnel have access to personal data, and they are bound by confidentiality obligations.</li>
          </ul>
          <p>
            While we implement strong security measures, no method of transmission or storage is completely secure. We cannot guarantee absolute security, and we continue to work to protect your information.
          </p>
        </PolicySection>

        <PolicySection number="05" title="Your rights and choices">
          <p>You have the following rights regarding your personal information:</p>
          <ul>
            <li><strong>Access:</strong> request a copy of the personal information we hold about you.</li>
            <li><strong>Correction:</strong> update or correct inaccurate or incomplete information.</li>
            <li><strong>Deletion:</strong> request deletion of your personal information, subject to legal retention requirements.</li>
            <li><strong>Marketing opt-out:</strong> unsubscribe from marketing emails at any time using the link in our emails or your account settings.</li>
            <li><strong>Data portability:</strong> receive your data in a structured, commonly used format.</li>
            <li><strong>Object to processing:</strong> object to certain types of data processing, such as direct marketing.</li>
          </ul>
          <p>
            To exercise any of these rights, contact us at <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> or through your account settings. We will respond within 30 days.
          </p>
        </PolicySection>

        <PolicySection number="06" title="Cookies and tracking">
          <p>We use cookies and similar technologies to enhance your browsing experience:</p>
          <h3>Essential cookies</h3>
          <p>Required for the website to function, including the shopping cart and login sessions. These cannot be disabled.</p>
          <h3>Analytics cookies</h3>
          <p>Help us understand how visitors use the website so we can improve it. These collect anonymous usage data.</p>
          <h3>Marketing cookies</h3>
          <p>Used to show relevant advertisements based on your interests. You can opt out through your browser settings.</p>
          <h3>Preference cookies</h3>
          <p>Remember your preferences and settings, such as language and region, to provide a personalised experience.</p>
          <p>You can control cookie preferences through your browser settings. Disabling certain cookies may affect website functionality.</p>
        </PolicySection>

        <PolicySection number="07" title="Children's privacy">
          <p>
            Our website is not intended for children under 16 years of age. We do not knowingly collect personal information from children. If you believe we have inadvertently collected information from a child, contact us and we will delete it.
          </p>
        </PolicySection>

        <PolicySection number="08" title="International data transfers">
          <p>
            Your information may be transferred to and processed in countries outside Ghana, including countries that may have different data protection laws. We ensure appropriate safeguards are in place to protect your information in accordance with this privacy policy.
          </p>
        </PolicySection>

        <PolicySection number="09" title="Data retention">
          <p>We retain your personal information only for as long as necessary to fulfil the purposes outlined in this policy:</p>
          <ul>
            <li><strong>Account information:</strong> until you request deletion or close your account</li>
            <li><strong>Order history:</strong> 7 years for tax and accounting purposes</li>
            <li><strong>Marketing data:</strong> until you unsubscribe or request deletion</li>
            <li><strong>Analytics data:</strong> typically 26 months</li>
          </ul>
        </PolicySection>

        <PolicySection number="10" title="Changes to this policy">
          <p>
            We may update this privacy policy from time to time to reflect changes in our practices or for legal, operational, or regulatory reasons. We will notify you of significant changes by email or through a prominent notice on our website. The last updated date at the top indicates when the policy was last revised.
          </p>
        </PolicySection>

        <PolicySection number="11" title="Contact us">
          <p>Questions about this policy or how we handle your data:</p>
          <PolicyContact />
        </PolicySection>
      </article>
    </main>
  );
}
