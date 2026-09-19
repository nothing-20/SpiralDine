import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  signInWithEmailAndPassword, 
  sendPasswordResetEmail, 
  signOut 
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../../config/firebase';
import { useAuth } from '../../../context/AuthContext';
import { 
  ShieldCheck, 
  Mail, 
  Lock, 
  AlertCircle, 
  CheckCircle2, 
  ArrowRight, 
  KeyRound, 
  Eye, 
  EyeOff,
  Sparkles
} from 'lucide-react';
import toast from 'react-hot-toast';

export const SuperAdminLogin: React.FC = () => {
  const navigate = useNavigate();
  const { user, role, isLoading: authLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Forgot password modal state
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetStatus, setResetStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [resetMessage, setResetMessage] = useState('');

  // If already logged in as Super Admin, redirect directly to dashboard
  useEffect(() => {
    if (!authLoading && user && (role === 'super_admin' || role === 'super-admin')) {
      navigate('/super-admin/dashboard', { replace: true });
    }
  }, [user, role, authLoading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMessage('Please enter your email address.');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setIsLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
      const signedInUser = userCredential.user;

      // Force refresh token to obtain latest custom claims
      const tokenResult = await signedInUser.getIdTokenResult(true);
      const claimRole = tokenResult?.claims?.role;
      const hasClaimSuperAdmin = 
        claimRole === 'super_admin' || 
        claimRole === 'super-admin' || 
        tokenResult?.claims?.super_admin === true;

      // Also verify Firestore users doc
      let hasDocSuperAdmin = false;
      try {
        const userDocRef = doc(db, 'users', signedInUser.uid);
        const userSnap = await getDoc(userDocRef);
        if (userSnap.exists()) {
          const uData = userSnap.data();
          if (uData.role === 'super_admin' || uData.role === 'super-admin') {
            hasDocSuperAdmin = true;
          }
        }
      } catch (_docErr) {
        // Fallback on verified token custom claims
      }

      if (!hasClaimSuperAdmin && !hasDocSuperAdmin) {
        // Immediately sign out unauthorized account to prevent access
        await signOut(auth);
        setErrorMessage('Access Denied: This account does not possess Super Admin authorization.');
        toast.error('Access Denied: Super Admin privileges required.');
        setIsLoading(false);
        return;
      }

      toast.success('Super Admin authenticated successfully.');
      navigate('/super-admin/dashboard', { replace: true });
    } catch (err: any) {
      console.error('[SuperAdminLogin] Auth error:', err);
      let msg = 'Authentication failed. Please check your credentials.';
      if (
        err.code === 'auth/invalid-credential' || 
        err.code === 'auth/wrong-password' || 
        err.code === 'auth/user-not-found'
      ) {
        msg = 'Invalid email address or password. Please verify and try again.';
      } else if (err.code === 'auth/user-disabled') {
        msg = 'This administrator account has been disabled.';
      } else if (err.code === 'auth/too-many-requests') {
        msg = 'Too many failed login attempts. Please try again later.';
      } else if (err.code === 'auth/network-request-failed') {
        msg = 'Network connection failure. Please check your internet connection.';
      }
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = resetEmail.trim().toLowerCase();
    if (!cleanEmail) {
      setResetStatus('error');
      setResetMessage('Please provide an email address.');
      return;
    }

    setResetStatus('loading');
    try {
      await sendPasswordResetEmail(auth, cleanEmail);
      setResetStatus('success');
      setResetMessage('Password reset instructions have been dispatched to your email.');
      toast.success('Reset email sent.');
    } catch (err: any) {
      setResetStatus('error');
      let msg = 'Failed to dispatch password reset email.';
      if (err.code === 'auth/user-not-found') {
        msg = 'No administrator registered with this email address.';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Invalid email address syntax.';
      }
      setResetMessage(msg);
      toast.error(msg);
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

      {/* Main card container */}
      <div className="w-full max-w-md relative z-10 my-6">
        {/* Card */}
        <div className="bg-white border border-[#E5E0D8] rounded-2xl p-6 sm:p-8 shadow-xl shadow-stone-200/50 backdrop-blur-sm">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#12352D] text-white shadow-md shadow-[#12352D]/15 mb-3.5">
              <ShieldCheck className="w-7 h-7 text-[#FBF9F5]" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#15211E] font-serif">
              SpiralDine
            </h1>
            <div className="inline-flex items-center mt-2 px-3 py-0.5 rounded-full bg-[#E8EDE9] border border-[#52796F]/20 text-[#12352D] text-[11px] font-semibold tracking-wider uppercase">
              Super Admin
            </div>
            <p className="text-xs text-[#606D67] mt-2">
              Platform administration for SpiralDine
            </p>
          </div>

          <div className="mb-6">
            <h2 className="text-lg font-bold text-[#15211E]">Welcome back</h2>
            <p className="text-xs text-[#606D67] mt-0.5">
              Sign in to manage the SpiralDine platform.
            </p>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start space-x-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <span className="leading-relaxed">{errorMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#2B3B36] mb-1.5" htmlFor="sa-email">
                Email address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="sa-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@spiraldine.internal"
                  className="w-full pl-10 pr-4 py-2.5 bg-[#FAF8F5] border border-[#E5E0D8] rounded-xl text-sm text-[#15211E] placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#12352D]/20 focus:border-[#12352D] transition-all"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-[#2B3B36]" htmlFor="sa-password">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setResetEmail(email);
                    setResetStatus('idle');
                    setResetMessage('');
                    setIsForgotModalOpen(true);
                  }}
                  className="text-xs font-medium text-[#D97706] hover:text-[#B45309] transition-colors"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="sa-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-10 py-2.5 bg-[#FAF8F5] border border-[#E5E0D8] rounded-xl text-sm text-[#15211E] placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#12352D]/20 focus:border-[#12352D] transition-all"
                  disabled={isLoading}
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

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-[#12352D] text-white font-semibold text-sm hover:bg-[#1A473C] focus:outline-none focus:ring-2 focus:ring-[#12352D]/30 active:scale-[0.99] transition-all flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#12352D]/20"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  <span>Verifying clearance...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Super Admin</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* First-time setup section */}
          <div className="mt-6 pt-5 border-t border-[#E5E0D8] text-center">
            <p className="text-xs text-[#606D67]">
              First time setting up SpiralDine?
            </p>
            <Link
              to="/super-admin/setup"
              className="mt-1.5 inline-flex items-center text-xs font-semibold text-[#12352D] hover:text-[#1A473C] hover:underline transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1 text-[#D97706]" />
              <span>Create the initial Super Admin account</span>
            </Link>
          </div>

          {/* Security notice footer */}
          <div className="mt-5 pt-4 border-t border-[#F0ECE1] text-center">
            <p className="text-[11px] text-[#8C9893]">
              Authorized SpiralDine administrators only.
            </p>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {isForgotModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
          <div className="bg-white border border-[#E5E0D8] rounded-2xl p-6 max-w-md w-full shadow-2xl relative">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2.5 rounded-xl bg-[#E8EDE9] border border-[#52796F]/20 text-[#12352D]">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#15211E]">Reset Super Admin Password</h3>
                <p className="text-xs text-[#606D67]">Receive password reset instructions</p>
              </div>
            </div>

            {resetStatus === 'success' ? (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start space-x-2.5 mb-4">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                <span className="leading-relaxed">{resetMessage}</span>
              </div>
            ) : (
              <form onSubmit={handlePasswordReset} className="space-y-4">
                {resetStatus === 'error' && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start space-x-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                    <span>{resetMessage}</span>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold text-[#2B3B36] mb-1.5" htmlFor="sa-reset-email">
                    Email address
                  </label>
                  <input
                    id="sa-reset-email"
                    type="email"
                    required
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="admin@spiraldine.internal"
                    className="w-full px-3.5 py-2.5 bg-[#FAF8F5] border border-[#E5E0D8] rounded-xl text-sm text-[#15211E] placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#12352D]/20 focus:border-[#12352D] transition-all"
                    disabled={resetStatus === 'loading'}
                  />
                </div>
                <div className="flex items-center justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsForgotModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-[#606D67] hover:text-[#15211E] hover:bg-[#F4EFE6] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={resetStatus === 'loading'}
                    className="px-4 py-2 rounded-xl bg-[#12352D] text-white text-xs font-semibold hover:bg-[#1A473C] transition-colors disabled:opacity-50 shadow-sm"
                  >
                    {resetStatus === 'loading' ? 'Sending...' : 'Send Reset Link'}
                  </button>
                </div>
              </form>
            )}

            {resetStatus === 'success' && (
              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setIsForgotModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#12352D] text-white text-xs font-medium hover:bg-[#1A473C] transition-colors"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminLogin;
