import React, { useState } from 'react';
import { User, AuthCredential } from 'firebase/auth';
import { Lock, Mail, Link2, ShieldCheck, AlertCircle, Eye, EyeOff, Loader2, X } from 'lucide-react';
import { authService } from '../../shared/services/authService';
import toast from 'react-hot-toast';

export interface IAccountLinkingModalProps {
  isOpen: boolean;
  email: string;
  pendingCredential: AuthCredential | null;
  onClose: () => void;
  onSuccess: (user: User) => void;
  portalName?: string;
}

export const AccountLinkingModal: React.FC<IAccountLinkingModalProps> = ({
  isOpen,
  email,
  pendingCredential,
  onClose,
  onSuccess,
  portalName = 'SpiralDine'
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return; // Prevent duplicate submissions or rapid repeated clicks

    if (!password.trim()) {
      setErrorMessage('Please enter your existing password to verify account ownership.');
      return;
    }

    if (!pendingCredential) {
      setErrorMessage('Pending Google credential is missing. Please initiate Google Sign-In again.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      console.log('[AccountLinkingModal] Authenticating existing account and linking Google credential...');
      const userCredential = await authService.verifyAndLinkGoogleAccount(
        email,
        password.trim(),
        pendingCredential
      );

      toast.success('Google account successfully linked to your existing profile!');
      onSuccess(userCredential.user);
    } catch (err: any) {
      console.error('[AccountLinkingModal] Error linking account:', err);
      if (
        err.code === 'auth/wrong-password' ||
        err.code === 'auth/invalid-credential' ||
        err.code === 'auth/invalid-login-credentials'
      ) {
        setErrorMessage('Incorrect password. Please verify the password for this account.');
      } else if (err.code === 'auth/too-many-requests') {
        setErrorMessage('Too many failed attempts. Please try again later or reset your password.');
      } else if (err.code === 'auth/credential-already-in-use') {
        setErrorMessage('This Google account is already linked to another profile.');
      } else {
        setErrorMessage(err.message || 'Failed to link account. Please check your credentials.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div 
        className="w-full max-w-md bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-scaleIn"
        role="dialog"
        aria-modal="true"
        aria-labelledby="linking-modal-title"
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800/80 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Link2 className="w-5 h-5" />
            </div>
            <div>
              <h2 id="linking-modal-title" className="text-base font-bold text-slate-100">
                Link Google Account
              </h2>
              <p className="text-xs text-slate-400">Single Account Identity Verification</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors disabled:opacity-50"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-slate-300 space-y-2">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                An existing account was found for <strong className="text-slate-100">{email}</strong>. SpiralDine enforces <strong>One Person = One Account</strong> to protect your data and permissions.
              </p>
            </div>
            <p className="text-slate-400 pl-6">
              Please enter your existing password to verify ownership and connect Google Sign-In to your profile.
            </p>
          </div>

          {/* Colliding Email Display */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Registered Email Address
            </label>
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-300 text-xs">
              <Mail className="w-4 h-4 text-slate-500" />
              <span className="font-mono text-slate-200">{email}</span>
            </div>
          </div>

          {/* Password Input */}
          <div>
            <label htmlFor="linking-password" className="block text-xs font-semibold text-slate-300 mb-1.5">
              Existing Account Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Lock className="w-4 h-4" />
              </div>
              <input
                id="linking-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                disabled={isLoading}
                placeholder="Enter your current password"
                className="w-full pl-10 pr-10 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors disabled:opacity-50"
                autoFocus
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition-colors"
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-950/40 border border-red-800/60 text-red-200 text-xs animate-shake">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="leading-relaxed">{errorMessage}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2.5 rounded-xl border border-slate-800 text-xs font-semibold text-slate-300 hover:bg-slate-900 hover:text-slate-100 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !password.trim()}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-slate-950 text-xs font-bold hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/20"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Verifying & Linking...</span>
                </>
              ) : (
                <>
                  <Link2 className="w-3.5 h-3.5" />
                  <span>Verify & Link Google</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AccountLinkingModal;
