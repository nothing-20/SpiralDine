import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { resendService } from './services/email/resendService';
import { getInviteStaffTemplate } from './services/email/templates/InviteStaff';
import { getWelcomeTemplate } from './services/email/templates/Welcome';
import { getOrderConfirmationTemplate } from './services/email/templates/OrderConfirmation';
import { getReservationTemplate } from './services/email/templates/Reservation';
import { getInvoiceTemplate } from './services/email/templates/Invoice';
import { getPasswordResetTemplate } from './services/email/templates/PasswordReset';
import { getApprovalTemplate } from './services/email/templates/Approval';
import * as crypto from 'crypto';

if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();

// 1. sendStaffInvitation
export const sendStaffInvitation = functions.https.onCall(async (data, context) => {
  // Guard check: user must be authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const { fullName, email, phone, role, department, tenantId, createdBy } = data;

  if (!fullName || !email || !role || !tenantId) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required invitation arguments.');
  }

  try {
    const trimmedEmail = email.trim().toLowerCase();

    // Check duplicate pending invite in Firestore employees collection
    const checkQ = await db.collection('employees')
      .where('email', '==', trimmedEmail)
      .where('tenantId', '==', tenantId)
      .limit(1)
      .get();

    if (!checkQ.empty) {
      throw new functions.https.HttpsError('already-exists', `An invitation or employee with email ${trimmedEmail} already exists.`);
    }

    const secureToken = crypto.randomBytes(32).toString('hex');
    const now = new Date().toISOString();

    // Write invitation document to employees
    const employeeRef = await db.collection('employees').add({
      fullName: fullName.trim(),
      email: trimmedEmail,
      phone: (phone || '').trim(),
      role: role,
      department: (department || '').trim(),
      tenantId: tenantId,
      branchId: '',
      status: 'pending',
      activationStatus: 'invited',
      firebaseUid: null,
      invitedAt: now,
      createdBy: createdBy || context.auth.uid,
      updatedAt: now,
      invitationToken: secureToken
    });

    // Generate canonical activation link (using origin of the request or default production fallback)
    const requestOrigin = context.rawRequest?.headers?.origin || 'https://restaurant-os-dun.vercel.app';
    const activationLink = `${requestOrigin}/staff/activate?token=${encodeURIComponent(secureToken)}&email=${encodeURIComponent(trimmedEmail)}&id=${encodeURIComponent(employeeRef.id)}`;

    const templateHtml = getInviteStaffTemplate({
      fullName: fullName,
      role: role,
      department: department || (role === 'kitchen' ? 'Kitchen' : 'Service'),
      activationLink: activationLink
    });

    const emailRes = await resendService.sendEmail(
      trimmedEmail,
      'Invitation to Join RestaurantOS Team',
      templateHtml,
      'staff_invitation'
    );

    if (!emailRes.success) {
      throw new Error(emailRes.error || 'Resend failed to deliver email.');
    }

    return { success: true, employeeId: employeeRef.id };
  } catch (err: any) {
    console.error('[sendStaffInvitation] Error:', err);
    throw new functions.https.HttpsError('internal', err.message || 'Failed to process staff invitation.');
  }
});

// 2. sendWelcomeEmail
export const sendWelcomeEmail = functions.https.onCall(async (data, context) => {
  const { email, fullName, restaurantName } = data;
  if (!email || !fullName) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing email or fullName.');
  }

  try {
    const templateHtml = getWelcomeTemplate({ fullName, restaurantName });
    const emailRes = await resendService.sendEmail(
      email.trim(),
      'Welcome to RestaurantOS!',
      templateHtml,
      'welcome_email'
    );

    return { success: emailRes.success, error: emailRes.error };
  } catch (err: any) {
    console.error('[sendWelcomeEmail] Error:', err);
    throw new functions.https.HttpsError('internal', err.message || 'Failed to send welcome email.');
  }
});

// 3. sendOrderConfirmation
export const sendOrderConfirmation = functions.https.onCall(async (data, context) => {
  const { email, customerName, orderNumber, restaurantName, total } = data;
  if (!email || !customerName || !orderNumber || !restaurantName || !total) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required order details.');
  }

  try {
    const templateHtml = getOrderConfirmationTemplate({
      customerName,
      orderNumber,
      restaurantName,
      date: new Date().toLocaleDateString(),
      total
    });

    const emailRes = await resendService.sendEmail(
      email.trim(),
      `Order Confirmation #${orderNumber}`,
      templateHtml,
      'order_confirmation'
    );

    return { success: emailRes.success, error: emailRes.error };
  } catch (err: any) {
    console.error('[sendOrderConfirmation] Error:', err);
    throw new functions.https.HttpsError('internal', err.message || 'Failed to send order confirmation.');
  }
});

// 4. sendReservationConfirmation
export const sendReservationConfirmation = functions.https.onCall(async (data, context) => {
  const { email, customerName, restaurantName, date, time, partySize, tableNumber } = data;
  if (!email || !customerName || !restaurantName || !date || !time || !partySize) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required reservation details.');
  }

  try {
    const templateHtml = getReservationTemplate({
      customerName,
      restaurantName,
      date,
      time,
      partySize,
      tableNumber
    });

    const emailRes = await resendService.sendEmail(
      email.trim(),
      'Your Table Reservation is Confirmed!',
      templateHtml,
      'reservation_confirmation'
    );

    return { success: emailRes.success, error: emailRes.error };
  } catch (err: any) {
    console.error('[sendReservationConfirmation] Error:', err);
    throw new functions.https.HttpsError('internal', err.message || 'Failed to send reservation confirmation.');
  }
});

// 5. sendInvoiceEmail
export const sendInvoiceEmail = functions.https.onCall(async (data, context) => {
  const { email, customerName, invoiceId, items, subtotal, tax, total } = data;
  if (!email || !customerName || !invoiceId || !items || !subtotal || !tax || !total) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing invoice details.');
  }

  try {
    const templateHtml = getInvoiceTemplate({
      customerName,
      invoiceId,
      date: new Date().toLocaleDateString(),
      items,
      subtotal,
      tax,
      total
    });

    const emailRes = await resendService.sendEmail(
      email.trim(),
      `Your Invoice Receipt #${invoiceId}`,
      templateHtml,
      'invoice_email'
    );

    return { success: emailRes.success, error: emailRes.error };
  } catch (err: any) {
    console.error('[sendInvoiceEmail] Error:', err);
    throw new functions.https.HttpsError('internal', err.message || 'Failed to send invoice email.');
  }
});

// 6. sendPasswordResetEmail
export const sendPasswordResetEmail = functions.https.onCall(async (data, context) => {
  const { email, fullName, resetLink } = data;
  if (!email || !fullName || !resetLink) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required arguments for reset.');
  }

  try {
    const templateHtml = getPasswordResetTemplate({ fullName, resetLink });
    const emailRes = await resendService.sendEmail(
      email.trim(),
      'Reset Your RestaurantOS Password',
      templateHtml,
      'password_reset'
    );

    return { success: emailRes.success, error: emailRes.error };
  } catch (err: any) {
    console.error('[sendPasswordResetEmail] Error:', err);
    throw new functions.https.HttpsError('internal', err.message || 'Failed to send reset password email.');
  }
});

// 7. createValidatedOrder
export const createValidatedOrder = functions.https.onCall(async (data, context) => {
  const { tenantId, tableNumber, items, customerId, sessionId, tableId, orderId } = data || {};
  if (!tenantId || !tableNumber || !items || !Array.isArray(items) || items.length === 0) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required order arguments.');
  }

  const effectiveCustomerId = customerId || context.auth?.uid || 'guest-uid';

  try {
    // 1. Restaurant check
    const restDoc = await db.collection('restaurants').doc(tenantId).get();
    if (!restDoc.exists) {
      const tDoc = await db.collection('tenants').doc(tenantId).get();
      if (!tDoc.exists) {
        throw new functions.https.HttpsError('not-found', `Restaurant ${tenantId} not found.`);
      }
    }

    // 2. Target Order ID & idempotency check
    const targetOrderId = (orderId || data.idempotencyKey || '').trim() ||
      `ORD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const existingOrder = await db.collection('restaurants').doc(tenantId).collection('orders').doc(targetOrderId).get();
    if (existingOrder.exists) {
      return { success: true, isDuplicate: true, orderId: targetOrderId, order: existingOrder.data() };
    }

    // 3. Retrieve canonical menu items and validate
    let authoritativeSubtotal = 0;
    const verifiedItems: any[] = [];

    for (const item of items) {
      const count = Number(item.count);
      if (!count || !Number.isInteger(count) || count <= 0) {
        throw new functions.https.HttpsError('invalid-argument', `Invalid quantity for item ${item.itemId}`);
      }

      const itemDoc = await db.collection('restaurants').doc(tenantId).collection('menu').doc('default').collection('items').doc(item.itemId).get();
      if (!itemDoc.exists) {
        throw new functions.https.HttpsError('not-found', `Menu item ${item.itemId} does not exist in restaurant menu.`);
      }

      const itemData = itemDoc.data() || {};
      if (itemData.isAvailable === false || itemData.available === false || itemData.availability === false) {
        throw new functions.https.HttpsError('failed-precondition', `Item "${itemData.name || item.itemId}" is currently sold out.`);
      }
      if (itemData.isPublished === false || itemData.published === false || itemData.status === 'unpublished') {
        throw new functions.https.HttpsError('failed-precondition', `Item "${itemData.name || item.itemId}" is unpublished.`);
      }

      const unitPrice = Number(itemData.discountPrice || itemData.price || 0);
      if (unitPrice <= 0) {
        throw new functions.https.HttpsError('failed-precondition', `Item "${itemData.name || item.itemId}" has invalid canonical price.`);
      }

      authoritativeSubtotal += unitPrice * count;
      verifiedItems.push({
        itemId: item.itemId,
        name: itemData.name || item.itemId,
        count,
        notes: (item.notes || '').slice(0, 200),
        pricePerUnit: unitPrice,
        image: itemData.image || itemData.imageUrl || '',
        isVeg: itemData.isVeg ?? itemData.veg ?? false
      });
    }

    const authoritativeTax = Math.round(authoritativeSubtotal * 0.05);
    const authoritativeServiceCharge = Math.round(authoritativeSubtotal * 0.05);
    const authoritativeTotal = authoritativeSubtotal + authoritativeTax + authoritativeServiceCharge;
    const nowIso = new Date().toISOString();

    const cleanTableNum = String(tableNumber).replace(/^TBL-/i, '').trim();
    const resolvedTableId = tableId || `TBL-${cleanTableNum}`;
    const cleanSessionId = sessionId || `SES-${nowIso.slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const orderPayload = {
      id: targetOrderId,
      orderId: targetOrderId,
      primaryOrderId: data.primaryOrderId || targetOrderId,
      sessionId: cleanSessionId,
      orderSequence: data.orderSequence || 1,
      isAdditionalOrder: Boolean(data.isAdditionalOrder),
      customerId: effectiveCustomerId,
      customerName: (data.customerName || 'Guest Diner').trim(),
      phone: (data.phone || '+91 98765 43210').trim(),
      tenantId,
      restaurantId: tenantId,
      branchId: data.branchId || 'main',
      tableId: resolvedTableId,
      tableNumber: cleanTableNum,
      tableName: data.tableName || `Table ${cleanTableNum}`,
      orderType: data.orderType || 'dine_in',
      orderSource: data.orderSource || 'qr',
      items: verifiedItems,
      subtotal: authoritativeSubtotal,
      tax: authoritativeTax,
      serviceCharge: authoritativeServiceCharge,
      discount: 0,
      total: authoritativeTotal,
      totalAmount: authoritativeTotal,
      status: 'NEW',
      paymentStatus: 'pending',
      specialInstructions: (data.specialInstructions || '').slice(0, 300),
      createdAt: nowIso,
      updatedAt: nowIso
    };

    await db.collection('restaurants').doc(tenantId).collection('orders').doc(targetOrderId).set(orderPayload);

    return {
      success: true,
      orderId: targetOrderId,
      order: orderPayload,
      primaryOrderId: orderPayload.primaryOrderId,
      sessionId: cleanSessionId
    };
  } catch (err: any) {
    console.error('[createValidatedOrder] Error:', err);
    if (err instanceof functions.https.HttpsError) throw err;
    throw new functions.https.HttpsError('internal', err.message || 'Failed to validate order.');
  }
});

// 8. onRestaurantApproval (Firestore Cloud Function Trigger)
export const onRestaurantApproval = functions.firestore
  .document('restaurants/{tenantId}')
  .onUpdate(async (change, context) => {
    const beforeData = change.before.data() || {};
    const afterData = change.after.data() || {};
    const tenantId = context.params.tenantId;

    // Trigger ONLY on valid transition to approved/active from non-approved state
    const wasApproved = beforeData.status === 'active' || beforeData.status === 'approved';
    const isNowApproved = afterData.status === 'active' || afterData.status === 'approved';

    if (wasApproved || !isNowApproved) {
      return null;
    }

    // Check duplicate prevention
    const notifRef = db.collection('approvalNotifications').doc(tenantId);
    const notifSnap = await notifRef.get();
    if (notifSnap.exists && notifSnap.data()?.status === 'sent') {
      console.log(`[onRestaurantApproval] Notification already sent for ${tenantId}. Skipping.`);
      return null;
    }

    let ownerEmail = (afterData.ownerEmail || '').trim().toLowerCase();
    let ownerName = afterData.ownerName || 'Restaurant Owner';
    const restaurantName = afterData.restaurantName || afterData.name || 'Your Restaurant';

    // Resolve owner email from users/{ownerUid} if missing
    if ((!ownerEmail || ownerName === 'Restaurant Owner') && afterData.ownerUid) {
      try {
        const uSnap = await db.collection('users').doc(afterData.ownerUid).get();
        if (uSnap.exists) {
          const uData = uSnap.data() || {};
          ownerEmail = ownerEmail || (uData.email || '').trim().toLowerCase();
          ownerName = ownerName === 'Restaurant Owner' ? (uData.fullName || uData.displayName || 'Restaurant Owner') : ownerName;
        }
      } catch (uErr) {
        console.warn(`[onRestaurantApproval] User lookup note for ${tenantId}:`, uErr);
      }
    }

    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!ownerEmail || !EMAIL_REGEX.test(ownerEmail)) {
      console.warn(`[onRestaurantApproval] Cannot resolve valid owner email for ${tenantId}.`);
      await notifRef.set({
        applicationId: tenantId,
        tenantId,
        eventType: 'restaurant_application_approved',
        status: 'failed',
        error: 'Missing valid owner email',
        updatedAt: new Date().toISOString()
      }, { merge: true });
      return null;
    }

    // Processing lock
    await notifRef.set({
      applicationId: tenantId,
      tenantId,
      eventType: 'restaurant_application_approved',
      status: 'processing',
      recipient: ownerEmail,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    const templateHtml = getApprovalTemplate({
      ownerName,
      restaurantName,
      applicationId: tenantId,
      loginUrl: 'https://spiral-dine.vercel.app/owner/login',
      supportEmail: process.env.SUPPORT_NOTIFICATION_EMAIL || 'kumbhageethakrishna143@gmail.com',
      reviewNotes: afterData.reviewNotes || undefined
    });

    const res = await resendService.sendEmail(
      ownerEmail,
      'Your Restaurant Has Been Approved on SpiralDine!',
      templateHtml,
      'restaurant_application_approved'
    );

    const nowIso = new Date().toISOString();
    if (res.success && res.id) {
      await notifRef.set({
        status: 'sent',
        emailId: res.id,
        sentAt: nowIso,
        error: null,
        updatedAt: nowIso
      }, { merge: true });

      await change.after.ref.set({
        approvalNotificationStatus: 'sent',
        approvalNotificationSentAt: nowIso,
        approvalNotificationEmailId: res.id,
        approvalNotificationRecipient: ownerEmail
      }, { merge: true });
    } else {
      await notifRef.set({
        status: 'failed',
        error: res.error || 'Resend error',
        updatedAt: nowIso
      }, { merge: true });

      await change.after.ref.set({
        approvalNotificationStatus: 'failed',
        approvalNotificationError: res.error || 'Resend error'
      }, { merge: true });
    }

    return null;
  });

