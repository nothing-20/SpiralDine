import React, { useEffect } from 'react';
import PublicPageLayout from './components/PublicPageLayout';
import { RefreshCcw, CalendarX, CreditCard, Clock, CheckCircle } from 'lucide-react';

export const RefundPolicyPage: React.FC = () => {
  useEffect(() => {
    document.title = 'SpiralDine | Refund & Cancellation Policy';
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
            <RefreshCcw className="w-3.5 h-3.5" />
            <span>Policy Guidelines</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-display font-extrabold text-[#17202A] tracking-tight mb-4">
            Refund & Cancellation Policy
          </h1>
          <p className="text-sm text-[#667085] leading-relaxed">
            Effective: October 2026 · Transparent cancellation and refund guidelines
          </p>
        </div>

        {/* Content Blocks */}
        <div className="space-y-10 text-sm text-[#475467] leading-relaxed">
          <section className="bg-white p-8 rounded-2xl border border-[#E8DED6] shadow-xs space-y-4">
            <div className="flex items-center space-x-3 text-[#17202A]">
              <CalendarX className="w-5 h-5 text-[#D65336]" />
              <h2 className="text-lg font-bold font-display">1. Table Reservation Cancellations</h2>
            </div>
            <p>
              Diners may cancel an upcoming table reservation at any time before the scheduled slot via the <strong>My Table Bookings</strong> tab in their Profile. 
            </p>
            <ul className="list-disc pl-5 space-y-2 text-xs">
              <li>Free cancellation is honored up to 30 minutes before the reserved dining time.</li>
              <li>When a booking is cancelled, the table is instantly returned to the restaurant's live available inventory.</li>
              <li>If a restaurant partner required an advance reservation deposit, the deposit is automatically refunded to the original payment source within 3 to 5 business days.</li>
            </ul>
          </section>

          <section className="bg-white p-8 rounded-2xl border border-[#E8DED6] shadow-xs space-y-4">
            <div className="flex items-center space-x-3 text-[#17202A]">
              <Clock className="w-5 h-5 text-[#D65336]" />
              <h2 className="text-lg font-bold font-display">2. Dine-In Food Orders</h2>
            </div>
            <p>
              Because food is freshly prepared upon order submission to the kitchen:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-xs">
              <li>Orders that have transitioned to <strong>PREPARING</strong> or <strong>READY</strong> status cannot be cancelled by the diner.</li>
              <li>If an item is unavailable or out-of-stock, the kitchen or waiter will notify the guest, and the line item is removed from the finalized bill with zero charge.</li>
            </ul>
          </section>

          <section className="bg-white p-8 rounded-2xl border border-[#E8DED6] shadow-xs space-y-4">
            <div className="flex items-center space-x-3 text-[#17202A]">
              <CreditCard className="w-5 h-5 text-[#D65336]" />
              <h2 className="text-lg font-bold font-display">3. Payment Errors & Duplicate Debits</h2>
            </div>
            <p>
              In the unlikely event of a duplicate bank debit during online UPI/Card checkout:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-xs">
              <li>The payment gateway reconciles pending and duplicate transactions automatically.</li>
              <li>Unverified or duplicate charges are reversed to the customer's original funding account within 48 to 72 business hours.</li>
              <li>Guests can submit an inquiry with their transaction ID under the <strong>Help & Support</strong> section.</li>
            </ul>
          </section>

          <section className="bg-white p-8 rounded-2xl border border-[#E8DED6] shadow-xs space-y-4">
            <div className="flex items-center space-x-3 text-[#17202A]">
              <CheckCircle className="w-5 h-5 text-[#D65336]" />
              <h2 className="text-lg font-bold font-display">4. Billing Support Inquiries</h2>
            </div>
            <p>
              For any billing adjustment requests or refund assistance, our dedicated billing desk is available at:
            </p>
            <p className="text-xs font-semibold text-[#17202A]">
              billing@spiraldine.com · SpiralDine Billing Services
            </p>
          </section>
        </div>
      </div>
    </PublicPageLayout>
  );
};

export default RefundPolicyPage;
