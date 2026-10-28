import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  doc, 
  setDoc,
  getDocs,
  getDoc
} from 'firebase/firestore';
import { auth, db } from '../../../shared/firebase/config';
import { useAuth } from '../../../context/AuthContext';
import { 
  ClipboardCheck, 
  Search, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Building2, 
  Mail, 
  ExternalLink, 
  Check, 
  X, 
  MessageSquare, 
  RefreshCw,
  Globe,
  DollarSign,
  User,
  Filter
} from 'lucide-react';
import { IRestaurantApplication, TApplicationStatus } from '../../../shared/domain/restaurant/types';
import toast from 'react-hot-toast';

export const SuperAdminApplications: React.FC = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightedAppId = searchParams.get('id');

  const [applications, setApplications] = useState<IRestaurantApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [listenerError, setListenerError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected' | 'more_info' | 'all'>('pending');

  // Modal Review State
  const [selectedApp, setSelectedApp] = useState<IRestaurantApplication | null>(null);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | 'request_info'>('approve');
  const [reviewNotes, setReviewNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Subscribe to authoritative real-time restaurants collection
  useEffect(() => {
    setIsLoading(true);
    setListenerError(null);

    const restColRef = collection(db, 'restaurants');
    
    const unsub = onSnapshot(restColRef, async (snapshot) => {
      try {
        const rawList: any[] = [];
        snapshot.forEach((docSnap) => {
          rawList.push({ id: docSnap.id, ...docSnap.data() });
        });

        // Enrich applicant details from users/{ownerUid} if missing
        const enrichedList: IRestaurantApplication[] = await Promise.all(rawList.map(async (r) => {
          let ownerEmail = r.ownerEmail || '';
          let ownerName = r.ownerName || '';

          if ((!ownerEmail || !ownerName) && r.ownerUid) {
            try {
              const uSnap = await getDoc(doc(db, 'users', r.ownerUid));
              if (uSnap.exists()) {
                const u = uSnap.data();
                ownerEmail = ownerEmail || u.email || '';
                ownerName = ownerName || u.fullName || u.displayName || '';
              }
            } catch (_uErr) {
              // fallback gracefully
            }
          }

          const rawStatus = r.status;
          const normalizedStatus: TApplicationStatus = 
            rawStatus === 'pending_approval' ? 'pending_approval' :
            rawStatus === 'rejected' ? 'rejected' :
            rawStatus === 'more_info_required' ? 'more_info_required' :
            'approved';

          return {
            id: r.id,
            tenantId: r.tenantId || r.id,
            restaurantName: r.restaurantName || r.name || 'Unnamed Restaurant',
            ownerUid: r.ownerUid || '',
            ownerEmail,
            ownerName: ownerName || 'Restaurant Owner',
            country: r.country || 'Global',
            currency: r.currency || 'USD',
            currencyCode: r.currencyCode || r.currency || 'USD',
            currencySymbol: r.currencySymbol || '$',
            locale: r.locale || 'en-US',
            status: normalizedStatus,
            submittedAt: r.submittedAt || r.createdAt || new Date().toISOString(),
            createdAt: r.createdAt || new Date().toISOString(),
            updatedAt: r.updatedAt || r.createdAt || new Date().toISOString(),
            reviewedAt: r.reviewedAt,
            reviewedBy: r.reviewedBy,
            reviewNotes: r.reviewNotes,
            rejectionReason: r.rejectionReason,
            moreInfoNotes: r.moreInfoNotes
          };
        }));

        // Sort newest first
        enrichedList.sort((a, b) => {
          const timeA = new Date(a.submittedAt || a.createdAt || 0).getTime();
          const timeB = new Date(b.submittedAt || b.createdAt || 0).getTime();
          return timeB - timeA;
        });

        setApplications(enrichedList);
        setListenerError(null);
        setIsLoading(false);

        // Auto-open modal if query param is set
        if (highlightedAppId) {
          const found = enrichedList.find(a => a.id === highlightedAppId || a.tenantId === highlightedAppId);
          if (found) {
            setSelectedApp(found);
          }
        }
      } catch (procErr: any) {
        console.error('[SuperAdminApplications] Processing error:', procErr);
        setListenerError(procErr.message || 'Failed to process application records');
        setIsLoading(false);
      }
    }, (err) => {
      console.error('[SuperAdminApplications] Listener error:', err);
      setListenerError(err.message || 'Permission denied or network connection failed.');
      setIsLoading(false);
    });

    return () => unsub();
  }, [highlightedAppId, refreshTrigger]);

  // Tab filtering
  const counts = {
    pending: applications.filter(a => a.status === 'pending_approval').length,
    approved: applications.filter(a => a.status === 'approved').length,
    rejected: applications.filter(a => a.status === 'rejected').length,
    more_info: applications.filter(a => a.status === 'more_info_required').length,
    all: applications.length
  };

  const filtered = applications.filter((app) => {
    // Status filter
    if (activeTab === 'pending' && app.status !== 'pending_approval') return false;
    if (activeTab === 'approved' && app.status !== 'approved') return false;
    if (activeTab === 'rejected' && app.status !== 'rejected') return false;
    if (activeTab === 'more_info' && app.status !== 'more_info_required') return false;

    // Search query
    const q = searchTerm.toLowerCase().trim();
    if (!q) return true;

    return (
      (app.restaurantName || '').toLowerCase().includes(q) ||
      (app.ownerName || '').toLowerCase().includes(q) ||
      (app.ownerEmail || '').toLowerCase().includes(q) ||
      (app.tenantId || '').toLowerCase().includes(q) ||
      (app.country || '').toLowerCase().includes(q) ||
      (app.id || '').toLowerCase().includes(q)
    );
  });

  const handleOpenReviewModal = (app: IRestaurantApplication, initialAction: 'approve' | 'reject' | 'request_info' = 'approve') => {
    setSelectedApp(app);
    setReviewAction(initialAction);
    setReviewNotes(app.reviewNotes || '');
    setRejectionReason(app.rejectionReason || '');
  };

  const handleCloseReviewModal = () => {
    setSelectedApp(null);
    setReviewNotes('');
    setRejectionReason('');
    if (highlightedAppId) {
      setSearchParams({});
    }
  };

  const handleExecuteReview = async () => {
    if (!selectedApp) return;

    if (reviewAction === 'reject' && !rejectionReason.trim()) {
      toast.error('Please specify a rejection reason for the applicant.');
      return;
    }

    if (reviewAction === 'request_info' && !reviewNotes.trim()) {
      toast.error('Please enter the information or documentation requested.');
      return;
    }

    setIsSubmitting(true);
    const loadingToast = toast.loading(`Processing application ${reviewAction}...`);

    try {
      let token = '';
      if (auth.currentUser) {
        token = await auth.currentUser.getIdToken(true);
      }

      // Call serverless API endpoint
      const response = await fetch('/api/super-admin/review-application', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          applicationId: selectedApp.id,
          action: reviewAction,
          notes: reviewNotes.trim(),
          reason: rejectionReason.trim()
        })
      });

      const resData = await response.json();

      if (!response.ok) {
        throw new Error(resData.error || 'Server error reviewing application');
      }

      toast.dismiss(loadingToast);
      toast.success(
        reviewAction === 'approve'
          ? `Application approved! ${selectedApp.restaurantName} is now active.`
          : reviewAction === 'reject'
          ? `Application rejected.`
          : `Requested additional information from applicant.`
      );

      handleCloseReviewModal();
    } catch (apiErr: any) {
      console.warn('[SuperAdminApplications] Server API call encountered error, attempting direct client fallback:', apiErr);

      // Direct fallback using Super Admin client privileges if server endpoint unavailable
      try {
        const nowIso = new Date().toISOString();
        const targetStatus: TApplicationStatus = 
          reviewAction === 'approve' 
            ? 'approved' 
            : reviewAction === 'reject' 
            ? 'rejected' 
            : 'more_info_required';

        const restaurantStatus = reviewAction === 'approve' ? 'active' : reviewAction === 'reject' ? 'rejected' : 'more_info_required';
        const tenantStatus = reviewAction === 'approve' ? 'active' : reviewAction === 'reject' ? 'rejected' : 'more_info_required';

        // 1. Update restaurant doc (Authoritative)
        await setDoc(doc(db, 'restaurants', selectedApp.tenantId), {
          status: restaurantStatus,
          reviewedAt: nowIso,
          reviewedBy: user?.uid || 'super-admin',
          reviewNotes: reviewNotes.trim(),
          rejectionReason: reviewAction === 'reject' ? rejectionReason.trim() : null,
          moreInfoNotes: reviewAction === 'request_info' ? reviewNotes.trim() : null,
          updatedAt: nowIso
        }, { merge: true });

        // 2. Update tenant doc
        await setDoc(doc(db, 'tenants', selectedApp.tenantId), {
          status: tenantStatus,
          updatedAt: nowIso
        }, { merge: true });

        // 3. Update user doc
        if (selectedApp.ownerUid) {
          await setDoc(doc(db, 'users', selectedApp.ownerUid), {
            status: tenantStatus,
            updatedAt: nowIso
          }, { merge: true });
        }

        // 4. Safe sync to restaurantApplications doc
        try {
          await setDoc(doc(db, 'restaurantApplications', selectedApp.id), {
            status: targetStatus,
            reviewedAt: nowIso,
            reviewedBy: user?.uid || 'super-admin',
            reviewNotes: reviewNotes.trim(),
            rejectionReason: reviewAction === 'reject' ? rejectionReason.trim() : null,
            moreInfoNotes: reviewAction === 'request_info' ? reviewNotes.trim() : null,
            updatedAt: nowIso
          }, { merge: true });
        } catch (_syncErr) {
          console.warn('[SuperAdminApplications] Note: direct app sync handled:', _syncErr);
        }

        toast.dismiss(loadingToast);
        toast.success(`Application updated directly (${reviewAction}).`);
        handleCloseReviewModal();
      } catch (fallbackErr: any) {
        toast.dismiss(loadingToast);
        toast.error(fallbackErr.message || 'Failed to update application');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-extrabold text-white tracking-tight">
                Restaurant Registration Applications
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Review and approve incoming restaurant onboarding requests before merchant access is granted.
              </p>
            </div>
          </div>
        </div>

        {/* Actions & Counter Pill */}
        <div className="flex items-center space-x-2">
          {counts.pending > 0 && (
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold animate-pulse">
              <Clock className="w-3.5 h-3.5" />
              <span>{counts.pending} Application{counts.pending === 1 ? '' : 's'} Pending Review</span>
            </div>
          )}

          <button
            onClick={() => setRefreshTrigger(prev => prev + 1)}
            disabled={isLoading}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center space-x-1.5 disabled:opacity-50"
            title="Refresh applications from database"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Query Error Alert */}
      {listenerError && (
        <div className="p-4 sm:p-5 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-start space-x-3.5 text-rose-300">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-bold text-white">Database Query Problem</h3>
            <p className="text-xs text-rose-300/80 mt-1">{listenerError}</p>
            <button
              onClick={() => setRefreshTrigger(prev => prev + 1)}
              className="mt-3 px-3.5 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40 rounded-xl text-xs font-bold transition-colors inline-flex items-center space-x-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Query</span>
            </button>
          </div>
        </div>
      )}

      {/* Tabs & Search Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#0A0F17] p-3 rounded-2xl border border-slate-800">
        {/* Tabs */}
        <div className="flex items-center space-x-1 overflow-x-auto pb-2 md:pb-0">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 shrink-0 ${
              activeTab === 'pending'
                ? 'bg-amber-500 text-black shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <span>Pending Review</span>
            {counts.pending > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${activeTab === 'pending' ? 'bg-black text-amber-400' : 'bg-amber-500/20 text-amber-400'}`}>
                {counts.pending}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('approved')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 shrink-0 ${
              activeTab === 'approved'
                ? 'bg-emerald-500 text-black shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <span>Approved</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${activeTab === 'approved' ? 'bg-black text-emerald-400' : 'bg-slate-800 text-slate-300'}`}>
              {counts.approved}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('rejected')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 shrink-0 ${
              activeTab === 'rejected'
                ? 'bg-rose-500 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <span>Rejected</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${activeTab === 'rejected' ? 'bg-black/40 text-white' : 'bg-slate-800 text-slate-300'}`}>
              {counts.rejected}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('more_info')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 shrink-0 ${
              activeTab === 'more_info'
                ? 'bg-blue-500 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <span>More Info</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${activeTab === 'more_info' ? 'bg-black/40 text-white' : 'bg-slate-800 text-slate-300'}`}>
              {counts.more_info}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeTab === 'all'
                ? 'bg-slate-700 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <span>All ({counts.all})</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative min-w-[260px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search restaurant, owner, email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-primary transition-colors"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Applications Table */}
      {isLoading ? (
        <div className="p-16 flex flex-col items-center justify-center space-y-4 bg-[#0A0F17] rounded-2xl border border-slate-800">
          <div className="w-10 h-10 rounded-full border-4 border-slate-800 border-t-primary animate-spin" />
          <span className="text-xs text-slate-400">Loading restaurant applications...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-16 text-center bg-[#0A0F17] rounded-2xl border border-slate-800 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-800/80 mx-auto flex items-center justify-center text-slate-500">
            <ClipboardCheck className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-white">No applications found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {searchTerm 
              ? `No applications matched "${searchTerm}". Try adjusting your search.`
              : activeTab === 'pending'
              ? 'Great job! There are currently no applications waiting for review.'
              : `No applications in the "${activeTab}" category.`}
          </p>
        </div>
      ) : (
        <div className="bg-[#0A0F17] rounded-2xl border border-slate-800 overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3.5 px-4">Restaurant</th>
                  <th className="py-3.5 px-4">Owner / Contact</th>
                  <th className="py-3.5 px-4">Location & Currency</th>
                  <th className="py-3.5 px-4">Submitted</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filtered.map((app) => {
                  const status = app.status || 'pending_approval';
                  const isHighlighted = highlightedAppId === app.id || highlightedAppId === app.tenantId;

                  return (
                    <tr 
                      key={app.id} 
                      className={`hover:bg-slate-850/50 transition-colors ${
                        isHighlighted ? 'bg-primary/5 ring-1 ring-inset ring-primary/30' : ''
                      }`}
                    >
                      {/* Restaurant */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-primary shrink-0 font-display font-extrabold text-sm">
                            {(app.restaurantName || 'R')[0].toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-white text-sm flex items-center space-x-2">
                              <span>{app.restaurantName || 'Unnamed Restaurant'}</span>
                            </div>
                            <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                              ID: {app.tenantId || app.id}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Owner */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <div className="font-semibold text-slate-200 flex items-center space-x-1.5">
                            <User className="w-3 h-3 text-slate-400" />
                            <span>{app.ownerName || 'Restaurant Owner'}</span>
                          </div>
                          <div className="text-slate-400 flex items-center space-x-1.5">
                            <Mail className="w-3 h-3 text-slate-500" />
                            <span>{app.ownerEmail}</span>
                          </div>
                        </div>
                      </td>

                      {/* Location & Currency */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <div className="text-slate-300 font-medium flex items-center space-x-1.5">
                            <Globe className="w-3 h-3 text-slate-400" />
                            <span>{app.country || 'Global'}</span>
                          </div>
                          <div className="text-slate-400 text-[11px] font-mono">
                            {app.currency || 'USD'} {app.currencySymbol ? `(${app.currencySymbol})` : ''}
                          </div>
                        </div>
                      </td>

                      {/* Submitted Date */}
                      <td className="py-3.5 px-4 text-slate-400 whitespace-nowrap">
                        <div>
                          {app.submittedAt 
                            ? new Date(app.submittedAt).toLocaleDateString(undefined, {
                                month: 'short', day: 'numeric', year: 'numeric'
                              })
                            : 'Recently'}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {app.submittedAt 
                            ? new Date(app.submittedAt).toLocaleTimeString(undefined, {
                                hour: '2-digit', minute: '2-digit'
                              })
                            : ''}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {status === 'approved' && (
                          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Approved</span>
                          </span>
                        )}
                        {status === 'pending_approval' && (
                          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 animate-pulse">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Pending Review</span>
                          </span>
                        )}
                        {status === 'rejected' && (
                          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Rejected</span>
                          </span>
                        )}
                        {status === 'more_info_required' && (
                          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/30">
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>More Info</span>
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleOpenReviewModal(app, 'approve')}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-primary hover:text-black text-slate-200 font-bold rounded-lg text-xs transition-colors border border-slate-700"
                          >
                            Review
                          </button>

                          {status === 'pending_approval' && (
                            <>
                              <button
                                title="Quick Approve"
                                onClick={() => handleOpenReviewModal(app, 'approve')}
                                className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-black rounded-lg transition-colors border border-emerald-500/30"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                title="Quick Reject"
                                onClick={() => handleOpenReviewModal(app, 'reject')}
                                className="p-1.5 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white rounded-lg transition-colors border border-rose-500/30"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Review & Decision Modal */}
      {selectedApp && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-[#0D1420] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                  <ClipboardCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-display font-extrabold text-white">
                    Review Restaurant Application
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Application ID: <span className="font-mono text-slate-300">{selectedApp.id}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseReviewModal}
                disabled={isSubmitting}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Application Details Card */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-900/80 border border-slate-800/80">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Restaurant Name</span>
                  <div className="text-sm font-bold text-white mt-0.5">{selectedApp.restaurantName}</div>
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Tenant Workspace ID</span>
                  <div className="text-xs font-mono text-slate-300 mt-0.5">{selectedApp.tenantId}</div>
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Owner Full Name</span>
                  <div className="text-xs font-semibold text-slate-200 mt-0.5">{selectedApp.ownerName}</div>
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Owner Email</span>
                  <div className="text-xs font-mono text-slate-300 mt-0.5">{selectedApp.ownerEmail}</div>
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Country & Currency</span>
                  <div className="text-xs text-slate-300 mt-0.5">
                    {selectedApp.country || 'Global'} &bull; {selectedApp.currency || 'USD'}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Current Status</span>
                  <div className="mt-0.5">
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-slate-800 text-slate-200 border border-slate-700">
                      {selectedApp.status || 'pending_approval'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Selector Segmented Control */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Administrative Decision
                </label>
                <div className="grid grid-cols-3 gap-2 p-1 bg-slate-900 border border-slate-800 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setReviewAction('approve')}
                    className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-1.5 ${
                      reviewAction === 'approve'
                        ? 'bg-emerald-500 text-black shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Approve</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReviewAction('reject')}
                    className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-1.5 ${
                      reviewAction === 'reject'
                        ? 'bg-rose-500 text-white shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Reject</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReviewAction('request_info')}
                    className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-1.5 ${
                      reviewAction === 'request_info'
                        ? 'bg-blue-500 text-white shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Request Info</span>
                  </button>
                </div>
              </div>

              {/* Action Description & Input Fields */}
              {reviewAction === 'approve' && (
                <div className="space-y-3 p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/20">
                  <div className="text-xs text-emerald-300 font-semibold">
                    Approving this application will immediately:
                  </div>
                  <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside">
                    <li>Activate the tenant document (<span className="font-mono text-emerald-400">status: 'active'</span>).</li>
                    <li>Activate the restaurant record and owner user account.</li>
                    <li>Grant full merchant clearance for the Owner Portal.</li>
                    <li>Dispatch a welcome & approval email to <strong>{selectedApp.ownerEmail}</strong>.</li>
                  </ul>

                  <div className="pt-2">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Approval Note (Optional, included in email)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Welcome aboard! Your starter tier is ready."
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              )}

              {reviewAction === 'reject' && (
                <div className="space-y-3 p-4 rounded-xl bg-rose-950/20 border border-rose-500/20">
                  <div className="text-xs text-rose-300 font-semibold">
                    Rejecting this application will:
                  </div>
                  <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside">
                    <li>Mark the application, tenant, and owner as rejected.</li>
                    <li>Continue blocking access to all owner dashboards.</li>
                    <li>Send an explanation email with the reason specified below.</li>
                  </ul>

                  <div className="pt-2">
                    <label className="text-[11px] font-bold text-rose-300 uppercase tracking-wider block mb-1">
                      Reason for Rejection (Required) *
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Explain why the registration was not approved (e.g. Incomplete business address, duplicate restaurant entity, unverified contact)."
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-rose-500/40 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                    />
                  </div>
                </div>
              )}

              {reviewAction === 'request_info' && (
                <div className="space-y-3 p-4 rounded-xl bg-blue-950/20 border border-blue-500/20">
                  <div className="text-xs text-blue-300 font-semibold">
                    Requesting additional information will:
                  </div>
                  <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside">
                    <li>Set application status to <span className="font-mono text-blue-400">'more_info_required'</span>.</li>
                    <li>Display the requested items on the applicant's status page.</li>
                    <li>Email the instructions directly to the applicant.</li>
                  </ul>

                  <div className="pt-2">
                    <label className="text-[11px] font-bold text-blue-300 uppercase tracking-wider block mb-1">
                      Information Required from Applicant *
                    </label>
                    <textarea
                      rows={3}
                      placeholder="e.g. Please provide your business registration number or commercial kitchen operating license."
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-blue-500/40 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between">
              <button
                type="button"
                onClick={handleCloseReviewModal}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleExecuteReview}
                disabled={isSubmitting}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md flex items-center space-x-2 ${
                  reviewAction === 'approve'
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-black'
                    : reviewAction === 'reject'
                    ? 'bg-rose-500 hover:bg-rose-400 text-white'
                    : 'bg-blue-500 hover:bg-blue-400 text-white'
                } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : reviewAction === 'approve' ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Approve & Activate Restaurant</span>
                  </>
                ) : reviewAction === 'reject' ? (
                  <>
                    <X className="w-3.5 h-3.5" />
                    <span>Confirm Rejection</span>
                  </>
                ) : (
                  <>
                    <Mail className="w-3.5 h-3.5" />
                    <span>Send Request for Information</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminApplications;
