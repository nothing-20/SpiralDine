import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Keyboard, Sparkles, ArrowLeft, Mail, CheckCircle2 } from 'lucide-react';
import PublicPageLayout from './components/PublicPageLayout';

export const AccessibilityPage: React.FC = () => {
  useEffect(() => {
    document.title = 'SpiralDine | Accessibility Statement';
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
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-700 text-xs font-bold">
            <Eye className="w-3.5 h-3.5" />
            Inclusive Dining &amp; Software
          </div>
          <h1 className="text-3xl md:text-4xl font-display font-extrabold tracking-tight text-[#17202A]">
            Accessibility Statement
          </h1>
          <p className="text-sm text-[#667085]">
            Our commitment to Web Content Accessibility Guidelines (WCAG) 2.2 Level AA compliance
          </p>
        </div>

        <div className="space-y-8 text-sm text-[#344054] leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-[#17202A]">1. Our Inclusive Commitment</h2>
            <p>
              Spiral World believes that hospitality technology must be accessible to everyone, including diners and restaurant staff with visual, auditory, motor, or cognitive disabilities. We actively design and engineer SpiralDine to align with the <strong>Web Content Accessibility Guidelines (WCAG) 2.2 Level AA</strong>.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-[#17202A]">2. Key Accessibility Features Implemented</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-[#E8DED6] bg-white rounded-xl p-5 space-y-2">
                <div className="flex items-center gap-2 font-bold text-[#17202A] text-sm">
                  <Keyboard className="w-4 h-4 text-[#D65336]" />
                  Keyboard Navigation
                </div>
                <p className="text-xs text-[#667085]">
                  All interactive elements—including menu item selection, modifier trays, cart checkout, and dashboard tables—are fully operable via keyboard tabs with clear visible focus rings.
                </p>
              </div>

              <div className="border border-[#E8DED6] bg-white rounded-xl p-5 space-y-2">
                <div className="flex items-center gap-2 font-bold text-[#17202A] text-sm">
                  <Eye className="w-4 h-4 text-emerald-600" />
                  Color Contrast &amp; Typography
                </div>
                <p className="text-xs text-[#667085]">
                  Text colors achieve a minimum contrast ratio of 4.5:1 against backgrounds. Veg/Non-veg dietary markers use shape indicators (square with green circle / brown triangle) alongside text descriptions so information is never conveyed by color alone.
                </p>
              </div>

              <div className="border border-[#E8DED6] bg-white rounded-xl p-5 space-y-2">
                <div className="flex items-center gap-2 font-bold text-[#17202A] text-sm">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  Screen-Reader Optimization
                </div>
                <p className="text-xs text-[#667085]">
                  Menus, modal dialogs, and notifications leverage semantic HTML5 landmarks, <code>aria-live="polite"</code> for status updates, and descriptive button labels for assistive technology.
                </p>
              </div>

              <div className="border border-[#E8DED6] bg-white rounded-xl p-5 space-y-2">
                <div className="flex items-center gap-2 font-bold text-[#17202A] text-sm">
                  <CheckCircle2 className="w-4 h-4 text-blue-600" />
                  Touch Targets &amp; Zoom
                </div>
                <p className="text-xs text-[#667085]">
                  All buttons and interactive cards meet the recommended minimum 44x44px touch target size for mobile dining. The layout supports browser zoom up to 200% without horizontal scrolling or clipped content.
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-[#17202A]">3. Technical Specifications</h2>
            <p>
              Accessibility of SpiralDine relies on the following technologies to work with the particular combination of web browser and assistive technologies or plugins installed on your computer or mobile device:
            </p>
            <ul className="list-disc pl-5 text-xs text-[#344054] space-y-1">
              <li>HTML5 Semantic Landmarks (<code>&lt;header&gt;</code>, <code>&lt;main&gt;</code>, <code>&lt;nav&gt;</code>, <code>&lt;footer&gt;</code>, <code>&lt;aside&gt;</code>)</li>
              <li>WAI-ARIA 1.2 Attributes (roles, states, and properties)</li>
              <li>CSS3 Media Queries supporting <code>prefers-reduced-motion</code></li>
              <li>Responsive Viewport configurations supporting accessibility magnification</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-[#17202A]">4. Feedback &amp; Assistance</h2>
            <p>
              We welcome your feedback on the accessibility of SpiralDine. If you encounter accessibility barriers on any screen or need assistance placing an order, please contact our team:
            </p>
            <div className="p-4 bg-white border border-[#E8DED6] rounded-xl text-xs space-y-1">
              <p><strong>Accessibility Support:</strong> Spiral World Inclusion Desk</p>
              <p><strong>Email:</strong> <a href="mailto:accessibility@restaurantos.com" className="text-[#D65336] underline">accessibility@restaurantos.com</a></p>
              <p><strong>Response Time:</strong> We strive to respond to accessibility reports within 2 business days.</p>
            </div>
          </section>
        </div>
      </div>
    </PublicPageLayout>
  );
};

export default AccessibilityPage;
