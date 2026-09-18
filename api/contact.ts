import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { name, email, phone, restaurantName, subject, message } = req.body || {};

    if (!name || !email || !message) {
      return res.status(400).json({ 
        error: 'Missing required fields. Name, email, and message are mandatory.' 
      });
    }

    const timestamp = new Date().toISOString();
    const submissionData = {
      name: String(name).trim(),
      email: String(email).trim().toLowerCase(),
      phone: phone ? String(phone).trim() : '',
      restaurantName: restaurantName ? String(restaurantName).trim() : '',
      subject: subject ? String(subject).trim() : 'General Inquiry',
      message: String(message).trim(),
      timestamp,
      status: 'pending',
    };

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      // Per instructions: Do not pretend message was sent if backend email service is unconfigured
      return res.status(503).json({
        success: false,
        error: 'Contact email dispatch is currently unavailable on the server.',
        fallbackEmail: 'support@restaurantos.com',
      });
    }

    const resend = new Resend(apiKey);
    const emailHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e8ded6; border-radius: 12px;">
        <h2 style="color: #d65336;">New SpiralDine Contact Inquiry</h2>
        <p><strong>Name:</strong> ${submissionData.name}</p>
        <p><strong>Email:</strong> ${submissionData.email}</p>
        <p><strong>Phone:</strong> ${submissionData.phone || 'N/A'}</p>
        <p><strong>Restaurant Name:</strong> ${submissionData.restaurantName || 'N/A'}</p>
        <p><strong>Subject:</strong> ${submissionData.subject}</p>
        <hr style="border: none; border-top: 1px solid #e8ded6; margin: 20px 0;" />
        <p><strong>Message:</strong></p>
        <p style="white-space: pre-wrap; background: #fcfaf7; padding: 15px; border-radius: 8px;">${submissionData.message}</p>
        <p style="font-size: 11px; color: #8a817a;">Received at: ${timestamp}</p>
      </div>
    `;

    const response = await resend.emails.send({
      from: 'Spiral Dine <onboarding@resend.dev>',
      to: ['support@restaurantos.com'],
      subject: `[SpiralDine Contact] ${submissionData.subject} - ${submissionData.restaurantName || submissionData.name}`,
      html: emailHtml,
    });

    if (response.error) {
      return res.status(502).json({
        success: false,
        error: response.error.message || 'Failed to deliver message.',
        fallbackEmail: 'support@restaurantos.com',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Inquiry received successfully. Our team will contact you shortly.',
      id: response.data?.id,
    });
  } catch (err: any) {
    console.error('[Vercel API /contact] Error processing request:', err);
    return res.status(500).json({
      success: false,
      error: 'An internal server error occurred while processing your request.',
      fallbackEmail: 'support@restaurantos.com',
    });
  }
}
