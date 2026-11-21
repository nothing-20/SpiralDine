import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ConfirmationResult, AuthCredential } from 'firebase/auth';
import { RecaptchaManager } from '../../../shared/services/recaptchaManager';
import { authService } from '../../../services/authService';
import { useToastStore } from '../../../components/ui/Toast/Toast';
import { getDashboardRoute } from '../../../utils/navigation';
import { cn } from '../../../utils/cn';
import { resolveAuthenticatedUser } from '../../../shared/services/roleResolver';
import GoogleSignInButton from '../../../components/ui/GoogleSignInButton';
import AccountLinkingModal from '../../../components/ui/AccountLinkingModal';

// Decorative food imagery
import leftPlateImg from '../../../assets/left_food_plate.png';
import rightPlateImg from '../../../assets/right_food_plate.png';
import basilLeaf1 from '../../../assets/basil_leaf_1.png';
import basilLeaf2 from '../../../assets/basil_leaf_2.png';

// Lucide icons
import { 
  Store, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  TrendingUp, 
  Settings, 
  Heart, 
  Leaf,
  Smartphone,
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Phone
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

export const LoginForm: React.FC = () => {
  const { addToast } = useToastStore();
  const navigate = useNavigate();

  // Active authentication method
  const [authMethod, setAuthMethod] = useState<'email' | 'phone'>('email');

  // Google Authentication State
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [unregisteredGoogleUser, setUnregisteredGoogleUser] = useState<{ email: string; displayName: string } | null>(null);
  const [linkingModalState, setLinkingModalState] = useState<{
    isOpen: boolean;
    email: string;
    credential: AuthCredential | null;
  }>({
    isOpen: false,
    email: '',
    credential: null
  });

  // Option A: Email & Password state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoadingEmail, setIsLoadingEmail] = useState(false);
  const [emailErrors, setEmailErrors] = useState<{ email?: string; password?: string }>({});

  // Option B: Mobile Number & OTP state
  const [phoneStep, setPhoneStep] = useState<'input' | 'verify'>('input');
  const [countryCode, setCountryCode] = useState('+91');
  const [rawPhoneNumber, setRawPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);

  const recaptchaManagerRef = useRef<RecaptchaManager | null>(null);
  const otpInputRef = useRef<HTMLInputElement | null>(null);

  // Selected country helper
  const selectedCountry = COUNTRY_CODES.find(c => c.code === countryCode) || COUNTRY_CODES[0];

  // Initialize and clean up reCAPTCHA manager safely
  useEffect(() => {
    recaptchaManagerRef.current = new RecaptchaManager('recaptcha-container');

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

  // Handle Google Redirect Result on mount (supporting mobile and popup-blocked browsers)
  useEffect(() => {
    let isMounted = true;
    const processGoogleRedirect = async () => {
      try {
        const result = await authService.getGoogleRedirectResult();
        if (result?.user && isMounted) {
          console.log('[AUTH Google Redirect] Processing returning user:', result.user.uid);
          setIsLoadingGoogle(true);
          const success = await handleAuthenticatedUser(result.user, 'google');
          if (!success && isMounted) {
            await authService.signOutUser();
            setUnregisteredGoogleUser({
              email: result.user.email || '',
              displayName: result.user.displayName || ''
            });
            setGoogleError(
              `No restaurant or staff account found for ${result.user.email || 'this Google account'}. If you are a restaurant owner, please register your restaurant first.`
            );
          }
        }
      } catch (err: any) {
        console.error('[AUTH Google Redirect Error]', err);
        if (isMounted) {
          if (err.code === 'auth/account-exists-with-different-credential') {
            const pendingCred = authService.getGoogleCredentialFromError(err);
            const collidingEmail = err.customData?.email || err.email || '';
            if (pendingCred && collidingEmail) {
              setLinkingModalState({
                isOpen: true,
                email: collidingEmail,
                credential: pendingCred
              });
            } else {
              setGoogleError('An account already exists with this email address using another sign-in method. Please sign in using email and password.');
            }
          } else if (
            err.code !== 'auth/popup-closed-by-user' && 
            err.code !== 'auth/cancelled-popup-request' &&
            err.code !== 'auth/argument-error' &&
            err.code !== 'auth/null-user'
          ) {
            setGoogleError(err.message || 'Google sign-in failed. Please try again.');
          }
        }
      } finally {
        if (isMounted) setIsLoadingGoogle(false);
      }
    };
    processGoogleRedirect();
    return () => {
      isMounted = false;
    };
  }, []);

  // Shared authoritative profile resolution and role routing
  const handleAuthenticatedUser = async (user: any, method: 'email' | 'phone' | 'google') => {
    const profile = await resolveAuthenticatedUser(user);

    if (!profile) {
      console.warn(`[AUTH ${method} Login] Profile missing or unassigned for UID:`, user.uid);
      await authService.signOutUser();
      const msg = method === 'phone'
        ? 'This mobile number is verified, but no authorized business or staff account is linked to it. If you have an email account, please sign in with your email or contact your administrator.'
        : method === 'google'
        ? 'No restaurant or staff account found for this Google account. Please register your restaurant first or accept a staff invitation.'
        : `Profile is missing or not configured for this account. No profile document found for UID: ${user.uid}.`;
      addToast(msg, 'error');
      if (method === 'phone') {
        setPhoneError(msg);
      } else if (method === 'google') {
        setGoogleError(msg);
      }
      return false;
    }

    if (profile.status && profile.status !== 'active') {
      console.warn(`[AUTH ${method} Login] Inactive/suspended account:`, profile.status);
      await authService.signOutUser();
      const msg = 'Your account is currently inactive or suspended. Please contact your restaurant administrator.';
      addToast(msg, 'error');
      if (method === 'phone') {
        setPhoneError(msg);
      } else if (method === 'google') {
        setGoogleError(msg);
      }
      return false;
    }

    if (profile.role === 'customer') {
      console.warn(`[AUTH ${method} Login] Customer account tried staff/owner portal:`, profile.role);
      await authService.signOutUser();
      const msg = 'This account is registered as a diner account. Please sign in via the Customer Portal.';
      addToast(msg, 'error');
      if (method === 'phone') {
        setPhoneError(msg);
      } else if (method === 'google') {
        setGoogleError(msg);
      }
      return false;
    }

    const destination = getDashboardRoute(profile.role);
    console.log(`[AUTH ${method} Login] Successful auth:`, {
      uid: user.uid,
      role: profile.role,
      tenantId: profile.tenantId,
      destination
    });

    addToast(`Welcome back, ${profile.displayName || 'User'}!`, 'success');
    navigate(destination, { replace: true });
    return true;
  };

  // ---------------------------------------------------------------------------
  // GOOGLE SIGN-IN HANDLER (POPUP WITH REDIRECT FALLBACK)
  // ---------------------------------------------------------------------------
  const handleGoogleSignIn = async () => {
    if (isLoadingGoogle || isLoadingEmail || isSendingOtp || isVerifyingOtp) return;

    setIsLoadingGoogle(true);
    setGoogleError(null);
    setUnregisteredGoogleUser(null);

    try {
      console.log('[AUTH Google Login] Initiating Google popup sign-in...');
      const cred = await authService.signInWithGoogle();
      const user = cred.user;
      console.log('[AUTH Google Login] Firebase Auth succeeded. UID:', user.uid);

      const success = await handleAuthenticatedUser(user, 'google');
      if (!success) {
        console.warn('[AUTH Google Login] User has no authorized restaurant or staff profile.');
        await authService.signOutUser();
        setUnregisteredGoogleUser({
          email: user.email || '',
          displayName: user.displayName || ''
        });
        setGoogleError(
          `No restaurant or staff account found for ${user.email || 'this Google account'}. If you are a restaurant owner, please register your restaurant first.`
        );
      }
    } catch (err: any) {
      console.error('[AUTH Google Login Error]', err);
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        console.log('[AUTH Google Login] Popup closed by user');
      } else if (err.code === 'auth/popup-blocked') {
        console.warn('[AUTH Google Login] Popup was blocked by browser. Falling back to redirect...');
        addToast('Popup was blocked by your browser. Redirecting to Google Sign-In...', 'info');
        try {
          await authService.signInWithGoogleRedirect();
          return;
        } catch (redirErr: any) {
          console.error('[AUTH Google Redirect Fallback Error]', redirErr);
          setGoogleError('Unable to open Google sign-in. Please check your browser popup settings.');
          addToast('Google Sign-In was blocked. Please allow popups or try again.', 'error');
        }
      } else if (err.code === 'auth/account-exists-with-different-credential') {
        const pendingCred = authService.getGoogleCredentialFromError(err);
        const collidingEmail = err.customData?.email || err.email || '';
        if (pendingCred && collidingEmail) {
          setLinkingModalState({
            isOpen: true,
            email: collidingEmail,
            credential: pendingCred
          });
        } else {
          const msg = 'An account already exists with this email address using another sign-in method. Please sign in with your email and password.';
          setGoogleError(msg);
          addToast(msg, 'error');
        }
      } else if (err.code === 'auth/unauthorized-domain') {
        const msg = 'This domain is not authorized in Firebase Authentication. Please add it to Firebase Console -> Authorized Domains.';
        setGoogleError(msg);
        addToast(msg, 'error');
      } else {
        const msg = err.code === 'auth/argument-error'
          ? 'Unable to initialize Google Sign-In in this browser. Please try again or use email login.'
          : (err.message || 'Failed to authenticate with Google. Please try again.');
        setGoogleError(msg);
        addToast(msg, 'error');
      }
    } finally {
      setIsLoadingGoogle(false);
    }
  };

  // ---------------------------------------------------------------------------
  // OPTION A: Email & Password Handler
  // ---------------------------------------------------------------------------
  const validateEmailForm = () => {
    const nextErrors: typeof emailErrors = {};
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      nextErrors.email = 'Email address is required';
    } else if (!/\S+@\S+\.\S+/.test(cleanEmail)) {
      nextErrors.email = 'Email format is invalid';
    }
    if (!password) {
      nextErrors.password = 'Password is required';
    } else if (password.length < 6) {
      nextErrors.password = 'Password must be at least 6 characters';
    }
    setEmailErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    console.log('[AUTH Owner Login] Email form submitted');
    if (!validateEmailForm()) return;

    setIsLoadingEmail(true);
    try {
      console.log('[AUTH Owner Login] Calling Firebase email authentication...');
      const credentials = await authService.signInWithEmail(cleanEmail, password, rememberMe);
      const user = credentials.user;
      console.log('[AUTH Owner Login] Firebase Auth succeeded. UID:', user.uid);

      await handleAuthenticatedUser(user, 'email');
    } catch (err: any) {
      console.error('[AUTH Owner Login Error]', err);
      let errorMsg = 'Authentication failed. Please verify credentials.';
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        errorMsg = 'Incorrect email or password. Please check your credentials.';
      } else if (err.code === 'auth/too-many-requests') {
        errorMsg = 'Too many failed login attempts. Please wait a few minutes or reset your password.';
      } else if (err.message) {
        errorMsg = err.message;
      }
      addToast(errorMsg, 'error');
    } finally {
      setIsLoadingEmail(false);
    }
  };

  // ---------------------------------------------------------------------------
  // OPTION B: Phone Number & OTP Handlers
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

  const handleSendOtp = async (isResend = false) => {
    // Prevent duplicate requests in flight
    if (isSendingOtp) return;

    if (!validatePhone()) return;

    setPhoneError(null);
    setIsSendingOtp(true);

    const fullPhoneNumber = `${countryCode}${cleanPhoneDigits}`;
    console.log('[AUTH Phone Login] Requesting OTP for:', `${countryCode} ******${cleanPhoneDigits.slice(-4)}`);

    try {
      if (!recaptchaManagerRef.current) {
        recaptchaManagerRef.current = new RecaptchaManager('recaptcha-container');
      }

      // If resending, reset the existing widget without destroying the container
      if (isResend) {
        await recaptchaManagerRef.current.reset();
      }

      // Obtain lifecycle-safe verifier (reuses existing instance when valid)
      const verifier = await recaptchaManagerRef.current.getVerifier({
        size: 'invisible',
        onExpired: () => {
          setPhoneError('Security verification expired. Please try requesting OTP again.');
        },
        onError: (err) => {
          console.error('[AUTH reCAPTCHA Error]', err);
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
      addToast(isResend ? 'New OTP sent via SMS!' : `OTP sent to ${countryCode} ${cleanPhoneDigits}!`, 'success');
    } catch (err: any) {
      console.error('[AUTH Phone Send OTP Error]', err);
      let friendlyError = 'Failed to send OTP. Please check your connection and try again.';
      if (err.code === 'auth/invalid-phone-number') {
        friendlyError = 'Invalid mobile phone number format. Please check the country code and number.';
      } else if (err.code === 'auth/too-many-requests') {
        friendlyError = 'Too many requests. Please wait a few minutes before requesting another OTP.';
      } else if (err.code === 'auth/quota-exceeded') {
        friendlyError = 'SMS quota exceeded for this Firebase project. Please contact system administration.';
      } else if (err.code === 'auth/captcha-check-failed' || err.message?.includes('reCAPTCHA')) {
        friendlyError = 'Security verification failed. Please try again.';
        recaptchaManagerRef.current?.destroy();
      } else if (err.code === 'auth/billing-not-enabled') {
        friendlyError = 'Phone authentication requires Firebase project SMS plan configuration.';
      } else if (err.message) {
        friendlyError = err.message;
      }
      setPhoneError(friendlyError);
      addToast(friendlyError, 'error');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
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
      console.log('[AUTH Phone Login] Verifying OTP...');
      const credentials = await authService.confirmPhoneOtp(confirmationResult, cleanOtp);
      const user = credentials.user;
      console.log('[AUTH Phone Login] OTP verified successfully. Firebase UID:', user.uid);

      await handleAuthenticatedUser(user, 'phone');
    } catch (err: any) {
      console.error('[AUTH Phone Verify OTP Error]', err);
      let friendlyError = 'Failed to verify OTP. Please try again.';
      if (err.code === 'auth/invalid-verification-code') {
        friendlyError = 'The 6-digit OTP code entered is incorrect. Please check the SMS and re-enter.';
      } else if (err.code === 'auth/code-expired') {
        friendlyError = 'The verification code has expired. Please click "Resend OTP" to request a fresh code.';
      } else if (err.code === 'auth/too-many-requests') {
        friendlyError = 'Too many incorrect attempts. Please wait a few minutes before trying again.';
      } else if (err.message) {
        friendlyError = err.message;
      }
      setPhoneError(friendlyError);
      addToast(friendlyError, 'error');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleBackToPhoneInput = () => {
    setPhoneStep('input');
    setOtpCode('');
    setPhoneError(null);
  };

  const handleSwitchMethod = (method: 'email' | 'phone') => {
    if (recaptchaManagerRef.current) {
      recaptchaManagerRef.current.destroy();
    }
    setAuthMethod(method);
    setPhoneError(null);
    setGoogleError(null);
    setEmailErrors({});
  };

  return (
    <div className="min-h-screen bg-[#FCFAF7] text-[#17212B] flex flex-col justify-between relative overflow-x-hidden select-none font-sans">
      {/* ========================================================================= */}
      {/* 1. DECORATIVE BACKGROUND TREATMENT (Z-INDEX 0, POINTER-EVENTS NONE)       */}
      {/* ========================================================================= */}

      {/* Subtle warm circular background ambient backdrops */}
      <div className="absolute top-[18%] left-[-160px] md:left-[-120px] lg:left-[-80px] w-[500px] md:w-[580px] h-[500px] md:h-[580px] rounded-full bg-[#F3ECE5]/80 blur-[2px] pointer-events-none z-0" />
      <div className="absolute bottom-[6%] right-[-160px] md:right-[-120px] lg:right-[-80px] w-[500px] md:w-[580px] h-[500px] md:h-[580px] rounded-full bg-[#F3ECE5]/80 blur-[2px] pointer-events-none z-0" />

      {/* LEFT SIDE: Food plate entering from left edge */}
      <div className="hidden sm:block absolute left-[-240px] md:left-[-220px] lg:left-[-190px] xl:left-[-150px] top-[22%] md:top-[24%] w-[420px] md:w-[480px] lg:w-[540px] pointer-events-none select-none z-0">
        <img 
          src={leftPlateImg} 
          alt="Artisanal Dining Dish" 
          className="w-full h-auto drop-shadow-xl transform -rotate-12"
        />
      </div>

      {/* Left side: Floating basil garnish */}
      <div className="hidden md:block absolute left-[220px] lg:left-[270px] top-[32%] w-10 h-10 pointer-events-none select-none z-0 transform rotate-45 opacity-90 drop-shadow-sm">
        <img src={basilLeaf2} alt="Fresh Basil Leaf" className="w-full h-full object-contain" />
      </div>

      {/* Left side: Handwritten style decorative brand phrase */}
      <div className="hidden lg:flex flex-col items-start absolute left-8 xl:left-14 bottom-20 xl:bottom-28 pointer-events-none select-none z-0 -rotate-6">
        <span className="font-serif italic text-2xl xl:text-3xl text-[#7E746A] tracking-tight leading-tight">
          Great Restaurants
        </span>
        <span className="font-serif italic text-2xl xl:text-3xl text-[#7E746A] tracking-tight leading-tight">
          Build Great Stories
        </span>
        <div className="w-24 h-0.5 bg-[#D65336]/60 rounded-full mt-1.5 -rotate-2" />
      </div>

      {/* RIGHT SIDE: Food plate entering from right edge */}
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

      {/* Right side: Handwritten style decorative brand phrase */}
      <div className="hidden lg:flex flex-col items-start absolute right-10 xl:right-16 top-24 xl:top-32 pointer-events-none select-none z-0 -rotate-6">
        <span className="font-serif italic text-2xl xl:text-3xl text-[#7E746A] tracking-tight leading-tight">
          Your Restaurant
        </span>
        <span className="font-serif italic text-2xl xl:text-3xl text-[#7E746A] tracking-tight leading-tight">
          Your Growth
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
          to="/" 
          className="inline-flex items-center space-x-1 text-xs font-bold text-[#657180] hover:text-[#17212B] transition-colors py-2 px-3.5 rounded-xl hover:bg-[#F3ECE5]"
        >
          <span>← Back to Home</span>
        </Link>
      </header>

      {/* ========================================================================= */}
      {/* 3. MAIN CONTENT: CENTERED LOGIN CARD (520–600px)                          */}
      {/* ========================================================================= */}
      <main className="w-full max-w-6xl mx-auto px-6 py-6 md:py-10 flex flex-col items-center justify-center flex-1 relative z-10 space-y-8">
        
        {/* Centered White Card */}
        <div className="max-w-[560px] w-full p-8 sm:p-10 bg-white border border-[#E8DED6] rounded-[24px] shadow-md relative overflow-hidden text-left">
          
          {/* Card Icon & Header */}
          <div className="space-y-3 text-center mb-6">
            <div className="w-14 h-14 bg-[#FCEDE7] rounded-2xl flex items-center justify-center mx-auto shadow-2xs">
              <Store className="w-7 h-7 text-[#D65336]" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-[#17212B] tracking-tight">
              Welcome Back to SpiralDine
            </h1>
            <p className="text-sm text-[#657180] font-normal leading-relaxed max-w-sm mx-auto">
              Sign in to access your restaurant workspace and manage your business.
            </p>
          </div>

          {/* Google Sign-In Option */}
          <div className="mb-6 space-y-3">
            <GoogleSignInButton
              id="btn-google-signin"
              onClick={handleGoogleSignIn}
              isLoading={isLoadingGoogle}
              disabled={isLoadingEmail || isSendingOtp || isVerifyingOtp}
              text="Sign in with Google"
            />

            {googleError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex flex-col space-y-2 text-xs text-red-700 font-semibold">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                  <span>{googleError}</span>
                </div>
                {unregisteredGoogleUser && (
                  <div className="pt-2 border-t border-red-100 flex justify-end">
                    <button
                      type="button"
                      onClick={() => navigate('/register', { 
                        state: { 
                          prefillEmail: unregisteredGoogleUser.email, 
                          prefillName: unregisteredGoogleUser.displayName 
                        } 
                      })}
                      className="bg-[#D65336] hover:bg-[#B9432C] text-white text-[11px] py-1.5 px-3 font-bold rounded-lg transition-colors cursor-pointer"
                    >
                      Register Restaurant with Google →
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Visual Divider */}
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#E8DED6]" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-3 bg-white text-[#8A817A] font-semibold">or continue with</span>
              </div>
            </div>
          </div>

          {/* Login Method Switcher Tabs */}
          <div className="flex bg-[#F7F2ED] p-1.5 rounded-2xl mb-6 border border-[#E8DED6]">
            <button
              type="button"
              id="tab-email-login"
              onClick={() => handleSwitchMethod('email')}
              className={cn(
                "flex-1 py-2.5 px-3 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center justify-center space-x-2 cursor-pointer",
                authMethod === 'email'
                  ? "bg-white text-[#17212B] shadow-xs"
                  : "text-[#657180] hover:text-[#17212B]"
              )}
            >
              <Mail className={cn("w-4 h-4", authMethod === 'email' ? "text-[#D65336]" : "text-[#8A94A3]")} />
              <span>Email & Password</span>
            </button>
            <button
              type="button"
              id="tab-phone-login"
              onClick={() => handleSwitchMethod('phone')}
              className={cn(
                "flex-1 py-2.5 px-3 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center justify-center space-x-2 cursor-pointer",
                authMethod === 'phone'
                  ? "bg-white text-[#17212B] shadow-xs"
                  : "text-[#657180] hover:text-[#17212B]"
              )}
            >
              <Smartphone className={cn("w-4 h-4", authMethod === 'phone' ? "text-[#D65336]" : "text-[#8A94A3]")} />
              <span>Mobile Number</span>
            </button>
          </div>

          {/* =================================================================== */}
          {/* OPTION A: EMAIL AND PASSWORD                                        */}
          {/* =================================================================== */}
          {authMethod === 'email' && (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              {/* Email Field */}
              <div className="w-full flex flex-col space-y-1.5 text-left">
                <label htmlFor="owner-email" className="text-xs font-bold text-[#17212B] select-none">
                  Email Address
                </label>
                <div className="relative flex items-center">
                  <Mail className="w-4 h-4 text-[#8A94A3] absolute left-3.5 pointer-events-none" />
                  <input
                    id="owner-email"
                    type="email"
                    placeholder="you@restaurant.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoadingEmail}
                    className={cn(
                      "w-full pl-10 pr-4 py-3 bg-white border border-[#E8DED6] text-[#17212B] rounded-xl text-sm placeholder-[#8A94A3] transition-all focus:outline-none focus:border-[#D65336] focus:ring-2 focus:ring-[#D65336]/20 disabled:opacity-60 disabled:bg-[#F3ECE5]",
                      emailErrors.email ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : ""
                    )}
                  />
                </div>
                {emailErrors.email && (
                  <span className="text-xs font-semibold text-red-600 pl-1">{emailErrors.email}</span>
                )}
              </div>

              {/* Password Field with Eye Visibility Toggle */}
              <div className="w-full flex flex-col space-y-1.5 text-left">
                <label htmlFor="owner-password" className="text-xs font-bold text-[#17212B] select-none">
                  Password
                </label>
                <div className="relative flex items-center">
                  <Lock className="w-4 h-4 text-[#8A94A3] absolute left-3.5 pointer-events-none" />
                  <input
                    id="owner-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoadingEmail}
                    className={cn(
                      "w-full pl-10 pr-12 py-3 bg-white border border-[#E8DED6] text-[#17212B] rounded-xl text-sm placeholder-[#8A94A3] transition-all focus:outline-none focus:border-[#D65336] focus:ring-2 focus:ring-[#D65336]/20 disabled:opacity-60 disabled:bg-[#F3ECE5]",
                      emailErrors.password ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : ""
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-[#8A94A3] hover:text-[#17212B] focus:outline-none focus:ring-2 focus:ring-[#D65336]/40 rounded-lg transition-colors cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {emailErrors.password && (
                  <span className="text-xs font-semibold text-red-600 pl-1">{emailErrors.password}</span>
                )}
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="flex justify-between items-center text-xs pt-1">
                <label className="flex items-center space-x-2 text-[#17212B] font-semibold cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    id="remember-me"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-[#E8DED6] text-[#D65336] focus:ring-[#D65336]/30 accent-[#D65336] cursor-pointer" 
                  />
                  <span>Remember me on this device</span>
                </label>
                <Link 
                  to="/forgot-password" 
                  className="text-[#D65336] hover:text-[#B9432C] font-bold hover:underline transition-colors"
                >
                  Forgot Password?
                </Link>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                id="btn-email-signin"
                disabled={isLoadingEmail}
                className="w-full h-12 mt-3 bg-[#D65336] hover:bg-[#B9432C] active:bg-[#A83C27] text-white font-bold text-sm rounded-xl flex items-center justify-center space-x-2 shadow-xs hover:shadow transition-all disabled:opacity-60 disabled:cursor-not-allowed group cursor-pointer"
              >
                {isLoadingEmail ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Sign In with Password</span>
                    <span className="transition-transform group-hover:translate-x-1 font-bold">→</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* =================================================================== */}
          {/* OPTION B: MOBILE NUMBER & OTP                                       */}
          {/* =================================================================== */}
          {authMethod === 'phone' && (
            <div className="space-y-4">
              {/* Step 1: Phone Number Input */}
              {phoneStep === 'input' && (
                <div className="space-y-4">
                  <div className="w-full flex flex-col space-y-1.5 text-left">
                    <label htmlFor="phone-number-input" className="text-xs font-bold text-[#17212B] select-none">
                      Mobile Number
                    </label>
                    <div className="flex space-x-2">
                      {/* Country Code Selector */}
                      <div className="relative min-w-[110px] sm:min-w-[130px]">
                        <select
                          id="country-code-select"
                          value={countryCode}
                          onChange={(e) => {
                            setCountryCode(e.target.value);
                            setPhoneError(null);
                          }}
                          disabled={isSendingOtp}
                          className="w-full py-3 px-2.5 sm:px-3 bg-white border border-[#E8DED6] text-[#17212B] rounded-xl text-sm font-semibold transition-all focus:outline-none focus:border-[#D65336] focus:ring-2 focus:ring-[#D65336]/20 disabled:opacity-60 disabled:bg-[#F3ECE5] cursor-pointer"
                        >
                          {COUNTRY_CODES.map((c) => (
                            <option key={`${c.code}-${c.country}`} value={c.code}>
                              {c.flag} {c.code}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Phone Number Input */}
                      <div className="relative flex-1 flex items-center">
                        <Phone className="w-4 h-4 text-[#8A94A3] absolute left-3.5 pointer-events-none" />
                        <input
                          id="phone-number-input"
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
                            "w-full pl-10 pr-4 py-3 bg-white border border-[#E8DED6] text-[#17212B] rounded-xl text-sm font-medium placeholder-[#8A94A3] transition-all focus:outline-none focus:border-[#D65336] focus:ring-2 focus:ring-[#D65336]/20 disabled:opacity-60 disabled:bg-[#F3ECE5]",
                            phoneError ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : ""
                          )}
                        />
                      </div>
                    </div>

                    <p className="text-[11px] text-[#8A817A] pt-0.5">
                      We'll send a 6-digit one-time verification code via SMS to this number.
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
                    id="btn-send-otp"
                    onClick={() => handleSendOtp(false)}
                    disabled={isSendingOtp || !cleanPhoneDigits}
                    className="w-full h-12 mt-2 bg-[#D65336] hover:bg-[#B9432C] active:bg-[#A83C27] text-white font-bold text-sm rounded-xl flex items-center justify-center space-x-2 shadow-xs hover:shadow transition-all disabled:opacity-60 disabled:cursor-not-allowed group cursor-pointer"
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
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  {/* Sent info banner with Change Number action */}
                  <div className="flex items-center justify-between p-3 bg-[#F7F2ED] border border-[#E8DED6] rounded-xl text-xs">
                    <div className="flex items-center space-x-2 text-[#17212B]">
                      <CheckCircle2 className="w-4 h-4 text-[#16815F] shrink-0" />
                      <span>Code sent to <strong className="font-mono">{countryCode} {cleanPhoneDigits}</strong></span>
                    </div>
                    <button
                      type="button"
                      onClick={handleBackToPhoneInput}
                      className="text-[#D65336] hover:text-[#B9432C] font-bold hover:underline cursor-pointer"
                    >
                      Change
                    </button>
                  </div>

                  {/* OTP 6-digit input */}
                  <div className="w-full flex flex-col space-y-1.5 text-left">
                    <label htmlFor="phone-otp-input" className="text-xs font-bold text-[#17212B] select-none">
                      Enter 6-Digit Verification Code
                    </label>
                    <input
                      ref={otpInputRef}
                      id="phone-otp-input"
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
                        "w-full text-center tracking-[0.6em] text-2xl font-mono py-3 px-4 bg-white border border-[#E8DED6] rounded-xl text-[#17212B] transition-all focus:outline-none focus:border-[#D65336] focus:ring-2 focus:ring-[#D65336]/20 disabled:opacity-60 disabled:bg-[#F3ECE5]",
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

                  {/* Resend OTP Cooldown */}
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
                        onClick={() => handleSendOtp(true)}
                        disabled={isSendingOtp}
                        className="text-[#D65336] hover:text-[#B9432C] font-bold hover:underline cursor-pointer disabled:opacity-50"
                      >
                        Resend OTP
                      </button>
                    )}
                  </div>

                  {/* Verify & Sign In Button */}
                  <button
                    type="submit"
                    id="btn-verify-otp"
                    disabled={isVerifyingOtp || otpCode.trim().length !== 6}
                    className="w-full h-12 mt-2 bg-[#D65336] hover:bg-[#B9432C] active:bg-[#A83C27] text-white font-bold text-sm rounded-xl flex items-center justify-center space-x-2 shadow-xs hover:shadow transition-all disabled:opacity-60 disabled:cursor-not-allowed group cursor-pointer"
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
                    onClick={handleBackToPhoneInput}
                    disabled={isVerifyingOtp}
                    className="w-full py-2 text-xs font-semibold text-[#657180] hover:text-[#17212B] flex items-center justify-center space-x-1 transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to enter different number</span>
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Invisible / Visible container for Firebase phone auth reCAPTCHA */}
          <div id="recaptcha-container" className="empty:hidden my-2 flex justify-center" />

          {/* Footer inside Card */}
          <div className="text-center mt-6 pt-5 border-t border-[#EEE6E0] text-xs">
            <p className="text-[#657180] font-medium">
              Don't have an account?{' '}
              <Link to="/register" className="text-[#D65336] hover:text-[#B9432C] font-bold hover:underline">
                Register Merchant
              </Link>
            </p>
          </div>
        </div>

        {/* Subtle Bottom Value Strip on Desktop */}
        <div className="w-full max-w-4xl hidden md:block pt-2">
          <div className="grid grid-cols-4 gap-4 text-left">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#FCEDE7] text-[#D65336] flex items-center justify-center shrink-0">
                <TrendingUp className="w-3.5 h-3.5" />
              </div>
              <div>
                <h4 className="text-[11px] font-bold text-[#17212B]">More Revenue</h4>
                <p className="text-[10px] text-[#657180]">Reach more customers</p>
              </div>
            </div>

            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#E7F5EF] text-[#16815F] flex items-center justify-center shrink-0">
                <Settings className="w-3.5 h-3.5" />
              </div>
              <div>
                <h4 className="text-[11px] font-bold text-[#17212B]">Smarter Operations</h4>
                <p className="text-[10px] text-[#657180]">Manage everything easily</p>
              </div>
            </div>

            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#FCEDE7] text-[#D65336] flex items-center justify-center shrink-0">
                <Heart className="w-3.5 h-3.5" />
              </div>
              <div>
                <h4 className="text-[11px] font-bold text-[#17212B]">Happier Guests</h4>
                <p className="text-[10px] text-[#657180]">Better dining experiences</p>
              </div>
            </div>

            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#E7F5EF] text-[#16815F] flex items-center justify-center shrink-0">
                <Leaf className="w-3.5 h-3.5" />
              </div>
              <div>
                <h4 className="text-[11px] font-bold text-[#17212B]">Sustainable Growth</h4>
                <p className="text-[10px] text-[#657180]">Built for the future</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ========================================================================= */}
      {/* 4. MINIMALIST FOOTER                                                      */}
      {/* ========================================================================= */}
      <footer className="w-full border-t border-[#E8DED6] bg-[#F3ECE5]/60 relative z-20">
        <div className="max-w-6xl mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-medium text-[#8A817A]">
          <div>
            <span>&copy; {new Date().getFullYear()} Spiral Dine. All rights reserved.</span>
          </div>
          <div className="flex space-x-6">
            <a href="#" className="hover:text-[#17212B] transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-[#17212B] transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-[#17212B] transition-colors">Support Desk</a>
            <a href="#" className="hover:text-[#17212B] transition-colors">Contact Us</a>
          </div>
          <div>
            <span className="text-[11px] text-[#8A817A]">Main Portal • Secure Two-Factor Auth</span>
          </div>
        </div>
      </footer>
      {/* Single Identity Account Linking Modal */}
      <AccountLinkingModal
        isOpen={linkingModalState.isOpen}
        email={linkingModalState.email}
        pendingCredential={linkingModalState.credential}
        onClose={() => setLinkingModalState({ isOpen: false, email: '', credential: null })}
        onSuccess={async (linkedUser) => {
          setLinkingModalState({ isOpen: false, email: '', credential: null });
          await handleAuthenticatedUser(linkedUser, 'google');
        }}
        portalName="SpiralDine Business Portal"
      />
    </div>
  );
};

export default LoginForm;
