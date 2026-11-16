import { 
  User, 
  UserCredential, 
  ConfirmationResult, 
  ApplicationVerifier, 
  RecaptchaVerifier, 
  ActionCodeSettings 
} from 'firebase/auth';
import { TUserRole } from '../types';
import * as firebaseAuth from '../firebase/auth';

/**
 * Authoritative central service for handling Firebase Authentication operations.
 * Wraps direct Firebase calls with domain-specific operations for RestaurantOS.
 */
export const authService = {
  /**
   * Signs in a user using their email and password.
   */
  async signInWithEmail(email: string, password: string, rememberMe: boolean): Promise<UserCredential> {
    return firebaseAuth.signIn(email, password, rememberMe);
  },

  /**
   * Signs in a guest diner anonymously in the background.
   * Generates a unique, non-colliding Firebase Auth UID without requiring credentials.
   */
  async signInAnonymous(): Promise<UserCredential> {
    return firebaseAuth.signInAnonymousUser();
  },

  /**
   * Registers a new restaurant owner with an empty, production-ready tenant.
   * Does NOT seed mock data.
   */
  async signUpOwner(
    email: string, 
    password: string, 
    displayName: string, 
    restaurantName: string,
    country?: string,
    currency?: string,
    locale?: string
  ): Promise<UserCredential> {
    return firebaseAuth.signUpOwner(email, password, displayName, restaurantName, country, currency, locale);
  },

  /**
   * Registers a new customer user.
   */
  async signUpCustomer(
    email: string,
    password: string,
    fullName: string,
    phoneNumber?: string
  ): Promise<UserCredential> {
    return firebaseAuth.signUpCustomer(email, password, fullName, phoneNumber);
  },

  /**
   * Triggers a password reset email for the given email address.
   */
  async resetPassword(email: string, actionCodeSettings?: ActionCodeSettings): Promise<void> {
    return firebaseAuth.resetPassword(email, actionCodeSettings);
  },

  /**
   * Verifies a password reset oobCode and retrieves the associated email.
   */
  async verifyPasswordResetCode(actionCode: string): Promise<string> {
    return firebaseAuth.verifyPasswordResetCode(actionCode);
  },

  /**
   * Confirms a password reset with the valid oobCode and new password.
   */
  async confirmPasswordReset(actionCode: string, newPassword: string): Promise<void> {
    return firebaseAuth.confirmPasswordReset(actionCode, newPassword);
  },

  /**
   * Signs out the currently authenticated user.
   */
  async signOutUser(): Promise<void> {
    return firebaseAuth.signOut();
  },

  /**
   * Sends an email verification link to the logged-in user.
   */
  async sendEmailVerificationLink(user: User): Promise<void> {
    return firebaseAuth.sendEmailVerificationLink(user);
  },

  /**
   * Fetches custom claims from the user's ID token, extracting the role and tenantId.
   */
  async getUserClaims(user: User): Promise<{ role?: TUserRole; tenantId?: string }> {
    return firebaseAuth.getUserClaims(user);
  },

  /**
   * Creates a reCAPTCHA verifier for phone authentication.
   */
  createRecaptchaVerifier(
    containerIdOrElement: string | HTMLElement,
    options?: {
      size?: 'invisible' | 'normal' | 'compact';
      callback?: (response: any) => void;
      'expired-callback'?: () => void;
    }
  ): RecaptchaVerifier {
    return firebaseAuth.createRecaptchaVerifier(containerIdOrElement, options);
  },

  /**
   * Initiates phone authentication by dispatching an SMS OTP.
   */
  async signInWithPhone(phoneNumber: string, appVerifier: ApplicationVerifier): Promise<ConfirmationResult> {
    return firebaseAuth.signInWithPhone(phoneNumber, appVerifier);
  },

  /**
   * Confirms a received phone OTP and signs in or completes authentication.
   */
  async confirmPhoneOtp(confirmationResult: ConfirmationResult, verificationCode: string): Promise<UserCredential> {
    return firebaseAuth.confirmPhoneOtp(confirmationResult, verificationCode);
  },

  /**
   * Links a phone number to an existing user via SMS verification.
   */
  async linkPhone(user: User, phoneNumber: string, appVerifier: ApplicationVerifier): Promise<ConfirmationResult> {
    return firebaseAuth.linkPhone(user, phoneNumber, appVerifier);
  },

  /**
   * Links a phone credential directly to an existing user (such as an anonymous guest diner)
   * preserving their existing Firebase Auth UID and attached order history.
   */
  async linkPhoneWithCredential(
    user: User, 
    verificationId: string, 
    verificationCode: string
  ): Promise<UserCredential> {
    return firebaseAuth.linkPhoneWithCredential(user, verificationId, verificationCode);
  },

  /**
   * Canonical customer profile management: ensures customers/{uid} and users/{uid} exist.
   */
  async ensureCustomerProfile(
    user: User,
    extra?: {
      fullName?: string;
      displayName?: string;
      phoneNumber?: string;
      email?: string;
      wasLinked?: boolean;
    }
  ): Promise<any> {
    return firebaseAuth.ensureCustomerProfile(user, extra);
  }
};

export default authService;
