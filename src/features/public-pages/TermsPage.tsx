import React, { useEffect } from 'react';
import PublicPageLayout from './components/PublicPageLayout';
import { FileText, CheckCircle2, AlertTriangle, ShieldCheck, Scale, HelpCircle } from 'lucide-react';

export const TermsPage: React.FC = () => {
  useEffect(() => {
    document.title = 'SpiralDine | Terms of Service';
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
            <Scale className="w-3.5 h-3.5" />
            <span>Platform Agreement</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-display font-extrabold text-[#17202A] tracking-tight mb-4">
            Terms of Service
          </h1>
          <p className="text-sm text-[#667085] leading-relaxed">
            Effective: October 2026 · Governing all diners, guests, and restaurant partners on SpiralDine
          </p>
        </div>

        {/* Content Blocks */}
        <div className="space-y-10 text-sm text-[#475467] leading-relaxed">
          <section className="bg-white p-8 rounded-2xl border border-[#E8DED6] shadow-xs space-y-4">
            <div className="flex items-center space-x-3 text-[#17202A]">
              <FileText className="w-5 h-5 text-[#D65336]" />
              <h2 className="text-lg font-bold font-display">1. Acceptance of Terms</h2>
            </div>
            <p>
              By accessing SpiralDine through web browsers or native mobile applications, or by scanning restaurant QR codes at participating partner venues, you agree to these Terms of Service.
            </p>
          </section>

          <section className="bg-white p-8 rounded-2xl border border-[#E8DED6] shadow-xs space-y-4">
            <div className="flex items-center space-x-3 text-[#17202A]">
              <CheckCircle2 className="w-5 h-5 text-[#D65336]" />
              <h2 className="text-lg font-bold font-display">2. Dine-In Ordering & Table Sessions</h2>
            </div>
            <p>
              When dining at a partner restaurant:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-xs">
              <li>Each QR code links to a verified table inside the authenticated restaurant venue.</li>
              <li>Placed orders are immediately sent to the kitchen display system (KDS) for preparation.</li>
              <li>Customers agree to settle all accumulated charges incurred during an active table session prior to leaving the premises.</li>
              <li>SpiralDine provides digital bill calculation including statutory GST and declared service charges as configured by the restaurant.</li>
            </ul>
          </section>

          <section className="bg-white p-8 rounded-2xl border border-[#E8DED6] shadow-xs space-y-4">
            <div className="flex items-center space-x-3 text-[#17202A]">
              <AlertTriangle className="w-5 h-5 text-[#D65336]" />
              <h2 className="text-lg font-bold font-display">3. Food Quality & Allergen Disclaimer</h2>
            </div>
            <p>
              While SpiralDine enables customers to declare food allergies and view dietary badges (Pure Veg, Halal, Jain, Gluten-Free), the preparation and handling of food is the sole operational responsibility of the independent restaurant partner. Diners with severe allergies must verbally inform the restaurant server before ordering.
            </p>
          </section>

          <section className="bg-white p-8 rounded-2xl border border-[#E8DED6] shadow-xs space-y-4">
            <div className="flex items-center space-x-3 text-[#17202A]">
              <ShieldCheck className="w-5 h-5 text-[#D65336]" />
              <h2 className="text-lg font-bold font-display">4. Platform Availability & Security</h2>
            </div>
            <p>
              SpiralDine maintains high availability SaaS cloud systems with real-time Firebase synchronization. We prohibit unauthorized vulnerability testing, scraping, tampering with QR parameters, or bypassing restaurant payment gateways.
            </p>
          </section>

          <section className="bg-white p-8 rounded-2xl border border-[#E8DED6] shadow-xs space-y-4">
            <div className="flex items-center space-x-3 text-[#17202A]">
              <HelpCircle className="w-5 h-5 text-[#D65336]" />
              <h2 className="text-lg font-bold font-display">5. Dispute Resolution</h2>
            </div>
            <p>
              In the event of an order or billing dispute, customers can raise a support request directly in the SpiralDine Help & Support panel or contact:
            </p>
            <p className="text-xs font-semibold text-[#17202A]">
              legal@spiraldine.com · Spiral World Technologies
            </p>
          </section>
        </div>
      </div>
    </PublicPageLayout>
  );
};

export default TermsPage;
