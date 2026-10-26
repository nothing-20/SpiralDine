import { auth } from '../../config/firebase';

export const emailService = {
  async sendStaffInvitation(data: {
    fullName: string;
    email: string;
    phone: string;
    role: string;
    department: string;
    tenantId: string;
    createdBy: string;
    activationLink?: string;
    token?: string;
    employeeId?: string;
  }): Promise<{ success: boolean; employeeId?: string; error?: string }> {
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/send-staff-invitation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        let errMessage = 'Failed to dispatch staff invitation email.';
        try {
          const errData = await res.json();
          if (errData && errData.error) errMessage = errData.error;
        } catch (_) {
          const text = await res.text();
          if (text && text.length < 200 && !text.includes('<!DOCTYPE')) {
            errMessage = text;
          }
        }
        console.warn('[emailService] send-staff-invitation response error:', errMessage);
        return { success: false, error: errMessage };
      }
      return await res.json();
    } catch (err: any) {
      console.warn('[emailService] send-staff-invitation request error:', err.message);
      return { success: false, error: err.message || 'Email dispatch network error.' };
    }
  },

  async sendWelcomeEmail(data: {
    email: string;
    fullName: string;
    restaurantName?: string;
  }): Promise<{ success: boolean; error?: string }> {
    const res = await fetch('/api/send-welcome', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(errorText || 'Failed to send welcome email.');
    }
    return res.json();
  },

  async sendOrderConfirmation(data: {
    email: string;
    customerName: string;
    orderNumber: string;
    restaurantName: string;
    total: string;
  }): Promise<{ success: boolean; error?: string }> {
    const res = await fetch('/api/send-order-confirmation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(errorText || 'Failed to send order confirmation email.');
    }
    return res.json();
  },

  async sendReservationConfirmation(data: {
    email: string;
    customerName: string;
    restaurantName: string;
    date: string;
    time: string;
    partySize: number;
    tableNumber?: string | number;
  }): Promise<{ success: boolean; error?: string }> {
    const res = await fetch('/api/send-reservation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(errorText || 'Failed to send reservation confirmation email.');
    }
    return res.json();
  },

  async sendInvoiceEmail(data: {
    email: string;
    customerName: string;
    invoiceId: string;
    items: Array<{ name: string; quantity: number; price: string }>;
    subtotal: string;
    tax: string;
    total: string;
  }): Promise<{ success: boolean; error?: string }> {
    const res = await fetch('/api/send-invoice', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(errorText || 'Failed to send invoice email.');
    }
    return res.json();
  },
};
