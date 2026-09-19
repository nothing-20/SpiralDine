import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { authService } from '../../../services/authService';
import { useToastStore } from '../../../components/ui/Toast/Toast';
import SharedAuthLayout from '../../../shared/ui/auth/SharedAuthLayout';
import { Mail, CheckCircle2, ArrowRight } from 'lucide-react';

export const VerifyEmail: React.FC = () => {
  const { firebaseUser, logout } = useAuth();
  const { addToast } = useToastStore();
  const navigate = useNavigate();
  const [isSending, setIsSending] = useState(false);

  const handleResend = async () => {
    if (!firebaseUser) return;
    setIsSending(true);
    try {
      await authService.sendEmailVerificationLink(firebaseUser);
      addToast('Verification email resent successfully!', 'success');
    } catch (err: any) {
      console.error(err);
      addToast(err.message || 'Failed to resend email.', 'error');
    } finally {
      setIsSending(false);
    }
  };

  const checkVerificationStatus = async () => {
    if (!firebaseUser) return;
    
    // Refresh auth user state to check if emailVerified is true
    await firebaseUser.reload();
    if (firebaseUser.emailVerified) {
      addToast('Email verified successfully!', 'success');
      navigate('/');
    } else {
      addToast('Email is still unverified. Please check your inbox.', 'info');
    }
  };

  return (
    <SharedAuthLayout
      roleVariant="default"
      badgeLabel="Email Verification"
      pageTitle="Verify Your Email"
      pageSubtitle={`We sent a confirmation link to ${firebaseUser?.email || 'your registered email'}.`}
      icon={<Mail className="w-7 h-7 text-[#D65336]" />}
      cardMaxWidth="max-w-[480px]"
    >
      <div className="space-y-4 text-center">
        <p className="text-xs text-[#667085] leading-relaxed">
          Please click the verification link in your email to enable full workspace permissions and features.
        </p>

        <div className="space-y-2.5 pt-2">
          <button 
            type="button" 
            className="w-full h-12 bg-[#D65336] hover:bg-[#B9432D] text-white font-bold text-xs rounded-xl flex items-center justify-center space-x-1.5 shadow-xs cursor-pointer" 
            onClick={checkVerificationStatus}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>I've Verified My Email</span>
          </button>
          
          <button 
            type="button" 
            className="w-full h-12 bg-[#FCFAF7] hover:bg-[#F5ECE4] border border-[#E8DED6] text-[#17202A] font-bold text-xs rounded-xl transition-all cursor-pointer" 
            onClick={handleResend}
            disabled={isSending}
          >
            {isSending ? 'Sending Link...' : 'Resend Verification Email'}
          </button>
        </div>

        <div className="pt-4 border-t border-[#E8DED6]">
          <button 
            onClick={logout} 
            className="text-xs text-[#8A817A] hover:text-[#17202A] hover:underline font-medium cursor-pointer"
          >
            Sign in with a different account
          </button>
        </div>
      </div>
    </SharedAuthLayout>
  );
};

export default VerifyEmail;
