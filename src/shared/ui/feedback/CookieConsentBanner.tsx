import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Cookie, Settings, Check, X } from 'lucide-react';
import { getCookieConsent, setCookieConsent } from '../../utils/cookieConsent';

export const CookieConsentBanner: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [analyticsAllowed, setAnalyticsAllowed] = useState(false);
  const [preferencesAllowed, setPreferencesAllowed] = useState(false);

  useEffect(() => {
    const existing = getCookieConsent();
    if (!existing) {
      // Delay slightly for smooth page entrance
      const timer = setTimeout(() => setIsVisible(true), 1200);
      return () => clearTimeout(timer);
    } else {
      setAnalyticsAllowed(existing.analytics);
      setPreferencesAllowed(existing.preferences);
    }

    const handleOpenModal = () => {
      const current = getCookieConsent();
      if (current) {
        setAnalyticsAllowed(current.analytics);
        setPreferencesAllowed(current.preferences);
      }
      setIsCustomizing(true);
      setIsVisible(true);
    };

    window.addEventListener('spiraldine_open_consent_modal', handleOpenModal);
    return () => window.removeEventListener('spiraldine_open_consent_modal', handleOpenModal);
  }, []);

  const handleAcceptAll = () => {
    setCookieConsent({ analytics: true, preferences: true });
    setIsVisible(false);
    setIsCustomizing(false);
  };

  const handleRejectOptional = () => {
    setCookieConsent({ analytics: false, preferences: false });
    setIsVisible(false);
    setIsCustomizing(false);
  };

  const handleSavePreferences = () => {
    setCookieConsent({
      analytics: analyticsAllowed,
      preferences: preferencesAllowed
    });
    setIsVisible(false);
    setIsCustomizing(false);
  };

  if (!isVisible) return null;

  return (
    <aside
      role="dialog"
      aria-labelledby="cookie-banner-title"
      aria-describedby="cookie-banner-description"
      aria-modal="false"
      className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-xl z-50 animate-in fade-in slide-in-from-bottom-4 duration-300"
    >
      <div className="bg-[#17202A] text-white border border-[#2C3E50] rounded-2xl p-5 sm:p-6 shadow-2xl backdrop-blur-xl">
        <div className="flex items-start gap-3.5 mb-3">
          <div className="w-10 h-10 rounded-xl bg-[#D65336]/15 border border-[#D65336]/30 flex items-center justify-center shrink-0 text-[#D65336]">
            <Cookie className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h3 id="cookie-banner-title" className="text-sm font-bold text-white flex items-center gap-2">
              Privacy & Cookie Preferences
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                DPDP & GDPR
              </span>
            </h3>
            <p id="cookie-banner-description" className="text-xs text-gray-300 mt-1 leading-relaxed">
              We use strictly necessary cookies to keep you signed in, preserve dining carts, and secure table sessions. Non-essential analytics help us improve hospitality workflows only with your explicit consent.
            </p>
          </div>
        </div>

        {isCustomizing ? (
          <div className="space-y-3 py-3 border-t border-gray-800 text-xs">
            {/* Category 1: Essential */}
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-gray-900/60 border border-gray-800">
              <div>
                <span className="font-semibold text-white block">Strictly Necessary Cookies</span>
                <span className="text-gray-400 text-[11px]">Required for core security, table authentication, and payment verification. Always active.</span>
              </div>
              <span className="text-emerald-400 text-[11px] font-bold uppercase tracking-wider shrink-0 ml-2">Required</span>
            </div>

            {/* Category 2: Analytics */}
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-gray-900/60 border border-gray-800">
              <div className="pr-3">
                <span className="font-semibold text-white block">Operational Analytics</span>
                <span className="text-gray-400 text-[11px]">Aggregated metrics on menu load times and route transitions without profiling or ad tracking.</span>
              </div>
              <button
                type="button"
                onClick={() => setAnalyticsAllowed(!analyticsAllowed)}
                aria-pressed={analyticsAllowed}
                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors shrink-0 ${analyticsAllowed ? 'bg-[#D65336]' : 'bg-gray-700'}`}
              >
                <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${analyticsAllowed ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>

            {/* Category 3: Preferences */}
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-gray-900/60 border border-gray-800">
              <div className="pr-3">
                <span className="font-semibold text-white block">Personalization & Theme</span>
                <span className="text-gray-400 text-[11px]">Remembers your display theme (Dark/Light) and dietary filter presets across dining visits.</span>
              </div>
              <button
                type="button"
                onClick={() => setPreferencesAllowed(!preferencesAllowed)}
                aria-pressed={preferencesAllowed}
                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors shrink-0 ${preferencesAllowed ? 'bg-[#D65336]' : 'bg-gray-700'}`}
              >
                <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${preferencesAllowed ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
              <Link to="/cookie-policy" className="text-[11px] text-[#D65336] hover:underline">
                Read Cookie Policy &rarr;
              </Link>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsCustomizing(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleSavePreferences}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold bg-[#D65336] hover:bg-[#b8432b] text-white shadow transition-colors"
                >
                  Save Choices
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-3 border-t border-gray-800">
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <Link to="/cookie-policy" className="hover:text-white hover:underline text-[11px]">
                Cookie Policy
              </Link>
              <span>&bull;</span>
              <Link to="/privacy" className="hover:text-white hover:underline text-[11px]">
                Privacy
              </Link>
              <span>&bull;</span>
              <button
                type="button"
                onClick={() => setIsCustomizing(true)}
                className="hover:text-[#D65336] underline text-[11px] inline-flex items-center gap-1"
              >
                <Settings className="w-3 h-3" /> Customize
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRejectOptional}
                className="flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 transition-colors"
              >
                Reject Non-Essential
              </button>
              <button
                type="button"
                onClick={handleAcceptAll}
                className="flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-bold bg-[#D65336] hover:bg-[#b8432b] text-white shadow transition-colors"
              >
                Accept All
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

export default CookieConsentBanner;
