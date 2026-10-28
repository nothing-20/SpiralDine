import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Utensils, Lock, Mail, Eye, EyeOff, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../../../context/AuthContext';
import { authService } from '../../../../services/authService';
import { resolveAuthenticatedUser } from '../../../../shared/services/roleResolver';
import { getDashboardRoute } from '../../../../utils/navigation';

export const MobileSplashLogin: React.FC = () => {
  const navigate = useNavigate();
  const { user, role, authStatus } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // If already logged in as owner/admin, redirect appropriately based on approval status
  useEffect(() => {
    if (user && (role === 'owner' || role === 'admin')) {
      if (user.status && ['pending_approval', 'rejected', 'more_info_required'].includes(user.status)) {
        navigate('/application-pending', { replace: true });
      } else {
        navigate('/owner/dashboard', { replace: true });
      }
    }
  }, [user, role, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const result = await authService.signInWithEmail(email.trim(), password, rememberMe);
      if (result.user) {
        const profile = await resolveAuthenticatedUser(result.user);
        if (!profile) {
          await authService.signOutUser();
          setErrorMessage('Profile is missing or not configured for this account.');
          return;
        }

        const isApprovedOrActive = profile.status === 'active' || profile.status === 'approved';
        if (profile.status && !isApprovedOrActive) {
          if (['pending_approval', 'rejected', 'more_info_required'].includes(profile.status)) {
            navigate('/application-pending', { replace: true });
            return;
          }
          await authService.signOutUser();
          setErrorMessage('Your account is currently inactive or suspended. Please contact your restaurant administrator.');
          return;
        }

        if (profile.role === 'customer') {
          await authService.signOutUser();
          setErrorMessage('This account is registered as a diner account. Please sign in via the Customer Portal.');
          return;
        }

        const destination = getDashboardRoute(profile.role);
        navigate(destination, { replace: true });
      }
    } catch (err: any) {
      console.error('[MobileSplashLogin] Error:', err);
      let msg = 'Failed to sign in. Please verify your credentials.';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        msg = 'Invalid email or password.';
      } else if (err.code === 'auth/too-many-requests') {
        msg = 'Too many attempts. Please try again later.';
      } else if (err.message) {
        msg = err.message;
      }
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FAF4F0] via-[#FFFFFF] to-[#F7F7F7] flex flex-col justify-between px-6 py-8 select-none">
      {/* Brand & Splash Header */}
      <div className="flex flex-col items-center text-center pt-8">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#63351F] to-[#FF7518] shadow-lg shadow-[#FF7518]/25 flex items-center justify-center text-white mb-4">
          <Utensils className="w-8 h-8" />
        </div>
        <div className="flex items-center gap-1.5 justify-center">
          <span className="font-extrabold text-2xl tracking-tight text-[#202124]">Spiral</span>
          <span className="font-extrabold text-2xl tracking-tight text-[#FF7518]">Dine</span>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFF4EE] border border-[#FFE0CE] text-[#FF7518] text-xs font-bold mt-2">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Owner & Management Portal</span>
        </div>
        <p className="text-xs text-[#707070] mt-2 max-w-xs">
          Manage live orders, menu catalog, tables, staff, and real-time revenue analytics.
        </p>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-sm mx-auto my-6 bg-white rounded-3xl border border-[#EBEBEB] p-6 shadow-xl shadow-black/[0.03]">
        <h2 className="text-xl font-bold text-[#202124] mb-1">Welcome back</h2>
        <p className="text-xs text-[#707070] mb-5">Sign in to your restaurant workspace</p>

        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-[#FEE2E2] border border-[#FECACA] flex items-start gap-2.5 text-xs text-[#DC2626]">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span className="leading-tight font-medium">{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#202124] mb-1.5">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#9E9E9E] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="owner@paradisebiryani.com"
                className="w-full h-11 pl-10 pr-3.5 rounded-xl border border-[#D1D5DB] focus:border-[#FF7518] focus:ring-2 focus:ring-[#FF7518]/20 text-xs text-[#202124] outline-none transition-all placeholder:text-[#9E9E9E]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#202124] mb-1.5">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#9E9E9E] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full h-11 pl-10 pr-10 rounded-xl border border-[#D1D5DB] focus:border-[#FF7518] focus:ring-2 focus:ring-[#FF7518]/20 text-xs text-[#202124] outline-none transition-all placeholder:text-[#9E9E9E]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9E9E9E] hover:text-[#202124]"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-[#FF7518] focus:ring-[#FF7518]"
              />
              <span className="text-xs text-[#707070]">Remember me</span>
            </label>
            <Link
              to="/forgot-password"
              className="text-xs font-bold text-[#FF7518] hover:text-[#E05D07]"
            >
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-[#FF7518] hover:bg-[#E05D07] active:scale-[0.99] text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-[#FF7518]/25 flex items-center justify-center gap-2 disabled:opacity-60 disabled:pointer-events-none mt-2"
          >
            {loading ? (
              <span className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span>Sign In to Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>

      {/* Footer info */}
      <div className="text-center text-xs text-[#9E9E9E] pb-2">
        <span>Protected by SpiralDine Enterprise Security</span>
        <div className="flex items-center justify-center gap-3 mt-2 text-[#707070]">
          <Link to="/privacy" className="hover:underline">Privacy</Link>
          <span>•</span>
          <Link to="/terms" className="hover:underline">Terms</Link>
          <span>•</span>
          <Link to="/help" className="hover:underline">Support</Link>
        </div>
      </div>
    </div>
  );
};

export default MobileSplashLogin;
