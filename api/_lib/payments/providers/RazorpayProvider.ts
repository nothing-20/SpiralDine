import crypto from 'crypto';
import type {
  IPaymentProvider,
  IPaymentOrderParams,
  IPaymentOrderResult,
  IPaymentVerificationResult,
  PaymentProviderName,
  NormalizedPaymentMethod,
  PaymentStatus
} from '../../../../src/shared/domain/payments/types';

export interface IRazorpayConfig {
  keyId?: string;
  keySecret?: string;
  webhookSecret?: string;
  environment?: 'test' | 'live' | 'sandbox' | 'production';
}

export class RazorpayPaymentProvider implements IPaymentProvider {
  readonly name: PaymentProviderName = 'razorpay';
  private readonly keyId: string;
  private readonly keySecret: string;
  private readonly webhookSecret: string;
  private readonly baseUrl: string = 'https://api.razorpay.com/v1';

  constructor(config?: IRazorpayConfig) {
    this.keyId = config?.keyId || process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || '';
    this.keySecret = config?.keySecret || process.env.RAZORPAY_KEY_SECRET || '';
    this.webhookSecret = config?.webhookSecret || process.env.RAZORPAY_WEBHOOK_SECRET || '';
  }

  private getAuthHeader(): string {
    if (!this.keyId || !this.keySecret) {
      throw new Error('[RazorpayProvider] Missing RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET in server environment.');
    }
    const token = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
    return `Basic ${token}`;
  }

  /**
   * Create an authoritative payment order on Razorpay Orders API
   */
  async createPaymentOrder(params: IPaymentOrderParams): Promise<IPaymentOrderResult> {
    const url = `${this.baseUrl}/orders`;

    // Razorpay amount expects integer in subunits (paise for INR, cents for USD)
    const amountInPaise = Math.round(params.amountInCents);
    if (isNaN(amountInPaise) || amountInPaise <= 0) {
      throw new Error(`[RazorpayProvider] Invalid payment amount: ${params.amountInCents} paise.`);
    }

    const cleanReceipt = params.billId.slice(0, 40);

    const requestBody = {
      amount: amountInPaise,
      currency: params.currency || 'INR',
      receipt: cleanReceipt,
      notes: {
        tenantId: params.tenantId,
        orderId: params.orderId,
        billId: params.billId,
        branchId: params.branchId || 'main',
        customerName: params.customer?.name || 'Guest Diner',
        customerPhone: params.customer?.phone || '',
        customerEmail: params.customer?.email || ''
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': this.getAuthHeader(),
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[RazorpayProvider] Order creation error response:', data);
      throw new Error(data.error?.description || data.message || `Razorpay order creation failed with HTTP ${response.status}`);
    }

    if (!data.id) {
      throw new Error('[RazorpayProvider] No order id returned from Razorpay Orders API.');
    }

    return {
      provider: 'razorpay',
      providerOrderId: data.id,
      amountInCents: Number(data.amount),
      currency: data.currency || 'INR',
      status: 'PENDING',
      keyId: this.keyId,
      rawResponse: data
    };
  }

  /**
   * Authoritative server-side payment verification:
   * 1. Constant-time HMAC-SHA256 signature verification against RAZORPAY_KEY_SECRET
   * 2. Direct payment status check on Razorpay API (confirming captured/paid)
   */
  async verifyPayment(params: {
    providerOrderId: string;
    paymentId: string;
    signature: string;
    expectedServerOrderId: string;
  }): Promise<IPaymentVerificationResult> {
    const { providerOrderId, paymentId, signature, expectedServerOrderId } = params;

    if (!paymentId || !signature) {
      return {
        success: false,
        provider: 'razorpay',
        providerOrderId: expectedServerOrderId || providerOrderId,
        status: 'FAILED',
        amountInCents: 0,
        currency: 'INR',
        paymentMethod: 'online',
        failureReason: 'Missing paymentId or signature for verification.'
      };
    }

    // Security check: Verify that the expected server order ID matches
    const authoritativeOrderId = expectedServerOrderId || providerOrderId;

    // Razorpay Signature Formula:
    // HMAC-SHA256(expectedServerOrderId + "|" + razorpay_payment_id, key_secret)
    const payload = `${authoritativeOrderId}|${paymentId}`;
    const generatedSignature = crypto
      .createHmac('sha256', this.keySecret)
      .update(payload)
      .digest('hex');

    let isSignatureValid = false;
    try {
      isSignatureValid = crypto.timingSafeEqual(
        Buffer.from(signature, 'utf8'),
        Buffer.from(generatedSignature, 'utf8')
      );
    } catch {
      isSignatureValid = false;
    }

    if (!isSignatureValid) {
      console.error('[RazorpayProvider] Signature mismatch detected.');
      return {
        success: false,
        provider: 'razorpay',
        providerOrderId: authoritativeOrderId,
        providerPaymentId: paymentId,
        status: 'FAILED',
        amountInCents: 0,
        currency: 'INR',
        paymentMethod: 'online',
        failureReason: 'Cryptographic signature mismatch.'
      };
    }

    // Authoritative API check: Fetch payment from Razorpay to verify captured state and details
    try {
      const paymentUrl = `${this.baseUrl}/payments/${encodeURIComponent(paymentId)}`;
      const paymentRes = await fetch(paymentUrl, {
        method: 'GET',
        headers: {
          'Authorization': this.getAuthHeader(),
          'Accept': 'application/json'
        }
      });

      if (!paymentRes.ok) {
        const errData = await paymentRes.json().catch(() => ({}));
        return {
          success: false,
          provider: 'razorpay',
          providerOrderId: authoritativeOrderId,
          providerPaymentId: paymentId,
          status: 'FAILED',
          amountInCents: 0,
          currency: 'INR',
          paymentMethod: 'online',
          failureReason: errData.error?.description || `Failed to fetch payment details from Razorpay (HTTP ${paymentRes.status})`,
          rawResponse: errData
        };
      }

      const paymentData = await paymentRes.json();
      const rawStatus = (paymentData.status || '').toLowerCase();
      const amountInCents = Number(paymentData.amount || 0);
      const currency = paymentData.currency || 'INR';
      const normalizedMethod = this.normalizePaymentMethod(paymentData.method);
      const paymentReference = paymentData.acquirer_data?.rrn || paymentData.acquirer_data?.bank_transaction_id || paymentId;

      // Check if payment is captured (or authorized with auto-capture)
      if (rawStatus === 'captured') {
        return {
          success: true,
          provider: 'razorpay',
          providerOrderId: authoritativeOrderId,
          providerPaymentId: paymentId,
          paymentReference,
          status: 'SUCCESS',
          amountInCents,
          currency,
          paymentMethod: normalizedMethod,
          verifiedAt: new Date(paymentData.created_at * 1000).toISOString(),
          rawResponse: paymentData
        };
      }

      if (rawStatus === 'authorized') {
        // Attempt capture if uncaptured
        try {
          const captureUrl = `${this.baseUrl}/payments/${encodeURIComponent(paymentId)}/capture`;
          const captureRes = await fetch(captureUrl, {
            method: 'POST',
            headers: {
              'Authorization': this.getAuthHeader(),
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify({ amount: amountInCents, currency })
          });
          if (captureRes.ok) {
            const capturedData = await captureRes.json();
            return {
              success: true,
              provider: 'razorpay',
              providerOrderId: authoritativeOrderId,
              providerPaymentId: paymentId,
              paymentReference,
              status: 'SUCCESS',
              amountInCents,
              currency,
              paymentMethod: normalizedMethod,
              verifiedAt: new Date().toISOString(),
              rawResponse: capturedData
            };
          }
        } catch (_capErr) {}
      }

      let mappedStatus: PaymentStatus = 'FAILED';
      if (rawStatus === 'created' || rawStatus === 'authorized') {
        mappedStatus = 'PROCESSING';
      }

      return {
        success: false,
        provider: 'razorpay',
        providerOrderId: authoritativeOrderId,
        providerPaymentId: paymentId,
        paymentReference,
        status: mappedStatus,
        amountInCents,
        currency,
        paymentMethod: normalizedMethod,
        failureReason: `Payment status is ${rawStatus}, expected captured.`,
        rawResponse: paymentData
      };
    } catch (apiErr: any) {
      console.error('[RazorpayProvider] Verification API error:', apiErr);
      return {
        success: false,
        provider: 'razorpay',
        providerOrderId: authoritativeOrderId,
        providerPaymentId: paymentId,
        status: 'FAILED',
        amountInCents: 0,
        currency: 'INR',
        paymentMethod: 'online',
        failureReason: apiErr.message || 'Razorpay payment lookup error.'
      };
    }
  }

  /**
   * Cryptographically verify and handle Razorpay Webhooks
   */
  async handleWebhook(rawBody: string, headers: Record<string, string>): Promise<IPaymentVerificationResult> {
    const signature = headers['x-razorpay-signature'] || headers['X-Razorpay-Signature'];

    if (!signature) {
      return {
        success: false,
        provider: 'razorpay',
        providerOrderId: '',
        status: 'FAILED',
        amountInCents: 0,
        currency: 'INR',
        paymentMethod: 'online',
        failureReason: 'Missing X-Razorpay-Signature header.'
      };
    }

    if (!this.webhookSecret) {
      return {
        success: false,
        provider: 'razorpay',
        providerOrderId: '',
        status: 'FAILED',
        amountInCents: 0,
        currency: 'INR',
        paymentMethod: 'online',
        failureReason: 'RAZORPAY_WEBHOOK_SECRET is not configured on the server.'
      };
    }

    // Razorpay Webhook Signature Formula:
    // HMAC-SHA256(rawBody, webhookSecret) -> Hex
    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(rawBody)
      .digest('hex');

    let isSignatureValid = false;
    try {
      isSignatureValid = crypto.timingSafeEqual(
        Buffer.from(signature, 'utf8'),
        Buffer.from(expectedSignature, 'utf8')
      );
    } catch {
      isSignatureValid = false;
    }

    if (!isSignatureValid) {
      console.error('[RazorpayProvider] Webhook signature verification failed.');
      return {
        success: false,
        provider: 'razorpay',
        providerOrderId: '',
        status: 'FAILED',
        amountInCents: 0,
        currency: 'INR',
        paymentMethod: 'online',
        failureReason: 'Cryptographic webhook signature mismatch.'
      };
    }

    let parsedPayload: any;
    try {
      parsedPayload = JSON.parse(rawBody);
    } catch {
      return {
        success: false,
        provider: 'razorpay',
        providerOrderId: '',
        status: 'FAILED',
        amountInCents: 0,
        currency: 'INR',
        paymentMethod: 'online',
        failureReason: 'Malformed JSON webhook payload.'
      };
    }

    const event = parsedPayload.event || '';
    const payloadData = parsedPayload.payload || {};
    const paymentEntity = payloadData.payment?.entity || {};
    const orderEntity = payloadData.order?.entity || {};

    const providerOrderId = paymentEntity.order_id || orderEntity.id || '';
    const paymentId = paymentEntity.id ? String(paymentEntity.id) : undefined;
    const amountInCents = Number(paymentEntity.amount || orderEntity.amount || 0);
    const currency = paymentEntity.currency || orderEntity.currency || 'INR';

    const rawMethod = paymentEntity.method || 'online';
    const normalizedMethod = this.normalizePaymentMethod(rawMethod);
    const paymentReference = paymentEntity.acquirer_data?.rrn || paymentEntity.acquirer_data?.bank_transaction_id || paymentId;

    const isSuccess = event === 'payment.captured' || event === 'order.paid';

    return {
      success: isSuccess,
      provider: 'razorpay',
      providerOrderId,
      providerPaymentId: paymentId,
      paymentReference,
      status: isSuccess ? 'SUCCESS' : (event === 'payment.failed' ? 'FAILED' : 'PROCESSING'),
      amountInCents,
      currency,
      paymentMethod: normalizedMethod,
      verifiedAt: paymentEntity.created_at ? new Date(paymentEntity.created_at * 1000).toISOString() : new Date().toISOString(),
      failureReason: isSuccess ? undefined : `Razorpay event: ${event}`,
      rawResponse: parsedPayload
    };
  }

  /**
   * Normalizes provider-specific payment methods to internal canonical values
   */
  normalizePaymentMethod(rawMethod: string): NormalizedPaymentMethod {
    const clean = (rawMethod || '').toLowerCase().trim();
    if (clean.includes('upi')) return 'upi';
    if (clean.includes('card') || clean.includes('credit') || clean.includes('debit') || clean.includes('emi')) return 'card';
    if (clean.includes('wallet')) return 'wallet';
    if (clean.includes('netbanking')) return 'netbanking';
    if (clean.includes('cash')) return 'cash';
    return 'online';
  }
}
