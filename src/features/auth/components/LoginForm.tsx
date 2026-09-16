import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../../../services/authService';
import { useToastStore } from '../../../components/ui/Toast/Toast';
import { getDashboardRoute } from '../../../utils/navigation';
import { cn } from '../../../utils/cn';

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
  ShieldAlert
} from 'lucide-react';

export const LoginForm: React.FC = () => {
  const { addToast } = useToastStore();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const validate = () => {
    const nextErrors: typeof errors = {};
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
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    console.log('[AUTH Owner Login] Form submitted for:', cleanEmail);
    if (!validate()) return;

    setIsLoading(true);
    try {
      console.log('[AUTH Owner Login] Calling Firebase authentication...');
      const credentials = await authService.signInWithEmail(cleanEmail, password, rememberMe);
      const user = credentials.user;
      console.log('[AUTH Owner Login] Firebase Auth succeeded. UID:', user.uid);

      // Authoritative profile resolution
      const { resolveAuthenticatedUser } = await import('../../../shared/services/roleResolver');
      const profile = await resolveAuthenticatedUser(user);

      if (!profile) {
        console.error('[AUTH Owner Login] Role/profile unresolved for UID:', user.uid);
        await authService.signOutUser();
        addToast(`Owner profile is missing or not configured. No profile document found for UID: ${user.uid} in users/${user.uid}.`, 'error');
        setIsLoading(false);
        return;
      }

      const allowedOwnerRoles = ['owner', 'admin', 'super-admin'];
      if (!allowedOwnerRoles.includes(profile.role)) {
        console.warn('[AUTH Owner Login] Mismatched account role:', profile.role);
        await authService.signOutUser();
        addToast('This account does not have access to the Owner Portal. Please use the Staff or Customer login.', 'error');
        setIsLoading(false);
        return;
      }

      const destination = getDashboardRoute(profile.role);
      console.log('[AUTH Owner Login] Successful auth. Details:', {
        uid: user.uid,
        email: cleanEmail,
        portal: 'OWNER',
        role: profile.role,
        tenantId: profile.tenantId,
        destination
      });

      addToast('Successfully authenticated to Owner Workspace!', 'success');
      navigate(destination, { replace: true });
    } catch (err: any) {
      console.error('[AUTH Owner Login Error]', err);
      addToast(err.message || 'Authentication failed. Please verify credentials.', 'error');
    } finally {
      setIsLoading(false);
    }
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
          <div className="space-y-3 text-center mb-8">
            <div className="w-14 h-14 bg-[#FCEDE7] rounded-2xl flex items-center justify-center mx-auto shadow-2xs">
              <Store className="w-7 h-7 text-[#D65336]" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-[#17212B] tracking-tight">
              Owner Sign In
            </h1>
            <p className="text-sm text-[#657180] font-normal leading-relaxed max-w-sm mx-auto">
              Access your restaurant dashboard and manage your business with ease.
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
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
                  disabled={isLoading}
                  className={cn(
                    "w-full pl-10 pr-4 py-3 bg-white border border-[#E8DED6] text-[#17212B] rounded-xl text-sm placeholder-[#8A94A3] transition-all focus:outline-none focus:border-[#D65336] focus:ring-2 focus:ring-[#D65336]/20 disabled:opacity-60 disabled:bg-[#F3ECE5]",
                    errors.email ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : ""
                  )}
                />
              </div>
              {errors.email && (
                <span className="text-xs font-semibold text-red-600 pl-1">{errors.email}</span>
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
                  disabled={isLoading}
                  className={cn(
                    "w-full pl-10 pr-12 py-3 bg-white border border-[#E8DED6] text-[#17212B] rounded-xl text-sm placeholder-[#8A94A3] transition-all focus:outline-none focus:border-[#D65336] focus:ring-2 focus:ring-[#D65336]/20 disabled:opacity-60 disabled:bg-[#F3ECE5]",
                    errors.password ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : ""
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
              {errors.password && (
                <span className="text-xs font-semibold text-red-600 pl-1">{errors.password}</span>
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
              disabled={isLoading}
              className="w-full h-13 mt-3 bg-[#D65336] hover:bg-[#B9432C] active:bg-[#A83C27] text-white font-bold text-sm rounded-xl flex items-center justify-center space-x-2 shadow-xs hover:shadow transition-all disabled:opacity-60 disabled:cursor-not-allowed group cursor-pointer"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Sign In</span>
                  <span className="transition-transform group-hover:translate-x-1 font-bold">→</span>
                </>
              )}
            </button>
          </form>

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
            <span className="text-[11px] text-[#8A817A]">Owner Portal • Secure Auth</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LoginForm;

