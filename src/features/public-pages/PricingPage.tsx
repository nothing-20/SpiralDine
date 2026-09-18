import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import PublicPageLayout from './components/PublicPageLayout';
import { 
  Check, 
  HelpCircle, 
  ArrowRight, 
  Sparkles, 
  ShieldCheck, 
  Layers, 
  Building 
} from 'lucide-react';

export const PricingPage: React.FC = () => {
  useEffect(() => {
    document.title = 'SpiralDine | Pricing';
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, []);

  const plans = [
    {
      id: 'starter',
      name: 'Starter',
      subtitle: 'For single-location restaurants and boutique cafes getting started with QR ordering.',
      badge: 'Single Location',
      priceDisplay: 'Contact Us',
      pricePeriod: 'Tailored to table count',
      ctaText: 'Contact Sales',
      ctaVariant: 'secondary',
      highlighted: false,
      features: [
        'Table-specific QR code ordering',
        'Digital interactive menu management',
        'Customer cart & order placement',
        'Live order status tracking',
        'Waiter assistance call alerts',
        'Cash payment confirmation workflow',
        'Basic daily sales summaries',
        'Single restaurant & branch support',
        'Community email support',
      ],
      notIncluded: [
        'Kitchen Display System (KDS)',
        'Chef performance analytics',
        'Multi-station preparation queue',
        'Real-time inventory alerts',
        'Multi-branch management',
      ],
    },
    {
      id: 'pro',
      name: 'Pro',
      subtitle: 'For busy dining rooms and growing restaurants needing synchronized kitchen & floor operations.',
      badge: 'Most Popular',
      priceDisplay: 'Contact Us',
      pricePeriod: 'Flexible monthly or annual plans',
      ctaText: 'Contact Sales',
      ctaVariant: 'primary',
      highlighted: true,
      features: [
        'Everything in Starter',
        'Full Kitchen Display System (KDS)',
        'Live kitchen ticket queue & course priority',
        'Chef & cook station assignments',
        'Waiter floor matrix with table states',
        'Integrated online payments (Razorpay)',
        'Cashier shift & drawer reconciliation',
        'Real-time inventory & low-stock alerts',
        'Reservation & table booking management',
        'Item performance & customer sales reports',
        'Priority technical assistance',
      ],
      notIncluded: [
        'Multi-tenant group governance',
        'Dedicated audit logs export',
        'Cross-branch inventory transfers',
      ],
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      subtitle: 'For restaurant groups, multi-branch chains, and large hospitality operations.',
      badge: 'Multi-Branch',
      priceDisplay: 'Custom',
      pricePeriod: 'Volume-based multi-unit pricing',
      ctaText: 'Contact Sales',
      ctaVariant: 'secondary',
      highlighted: false,
      features: [
        'Everything in Pro',
        'Multi-branch restaurant management',
        'Cross-branch inventory transfers',
        'Super Admin multi-tenant portal',
        'Custom Role-Based Access Control (RBAC)',
        'Immutable security audit logs',
        'Comprehensive multi-unit revenue rollups',
        'Dedicated account onboarding specialist',
        'Custom integration architecture reviews',
        'SLA-backed priority enterprise support',
      ],
      notIncluded: [],
    },
  ];

  const faqs = [
    {
      q: 'How does SpiralDine pricing work?',
      a: 'SpiralDine plans are configured based on your restaurant type, table count, and operational requirements (e.g. single-location café vs. multi-branch group). Contact our team to receive a tailored quotation that fits your business.',
    },
    {
      q: 'Do I need special POS hardware or proprietary tablets to use SpiralDine?',
      a: 'No proprietary hardware is required. SpiralDine runs smoothly in modern web browsers on any standard tablet, smartphone, laptop, or kitchen display monitor.',
    },
    {
      q: 'Can I start with the Starter plan and upgrade to Pro or Enterprise later?',
      a: 'Yes. You can start with table-side QR ordering and upgrade to the full Kitchen Display System and inventory management as your dining room volume grows.',
    },
    {
      q: 'How does table QR ordering work for our guests?',
      a: 'Guests scan a unique QR code at their assigned table using their smartphone camera. It immediately opens your live restaurant menu without downloading an app.',
    },
    {
      q: 'How are online customer payments settled?',
      a: 'SpiralDine supports direct online checkout powered by Razorpay as well as traditional table-side cash settlements with cashier drawer reconciliation.',
    },
  ];

  return (
    <PublicPageLayout>
      <div className="w-full max-w-7xl mx-auto px-6 py-12 md:py-16 text-left">
        
        {/* HERO SECTION */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#FCEDE7] border border-[#F5CBC4] text-[11px] font-bold uppercase tracking-wider text-[#D65336]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Transparent Plan Architecture</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-display font-extrabold tracking-tight text-[#17202A] leading-[1.15]">
            Pricing
            <span className="block text-[#D65336] mt-1">Choose the plan that fits your restaurant.</span>
          </h1>

          <p className="text-base sm:text-lg text-[#667085] leading-relaxed max-w-2xl mx-auto pt-2">
            Clear, honest pricing with zero hidden fees. We configure packages tailored to your table count and operational scale.
          </p>
        </div>

        {/* PRICING CARDS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch mb-20">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`rounded-[24px] p-8 md:p-9 flex flex-col justify-between transition-all relative ${
                plan.highlighted
                  ? 'bg-white border-2 border-[#D65336] shadow-lg shadow-[#D65336]/5 relative'
                  : 'bg-white border border-[#E8DED6] shadow-xs hover:shadow-sm'
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[#D65336] text-white text-[10px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-full shadow-xs">
                  {plan.badge}
                </div>
              )}

              <div className="space-y-6">
                <div>
                  {!plan.highlighted && (
                    <span className="inline-block text-[10px] font-extrabold uppercase tracking-wider text-[#8A817A] mb-1.5">
                      {plan.badge}
                    </span>
                  )}
                  <h2 className="text-2xl font-display font-extrabold text-[#17202A]">
                    {plan.name}
                  </h2>
                  <p className="text-xs text-[#667085] mt-2 leading-relaxed min-h-[40px]">
                    {plan.subtitle}
                  </p>
                </div>

                <div className="py-4 border-y border-[#E8DED6]">
                  <div className="flex items-baseline space-x-2">
                    <span className="text-3xl sm:text-4xl font-display font-extrabold text-[#17202A]">
                      {plan.priceDisplay}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#8A817A] mt-1">
                    {plan.pricePeriod}
                  </p>
                </div>

                <div className="space-y-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#17202A]">
                    Included Capabilities:
                  </p>
                  <ul className="space-y-2.5">
                    {plan.features.map((feature, fIdx) => (
                      <li key={fIdx} className="flex items-start space-x-2.5 text-xs text-[#17202A]">
                        <Check className="w-4 h-4 text-[#087B5B] shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                    {plan.notIncluded.map((feature, nIdx) => (
                      <li key={nIdx} className="flex items-start space-x-2.5 text-xs text-[#8A817A]/70 line-through">
                        <span className="w-4 h-4 text-center shrink-0 mt-0.5 text-[10px] leading-4 text-[#8A817A]/50">✕</span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="pt-8 mt-8 border-t border-[#E8DED6]">
                <Link
                  to={`/contact?plan=${plan.id}`}
                  className={`w-full py-3.5 px-6 rounded-xl font-bold text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                    plan.ctaVariant === 'primary'
                      ? 'bg-[#D65336] hover:bg-[#B9432D] text-white shadow-xs'
                      : 'bg-[#F7F0EA] hover:bg-[#EFE5DC] border border-[#E8DED6] text-[#17202A]'
                  }`}
                >
                  <span>{plan.ctaText}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* FAQ SECTION */}
        <div className="max-w-4xl mx-auto bg-white border border-[#E8DED6] rounded-[24px] p-8 md:p-12 shadow-xs">
          <div className="text-center space-y-2 mb-10">
            <h3 className="text-2xl font-display font-extrabold text-[#17202A]">
              Frequently Asked Questions
            </h3>
            <p className="text-xs text-[#667085]">
              Everything you need to know about getting started with SpiralDine.
            </p>
          </div>

          <div className="space-y-6 divide-y divide-[#E8DED6]">
            {faqs.map((faq, idx) => (
              <div key={idx} className={idx === 0 ? 'space-y-2' : 'pt-6 space-y-2'}>
                <h4 className="text-sm font-bold text-[#17202A] flex items-start space-x-2">
                  <HelpCircle className="w-4 h-4 text-[#D65336] shrink-0 mt-0.5" />
                  <span>{faq.q}</span>
                </h4>
                <p className="text-xs text-[#667085] leading-relaxed pl-6">
                  {faq.a}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-10 pt-6 border-t border-[#E8DED6] text-center">
            <p className="text-xs text-[#667085]">
              Have a custom question or need a multi-unit demonstration?{' '}
              <Link to="/contact" className="text-[#D65336] font-bold hover:underline">
                Contact our product specialists
              </Link>
            </p>
          </div>
        </div>

      </div>
    </PublicPageLayout>
  );
};

export default PricingPage;
