export interface ICurrencyConfig {
  code: string;
  symbol: string;
  name: string;
  locale: string;
}

export interface ICountryConfig {
  code: string;
  name: string;
  defaultCurrency: string;
  defaultLocale: string;
}

export const SUPPORTED_CURRENCIES: Record<string, ICurrencyConfig> = {
  INR: { code: 'INR', symbol: '₹', name: 'Indian Rupee (INR)', locale: 'en-IN' },
  USD: { code: 'USD', symbol: '$', name: 'US Dollar (USD)', locale: 'en-US' },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro (EUR)', locale: 'en-IE' },
  GBP: { code: 'GBP', symbol: '£', name: 'British Pound (GBP)', locale: 'en-GB' },
  AED: { code: 'AED', symbol: 'AED', name: 'UAE Dirham (AED)', locale: 'en-AE' },
  SAR: { code: 'SAR', symbol: 'SAR', name: 'Saudi Riyal (SAR)', locale: 'en-SA' },
  AUD: { code: 'AUD', symbol: 'A$', name: 'Australian Dollar (AUD)', locale: 'en-AU' },
  CAD: { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar (CAD)', locale: 'en-CA' },
  SGD: { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar (SGD)', locale: 'en-SG' },
  JPY: { code: 'JPY', symbol: '¥', name: 'Japanese Yen (JPY)', locale: 'ja-JP' },
  MYR: { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit (MYR)', locale: 'ms-MY' },
  THB: { code: 'THB', symbol: '฿', name: 'Thai Baht (THB)', locale: 'th-TH' }
};

export const SUPPORTED_COUNTRIES: Record<string, ICountryConfig> = {
  IN: { code: 'IN', name: 'India', defaultCurrency: 'INR', defaultLocale: 'en-IN' },
  US: { code: 'US', name: 'United States', defaultCurrency: 'USD', defaultLocale: 'en-US' },
  GB: { code: 'GB', name: 'United Kingdom', defaultCurrency: 'GBP', defaultLocale: 'en-GB' },
  AE: { code: 'AE', name: 'United Arab Emirates', defaultCurrency: 'AED', defaultLocale: 'en-AE' },
  SA: { code: 'SA', name: 'Saudi Arabia', defaultCurrency: 'SAR', defaultLocale: 'en-SA' },
  AU: { code: 'AU', name: 'Australia', defaultCurrency: 'AUD', defaultLocale: 'en-AU' },
  CA: { code: 'CA', name: 'Canada', defaultCurrency: 'CAD', defaultLocale: 'en-CA' },
  SG: { code: 'SG', name: 'Singapore', defaultCurrency: 'SGD', defaultLocale: 'en-SG' },
  DE: { code: 'DE', name: 'Germany (Eurozone)', defaultCurrency: 'EUR', defaultLocale: 'de-DE' },
  FR: { code: 'FR', name: 'France (Eurozone)', defaultCurrency: 'EUR', defaultLocale: 'fr-FR' },
  MY: { code: 'MY', name: 'Malaysia', defaultCurrency: 'MYR', defaultLocale: 'ms-MY' },
  TH: { code: 'TH', name: 'Thailand', defaultCurrency: 'THB', defaultLocale: 'th-TH' }
};

/**
 * Automatically detects the client's country and corresponding currency/locale
 * using browser Intl and timezone APIs.
 */
export function detectDefaultCountryAndCurrency(): { country: string; currency: string; locale: string; symbol: string } {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    const lang = (navigator.language || '').toLowerCase();

    // India detection
    if (
      tz.includes('Kolkata') ||
      tz.includes('Calcutta') ||
      tz.includes('India') ||
      lang === 'en-in' ||
      lang.startsWith('hi') ||
      lang.startsWith('te') ||
      lang.startsWith('ta') ||
      lang.startsWith('mr') ||
      lang.startsWith('bn')
    ) {
      return { country: 'IN', currency: 'INR', locale: 'en-IN', symbol: '₹' };
    }

    // UAE / GCC detection
    if (tz.includes('Dubai') || tz.includes('Abu_Dhabi') || lang === 'ar-ae') {
      return { country: 'AE', currency: 'AED', locale: 'en-AE', symbol: 'AED' };
    }
    if (tz.includes('Riyadh') || lang === 'ar-sa') {
      return { country: 'SA', currency: 'SAR', locale: 'en-SA', symbol: 'SAR' };
    }

    // UK
    if (tz.includes('London') || lang === 'en-gb') {
      return { country: 'GB', currency: 'GBP', locale: 'en-GB', symbol: '£' };
    }

    // Eurozone
    if (tz.startsWith('Europe/')) {
      return { country: 'DE', currency: 'EUR', locale: 'en-IE', symbol: '€' };
    }

    // Australia & Canada
    if (tz.startsWith('Australia/') || lang === 'en-au') {
      return { country: 'AU', currency: 'AUD', locale: 'en-AU', symbol: 'A$' };
    }
    if (tz.startsWith('Canada/') || lang === 'en-ca') {
      return { country: 'CA', currency: 'CAD', locale: 'en-CA', symbol: 'C$' };
    }

    // Singapore
    if (tz.includes('Singapore') || lang === 'en-sg') {
      return { country: 'SG', currency: 'SGD', locale: 'en-SG', symbol: 'S$' };
    }
  } catch (e) {
    console.warn('[Format] TimeZone/locale detection error:', e);
  }

  // Fallback default
  return { country: 'IN', currency: 'INR', locale: 'en-IN', symbol: '₹' };
}

// Global active currency & locale defaults (initially set to client detected default)
const initialDefaults = detectDefaultCountryAndCurrency();
let currentCurrency = initialDefaults.currency;
let currentLocale = initialDefaults.locale;

/**
 * Updates the global currency configuration used by vanilla JS formatters.
 */
export function setGlobalCurrencyConfig(currency: string, locale?: string) {
  currentCurrency = currency || 'INR';
  currentLocale = locale || SUPPORTED_CURRENCIES[currency]?.locale || 'en-IN';
}

/**
 * Returns the currency symbol for a given currency code.
 */
export function getCurrencySymbol(currencyCode?: string): string {
  const code = currencyCode || currentCurrency;
  return SUPPORTED_CURRENCIES[code]?.symbol || code;
}

/**
 * Formats a currency value (in main unit, e.g. rupees or dollars)
 * using dynamic currency and locale settings.
 */
export function formatCurrency(value: number, currencyCode?: string, locale?: string): string {
  const code = currencyCode || currentCurrency;
  const loc = locale || SUPPORTED_CURRENCIES[code]?.locale || currentLocale;

  try {
    return new Intl.NumberFormat(loc, {
      style: 'currency',
      currency: code
    }).format(value);
  } catch (e) {
    const symbol = getCurrencySymbol(code);
    return `${symbol}${value.toFixed(2)}`;
  }
}

/**
 * Formats a price in cents to a human-readable currency string.
 * @param priceInCents The price amount in cents/paisa (e.g. 1250 for ₹12.50)
 * @param currencyCode Optional override for the currency code (e.g. 'INR', 'USD')
 * @param locale Optional override for the formatting locale
 */
export function formatPrice(priceInCents: number, currencyCode?: string, locale?: string): string {
  return formatCurrency(priceInCents / 100, currencyCode, locale);
}

/**
 * Formats an ISO string to a human-readable date and time.
 */
export function formatTimestamp(isoString: string): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Calculates the number of minutes elapsed since the given ISO timestamp.
 */
export function getElapsedMinutes(isoString: string): number {
  if (!isoString) return 0;
  const start = new Date(isoString).getTime();
  const now = Date.now();
  const diffMs = now - start;
  return Math.floor(diffMs / 60000);
}

/**
 * Checks if a given timestamp falls on "today" according to the restaurant's timezone (defaults to Asia/Kolkata).
 */
export function isTodayInTimezone(isoString?: string, timeZone: string = 'Asia/Kolkata'): boolean {
  if (!isoString) return false;
  try {
    const orderDate = new Date(isoString);
    if (isNaN(orderDate.getTime())) return false;
    const orderDateStr = orderDate.toLocaleDateString('en-CA', { timeZone });
    const todayDateStr = new Date().toLocaleDateString('en-CA', { timeZone });
    return orderDateStr === todayDateStr;
  } catch {
    return false;
  }
}

/**
 * Checks if a given timestamp falls on "yesterday" according to the restaurant's timezone (defaults to Asia/Kolkata).
 */
export function isYesterdayInTimezone(isoString?: string, timeZone: string = 'Asia/Kolkata'): boolean {
  if (!isoString) return false;
  try {
    const orderDate = new Date(isoString);
    if (isNaN(orderDate.getTime())) return false;
    const orderDateStr = orderDate.toLocaleDateString('en-CA', { timeZone });
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayDateStr = yesterday.toLocaleDateString('en-CA', { timeZone });
    return orderDateStr === yesterdayDateStr;
  } catch {
    return false;
  }
}

/**
 * Checks if a given timestamp falls within the last N days according to the restaurant's timezone (defaults to Asia/Kolkata).
 */
export function isWithinDaysInTimezone(isoString?: string, days: number = 7, timeZone: string = 'Asia/Kolkata'): boolean {
  if (!isoString) return false;
  try {
    const orderDate = new Date(isoString);
    if (isNaN(orderDate.getTime())) return false;
    const now = new Date();
    const past = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    return orderDate.getTime() >= past.getTime();
  } catch {
    return false;
  }
}
