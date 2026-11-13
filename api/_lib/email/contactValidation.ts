import {
  CONTACT_ENQUIRY_CATEGORIES,
  type ContactEnquiryCategory,
} from '../../../src/shared/constants/contact.js';

export interface RawContactSubmission {
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  restaurantName?: unknown;
  category?: unknown;
  subject?: unknown;
  message?: unknown;
  website?: unknown;
}

export interface ValidatedContactSubmission {
  name: string;
  email: string;
  phone: string;
  restaurantName: string;
  category: ContactEnquiryCategory;
  subject: string;
  message: string;
}

export type ContactValidationResult =
  | { ok: true; data: ValidatedContactSubmission }
  | {
      ok: false;
      code: 'VALIDATION_ERROR' | 'SPAM_DETECTED';
      error: string;
      fieldErrors: Record<string, string>;
    };

const CRLF_OR_NULL_RE = /[\r\n\0]/;
const HEADER_INJECTION_RE = /(?:^|[\r\n])\s*(?:bcc|cc|to|from|reply-to|content-type|mime-version)\s*:/i;
const STRICT_EMAIL_RE =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
const PHONE_CHARS_RE = /^[+\d\s\-().]+$/;
const URL_PATTERN_RE = /(?:https?:\/\/|www\.)[^\s]+/gi;

function asTrimmedString(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function hasHeaderInjection(rawValue: unknown): boolean {
  if (typeof rawValue !== 'string') return false;
  return CRLF_OR_NULL_RE.test(rawValue) || HEADER_INJECTION_RE.test(rawValue);
}

/**
 * Validate and sanitize public contact form input strictly on the server.
 * Ignores any caller-supplied recipient/from fields so visitors cannot control routing.
 */
export function validateContactSubmission(rawBody: unknown): ContactValidationResult {
  const body = (rawBody && typeof rawBody === 'object' ? rawBody : {}) as RawContactSubmission;
  const fieldErrors: Record<string, string> = {};

  // 1. Spam honeypot trap
  const honeypot = asTrimmedString(body.website);
  if (honeypot.length > 0) {
    return {
      ok: false,
      code: 'SPAM_DETECTED',
      error: 'Automated submission rejected.',
      fieldErrors: {},
    };
  }

  // 2. Reject explicit header injection attempts on single-line header-adjacent fields
  const singleLineFields: Array<[keyof RawContactSubmission, string]> = [
    ['name', 'Full Name'],
    ['email', 'Email Address'],
    ['phone', 'Phone Number'],
    ['restaurantName', 'Restaurant / Business Name'],
    ['category', 'Enquiry Category'],
    ['subject', 'Subject'],
  ];

  for (const [key, label] of singleLineFields) {
    if (hasHeaderInjection(body[key])) {
      fieldErrors[key] = `${label} contains invalid line-break or control characters.`;
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      code: 'VALIDATION_ERROR',
      error: 'Invalid characters detected in submission fields.',
      fieldErrors,
    };
  }

  // 3. Name
  const name = asTrimmedString(body.name).replace(/\s+/g, ' ');
  if (!name) {
    fieldErrors.name = 'Full name is required.';
  } else if (name.length < 2 || name.length > 100) {
    fieldErrors.name = 'Full name must be between 2 and 100 characters.';
  }

  // 4. Email
  const email = asTrimmedString(body.email).toLowerCase();
  if (!email) {
    fieldErrors.email = 'Email address is required.';
  } else if (
    email.length > 254 ||
    email.includes('..') ||
    !STRICT_EMAIL_RE.test(email)
  ) {
    fieldErrors.email = 'Please provide a valid email address.';
  }

  // 5. Phone (optional)
  const phone = asTrimmedString(body.phone).replace(/\s+/g, ' ');
  if (phone) {
    const digitsOnly = phone.replace(/\D/g, '');
    if (
      phone.length > 24 ||
      !PHONE_CHARS_RE.test(phone) ||
      digitsOnly.length < 7 ||
      digitsOnly.length > 15
    ) {
      fieldErrors.phone = 'Please enter a valid phone number (7–15 digits) or leave it blank.';
    }
  }

  // 6. Restaurant / business name (optional)
  const restaurantName = asTrimmedString(body.restaurantName).replace(/\s+/g, ' ');
  if (restaurantName.length > 120) {
    fieldErrors.restaurantName = 'Restaurant or business name must be 120 characters or fewer.';
  }

  // 7. Enquiry category (required, validated against allowlist)
  const rawCategory = asTrimmedString(body.category);
  const matchedCategory = CONTACT_ENQUIRY_CATEGORIES.find(
    (item) => item.toLowerCase() === rawCategory.toLowerCase()
  );
  if (!rawCategory) {
    fieldErrors.category = 'Please select an enquiry category.';
  } else if (!matchedCategory) {
    fieldErrors.category = 'Please choose a valid enquiry category.';
  }

  // 8. Subject (required)
  const subject = asTrimmedString(body.subject).replace(/\s+/g, ' ');
  if (!subject) {
    fieldErrors.subject = 'Subject is required.';
  } else if (subject.length < 3 || subject.length > 150) {
    fieldErrors.subject = 'Subject must be between 3 and 150 characters.';
  }

  // 9. Message (required)
  const rawMessage = typeof body.message === 'string' ? body.message : '';
  if (rawMessage.includes('\0') || HEADER_INJECTION_RE.test(rawMessage)) {
    fieldErrors.message = 'Message contains disallowed control sequences.';
  }
  const message = rawMessage.replace(/\r\n/g, '\n').trim();
  if (!fieldErrors.message) {
    if (!message) {
      fieldErrors.message = 'Message cannot be empty.';
    } else if (message.length < 5) {
      fieldErrors.message = 'Please enter at least 5 characters in your message.';
    } else if (message.length > 4000) {
      fieldErrors.message = 'Message must be 4000 characters or fewer.';
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    const firstError = Object.values(fieldErrors)[0];
    return {
      ok: false,
      code: 'VALIDATION_ERROR',
      error: firstError,
      fieldErrors,
    };
  }

  // 10. Link-flood spam heuristic
  const urlsFound = message.match(URL_PATTERN_RE) || [];
  if (urlsFound.length >= 4) {
    return {
      ok: false,
      code: 'SPAM_DETECTED',
      error: 'Too many links detected in message. Please describe your enquiry with fewer URLs.',
      fieldErrors: {
        message: 'Please remove excessive URLs from your message.',
      },
    };
  }

  return {
    ok: true,
    data: {
      name,
      email,
      phone,
      restaurantName,
      category: matchedCategory as ContactEnquiryCategory,
      subject,
      message,
    },
  };
}

