import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { ConfirmationResult } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../../shared/firebase/config';
import { authService } from '../../../services/authService';
import { RecaptchaManager } from '../../../shared/services/recaptchaManager';
import { zodResolver } from '../../../utils/zodResolver';
import { useToastStore } from '../../../components/ui/Toast/Toast';
import { cn } from '../../../utils/cn';
import { resolveAuthenticatedUser } from '../../../shared/services/roleResolver';

// Decorative food imagery
import leftPlateImg from '../../../assets/left_food_plate.png';
import rightPlateImg from '../../../assets/right_food_plate.png';
import basilLeaf1 from '../../../assets/basil_leaf_1.png';
import basilLeaf2 from '../../../assets/basil_leaf_2.png';

// Lucide icons
import { 
  Utensils, 
  ShieldAlert, 
  Eye, 
  EyeOff,
  TrendingUp,
  Settings,
  Heart,
  Leaf,
  Smartphone,
  Mail,
  Phone,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowLeft
} from 'lucide-react';

interface ICountryCode {
  code: string;
  country: string;
  flag: string;
  placeholder: string;
  maxLength: number;
}

const COUNTRY_CODES: ICountryCode[] = [
  { code: '+91', country: 'India', flag: '🇮🇳', placeholder: '98765 43210', maxLength: 10 },
  { code: '+1', country: 'USA / Canada', flag: '🇺🇸', placeholder: '202 555 0123', maxLength: 10 },
  { code: '+44', country: 'United Kingdom', flag: '🇬🇧', placeholder: '7911 123456', maxLength: 10 },
  { code: '+971', country: 'UAE', flag: '🇦🇪', placeholder: '50 123 4567', maxLength: 9 },
  { code: '+61', country: 'Australia', flag: '🇦🇺', placeholder: '412 345 678', maxLength: 9 },
  { code: '+65', country: 'Singapore', flag: '🇸🇬', placeholder: '8123 4567', maxLength: 8 },
  { code: '+966', country: 'Saudi Arabia', flag: '🇸🇦', placeholder: '50 123 4567', maxLength: 9 },
  { code: '+974', country: 'Qatar', flag: '🇶🇦', placeholder: '3312 3456', maxLength: 8 },
  { code: '+49', country: 'Germany', flag: '🇩🇪', placeholder: '151 12345678', maxLength: 11 },
  { code: '+33', country: 'France', flag: '🇫🇷', placeholder: '6 12 34 56 78', maxLength: 9 },
  { code: '+81', country: 'Japan', flag: '🇯🇵', placeholder: '90 1234 5678', maxLength: 10 },
  { code: '+60', country: 'Malaysia', flag: '🇲🇾', placeholder: '12 345 6789', maxLength: 10 },
  { code: '+64', country: 'New Zealand', flag: '🇳🇿', placeholder: '21 123 4567', maxLength: 9 }
];

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters')
});

type TLoginForm = z.infer<typeof loginSchema>;

export const CustomerLogin: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { addToast } = useToastStore();

  const getSuccessRedirect = () => {
    const from = (location.state as any)?.from;
    if (from?.pathname) {
      return `${from.pathname}${from.search || ''}`;
    }
    const searchParams = new URLSearchParams(location.search);
    const redirectParam = searchParams.get('redirect');
    if (redirectParam) {
      return redirectParam;
    }
    return '/customer/home';
  };

  // Primary authentication method is Mobile Number as requested
  const [authMethod, setAuthMethod] = useState<'phone' | 'email'>('phone');

  // Option A: Phone Number + OTP State
  const [phoneStep, setPhoneStep] = useState<'input' | 'verify'>('input');
  const [countryCode, setCountryCode] = useState('+91');
  const [rawPhoneNumber, setRawPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);

  // Lifecycle-safe reCAPTCHA manager instance
  const recaptchaManagerRef = useRef<RecaptchaManager | null>(null);
  const otpInputRef = useRef<HTMLInputElement | null>(null);

  // Option B: Email & Password State
  const [isSubmittingEmail, setIsSubmittingEmail] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorState, setErrorState] = useState<{ message: string; showRegister: boolean } | null>(null);

  const selectedCountry = COUNTRY_CODES.find(c => c.code === countryCode) || COUNTRY_CODES[0];

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<TLoginForm>({
    resolver: zodResolver(loginSchema)
  });

  // Initialize and clean up reCAPTCHA manager safely
  useEffect(() => {
    recaptchaManagerRef.current = new RecaptchaManager('customer-recaptcha-container');

    return () => {
      if (recaptchaManagerRef.current) {
        recaptchaManagerRef.current.destroy();
        recaptchaManagerRef.current = null;
      }
    };
  }, []);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  // Focus OTP input when transitioning to verify step
  useEffect(() => {
    if (phoneStep === 'verify') {
      setTimeout(() => {
        otpInputRef.current?.focus();
      }, 100);
    }
  }, [phoneStep]);

  // ---------------------------------------------------------------------------
  // PHONE AUTHENTICATION (DEFAULT/MAIN METHOD)
  // ---------------------------------------------------------------------------
  const cleanPhoneDigits = rawPhoneNumber.replace(/\D/g, '');

  const validatePhone = () => {
    if (!cleanPhoneDigits) {
      setPhoneError('Please enter your mobile number.');
      return false;
    }

    if (countryCode === '+91') {
      if (cleanPhoneDigits.length !== 10) {
        setPhoneError('Indian mobile numbers must be exactly 10 digits.');
        return false;
      }
      if (!/^[6-9]/.test(cleanPhoneDigits)) {
        setPhoneError('Valid Indian mobile numbers typically start with 6, 7, 8, or 9.');
        return false;
      }
    } else {
      if (cleanPhoneDigits.length < 6 || cleanPhoneDigits.length > 15) {
        setPhoneError(`Mobile number for ${selectedCountry.country} must be between 6 and 15 digits.`);
        return false;
      }
    }

    setPhoneError(null);
    return true;
  };

  const handleSendPhoneOtp = async (isResend = false) => {
    // Prevent duplicate requests in flight
    if (isSendingOtp) return;

    if (!validatePhone()) return;

    setPhoneError(null);
    setIsSendingOtp(true);

    const fullPhoneNumber = `${countryCode}${cleanPhoneDigits}`;
    console.log('[AUTH Customer Phone Login] Requesting OTP for:', `${countryCode} ******${cleanPhoneDigits.slice(-4)}`);

    try {
      if (!recaptchaManagerRef.current) {
        recaptchaManagerRef.current = new RecaptchaManager('customer-recaptcha-container');
      }

      // If resending, reset the existing widget without destroying the container
      if (isResend) {
        await recaptchaManagerRef.current.reset();
      }

      // Obtain the lifecycle-safe verifier (reuses existing instance when valid)
      const verifier = await recaptchaManagerRef.current.getVerifier({
        size: 'invisible',
        onExpired: () => {
          setPhoneError('Security verification expired. Please request OTP again.');
        },
        onError: (err) => {
          console.error('[Customer Phone Login] reCAPTCHA error callback:', err);
        }
      });

      if (!verifier) {
        setPhoneError('Security verification container is not ready. Please refresh the page.');
        setIsSendingOtp(false);
        return;
      }

      const result = await authService.signInWithPhone(fullPhoneNumber, verifier);
      setConfirmationResult(result);
      setPhoneStep('verify');
      setCooldown(30);
      setOtpCode('');
      addToast(isResend ? 'New verification code sent via SMS!' : `OTP sent to ${countryCode} ${cleanPhoneDigits}!`, 'success');
    } catch (err: any) {
      console.error('[AUTH Customer Send OTP Error]', err);
      let friendlyError = 'Failed to send OTP. Please check your network and try again.';

      if (err.code === 'auth/invalid-phone-number') {
        friendlyError = 'Invalid mobile phone number format. Please check the country code and number.';
      } else if (err.code === 'auth/too-many-requests') {
        friendlyError = 'Too many requests. Please wait a few minutes before trying again.';
      } else if (err.code === 'auth/quota-exceeded') {
        friendlyError = 'SMS quota exceeded for this Firebase project. Contact administrator.';
      } else if (err.code === 'auth/captcha-check-failed' || err.message?.includes('reCAPTCHA')) {
        friendlyError = 'Security verification failed. Please try again.';
        // Reset verifier so subsequent attempt has a clean challenge
        recaptchaManagerRef.current?.destroy();
      } else if (err.message) {
        friendlyError = err.message;
      }

      setPhoneError(friendlyError);
      addToast(friendlyError, 'error');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isVerifyingOtp) return;

    const cleanOtp = otpCode.trim();
    if (!cleanOtp || cleanOtp.length !== 6) {
      setPhoneError('Please enter the complete 6-digit verification code.');
      return;
    }

    if (!confirmationResult) {
      setPhoneError('Session expired. Please request a new OTP.');
      setPhoneStep('input');
      return;
    }

    setPhoneError(null);
    setIsVerifyingOtp(true);

    try {
      console.log('[AUTH Customer Phone Login] Verifying OTP...');
      const credentials = await authService.confirmPhoneOtp(confirmationResult, cleanOtp);
      const fUser = credentials.user;
      console.log('[AUTH Customer Phone Login] OTP verified. UID:', fUser.uid);

      // Check if this UID is associated with a restaurant owner/staff account
      const staffUserSnap = await getDoc(doc(db, 'users', fUser.uid));
      if (staffUserSnap.exists()) {
        const staffData = staffUserSnap.data();
        if (staffData.role && staffData.role !== 'customer') {
          console.warn('[AUTH Customer Login] Owner/Staff tried customer portal:', staffData.role);
          await authService.signOutUser();
          const mismatchMsg = 'This account has restaurant owner or staff clearance. Please sign in via the Owner or Staff portal.';
          setPhoneError(mismatchMsg);
          addToast(mismatchMsg, 'error');
          setIsVerifyingOtp(false);
          return;
        }
      }

      // Check or provision customer document in customers/{uid}
      const custDocRef = doc(db, 'customers', fUser.uid);
      const custSnap = await getDoc(custDocRef);

      if (custSnap.exists()) {
        const custData = custSnap.data();
        if (custData.status && custData.status !== 'active') {
          console.warn('[AUTH Customer Login] Suspended diner profile:', custData.status);
          await authService.signOutUser();
          setPhoneError('Your diner account has been suspended. Please contact support.');
          addToast('Your diner account is suspended.', 'error');
          setIsVerifyingOtp(false);
          return;
        }
      } else {
        // First-time mobile diner: auto-provision standard customer profile
        console.log('[AUTH Customer Login] Auto-provisioning diner profile for UID:', fUser.uid);
        const fullPhoneNumber = `${countryCode}${cleanPhoneDigits}`;
        await setDoc(custDocRef, {
          uid: fUser.uid,
          fullName: fUser.displayName || `Diner ${cleanPhoneDigits.slice(-4)}`,
          displayName: fUser.displayName || `Diner ${cleanPhoneDigits.slice(-4)}`,
          email: fUser.email || '',
          role: 'customer',
          tenantId: null,
          phoneNumber: fullPhoneNumber,
          walletBalance: 0,
          loyaltyPoints: 0,
          status: 'active',
          createdAt: new Date().toISOString()
        });
      }

      console.log('[AUTH Customer Phone Login] Successful customer sign-in. Navigating to destination.');
      addToast('Signed in successfully!', 'success');
      navigate(getSuccessRedirect(), { replace: true });
    } catch (err: any) {
      console.error('[AUTH Customer Phone Verify OTP Error]', err);
      let friendlyError = 'Failed to verify OTP. Please try again.';
      if (err.code === 'auth/invalid-verification-code') {
        friendlyError = 'The 6-digit OTP code entered is incorrect. Please check and re-enter.';
      } else if (err.code === 'auth/code-expired') {
        friendlyError = 'The verification code has expired. Please request a new code.';
      } else if (err.code === 'auth/too-many-requests') {
        friendlyError = 'Too many attempts. Please wait a few moments before trying again.';
      } else if (err.message) {
        friendlyError = err.message;
      }
      setPhoneError(friendlyError);
      addToast(friendlyError, 'error');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // ---------------------------------------------------------------------------
  // EMAIL & PASSWORD AUTHENTICATION (SECONDARY METHOD)
  // ---------------------------------------------------------------------------
  const onEmailSubmit = async (data: TLoginForm) => {
    const cleanEmail = data.email.trim().toLowerCase();
    console.log('[AUTH Customer Login] Email attempt started for:', cleanEmail);
    setIsSubmittingEmail(true);
    setErrorState(null);

    try {
      const credentials = await authService.signInWithEmail(cleanEmail, data.password, true);
      const fUser = credentials.user;

      const profile = await resolveAuthenticatedUser(fUser);

      if (!profile || profile.role !== 'customer') {
        console.warn('[AUTH Customer Login] Rejecting non-customer account:', profile?.role);
        await authService.signOutUser();
        const mismatchMsg = 'This account does not have access to the Customer Portal. Please sign in via the Staff or Owner portal.';
        setErrorState({
          message: mismatchMsg,
          showRegister: false
        });
        addToast(mismatchMsg, 'error');
        setIsSubmittingEmail(false);
        return;
      }

      if (profile.status && profile.status !== 'active') {
        console.warn('[AUTH Customer Login] Customer account suspended:', profile.status);
        await authService.signOutUser();
        setErrorState({
          message: 'Your diner account has been suspended. Please contact support.',
          showRegister: false
        });
        addToast('Your diner account is suspended.', 'error');
        setIsSubmittingEmail(false);
        return;
      }

      addToast('Signed in successfully!', 'success');
      navigate(getSuccessRedirect(), { replace: true });
    } catch (e: any) {
      console.error('[AUTH Customer Login] Authentication failed:', e);
      let errMsg = e.message || 'Login failed. Please verify credentials.';
      let isNotFound = false;

      if (e.code === 'auth/user-not-found' || e.message?.toLowerCase().includes('user not found')) {
        errMsg = 'Account not found';
        isNotFound = true;
      } else if (e.code === 'auth/wrong-password') {
        errMsg = 'Incorrect password. Please try again.';
      } else if (e.code === 'auth/invalid-credential') {
        errMsg = 'Account not found or invalid credentials.';
        isNotFound = true;
      } else if (e.code === 'auth/network-request-failed') {
        errMsg = 'Network error. Please check your connection.';
      }

      setErrorState({
        message: errMsg,
        showRegister: isNotFound
      });
      addToast(errMsg, 'error');
    } finally {
      setIsSubmittingEmail(false);
    }
  };

  const handleSwitchTab = (method: 'phone' | 'email') => {
    // When switching tabs, clean up reCAPTCHA verifier and DOM remnants safely
    if (recaptchaManagerRef.current) {
      recaptchaManagerRef.current.destroy();
    }
    setAuthMethod(method);
    setPhoneError(null);
    setErrorState(null);
  };

  return (
    <div className="min-h-screen bg-[#FCFAF7] text-[#17202A] flex flex-col justify-between relative overflow-x-hidden select-none font-sans">
      {/* 1. DECORATIVE BACKGROUND TREATMENT */}
      <div className="absolute top-[18%] left-[-160px] md:left-[-120px] lg:left-[-80px] w-[500px] md:w-[580px] h-[500px] md:h-[580px] rounded-full bg-[#F5ECE4]/80 blur-[2px] pointer-events-none z-0" />
      <div className="absolute bottom-[6%] right-[-160px] md:right-[-120px] lg:right-[-80px] w-[500px] md:w-[580px] h-[500px] md:h-[580px] rounded-full bg-[#F5ECE4]/80 blur-[2px] pointer-events-none z-0" />

      {/* LEFT SIDE: Food plate */}
      <div className="hidden sm:block absolute left-[-240px] md:left-[-220px] lg:left-[-190px] xl:left-[-150px] top-[22%] md:top-[24%] w-[420px] md:w-[480px] lg:w-[540px] pointer-events-none select-none z-0">
        <img 
          src={leftPlateImg} 
          alt="Gourmet Pasta Plate" 
          className="w-full h-auto drop-shadow-xl transform -rotate-12"
        />
      </div>

      {/* Left side basil */}
      <div className="hidden md:block absolute left-[220px] lg:left-[270px] top-[32%] w-10 h-10 pointer-events-none select-none z-0 transform rotate-45 opacity-90 drop-shadow-sm">
        <img src={basilLeaf2} alt="Fresh Basil Leaf" className="w-full h-full object-contain" />
      </div>

      {/* Left brand text */}
      <div className="hidden lg:flex flex-col items-start absolute left-8 xl:left-14 bottom-20 xl:bottom-28 pointer-events-none select-none z-0 -rotate-6">
        <span className="font-serif italic text-2xl xl:text-3xl text-[#7E746A] tracking-tight leading-tight">
          Better Food
        </span>
        <span className="font-serif italic text-2xl xl:text-3xl text-[#7E746A] tracking-tight leading-tight">
          Happier People
        </span>
        <div className="w-24 h-0.5 bg-[#D65336]/60 rounded-full mt-1.5 -rotate-2" />
      </div>

      {/* RIGHT SIDE: Food plate */}
      <div className="hidden sm:block absolute right-[-240px] md:right-[-220px] lg:right-[-190px] xl:right-[-150px] bottom-[10%] md:bottom-[12%] w-[420px] md:w-[480px] lg:w-[540px] pointer-events-none select-none z-0">
        <img 
          src={rightPlateImg} 
          alt="Artisanal Salmon Dish" 
          className="w-full h-auto drop-shadow-xl transform rotate-6"
        />
      </div>

      {/* Right side basil */}
      <div className="hidden md:block absolute right-[230px] lg:right-[280px] bottom-[44%] w-11 h-11 pointer-events-none select-none z-0 transform -rotate-12 opacity-90 drop-shadow-sm">
        <img src={basilLeaf1} alt="Fresh Basil Leaf" className="w-full h-full object-contain" />
      </div>

      {/* Right brand text */}
      <div className="hidden lg:flex flex-col items-start absolute right-10 xl:right-16 top-24 xl:top-32 pointer-events-none select-none z-0 -rotate-6">
        <span className="font-serif italic text-2xl xl:text-3xl text-[#7E746A] tracking-tight leading-tight">
          Good Food
        </span>
        <span className="font-serif italic text-2xl xl:text-3xl text-[#7E746A] tracking-tight leading-tight">
          Brings People Together
        </span>
        <div className="w-28 h-0.5 bg-[#D65336]/60 rounded-full mt-1.5 -rotate-2" />
      </div>

      {/* 2. TOP BRANDING HEADER */}
      <header className="w-full max-w-6xl mx-auto px-6 py-5 flex items-center justify-between relative z-20">
        <Link to="/" className="flex items-center space-x-3.5 group cursor-pointer select-none">
          <div className="w-10 h-10 bg-[#D65336] group-hover:bg-[#B9432D] transition-colors rounded-xl flex items-center justify-center shadow-xs">
            <span className="text-white font-extrabold text-xl font-display leading-none">S</span>
          </div>
          <div>
            <span className="font-display font-extrabold text-xl tracking-tight text-[#17202A]">
              Spiral <span className="text-[#D65336]">Dine</span>
            </span>
            <p className="text-[10px] font-semibold text-[#8A817A] hidden sm:block leading-none mt-0.5">
              Smart Dining. Smarter Business.
            </p>
          </div>
        </Link>

        <Link 
          to="/" 
          className="inline-flex items-center space-x-1 text-xs font-bold text-[#667085] hover:text-[#17202A] transition-colors py-2 px-3.5 rounded-xl hover:bg-[#F7F0EA]"
        >
          <span>← Back to Home</span>
        </Link>
      </header>

      {/* 3. MAIN CONTENT: CENTERED LOGIN CARD */}
      <main className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 md:py-10 flex flex-col items-center justify-center flex-1 relative z-10 space-y-8">
        
        {/* Centered White Card */}
        <div className="max-w-md w-full p-6 sm:p-8 md:p-10 bg-white border border-[#E9DED6] rounded-[24px] shadow-md relative overflow-hidden text-left">
          
          {/* Card Icon & Header */}
          <div className="space-y-3 text-center mb-6">
            <div className="w-14 h-14 bg-[#FCEDE7] rounded-2xl flex items-center justify-center mx-auto shadow-2xs">
              <Utensils className="w-7 h-7 text-[#D65336]" />
            </div>
            <h1 className="text-2xl font-display font-extrabold text-[#17202A] tracking-tight">
              Diner Sign In
            </h1>
            <p className="text-xs text-[#667085] font-normal leading-relaxed">
              Sign in to check recent orders, reservations, and saved dining profiles.
            </p>
          </div>

          {/* Login Method Switcher Tabs (Mobile Number is Primary) */}
          <div className="flex bg-[#F7F2ED] p-1.5 rounded-2xl mb-6 border border-[#E8DED6]">
            <button
              type="button"
              id="customer-tab-phone-login"
              onClick={() => handleSwitchTab('phone')}
              className={cn(
                "flex-1 py-2.5 px-3 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center justify-center space-x-2 cursor-pointer",
                authMethod === 'phone'
                  ? "bg-white text-[#17202A] shadow-xs"
                  : "text-[#667085] hover:text-[#17202A]"
              )}
            >
              <Smartphone className={cn("w-4 h-4", authMethod === 'phone' ? "text-[#D65336]" : "text-[#8A94A3]")} />
              <span>Mobile Number</span>
            </button>
            <button
              type="button"
              id="customer-tab-email-login"
              onClick={() => handleSwitchTab('email')}
              className={cn(
                "flex-1 py-2.5 px-3 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center justify-center space-x-2 cursor-pointer",
                authMethod === 'email'
                  ? "bg-white text-[#17202A] shadow-xs"
                  : "text-[#667085] hover:text-[#17202A]"
              )}
            >
              <Mail className={cn("w-4 h-4", authMethod === 'email' ? "text-[#D65336]" : "text-[#8A94A3]")} />
              <span>Email & Password</span>
            </button>
          </div>

          {/* METHOD 1: MOBILE NUMBER & OTP (DEFAULT / MAIN) */}
          {authMethod === 'phone' && (
            <div className="space-y-4">
              {/* Step 1: Mobile Number Entry */}
              {phoneStep === 'input' && (
                <div className="space-y-4">
                  <div className="w-full flex flex-col space-y-1.5 text-left">
                    <label htmlFor="customer-phone-input" className="text-xs font-bold text-[#17202A] select-none">
                      Mobile Number
                    </label>
                    <div className="flex space-x-2">
                      {/* Country Code Selector */}
                      <div className="relative min-w-[110px] sm:min-w-[125px]">
                        <select
                          id="customer-country-code-select"
                          value={countryCode}
                          onChange={(e) => {
                            setCountryCode(e.target.value);
                            setPhoneError(null);
                          }}
                          disabled={isSendingOtp}
                          className="w-full py-3 px-2.5 sm:px-3 bg-white border border-[#E8DED6] text-[#17202A] rounded-xl text-sm font-semibold transition-all focus:outline-none focus:border-[#D65336] focus:ring-2 focus:ring-[#D65336]/20 disabled:opacity-60 disabled:bg-[#F3ECE5] cursor-pointer"
                        >
                          {COUNTRY_CODES.map((c) => (
                            <option key={`${c.code}-${c.country}`} value={c.code}>
                              {c.flag} {c.code}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Phone Input */}
                      <div className="relative flex-1 flex items-center">
                        <Phone className="w-4 h-4 text-[#8A94A3] absolute left-3.5 pointer-events-none" />
                        <input
                          id="customer-phone-input"
                          type="tel"
                          inputMode="numeric"
                          placeholder={selectedCountry.placeholder}
                          value={rawPhoneNumber}
                          onChange={(e) => {
                            setRawPhoneNumber(e.target.value);
                            if (phoneError) setPhoneError(null);
                          }}
                          disabled={isSendingOtp}
                          className={cn(
                            "w-full pl-10 pr-4 py-3 bg-white border border-[#E8DED6] text-[#17202A] rounded-xl text-sm font-medium placeholder-[#8A94A3] transition-all focus:outline-none focus:border-[#D65336] focus:ring-2 focus:ring-[#D65336]/20 disabled:opacity-60 disabled:bg-[#F3ECE5]",
                            phoneError ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : ""
                          )}
                        />
                      </div>
                    </div>

                    <p className="text-[11px] text-[#8A817A] pt-0.5">
                      We'll send a 6-digit one-time verification code via SMS to verify your phone.
                    </p>

                    {phoneError && (
                      <div className="flex items-start space-x-1.5 text-xs font-semibold text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200 mt-1">
                        <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                        <span>{phoneError}</span>
                      </div>
                    )}
                  </div>

                  {/* Send OTP Button */}
                  <button
                    type="button"
                    id="btn-customer-send-otp"
                    onClick={() => handleSendPhoneOtp(false)}
                    disabled={isSendingOtp || !cleanPhoneDigits}
                    className="w-full h-12 mt-2 bg-[#D65336] hover:bg-[#B9432D] active:bg-[#A83C27] text-white font-bold text-sm rounded-xl flex items-center justify-center space-x-2 shadow-xs hover:shadow transition-all disabled:opacity-60 disabled:cursor-not-allowed group cursor-pointer"
                  >
                    {isSendingOtp ? (
                      <div className="flex items-center space-x-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Sending Verification Code...</span>
                      </div>
                    ) : (
                      <>
                        <span>Send One-Time Password (OTP)</span>
                        <span className="transition-transform group-hover:translate-x-1 font-bold">→</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Step 2: OTP Verification Input */}
              {phoneStep === 'verify' && (
                <form onSubmit={handleVerifyPhoneOtp} className="space-y-4">
                  {/* Sent info banner */}
                  <div className="flex items-center justify-between p-3 bg-[#F7F2ED] border border-[#E8DED6] rounded-xl text-xs">
                    <div className="flex items-center space-x-2 text-[#17202A]">
                      <CheckCircle2 className="w-4 h-4 text-[#16815F] shrink-0" />
                      <span>Code sent to <strong className="font-mono">{countryCode} {cleanPhoneDigits}</strong></span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPhoneStep('input')}
                      className="text-[#D65336] hover:text-[#B9432D] font-bold hover:underline cursor-pointer"
                    >
                      Change
                    </button>
                  </div>

                  {/* OTP 6-digit input */}
                  <div className="w-full flex flex-col space-y-1.5 text-left">
                    <label htmlFor="customer-otp-input" className="text-xs font-bold text-[#17202A] select-none">
                      Enter 6-Digit Verification Code
                    </label>
                    <input
                      ref={otpInputRef}
                      id="customer-otp-input"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      placeholder="• • • • • •"
                      value={otpCode}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                        setOtpCode(val);
                        if (phoneError) setPhoneError(null);
                      }}
                      disabled={isVerifyingOtp}
                      className={cn(
                        "w-full text-center tracking-[0.6em] text-2xl font-mono py-3 px-4 bg-white border border-[#E8DED6] rounded-xl text-[#17202A] transition-all focus:outline-none focus:border-[#D65336] focus:ring-2 focus:ring-[#D65336]/20 disabled:opacity-60 disabled:bg-[#F3ECE5]",
                        phoneError ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : ""
                      )}
                    />

                    {phoneError && (
                      <div className="flex items-start space-x-1.5 text-xs font-semibold text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200 mt-1">
                        <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                        <span>{phoneError}</span>
                      </div>
                    )}
                  </div>

                  {/* Resend Cooldown */}
                  <div className="flex justify-between items-center text-xs pt-0.5">
                    <span className="text-[#8A817A]">Didn't receive SMS code?</span>
                    {cooldown > 0 ? (
                      <span className="text-[#8A817A] font-semibold flex items-center space-x-1">
                        <RefreshCw className="w-3 h-3 animate-spin text-[#8A817A]" />
                        <span>Resend in {cooldown}s</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSendPhoneOtp(true)}
                        disabled={isSendingOtp}
                        className="text-[#D65336] hover:text-[#B9432D] font-bold hover:underline cursor-pointer disabled:opacity-50"
                      >
                        Resend OTP
                      </button>
                    )}
                  </div>

                  {/* Verify & Sign In Button */}
                  <button
                    type="submit"
                    id="btn-customer-verify-otp"
                    disabled={isVerifyingOtp || otpCode.trim().length !== 6}
                    className="w-full h-12 mt-2 bg-[#D65336] hover:bg-[#B9432D] active:bg-[#A83C27] text-white font-bold text-sm rounded-xl flex items-center justify-center space-x-2 shadow-xs hover:shadow transition-all disabled:opacity-60 disabled:cursor-not-allowed group cursor-pointer"
                  >
                    {isVerifyingOtp ? (
                      <div className="flex items-center space-x-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Verifying & Signing In...</span>
                      </div>
                    ) : (
                      <>
                        <span>Verify & Sign In</span>
                        <span className="transition-transform group-hover:translate-x-1 font-bold">→</span>
                      </>
                    )}
                  </button>

                  {/* Back to Number Button */}
                  <button
                    type="button"
                    onClick={() => setPhoneStep('input')}
                    disabled={isVerifyingOtp}
                    className="w-full py-2 text-xs font-semibold text-[#667085] hover:text-[#17202A] flex items-center justify-center space-x-1 transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to enter different number</span>
                  </button>
                </form>
              )}
            </div>
          )}

          {/* METHOD 2: EMAIL AND PASSWORD */}
          {authMethod === 'email' && (
            <form onSubmit={handleSubmit(onEmailSubmit)} className="space-y-4">
              {/* Error Alert Display */}
              {errorState && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex flex-col space-y-2 text-xs text-red-700 font-semibold mb-3">
                  <div className="flex items-start space-x-2">
                    <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                    <span>{errorState.message}</span>
                  </div>
                  {errorState.showRegister && (
                    <div className="pt-2 border-t border-red-100 flex justify-end">
                      <button 
                        type="button"
                        onClick={() => navigate('/customer/register')}
                        className="bg-[#D65336] hover:bg-[#B9432D] text-white text-[11px] py-1.5 px-3 font-bold rounded-lg transition-colors cursor-pointer"
                      >
                        Register Account
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Email Field */}
              <div className="w-full flex flex-col space-y-1.5 text-left">
                <label htmlFor="customer-email" className="text-xs font-bold text-[#17202A] select-none">
                  Email Address
                </label>
                <div className="relative flex items-center">
                  <Mail className="w-4 h-4 text-[#8A94A3] absolute left-3.5 pointer-events-none" />
                  <input
                    id="customer-email"
                    type="email"
                    placeholder="diner@gmail.com"
                    disabled={isSubmittingEmail}
                    className={cn(
                      "w-full pl-10 pr-4 py-3 bg-white border border-[#E1D9D2] text-[#17202A] rounded-xl text-sm placeholder-[#8A94A3] transition-all focus:outline-none focus:border-[#D65336] focus:ring-2 focus:ring-[#D65336]/20 disabled:opacity-60 disabled:bg-[#F7F0EA]",
                      errors.email ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : ""
                    )}
                    {...register('email')}
                  />
                </div>
                {errors.email?.message && (
                  <span className="text-xs font-semibold text-red-600 pl-1">{errors.email.message}</span>
                )}
              </div>

              {/* Password Field */}
              <div className="w-full flex flex-col space-y-1.5 text-left">
                <label htmlFor="customer-password" className="text-xs font-bold text-[#17202A] select-none">
                  Password
                </label>
                <div className="relative flex items-center">
                  <input
                    id="customer-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    disabled={isSubmittingEmail}
                    className={cn(
                      "w-full pl-4 pr-12 py-3 bg-white border border-[#E1D9D2] text-[#17202A] rounded-xl text-sm placeholder-[#8A94A3] transition-all focus:outline-none focus:border-[#D65336] focus:ring-2 focus:ring-[#D65336]/20 disabled:opacity-60 disabled:bg-[#F7F0EA]",
                      errors.password ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : ""
                    )}
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-[#8A94A3] hover:text-[#17202A] focus:outline-none focus:ring-2 focus:ring-[#D65336]/40 rounded-lg transition-colors cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {errors.password?.message && (
                  <span className="text-xs font-semibold text-red-600 pl-1">{errors.password.message}</span>
                )}
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="flex justify-between items-center text-xs pt-1">
                <label className="flex items-center space-x-2 text-[#17202A] font-semibold cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded border-[#E1D9D2] text-[#D65336] focus:ring-[#D65336]/30 accent-[#D65336] cursor-pointer" 
                  />
                  <span>Remember me</span>
                </label>
                <Link 
                  to="/forgot-password" 
                  className="text-[#D65336] hover:text-[#B9432D] font-bold hover:underline transition-colors"
                >
                  Forgot password?
                </Link>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                id="btn-customer-email-signin"
                disabled={isSubmittingEmail}
                className="w-full h-12 mt-3 bg-[#D65336] hover:bg-[#B9432D] active:bg-[#A83C27] text-white font-bold text-sm rounded-xl flex items-center justify-center space-x-2 shadow-xs hover:shadow transition-all disabled:opacity-60 disabled:cursor-not-allowed group cursor-pointer"
              >
                {isSubmittingEmail ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Sign In as Customer</span>
                    <span className="transition-transform group-hover:translate-x-1 font-bold">→</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* Dedicated invisible container for Firebase phone auth reCAPTCHA */}
          <div id="customer-recaptcha-container" className="empty:hidden my-2 flex justify-center" />

          {/* Footer inside Card */}
          <div className="text-center mt-6 pt-5 border-t border-[#E9DED6] text-xs space-y-2.5">
            <p className="text-[#667085] font-medium">
              New to Spiral Dine?{' '}
              <Link to="/customer/register" className="text-[#D65336] hover:text-[#B9432D] font-bold hover:underline">
                Register Customer Account
              </Link>
            </p>
            <p>
              <Link to="/" className="text-[#8A817A] hover:text-[#17202A] font-medium transition-colors">
                ← Back to choosing experience
              </Link>
            </p>
          </div>
        </div>

        {/* Subtle Bottom Value Strip on Desktop */}
        <div className="w-full max-w-3xl hidden md:block pt-2">
          <div className="grid grid-cols-4 gap-4 text-left">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#FCEDE7] text-[#D65336] flex items-center justify-center shrink-0">
                <TrendingUp className="w-3.5 h-3.5" />
              </div>
              <div>
                <h4 className="text-[11px] font-bold text-[#17202A]">More Orders</h4>
                <p className="text-[10px] text-[#667085]">Instant table ordering</p>
              </div>
            </div>

            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#E8F5EF] text-[#087B5B] flex items-center justify-center shrink-0">
                <Settings className="w-3.5 h-3.5" />
              </div>
              <div>
                <h4 className="text-[11px] font-bold text-[#17202A]">Seamless Pay</h4>
                <p className="text-[10px] text-[#667085]">Fast, secure checkout</p>
              </div>
            </div>

            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#FCEDE7] text-[#D65336] flex items-center justify-center shrink-0">
                <Heart className="w-3.5 h-3.5" />
              </div>
              <div>
                <h4 className="text-[11px] font-bold text-[#17202A]">Loyalty Points</h4>
                <p className="text-[10px] text-[#667085]">Rewards on every meal</p>
              </div>
            </div>

            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#E8F5EF] text-[#087B5B] flex items-center justify-center shrink-0">
                <Leaf className="w-3.5 h-3.5" />
              </div>
              <div>
                <h4 className="text-[11px] font-bold text-[#17202A]">Fresh Dining</h4>
                <p className="text-[10px] text-[#667085]">Curated local menus</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* 4. MINIMALIST FOOTER */}
      <footer className="w-full border-t border-[#E8DED6] bg-[#F5ECE4]/60 relative z-20">
        <div className="max-w-6xl mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-medium text-[#8A817A]">
          <div>
            <span>&copy; {new Date().getFullYear()} Spiral Dine. All rights reserved.</span>
          </div>
          <div className="flex space-x-6">
            <a href="#" className="hover:text-[#17202A] transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-[#17202A] transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-[#17202A] transition-colors">Support Desk</a>
            <a href="#" className="hover:text-[#17202A] transition-colors">Contact Us</a>
          </div>
          <div>
            <span className="text-[11px] text-[#8A817A]">Diner Portal • Secure Auth</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default CustomerLogin;
