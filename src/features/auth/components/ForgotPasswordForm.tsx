import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { authService } from '../../../services/authService';
import { useToastStore } from '../../../components/ui/Toast/Toast';
import SharedAuthLayout from '../../../shared/ui/auth/SharedAuthLayout';
import { Lock, Mail, ArrowRight } from 'lucide-react';

export const ForgotPasswordForm: React.FC = () => {
  const { addToast } = useToastStore();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const validate = () => {
    if (!email) {
      setError('Email address is required');
      return false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Email format is invalid');
      return false;
    }
    setError('');
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    try {
      await authService.resetPassword(email);
      addToast('Password reset email dispatched successfully!', 'success');
      setIsSuccess(true);
    } catch (err: any) {
      console.error(err);
      addToast(err.message || 'Failed to send reset email. Verify user email.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SharedAuthLayout
      roleVariant="default"
      badgeLabel="Account Recovery"
      pageTitle="Reset Password"
      pageSubtitle="Enter your account email to receive secure recovery instructions."
      icon={<Lock className="w-7 h-7 text-[#D65336]" />}
      cardMaxWidth="max-w-[480px]"
    >
      {isSuccess ? (
        <div className="text-center space-y-4 py-2">
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs leading-relaxed">
            A password reset link has been dispatched to <strong>{email}</strong>. Please check your inbox and spam folder.
          </div>
          <Link
            to="/login"
            className="inline-flex items-center justify-center w-full py-3 px-4 rounded-xl bg-[#D65336] text-white font-bold text-xs hover:bg-[#B9432D] transition-colors"
          >
            <span>Return to Sign In</span>
            <ArrowRight className="w-4 h-4 ml-1.5" />
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="w-full flex flex-col space-y-1.5 text-left">
            <label htmlFor="reset-email" className="text-xs font-bold text-[#17202A] select-none">
              Registered Email Address
            </label>
            <div className="relative flex items-center">
              <Mail className="w-4 h-4 text-[#8A94A3] absolute left-3.5 pointer-events-none" />
              <input
                id="reset-email"
                type="email"
                placeholder="you@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                className="w-full pl-10 pr-4 py-3 bg-[#FCFAF7] border border-[#E8DED6] text-[#17202A] rounded-xl text-sm placeholder-[#8A94A3] focus:outline-none focus:border-[#D65336] focus:ring-2 focus:ring-[#D65336]/20 transition-all disabled:opacity-60"
              />
            </div>
            {error && <span className="text-xs font-semibold text-red-600 pl-1">{error}</span>}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-12 mt-2 bg-[#D65336] hover:bg-[#B9432D] text-white font-bold text-sm rounded-xl flex items-center justify-center space-x-2 shadow-xs hover:shadow transition-all disabled:opacity-60 cursor-pointer"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span>Send Password Reset Link</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          <div className="text-center pt-4 border-t border-[#E8DED6] text-xs text-[#667085]">
            Remember your credentials?{' '}
            <Link to="/login" className="text-[#D65336] hover:text-[#B9432D] font-bold hover:underline">
              Sign In
            </Link>
          </div>
        </form>
      )}
    </SharedAuthLayout>
  );
};

export default ForgotPasswordForm;
