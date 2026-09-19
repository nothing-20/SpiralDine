import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signInWithEmailAndPassword, setPersistence, browserSessionPersistence } from 'firebase/auth';
import { auth } from '../../../config/firebase';
import { useToastStore } from '../../../components/ui/Toast/Toast';
import { getDashboardRoute } from '../../../utils/navigation';
import { cn } from '../../../utils/cn';
import SharedAuthLayout from '../../../shared/ui/auth/SharedAuthLayout';

// Lucide icons
import { 
  Users, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowRight 
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

      // Authoritative profile resolution
      const { resolveAuthenticatedUser } = await import('../../../shared/services/roleResolver');
      const profile = await resolveAuthenticatedUser(fUser);

      if (!profile) {
        console.warn('[AUTH Staff Login] Profile missing for UID:', fUser.uid);
        await auth.signOut();
        addToast('Your account is authenticated, but no staff profile is associated with this account. Please contact your restaurant administrator.', 'error');
        setIsLoading(false);
        return;
      }

      // Account Status Check
      if (profile.status && profile.status !== 'active') {
        console.warn('[AUTH Staff Login] Staff account inactive/suspended:', profile.status);
        await auth.signOut();
        addToast('Your staff account is currently inactive or suspended. Contact your administrator.', 'error');
        setIsLoading(false);
        return;
      }

      // Role Validation & Portal Isolation
      if (profile.role === 'customer') {
        console.warn('[AUTH Staff Login] Customer account attempted staff login. Rejecting.');
        await auth.signOut();
        addToast('This account is registered as a diner account. Please sign in via Customer Login.', 'error');
        setIsLoading(false);
        return;
      }

      if (!profile.tenantId && profile.role !== 'super-admin' && profile.role !== 'super_admin') {
        console.error('[AUTH Staff Login] Staff profile missing tenantId');
        await auth.signOut();
        addToast('Your staff account is not assigned to a restaurant tenant. Contact your administrator.', 'error');
        setIsLoading(false);
        return;
      }

      // Successful Role-Based Routing
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
    <SharedAuthLayout
      roleVariant="staff"
      badgeLabel="Staff Portal"
      pageTitle="Staff Portal Sign In"
      pageSubtitle="Sign in to access your kitchen KDS, waiter matrices or cashier desks."
      icon={<Users className="w-7 h-7 text-[#087B5B]" />}
      cardMaxWidth="max-w-[480px]"
    >
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {/* Email Field */}
        <div className="w-full flex flex-col space-y-1 text-left">
          <label htmlFor="staff-email" className="text-xs font-bold text-[#17202A] select-none">
            Staff Email Address *
          </label>
          <div className="relative flex items-center">
            <Mail className="w-4 h-4 text-[#8A94A3] absolute left-3.5 pointer-events-none" />
            <input
              id="staff-email"
              type="email"
              placeholder="you@restaurant.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              required
              className={cn(
                "w-full pl-10 pr-4 py-2.5 sm:py-3 bg-[#FCFAF7] border border-[#E8DED6] text-[#17202A] rounded-xl text-sm placeholder-[#8A94A3] transition-all focus:outline-none focus:border-[#087B5B] focus:ring-2 focus:ring-[#087B5B]/20 disabled:opacity-60 disabled:bg-[#F5ECE4]",
                errors.email ? "border-red-500 focus:border-red-500" : ""
              )}
            />
          </div>
          {errors.email && (
            <span className="text-xs font-semibold text-red-600 pl-1">{errors.email}</span>
          )}
        </div>

        {/* Password Field with Functional Eye Visibility Toggle */}
        <div className="w-full flex flex-col space-y-1 text-left">
          <label htmlFor="staff-password" className="text-xs font-bold text-[#17202A] select-none">
            Password *
          </label>
          <div className="relative flex items-center">
            <Lock className="w-4 h-4 text-[#8A94A3] absolute left-3.5 pointer-events-none" />
            <input
              id="staff-password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              required
              className={cn(
                "w-full pl-10 pr-12 py-2.5 sm:py-3 bg-[#FCFAF7] border border-[#E8DED6] text-[#17202A] rounded-xl text-sm placeholder-[#8A94A3] transition-all focus:outline-none focus:border-[#087B5B] focus:ring-2 focus:ring-[#087B5B]/20 disabled:opacity-60 disabled:bg-[#F5ECE4]",
                errors.password ? "border-red-500 focus:border-red-500" : ""
              )}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-[#8A94A3] hover:text-[#17202A] focus:outline-none focus:ring-2 focus:ring-[#087B5B]/40 rounded-lg transition-colors cursor-pointer"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.password && (
            <span className="text-xs font-semibold text-red-600 pl-1">{errors.password}</span>
          )}
        </div>

        {/* Remember Me & Forgot Password */}
        <div className="flex justify-between items-center text-xs pt-0.5">
          <label className="flex items-center space-x-2 text-[#17202A] font-semibold cursor-pointer select-none">
            <input 
              type="checkbox" 
              id="staff-remember-me"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-[#E8DED6] text-[#087B5B] focus:ring-[#087B5B]/30 accent-[#087B5B] cursor-pointer" 
            />
            <span>Remember me on this device</span>
          </label>
          <Link 
            to="/forgot-password" 
            className="text-[#087B5B] hover:text-[#066349] font-bold hover:underline transition-colors"
          >
            Forgot Password?
          </Link>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full h-12 mt-2 bg-[#087B5B] hover:bg-[#066349] active:bg-[#054E3A] text-white font-bold text-sm rounded-xl flex items-center justify-center space-x-2 shadow-xs hover:shadow transition-all disabled:opacity-60 disabled:cursor-not-allowed group cursor-pointer"
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <span>Sign In to Staff Portal</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </>
          )}
        </button>
      </form>

      {/* Staff Invitation Banner */}
      <div className="mt-5 pt-4 border-t border-[#E8DED6]">
        <div className="bg-[#E8F5EF] border border-[#A3E0C8]/50 rounded-xl p-3 text-center space-y-1">
          <p className="text-xs font-bold text-[#087B5B]">Need a staff account?</p>
          <p className="text-[11px] text-[#667085] leading-snug">
            Ask your restaurant owner to send you an employee invitation link.
          </p>
          <div className="pt-0.5">
            <Link
              to="/staff/activate"
              className="inline-flex items-center space-x-1 text-xs text-[#087B5B] hover:text-[#066349] font-bold hover:underline transition-colors"
            >
              <span>Activate Your Staff Account Here →</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Bottom Navigation Links */}
      <div className="flex items-center justify-between text-xs text-[#667085] font-semibold pt-4 mt-2 border-t border-[#E8DED6]/60 px-1">
        <Link to="/login" className="hover:text-[#17202A] transition-colors">
          ← Switch Portal
        </Link>
        <Link to="/customer/login" className="hover:text-[#D65336] transition-colors font-bold">
          Customer Login →
        </Link>
      </div>
    </SharedAuthLayout>
  );
};

export default StaffLogin;
