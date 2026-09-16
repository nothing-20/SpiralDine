import type {
  IPaymentCustomerDetails,
  IPaymentOrderResult,
  IPaymentVerificationResult
} from '../domain/payments/types';

export interface IRazorpayCheckoutOptions {
  key: string;
  amount: number; // in paise
  currency?: string;
  name?: string;
  description?: string;
  image?: string;
  order_id: string;
  handler?: (response: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }) => void;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: Record<string, string>;
  theme?: {
    color?: string;
  };
  modal?: {
    ondismiss?: () => void;
    escape?: boolean;
    backdropclose?: boolean;
  };
}

export interface IRazorpayPaymentSuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

declare global {
  interface Window {
    Razorpay?: new (options: IRazorpayCheckoutOptions) => {
      open: () => void;
      on: (event: string, callback: (response: any) => void) => void;
    };
  }
}

let sdkLoadPromise: Promise<void> | null = null;

export const paymentService = {
  /**
   * Dynamically loads the official Razorpay Checkout JS SDK in the customer's browser.
   * Caches the script promise so it's loaded only once.
   */
  loadRazorpaySdk: (): Promise<void> => {
    if (window.Razorpay) {
      return Promise.resolve();
    }

    if (sdkLoadPromise) {
      return sdkLoadPromise;
    }

    sdkLoadPromise = new Promise((resolve, reject) => {
      const existingScript = document.getElementById('razorpay-checkout-js');
      if (existingScript) {
        existingScript.addEventListener('load', () => {
          if (window.Razorpay) {
            resolve();
          } else {
            reject(new Error('Razorpay SDK script loaded but window.Razorpay is undefined.'));
          }
        });
        return;
      }

      const script = document.createElement('script');
      script.id = 'razorpay-checkout-js';
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => {
        if (window.Razorpay) {
          resolve();
        } else {
          reject(new Error('Razorpay SDK script loaded, but window.Razorpay is undefined.'));
        }
      };
      script.onerror = () => {
        sdkLoadPromise = null;
        reject(new Error('Failed to load Razorpay Checkout JS SDK from CDN.'));
      };
      document.body.appendChild(script);
    });

    return sdkLoadPromise;
  },

  /**
   * Request Spiral Dine server to create a payment order with Razorpay Test Mode.
   * Client provides NO amount; amount is derived authoritatively from canonical bill on server.
   */
  createPaymentOrder: async (
    tenantId: string,
    orderId: string,
    billId?: string,
    customer?: IPaymentCustomerDetails
  ): Promise<IPaymentOrderResult> => {
    const res = await fetch('/api/payments/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId,
        orderId,
        billId,
        customer
      })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to create payment order on server.');
    }

    return {
      provider: data.provider || 'razorpay',
      providerOrderId: data.providerOrderId,
      amountInCents: data.amount,
      currency: data.currency || 'INR',
      status: 'PENDING',
      keyId: data.keyId,
      rawResponse: data
    };
  },

  /**
   * Opens the Razorpay Checkout modal for the customer.
   * Resolves with { success: true, ...keys } when paid, or { success: false, dismissed: true } when closed.
   */
  openRazorpayCheckout: async (
    options: Omit<IRazorpayCheckoutOptions, 'handler' | 'modal'> & {
      modal?: { ondismiss?: () => void };
    }
  ): Promise<{
    success: boolean;
    dismissed?: boolean;
    razorpay_payment_id?: string;
    razorpay_order_id?: string;
    razorpay_signature?: string;
    error?: any;
  }> => {
    await paymentService.loadRazorpaySdk();

    const RazorpayClass = window.Razorpay;
    if (!RazorpayClass) {
      throw new Error('Razorpay Checkout SDK is not available.');
    }

    return new Promise((resolve) => {
      let isResolved = false;

      const rzpOptions: IRazorpayCheckoutOptions = {
        ...options,
        handler: (response: IRazorpayPaymentSuccessResponse) => {
          if (!isResolved) {
            isResolved = true;
            resolve({
              success: true,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature
            });
          }
        },
        modal: {
          ondismiss: () => {
            if (options.modal?.ondismiss) {
              options.modal.ondismiss();
            }
            if (!isResolved) {
              isResolved = true;
              resolve({
                success: false,
                dismissed: true
              });
            }
          }
        }
      };

      try {
        const rzp = new RazorpayClass(rzpOptions);
        rzp.open();
      } catch (err) {
        if (!isResolved) {
          isResolved = true;
          resolve({
            success: false,
            error: err
          });
        }
      }
    });
  },

  /**
   * Calls Spiral Dine server to authoritatively verify payment status and execute canonical settlement.
   */
  verifyPayment: async (
    tenantId: string,
    orderId: string,
    billId: string,
    providerOrderId: string,
    razorpayParams?: {
      razorpay_payment_id?: string;
      razorpay_order_id?: string;
      razorpay_signature?: string;
    }
  ): Promise<IPaymentVerificationResult> => {
    const res = await fetch('/api/payments/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId,
        orderId,
        billId,
        providerOrderId,
        ...razorpayParams
      })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Server payment verification failed.');
    }

    return {
      success: data.success === true,
      provider: 'razorpay',
      providerOrderId,
      paymentReference: data.paymentReference,
      status: data.status,
      amountInCents: data.bill?.total || 0,
      currency: data.bill?.currency || 'INR',
      paymentMethod: data.bill?.paymentMethod || 'online',
      verifiedAt: data.bill?.paidAt,
      rawResponse: data
    };
  }
};

export default paymentService;
