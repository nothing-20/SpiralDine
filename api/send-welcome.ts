import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sendMailWithLogging } from './_lib/resendHelper';
import { getWelcomeTemplate } from '../src/services/email/emailTemplates';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { email, fullName, restaurantName, tenantId } = req.body;

  if (!email || !fullName) {
    return res.status(400).json({ error: 'Missing required arguments: email and fullName.' });
  }

  try {
    const templateHtml = getWelcomeTemplate({ fullName, restaurantName });
    const emailRes = await sendMailWithLogging({
      to: email.trim(),
      subject: 'Welcome to Spiral Dine!',
      html: templateHtml,
      tenantId: tenantId,
      type: 'welcome_email',
    });

    if (!emailRes.success) {
      return res.status(500).json({ error: emailRes.error || 'Failed to send welcome email.' });
    }

    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error('[Vercel API] send-welcome error:', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}
