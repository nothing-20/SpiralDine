export const getBaseTemplate = (title: string, bodyContent: string): string => {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>
          body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background-color: #020617;
            color: #f8fafc;
            margin: 0;
            padding: 0;
            -webkit-font-smoothing: antialiased;
          }
          .wrapper {
            width: 100%;
            max-width: 600px;
            margin: 40px auto;
            background: #0f172a;
            border: 1px solid #1e293b;
            border-radius: 24px;
            overflow: hidden;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.4);
          }
          .header {
            background: linear-gradient(135deg, #f59e0b, #d97706);
            padding: 32px;
            text-align: center;
          }
          .header img {
            max-height: 48px;
            margin-bottom: 12px;
            border-radius: 8px;
          }
          .header h1 {
            color: #020617;
            font-size: 24px;
            font-weight: 800;
            margin: 0;
            letter-spacing: -0.025em;
          }
          .content {
            padding: 40px;
            line-height: 1.6;
          }
          .content p {
            margin: 0 0 20px;
            font-size: 15px;
            color: #cbd5e1;
          }
          .btn-container {
            margin: 32px 0;
            text-align: center;
          }
          .btn {
            display: inline-block;
            background: #f59e0b;
            color: #020617 !important;
            text-decoration: none;
            padding: 14px 32px;
            font-size: 14px;
            font-weight: 700;
            border-radius: 12px;
            transition: all 0.3s ease;
          }
          .footer {
            padding: 32px;
            border-top: 1px solid #1e293b;
            text-align: center;
            font-size: 12px;
            color: #64748b;
            background: #090d16;
          }
          .footer p {
            margin: 0 0 8px;
          }
          .footer a {
            color: #f59e0b;
            text-decoration: none;
          }
        </style>
      </head>
      <body>
        <div class="wrapper">
          <div class="header">
            <img src="https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=128&auto=format&fit=crop&q=60" alt="Spiral Dine Logo" />
            <h1>Spiral Dine</h1>
          </div>
          <div class="content">
            ${bodyContent}
          </div>
          <div class="footer">
            <p>Sent via <strong>Spiral Dine Enterprise</strong></p>
            <p>&copy; ${new Date().getFullYear()} Spiral Dine. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;
};

export interface InviteStaffData {
  fullName: string;
  restaurantName: string;
  role: string;
  department: string;
  activationLink: string;
}

export const getInviteStaffTemplate = (data: InviteStaffData): string => {
  const bodyContent = `
    <p>Hello ${data.fullName},</p>
    <p>You have been invited to join the restaurant team at <strong>${data.restaurantName}</strong> on <strong>Spiral Dine</strong> as a <strong>${data.role}</strong> in the <strong>${data.department}</strong> department.</p>
    <p>Click the button below to activate your staff account and set up your secure password.</p>
    <div class="btn-container">
      <a href="${data.activationLink}" class="btn">Activate Account</a>
    </div>
    <p style="font-size: 13px; color: #f59e0b; margin-top: 24px; font-weight: 600;">⚠️ Expiration Notice: This invitation link is secure and will expire in 7 days.</p>
    <p>If you did not expect this invitation, you can safely ignore this email.</p>
  `;
  return getBaseTemplate('Join the team', bodyContent);
};

export interface WelcomeData {
  fullName: string;
  restaurantName?: string;
}

export const getWelcomeTemplate = (data: WelcomeData): string => {
  const bodyContent = `
    <p>Welcome to <strong>Spiral Dine</strong>, ${data.fullName}!</p>
    <p>We are thrilled to have you onboard. Your account has been successfully created.</p>
    ${data.restaurantName ? `<p>Your restaurant workspace <strong>${data.restaurantName}</strong> is ready for setup.</p>` : ''}
    <p>Log in to your dashboard to begin managing your menu, tables, staff, and live operations.</p>
  `;
  return getBaseTemplate('Welcome to Spiral Dine', bodyContent);
};

export interface ReservationData {
  customerName: string;
  restaurantName: string;
  date: string;
  time: string;
  partySize: number;
  tableNumber?: string | number;
}

export const getReservationTemplate = (data: ReservationData): string => {
  const bodyContent = `
    <p>Hello ${data.customerName},</p>
    <p>Your table reservation at <strong>${data.restaurantName}</strong> has been successfully confirmed!</p>
    <div style="background: #090d16; padding: 24px; border-radius: 16px; border: 1px solid #1e293b; margin: 24px 0;">
      <p style="margin: 0 0 10px; font-size: 14px;">📅 <strong>Date:</strong> ${data.date}</p>
      <p style="margin: 0 0 10px; font-size: 14px;">⏰ <strong>Time:</strong> ${data.time}</p>
      <p style="margin: 0 0 10px; font-size: 14px;">👥 <strong>Party Size:</strong> ${data.partySize} guests</p>
      ${data.tableNumber ? `<p style="margin: 0; font-size: 14px;">🪑 <strong>Table:</strong> Table ${data.tableNumber}</p>` : ''}
    </div>
    <p>We look forward to serving you!</p>
  `;
  return getBaseTemplate('Reservation Confirmed', bodyContent);
};

export interface InvoiceData {
  customerName: string;
  invoiceId: string;
  date: string;
  items: Array<{ name: string; quantity: number; price: string }>;
  subtotal: string;
  tax: string;
  total: string;
}

export const getInvoiceTemplate = (data: InvoiceData): string => {
  let itemsHtml = '';
  data.items.forEach(item => {
    itemsHtml += `
      <tr>
        <td style="padding: 8px 0; font-size: 14px; color: #cbd5e1;">${item.name} x${item.quantity}</td>
        <td style="padding: 8px 0; font-size: 14px; text-align: right; color: #cbd5e1;">${item.price}</td>
      </tr>
    `;
  });

  const bodyContent = `
    <p>Hello ${data.customerName},</p>
    <p>Thank you for dining with us! Here is your bill invoice for receipt <strong>#${data.invoiceId}</strong>.</p>
    
    <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
      <thead>
        <tr style="border-bottom: 1px solid #1e293b;">
          <th style="text-align: left; padding-bottom: 10px; font-size: 12px; color: #64748b; text-transform: uppercase;">Item</th>
          <th style="text-align: right; padding-bottom: 10px; font-size: 12px; color: #64748b; text-transform: uppercase;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
        <tr style="border-top: 1px solid #1e293b;">
          <td style="padding: 12px 0 6px; font-size: 14px; color: #64748b;">Subtotal</td>
          <td style="padding: 12px 0 6px; font-size: 14px; text-align: right; color: #cbd5e1;">${data.subtotal}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-size: 14px; color: #64748b;">Tax</td>
          <td style="padding: 6px 0; font-size: 14px; text-align: right; color: #cbd5e1;">${data.tax}</td>
        </tr>
        <tr style="font-weight: 700; font-size: 16px;">
          <td style="padding: 10px 0; color: #f8fafc;">Total Paid</td>
          <td style="padding: 10px 0; text-align: right; color: #f59e0b;">${data.total}</td>
        </tr>
      </tbody>
    </table>
    
    <p>Sent on ${data.date}</p>
  `;
  return getBaseTemplate('Your Bill Invoice', bodyContent);
};

export interface OrderConfirmationData {
  customerName: string;
  orderNumber: string;
  restaurantName: string;
  date: string;
  total: string;
}

export const getOrderConfirmationTemplate = (data: OrderConfirmationData): string => {
  const bodyContent = `
    <p>Hello ${data.customerName},</p>
    <p>Your order at <strong>${data.restaurantName}</strong> has been successfully placed!</p>
    <div style="background: #090d16; padding: 24px; border-radius: 16px; border: 1px solid #1e293b; margin: 24px 0;">
      <p style="margin: 0 0 10px; font-size: 14px;">🏷️ <strong>Order ID:</strong> #${data.orderNumber}</p>
      <p style="margin: 0 0 10px; font-size: 14px;">📅 <strong>Date:</strong> ${data.date}</p>
      <p style="margin: 0; font-size: 14px;">💰 <strong>Total Amount:</strong> ${data.total}</p>
    </div>
    <p>We are preparing your items now and will notify you when they are ready.</p>
  `;
  return getBaseTemplate('Order Placed Successfully', bodyContent);
};
