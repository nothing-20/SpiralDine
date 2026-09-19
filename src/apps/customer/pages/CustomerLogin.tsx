import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../../../services/authService';
import { zodResolver } from '../../../utils/zodResolver';
import { useToastStore } from '../../../components/ui/Toast/Toast';
import { cn } from '../../../utils/cn';
import SharedAuthLayout from '../../../shared/ui/auth/SharedAuthLayout';

// Lucide icons
import { 
  Utensils, 
  ShieldAlert, 
  Eye, 
  EyeOff,
  ArrowRight
} from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters')
});

type TLoginForm = z.infer<typeof loginSchema>;

export const CustomerLogin: React.FC = () => {
  const navigate = useNavigate();
  const { addToast } = useToastStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorState, setErrorState] = useState<{ message: string; showRegister: boolean } | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<TLoginForm>({
    resolver: zodResolver(loginSchema)
  });

  const onSubmit = async (data: TLoginForm) => {
    const cleanEmail = data.email.trim().toLowerCase();
    console.log('[AUTH Customer Login] Login attempt started for:', cleanEmail);
    setIsSubmitting(true);
    setErrorState(null);

    try {
      console.log('[AUTH Customer Login] Calling Firebase authentication...');
      const credentials = await authService.signInWithEmail(cleanEmail, data.password, true);
      const fUser = credentials.user;

      console.log('[AUTH Customer Login] Firebase auth succeeded. UID:', fUser.uid);

      // Import authoritative role resolver
      const { resolveAuthenticatedUser } = await import('../../../shared/services/roleResolver');
      const profile = await resolveAuthenticatedUser(fUser);

      console.log('[AUTH Customer Login] Resolved profile:', profile);

      if (!profile || profile.role !== 'customer') {
        console.warn('[AUTH Customer Login] Rejecting non-customer account:', profile?.role);
        await authService.signOutUser();
        const mismatchMsg = 'This account does not have access to the Customer Portal. Please sign in via the Owner or Staff portal.';
        setErrorState({
          message: mismatchMsg,
          showRegister: false
        });
        addToast(mismatchMsg, 'error');
        setIsSubmitting(false);
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
        setIsSubmitting(false);
        return;
      }

      console.log('[AUTH Customer Login] Customer login successful. Navigating to /customer/home');
      addToast('Signed in successfully!', 'success');
      navigate('/customer/home', { replace: true });
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
      setIsSubmitting(false);
    }
  };

  return (
    <SharedAuthLayout
      roleVariant="customer"
      badgeLabel="Customer Experience"
      pageTitle="Customer Sign In"
      pageSubtitle="Sign in to view recent dining orders, saved menus &amp; profile."
      icon={<Utensils className="w-7 h-7 text-[#D65336]" />}
      cardMaxWidth="max-w-[500px]"
    >
      {/* Error Alert Display */}
      {errorState && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex flex-col space-y-2 text-xs text-red-700 font-semibold mb-5">
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

      {/* Login Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Email Field */}
        <div className="w-full flex flex-col space-y-1.5 text-left">
          <label htmlFor="customer-email" className="text-xs font-bold text-[#17202A] select-none">
            Email Address
          </label>
          <input
            id="customer-email"
            type="email"
            placeholder="diner@gmail.com"
            disabled={isSubmitting}
            className={cn(
              "w-full px-4 py-3 bg-[#FCFAF7] border border-[#E8DED6] text-[#17202A] rounded-xl text-sm placeholder-[#8A94A3] transition-all focus:outline-none focus:border-[#D65336] focus:ring-2 focus:ring-[#D65336]/20 disabled:opacity-60 disabled:bg-[#F5ECE4]",
              errors.email ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : ""
            )}
            {...register('email')}
          />
          {errors.email?.message && (
            <span className="text-xs font-semibold text-red-600 pl-1">{errors.email.message}</span>
          )}
        </div>

        {/* Password Field with Eye Visibility Toggle */}
        <div className="w-full flex flex-col space-y-1.5 text-left">
          <label htmlFor="customer-password" className="text-xs font-bold text-[#17202A] select-none">
            Password
          </label>
          <div className="relative flex items-center">
            <input
              id="customer-password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              disabled={isSubmitting}
              className={cn(
                "w-full pl-4 pr-12 py-3 bg-[#FCFAF7] border border-[#E8DED6] text-[#17202A] rounded-xl text-sm placeholder-[#8A94A3] transition-all focus:outline-none focus:border-[#D65336] focus:ring-2 focus:ring-[#D65336]/20 disabled:opacity-60 disabled:bg-[#F5ECE4]",
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
              className="w-4 h-4 rounded border-[#E8DED6] text-[#D65336] focus:ring-[#D65336]/30 accent-[#D65336] cursor-pointer" 
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
          disabled={isSubmitting}
          className="w-full h-12 mt-3 bg-[#D65336] hover:bg-[#B9432D] active:bg-[#A83C27] text-white font-bold text-sm rounded-xl flex items-center justify-center space-x-2 shadow-xs hover:shadow transition-all disabled:opacity-60 disabled:cursor-not-allowed group cursor-pointer"
        >
          {isSubmitting ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <span>Sign In as Customer</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </>
          )}
        </button>
      </form>

      {/* Footer inside Card */}
      <div className="text-center mt-6 pt-5 border-t border-[#E8DED6] text-xs space-y-2">
        <p className="text-[#667085] font-medium">
          New to Spiral Dine?{' '}
          <Link to="/customer/register" className="text-[#D65336] hover:text-[#B9432D] font-bold hover:underline">
            Register Customer Account
          </Link>
        </p>
        <p>
          <Link to="/login" className="text-[#8A817A] hover:text-[#17202A] font-medium transition-colors">
            ← Switch Portal
          </Link>
        </p>
      </div>
    </SharedAuthLayout>
  );
};

export default CustomerLogin;
