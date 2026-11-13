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
 * 1. Mounting each RecaptchaVerifier instance to an isolated child DOM element inside the container.
 * 2. Reusing the active, valid RecaptchaVerifier instance while connected to the DOM.
 * 3. Cleaning up through verifier.clear() and node.remove(), avoiding any unsafe container.innerHTML wipes.
 * 4. Preventing concurrent double-initialization via an internal initialization promise guard.
 * 5. Safely resetting widget challenge state via grecaptcha.reset() without destroying the verifier.
 */
export class RecaptchaManager {
  private containerId: string;
  private verifier: RecaptchaVerifier | null = null;
  private activeChildElement: HTMLElement | null = null;
  private widgetId: number | null = null;
  private initPromise: Promise<RecaptchaVerifier | null> | null = null;

  constructor(containerId: string) {
    this.containerId = containerId;
  }

  /**
   * Get or create a lifecycle-safe RecaptchaVerifier instance.
   * If a valid verifier is already mounted and connected to the container, reuses it.
   */
  public async getVerifier(options?: IRecaptchaManagerOptions): Promise<RecaptchaVerifier | null> {
    const parentContainer = document.getElementById(this.containerId);
    if (!parentContainer) {
      console.error(`[RecaptchaManager] Container #${this.containerId} not found in DOM.`);
      return null;
    }

    // Reuse existing verifier if its child node is still mounted in the parent container
    if (this.verifier && this.activeChildElement && parentContainer.contains(this.activeChildElement)) {
      return this.verifier;
    }

    // Prevent concurrent initialization races
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      try {
        // Safely dispose any previous verifier instance before creating a new one
        this.destroy();

        // Create an isolated child container. Google grecaptcha binds to this fresh node,
        // which completely eliminates "reCAPTCHA has already been rendered in this element" collisions.
        const childNode = document.createElement('div');
        childNode.id = `${this.containerId}-badge-${Date.now()}`;
        parentContainer.appendChild(childNode);
        this.activeChildElement = childNode;

        const verifier = new RecaptchaVerifier(auth, childNode, {
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

        // Render once to warm up widgetId so reset() can be called safely if needed
        try {
          const wid = await verifier.render();
          this.widgetId = wid;
        } catch (renderErr) {
          console.warn('[RecaptchaManager] Pre-render note:', renderErr);
        }

        return verifier;
      } catch (err: any) {
        console.error('[RecaptchaManager] Error initializing RecaptchaVerifier:', err);
        this.destroy();
        throw err;
      } finally {
        this.initPromise = null;
      }
    })();

    return this.initPromise;
  }

  /**
   * Reset the reCAPTCHA challenge state without destroying the DOM element.
   * Used when an OTP expired or when the user requests a new code.
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

    // If reset via widgetId fails, perform clean destruction so next getVerifier() gets a fresh node
    this.destroy();
  }

  /**
   * Safely tear down the verifier and wipe the isolated child element.
   * Never calls container.innerHTML = ''; relies strictly on verifier.clear()
   * and Node.remove() to preserve Google reCAPTCHA's global state integrity.
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

    if (this.activeChildElement) {
      try {
        this.activeChildElement.remove();
      } catch (_) {}
      this.activeChildElement = null;
    }
  }
}
