import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { authService } from '../../../services/authService';
import Button from '../../../components/ui/Button/Button';
import { useToastStore } from '../../../components/ui/Toast/Toast';

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
    <div className="space-y-5 text-center">
      <h2 className="text-lg font-display font-bold text-textPearl">Verify Your Email</h2>
      <p className="text-xs text-slate-400">
        We have sent a verification link to <strong className="text-textPearl font-semibold">{firebaseUser?.email}</strong>.
        Please click the link in your email to enable workspace functions.
      </p>

      <div className="space-y-2 pt-2">
        <Button 
          type="button" 
          className="w-full" 
          onClick={checkVerificationStatus}
        >
          I've Verified My Email
        </Button>
        
        <Button 
          type="button" 
          variant="secondary" 
          className="w-full" 
          onClick={handleResend}
          isLoading={isSending}
        >
          Resend Verification Email
        </Button>
      </div>

      <button 
        onClick={logout} 
        className="text-xs text-slate-500 hover:text-textPearl hover:underline mt-4"
      >
        Sign in with a different account
      </button>
    </div>
  );
};
export default VerifyEmail;
