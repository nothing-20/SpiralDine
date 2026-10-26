import React, { useState, useEffect } from 'react';
import PublicPageLayout from './components/PublicPageLayout';
import { HelpCircle, ChevronDown, ChevronUp, Search, Utensils, Calendar, CreditCard, ShieldCheck } from 'lucide-react';

interface IFAQItem {
  q: string;
  a: string;
  category: 'ordering' | 'booking' | 'payments' | 'general';
}

const FAQ_DATA: IFAQItem[] = [
  {
    category: 'ordering',
    q: 'How does QR ordering work at the table?',
    a: 'Simply scan the QR code located on your dining table using your mobile phone camera or the SpiralDine native app. Your table session will activate immediately, allowing you to browse the live menu, customize dishes, and place orders directly to the kitchen.'
  },
  {
    category: 'ordering',
    q: 'Do I need to download an application to order food?',
    a: 'No app download is required! SpiralDine works seamlessly in any mobile web browser (Chrome, Safari, Firefox). You can browse as a guest or sign in to save favourites and earn loyalty rewards.'
  },
  {
    category: 'booking',
    q: 'How can I reserve a table in advance?',
    a: 'Navigate to Explore or a restaurant details page, click "Book a Table", choose your preferred date, time slot, guest count, and seating preference. Your booking will be instantly confirmed with the restaurant.'
  },
  {
    category: 'booking',
    q: 'Can I cancel or modify my table reservation?',
    a: 'Yes. Visit your Profile and open "My Table Bookings". You can cancel upcoming reservations at any time without fees up to 30 minutes before your reservation slot.'
  },
  {
    category: 'payments',
    q: 'What payment methods are supported for bill settlement?',
    a: 'SpiralDine supports instant UPI (Google Pay, PhonePe, Paytm), credit/debit cards, net banking, and verified cash settlements at the table with the waiter.'
  },
  {
    category: 'payments',
    q: 'Where can I find itemized receipts from past meals?',
    a: 'All past dining receipts are safely archived under "My Activity" > "My Receipts" in your Profile, including complete item breakdowns, taxes, and payment confirmation IDs.'
  },
  {
    category: 'general',
    q: 'How does SpiralDine handle food allergies?',
    a: 'You can record your food allergies and dietary habits in the Dining Preferences section of your Profile. While dietary badges are displayed across menus, please always verbally remind your server for critical allergies.'
  },
  {
    category: 'general',
    q: 'How can a restaurant join SpiralDine?',
    a: 'Restaurant owners can register at any time by clicking "Create Restaurant Account" or contacting sales via the Contact page. Our onboarding team activates digital menus and tables in less than 24 hours.'
  }
];

export const FAQPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'ordering' | 'booking' | 'payments' | 'general'>('all');
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  useEffect(() => {
    document.title = 'SpiralDine | Help Center & FAQ';
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, []);

  const filteredFaqs = FAQ_DATA.filter(faq => {
    const matchesCat = selectedCategory === 'all' || faq.category === selectedCategory;
    const matchesQuery = !searchQuery || 
      faq.q.toLowerCase().includes(searchQuery.toLowerCase()) || 
      faq.a.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesQuery;
  });

  return (
    <PublicPageLayout>
      <div className="max-w-4xl mx-auto px-6 py-16 text-left">
        {/* Header */}
        <div className="mb-12 text-center md:text-left">
          <div className="inline-flex items-center space-x-2 px-3 py-1 bg-[#FCEDE7] rounded-full text-[#D65336] text-xs font-bold mb-4">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Help Center & Knowledgebase</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-display font-extrabold text-[#17202A] tracking-tight mb-4">
            Frequently Asked Questions
          </h1>
          <p className="text-sm text-[#667085] leading-relaxed max-w-xl">
            Everything you need to know about contactless table dining, reservations, payments, and account preferences.
          </p>

          {/* Search Bar */}
          <div className="mt-8 relative max-w-lg">
            <Search className="w-4 h-4 text-[#8A817A] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search help topics or questions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white border border-[#E8DED6] rounded-xl text-xs text-[#17202A] focus:outline-none focus:border-[#D65336] shadow-xs"
            />
          </div>

          {/* Category Tabs */}
          <div className="flex flex-wrap gap-2 mt-6">
            {(['all', 'ordering', 'booking', 'payments', 'general'] as const).map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all capitalize ${
                  selectedCategory === cat 
                    ? 'bg-[#17202A] text-white shadow-xs' 
                    : 'bg-white border border-[#E8DED6] text-[#667085] hover:text-[#17202A]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* FAQs Accordion */}
        <div className="space-y-4">
          {filteredFaqs.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-[#E8DED6]">
              <HelpCircle className="w-8 h-8 text-[#8A817A] mx-auto mb-2 opacity-50" />
              <p className="text-xs font-bold text-[#17202A]">No matching questions found</p>
              <p className="text-[11px] text-[#667085] mt-1">Try another keyword or search category.</p>
            </div>
          ) : (
            filteredFaqs.map((faq, idx) => {
              const isOpen = openIndex === idx;
              return (
                <div 
                  key={idx} 
                  className="bg-white rounded-2xl border border-[#E8DED6] shadow-xs overflow-hidden transition-all"
                >
                  <button
                    onClick={() => setOpenIndex(isOpen ? null : idx)}
                    className="w-full p-5 flex items-center justify-between text-left hover:bg-[#FAF6F2] transition-colors"
                  >
                    <span className="text-xs md:text-sm font-bold text-[#17202A] pr-4">
                      {faq.q}
                    </span>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-[#D65336] shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-[#8A817A] shrink-0" />
                    )}
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 pt-1 text-xs text-[#667085] leading-relaxed border-t border-[#F2ECE6]">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </PublicPageLayout>
  );
};

export default FAQPage;
