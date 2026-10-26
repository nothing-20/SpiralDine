export interface ICookieConsent {
  essential: boolean;
  analytics: boolean;
  preferences: boolean;
  timestamp: string;
  version: string;
}

const COOKIE_CONSENT_KEY = 'spiraldine_cookie_consent';
const CURRENT_VERSION = '1.0.0';

export const getCookieConsent = (): ICookieConsent | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed;
  } catch {
    return null;
  }
};

export const setCookieConsent = (consent: { analytics: boolean; preferences: boolean }): ICookieConsent => {
  const fullConsent: ICookieConsent = {
    essential: true,
    analytics: consent.analytics,
    preferences: consent.preferences,
    timestamp: new Date().toISOString(),
    version: CURRENT_VERSION,
  };

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(fullConsent));
      window.dispatchEvent(new CustomEvent('spiraldine_consent_updated', { detail: fullConsent }));
    } catch (e) {
      console.warn('Failed to persist cookie consent to localStorage', e);
    }
  }

  return fullConsent;
};

export const openCookieConsentModal = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('spiraldine_open_consent_modal'));
  }
};
