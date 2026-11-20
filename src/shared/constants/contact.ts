/**
 * Canonical SpiralDine & Spiral World contact constants shared across UI and API.
 */

export const OFFICIAL_SUPPORT_EMAIL = 'support@spiralworld.in';
export const OFFICIAL_BRAND_NAME = 'SpiralDine';
export const OFFICIAL_COMPANY_NAME = 'Spiral World';
export const PRODUCTION_DOMAIN = 'https://dine.spiralworld.in';

export const CONTACT_ENQUIRY_CATEGORIES = [
  'Restaurant Onboarding',
  'Product Questions & Demo',
  'Partnership Enquiries',
  'Technical Support',
  'Business & Enterprise Inquiries',
  'Billing & Subscription',
  'General Enquiry',
] as const;

export type ContactEnquiryCategory = (typeof CONTACT_ENQUIRY_CATEGORIES)[number];

