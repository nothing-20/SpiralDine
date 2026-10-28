import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { 
  KeyRound, 
  Mail, 
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Clock, 
  ShieldCheck,
  Send
} from 'lucide-react';
import { authService } from '../../../services/authService';
import toast from 'react-hot-toast';
import { cn } from '../../../utils/cn';

// Decorative food imagery
import leftPlateImg from '../../../assets/left_food_plate.png';
import rightPlateImg from '../../../assets/right_food_plate.png';
import basilLeaf1 from '../../../assets/basil_leaf_1.png';
import basilLeaf2 from '../../../assets/basil_leaf_2.png';

export const ForgotPasswordForm: React.FC = () => {
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo') || '/login';
  const initialEmail = searchParams.get('email') || '';

  const [email, setEmail] = useState(initialEmail);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Resend cooldown timer (60 seconds)
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (cooldown > 0) {
      timer = setTimeout(() => setCooldown((prev) => prev - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [cooldown]);

  const validateEmail = (val: string): boolean => {
    const trimmed = val.trim();
    if (!trimmed) {
      setError('Email address is required');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Please enter a valid email address');
      return false;
    }
    setError(null);
    return true;
  };

  const handleSendResetEmail = async (targetEmail: string) => {
    const cleanEmail = targetEmail.trim().toLowerCase();
    setIsLoading(true);
    setError(null);

    try {
      await authService.resetPassword(cleanEmail);
      setSubmittedEmail(cleanEmail);
      setIsSuccess(true);
      setCooldown(60);
      toast.success('Password reset link sent to your email!');
    } catch (err: any) {
      console.warn('[ForgotPassword] Firebase reset error:', err);
      const code = err?.code || '';
      if (code === 'auth/invalid-email') {
        setError('The email address entered is not valid.');
      } else if (code === 'auth/too-many-requests') {
        setError('Too many reset requests. Please wait a few moments before trying again.');
      } else if (code === 'auth/network-request-failed') {
        setError('Network error. Please check your internet connection and retry.');
      } else {
        // Generic safe user-facing message avoiding account enumeration
        setError('Unable to dispatch reset link. Please check your email or try again shortly.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateEmail(email)) return;
    if (isLoading) return;
    await handleSendResetEmail(email);
  };

  const handleResend = async () => {
    if (cooldown > 0 || isLoading || !submittedEmail) return;
    await handleSendResetEmail(submittedEmail);
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
          Secure Access
        </span>
        <span className="font-serif italic text-2xl xl:text-3xl text-[#7E746A] tracking-tight leading-tight">
          Peace of Mind
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
          to={returnTo} 
          className="inline-flex items-center space-x-1.5 text-xs font-bold text-[#657180] hover:text-[#17212B] transition-colors py-2 px-3.5 rounded-xl hover:bg-[#F3ECE5] border border-transparent hover:border-[#E8DED6]"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Login</span>
        </Link>
      </header>

      {/* ========================================================================= */}
      {/* 3. MAIN CONTENT: CENTERED CARD (520–540px)                                */}
      {/* ========================================================================= */}
      <main className="w-full max-w-6xl mx-auto px-6 py-8 md:py-12 flex flex-col items-center justify-center flex-1 relative z-10">
        
        <div className="max-w-[540px] w-full p-8 sm:p-10 bg-white border border-[#E8DED6] rounded-[24px] shadow-md relative overflow-hidden text-left">
          
          {!isSuccess ? (
            /* ── STATE A: FORGOT PASSWORD FORM ── */
            <>
              {/* Card Icon & Header */}
              <div className="space-y-3 text-center mb-7">
                <div className="w-14 h-14 bg-[#FCEDE7] rounded-2xl flex items-center justify-center mx-auto shadow-2xs">
                  <KeyRound className="w-7 h-7 text-[#D65336]" />
                </div>
                <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-[#17212B] tracking-tight">
                  Forgot your password?
                </h1>
                <p className="text-sm text-[#657180] font-normal leading-relaxed max-w-sm mx-auto">
                  Enter the email address associated with your account, and we'll send you a link to reset your password.
                </p>
              </div>

              {/* Error banner */}
              {error && (
                <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start space-x-2.5 text-xs text-red-700 animate-in fade-in duration-200">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span className="font-medium">{error}</span>
                </div>
              )}

              {/* Submission Form */}
              <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                <div className="space-y-1.5">
                  <label 
                    htmlFor="forgot-email" 
                    className="block text-xs font-bold uppercase tracking-wider text-[#17212B]"
                  >
                    Email Address
                  </label>
                  <div className="relative flex items-center">
                    <Mail className="w-4 h-4 text-[#8A817A] absolute left-3.5 pointer-events-none" />
                    <input
                      id="forgot-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      autoFocus
                      required
                      placeholder="e.g. marco@bellatavola.com"
                      value={email}
                      disabled={isLoading}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (error) setError(null);
                      }}
                      className={cn(
                        "w-full pl-10 pr-4 py-3 bg-white border border-[#E8DED6] text-[#17212B] rounded-xl text-sm placeholder-[#98A2B3] transition-all",
                        "focus:outline-none focus:border-[#D65336] focus:ring-2 focus:ring-[#D65336]/20",
                        "disabled:opacity-60 disabled:bg-[#F3ECE5]",
                        error ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : ""
                      )}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 px-6 bg-[#D65336] hover:bg-[#C2482D] active:scale-[0.99] text-white font-bold rounded-xl text-sm transition-all shadow-sm flex items-center justify-center space-x-2 disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Sending Reset Link...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Send Reset Link</span>
                    </>
                  )}
                </button>
              </form>

              {/* Secondary Navigation */}
              <div className="mt-8 pt-6 border-t border-[#E8DED6] text-center">
                <p className="text-xs text-[#657180]">
                  Remember your password?{' '}
                  <Link 
                    to={returnTo} 
                    className="font-bold text-[#D65336] hover:underline"
                  >
                    Back to Sign In
                  </Link>
                </p>
              </div>
            </>
          ) : (
            /* ── STATE B: EMAIL DISPATCHED CONFIRMATION ── */
            <div className="space-y-6 text-center animate-in fade-in duration-300">
              <div className="w-16 h-16 bg-[#E8F5EF] rounded-2xl flex items-center justify-center mx-auto shadow-2xs border border-[#C6E6D6]">
                <CheckCircle2 className="w-8 h-8 text-[#087B5B]" />
              </div>

              <div className="space-y-2">
                <span className="inline-block px-3 py-1 bg-[#E8F5EF] text-[#087B5B] text-[11px] font-bold rounded-full uppercase tracking-wider border border-[#C6E6D6]">
                  Check Your Inbox
                </span>
                <h2 className="text-2xl font-display font-extrabold text-[#17212B] tracking-tight">
                  Reset link dispatched!
                </h2>
                <p className="text-sm text-[#657180] max-w-sm mx-auto leading-relaxed">
                  We've sent a password reset link to:
                </p>
                <div className="inline-block py-1.5 px-3.5 bg-[#FCFAF7] border border-[#E8DED6] rounded-xl text-xs font-mono font-bold text-[#17212B] break-all">
                  {submittedEmail}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#FCFAF7] border border-[#E8DED6] text-left space-y-2 text-xs text-[#657180]">
                <div className="flex items-center space-x-2 font-bold text-[#17212B]">
                  <ShieldCheck className="w-4 h-4 text-[#087B5B]" />
                  <span>Next Steps:</span>
                </div>
                <ul className="list-disc pl-4 space-y-1">
                  <li>Click the link inside the email to set your new password.</li>
                  <li>The link is secure and valid for a limited time.</li>
                  <li>Check your <strong>Spam</strong> or <strong>Promotions</strong> folder if you don't see it within a minute.</li>
                </ul>
              </div>

              {/* Resend Cooldown Action */}
              <div className="pt-2 flex flex-col items-center space-y-3">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={cooldown > 0 || isLoading}
                  className={cn(
                    "inline-flex items-center space-x-1.5 text-xs font-bold py-2 px-4 rounded-xl transition-all",
                    cooldown > 0 || isLoading
                      ? "text-[#8A817A] bg-slate-100 cursor-not-allowed"
                      : "text-[#D65336] hover:bg-[#FCEDE7] cursor-pointer"
                  )}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>
                    {cooldown > 0 ? `Resend link in ${cooldown}s` : 'Did not receive? Resend Link'}
                  </span>
                </button>

                <Link
                  to={returnTo}
                  className="w-full py-3 px-6 bg-[#17212B] hover:bg-[#23313F] text-white font-bold rounded-xl text-xs transition-all shadow-sm flex items-center justify-center space-x-2"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Return to Sign In</span>
                </Link>
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

export default ForgotPasswordForm;
