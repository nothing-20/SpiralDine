import React, { useEffect } from 'react';
import PublicPageLayout from './components/PublicPageLayout';
import { ShieldCheck, Lock, Eye, Database, Server, RefreshCw } from 'lucide-react';

export const PrivacyPage: React.FC = () => {
  useEffect(() => {
    document.title = 'SpiralDine | Privacy Policy';
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, []);

  return (
    <PublicPageLayout>
      <div className="max-w-4xl mx-auto px-6 py-16 text-left">
        {/* Header */}
        <div className="mb-12">
          <div className="inline-flex items-center space-x-2 px-3 py-1 bg-[#FCEDE7] rounded-full text-[#D65336] text-xs font-bold mb-4">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Privacy & Data Protection</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-display font-extrabold text-[#17202A] tracking-tight mb-4">
            Privacy Policy
          </h1>
          <p className="text-sm text-[#667085] leading-relaxed">
            Last updated: October 2026 · SpiralDine Platform by Spiral World
          </p>
        </div>

        {/* Content Blocks */}
        <div className="space-y-10 text-sm text-[#475467] leading-relaxed">
          <section className="bg-white p-8 rounded-2xl border border-[#E8DED6] shadow-xs space-y-4">
            <div className="flex items-center space-x-3 text-[#17202A]">
              <Lock className="w-5 h-5 text-[#D65336]" />
              <h2 className="text-lg font-bold font-display">1. Information We Collect</h2>
            </div>
            <p>
              When you use SpiralDine as a dining customer or restaurant partner, we collect necessary operational details to fulfill orders, process payments, and ensure table hospitality:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-xs">
              <li><strong>Customer Account & Identity:</strong> Name, verified email address, phone number, and authenticated Firebase UID.</li>
              <li><strong>Dining & Ordering Details:</strong> Table sessions, scanned QR coordinates, selected food dishes, dietary notes, and allergen declarations.</li>
              <li><strong>Financial History:</strong> Order totals, tax breakdowns (CGST/SGST), payment status, and transaction reference numbers. <em>(Note: SpiralDine never stores raw credit/debit card numbers or UPI PINs on its servers)</em>.</li>
              <li><strong>Preferences:</strong> Vegetarian preference, preferred cuisines, and notification preferences.</li>
            </ul>
          </section>

          <section className="bg-white p-8 rounded-2xl border border-[#E8DED6] shadow-xs space-y-4">
            <div className="flex items-center space-x-3 text-[#17202A]">
              <Eye className="w-5 h-5 text-[#D65336]" />
              <h2 className="text-lg font-bold font-display">2. How We Use Your Information</h2>
            </div>
            <p>
              Your data is strictly utilized to operate our dining SaaS infrastructure:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-xs">
              <li>Routing food orders directly to authorized restaurant kitchens and waitstaff displays.</li>
              <li>Generating verifiable digital tax invoices and itemized receipts.</li>
              <li>Managing table reservations and seating capacity without double-booking.</li>
              <li>Dispatching critical transactional notifications regarding order readiness and payment confirmation.</li>
            </ul>
          </section>

          <section className="bg-white p-8 rounded-2xl border border-[#E8DED6] shadow-xs space-y-4">
            <div className="flex items-center space-x-3 text-[#17202A]">
              <Server className="w-5 h-5 text-[#D65336]" />
              <h2 className="text-lg font-bold font-display">3. Multi-Tenant Data Isolation</h2>
            </div>
            <p>
              SpiralDine enforces strict multi-tenant boundaries via Google Cloud Firestore security rules. Restaurant owners and staff can only read orders, receipts, and table states for their specific authenticated establishment. Customer personal data is never shared with unrelated restaurants.
            </p>
          </section>

          <section className="bg-white p-8 rounded-2xl border border-[#E8DED6] shadow-xs space-y-4">
            <div className="flex items-center space-x-3 text-[#17202A]">
              <Database className="w-5 h-5 text-[#D65336]" />
              <h2 className="text-lg font-bold font-display">4. Account Deletion & Retention</h2>
            </div>
            <p>
              Customers have the right to delete their accounts at any time via the customer Settings screen. Upon deletion:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-xs">
              <li>Personal identity attributes (name, phone, credentials) are permanently anonymized.</li>
              <li>Firebase Authentication accounts are terminated.</li>
              <li>Historical financial transactions, taxes, and order receipts are retained in anonymized format to fulfill legal, tax, and auditing requirements under applicable commercial law.</li>
            </ul>
          </section>

          <section className="bg-white p-8 rounded-2xl border border-[#E8DED6] shadow-xs space-y-4">
            <div className="flex items-center space-x-3 text-[#17202A]">
              <RefreshCw className="w-5 h-5 text-[#D65336]" />
              <h2 className="text-lg font-bold font-display">5. Contact Our Privacy Office</h2>
            </div>
            <p>
              If you have inquiries regarding your personal data or wish to exercise data rights:
            </p>
            <p className="text-xs font-semibold text-[#17202A]">
              Email: privacy@spiraldine.com · Spiral World Technologies
            </p>
          </section>
        </div>
      </div>
    </PublicPageLayout>
  );
};

export default PrivacyPage;
