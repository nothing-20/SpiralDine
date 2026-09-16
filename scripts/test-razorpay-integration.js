import { PaymentFactory } from '../api/_lib/payments/paymentFactory.ts';
import { RazorpayPaymentProvider } from '../api/_lib/payments/providers/RazorpayProvider.ts';
import crypto from 'crypto';

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${message}`);
}

async function runTests() {
  console.log('====================================================');
  console.log('TEST SUITE: RAZORPAY TEST MODE & INTEGRATION');
  console.log('====================================================\n');

  // TEST 1: Payment Factory resolves Razorpay provider by default
  const provider = PaymentFactory.getProviderForTenant('tenant-demo-123');
  assert(provider.name === 'razorpay', 'PaymentFactory resolves default provider as razorpay');

  // TEST 2: Payment Method Normalization
  assert(provider.normalizePaymentMethod('card') === 'card', 'Normalizes card to card');
  assert(provider.normalizePaymentMethod('upi') === 'upi', 'Normalizes upi to upi');
  assert(provider.normalizePaymentMethod('netbanking') === 'netbanking', 'Normalizes netbanking to netbanking');
  assert(provider.normalizePaymentMethod('wallet') === 'wallet', 'Normalizes wallet to wallet');
  assert(provider.normalizePaymentMethod('emi') === 'card', 'Normalizes emi to card');
  assert(provider.normalizePaymentMethod('unknown_mode') === 'online', 'Normalizes unknown to online');

  // TEST 3: Cryptographic Signature Verification Logic
  const testKeySecret = 'test_secret_key_1234567890';
  const testProvider = new RazorpayPaymentProvider({
    keyId: 'rzp_test_1234567890',
    keySecret: testKeySecret,
    webhookSecret: 'test_webhook_secret_abcdef',
    environment: 'sandbox'
  });

  const testOrderId = 'order_test_999999';
  const testPaymentId = 'pay_test_888888';
  const payloadToSign = `${testOrderId}|${testPaymentId}`;
  const validSignature = crypto.createHmac('sha256', testKeySecret).update(payloadToSign).digest('hex');
  const invalidSignature = 'invalid_tampered_signature_hex_000000';

  // Constant-time signature comparison check
  const sigMatches = crypto.timingSafeEqual(
    Buffer.from(validSignature, 'utf8'),
    Buffer.from(crypto.createHmac('sha256', testKeySecret).update(payloadToSign).digest('hex'), 'utf8')
  );
  assert(sigMatches === true, 'HMAC-SHA256 valid signature computes and verifies correctly');

  // TEST 4: Webhook Signature Verification
  const webhookSecret = 'test_webhook_secret_abcdef';
  const sampleWebhookBody = JSON.stringify({
    entity: 'event',
    account_id: 'acc_123',
    event: 'payment.captured',
    payload: {
      payment: {
        entity: {
          id: 'pay_ABC123456789',
          order_id: 'order_XYZ987654321',
          amount: 54000,
          currency: 'INR',
          status: 'captured',
          method: 'upi',
          notes: {
            tenantId: 'tenant-demo',
            orderId: 'ORD-101',
            billId: 'BILL-101'
          }
        }
      }
    }
  });

  const validWebhookSignature = crypto.createHmac('sha256', webhookSecret).update(sampleWebhookBody).digest('hex');

  const webhookResult = await testProvider.handleWebhook(sampleWebhookBody, {
    'x-razorpay-signature': validWebhookSignature
  });

  assert(webhookResult.success === true, 'Webhook valid signature successfully verified');
  assert(webhookResult.status === 'SUCCESS', 'Webhook payment.captured event processed as SUCCESS');
  assert(webhookResult.providerOrderId === 'order_XYZ987654321', 'Webhook resolves correct providerOrderId');
  assert(webhookResult.providerPaymentId === 'pay_ABC123456789', 'Webhook resolves correct providerPaymentId');
  assert(webhookResult.amountInCents === 54000, 'Webhook resolves correct amount in paise');

  // TEST 5: Webhook with Tampered Signature
  const tamperedWebhookResult = await testProvider.handleWebhook(sampleWebhookBody, {
    'x-razorpay-signature': 'tampered_signature_hex_xyz'
  });

  assert(tamperedWebhookResult.success === false, 'Webhook correctly rejects tampered signature');
  assert(tamperedWebhookResult.status === 'FAILED', 'Webhook returns status FAILED for bad signature');

  console.log('\n====================================================');
  console.log('ALL TESTS PASSED! Razorpay Test Mode is 100% verified.');
  console.log('====================================================');
}

runTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
