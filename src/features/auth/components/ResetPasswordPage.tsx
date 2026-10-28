import React, { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { 
  Lock, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Clock, 
  ShieldAlert, 
  RefreshCw, 
  ArrowRight,
  ArrowLeft,
  Check,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { authService } from '../../../services/authService';
import toast from 'react-hot-toast';
import { cn } from '../../../utils/cn';

// Decorative food imagery
import leftPlateImg from '../../../assets/left_food_plate.png';
import rightPlateImg from '../../../assets/right_food_plate.png';
import basilLeaf1 from '../../../assets/basil_leaf_1.png';
import basilLeaf2 from '../../../assets/basil_leaf_2.png';

type ResetStage = 
  | 'verifying'      // Inspecting and validating oobCode with Firebase
  | 'ready'          // Valid code verified, ready to receive new password
  | 'submitting'     // confirmPasswordReset in flight
  | 'success'        // Password confirmed updated
  | 'missing_code'   // No oobCode in query or hash
  | 'expired_code'   // auth/expired-action-code
  | 'invalid_code'   // auth/invalid-action-code
  | 'error';         // Generic verification/network error

export const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Extract oobCode from searchParams, searchParams fallback 'code', or URL hash
  const oobCode = useMemo(() => {
    const directCode = searchParams.get('oobCode') || searchParams.get('code');
    if (directCode) return directCode.trim();

    // Parse hash parameters if redirected via hash fragment (e.g. /#/reset-password?oobCode=...)
    if (typeof window !== 'undefined' && window.location.hash) {
      try {
        const hashQuery = window.location.hash.split('?')[1];
        if (hashQuery) {
          const hashParams = new URLSearchParams(hashQuery);
          const hashCode = hashParams.get('oobCode') || hashParams.get('code');
          if (hashCode) return hashCode.trim();
        }
      } catch (_) {}
    }
    return '';
  }, [searchParams]);

  const [stage, setStage] = useState<ResetStage>('verifying');
  const [verifiedEmail, setVerifiedEmail] = useState<string>('');
  const [stageErrorMessage, setStageErrorMessage] = useState<string>('');

  // Password fields
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Live password validation criteria
  const validations = useMemo(() => {
    return {
      minLength: password.length >= 6,
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      passwordsMatch: password.length > 0 && password === confirmPassword,
    };
  }, [password, confirmPassword]);

  const isFormValid = useMemo(() => {
    return (
      validations.minLength &&
      validations.hasUppercase &&
      validations.hasLowercase &&
      validations.hasNumber &&
      validations.passwordsMatch
    );
  }, [validations]);

  // Initial code verification effect
  useEffect(() => {
    let isMounted = true;

    if (!oobCode) {
      setStage('missing_code');
      return;
    }

    const verifyCode = async () => {
      setStage('verifying');
      setStageErrorMessage('');

      try {
        // Authenticate the action code with Firebase Authentication
        const email = await authService.verifyPasswordResetCode(oobCode);
        if (isMounted) {
          setVerifiedEmail(email);
          setStage('ready');
        }
      } catch (err: any) {
        if (!isMounted) return;
        console.warn('[ResetPassword] verifyPasswordResetCode error:', err);
        const code = err?.code || '';

        if (code === 'auth/expired-action-code') {
          setStage('expired_code');
        } else if (code === 'auth/invalid-action-code') {
          setStage('invalid_code');
        } else if (code === 'auth/user-disabled') {
          setStage('error');
          setStageErrorMessage('The account associated with this reset link has been suspended or disabled.');
        } else if (code === 'auth/user-not-found') {
          setStage('error');
          setStageErrorMessage('No account was found matching this password reset request.');
        } else {
          setStage('error');
          setStageErrorMessage(err?.message || 'Failed to verify reset link. Please check your internet connection.');
        }
      }
    };

    verifyCode();

    return () => {
      isMounted = false;
    };
  }, [oobCode]);

  // Form submission handler
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!password) {
      setSubmitError('Please enter a new password.');
      return;
    }
    if (password.length < 6) {
      setSubmitError('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setSubmitError('Passwords do not match. Please re-enter.');
      return;
    }
    if (!oobCode) {
      setSubmitError('Missing reset action code. Please request a new link.');
      return;
    }

    setStage('submitting');

    try {
      // Direct Firebase Authentication password confirmation
      await authService.confirmPasswordReset(oobCode, password);
      setStage('success');
      toast.success('Password updated successfully!');
    } catch (err: any) {
      console.warn('[ResetPassword] confirmPasswordReset error:', err);
      const code = err?.code || '';

      if (code === 'auth/expired-action-code') {
        setStage('expired_code');
      } else if (code === 'auth/invalid-action-code') {
        setStage('invalid_code');
      } else if (code === 'auth/weak-password') {
        setStage('ready');
        setSubmitError('The chosen password does not satisfy Firebase security requirements. Please try a stronger combination.');
      } else {
        setStage('ready');
        setSubmitError(err?.message || 'An error occurred while updating your password. Please try again.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#FCFAF7] text-[#17212B] flex flex-col justify-between font-sans relative overflow-x-hidden selection:bg-[#D65336]/20">
      
      {/* ========================================================================= */}
      {/* 1. ARTISANAL BACKGROUND FOOD GARNISH & ATMOSPHERE                         */}
      {/* ========================================================================= */}
      
      {/* Left side: Food plate */}
      <div className="hidden sm:block absolute left-[-260px] md:left-[-240px] lg:left-[-200px] xl:left-[-160px] top-[14%] md:top-[16%] w-[420px] md:w-[480px] lg:w-[540px] pointer-events-none select-none z-0">
        <img 
          src={leftPlateImg} 
          alt="Artisanal Dining Dish" 
          className="w-full h-auto drop-shadow-xl transform -rotate-12"
        />
      </div>

      {/* Left side: Floating basil garnish */}
      <div className="hidden md:block absolute left-[220px] lg:left-[260px] top-[12%] w-12 h-12 pointer-events-none select-none z-0 transform rotate-45 opacity-90 drop-shadow-sm">
        <img src={basilLeaf2} alt="Fresh Basil Leaf" className="w-full h-full object-contain" />
      </div>

      {/* Right side: Food plate */}
      <div className="hidden sm:block absolute right-[-240px] md:right-[-220px] lg:right-[-190px] xl:right-[-150px] bottom-[10%] md:bottom-[12%] w-[420px] md:w-[480px] lg:w-[540px] pointer-events-none select-none z-0">
        <img 
          src={rightPlateImg} 
          alt="Artisanal Entree Dish" 
          className="w-full h-auto drop-shadow-xl transform rotate-6"
        />
      </div>

      {/* Right side: Floating basil garnish */}
      <div className="hidden md:block absolute right-[230px] lg:right-[280px] bottom-[44%] w-11 h-11 pointer-events-none select-none z-0 transform -rotate-12 opacity-90 drop-shadow-sm">
        <img src={basilLeaf1} alt="Fresh Basil Leaf" className="w-full h-full object-contain" />
      </div>

      {/* Right side: Brand phrase */}
      <div className="hidden lg:flex flex-col items-start absolute right-10 xl:right-16 top-24 xl:top-32 pointer-events-none select-none z-0 -rotate-6">
        <span className="font-serif italic text-2xl xl:text-3xl text-[#7E746A] tracking-tight leading-tight">
          New Password
        </span>
        <span className="font-serif italic text-2xl xl:text-3xl text-[#7E746A] tracking-tight leading-tight">
          Protected Workspace
        </span>
        <div className="w-28 h-0.5 bg-[#D65336]/60 rounded-full mt-1.5 -rotate-2" />
      </div>

      {/* ========================================================================= */}
      {/* 2. TOP BRANDING HEADER                                                    */}
      {/* ========================================================================= */}
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

        <Link 
          to="/login" 
          className="inline-flex items-center space-x-1.5 text-xs font-bold text-[#657180] hover:text-[#17212B] transition-colors py-2 px-3.5 rounded-xl hover:bg-[#F3ECE5] border border-transparent hover:border-[#E8DED6]"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Sign In</span>
        </Link>
      </header>

      {/* ========================================================================= */}
      {/* 3. MAIN CONTENT: RESPONSIVE CENTERED CARD (540–560px)                     */}
      {/* ========================================================================= */}
      <main className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-8 md:py-12 flex flex-col items-center justify-center flex-1 relative z-10">
        
        <div className="max-w-[540px] w-full p-6 sm:p-10 bg-white border border-[#E8DED6] rounded-[24px] shadow-md relative overflow-hidden text-left">
          
          {/* ── STAGE 1: VERIFYING CODE WITH FIREBASE ── */}
          {stage === 'verifying' && (
            <div className="py-12 flex flex-col items-center justify-center space-y-4 text-center">
              <div className="relative w-14 h-14">
                <div className="absolute inset-0 rounded-full border-4 border-[#F3ECE5]" />
                <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#D65336] animate-spin" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-[#17212B]">Verifying Security Token...</h3>
                <p className="text-xs text-[#657180] max-w-xs">
                  Connecting to Firebase Authentication to validate your password reset link.
                </p>
              </div>
            </div>
          )}

          {/* ── STAGE 2: MISSING ACTION CODE ── */}
          {stage === 'missing_code' && (
            <div className="space-y-6 text-center py-4">
              <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto border border-amber-200">
                <AlertCircle className="w-7 h-7 text-amber-600" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl sm:text-2xl font-display font-extrabold text-[#17212B]">
                  Invalid or Missing Link
                </h2>
                <p className="text-xs sm:text-sm text-[#657180] max-w-sm mx-auto leading-relaxed">
                  This reset link is missing a valid security code. If you copied the link from your email, please ensure the entire URL was pasted.
                </p>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  to="/forgot-password"
                  className="w-full sm:w-auto px-6 py-3 bg-[#D65336] hover:bg-[#C2482D] text-white font-bold rounded-xl text-xs transition-all shadow-sm flex items-center justify-center space-x-1.5"
                >
                  <span>Request New Reset Link</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
                <Link
                  to="/login"
                  className="w-full sm:w-auto px-6 py-3 bg-[#F3ECE5] hover:bg-[#E8DED6] text-[#17212B] font-bold rounded-xl text-xs transition-all flex items-center justify-center"
                >
                  Back to Sign In
                </Link>
              </div>
            </div>
          )}

          {/* ── STAGE 3: EXPIRED ACTION CODE ── */}
          {stage === 'expired_code' && (
            <div className="space-y-6 text-center py-4">
              <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto border border-amber-200">
                <Clock className="w-7 h-7 text-amber-600" />
              </div>
              <div className="space-y-2">
                <span className="px-3 py-1 bg-amber-50 text-amber-700 text-[11px] font-bold rounded-full uppercase tracking-wider border border-amber-200">
                  Link Expired
                </span>
                <h2 className="text-xl sm:text-2xl font-display font-extrabold text-[#17212B]">
                  Password Reset Link Expired
                </h2>
                <p className="text-xs sm:text-sm text-[#657180] max-w-sm mx-auto leading-relaxed">
                  For your account security, password reset links expire after a limited period. Please request a new link to proceed.
                </p>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  to="/forgot-password"
                  className="w-full sm:w-auto px-6 py-3 bg-[#D65336] hover:bg-[#C2482D] text-white font-bold rounded-xl text-xs transition-all shadow-sm flex items-center justify-center space-x-1.5"
                >
                  <span>Request Fresh Link</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
                <Link
                  to="/login"
                  className="w-full sm:w-auto px-6 py-3 bg-[#F3ECE5] hover:bg-[#E8DED6] text-[#17212B] font-bold rounded-xl text-xs transition-all flex items-center justify-center"
                >
                  Back to Sign In
                </Link>
              </div>
            </div>
          )}

          {/* ── STAGE 4: INVALID OR PREVIOUSLY CONSUMED CODE ── */}
          {stage === 'invalid_code' && (
            <div className="space-y-6 text-center py-4">
              <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto border border-rose-200">
                <ShieldAlert className="w-7 h-7 text-rose-600" />
              </div>
              <div className="space-y-2">
                <span className="px-3 py-1 bg-rose-50 text-rose-700 text-[11px] font-bold rounded-full uppercase tracking-wider border border-rose-200">
                  Already Used or Invalid
                </span>
                <h2 className="text-xl sm:text-2xl font-display font-extrabold text-[#17212B]">
                  Link No Longer Valid
                </h2>
                <p className="text-xs sm:text-sm text-[#657180] max-w-sm mx-auto leading-relaxed">
                  This reset link has already been used or is malformed. If you still need to reset your password, please generate a new one.
                </p>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  to="/forgot-password"
                  className="w-full sm:w-auto px-6 py-3 bg-[#D65336] hover:bg-[#C2482D] text-white font-bold rounded-xl text-xs transition-all shadow-sm flex items-center justify-center space-x-1.5"
                >
                  <span>Request New Link</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
                <Link
                  to="/login"
                  className="w-full sm:w-auto px-6 py-3 bg-[#F3ECE5] hover:bg-[#E8DED6] text-[#17212B] font-bold rounded-xl text-xs transition-all flex items-center justify-center"
                >
                  Back to Sign In
                </Link>
              </div>
            </div>
          )}

          {/* ── STAGE 5: GENERAL ERROR ── */}
          {stage === 'error' && (
            <div className="space-y-6 text-center py-4">
              <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto border border-rose-200">
                <XCircle className="w-7 h-7 text-rose-600" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl sm:text-2xl font-display font-extrabold text-[#17212B]">
                  Verification Failed
                </h2>
                <p className="text-xs sm:text-sm text-[#657180] max-w-sm mx-auto leading-relaxed">
                  {stageErrorMessage || 'An unexpected error occurred while verifying your reset link.'}
                </p>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="w-full sm:w-auto px-6 py-3 bg-[#17212B] hover:bg-[#23313F] text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry Verification</span>
                </button>
                <Link
                  to="/forgot-password"
                  className="w-full sm:w-auto px-6 py-3 bg-[#F3ECE5] hover:bg-[#E8DED6] text-[#17212B] font-bold rounded-xl text-xs transition-all flex items-center justify-center"
                >
                  Request New Link
                </Link>
              </div>
            </div>
          )}

          {/* ── STAGE 6: ACTIVE RESET PASSWORD FORM ── */}
          {(stage === 'ready' || stage === 'submitting') && (
            <>
              {/* Card Icon & Header */}
              <div className="space-y-3 text-center mb-6">
                <div className="w-14 h-14 bg-[#FCEDE7] rounded-2xl flex items-center justify-center mx-auto shadow-2xs">
                  <Lock className="w-7 h-7 text-[#D65336]" />
                </div>
                <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-[#17212B] tracking-tight">
                  Create a New Password
                </h1>
                <p className="text-xs sm:text-sm text-[#657180] font-normal leading-relaxed max-w-sm mx-auto">
                  Choose a strong password to secure your SpiralDine account.
                </p>

                {/* Verified Account Badge */}
                {verifiedEmail && (
                  <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-[#F8F5EE] border border-[#E8DED6] rounded-full text-[11px] text-[#17212B] font-semibold mt-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#087B5B]" />
                    <span>Resetting for:</span>
                    <span className="font-mono font-bold text-[#D65336]">{verifiedEmail}</span>
                  </div>
                )}
              </div>

              {/* Submission Error Banner */}
              {submitError && (
                <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start space-x-2.5 text-xs text-red-700 animate-in fade-in duration-200">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span className="font-medium">{submitError}</span>
                </div>
              )}

              {/* Password Form */}
              <form onSubmit={handleResetPassword} className="space-y-4" noValidate>
                
                {/* 1. New Password Field */}
                <div className="space-y-1.5">
                  <label 
                    htmlFor="reset-new-password" 
                    className="block text-xs font-bold uppercase tracking-wider text-[#17212B]"
                  >
                    New Password
                  </label>
                  <div className="relative flex items-center">
                    <Lock className="w-4 h-4 text-[#8A817A] absolute left-3.5 pointer-events-none" />
                    <input
                      id="reset-new-password"
                      name="new-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      placeholder="Enter new password"
                      value={password}
                      disabled={stage === 'submitting'}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (submitError) setSubmitError(null);
                      }}
                      className={cn(
                        "w-full pl-10 pr-11 py-3 bg-white border border-[#E8DED6] text-[#17212B] rounded-xl text-sm placeholder-[#98A2B3] transition-all",
                        "focus:outline-none focus:border-[#D65336] focus:ring-2 focus:ring-[#D65336]/20",
                        "disabled:opacity-60 disabled:bg-[#F3ECE5]"
                      )}
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 p-1 text-[#8A817A] hover:text-[#17212B] transition-colors cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* 2. Confirm Password Field */}
                <div className="space-y-1.5">
                  <label 
                    htmlFor="reset-confirm-password" 
                    className="block text-xs font-bold uppercase tracking-wider text-[#17212B]"
                  >
                    Confirm New Password
                  </label>
                  <div className="relative flex items-center">
                    <Lock className="w-4 h-4 text-[#8A817A] absolute left-3.5 pointer-events-none" />
                    <input
                      id="reset-confirm-password"
                      name="confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      disabled={stage === 'submitting'}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        if (submitError) setSubmitError(null);
                      }}
                      className={cn(
                        "w-full pl-10 pr-11 py-3 bg-white border border-[#E8DED6] text-[#17212B] rounded-xl text-sm placeholder-[#98A2B3] transition-all",
                        "focus:outline-none focus:border-[#D65336] focus:ring-2 focus:ring-[#D65336]/20",
                        "disabled:opacity-60 disabled:bg-[#F3ECE5]",
                        confirmPassword && !validations.passwordsMatch ? "border-red-400 focus:border-red-500" : ""
                      )}
                    />
                    <button
                      type="button"
                      aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3.5 p-1 text-[#8A817A] hover:text-[#17212B] transition-colors cursor-pointer"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {confirmPassword && !validations.passwordsMatch && (
                    <p className="text-[11px] text-red-600 font-medium pl-1">
                      Passwords do not match
                    </p>
                  )}
                </div>

                {/* 3. Live Password Requirements Checklist */}
                <div className="p-4 rounded-xl bg-[#FCFAF7] border border-[#E8DED6] space-y-2 text-xs">
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-[#8A817A]">
                    Password Requirements:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="flex items-center space-x-2">
                      <div className={cn(
                        "w-4 h-4 rounded-full flex items-center justify-center text-[10px]",
                        validations.minLength ? "bg-[#E8F5EF] text-[#087B5B]" : "bg-slate-200 text-slate-500"
                      )}>
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                      <span className={cn(validations.minLength ? "text-[#17212B] font-medium" : "text-[#8A817A]")}>
                        At least 6 characters
                      </span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <div className={cn(
                        "w-4 h-4 rounded-full flex items-center justify-center text-[10px]",
                        validations.hasUppercase ? "bg-[#E8F5EF] text-[#087B5B]" : "bg-slate-200 text-slate-500"
                      )}>
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                      <span className={cn(validations.hasUppercase ? "text-[#17212B] font-medium" : "text-[#8A817A]")}>
                        Uppercase letter (A-Z)
                      </span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <div className={cn(
                        "w-4 h-4 rounded-full flex items-center justify-center text-[10px]",
                        validations.hasLowercase ? "bg-[#E8F5EF] text-[#087B5B]" : "bg-slate-200 text-slate-500"
                      )}>
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                      <span className={cn(validations.hasLowercase ? "text-[#17212B] font-medium" : "text-[#8A817A]")}>
                        Lowercase letter (a-z)
                      </span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <div className={cn(
                        "w-4 h-4 rounded-full flex items-center justify-center text-[10px]",
                        validations.hasNumber ? "bg-[#E8F5EF] text-[#087B5B]" : "bg-slate-200 text-slate-500"
                      )}>
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                      <span className={cn(validations.hasNumber ? "text-[#17212B] font-medium" : "text-[#8A817A]")}>
                        At least one number (0-9)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Primary Submit Button */}
                <button
                  type="submit"
                  disabled={stage === 'submitting' || !isFormValid}
                  className="w-full py-3.5 px-6 bg-[#D65336] hover:bg-[#C2482D] active:scale-[0.99] text-white font-bold rounded-xl text-sm transition-all shadow-sm flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed mt-2"
                >
                  {stage === 'submitting' ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Securing Your Password...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Reset Password</span>
                    </>
                  )}
                </button>
              </form>

              {/* Back to sign in */}
              <div className="mt-6 pt-5 border-t border-[#E8DED6] text-center">
                <Link 
                  to="/login" 
                  className="text-xs font-semibold text-[#657180] hover:text-[#17212B] hover:underline"
                >
                  ← Cancel and return to Sign In
                </Link>
              </div>
            </>
          )}

          {/* ── STAGE 7: SUCCESS STATE ── */}
          {stage === 'success' && (
            <div className="space-y-6 text-center py-4 animate-in fade-in zoom-in-95 duration-300">
              <div className="w-16 h-16 bg-[#E8F5EF] rounded-2xl flex items-center justify-center mx-auto shadow-sm border border-[#C6E6D6]">
                <CheckCircle2 className="w-9 h-9 text-[#087B5B]" />
              </div>

              <div className="space-y-2">
                <span className="px-3 py-1 bg-[#E8F5EF] text-[#087B5B] text-[11px] font-bold rounded-full uppercase tracking-wider border border-[#C6E6D6]">
                  Success
                </span>
                <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-[#17212B] tracking-tight">
                  Password Updated Successfully
                </h2>
                <p className="text-xs sm:text-sm text-[#657180] max-w-sm mx-auto leading-relaxed">
                  Your SpiralDine password has been changed. You can now sign in using your new credentials.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#FCFAF7] border border-[#E8DED6] text-xs text-[#657180] space-y-1">
                <p className="font-semibold text-[#17212B]">Security Confirmation:</p>
                <p>All active sessions have been safely refreshed. Please sign in to resume your session.</p>
              </div>

              <div className="pt-2 flex flex-col space-y-3">
                <Link
                  to="/login"
                  className="w-full py-3.5 px-6 bg-[#D65336] hover:bg-[#C2482D] text-white font-bold rounded-xl text-sm transition-all shadow-sm flex items-center justify-center space-x-2"
                >
                  <span>Continue to Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>

                <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-2 text-[11px] text-[#8A817A]">
                  <span>Alternate Portals:</span>
                  <Link to="/staff/login" className="hover:text-[#D65336] hover:underline font-medium">
                    Staff Portal
                  </Link>
                  <span>&bull;</span>
                  <Link to="/customer/login" className="hover:text-[#D65336] hover:underline font-medium">
                    Customer Login
                  </Link>
                </div>
              </div>
            </div>
          )}

        </div>

      </main>

      {/* ========================================================================= */}
      {/* 4. FOOTER                                                                 */}
      {/* ========================================================================= */}
      <footer className="w-full max-w-6xl mx-auto px-6 py-6 text-center text-xs text-[#8A817A] relative z-20">
        <p>&copy; {new Date().getFullYear()} SpiralDine Platform. All rights reserved.</p>
      </footer>

    </div>
  );
};

export default ResetPasswordPage;
