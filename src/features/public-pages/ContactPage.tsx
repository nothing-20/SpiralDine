import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import PublicPageLayout from './components/PublicPageLayout';
import {
  Mail,
  Building2,
  Send,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Clock,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import {
  CONTACT_ENQUIRY_CATEGORIES,
  OFFICIAL_SUPPORT_EMAIL,
  type ContactEnquiryCategory,
} from '../../shared/constants/contact';

interface ContactApiResponse {
  success?: boolean;
  code?: string;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
  referenceId?: string;
  acknowledgementSent?: boolean;
  fallbackEmail?: string;
}

const CLIENT_EMAIL_RE =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

function validateClientForm(values: {
  name: string;
  email: string;
  phone: string;
  restaurantName: string;
  category: string;
  subject: string;
  message: string;
}): Record<string, string> {
  const errors: Record<string, string> = {};

  const name = values.name.trim();
  if (!name) {
    errors.name = 'Full name is required.';
  } else if (name.length < 2) {
    errors.name = 'Please enter at least 2 characters for your name.';
  }

  const email = values.email.trim().toLowerCase();
  if (!email) {
    errors.email = 'Email address is required.';
  } else if (email.includes('..') || !CLIENT_EMAIL_RE.test(email)) {
    errors.email = 'Please enter a valid email address.';
  }

  const phone = values.phone.trim();
  if (phone) {
    const digits = phone.replace(/\D/g, '');
    if (!/^[+\d\s\-().]+$/.test(phone) || digits.length < 7 || digits.length > 15) {
      errors.phone = 'Please enter a valid phone number (7–15 digits) or leave it blank.';
    }
  }

  if (values.restaurantName.trim().length > 120) {
    errors.restaurantName = 'Restaurant or business name must be 120 characters or fewer.';
  }

  if (!values.category.trim()) {
    errors.category = 'Please choose an enquiry category.';
  }

  const subject = values.subject.trim();
  if (!subject) {
    errors.subject = 'Subject is required.';
  } else if (subject.length < 3) {
    errors.subject = 'Subject must be at least 3 characters.';
  }

  const message = values.message.trim();
  if (!message) {
    errors.message = 'Please enter your enquiry message.';
  } else if (message.length < 5) {
    errors.message = 'Message must be at least 5 characters.';
  } else if (message.length > 4000) {
    errors.message = 'Message must be 4000 characters or fewer.';
  }

  return errors;
}

export const ContactPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialPlan = searchParams.get('plan');

  const defaultCategory: ContactEnquiryCategory = initialPlan
    ? 'Business & Enterprise Inquiries'
    : 'Restaurant Onboarding';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [restaurantName, setRestaurantName] = useState('');
  const [category, setCategory] = useState<ContactEnquiryCategory>(defaultCategory);
  const [subject, setSubject] = useState(
    initialPlan ? `Inquiry regarding ${initialPlan.toUpperCase()} Plan` : ''
  );
  const [message, setMessage] = useState(
    initialPlan
      ? `Hi SpiralDine team, I would like to learn more and get a quotation for the ${initialPlan.toUpperCase()} plan for my restaurant.`
      : ''
  );
  // Hidden spam honeypot field
  const [website, setWebsite] = useState('');

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error' | 'unavailable'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [submissionDetails, setSubmissionDetails] = useState<{
    referenceId?: string;
    acknowledgementSent?: boolean;
    submittedEmail?: string;
    supportEmail: string;
  }>({ supportEmail: OFFICIAL_SUPPORT_EMAIL });

  const submittingRef = useRef(false);
  const lastSubmissionRef = useRef<{ signature: string; at: number } | null>(null);

  useEffect(() => {
    document.title = 'SpiralDine | Contact';
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, []);

  const clearFieldError = (field: string) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current || status === 'submitting') {
      return;
    }

    const clientErrors = validateClientForm({
      name,
      email,
      phone,
      restaurantName,
      category,
      subject,
      message,
    });

    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      setStatus('error');
      setStatusMessage(Object.values(clientErrors)[0]);
      return;
    }

    const signature = [
      email.trim().toLowerCase(),
      category.trim().toLowerCase(),
      subject.trim().toLowerCase().replace(/\s+/g, ' '),
      message.trim().toLowerCase().replace(/\s+/g, ' '),
    ].join('|');

    if (
      lastSubmissionRef.current &&
      lastSubmissionRef.current.signature === signature &&
      Date.now() - lastSubmissionRef.current.at < 120_000
    ) {
      setStatus('error');
      setStatusMessage(
        'This enquiry was already submitted just now. If you have more details to add, please update your message or wait a couple of minutes.'
      );
      return;
    }

    submittingRef.current = true;
    setFieldErrors({});
    setStatus('submitting');
    setStatusMessage('');

    const submittedEmail = email.trim().toLowerCase();

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          email: submittedEmail,
          phone: phone.trim(),
          restaurantName: restaurantName.trim(),
          category,
          subject: subject.trim(),
          message: message.trim(),
          website,
        }),
      });

      let data: ContactApiResponse = {};
      try {
        data = await response.json();
      } catch {
        data = {};
      }

      const fallbackEmail = data.fallbackEmail || OFFICIAL_SUPPORT_EMAIL;

      if (response.ok && data.success) {
        lastSubmissionRef.current = { signature, at: Date.now() };
        setStatus('success');
        setStatusMessage(
          data.message ||
            'Your enquiry has been received. Our SpiralDine team will reply to you shortly.'
        );
        setSubmissionDetails({
          referenceId: data.referenceId,
          acknowledgementSent: Boolean(data.acknowledgementSent),
          submittedEmail,
          supportEmail: fallbackEmail,
        });
        setName('');
        setEmail('');
        setPhone('');
        setRestaurantName('');
        setSubject('');
        setMessage('');
        setWebsite('');
        return;
      }

      if (data.fieldErrors && Object.keys(data.fieldErrors).length > 0) {
        setFieldErrors(data.fieldErrors);
      }

      if (response.status === 503 || data.code === 'SMTP_NOT_CONFIGURED') {
        setStatus('unavailable');
        setStatusMessage(
          data.error ||
            `Our online contact form is currently unavailable. Please email us directly at ${fallbackEmail}.`
        );
        setSubmissionDetails({ supportEmail: fallbackEmail });
        return;
      }

      setStatus('error');
      setStatusMessage(
        data.error ||
          `Failed to submit enquiry. Please try again or email ${fallbackEmail}.`
      );
      setSubmissionDetails({ supportEmail: fallbackEmail });
    } catch (err) {
      console.warn('[ContactPage] Submission error:', err);
      setStatus('unavailable');
      setStatusMessage(
        `Unable to reach the enquiry service right now. Please reach out directly to ${OFFICIAL_SUPPORT_EMAIL}.`
      );
      setSubmissionDetails({ supportEmail: OFFICIAL_SUPPORT_EMAIL });
    } finally {
      submittingRef.current = false;
    }
  };

  return (
    <PublicPageLayout>
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-12 md:py-16 text-left">
        {/* HERO SECTION */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#FCEDE7] border border-[#F5CBC4] text-[11px] font-bold uppercase tracking-wider text-[#D65336]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Direct Support &amp; Onboarding</span>
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-6xl font-display font-extrabold tracking-tight text-[#17202A] leading-[1.15]">
            Contact SpiralDine
            <span className="block text-[#D65336] mt-1">We&apos;re here to help your restaurant grow.</span>
          </h1>

          <p className="text-sm sm:text-lg text-[#667085] leading-relaxed max-w-2xl mx-auto pt-2">
            Have questions about digital QR ordering, kitchen display workflows, or restaurant group setups? Our specialists are ready to assist you.
          </p>
        </div>

        {/* MAIN CONTACT CONTAINER */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT: Direct Contact Information */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white border border-[#E8DED6] rounded-[24px] p-6 sm:p-8 shadow-xs space-y-6">
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
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#8A817A]">
                      Official Support Email
                    </span>
                    <p className="text-xs font-bold text-[#17202A] mt-0.5 break-all">
                      <a
                        href={`mailto:${OFFICIAL_SUPPORT_EMAIL}`}
                        className="hover:text-[#D65336] transition-colors"
                      >
                        {OFFICIAL_SUPPORT_EMAIL}
                      </a>
                    </p>
                    <p className="text-[11px] text-[#667085] mt-0.5">
                      Official Spiral World &amp; SpiralDine mailbox
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
                      Monday to Saturday, 9:00 AM &ndash; 8:00 PM IST
                    </p>
                    <p className="text-[11px] text-[#667085] mt-0.5">
                      Urgent KDS &amp; dining room issues prioritized
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
                    <Link
                      to="/register"
                      className="text-xs text-[#D65336] font-bold inline-flex items-center space-x-1 mt-1 hover:underline"
                    >
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
                  ].map((tag) => (
                    <span
                      key={tag}
                      className="px-2.5 py-1 rounded-lg bg-[#F7F0EA] text-[11px] font-semibold text-[#17202A]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: Contact Form */}
          <div className="lg:col-span-7">
            <div className="bg-white border border-[#E8DED6] rounded-[24px] p-6 sm:p-8 md:p-10 shadow-xs space-y-6">
              <div>
                <h2 className="text-xl font-display font-extrabold text-[#17202A]">
                  Send a Message
                </h2>
                <p className="text-xs text-[#667085] mt-1">
                  Fill out the form below and an operations specialist will respond to your email.
                </p>
              </div>

              {/* Status alerts */}
              <div aria-live="polite" className="space-y-3">
                {status === 'success' && (
                  <div className="p-4 rounded-xl bg-[#E8F5EF] border border-[#087B5B]/30 flex items-start space-x-3 text-xs text-[#066349]">
                    <CheckCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#087B5B]" />
                    <div className="space-y-1">
                      <p className="font-semibold">{statusMessage}</p>
                      {submissionDetails.referenceId && (
                        <p className="text-[11px] text-[#087B5B]">
                          Reference ID:{' '}
                          <span className="font-mono font-bold">
                            {submissionDetails.referenceId}
                          </span>
                        </p>
                      )}
                      {submissionDetails.acknowledgementSent && submissionDetails.submittedEmail && (
                        <p className="text-[11px] text-[#066349]">
                          We have also sent an acknowledgement receipt to{' '}
                          <span className="font-semibold break-all">
                            {submissionDetails.submittedEmail}
                          </span>
                          .
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {status === 'unavailable' && (
                  <div className="p-4 rounded-xl bg-[#FFF5F5] border border-red-200 flex items-start space-x-3 text-xs text-red-700">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                    <div className="space-y-1">
                      <p className="font-semibold">{statusMessage}</p>
                      <p className="text-[11px] text-red-600">
                        You can email our support team directly at{' '}
                        <a
                          href={`mailto:${submissionDetails.supportEmail}`}
                          className="font-bold underline break-all"
                        >
                          {submissionDetails.supportEmail}
                        </a>
                        .
                      </p>
                    </div>
                  </div>
                )}

                {status === 'error' && (
                  <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start space-x-3 text-xs text-red-700">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                    <div className="space-y-1">
                      <p className="font-semibold">{statusMessage}</p>
                      <p className="text-[11px] text-red-600">
                        Need immediate assistance? Write to{' '}
                        <a
                          href={`mailto:${submissionDetails.supportEmail}`}
                          className="font-bold underline break-all"
                        >
                          {submissionDetails.supportEmail}
                        </a>
                        .
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <form onSubmit={handleSubmit} noValidate className="space-y-4 relative">
                {/* Spam honeypot trap (kept invisible to human visitors) */}
                <div
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    left: '-9999px',
                    width: '1px',
                    height: '1px',
                    overflow: 'hidden',
                    opacity: 0,
                    pointerEvents: 'none',
                  }}
                >
                  <label htmlFor="contact-website">Leave this field empty</label>
                  <input
                    id="contact-website"
                    name="website"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Name */}
                  <div className="space-y-1.5">
                    <label htmlFor="contact-name" className="text-xs font-bold text-[#17202A]">
                      Full Name <span className="text-[#D65336]">*</span>
                    </label>
                    <input
                      id="contact-name"
                      type="text"
                      required
                      maxLength={100}
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        clearFieldError('name');
                      }}
                      className={`w-full px-3.5 py-2.5 rounded-xl border bg-[#FCFAF7] text-xs text-[#17202A] placeholder-[#8A817A] focus:outline-none focus:bg-white transition-all ${
                        fieldErrors.name
                          ? 'border-red-400 focus:border-red-500'
                          : 'border-[#E8DED6] focus:border-[#D65336]'
                      }`}
                    />
                    {fieldErrors.name && (
                      <p className="text-[11px] font-medium text-red-600">{fieldErrors.name}</p>
                    )}
                  </div>

                  {/* Email */}
                  <div className="space-y-1.5">
                    <label htmlFor="contact-email" className="text-xs font-bold text-[#17202A]">
                      Email Address <span className="text-[#D65336]">*</span>
                    </label>
                    <input
                      id="contact-email"
                      type="email"
                      required
                      maxLength={254}
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        clearFieldError('email');
                      }}
                      className={`w-full px-3.5 py-2.5 rounded-xl border bg-[#FCFAF7] text-xs text-[#17202A] placeholder-[#8A817A] focus:outline-none focus:bg-white transition-all ${
                        fieldErrors.email
                          ? 'border-red-400 focus:border-red-500'
                          : 'border-[#E8DED6] focus:border-[#D65336]'
                      }`}
                    />
                    {fieldErrors.email && (
                      <p className="text-[11px] font-medium text-red-600">{fieldErrors.email}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Phone */}
                  <div className="space-y-1.5">
                    <label htmlFor="contact-phone" className="text-xs font-bold text-[#17202A]">
                      Phone Number <span className="text-[#8A817A] font-normal">(Optional)</span>
                    </label>
                    <input
                      id="contact-phone"
                      type="tel"
                      maxLength={24}
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        clearFieldError('phone');
                      }}
                      className={`w-full px-3.5 py-2.5 rounded-xl border bg-[#FCFAF7] text-xs text-[#17202A] placeholder-[#8A817A] focus:outline-none focus:bg-white transition-all ${
                        fieldErrors.phone
                          ? 'border-red-400 focus:border-red-500'
                          : 'border-[#E8DED6] focus:border-[#D65336]'
                      }`}
                    />
                    {fieldErrors.phone && (
                      <p className="text-[11px] font-medium text-red-600">{fieldErrors.phone}</p>
                    )}
                  </div>

                  {/* Restaurant / Business Name */}
                  <div className="space-y-1.5">
                    <label htmlFor="contact-restaurant" className="text-xs font-bold text-[#17202A]">
                      Restaurant / Business Name{' '}
                      <span className="text-[#8A817A] font-normal">(Optional)</span>
                    </label>
                    <input
                      id="contact-restaurant"
                      type="text"
                      maxLength={120}
                      value={restaurantName}
                      onChange={(e) => {
                        setRestaurantName(e.target.value);
                        clearFieldError('restaurantName');
                      }}
                      className={`w-full px-3.5 py-2.5 rounded-xl border bg-[#FCFAF7] text-xs text-[#17202A] placeholder-[#8A817A] focus:outline-none focus:bg-white transition-all ${
                        fieldErrors.restaurantName
                          ? 'border-red-400 focus:border-red-500'
                          : 'border-[#E8DED6] focus:border-[#D65336]'
                      }`}
                    />
                    {fieldErrors.restaurantName && (
                      <p className="text-[11px] font-medium text-red-600">
                        {fieldErrors.restaurantName}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Enquiry Category */}
                  <div className="space-y-1.5">
                    <label htmlFor="contact-category" className="text-xs font-bold text-[#17202A]">
                      Enquiry Category <span className="text-[#D65336]">*</span>
                    </label>
                    <select
                      id="contact-category"
                      value={category}
                      onChange={(e) => {
                        setCategory(e.target.value as ContactEnquiryCategory);
                        clearFieldError('category');
                      }}
                      className={`w-full px-3.5 py-2.5 rounded-xl border bg-[#FCFAF7] text-xs text-[#17202A] focus:outline-none focus:bg-white transition-all ${
                        fieldErrors.category
                          ? 'border-red-400 focus:border-red-500'
                          : 'border-[#E8DED6] focus:border-[#D65336]'
                      }`}
                    >
                      {CONTACT_ENQUIRY_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                    {fieldErrors.category && (
                      <p className="text-[11px] font-medium text-red-600">{fieldErrors.category}</p>
                    )}
                  </div>

                  {/* Subject */}
                  <div className="space-y-1.5">
                    <label htmlFor="contact-subject" className="text-xs font-bold text-[#17202A]">
                      Subject <span className="text-[#D65336]">*</span>
                    </label>
                    <input
                      id="contact-subject"
                      type="text"
                      required
                      maxLength={150}
                      value={subject}
                      onChange={(e) => {
                        setSubject(e.target.value);
                        clearFieldError('subject');
                      }}
                      placeholder="Brief summary of your enquiry"
                      className={`w-full px-3.5 py-2.5 rounded-xl border bg-[#FCFAF7] text-xs text-[#17202A] placeholder-[#8A817A] focus:outline-none focus:bg-white transition-all ${
                        fieldErrors.subject
                          ? 'border-red-400 focus:border-red-500'
                          : 'border-[#E8DED6] focus:border-[#D65336]'
                      }`}
                    />
                    {fieldErrors.subject && (
                      <p className="text-[11px] font-medium text-red-600">{fieldErrors.subject}</p>
                    )}
                  </div>
                </div>

                {/* Message */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="contact-message" className="text-xs font-bold text-[#17202A]">
                      Message <span className="text-[#D65336]">*</span>
                    </label>
                    <span className="text-[11px] text-[#8A817A]">{message.length}/4000</span>
                  </div>
                  <textarea
                    id="contact-message"
                    required
                    rows={5}
                    maxLength={4000}
                    value={message}
                    onChange={(e) => {
                      setMessage(e.target.value);
                      clearFieldError('message');
                    }}
                    placeholder="Tell us about your restaurant, table capacity, or the questions you'd like answered..."
                    className={`w-full px-3.5 py-2.5 rounded-xl border bg-[#FCFAF7] text-xs text-[#17202A] placeholder-[#8A817A] focus:outline-none focus:bg-white transition-all resize-y min-h-[110px] ${
                      fieldErrors.message
                        ? 'border-red-400 focus:border-red-500'
                        : 'border-[#E8DED6] focus:border-[#D65336]'
                    }`}
                  />
                  {fieldErrors.message && (
                    <p className="text-[11px] font-medium text-red-600">{fieldErrors.message}</p>
                  )}
                </div>

                {/* Submit button */}
                <div className="pt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <button
                    type="submit"
                    disabled={status === 'submitting'}
                    className="w-full sm:w-auto px-8 py-3.5 bg-[#D65336] hover:bg-[#B9432D] text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center justify-center space-x-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {status === 'submitting' ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Sending Message...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Send Message</span>
                      </>
                    )}
                  </button>
                  <p className="text-[11px] text-[#8A817A]">
                    Enquiries go directly to{' '}
                    <span className="font-semibold text-[#17202A]">{OFFICIAL_SUPPORT_EMAIL}</span>
                  </p>
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
