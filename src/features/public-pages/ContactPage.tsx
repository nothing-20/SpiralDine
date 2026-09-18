import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import PublicPageLayout from './components/PublicPageLayout';
import { 
  Mail, 
  Phone, 
  Building2, 
  Send, 
  CheckCircle, 
  AlertCircle, 
  Sparkles,
  Clock,
  HelpCircle,
  ArrowRight
} from 'lucide-react';

export const ContactPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialPlan = searchParams.get('plan');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [restaurantName, setRestaurantName] = useState('');
  const [subject, setSubject] = useState(
    initialPlan ? `Inquiry regarding ${initialPlan.toUpperCase()} Plan` : 'Restaurant Onboarding'
  );
  const [message, setMessage] = useState(
    initialPlan 
      ? `Hi SpiralDine team, I would like to learn more and get a quotation for the ${initialPlan.toUpperCase()} plan for my restaurant.`
      : ''
  );

  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error' | 'unavailable'>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    document.title = 'SpiralDine | Contact';
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, []);

  const subjects = [
    'Restaurant Onboarding',
    'Product Questions & Demo',
    'Partnership Enquiries',
    'Technical Support',
    'Business & Enterprise Inquiries',
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      setStatus('error');
      setStatusMessage('Please fill in your name, email, and message.');
      return;
    }

    setStatus('submitting');
    setStatusMessage('');

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          email,
          phone,
          restaurantName,
          subject,
          message,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setStatus('success');
        setStatusMessage('Your message has been sent successfully. Our team will get back to you shortly.');
        setName('');
        setEmail('');
        setPhone('');
        setRestaurantName('');
        setMessage('');
      } else if (response.status === 503 || !data.success) {
        // Backend service is unconfigured or unavailable
        setStatus('unavailable');
        setStatusMessage(
          'Contact form submission is currently unavailable. Please reach out directly to our configured support email: support@restaurantos.com'
        );
      } else {
        setStatus('error');
        setStatusMessage(data.error || 'Failed to submit form. Please try again or email support@restaurantos.com');
      }
    } catch (err: any) {
      console.warn('[ContactPage] Submission error:', err);
      setStatus('unavailable');
      setStatusMessage(
        'Contact form submission is currently unavailable. Please reach out directly to our configured support email: support@restaurantos.com'
      );
    }
  };

  return (
    <PublicPageLayout>
      <div className="w-full max-w-7xl mx-auto px-6 py-12 md:py-16 text-left">
        
        {/* HERO SECTION */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#FCEDE7] border border-[#F5CBC4] text-[11px] font-bold uppercase tracking-wider text-[#D65336]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Direct Support & Onboarding</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-display font-extrabold tracking-tight text-[#17202A] leading-[1.15]">
            Contact SpiralDine
            <span className="block text-[#D65336] mt-1">We're here to help your restaurant grow.</span>
          </h1>

          <p className="text-base sm:text-lg text-[#667085] leading-relaxed max-w-2xl mx-auto pt-2">
            Have questions about digital QR ordering, kitchen display workflows, or restaurant group setups? Our specialists are ready to assist you.
          </p>
        </div>

        {/* MAIN CONTACT CONTAINER */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT: Direct Contact Information */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white border border-[#E8DED6] rounded-[24px] p-8 shadow-xs space-y-6">
              <div>
                <h2 className="text-xl font-display font-extrabold text-[#17202A]">
                  How can we help?
                </h2>
                <p className="text-xs text-[#667085] mt-1.5 leading-relaxed">
                  Reach out for restaurant onboarding, live product walkthroughs, enterprise rollouts, or operational support.
                </p>
              </div>

              <div className="space-y-4 pt-2">
                <div className="flex items-start space-x-3.5 p-3.5 rounded-xl bg-[#FCFAF7] border border-[#E8DED6]/80">
                  <div className="w-9 h-9 rounded-xl bg-[#FCEDE7] text-[#D65336] flex items-center justify-center shrink-0">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#8A817A]">
                      Official Support Email
                    </span>
                    <p className="text-xs font-bold text-[#17202A] mt-0.5">
                      <a href="mailto:support@restaurantos.com" className="hover:text-[#D65336] transition-colors">
                        support@restaurantos.com
                      </a>
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3.5 p-3.5 rounded-xl bg-[#FCFAF7] border border-[#E8DED6]/80">
                  <div className="w-9 h-9 rounded-xl bg-[#E8F5EF] text-[#087B5B] flex items-center justify-center shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#8A817A]">
                      Response Hours
                    </span>
                    <p className="text-xs font-bold text-[#17202A] mt-0.5">
                      Monday to Saturday, 9:00 AM – 8:00 PM IST
                    </p>
                    <p className="text-[11px] text-[#667085] mt-0.5">
                      Urgent KDS & dining room issues prioritized
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3.5 p-3.5 rounded-xl bg-[#FCFAF7] border border-[#E8DED6]/80">
                  <div className="w-9 h-9 rounded-xl bg-[#F7F0EA] text-[#17202A] flex items-center justify-center shrink-0">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#8A817A]">
                      Onboarding Inquiries
                    </span>
                    <p className="text-xs font-bold text-[#17202A] mt-0.5">
                      Ready to digitize your restaurant?
                    </p>
                    <Link to="/register" className="text-xs text-[#D65336] font-bold inline-flex items-center space-x-1 mt-1 hover:underline">
                      <span>Create your restaurant account</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-[#E8DED6]">
                <h4 className="text-xs font-bold text-[#17202A] mb-2">Available for:</h4>
                <div className="flex flex-wrap gap-2">
                  {[
                    'Restaurant Onboarding',
                    'Product Questions',
                    'Partnership Enquiries',
                    'Technical Support',
                    'Business Enquiries',
                  ].map((tag, idx) => (
                    <span key={idx} className="px-2.5 py-1 rounded-lg bg-[#F7F0EA] text-[11px] font-semibold text-[#17202A]">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: Contact Form */}
          <div className="lg:col-span-7">
            <div className="bg-white border border-[#E8DED6] rounded-[24px] p-8 md:p-10 shadow-xs space-y-6">
              <div>
                <h2 className="text-xl font-display font-extrabold text-[#17202A]">
                  Send a Message
                </h2>
                <p className="text-xs text-[#667085] mt-1">
                  Fill out the form below and an operations specialist will connect with you.
                </p>
              </div>

              {/* Status alerts */}
              {status === 'success' && (
                <div className="p-4 rounded-xl bg-[#E8F5EF] border border-[#087B5B]/30 flex items-start space-x-3 text-xs text-[#066349]">
                  <CheckCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#087B5B]" />
                  <span>{statusMessage}</span>
                </div>
              )}

              {status === 'unavailable' && (
                <div className="p-4 rounded-xl bg-[#FFF5F5] border border-red-200 flex items-start space-x-3 text-xs text-red-700">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                  <div className="space-y-1">
                    <p className="font-semibold">{statusMessage}</p>
                    <p className="text-[11px] text-red-600">
                      You can send your details directly via email to{' '}
                      <a href="mailto:support@restaurantos.com" className="font-bold underline">
                        support@restaurantos.com
                      </a>
                      .
                    </p>
                  </div>
                </div>
              )}

              {status === 'error' && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start space-x-3 text-xs text-red-600">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{statusMessage}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Name */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#17202A]">
                      Full Name <span className="text-[#D65336]">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Alex Sharma"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8DED6] bg-[#FCFAF7] text-xs text-[#17202A] placeholder-[#8A817A] focus:outline-none focus:border-[#D65336] focus:bg-white transition-all"
                    />
                  </div>

                  {/* Email */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#17202A]">
                      Work / Personal Email <span className="text-[#D65336]">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="alex@restaurant.com"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8DED6] bg-[#FCFAF7] text-xs text-[#17202A] placeholder-[#8A817A] focus:outline-none focus:border-[#D65336] focus:bg-white transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Phone */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#17202A]">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8DED6] bg-[#FCFAF7] text-xs text-[#17202A] placeholder-[#8A817A] focus:outline-none focus:border-[#D65336] focus:bg-white transition-all"
                    />
                  </div>

                  {/* Restaurant Name */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#17202A]">
                      Restaurant / Business Name
                    </label>
                    <input
                      type="text"
                      value={restaurantName}
                      onChange={(e) => setRestaurantName(e.target.value)}
                      placeholder="e.g. Gourmet Bistro"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8DED6] bg-[#FCFAF7] text-xs text-[#17202A] placeholder-[#8A817A] focus:outline-none focus:border-[#D65336] focus:bg-white transition-all"
                    />
                  </div>
                </div>

                {/* Subject */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#17202A]">
                    Subject
                  </label>
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8DED6] bg-[#FCFAF7] text-xs text-[#17202A] focus:outline-none focus:border-[#D65336] focus:bg-white transition-all"
                  >
                    {subjects.map((subj, idx) => (
                      <option key={idx} value={subj}>
                        {subj}
                      </option>
                    ))}
                    {initialPlan && (
                      <option value={`Inquiry regarding ${initialPlan.toUpperCase()} Plan`}>
                        Inquiry regarding {initialPlan.toUpperCase()} Plan
                      </option>
                    )}
                  </select>
                </div>

                {/* Message */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#17202A]">
                    Message <span className="text-[#D65336]">*</span>
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Tell us about your restaurant, table capacity, or the questions you'd like answered..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8DED6] bg-[#FCFAF7] text-xs text-[#17202A] placeholder-[#8A817A] focus:outline-none focus:border-[#D65336] focus:bg-white transition-all resize-none"
                  />
                </div>

                {/* Submit button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={status === 'submitting'}
                    className="w-full sm:w-auto px-8 py-3.5 bg-[#D65336] hover:bg-[#B9432D] text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center justify-center space-x-2 disabled:opacity-60 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{status === 'submitting' ? 'Sending Message...' : 'Send Message'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>

        </div>

      </div>
    </PublicPageLayout>
  );
};

export default ContactPage;
