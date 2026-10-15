import { RecaptchaVerifier } from 'firebase/auth';
import { auth } from '../firebase/config';

export interface IRecaptchaManagerOptions {
  size?: 'invisible' | 'normal' | 'compact';
  onSolved?: (token: string) => void;
  onExpired?: () => void;
  onError?: (error: any) => void;
}

/**
 * Production-grade, lifecycle-safe reCAPTCHA manager for Firebase Phone Authentication.
 * Prevents "reCAPTCHA has already been rendered in this element" errors by:
 * 1. Reusing the valid RecaptchaVerifier instance across requests and renders.
 * 2. Resetting the widget via grecaptcha.reset() rather than recreating it.
 * 3. Cleaning both the internal Firebase verifier and the DOM container (innerHTML = '') when destroyed.
 * 4. Ensuring DOM container existence before mounting.
 */
export class RecaptchaManager {
  private containerId: string;
  private verifier: RecaptchaVerifier | null = null;
  private widgetId: number | null = null;
  private isInitializing = false;

  constructor(containerId: string) {
    this.containerId = containerId;
  }

  /**
   * Get or create a lifecycle-safe RecaptchaVerifier instance.
   * Reuses the existing verifier when already valid.
   */
  public async getVerifier(options?: IRecaptchaManagerOptions): Promise<RecaptchaVerifier | null> {
    const container = document.getElementById(this.containerId);
    if (!container) {
      console.error(`[RecaptchaManager] Container #${this.containerId} not found in DOM.`);
      return null;
    }

    // Reuse existing verifier if available and valid
    if (this.verifier) {
      return this.verifier;
    }

    if (this.isInitializing) {
      // Small delay if initialization is currently in flight
      let attempts = 0;
      while (this.isInitializing && attempts < 10) {
        await new Promise((r) => setTimeout(r, 100));
        attempts++;
      }
      if (this.verifier) return this.verifier;
    }

    try {
      this.isInitializing = true;

      // Wipe any leftover DOM children before mounting new widget
      container.innerHTML = '';

      const verifier = new RecaptchaVerifier(auth, container, {
        size: options?.size || 'invisible',
        callback: (response: string) => {
          options?.onSolved?.(response);
        },
        'expired-callback': () => {
          options?.onExpired?.();
        },
        'error-callback': (err: any) => {
          console.error('[RecaptchaManager] reCAPTCHA error callback:', err);
          options?.onError?.(err);
        }
      });

      this.verifier = verifier;

      // Warm up render to obtain widgetId and ensure it is ready
      try {
        const wid = await verifier.render();
        this.widgetId = wid;
      } catch (renderErr) {
        console.warn('[RecaptchaManager] Pre-render warning:', renderErr);
      }

      this.isInitializing = false;
      return verifier;
    } catch (err: any) {
      this.isInitializing = false;
      console.error('[RecaptchaManager] Error initializing RecaptchaVerifier:', err);
      this.destroy();
      throw err;
    }
  }

  /**
   * Reset the reCAPTCHA challenge state without destroying the DOM element.
   * Useful when an OTP expired or when the user requests a new code.
   */
  public async reset(): Promise<void> {
    if (typeof window !== 'undefined' && (window as any).grecaptcha && this.widgetId !== null) {
      try {
        (window as any).grecaptcha.reset(this.widgetId);
        return;
      } catch (resetErr) {
        console.warn('[RecaptchaManager] grecaptcha.reset failed, re-initializing verifier:', resetErr);
      }
    }

    // If reset cannot be completed via widgetId, perform a clean destroy
    this.destroy();
  }

  /**
   * Safely tear down the verifier and wipe the DOM container.
   */
  public destroy(): void {
    if (this.verifier) {
      try {
        this.verifier.clear();
      } catch (clearErr) {
        console.warn('[RecaptchaManager] verifier.clear() warning:', clearErr);
      }
      this.verifier = null;
      this.widgetId = null;
    }

    const container = document.getElementById(this.containerId);
    if (container) {
      container.innerHTML = '';
    }
  }
}
