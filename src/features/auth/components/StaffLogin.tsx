import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signInWithEmailAndPassword, setPersistence, browserSessionPersistence } from 'firebase/auth';
import { auth } from '../../../config/firebase';
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
  Users, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  TrendingUp, 
  Settings, 
  Heart, 
  Leaf 
} from 'lucide-react';

export const StaffLogin: React.FC = () => {
  const navigate = useNavigate();
  const { addToast } = useToastStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const validate = () => {
    const next: typeof errors = {};
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      next.email = 'Email address is required.';
    } else if (!/\S+@\S+\.\S+/.test(cleanEmail)) {
      next.email = 'Please enter a valid email address.';
    }
    if (!password) {
      next.password = 'Password is required.';
    } else if (password.length < 6) {
      next.password = 'Password must be at least 6 characters.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    console.log('[AUTH Staff Login] Login started for:', cleanEmail);
    if (!validate()) return;

    setIsLoading(true);
    try {
      // 1. Firebase Authentication with tab-isolated session persistence
      console.log('[AUTH Staff Login] Calling Firebase authentication...');
      try {
        await setPersistence(auth, browserSessionPersistence);
      } catch (persistErr) {
        console.warn('[AUTH Staff Login] Note setting session persistence:', persistErr);
      }
      const credentials = await signInWithEmailAndPassword(auth, cleanEmail, password);
      const fUser = credentials.user;

      console.log('[AUTH Staff Login] Firebase Auth success:', {
        uid: fUser.uid,
        email: fUser.email
      });

      // 2. Authoritative profile resolution
      const { resolveAuthenticatedUser } = await import('../../../shared/services/roleResolver');
      const profile = await resolveAuthenticatedUser(fUser);

      if (!profile) {
        console.warn('[AUTH Staff Login] Profile missing for UID:', fUser.uid);
        await auth.signOut();
        addToast('Your account is authenticated, but no staff profile is associated with this account. Please contact your restaurant administrator.', 'error');
        setIsLoading(false);
        return;
      }

      console.log('[AUTH Staff Login] Resolved profile:', {
        role: profile.role,
        tenantId: profile.tenantId,
        status: profile.status
      });

      // 3. Account Status Check
      if (profile.status && profile.status !== 'active') {
        console.warn('[AUTH Staff Login] Staff account inactive/suspended:', profile.status);
        await auth.signOut();
        addToast('Your staff account is currently inactive or suspended. Contact your administrator.', 'error');
        setIsLoading(false);
        return;
      }

      // 4. Role Validation & Portal Isolation
      if (profile.role === 'customer') {
        console.warn('[AUTH Staff Login] Customer account attempted staff login. Rejecting.');
        await auth.signOut();
        addToast('This account is registered as a diner account. Please sign in via Customer Login.', 'error');
        setIsLoading(false);
        return;
      }

      if (!profile.tenantId && profile.role !== 'super-admin') {
        console.error('[AUTH Staff Login] Staff profile missing tenantId');
        await auth.signOut();
        addToast('Your staff account is not assigned to a restaurant tenant. Contact your administrator.', 'error');
        setIsLoading(false);
        return;
      }

      // 5. Successful Role-Based Routing
      const destination = getDashboardRoute(profile.role);
      console.log('[AUTH Staff Login] Successful auth. Routing details:', {
        uid: fUser.uid,
        email: cleanEmail,
        portal: 'STAFF',
        resolvedRole: profile.role,
        tenantId: profile.tenantId,
        destination
      });

      addToast(`Welcome back, ${profile.displayName || 'Staff'}!`, 'success');
      navigate(destination, { replace: true });
    } catch (err: any) {
      console.error('[AUTH Staff Login Error]', err);
      let msg = 'Authentication failed. Please check your credentials.';

      if (err.message === 'PERMISSION_DENIED_USER_PROFILE') {
        msg = 'Your account is authenticated, but your staff profile cannot be accessed because of a database authorization configuration issue. Contact your administrator.';
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        msg = 'Incorrect email or password. If you have an invitation, activate your account first.';
      } else if (err.code === 'permission-denied' || err.message?.includes('insufficient permissions')) {
        msg = 'Your account is authenticated, but your staff profile cannot be accessed because of an authorization configuration problem. Contact your administrator.';
      } else if (err.code === 'auth/too-many-requests') {
        msg = 'Too many attempts. Please wait a moment and try again.';
      } else if (err.message) {
        msg = err.message;
      }

      addToast(msg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FCFAF7] text-[#17233D] flex flex-col justify-between relative overflow-x-hidden select-none font-sans">
      {/* ========================================================================= */}
      {/* 1. DECORATIVE BACKGROUND TREATMENT (Z-INDEX 0, POINTER-EVENTS NONE)       */}
      {/* ========================================================================= */}

      {/* Subtle warm circular background ambient backdrops */}
      <div className="absolute top-[14%] left-[-160px] md:left-[-120px] lg:left-[-80px] w-[500px] md:w-[580px] h-[500px] md:h-[580px] rounded-full bg-[#F3E8DF]/80 blur-[2px] pointer-events-none z-0" />
      <div className="absolute bottom-[6%] right-[-160px] md:right-[-120px] lg:right-[-80px] w-[500px] md:w-[580px] h-[500px] md:h-[580px] rounded-full bg-[#F3E8DF]/80 blur-[2px] pointer-events-none z-0" />

      {/* LEFT SIDE: Food plate entering from left edge */}
      <div className="hidden sm:block absolute left-[-240px] md:left-[-220px] lg:left-[-190px] xl:left-[-150px] top-[18%] md:top-[20%] w-[420px] md:w-[480px] lg:w-[540px] pointer-events-none select-none z-0">
        <img 
          src={leftPlateImg} 
          alt="Artisanal Dining Dish" 
          className="w-full h-auto drop-shadow-xl transform -rotate-12"
        />
      </div>

      {/* Left side: Floating basil garnish */}
      <div className="hidden md:block absolute left-[220px] lg:left-[270px] top-[28%] w-10 h-10 pointer-events-none select-none z-0 transform rotate-45 opacity-90 drop-shadow-sm">
        <img src={basilLeaf2} alt="Fresh Basil Leaf" className="w-full h-full object-contain" />
      </div>

      {/* Left side: Handwritten style decorative brand phrase */}
      <div className="hidden lg:flex flex-col items-start absolute left-8 xl:left-14 bottom-20 xl:bottom-28 pointer-events-none select-none z-0 -rotate-6">
        <span className="font-serif italic text-2xl xl:text-3xl text-[#7E746A] tracking-tight leading-tight">
          Empowering Staff
        </span>
        <span className="font-serif italic text-2xl xl:text-3xl text-[#7E746A] tracking-tight leading-tight">
          Delivering Excellence
        </span>
        <div className="w-24 h-0.5 bg-[#C94F3D]/60 rounded-full mt-1.5 -rotate-2" />
      </div>

      {/* RIGHT SIDE: Food plate entering from right edge */}
      <div className="hidden sm:block absolute right-[-240px] md:right-[-220px] lg:right-[-190px] xl:right-[-150px] bottom-[8%] md:bottom-[10%] w-[420px] md:w-[480px] lg:w-[540px] pointer-events-none select-none z-0">
        <img 
          src={rightPlateImg} 
          alt="Artisanal Entree Dish" 
          className="w-full h-auto drop-shadow-xl transform rotate-6"
        />
      </div>

      {/* Right side: Floating basil garnish */}
      <div className="hidden md:block absolute right-[230px] lg:right-[280px] bottom-[38%] w-11 h-11 pointer-events-none select-none z-0 transform -rotate-12 opacity-90 drop-shadow-sm">
        <img src={basilLeaf1} alt="Fresh Basil Leaf" className="w-full h-full object-contain" />
      </div>

      {/* Right side: Handwritten style decorative brand phrase */}
      <div className="hidden lg:flex flex-col items-start absolute right-10 xl:right-16 top-24 xl:top-32 pointer-events-none select-none z-0 -rotate-6">
        <span className="font-serif italic text-2xl xl:text-3xl text-[#7E746A] tracking-tight leading-tight">
          Fast Service
        </span>
        <span className="font-serif italic text-2xl xl:text-3xl text-[#7E746A] tracking-tight leading-tight">
          Flawless Kitchen
        </span>
        <div className="w-28 h-0.5 bg-[#C94F3D]/60 rounded-full mt-1.5 -rotate-2" />
      </div>

      {/* ========================================================================= */}
      {/* 2. TOP BRANDING HEADER                                                    */}
      {/* ========================================================================= */}
      <header className="w-full max-w-6xl mx-auto px-6 py-4 flex items-center justify-between relative z-20">
        <Link to="/" className="flex items-center space-x-3 group">
          <div className="w-10 h-10 bg-[#C94F3D] rounded-xl flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
            <span className="text-white font-extrabold text-xl font-display leading-none">S</span>
          </div>
          <div>
            <span className="font-display font-extrabold text-xl tracking-tight text-[#17233D]">
              Spiral <span className="text-[#C94F3D]">Dine</span>
            </span>
            <p className="text-[10px] font-semibold text-[#667085] hidden sm:block leading-none mt-0.5">
              Smart Dining. Smarter Business.
            </p>
          </div>
        </Link>

        <Link 
          to="/" 
          className="inline-flex items-center space-x-1 text-xs font-bold text-[#667085] hover:text-[#17233D] transition-colors py-2 px-3.5 rounded-xl hover:bg-[#F3E8DF]"
        >
          <span>← Back to Home</span>
        </Link>
      </header>

      {/* ========================================================================= */}
      {/* 3. MAIN CONTENT: CENTERED COMPACT STAFF LOGIN CARD (440–500px)            */}
      {/* ========================================================================= */}
      <main className="w-full max-w-6xl mx-auto px-6 py-3 sm:py-5 flex flex-col items-center justify-center flex-1 relative z-10 space-y-4">
        
        {/* Centered White Card (Optimized Height & Width) */}
        <div className="max-w-[480px] w-full p-6 sm:p-8 bg-white border border-[#E5E1DC] rounded-[24px] shadow-md relative overflow-hidden text-left">
          
          {/* Card Icon & Header */}
          <div className="space-y-2 text-center mb-5">
            <div className="w-12 h-12 bg-[#F8E8E2] rounded-2xl flex items-center justify-center mx-auto shadow-2xs">
              <Users className="w-6 h-6 text-[#C94F3D]" />
            </div>
            <h1 className="text-2xl sm:text-[26px] font-display font-extrabold text-[#17233D] tracking-tight">
              Staff Portal Sign In
            </h1>
            <p className="text-xs sm:text-sm text-[#667085] font-normal leading-relaxed max-w-xs mx-auto">
              Sign in to access your staff dashboard and manage daily operations.
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            
            {/* Email Field */}
            <div className="w-full flex flex-col space-y-1 text-left">
              <label htmlFor="staff-email" className="text-xs font-bold text-[#17233D] select-none">
                Staff Email Address *
              </label>
              <div className="relative flex items-center">
                <Mail className="w-4 h-4 text-[#667085] absolute left-3.5 pointer-events-none" />
                <input
                  id="staff-email"
                  type="email"
                  placeholder="you@restaurant.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  required
                  className={cn(
                    "w-full pl-10 pr-4 py-2.5 sm:py-3 bg-white border border-[#E5E1DC] text-[#17233D] rounded-xl text-sm placeholder-[#98A2B3] transition-all focus:outline-none focus:border-[#C94F3D] focus:ring-2 focus:ring-[#C94F3D]/20 disabled:opacity-60 disabled:bg-[#F3E8DF]",
                    errors.email ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : ""
                  )}
                />
              </div>
              {errors.email && (
                <span className="text-xs font-semibold text-red-600 pl-1">{errors.email}</span>
              )}
            </div>

            {/* Password Field with Functional Eye Visibility Toggle */}
            <div className="w-full flex flex-col space-y-1 text-left">
              <label htmlFor="staff-password" className="text-xs font-bold text-[#17233D] select-none">
                Password *
              </label>
              <div className="relative flex items-center">
                <Lock className="w-4 h-4 text-[#667085] absolute left-3.5 pointer-events-none" />
                <input
                  id="staff-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  required
                  className={cn(
                    "w-full pl-10 pr-12 py-2.5 sm:py-3 bg-white border border-[#E5E1DC] text-[#17233D] rounded-xl text-sm placeholder-[#98A2B3] transition-all focus:outline-none focus:border-[#C94F3D] focus:ring-2 focus:ring-[#C94F3D]/20 disabled:opacity-60 disabled:bg-[#F3E8DF]",
                    errors.password ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : ""
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-[#667085] hover:text-[#17233D] focus:outline-none focus:ring-2 focus:ring-[#C94F3D]/40 rounded-lg transition-colors cursor-pointer"
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
            <div className="flex justify-between items-center text-xs pt-0.5">
              <label className="flex items-center space-x-2 text-[#17233D] font-semibold cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  id="staff-remember-me"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-[#E5E1DC] text-[#C94F3D] focus:ring-[#C94F3D]/30 accent-[#C94F3D] cursor-pointer" 
                />
                <span>Remember me on this device</span>
              </label>
              <Link 
                to="/forgot-password" 
                className="text-[#C94F3D] hover:text-[#A93E30] font-bold hover:underline transition-colors"
              >
                Forgot Password?
              </Link>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 mt-2 bg-[#C94F3D] hover:bg-[#A93E30] active:bg-[#923326] text-white font-bold text-sm rounded-xl flex items-center justify-center space-x-2 shadow-xs hover:shadow transition-all disabled:opacity-60 disabled:cursor-not-allowed group cursor-pointer"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Sign In to Staff Portal</span>
                  <span className="transition-transform group-hover:translate-x-1 font-bold">→</span>
                </>
              )}
            </button>
          </form>

          {/* Staff Invitation Banner */}
          <div className="mt-5 pt-4 border-t border-[#E5E1DC]">
            <div className="bg-[#E7F5EF] border border-[#16866D]/20 rounded-xl p-3 text-center space-y-1">
              <p className="text-xs font-bold text-[#16866D]">Need a staff account?</p>
              <p className="text-[11px] text-[#667085] leading-snug">
                Ask your restaurant owner to send you a staff invitation.
              </p>
              <div className="pt-0.5">
                <Link
                  to="/staff/activate"
                  className="inline-flex items-center space-x-1 text-xs text-[#16866D] hover:text-[#116854] font-bold hover:underline transition-colors"
                >
                  <span>Activate Your Staff Account Here →</span>
                </Link>
              </div>
            </div>
          </div>

          {/* Card Bottom Navigation Links */}
          <div className="flex items-center justify-between text-xs text-[#667085] font-semibold pt-4 mt-2 border-t border-[#E5E1DC]/60 px-1">
            <Link to="/" className="hover:text-[#17233D] transition-colors">
              ← Back to Home
            </Link>
            <Link to="/customer/login" className="hover:text-[#C94F3D] transition-colors font-bold">
              Customer Login →
            </Link>
          </div>
        </div>

        {/* Subtle Bottom Value Strip on Desktop & Tablet (Compact) */}
        <div className="w-full max-w-3xl hidden md:block pt-1">
          <div className="grid grid-cols-4 gap-3 text-left">
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 rounded-lg bg-[#F8E8E2] text-[#C94F3D] flex items-center justify-center shrink-0">
                <TrendingUp className="w-3 h-3" />
              </div>
              <div>
                <h4 className="text-[11px] font-bold text-[#17233D]">More Revenue</h4>
                <p className="text-[10px] text-[#667085]">Reach more customers</p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 rounded-lg bg-[#E7F5EF] text-[#16866D] flex items-center justify-center shrink-0">
                <Settings className="w-3 h-3" />
              </div>
              <div>
                <h4 className="text-[11px] font-bold text-[#17233D]">Smarter Operations</h4>
                <p className="text-[10px] text-[#667085]">Manage everything easily</p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 rounded-lg bg-[#F8E8E2] text-[#C94F3D] flex items-center justify-center shrink-0">
                <Heart className="w-3 h-3" />
              </div>
              <div>
                <h4 className="text-[11px] font-bold text-[#17233D]">Happier Guests</h4>
                <p className="text-[10px] text-[#667085]">Better dining experiences</p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 rounded-lg bg-[#E7F5EF] text-[#16866D] flex items-center justify-center shrink-0">
                <Leaf className="w-3 h-3" />
              </div>
              <div>
                <h4 className="text-[11px] font-bold text-[#17233D]">Sustainable Growth</h4>
                <p className="text-[10px] text-[#667085]">Built for the future</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ========================================================================= */}
      {/* 4. MINIMALIST FOOTER                                                      */}
      {/* ========================================================================= */}
      <footer className="w-full border-t border-[#E5E1DC] bg-[#F3E8DF]/60 relative z-20">
        <div className="max-w-6xl mx-auto px-6 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-medium text-[#667085]">
          <div>
            <span>&copy; {new Date().getFullYear()} Spiral Dine. All rights reserved.</span>
          </div>
          <div className="flex space-x-6">
            <a href="#" className="hover:text-[#17233D] transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-[#17233D] transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-[#17233D] transition-colors">Support Desk</a>
            <a href="#" className="hover:text-[#17233D] transition-colors">Contact Us</a>
          </div>
          <div>
            <span className="text-[11px] text-[#667085]">Staff Portal • Operational Auth</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default StaffLogin;
