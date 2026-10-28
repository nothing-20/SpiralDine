import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Building2, 
  Mail, 
  LogOut, 
  RefreshCw, 
  ArrowRight,
  ShieldCheck,
  HelpCircle
} from 'lucide-react';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { auth, db } from '../../../shared/firebase/config';
import { useAuth } from '../../../context/AuthContext';
import { authService } from '../../../shared/services/authService';
import { IRestaurantApplication, TApplicationStatus } from '../../../shared/domain/restaurant/types';
import toast from 'react-hot-toast';

export const ApplicationPendingPage: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [application, setApplication] = useState<IRestaurantApplication | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const tenantId = user?.tenantId || (application?.tenantId ?? '');
  const ownerUid = user?.uid || auth.currentUser?.uid;

  // Real-time listener for application status updates
  useEffect(() => {
    if (!ownerUid) {
      setIsLoading(false);
      return;
    }

    let unsubApp: (() => void) | null = null;

    const setupListener = async () => {
      try {
        const candidateId = tenantId || ownerUid;
        
        // Listen to authoritative restaurants collection
        const restRef = doc(db, 'restaurants', candidateId);
        unsubApp = onSnapshot(restRef, (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            const normalizedStatus: TApplicationStatus = 
              (data.status === 'active' || data.status === 'approved') ? 'approved' :
              data.status === 'rejected' ? 'rejected' :
              data.status === 'more_info_required' ? 'more_info_required' :
              'pending_approval';

            setApplication({
              id: candidateId,
              tenantId: data.tenantId || candidateId,
              restaurantName: data.restaurantName || data.name || 'Your Restaurant',
              ownerUid: data.ownerUid || ownerUid,
              ownerEmail: data.ownerEmail || auth.currentUser?.email || '',
              ownerName: data.ownerName || data.name || 'Restaurant Owner',
              country: data.country || 'Global',
              currency: data.currency || 'USD',
              status: normalizedStatus,
              submittedAt: data.createdAt || new Date().toISOString(),
              createdAt: data.createdAt || new Date().toISOString(),
              updatedAt: data.updatedAt || data.createdAt || new Date().toISOString(),
              reviewNotes: data.reviewNotes,
              rejectionReason: data.rejectionReason,
              moreInfoNotes: data.moreInfoNotes
            });
            setIsLoading(false);

            if (normalizedStatus === 'approved') {
              toast.success('Your restaurant application has been approved! You now have full owner access.', {
                duration: 6000
              });
            }
          } else {
            // Check users/{uid} for status fallback
            const userRef = doc(db, 'users', ownerUid);
            getDoc(userRef).then((uSnap) => {
              if (uSnap.exists()) {
                const uData = uSnap.data();
                const uStatus: TApplicationStatus = 
                  (uData.status === 'active' || uData.status === 'approved') ? 'approved' :
                  uData.status === 'rejected' ? 'rejected' :
                  uData.status === 'more_info_required' ? 'more_info_required' :
                  'pending_approval';

                setApplication({
                  id: candidateId,
                  tenantId: uData.tenantId || candidateId,
                  restaurantName: uData.restaurantName || uData.displayName || 'Your Restaurant',
                  ownerUid: ownerUid,
                  ownerEmail: uData.email || auth.currentUser?.email || '',
                  ownerName: uData.fullName || uData.displayName || '',
                  country: uData.country || 'Global',
                  currency: uData.currency || 'USD',
                  status: uStatus,
                  submittedAt: uData.createdAt || new Date().toISOString(),
                  createdAt: uData.createdAt || new Date().toISOString(),
                  updatedAt: uData.createdAt || new Date().toISOString()
                });
              }
              setIsLoading(false);
            }).catch(() => setIsLoading(false));
          }
        }, (err) => {
          console.warn('[ApplicationPendingPage] Restaurants listener note, attempting users fallback:', err);
          
          // Fallback to users/{uid}
          const userRef = doc(db, 'users', ownerUid);
          getDoc(userRef).then((uSnap) => {
            if (uSnap.exists()) {
              const uData = uSnap.data();
              const uStatus: TApplicationStatus = 
                (uData.status === 'active' || uData.status === 'approved') ? 'approved' :
                uData.status === 'rejected' ? 'rejected' :
                uData.status === 'more_info_required' ? 'more_info_required' :
                'pending_approval';

              setApplication({
                id: candidateId,
                tenantId: uData.tenantId || candidateId,
                restaurantName: uData.restaurantName || uData.displayName || 'Your Restaurant',
                ownerUid: ownerUid,
                ownerEmail: uData.email || auth.currentUser?.email || '',
                ownerName: uData.fullName || uData.displayName || '',
                country: uData.country || 'Global',
                currency: uData.currency || 'USD',
                status: uStatus,
                submittedAt: uData.createdAt || new Date().toISOString(),
                createdAt: uData.createdAt || new Date().toISOString(),
                updatedAt: uData.createdAt || new Date().toISOString()
              });
            }
            setIsLoading(false);
          }).catch(() => setIsLoading(false));
        });
      } catch (err) {
        console.warn('[ApplicationPendingPage] Setup error:', err);
        setIsLoading(false);
      }
    };

    setupListener();

    return () => {
      if (unsubApp) unsubApp();
    };
  }, [ownerUid, tenantId]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      if (auth.currentUser) {
        await auth.currentUser.getIdToken(true);
      }
      const candidateId = tenantId || ownerUid || '';
      if (candidateId) {
        const restSnap = await getDoc(doc(db, 'restaurants', candidateId));
        if (restSnap.exists()) {
          const rData = restSnap.data();
          const normalizedStatus: TApplicationStatus = 
            (rData.status === 'active' || rData.status === 'approved') ? 'approved' :
            rData.status === 'rejected' ? 'rejected' :
            rData.status === 'more_info_required' ? 'more_info_required' :
            'pending_approval';

          setApplication({
            id: candidateId,
            tenantId: rData.tenantId || candidateId,
            restaurantName: rData.restaurantName || rData.name || 'Your Restaurant',
            ownerUid: rData.ownerUid || ownerUid,
            ownerEmail: rData.ownerEmail || auth.currentUser?.email || '',
            ownerName: rData.ownerName || rData.name || 'Restaurant Owner',
            country: rData.country || 'Global',
            currency: rData.currency || 'USD',
            status: normalizedStatus,
            submittedAt: rData.createdAt || new Date().toISOString(),
            createdAt: rData.createdAt || new Date().toISOString(),
            updatedAt: rData.updatedAt || rData.createdAt || new Date().toISOString(),
            reviewNotes: rData.reviewNotes,
            rejectionReason: rData.rejectionReason,
            moreInfoNotes: rData.moreInfoNotes
          });
        }
      }
      toast.success('Application status refreshed');
    } catch (e) {
      console.error(e);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await logout();
      await authService.signOutUser();
      navigate('/login', { replace: true });
    } catch (err) {
      console.error(err);
      navigate('/login', { replace: true });
    }
  };

  const handleGoToDashboard = () => {
    navigate('/owner/dashboard', { replace: true });
  };

  const status = application?.status || (user?.status as TApplicationStatus) || 'pending_approval';

  return (
    <div className="min-h-screen bg-[#FCFAF7] text-[#17233D] flex flex-col justify-between font-sans relative selection:bg-primary/20">
      {/* Top Navbar */}
      <header className="w-full bg-white/80 backdrop-blur-md border-b border-[#E8E2D9] px-6 py-4 flex items-center justify-between z-20">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#1E3A2B] to-[#2B543D] flex items-center justify-center text-white shadow-sm font-display font-extrabold text-lg">
            S
          </div>
          <div>
            <span className="font-display font-extrabold text-base tracking-tight text-[#17233D]">
              SpiralDine
            </span>
            <span className="ml-2 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
              Onboarding
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={handleSignOut}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors border border-rose-200"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-12 flex flex-col items-center justify-center z-10">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center space-y-4 p-8">
            <div className="w-12 h-12 rounded-full border-4 border-slate-200 border-t-[#C97A52] animate-spin" />
            <span className="text-sm font-semibold text-slate-500">Checking application status...</span>
          </div>
        ) : (
          <div className="w-full bg-white rounded-2xl border border-[#E8E2D9] shadow-sm overflow-hidden">
            {/* Status Header Banner */}
            {status === 'approved' && (
              <div className="bg-emerald-500 text-white px-6 py-4 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <CheckCircle2 className="w-6 h-6 shrink-0" />
                  <div>
                    <h2 className="font-display font-extrabold text-base">Application Approved!</h2>
                    <p className="text-xs text-emerald-100">Your restaurant account has been reviewed and verified by SpiralDine administrators.</p>
                  </div>
                </div>
                <button
                  onClick={handleGoToDashboard}
                  className="px-4 py-2 bg-white text-emerald-700 font-bold text-xs rounded-xl hover:bg-emerald-50 transition-colors shadow-sm flex items-center space-x-1.5 shrink-0"
                >
                  <span>Go to Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {status === 'pending_approval' && (
              <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-white px-6 py-4 flex items-center space-x-3">
                <Clock className="w-6 h-6 shrink-0 animate-pulse" />
                <div>
                  <h2 className="font-display font-extrabold text-base">Application Under Review</h2>
                  <p className="text-xs text-amber-100">Your restaurant registration has been submitted and is currently awaiting administrator approval.</p>
                </div>
              </div>
            )}

            {status === 'more_info_required' && (
              <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-6 py-4 flex items-center space-x-3">
                <AlertCircle className="w-6 h-6 shrink-0" />
                <div>
                  <h2 className="font-display font-extrabold text-base">Additional Information Required</h2>
                  <p className="text-xs text-blue-100">Our administrative team has requested additional details before your account can be approved.</p>
                </div>
              </div>
            )}

            {status === 'rejected' && (
              <div className="bg-gradient-to-r from-rose-500 to-rose-600 text-white px-6 py-4 flex items-center space-x-3">
                <XCircle className="w-6 h-6 shrink-0" />
                <div>
                  <h2 className="font-display font-extrabold text-base">Application Not Approved</h2>
                  <p className="text-xs text-rose-100">Your restaurant registration could not be approved at this time.</p>
                </div>
              </div>
            )}

            {/* Application Details Body */}
            <div className="p-8 space-y-8">
              {/* Restaurant & Applicant Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5 rounded-xl bg-[#F8F5EE] border border-[#E8E2D9]">
                <div className="space-y-1">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1.5">
                    <Building2 className="w-3.5 h-3.5 text-[#C97A52]" />
                    <span>Restaurant Name</span>
                  </div>
                  <div className="text-base font-display font-bold text-[#17233D]">
                    {application?.restaurantName || 'Registered Restaurant'}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1.5">
                    <Mail className="w-3.5 h-3.5 text-[#C97A52]" />
                    <span>Owner Account</span>
                  </div>
                  <div className="text-sm font-semibold text-slate-700">
                    {application?.ownerName || user?.displayName || 'Restaurant Owner'}
                  </div>
                  <div className="text-xs text-slate-500">
                    {application?.ownerEmail || user?.email || auth.currentUser?.email}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Application ID
                  </div>
                  <div className="font-mono text-xs text-slate-700 bg-white px-2 py-1 rounded border border-slate-200 inline-block">
                    {application?.id || tenantId || 'Pending'}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Submission Date
                  </div>
                  <div className="text-xs text-slate-600">
                    {application?.submittedAt 
                      ? new Date(application.submittedAt).toLocaleDateString(undefined, { 
                          year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' 
                        }) 
                      : 'Just now'}
                  </div>
                </div>
              </div>

              {/* Specific Status Explanations */}
              {status === 'pending_approval' && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <h3 className="font-display font-bold text-lg text-[#17233D]">
                      What happens next?
                    </h3>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      To safeguard our dining network, all new restaurant registrations undergo administrative review before merchant access is granted. Our administrators have been notified of your registration.
                    </p>
                  </div>

                  {/* 3-Step Timeline */}
                  <div className="space-y-4">
                    <div className="flex items-start space-x-3">
                      <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-800">1. Registration Submitted</div>
                        <div className="text-xs text-slate-500">Your restaurant application details have been safely recorded.</div>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3">
                      <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5 animate-pulse">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-800">2. Administrator Review (Current)</div>
                        <div className="text-xs text-slate-500">An authorized SpiralDine Super Admin is reviewing your restaurant information. Most applications are reviewed within 24 business hours.</div>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3">
                      <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center shrink-0 mt-0.5">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-500">3. Portal Access Granted</div>
                        <div className="text-xs text-slate-400">Once approved, you will receive an email confirmation and instant access to your Owner Portal to create menus, tables, and staff accounts.</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {status === 'more_info_required' && (
                <div className="space-y-4 p-5 rounded-xl bg-blue-50 border border-blue-200">
                  <div className="text-sm font-bold text-blue-900">
                    Administrator Review Notes:
                  </div>
                  <div className="text-sm text-blue-800 bg-white p-4 rounded-lg border border-blue-100">
                    {application?.moreInfoNotes || 'Please contact our onboarding team to provide additional verification documents for your restaurant registration.'}
                  </div>
                  <div className="text-xs text-blue-700">
                    Please reply to the notification email or write to <a href="mailto:kumbhageethakrishna143@gmail.com" className="underline font-bold">kumbhageethakrishna143@gmail.com</a> with the requested details.
                  </div>
                </div>
              )}

              {status === 'rejected' && (
                <div className="space-y-4 p-5 rounded-xl bg-rose-50 border border-rose-200">
                  <div className="text-sm font-bold text-rose-900">
                    Reason for Rejection:
                  </div>
                  <div className="text-sm text-rose-800 bg-white p-4 rounded-lg border border-rose-100">
                    {application?.rejectionReason || 'The application did not satisfy our restaurant verification criteria or contained incomplete business details.'}
                  </div>
                  <div className="text-xs text-rose-700">
                    If you believe this was an error or wish to appeal, please contact <a href="mailto:kumbhageethakrishna143@gmail.com" className="underline font-bold">kumbhageethakrishna143@gmail.com</a>.
                  </div>
                </div>
              )}

              {/* Bottom Support Callout */}
              <div className="pt-4 border-t border-[#E8E2D9] flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
                <div className="flex items-center space-x-2">
                  <HelpCircle className="w-4 h-4 text-slate-400" />
                  <span>Have questions regarding your application?</span>
                </div>
                <div className="flex items-center space-x-4">
                  <a 
                    href="mailto:kumbhageethakrishna143@gmail.com" 
                    className="font-bold text-[#C97A52] hover:underline"
                  >
                    Contact Onboarding Support
                  </a>
                  <button 
                    onClick={handleSignOut}
                    className="text-slate-500 hover:text-slate-800 underline"
                  >
                    Sign in with another account
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-[#E8E2D9] py-4 text-center text-xs text-slate-500 bg-white/50">
        &copy; {new Date().getFullYear()} SpiralDine Platform. All rights reserved.
      </footer>
    </div>
  );
};

export default ApplicationPendingPage;
