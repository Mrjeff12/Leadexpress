import Navbar from '../components/Navbar'
import Footer from '../components/Footer'

export default function TermsOfService() {
  return (
    <>
      <Navbar />
      <main className="pt-28 pb-20 bg-cream min-h-screen">
        <div className="max-w-3xl mx-auto px-6">
          <h1 className="text-4xl font-bold text-dark mb-2">Terms of Service</h1>
          <p className="text-gray-subtle/60 mb-10">Last updated: March 18, 2026</p>

          <div className="prose prose-gray max-w-none space-y-8 text-dark/80 text-[15px] leading-relaxed">
            <section>
              <h2 className="text-xl font-semibold text-dark mb-3">1. Acceptance of Terms</h2>
              <p>
                By accessing or using the Lead Express platform ("Service"), you agree to be bound
                by these Terms of Service ("Terms"). If you do not agree to these Terms, you may
                not use the Service. These Terms constitute a legally binding agreement between you
                and Lead Express ("we", "us", or "our").
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-dark mb-3">2. Service Description</h2>
              <p>
                Lead Express is an AI-powered platform that extracts potential customer leads from
                WhatsApp groups and matches them with contractors based on trade specialization and
                service area. Our service includes:
              </p>
              <ul className="list-disc pl-6 mt-2 space-y-1.5">
                <li>Automated scanning and analysis of authorized WhatsApp groups for service requests.</li>
                <li>Lead matching based on your configured trade categories and ZIP code coverage.</li>
                <li>Real-time lead notifications via WhatsApp, SMS, or email.</li>
                <li>A dashboard to manage leads, track responses, and view analytics.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-dark mb-3">3. Account Registration</h2>
              <p>
                To use our Service, you must create an account and provide accurate, complete
                information. You are responsible for maintaining the confidentiality of your account
                credentials and for all activities that occur under your account. You must notify us
                immediately of any unauthorized use.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-dark mb-3">4. Acceptable Use</h2>
              <p>You agree not to:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1.5">
                <li>Use the Service for any unlawful purpose or in violation of any applicable laws.</li>
                <li>Spam, harass, or send unsolicited communications to leads obtained through the Service.</li>
                <li>Attempt to reverse-engineer, decompile, or extract the source code of our platform.</li>
                <li>Share your account credentials with third parties or allow unauthorized access.</li>
                <li>Use automated tools (bots, scrapers) to access the Service beyond its intended functionality.</li>
                <li>Misrepresent your trade qualifications, licensing, or service capabilities.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-dark mb-3">5. Subscription and Billing</h2>
              <p>
                Lead Express offers subscription-based plans. By subscribing, you agree to the following:
              </p>
              <ul className="list-disc pl-6 mt-2 space-y-1.5">
                <li>Subscription fees are billed in advance on a recurring basis (monthly or annually, depending on your plan).</li>
                <li>All payments are processed securely through Stripe. You authorize us to charge your payment method on file.</li>
                <li>Prices are subject to change with 30 days' prior notice.</li>
                <li>Refunds are not provided for partial billing periods unless required by law.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-dark mb-3">6. Cancellation</h2>
              <p>
                You may cancel your subscription at any time through your account dashboard or by
                contacting us. Upon cancellation:
              </p>
              <ul className="list-disc pl-6 mt-2 space-y-1.5">
                <li>Your access will continue until the end of the current billing period.</li>
                <li>No further charges will be made after the current period ends.</li>
                <li>Lead data associated with your account may be deleted 30 days after cancellation.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-dark mb-3">7. Intellectual Property</h2>
              <p>
                All content, features, and functionality of the Service, including but not limited to
                text, graphics, logos, and software, are owned by Lead Express and are protected by
                intellectual property laws. You may not copy, modify, or distribute any part of the
                Service without our prior written consent.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-dark mb-3">8. Disclaimer of Warranties</h2>
              <p>
                The Service is provided "as is" and "as available" without warranties of any kind,
                either express or implied. We do not guarantee that:
              </p>
              <ul className="list-disc pl-6 mt-2 space-y-1.5">
                <li>The Service will be uninterrupted, error-free, or secure.</li>
                <li>Leads provided will result in booked jobs or revenue.</li>
                <li>Lead information will be 100% accurate or complete.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-dark mb-3">9. Limitation of Liability</h2>
              <p>
                To the maximum extent permitted by law, Lead Express shall not be liable for any
                indirect, incidental, special, consequential, or punitive damages, including but not
                limited to loss of profits, data, or business opportunities, arising out of or
                related to your use of the Service. Our total liability shall not exceed the amount
                you paid us in the 12 months preceding the claim.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-dark mb-3">10. Indemnification</h2>
              <p>
                You agree to indemnify and hold harmless Lead Express, its officers, directors,
                employees, and agents from any claims, damages, losses, or expenses arising from
                your use of the Service or violation of these Terms.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-dark mb-3">11. Modifications to Terms</h2>
              <p>
                We reserve the right to modify these Terms at any time. We will notify you of
                material changes by posting the updated Terms on our website. Your continued use of
                the Service after such changes constitutes acceptance of the new Terms.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-dark mb-3">12. Governing Law</h2>
              <p>
                These Terms shall be governed by and construed in accordance with the laws of the
                State of Israel, without regard to its conflict of law provisions.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-dark mb-3">13. Contact Us</h2>
              <p>
                If you have any questions about these Terms of Service, please contact us at:{' '}
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
