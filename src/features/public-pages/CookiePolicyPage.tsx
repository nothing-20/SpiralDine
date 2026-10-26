import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Cookie, ShieldCheck, Settings, ArrowLeft } from 'lucide-react';
import PublicPageLayout from './components/PublicPageLayout';
import { openCookieConsentModal } from '../../shared/utils/cookieConsent';

export const CookiePolicyPage: React.FC = () => {
  useEffect(() => {
    document.title = 'SpiralDine | Cookie Policy';
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, []);

  return (
    <PublicPageLayout>
      <div className="max-w-4xl mx-auto px-6 py-12 md:py-16 text-left">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs font-bold text-[#D65336] hover:underline mb-8"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Home
        </Link>

        <div className="space-y-4 mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D65336]/10 text-[#D65336] text-xs font-bold">
            <Cookie className="w-3.5 h-3.5" />
            Transparency & Consent
          </div>
          <h1 className="text-3xl md:text-4xl font-display font-extrabold tracking-tight text-[#17202A]">
            Cookie & Tracking Technologies Policy
          </h1>
          <p className="text-sm text-[#667085]">
            Last Updated: October 2026 &bull; Compliant with Indian DPDP Act, 2023 & International Privacy Standards
          </p>
        </div>

        {/* Interactive Preferences Banner */}
        <div className="bg-[#17202A] text-white rounded-2xl p-6 mb-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-md">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Settings className="w-4 h-4 text-[#D65336]" />
              Manage Your Cookie Preferences
            </h2>
            <p className="text-xs text-gray-300">
              You can review, modify, or withdraw your cookie consent at any point during your dining experience.
            </p>
          </div>
          <button
            type="button"
            onClick={openCookieConsentModal}
            className="px-4 py-2 bg-[#D65336] hover:bg-[#b8432b] text-white text-xs font-bold rounded-xl transition-all shadow shrink-0"
          >
            Customize Settings
          </button>
        </div>

        <div className="space-y-8 text-sm text-[#344054] leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-[#17202A]">1. What Are Cookies and Local Storage?</h2>
            <p>
              Cookies and browser local storage are small text files and client-side data containers stored on your device when you visit SpiralDine (via web browsers or QR-code dine-in scans). They allow the platform to remember your active table session, keep your shopping cart intact while browsing restaurant menus, and maintain secure authentication.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-[#17202A]">2. Categories of Technologies We Use</h2>
            
            <div className="space-y-4">
              <div className="border border-[#E8DED6] bg-white rounded-xl p-5">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-[#17202A] text-base">A. Strictly Necessary (Essential)</h3>
                  <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    Always Active
                  </span>
                </div>
                <p className="text-xs text-[#667085] mb-3">
                  These technologies are vital for core site functionality, fraud prevention, and session security. They cannot be disabled.
                </p>
                <ul className="list-disc pl-5 text-xs text-[#344054] space-y-1">
                  <li><strong>Firebase Auth Session Tokens:</strong> Securely authenticates diners, restaurant owners, waiters, and kitchen staff.</li>
                  <li><strong>Dine-In Table Token:</strong> Binds guest QR ordering to the verified physical table number without requiring passwords.</li>
                  <li><strong>Cart State:</strong> Retains your selected food items, modifiers, and quantities while you navigate menu categories.</li>
                  <li><strong>Payment Verification Context:</strong> Temporarily holds Razorpay order references to verify cryptographic signatures upon gateway callback.</li>
                </ul>
              </div>

              <div className="border border-[#E8DED6] bg-white rounded-xl p-5">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-[#17202A] text-base">B. Operational & Performance Analytics</h3>
                  <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                    Optional (Consent Required)
                  </span>
                </div>
                <p className="text-xs text-[#667085] mb-3">
                  Measures aggregated technical performance such as menu rendering latency and network error rates.
                </p>
                <ul className="list-disc pl-5 text-xs text-[#344054] space-y-1">
                  <li>We do <strong>NOT</strong> sell personal data or use third-party behavioral advertising trackers.</li>
                  <li>All performance measurements are aggregated and anonymized without cross-site profiling.</li>
                </ul>
              </div>

              <div className="border border-[#E8DED6] bg-white rounded-xl p-5">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-[#17202A] text-base">C. Personalization & Theme Preferences</h3>
                  <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                    Optional (Consent Required)
                  </span>
                </div>
                <p className="text-xs text-[#667085] mb-3">
                  Saves display customizations such as dark mode preferences and dietary filter selections (e.g., Pure Veg only).
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-[#17202A]">3. Third-Party Service Providers</h2>
            <p>
              SpiralDine integrates with trusted infrastructure partners to process orders and secure payments:
            </p>
            <ul className="list-disc pl-5 text-xs text-[#344054] space-y-2">
              <li><strong>Google Firebase:</strong> Database and authentication infrastructure. Uses session storage to maintain authentication claims.</li>
              <li><strong>Razorpay:</strong> Payment processing gateway. Deploys secure fraud-detection cookies during checkout to prevent duplicate card or UPI charges.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-[#17202A]">4. How to Manage and Revoke Consent</h2>
            <p>
              You can withdraw or update your consent at any time by clicking the "Customize Settings" button above or via the "Cookie Settings" link in the website footer. Additionally, you may clear cookies and local storage through your browser settings:
            </p>
            <ul className="list-disc pl-5 text-xs text-[#344054] space-y-1">
              <li><strong>Chrome / Android:</strong> Settings &gt; Privacy and Security &gt; Cookies and site data.</li>
              <li><strong>Safari / iOS:</strong> Settings &gt; Safari &gt; Advanced &gt; Website Data.</li>
              <li><strong>Firefox:</strong> Settings &gt; Privacy &amp; Security &gt; Cookies and Site Data.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-[#17202A]">5. Contact and Grievance Officer</h2>
            <p>
              For questions concerning this Cookie Policy or data privacy rights, contact our Data Protection Officer:
            </p>
            <div className="p-4 bg-white border border-[#E8DED6] rounded-xl text-xs space-y-1">
              <p><strong>Grievance Officer:</strong> Spiral World Data Privacy Cell</p>
              <p><strong>Email:</strong> <a href="mailto:privacy@restaurantos.com" className="text-[#D65336] underline">privacy@restaurantos.com</a></p>
              <p><strong>Platform:</strong> SpiralDine SaaS (Operating in compliance with Digital Personal Data Protection Act, 2023)</p>
            </div>
          </section>
        </div>
      </div>
    </PublicPageLayout>
  );
};

export default CookiePolicyPage;
