import { RazorpayPaymentProvider } from './providers/RazorpayProvider.js';
import type { IPaymentProvider, PaymentProviderName } from '../../../src/shared/domain/payments/types';

export interface ITenantPaymentConfig {
  tenantId: string;
  provider: PaymentProviderName;
  keyId?: string;
  keySecret?: string;
  webhookSecret?: string;
  environment?: 'sandbox' | 'production';
}

/**
 * Multi-tenant aware Payment Factory.
 * Resolves the appropriate payment provider adapter for any restaurant tenant.
 */
export class PaymentFactory {
  private static defaultProviderInstance: IPaymentProvider | null = null;

  /**
   * Get the active payment provider for a tenant.
   * In sandbox mode, defaults to Razorpay Test Mode.
   * Designed to dynamically support tenant-specific credentials and multi-gateway architecture.
   */
  static getProviderForTenant(
    tenantId: string,
    overrideConfig?: Partial<ITenantPaymentConfig>
  ): IPaymentProvider {
    const selectedProvider = overrideConfig?.provider || 'razorpay';

    switch (selectedProvider) {
      case 'razorpay': {
        // If tenant-specific credentials are provided, instantiate tailored adapter
        if (overrideConfig?.keyId && overrideConfig?.keySecret) {
          return new RazorpayPaymentProvider({
            keyId: overrideConfig.keyId,
            keySecret: overrideConfig.keySecret,
            webhookSecret: overrideConfig.webhookSecret,
            environment: overrideConfig.environment || 'sandbox'
          });
        }
        
        // Default singleton sandbox provider
        if (!this.defaultProviderInstance) {
          this.defaultProviderInstance = new RazorpayPaymentProvider();
        }
        return this.defaultProviderInstance!;
      }

      default:
        throw new Error(`[PaymentFactory] Unsupported payment provider: ${selectedProvider}`);
    }
  }
}
