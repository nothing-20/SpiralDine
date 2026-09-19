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
import SharedAuthLayout from '../../../shared/ui/auth/SharedAuthLayout';

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
      setErrorMessage('Please enter your administrator email address.');
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

      // Force refresh token to obtain authoritative custom claims
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
        toast.error('Access Denied: Super Admin clearance required.');
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
        msg = 'Invalid administrator email or password. Please verify and try again.';
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
    <SharedAuthLayout
      roleVariant="super-admin"
      badgeLabel="Platform Governance"
      pageTitle="Super Admin Portal"
      pageSubtitle="Secure platform administration for the SpiralDine ecosystem."
      icon={<ShieldCheck className="w-7 h-7 text-white" />}
      cardMaxWidth="max-w-[500px]"
    >
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
          <label className="block text-xs font-bold text-[#17202A] mb-1.5" htmlFor="sa-email">
            Admin Email Address
          </label>
          <div className="relative flex items-center">
            <Mail className="w-4 h-4 text-[#8A94A3] absolute left-3.5 pointer-events-none" />
            <input
              id="sa-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@spiraldine.internal"
              className="w-full pl-10 pr-4 py-3 bg-[#FCFAF7] border border-[#E8DED6] rounded-xl text-sm text-[#17202A] placeholder-[#8A94A3] focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 focus:border-[#1E3A5F] transition-all disabled:opacity-60"
              disabled={isLoading}
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-bold text-[#17202A]" htmlFor="sa-password">
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
              className="text-xs font-medium text-[#D65336] hover:text-[#B9432D] transition-colors cursor-pointer"
            >
              Forgot Password?
            </button>
          </div>
          <div className="relative flex items-center">
            <Lock className="w-4 h-4 text-[#8A94A3] absolute left-3.5 pointer-events-none" />
            <input
              id="sa-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full pl-10 pr-12 py-3 bg-[#FCFAF7] border border-[#E8DED6] rounded-xl text-sm text-[#17202A] placeholder-[#8A94A3] focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 focus:border-[#1E3A5F] transition-all disabled:opacity-60"
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-[#8A94A3] hover:text-[#17202A] rounded-lg transition-colors cursor-pointer"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full h-12 mt-2 py-3 px-4 rounded-xl bg-[#1E3A5F] text-white font-bold text-sm hover:bg-[#152B47] focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/30 active:scale-[0.99] transition-all flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm cursor-pointer"
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              <span>Verifying authorization...</span>
            </>
          ) : (
            <>
              <span>Sign In to Super Admin</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      {/* First-time setup link */}
      <div className="mt-6 pt-5 border-t border-[#E8DED6] text-center space-y-2">
        <p className="text-xs text-[#667085]">
          First time initializing this platform?
        </p>
        <Link
          to="/super-admin/setup"
          className="inline-flex items-center text-xs font-semibold text-[#1E40AF] hover:text-[#1E3A8A] hover:underline transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5 mr-1 text-[#D97706]" />
          <span>Initial Super Admin account setup</span>
        </Link>
        <p className="pt-1">
          <Link to="/login" className="text-xs text-[#8A817A] hover:text-[#17202A] font-medium transition-colors">
            ← Switch Portal
          </Link>
        </p>
      </div>

      {/* Security notice footer */}
      <div className="mt-4 pt-3 text-center">
        <p className="text-[11px] text-[#8A817A]">
          Authorized SpiralDine platform administrators only.
        </p>
      </div>

      {/* Forgot Password Modal */}
      {isForgotModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
          <div className="bg-white border border-[#E8DED6] rounded-2xl p-6 max-w-md w-full shadow-2xl relative text-left">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2.5 rounded-xl bg-[#EBF3FC] text-[#1E40AF]">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#17202A]">Reset Super Admin Password</h3>
                <p className="text-xs text-[#667085]">Receive password reset instructions</p>
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
                  <label className="block text-xs font-semibold text-[#17202A] mb-1.5" htmlFor="sa-reset-email">
                    Administrator Email
                  </label>
                  <input
                    id="sa-reset-email"
                    type="email"
                    required
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="admin@spiraldine.internal"
                    className="w-full px-3.5 py-2.5 bg-[#FCFAF7] border border-[#E8DED6] rounded-xl text-sm text-[#17202A] placeholder-[#8A94A3] focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 focus:border-[#1E3A5F] transition-all"
                    disabled={resetStatus === 'loading'}
                  />
                </div>
                <div className="flex items-center justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsForgotModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-[#667085] hover:text-[#17202A] hover:bg-[#F5ECE4] transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={resetStatus === 'loading'}
                    className="px-4 py-2 rounded-xl bg-[#1E3A5F] text-white text-xs font-semibold hover:bg-[#152B47] transition-colors disabled:opacity-50 shadow-sm cursor-pointer"
                  >
                    {resetStatus === 'loading' ? 'Sending...' : 'Send Reset Link'}
                  </button>
                </div>
              </form>
            )}

            {resetStatus === 'success' && (
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setIsForgotModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#1E3A5F] text-white text-xs font-medium hover:bg-[#152B47] transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </SharedAuthLayout>
  );
};

export default SuperAdminLogin;
