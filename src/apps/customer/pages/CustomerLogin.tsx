import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../../../services/authService';
import { zodResolver } from '../../../utils/zodResolver';
import { useToastStore } from '../../../components/ui/Toast/Toast';
import { cn } from '../../../utils/cn';

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
  Leaf
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
        const mismatchMsg = 'This account does not have access to the Customer Portal. Please sign in via the Staff or Owner portal.';
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
    <div className="min-h-screen bg-[#FCFAF7] text-[#17202A] flex flex-col justify-between relative overflow-x-hidden select-none font-sans">
      {/* ========================================================================= */}
      {/* 1. DECORATIVE BACKGROUND TREATMENT (Z-INDEX 0, POINTER-EVENTS NONE)       */}
      {/* ========================================================================= */}

      {/* Subtle warm circular background ambient backdrops */}
      <div className="absolute top-[18%] left-[-160px] md:left-[-120px] lg:left-[-80px] w-[500px] md:w-[580px] h-[500px] md:h-[580px] rounded-full bg-[#F5ECE4]/80 blur-[2px] pointer-events-none z-0" />
      <div className="absolute bottom-[6%] right-[-160px] md:right-[-120px] lg:right-[-80px] w-[500px] md:w-[580px] h-[500px] md:h-[580px] rounded-full bg-[#F5ECE4]/80 blur-[2px] pointer-events-none z-0" />

      {/* LEFT SIDE: Food plate entering from left edge */}
      <div className="hidden sm:block absolute left-[-240px] md:left-[-220px] lg:left-[-190px] xl:left-[-150px] top-[22%] md:top-[24%] w-[420px] md:w-[480px] lg:w-[540px] pointer-events-none select-none z-0">
        <img 
          src={leftPlateImg} 
          alt="Gourmet Pasta Plate" 
          className="w-full h-auto drop-shadow-xl transform -rotate-12"
        />
      </div>

      {/* Left side: Floating basil garnish */}
      <div className="hidden md:block absolute left-[220px] lg:left-[270px] top-[32%] w-10 h-10 pointer-events-none select-none z-0 transform rotate-45 opacity-90 drop-shadow-sm">
        <img src={basilLeaf2} alt="Fresh Basil" className="w-full h-full object-contain" />
      </div>

      {/* Left side: Handwritten style decorative brand phrase */}
      <div className="hidden lg:flex flex-col items-start absolute left-8 xl:left-14 bottom-20 xl:bottom-28 pointer-events-none select-none z-0 -rotate-6">
        <span className="font-serif italic text-2xl xl:text-3xl text-[#7E746A] tracking-tight leading-tight">
          Better Food
        </span>
        <span className="font-serif italic text-2xl xl:text-3xl text-[#7E746A] tracking-tight leading-tight">
          Happier People
        </span>
        <div className="w-24 h-0.5 bg-[#D65336]/60 rounded-full mt-1.5 -rotate-2" />
      </div>

      {/* RIGHT SIDE: Food plate entering from right edge */}
      <div className="hidden sm:block absolute right-[-240px] md:right-[-220px] lg:right-[-190px] xl:right-[-150px] bottom-[10%] md:bottom-[12%] w-[420px] md:w-[480px] lg:w-[540px] pointer-events-none select-none z-0">
        <img 
          src={rightPlateImg} 
          alt="Artisanal Grilled Entree" 
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
          Good Food
        </span>
        <span className="font-serif italic text-2xl xl:text-3xl text-[#7E746A] tracking-tight leading-tight">
          Brings People Together
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


      {/* ========================================================================= */}
      {/* 3. MAIN CONTENT: CENTERED LOGIN CARD                                      */}
      {/* ========================================================================= */}
      <main className="w-full max-w-6xl mx-auto px-6 py-6 md:py-10 flex flex-col items-center justify-center flex-1 relative z-10 space-y-8">
        
        {/* Centered White Card */}
        <div className="max-w-md w-full p-8 md:p-10 bg-white border border-[#E9DED6] rounded-[24px] shadow-md relative overflow-hidden text-left">
          
          {/* Card Icon & Header */}
          <div className="space-y-3 text-center mb-7">
            <div className="w-14 h-14 bg-[#FCEDE7] rounded-2xl flex items-center justify-center mx-auto shadow-2xs">
              <Utensils className="w-7 h-7 text-[#D65336]" />
            </div>
            <h1 className="text-2xl font-display font-extrabold text-[#17202A] tracking-tight">
              Diner Sign In
            </h1>
            <p className="text-xs text-[#667085] font-normal leading-relaxed">
              Sign in to check recent orders and save dining profiles.
            </p>
          </div>

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
                  "w-full px-4 py-3 bg-white border border-[#E1D9D2] text-[#17202A] rounded-xl text-sm placeholder-[#8A94A3] transition-all focus:outline-none focus:border-[#D65336] focus:ring-2 focus:ring-[#D65336]/20 disabled:opacity-60 disabled:bg-[#F7F0EA]",
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
              disabled={isSubmitting}
              className="w-full h-12 mt-3 bg-[#D65336] hover:bg-[#B9432D] active:bg-[#A83C27] text-white font-bold text-sm rounded-xl flex items-center justify-center space-x-2 shadow-xs hover:shadow transition-all disabled:opacity-60 disabled:cursor-not-allowed group cursor-pointer"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Sign In as Customer</span>
                  <span className="transition-transform group-hover:translate-x-1 font-bold">→</span>
                </>
              )}
            </button>
          </form>

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
                <p className="text-[10px] text-[#667085]">Reach more customers</p>
              </div>
            </div>

            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#FCEDE7] text-[#D65336] flex items-center justify-center shrink-0">
                <Settings className="w-3.5 h-3.5" />
              </div>
              <div>
                <h4 className="text-[11px] font-bold text-[#17202A]">Smarter Operations</h4>
                <p className="text-[10px] text-[#667085]">Manage everything easily</p>
              </div>
            </div>

            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#FCEDE7] text-[#D65336] flex items-center justify-center shrink-0">
                <Heart className="w-3.5 h-3.5" />
              </div>
              <div>
                <h4 className="text-[11px] font-bold text-[#17202A]">Happier Guests</h4>
                <p className="text-[10px] text-[#667085]">Better dining experiences</p>
              </div>
            </div>

            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#FCEDE7] text-[#D65336] flex items-center justify-center shrink-0">
                <Leaf className="w-3.5 h-3.5" />
              </div>
              <div>
                <h4 className="text-[11px] font-bold text-[#17202A]">Sustainable Growth</h4>
                <p className="text-[10px] text-[#667085]">Built for the future</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ========================================================================= */}
      {/* 4. MINIMALIST FOOTER                                                      */}
      {/* ========================================================================= */}
      <footer className="w-full border-t border-[#E9DED6] bg-[#F7F0EA]/80 relative z-20">
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

