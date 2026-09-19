import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  ShieldCheck, 
  User, 
  Mail, 
  Lock, 
  KeyRound, 
  AlertCircle, 
  CheckCircle2, 
  ArrowRight, 
  Eye, 
  EyeOff,
  ShieldAlert
} from 'lucide-react';
import toast from 'react-hot-toast';

export const SuperAdminSetup: React.FC = () => {
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [setupKey, setSetupKey] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showSetupKey, setShowSetupKey] = useState(false);

  const [isCheckingStatus, setIsCheckingStatus] = useState(true);
  const [isSetupAlreadyCompleted, setIsSetupAlreadyCompleted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Check setup status on load
  useEffect(() => {
    let isMounted = true;
    const checkStatus = async () => {
      try {
        const res = await fetch('/api/super-admin/setup');
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.isSetupComplete) {
            setIsSetupAlreadyCompleted(true);
          }
        }
      } catch (err) {
        console.warn('[SuperAdminSetup] Could not verify setup status:', err);
      } finally {
        if (isMounted) {
          setIsCheckingStatus(false);
        }
      }
    };

    checkStatus();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanName = fullName.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanKey = setupKey.trim();

    // Client-side validations
    if (!cleanName) {
      setErrorMessage('Please enter your full administrator name.');
      return;
    }

    if (!cleanEmail) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(cleanEmail)) {
      setErrorMessage('Please provide a valid email format (e.g., admin@spiraldine.internal).');
      return;
    }

    if (!password) {
      setErrorMessage('Please create a secure password.');
      return;
    }

    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long for platform administrator accounts.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please verify both password entries.');
      return;
    }

    if (!cleanKey) {
      setErrorMessage('Setup Authorization Key is required.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/super-admin/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName: cleanName,
          email: cleanEmail,
          password,
          setupKey: cleanKey,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          setIsSetupAlreadyCompleted(true);
          setErrorMessage('Super Admin setup has already been completed.');
          toast.error('Super Admin setup has already been completed.');
        } else {
          setErrorMessage(data.error || 'Setup failed. Please check your credentials.');
          toast.error(data.error || 'Setup failed.');
        }
        setIsSubmitting(false);
        return;
      }

      // Success
      setIsSuccess(true);
      toast.success('Super Admin account created successfully.');
    } catch (err: any) {
      console.error('[SuperAdminSetup] Submission error:', err);
      const msg = 'Network or server error occurred. Please verify connectivity and try again.';
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FBF9F5] text-[#15211E] flex flex-col justify-center items-center p-4 sm:p-6 md:p-8 relative overflow-x-hidden selection:bg-[#12352D] selection:text-white">
      {/* Subtle organic background gradients */}
      <div 
        className="absolute top-0 right-0 w-[550px] h-[550px] rounded-full blur-[160px] pointer-events-none opacity-60"
        style={{ background: 'radial-gradient(circle, rgba(18,53,45,0.08) 0%, rgba(217,119,6,0.05) 100%)' }}
      />
      <div 
        className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full blur-[140px] pointer-events-none opacity-50"
        style={{ background: 'radial-gradient(circle, rgba(82,121,111,0.1) 0%, rgba(251,249,245,0) 100%)' }}
      />

      {/* Main Container */}
      <div className="w-full max-w-lg relative z-10 my-6">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#12352D] text-white shadow-md shadow-[#12352D]/15 mb-3.5">
            <ShieldCheck className="w-7 h-7 text-[#FBF9F5]" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#15211E] font-serif">
            SpiralDine
          </h1>
          <div className="inline-flex items-center mt-2 px-3 py-0.5 rounded-full bg-[#E8EDE9] border border-[#52796F]/20 text-[#12352D] text-[11px] font-semibold tracking-wider uppercase">
            Super Admin Setup
          </div>
        </div>

        {/* Card */}
        <div className="bg-white border border-[#E5E0D8] rounded-2xl p-6 sm:p-8 shadow-xl shadow-stone-200/50 backdrop-blur-sm">
          {/* STATE 1: Checking status loading */}
          {isCheckingStatus ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-8 h-8 rounded-full border-3 border-[#12352D] border-t-transparent animate-spin mx-auto" />
              <p className="text-xs text-[#606D67]">Verifying platform setup clearance...</p>
            </div>
          ) : isSetupAlreadyCompleted ? (
            /* STATE 2: Setup Already Completed */
            <div className="text-center py-4 space-y-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-50 border border-amber-200 text-amber-700 mb-1">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-[#15211E]">
                Super Admin setup is already complete.
              </h2>
              <p className="text-sm text-[#606D67] max-w-md mx-auto leading-relaxed">
                The initial platform administrator account has already been initialized and first-time setup is permanently closed for security.
              </p>
              <div className="pt-4">
                <button
                  type="button"
                  onClick={() => navigate('/super-admin/login')}
                  className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-2.5 rounded-xl bg-[#12352D] text-white font-medium text-sm hover:bg-[#1A473C] transition-colors shadow-md shadow-[#12352D]/15"
                >
                  <span>Return to Super Admin Login</span>
                  <ArrowRight className="w-4 h-4 ml-2" />
                </button>
              </div>
            </div>
          ) : isSuccess ? (
            /* STATE 3: Account Created Successfully */
            <div className="text-center py-4 space-y-4">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 mb-1">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h2 className="text-xl font-bold text-[#15211E]">
                Super Admin account created successfully.
              </h2>
              <p className="text-sm text-[#606D67] max-w-md mx-auto leading-relaxed">
                Your platform administrator account has been provisioned with full administrative privileges. Please sign in to access the Super Admin dashboard.
              </p>
              <div className="pt-4">
                <button
                  type="button"
                  onClick={() => navigate('/super-admin/login')}
                  className="w-full inline-flex items-center justify-center px-6 py-3 rounded-xl bg-[#12352D] text-white font-semibold text-sm hover:bg-[#1A473C] active:scale-[0.99] transition-all shadow-md shadow-[#12352D]/20"
                >
                  <span>Continue to Super Admin Login</span>
                  <ArrowRight className="w-4 h-4 ml-2" />
                </button>
              </div>
            </div>
          ) : (
            /* STATE 4: Setup Form */
            <>
              <div className="mb-6">
                <h2 className="text-xl font-bold text-[#15211E]">
                  Create your platform administrator
                </h2>
                <p className="text-xs sm:text-sm text-[#606D67] mt-1">
                  Set up the first Super Admin account for this SpiralDine platform.
                </p>
              </div>

              {/* Security Advisory */}
              <div className="mb-5 p-3.5 rounded-xl bg-[#F4EFE6] border border-[#E5E0D8] text-xs text-[#2B3B36] flex items-start space-x-2.5">
                <ShieldCheck className="w-4 h-4 shrink-0 text-[#12352D] mt-0.5" />
                <span className="leading-relaxed">
                  This setup is available only for the initial SpiralDine platform administrator.
                </span>
              </div>

              {/* Error Banner */}
              {errorMessage && (
                <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start space-x-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                  <span className="leading-relaxed">{errorMessage}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Full Name */}
                <div>
                  <label className="block text-xs font-semibold text-[#2B3B36] mb-1.5" htmlFor="sa-setup-name">
                    Administrator Name
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      id="sa-setup-name"
                      type="text"
                      autoComplete="name"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Platform Administrator"
                      className="w-full pl-10 pr-4 py-2.5 bg-[#FAF8F5] border border-[#E5E0D8] rounded-xl text-sm text-[#15211E] placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#12352D]/20 focus:border-[#12352D] transition-all"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-semibold text-[#2B3B36] mb-1.5" htmlFor="sa-setup-email">
                    Administrator Email
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      id="sa-setup-email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@spiraldine.internal"
                      className="w-full pl-10 pr-4 py-2.5 bg-[#FAF8F5] border border-[#E5E0D8] rounded-xl text-sm text-[#15211E] placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#12352D]/20 focus:border-[#12352D] transition-all"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                {/* Password Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Password */}
                  <div>
                    <label className="block text-xs font-semibold text-[#2B3B36] mb-1.5" htmlFor="sa-setup-password">
                      Password
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        id="sa-setup-password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Min 8 characters"
                        className="w-full pl-10 pr-9 py-2.5 bg-[#FAF8F5] border border-[#E5E0D8] rounded-xl text-sm text-[#15211E] placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#12352D]/20 focus:border-[#12352D] transition-all"
                        disabled={isSubmitting}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-stone-400 hover:text-stone-600 transition-colors"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label className="block text-xs font-semibold text-[#2B3B36] mb-1.5" htmlFor="sa-setup-confirm">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        id="sa-setup-confirm"
                        type={showConfirmPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter password"
                        className="w-full pl-10 pr-9 py-2.5 bg-[#FAF8F5] border border-[#E5E0D8] rounded-xl text-sm text-[#15211E] placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#12352D]/20 focus:border-[#12352D] transition-all"
                        disabled={isSubmitting}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-stone-400 hover:text-stone-600 transition-colors"
                        aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Setup Authorization Key */}
                <div className="pt-1">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-[#2B3B36]" htmlFor="sa-setup-key">
                      Setup Authorization Key
                    </label>
                    <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      Server Protected
                    </span>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                      <KeyRound className="w-4 h-4" />
                    </div>
                    <input
                      id="sa-setup-key"
                      type={showSetupKey ? 'text' : 'password'}
                      autoComplete="off"
                      required
                      value={setupKey}
                      onChange={(e) => setSetupKey(e.target.value)}
                      placeholder="Enter server setup key"
                      className="w-full pl-10 pr-9 py-2.5 bg-[#FAF8F5] border border-[#E5E0D8] rounded-xl text-sm text-[#15211E] placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#12352D]/20 focus:border-[#12352D] transition-all font-mono"
                      disabled={isSubmitting}
                    />
                    <button
                      type="button"
                      onClick={() => setShowSetupKey(!showSetupKey)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-stone-400 hover:text-stone-600 transition-colors"
                      aria-label={showSetupKey ? 'Hide setup key' : 'Show setup key'}
                    >
                      {showSetupKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full mt-3 py-3 px-4 rounded-xl bg-[#12352D] text-white font-semibold text-sm hover:bg-[#1A473C] focus:outline-none focus:ring-2 focus:ring-[#12352D]/30 active:scale-[0.99] transition-all flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#12352D]/20"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      <span>Creating platform administrator...</span>
                    </>
                  ) : (
                    <>
                      <span>Create Super Admin Account</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                {/* Security info */}
                <p className="text-[11px] text-[#606D67] text-center pt-2 leading-relaxed">
                  Your password is securely handled by Firebase Authentication. The setup authorization key is validated server-side.
                </p>
              </form>

              {/* Login Link */}
              <div className="mt-6 pt-5 border-t border-[#E5E0D8] text-center">
                <p className="text-xs text-[#606D67]">
                  Already configured?{' '}
                  <Link
                    to="/super-admin/login"
                    className="font-semibold text-[#12352D] hover:underline"
                  >
                    Return to Super Admin Login
                  </Link>
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SuperAdminSetup;
