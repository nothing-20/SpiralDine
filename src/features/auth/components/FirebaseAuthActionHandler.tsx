import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Clock, 
  ShieldCheck, 
  ArrowRight,
  ArrowLeft,
  MailCheck,
  RefreshCw,
  Sparkles,
  ShieldAlert
} from 'lucide-react';
import { authService } from '../../../services/authService';
import { ResetPasswordPage } from './ResetPasswordPage';
import toast from 'react-hot-toast';
import { cn } from '../../../utils/cn';

// Decorative food imagery
import leftPlateImg from '../../../assets/left_food_plate.png';
import rightPlateImg from '../../../assets/right_food_plate.png';
import basilLeaf1 from '../../../assets/basil_leaf_1.png';
import basilLeaf2 from '../../../assets/basil_leaf_2.png';

export type FirebaseActionMode = 
  | 'resetPassword'
  | 'verifyEmail'
  | 'recoverEmail'
  | 'verifyAndChangeEmail'
  | 'unknown';

export const FirebaseAuthActionHandler: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Extract all standard Firebase Auth action parameters
  const { mode, oobCode, apiKey, continueUrl, lang } = useMemo(() => {
    let rawMode = searchParams.get('mode') || '';
    let rawCode = searchParams.get('oobCode') || searchParams.get('code') || '';
    let rawApiKey = searchParams.get('apiKey') || '';
    let rawContinueUrl = searchParams.get('continueUrl') || '';
    let rawLang = searchParams.get('lang') || 'en';

    // Parse hash parameters if redirected via hash fragment (e.g., /auth/action#mode=resetPassword&oobCode=...)
    if (typeof window !== 'undefined' && window.location.hash) {
      try {
        const hashQuery = window.location.hash.replace(/^#\/?\??/, '');
        if (hashQuery) {
          const hashParams = new URLSearchParams(hashQuery);
          if (!rawMode) rawMode = hashParams.get('mode') || '';
          if (!rawCode) rawCode = hashParams.get('oobCode') || hashParams.get('code') || '';
          if (!rawApiKey) rawApiKey = hashParams.get('apiKey') || '';
          if (!rawContinueUrl) rawContinueUrl = hashParams.get('continueUrl') || '';
          if (rawLang === 'en') rawLang = hashParams.get('lang') || 'en';
        }
      } catch (_) {}
    }

    return {
      mode: (rawMode.trim() as FirebaseActionMode) || 'unknown',
      oobCode: rawCode.trim(),
      apiKey: rawApiKey.trim(),
      continueUrl: rawContinueUrl.trim(),
      lang: rawLang.trim(),
    };
  }, [searchParams]);

  // States for email verification and recovery flows
  const [verifyStatus, setVerifyStatus] = useState<'idle' | 'verifying' | 'success' | 'expired_code' | 'invalid_code' | 'error'>('idle');
  const [recoveredEmail, setRecoveredEmail] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // ---------------------------------------------------------------------------
  // Action: Email Verification Execution
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let isMounted = true;

    if (mode === 'verifyEmail' || mode === 'verifyAndChangeEmail') {
      if (!oobCode) {
        setVerifyStatus('invalid_code');
        return;
      }

      const executeVerification = async () => {
        setVerifyStatus('verifying');
        try {
          await authService.applyActionCode(oobCode);
          if (isMounted) {
            setVerifyStatus('success');
            toast.success('Email verified successfully!');
          }
        } catch (err: any) {
          if (!isMounted) return;
          console.warn('[FirebaseAuthActionHandler] verifyEmail error:', err);
          const code = err?.code || '';
          if (code === 'auth/expired-action-code') {
            setVerifyStatus('expired_code');
          } else if (code === 'auth/invalid-action-code') {
            setVerifyStatus('invalid_code');
          } else {
            setVerifyStatus('error');
            setErrorMessage(err?.message || 'Failed to verify email. Please try again.');
          }
        }
      };

      executeVerification();
    } else if (mode === 'recoverEmail') {
      if (!oobCode) {
        setVerifyStatus('invalid_code');
        return;
      }

      const executeRecovery = async () => {
        setVerifyStatus('verifying');
        try {
          const info = await authService.checkActionCode(oobCode);
          const email = info.data?.email || '';
          await authService.applyActionCode(oobCode);
          if (isMounted) {
            setRecoveredEmail(email);
            setVerifyStatus('success');
            toast.success('Email address restored successfully!');
          }
        } catch (err: any) {
          if (!isMounted) return;
          console.warn('[FirebaseAuthActionHandler] recoverEmail error:', err);
          const code = err?.code || '';
          if (code === 'auth/expired-action-code') {
            setVerifyStatus('expired_code');
          } else if (code === 'auth/invalid-action-code') {
            setVerifyStatus('invalid_code');
          } else {
            setVerifyStatus('error');
            setErrorMessage(err?.message || 'Failed to recover email address.');
          }
        }
      };

      executeRecovery();
    }

    return () => {
      isMounted = false;
    };
  }, [mode, oobCode]);

  // ---------------------------------------------------------------------------
  // Case 1: Password Reset Action (Default if mode=resetPassword or only oobCode)
  // ---------------------------------------------------------------------------
  if (mode === 'resetPassword' || (mode === 'unknown' && Boolean(oobCode))) {
    return <ResetPasswordPage initialCode={oobCode} continueUrl={continueUrl} />;
  }

  // ---------------------------------------------------------------------------
  // Case 2: Email Verification & Email Recovery UI
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-[#FCFAF7] text-[#17212B] flex flex-col justify-between font-sans relative overflow-x-hidden selection:bg-[#D65336]/20">
      
      {/* Decorative Atmosphere */}
      <div className="hidden sm:block absolute left-[-260px] md:left-[-240px] lg:left-[-200px] xl:left-[-160px] top-[14%] md:top-[16%] w-[420px] md:w-[480px] lg:w-[540px] pointer-events-none select-none z-0">
        <img src={leftPlateImg} alt="Artisanal Dining Dish" className="w-full h-auto drop-shadow-xl transform -rotate-12" />
      </div>
      <div className="hidden md:block absolute left-[220px] lg:left-[260px] top-[12%] w-12 h-12 pointer-events-none select-none z-0 transform rotate-45 opacity-90 drop-shadow-sm">
        <img src={basilLeaf2} alt="Fresh Basil Leaf" className="w-full h-full object-contain" />
      </div>
      <div className="hidden sm:block absolute right-[-240px] md:right-[-220px] lg:right-[-190px] xl:right-[-150px] bottom-[10%] md:bottom-[12%] w-[420px] md:w-[480px] lg:w-[540px] pointer-events-none select-none z-0">
        <img src={rightPlateImg} alt="Artisanal Entree Dish" className="w-full h-auto drop-shadow-xl transform rotate-6" />
      </div>
      <div className="hidden md:block absolute right-[230px] lg:right-[280px] bottom-[44%] w-11 h-11 pointer-events-none select-none z-0 transform -rotate-12 opacity-90 drop-shadow-sm">
        <img src={basilLeaf1} alt="Fresh Basil Leaf" className="w-full h-full object-contain" />
      </div>

      {/* Header */}
      <header className="w-full max-w-6xl mx-auto px-6 py-5 flex items-center justify-between relative z-20">
        <Link to="/" className="flex items-center space-x-3.5 group">
          <div className="w-10 h-10 bg-[#D65336] rounded-xl flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
            <span className="text-white font-extrabold text-xl font-display leading-none">S</span>
          </div>
          <div>
            <span className="font-display font-extrabold text-xl tracking-tight text-[#17212B]">
              Spiral <span className="text-[#D65336]">Dine</span>
            </span>
            <p className="text-[10px] font-semibold text-[#8A817A] hidden sm:block leading-none mt-0.5">
              Smart Dining. Smarter Business.
            </p>
          </div>
        </Link>
        <Link to="/login" className="inline-flex items-center text-xs font-semibold text-[#5A5047] hover:text-[#D65336] transition-colors">
          <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Back to Login
        </Link>
      </header>

      {/* Center Card */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-8 sm:py-12 relative z-10">
        <div className="w-full max-w-md bg-white rounded-3xl p-8 sm:p-10 shadow-[0_12px_40px_rgba(23,33,43,0.08)] border border-[#EBE5DE] relative">
          
          {/* VERIFYING SPINNER */}
          {verifyStatus === 'verifying' && (
            <div className="text-center py-6">
              <div className="w-14 h-14 mx-auto mb-4 bg-[#D65336]/10 rounded-2xl flex items-center justify-center text-[#D65336]">
                <RefreshCw className="w-7 h-7 animate-spin" />
              </div>
              <h2 className="text-xl font-display font-bold text-[#17212B] mb-2">
                Verifying Your Request...
              </h2>
              <p className="text-xs text-[#7E746A] max-w-xs mx-auto">
                Please wait while we validate your action link with Firebase Authentication.
              </p>
            </div>
          )}

          {/* EMAIL VERIFIED SUCCESS */}
          {verifyStatus === 'success' && (mode === 'verifyEmail' || mode === 'verifyAndChangeEmail') && (
            <div className="text-center py-4">
              <div className="w-16 h-16 mx-auto mb-4 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 border border-emerald-200">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-display font-extrabold text-[#17212B] mb-2">
                Email Verified!
              </h2>
              <p className="text-xs text-[#5A5047] leading-relaxed mb-6">
                Your email address has been successfully verified. You now have full access to your SpiralDine restaurant and customer features.
              </p>
              <button
                type="button"
                onClick={() => {
                  if (continueUrl && continueUrl.startsWith('/') && !continueUrl.startsWith('//')) {
                    navigate(continueUrl);
                  } else {
                    navigate('/login');
                  }
                }}
                className="w-full py-3.5 px-6 bg-[#D65336] hover:bg-[#C2452B] active:bg-[#A93922] text-white font-semibold text-sm rounded-xl shadow-sm transition-all flex items-center justify-center group"
              >
                <span>Proceed to Sign In</span>
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          )}

          {/* EMAIL RECOVERED SUCCESS */}
          {verifyStatus === 'success' && mode === 'recoverEmail' && (
            <div className="text-center py-4">
              <div className="w-16 h-16 mx-auto mb-4 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 border border-amber-200">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-display font-bold text-[#17212B] mb-2">
                Email Address Restored
              </h2>
              <p className="text-xs text-[#5A5047] leading-relaxed mb-4">
                Your account email has been reverted to:
              </p>
              {recoveredEmail && (
                <div className="inline-block bg-[#F4EFEA] border border-[#E0D8D0] px-3.5 py-1.5 rounded-lg text-xs font-semibold text-[#17212B] mb-5">
                  {recoveredEmail}
                </div>
              )}
              <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-left text-xs text-amber-900 mb-6 flex items-start space-x-2">
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  If you did not request this email change, your password may have been compromised. We strongly recommend resetting your password immediately.
                </span>
              </div>
              <div className="space-y-3">
                <Link
                  to={`/forgot-password?email=${encodeURIComponent(recoveredEmail)}`}
                  className="w-full py-3 px-4 bg-[#D65336] hover:bg-[#C2452B] text-white font-semibold text-sm rounded-xl flex items-center justify-center"
                >
                  Reset Your Password Now
                </Link>
                <Link
                  to="/login"
                  className="w-full py-2.5 px-4 text-xs font-semibold text-[#7E746A] hover:text-[#17212B] block text-center"
                >
                  Back to Sign In
                </Link>
              </div>
            </div>
          )}

          {/* EXPIRED CODE */}
          {verifyStatus === 'expired_code' && (
            <div className="text-center py-4">
              <div className="w-14 h-14 mx-auto mb-4 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 border border-amber-200">
                <Clock className="w-7 h-7" />
              </div>
              <h2 className="text-xl font-display font-bold text-[#17212B] mb-2">
                Action Link Expired
              </h2>
              <p className="text-xs text-[#7E746A] leading-relaxed mb-6">
                This verification code has expired. For your security, verification links expire after a short period.
              </p>
              <Link
                to="/login"
                className="w-full py-3.5 px-6 bg-[#D65336] hover:bg-[#C2452B] text-white font-semibold text-sm rounded-xl flex items-center justify-center"
              >
                Sign In to Request New Link
              </Link>
            </div>
          )}

          {/* INVALID CODE */}
          {verifyStatus === 'invalid_code' && (
            <div className="text-center py-4">
              <div className="w-14 h-14 mx-auto mb-4 bg-red-50 rounded-2xl flex items-center justify-center text-red-600 border border-red-200">
                <XCircle className="w-7 h-7" />
              </div>
              <h2 className="text-xl font-display font-bold text-[#17212B] mb-2">
                Invalid or Already Used Link
              </h2>
              <p className="text-xs text-[#7E746A] leading-relaxed mb-6">
                This link is no longer valid or has already been used. Please log in or request a fresh link.
              </p>
              <Link
                to="/login"
                className="w-full py-3.5 px-6 bg-[#D65336] hover:bg-[#C2452B] text-white font-semibold text-sm rounded-xl flex items-center justify-center"
              >
                Back to Sign In
              </Link>
            </div>
          )}

          {/* GENERIC ERROR OR UNKNOWN MODE */}
          {(verifyStatus === 'error' || (mode === 'unknown' && !oobCode)) && (
            <div className="text-center py-4">
              <div className="w-14 h-14 mx-auto mb-4 bg-red-50 rounded-2xl flex items-center justify-center text-red-600 border border-red-200">
                <AlertCircle className="w-7 h-7" />
              </div>
              <h2 className="text-xl font-display font-bold text-[#17212B] mb-2">
                Authentication Action Error
              </h2>
              <p className="text-xs text-[#7E746A] leading-relaxed mb-6">
                {errorMessage || 'Missing or invalid authentication parameters. Please check the URL received in your email or return to login.'}
              </p>
              <Link
                to="/login"
                className="w-full py-3.5 px-6 bg-[#D65336] hover:bg-[#C2452B] text-white font-semibold text-sm rounded-xl flex items-center justify-center"
              >
                Back to Sign In
              </Link>
            </div>
          )}

        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-6xl mx-auto px-6 py-6 text-center text-xs text-[#A89F95] relative z-20">
        <p>&copy; {new Date().getFullYear()} SpiralDine Platform. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default FirebaseAuthActionHandler;
