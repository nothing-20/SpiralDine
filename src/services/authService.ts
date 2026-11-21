import { User, UserCredential, ConfirmationResult, ApplicationVerifier, RecaptchaVerifier, AuthCredential } from 'firebase/auth';
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

  async verifyPasswordResetCode(actionCode: string): Promise<string> {
    return firebaseAuth.verifyPasswordResetCode(actionCode);
  },

  async confirmPasswordReset(actionCode: string, newPassword: string): Promise<void> {
    return firebaseAuth.confirmPasswordReset(actionCode, newPassword);
  },

  async applyActionCode(actionCode: string): Promise<void> {
    return firebaseAuth.applyActionCode(actionCode);
  },

  async checkActionCode(actionCode: string): Promise<any> {
    return firebaseAuth.checkActionCode(actionCode);
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
  },

  async signInWithGoogle(): Promise<UserCredential> {
    return firebaseAuth.signInWithGoogle();
  },

  async signInWithGoogleRedirect(): Promise<void> {
    return firebaseAuth.signInWithGoogleRedirect();
  },

  async getGoogleRedirectResult(): Promise<UserCredential | null> {
    return firebaseAuth.getGoogleRedirectResult();
  },

  async signUpOwnerWithGoogle(
    googleUser: User,
    restaurantName: string,
    country?: string,
    currency?: string,
    locale?: string
  ): Promise<{ user: User; tenantId: string }> {
    return firebaseAuth.signUpOwnerWithGoogle(googleUser, restaurantName, country, currency, locale);
  },

  async signInOrRegisterCustomerWithGoogle(
    googleUser: User,
    phoneNumber?: string
  ): Promise<{ uid: string; role: TUserRole; isStaff?: boolean }> {
    return firebaseAuth.signInOrRegisterCustomerWithGoogle(googleUser, phoneNumber);
  },

  getGoogleCredentialFromError(error: any): AuthCredential | null {
    return firebaseAuth.getGoogleCredentialFromError(error);
  },

  async getExistingSignInMethods(email: string): Promise<string[]> {
    return firebaseAuth.getExistingSignInMethods(email);
  },

  async linkGoogleCredential(user: User, credential: AuthCredential): Promise<UserCredential> {
    return firebaseAuth.linkGoogleCredential(user, credential);
  },

  async verifyAndLinkGoogleAccount(
    email: string,
    password: string,
    credential: AuthCredential
  ): Promise<UserCredential> {
    return firebaseAuth.verifyAndLinkGoogleAccount(email, password, credential);
  },

  async linkEmailPasswordCredential(user: User, password: string): Promise<UserCredential> {
    return firebaseAuth.linkEmailPasswordCredential(user, password);
  }
};
export default authService;

