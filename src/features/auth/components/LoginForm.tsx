import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../../../services/authService';
import { useToastStore } from '../../../components/ui/Toast/Toast';
import { getDashboardRoute } from '../../../utils/navigation';
import { cn } from '../../../utils/cn';
import SharedAuthLayout from '../../../shared/ui/auth/SharedAuthLayout';

// Lucide icons
import { 
  Store, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff,
  ArrowRight
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

      const allowedOwnerRoles = ['owner', 'admin', 'super-admin', 'super_admin'];
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
    <SharedAuthLayout
      roleVariant="owner"
      badgeLabel="Restaurant Owner"
      pageTitle="Owner Sign In"
      pageSubtitle="Access your restaurant dashboard and manage your business operations."
      icon={<Store className="w-7 h-7 text-[#087B5B]" />}
      cardMaxWidth="max-w-[520px]"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email Field */}
        <div className="w-full flex flex-col space-y-1.5 text-left">
          <label htmlFor="owner-email" className="text-xs font-bold text-[#17202A] select-none">
            Email Address
          </label>
          <div className="relative flex items-center">
            <Mail className="w-4 h-4 text-[#8A94A3] absolute left-3.5 pointer-events-none" />
            <input
              id="owner-email"
              type="email"
              placeholder="owner@restaurant.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              className={cn(
                "w-full pl-10 pr-4 py-3 bg-[#FCFAF7] border border-[#E8DED6] text-[#17202A] rounded-xl text-sm placeholder-[#8A94A3] transition-all focus:outline-none focus:border-[#087B5B] focus:ring-2 focus:ring-[#087B5B]/20 disabled:opacity-60 disabled:bg-[#F5ECE4]",
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
          <label htmlFor="owner-password" className="text-xs font-bold text-[#17202A] select-none">
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
                "w-full pl-10 pr-12 py-3 bg-[#FCFAF7] border border-[#E8DED6] text-[#17202A] rounded-xl text-sm placeholder-[#8A94A3] transition-all focus:outline-none focus:border-[#087B5B] focus:ring-2 focus:ring-[#087B5B]/20 disabled:opacity-60 disabled:bg-[#F5ECE4]",
                errors.password ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : ""
              )}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-[#8A94A3] hover:text-[#17202A] focus:outline-none focus:ring-2 focus:ring-[#087B5B]/40 rounded-lg transition-colors cursor-pointer"
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
          <label className="flex items-center space-x-2 text-[#17202A] font-semibold cursor-pointer select-none">
            <input 
              type="checkbox" 
              id="remember-me"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded border-[#E8DED6] text-[#087B5B] focus:ring-[#087B5B]/30 accent-[#087B5B] cursor-pointer" 
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
          className="w-full h-12 mt-3 bg-[#087B5B] hover:bg-[#066349] active:bg-[#054E3A] text-white font-bold text-sm rounded-xl flex items-center justify-center space-x-2 shadow-xs hover:shadow transition-all disabled:opacity-60 disabled:cursor-not-allowed group cursor-pointer"
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <span>Sign In as Owner</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </>
          )}
        </button>

        {/* Footer inside Card */}
        <div className="text-center pt-5 border-t border-[#E8DED6] text-xs space-y-2">
          <p className="text-[#667085] font-medium">
            Don't have a restaurant account?{' '}
            <Link to="/register" className="text-[#087B5B] hover:text-[#066349] font-bold hover:underline">
              Create Restaurant
            </Link>
          </p>
          <p>
            <Link to="/login" className="text-[#8A817A] hover:text-[#17202A] font-medium transition-colors">
              ← Switch Portal
            </Link>
          </p>
        </div>
      </form>
    </SharedAuthLayout>
  );
};

export default LoginForm;
