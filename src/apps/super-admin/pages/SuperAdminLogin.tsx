import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  signInWithEmailAndPassword, 
  sendPasswordResetEmail, 
  signOut 
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../../config/firebase';
import { useAuth } from '../../../context/AuthContext';
import { ShieldCheck, Mail, Lock, AlertCircle, CheckCircle2, ArrowRight, KeyRound } from 'lucide-react';
import toast from 'react-hot-toast';

export const SuperAdminLogin: React.FC = () => {
  const navigate = useNavigate();
  const { user, role, isLoading: authLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      setErrorMessage('Please enter your administrator password.');
      return;
    }

    setIsLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
      const signedInUser = userCredential.user;

      // Force refresh token to obtain latest custom claims
      const tokenResult = await signedInUser.getIdTokenResult(true);
      const claimRole = tokenResult?.claims?.role;
      const hasClaimSuperAdmin = claimRole === 'super_admin' || claimRole === 'super-admin' || tokenResult?.claims?.super_admin === true;

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
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        msg = 'Invalid credentials. Please verify your email and password.';
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
    <div className="min-h-screen bg-[#070B11] text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden select-none">
      {/* Subtle ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-20 -right-20 w-[400px] h-[400px] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Main card */}
      <div className="w-full max-w-md relative z-10">
        <div className="bg-[#0B111B]/90 border border-slate-800/80 rounded-2xl p-8 shadow-2xl backdrop-blur-xl">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-primary/20 to-primary/5 border border-primary/30 text-primary mb-4 shadow-inner">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white font-display">SpiralDine</h1>
            <div className="inline-block mt-1 px-2.5 py-0.5 rounded-full bg-primary/15 border border-primary/30 text-primary text-[11px] font-semibold tracking-wider uppercase">
              Super Admin
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Privileged system administration portal
            </p>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="mb-6 p-3.5 rounded-xl bg-red-950/40 border border-red-800/60 text-red-300 text-xs flex items-start space-x-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
              <span className="leading-relaxed">{errorMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5" htmlFor="sa-email">
                Administrator Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
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
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900/80 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-slate-300" htmlFor="sa-password">
                  Security Key / Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setResetEmail(email);
                    setResetStatus('idle');
                    setResetMessage('');
                    setIsForgotModalOpen(true);
                  }}
                  className="text-xs text-primary hover:text-primary/80 transition-colors"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="sa-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900/80 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                  disabled={isLoading}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-2.5 px-4 rounded-xl bg-primary text-slate-950 font-semibold text-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/40 active:scale-[0.99] transition-all flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/20"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-slate-950 border-t-transparent animate-spin" />
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

          {/* Security notice footer */}
          <div className="mt-8 pt-6 border-t border-slate-800/60 text-center">
            <p className="text-[11px] text-slate-500">
              Direct administrative access only. Unauthorized connection attempts are logged.
            </p>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {isForgotModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#0B111B] border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl relative">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Reset Super Admin Password</h3>
                <p className="text-xs text-slate-400">Receive password reset instructions</p>
              </div>
            </div>

            {resetStatus === 'success' ? (
              <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/50 text-emerald-300 text-xs flex items-start space-x-2.5 mb-4">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                <span className="leading-relaxed">{resetMessage}</span>
              </div>
            ) : (
              <form onSubmit={handlePasswordReset} className="space-y-4">
                {resetStatus === 'error' && (
                  <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/50 text-red-300 text-xs flex items-start space-x-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                    <span>{resetMessage}</span>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1" htmlFor="sa-reset-email">
                    Administrator Email
                  </label>
                  <input
                    id="sa-reset-email"
                    type="email"
                    required
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="admin@spiraldine.internal"
                    className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-primary"
                    disabled={resetStatus === 'loading'}
                  />
                </div>
                <div className="flex items-center justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsForgotModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={resetStatus === 'loading'}
                    className="px-4 py-2 rounded-xl bg-primary text-slate-950 text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
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
                  className="px-4 py-2 rounded-xl bg-slate-800 text-white text-xs font-medium hover:bg-slate-700 transition-colors"
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
