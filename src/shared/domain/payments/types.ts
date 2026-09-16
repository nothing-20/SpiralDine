export type PaymentProviderName = 'razorpay' | 'stripe';

export type PaymentStatus = 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'UNKNOWN';

export type NormalizedPaymentMethod = 'cash' | 'upi' | 'card' | 'wallet' | 'netbanking' | 'online';

export interface IPaymentAttempt {
  id?: string;
  attemptId: string;
  tenantId: string;
  branchId?: string;
  orderId: string;
  billId: string;
  provider: PaymentProviderName;
  providerOrderId: string;
  providerPaymentId?: string;
  paymentSessionId?: string;
  amount: number;             // in smallest currency unit (cents / paise)
  amountInRupees: number;     // formatted decimal rupees
  currency: string;
  status: PaymentStatus;
  verificationStatus: 'unverified' | 'verified' | 'failed';
  paymentMethod?: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  createdAt: string;
  updatedAt: string;
  verifiedAt?: string;
  failureReason?: string;
}

export interface IPaymentCustomerDetails {
  id: string;
  name: string;
  email?: string;
  phone?: string;
}

export interface IPaymentOrderParams {
  tenantId: string;
  branchId?: string;
  orderId: string;
  billId: string;
  amountInCents: number;
  currency: string;
  customer: IPaymentCustomerDetails;
  receipt?: string;
  notes?: Record<string, string>;
}

export interface IPaymentOrderResult {
  provider: PaymentProviderName;
  providerOrderId: string;
  amountInCents: number;
  currency: string;
  status: PaymentStatus;
  keyId?: string;
  rawResponse?: any;
}

export interface IRazorpayVerificationParams {
  providerOrderId: string;
  paymentId: string;
  signature: string;
  expectedServerOrderId: string;
}

export interface IPaymentVerificationResult {
  success: boolean;
  provider: PaymentProviderName;
  providerOrderId: string;
  providerPaymentId?: string;
  paymentReference?: string;
  status: PaymentStatus;
  amountInCents: number;
  currency: string;
  paymentMethod: NormalizedPaymentMethod;
  verifiedAt?: string;
  failureReason?: string;
  rawResponse?: any;
}

export interface IPaymentProvider {
  readonly name: PaymentProviderName;
  createPaymentOrder(params: IPaymentOrderParams): Promise<IPaymentOrderResult>;
  verifyPayment(params: IRazorpayVerificationParams): Promise<IPaymentVerificationResult>;
  handleWebhook(rawBody: string, headers: Record<string, string>): Promise<IPaymentVerificationResult>;
  normalizePaymentMethod(rawMethod: string): NormalizedPaymentMethod;
}
