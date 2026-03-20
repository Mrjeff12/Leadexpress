import Navbar from '../components/Navbar'
import Footer from '../components/Footer'

export default function PrivacyPolicy() {
  return (
    <>
      <Navbar />
      <main className="pt-28 pb-20 bg-cream min-h-screen">
        <div className="max-w-3xl mx-auto px-6">
          <h1 className="text-4xl font-bold text-dark mb-2">Privacy Policy</h1>
          <p className="text-gray-subtle/60 mb-10">Last updated: March 18, 2026</p>

          <div className="prose prose-gray max-w-none space-y-8 text-dark/80 text-[15px] leading-relaxed">
            <section>
              <h2 className="text-xl font-semibold text-dark mb-3">1. Introduction</h2>
              <p>
                Lead Express ("we", "us", or "our") operates the Lead Express platform, an AI-powered
                lead extraction service for contractors. This Privacy Policy explains how we collect,
                use, disclose, and safeguard your information when you use our service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-dark mb-3">2. Information We Collect</h2>
              <p>We may collect the following types of information:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1.5">
                <li><strong>Account Information:</strong> Name, email address, phone number, and business details you provide during registration.</li>
                <li><strong>WhatsApp Group Data:</strong> Messages and content from WhatsApp groups you authorize us to scan for lead extraction purposes.</li>
                <li><strong>Location Data:</strong> ZIP codes and service areas you configure for lead matching.</li>
                <li><strong>Payment Information:</strong> Billing details processed securely through our payment provider (Stripe). We do not store your full credit card number.</li>
                <li><strong>Usage Data:</strong> Information about how you interact with our platform, including pages visited, features used, and timestamps.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-dark mb-3">3. How We Use Your Information</h2>
              <p>We use the information we collect to:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1.5">
                <li>Extract and match leads from WhatsApp groups based on your trade and service area.</li>
                <li>Send you notifications about new leads via WhatsApp, SMS, or email.</li>
                <li>Process payments and manage your subscription.</li>
                <li>Improve our AI lead-extraction algorithms and overall service quality.</li>
                <li>Provide customer support and respond to your inquiries.</li>
                <li>Send service-related communications and updates.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-dark mb-3">4. Third-Party Services</h2>
              <p>We use the following third-party services to operate our platform:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1.5">
                <li><strong>Stripe:</strong> For secure payment processing and subscription management.</li>
                <li><strong>Twilio:</strong> For WhatsApp and SMS messaging to deliver lead notifications.</li>
                <li><strong>Supabase:</strong> For secure data storage and authentication.</li>
              </ul>
              <p className="mt-2">
                Each third-party provider has their own privacy policy governing the use of your
                information. We encourage you to review their policies.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-dark mb-3">5. Data Retention</h2>
              <p>
                We retain your personal information for as long as your account is active or as needed
                to provide our services. Lead data is retained for up to 12 months after extraction.
                If you delete your account, we will remove your personal information within 30 days,
                except where we are required to retain it for legal or regulatory purposes.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-dark mb-3">6. Data Security</h2>
              <p>
                We implement industry-standard security measures to protect your information,
                including encryption in transit (TLS) and at rest, access controls, and regular
                security audits. However, no method of transmission or storage is 100% secure,
                and we cannot guarantee absolute security.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-dark mb-3">7. Your Rights</h2>
              <p>You have the right to:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1.5">
                <li><strong>Access:</strong> Request a copy of the personal data we hold about you.</li>
                <li><strong>Correction:</strong> Request correction of inaccurate or incomplete data.</li>
                <li><strong>Deletion:</strong> Request deletion of your personal data and account.</li>
                <li><strong>Data Portability:</strong> Request a copy of your data in a portable format.</li>
                <li><strong>Opt-Out:</strong> Unsubscribe from marketing communications at any time.</li>
              </ul>
              <p className="mt-2">
                To exercise any of these rights, contact us at{' '}
                <a href="mailto:support@leadexpress.co.il" className="text-primary hover:underline">
                  support@leadexpress.co.il
                </a>.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-dark mb-3">8. Cookies</h2>
              <p>
                We use essential cookies to maintain your session and preferences. We do not use
                third-party tracking cookies for advertising purposes.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-dark mb-3">9. Changes to This Policy</h2>
              <p>
                We may update this Privacy Policy from time to time. We will notify you of any
                material changes by posting the updated policy on our website and updating the
                "Last updated" date above.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-dark mb-3">10. Contact Us</h2>
              <p>
                If you have any questions about this Privacy Policy, please contact us at:{' '}
                <a href="mailto:support@leadexpress.co.il" className="text-primary hover:underline">
                  support@leadexpress.co.il
                </a>
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
