import { User, UserCredential, ConfirmationResult, ApplicationVerifier, RecaptchaVerifier } from 'firebase/auth';
import { TUserRole } from '../types';
import * as firebaseAuth from '../firebase/auth';

export const authService = {
  async signInWithEmail(email: string, password: string, rememberMe: boolean): Promise<UserCredential> {
    return firebaseAuth.signIn(email, password, rememberMe);
  },

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

  async signUpCustomer(
    email: string,
    password: string,
    fullName: string,
    phoneNumber?: string
  ): Promise<UserCredential> {
    return firebaseAuth.signUpCustomer(email, password, fullName, phoneNumber);
  },

  async resetPassword(email: string): Promise<void> {
    return firebaseAuth.resetPassword(email);
  },

  async signOutUser(): Promise<void> {
    return firebaseAuth.signOut();
  },

  async sendEmailVerificationLink(user: User): Promise<void> {
    return firebaseAuth.sendEmailVerificationLink(user);
  },

  async getUserClaims(user: User): Promise<{ role?: TUserRole; tenantId?: string }> {
    return firebaseAuth.getUserClaims(user);
  },

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

  async signInWithPhone(phoneNumber: string, appVerifier: ApplicationVerifier): Promise<ConfirmationResult> {
    return firebaseAuth.signInWithPhone(phoneNumber, appVerifier);
  },

  async confirmPhoneOtp(confirmationResult: ConfirmationResult, verificationCode: string): Promise<UserCredential> {
    return firebaseAuth.confirmPhoneOtp(confirmationResult, verificationCode);
  },

  async linkPhone(user: User, phoneNumber: string, appVerifier: ApplicationVerifier): Promise<ConfirmationResult> {
    return firebaseAuth.linkPhone(user, phoneNumber, appVerifier);
  }
};
export default authService;

