import React, { useEffect, useState, useMemo } from 'react';
import { 
  collection, 
  onSnapshot, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc,
  query, 
  where 
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { useAuth } from '../../../context/AuthContext';
import { restaurantService } from '../../../shared/services/restaurantService';
import { reviewService } from '../../../shared/services/reviewService';
import { logAuditEvent } from '../../../shared/services/auditService';

// UI Kit components
import Card from '../../../components/ui/Card/Card';
import Badge from '../../../components/ui/Badge/Badge';
import Button from '../../../components/ui/Button/Button';
import Input from '../../../components/ui/Input/Input';
import Modal from '../../../components/ui/Modal/Modal';
import Dialog from '../../../components/ui/Dialog/Dialog';
import SearchBar from '../../../components/ui/SearchBar/SearchBar';
import LoadingSpinner from '../../../components/ui/LoadingSpinner/LoadingSpinner';
import EmptyState from '../../../components/ui/EmptyState/EmptyState';

// Toast & Icons
import toast from 'react-hot-toast';
import { 
  MessageSquareQuote, 
  Star, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  UserCheck, 
  Search, 
  Filter, 
  ThumbsUp, 
  ThumbsDown, 
  ChevronRight, 
  Sparkles, 
  Utensils, 
  Smile, 
  Frown,
  Send,
  Building2,
  FileText,
  Trash2
} from 'lucide-react';

export interface IFeedbackItem {
  id: string;
  customerName?: string;
  submittedByName?: string;
  submittedBy?: string;
  rating: string | number;
  category?: 'Food' | 'Service' | 'Cleanliness' | 'Ambience' | 'Waiting Time' | 'Other';
  notes: string;
  orderId?: string;
  tableNumber?: string;
  restaurantId?: string;
  restaurantName?: string;
  status?: 'New' | 'Assigned' | 'In Progress' | 'Resolved';
  assignedTo?: string;
  assignedToName?: string;
  internalNotes?: string;
  resolutionHistory?: {
    action: string;
    by: string;
    timestamp: string;
    notes?: string;
  }[];
  isComplaint?: boolean;
  isPositive?: boolean;
  serviceSpeed?: number;
  foodQuality?: number;
  cleanliness?: number;
  submittedAt: string;
}

export const OwnerFeedback: React.FC = () => {
  const { user } = useAuth();
  const tenantId = user?.tenantId;

  const [feedbacks, setFeedbacks] = useState<IFeedbackItem[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [ratingFilter, setRatingFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [restaurantFilter, setRestaurantFilter] = useState<string>('all');

  // Detail & Action Drawer
  const [selectedItem, setSelectedItem] = useState<IFeedbackItem | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState<boolean>(false);
  const [newInternalNote, setNewInternalNote] = useState<string>('');
  const [selectedStaffAssignee, setSelectedStaffAssignee] = useState<string>('');
  const [selectedNewStatus, setSelectedNewStatus] = useState<string>('');
  const [isSavingAction, setIsSavingAction] = useState<boolean>(false);

  // Deletion & Purge State
  const [deleteTargetFeedback, setDeleteTargetFeedback] = useState<IFeedbackItem | null>(null);
  const [isDeletingFeedback, setIsDeletingFeedback] = useState<boolean>(false);
  const [isPurgeFeedbackOpen, setIsPurgeFeedbackOpen] = useState<boolean>(false);
  const [isPurgingFeedback, setIsPurgingFeedback] = useState<boolean>(false);

  const handleDeleteSingleFeedback = async () => {
    if (!deleteTargetFeedback || !deleteTargetFeedback.id) return;
    setIsDeletingFeedback(true);
    const targetTenant = deleteTargetFeedback.restaurantId || tenantId || 'default';
    try {
      const res = await reviewService.deleteReview(targetTenant, deleteTargetFeedback.id);
      if (res.success) {
        toast.success('Feedback record deleted from Firestore');
        setFeedbacks(prev => prev.filter(f => f.id !== deleteTargetFeedback.id));
        setDeleteTargetFeedback(null);
        if (selectedItem?.id === deleteTargetFeedback.id) {
          setIsDetailsOpen(false);
          setSelectedItem(null);
        }
      } else {
        toast.error(res.error || 'Failed to delete feedback');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Delete failed');
    } finally {
      setIsDeletingFeedback(false);
    }
  };

  const handlePurgeTestFeedback = async () => {
    const targetTenant = tenantId || 'default';
    setIsPurgingFeedback(true);
    try {
      const res = await reviewService.purgeTestReviews(targetTenant);
      if (res.success) {
        toast.success(`Purged ${res.count} test feedback record${res.count !== 1 ? 's' : ''} from Firestore`);
        setFeedbacks(prev => prev.filter(f => {
          const notesStr = String(f.notes || '').toLowerCase().trim();
          const orderIdStr = String(f.orderId || '').toUpperCase().trim();
          const isTest = notesStr === 'super' ||
            notesStr === 'test' ||
            orderIdStr === 'ORD-OAPZGOG' ||
            orderIdStr === 'OAPZGOG' ||
            (f.id && f.id.startsWith('REV-'));
          return !isTest;
        }));
        setIsPurgeFeedbackOpen(false);
      } else {
        toast.error(res.error || 'Failed to purge test feedback');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Purge failed');
    } finally {
      setIsPurgingFeedback(false);
    }
  };

  // 1. Fetch feedbacks from Firestore
  useEffect(() => {
    if (!user) return;
    setIsLoading(true);

    const targetTenant = tenantId || 'default';

    // Load employees for assignment
    const fetchStaff = async () => {
      try {
        const snap = await getDocs(query(collection(db, 'employees'), where('tenantId', '==', targetTenant)));
        const emps: any[] = [];
        snap.forEach(d => emps.push({ id: d.id, ...d.data() }));
        setEmployees(emps);
      } catch (_) {}
    };
    fetchStaff();

    // Load authorized restaurants
    const fetchRestaurants = async () => {
      try {
        const rList = await restaurantService.getAuthorizedRestaurants(user);
        setRestaurants(rList);
      } catch (_) {}
    };
    fetchRestaurants();

    // Listen to satisfactionRatings
    const unsub = onSnapshot(
      collection(db, 'restaurants', targetTenant, 'satisfactionRatings'),
      (snapshot) => {
        const list: IFeedbackItem[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          list.push({
            id: docSnap.id,
            customerName: data.submittedByName || data.customerName || 'Guest Diner',
            rating: data.rating || 'Good',
            category: data.category || (data.foodQuality && data.foodQuality < 3 ? 'Food' : data.serviceSpeed && data.serviceSpeed < 3 ? 'Service' : 'Food'),
            notes: data.notes || data.comments || 'Feedback registered without additional comments.',
            orderId: data.orderId || '',
            tableNumber: data.tableNumber || '',
            restaurantId: data.tenantId || targetTenant,
            restaurantName: 'SpiralDine Bistro',
            status: data.status || (data.isComplaint ? 'New' : 'Resolved'),
            assignedTo: data.assignedTo || '',
            assignedToName: data.assignedToName || '',
            internalNotes: data.internalNotes || '',
            resolutionHistory: data.resolutionHistory || [],
            isComplaint: data.isComplaint || data.rating === 'Complaint' || data.rating === 'Needs Attention',
            isPositive: data.isPositive ?? (data.rating === 'Excellent' || data.rating === 'Good'),
            submittedAt: data.submittedAt || new Date().toISOString()
          });
        });

        // Sort recent first
        list.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

        setFeedbacks(list);
        setIsLoading(false);
      },
      (err) => {
        console.error('Feedback stream error:', err);
        setIsLoading(false);
      }
    );

    return () => unsub();
  }, [user, tenantId]);

  // Filtered feedback list
  const filteredFeedbacks = useMemo(() => {
    return feedbacks.filter((f) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchCust = f.customerName?.toLowerCase().includes(q);
        const matchNotes = f.notes?.toLowerCase().includes(q);
        const matchOrder = f.orderId?.toLowerCase().includes(q);
        const matchTable = f.tableNumber?.toLowerCase().includes(q);
        if (!matchCust && !matchNotes && !matchOrder && !matchTable) return false;
      }

      // 2. Status Filter
      if (statusFilter !== 'all') {
        if (f.status !== statusFilter) return false;
      }

      // 3. Category Filter
      if (categoryFilter !== 'all') {
        if (f.category !== categoryFilter) return false;
      }

      // 4. Rating Filter
      if (ratingFilter !== 'all') {
        if (ratingFilter === 'positive' && !f.isPositive) return false;
        if (ratingFilter === 'complaint' && !f.isComplaint) return false;
      }

      // 5. Restaurant Filter
      if (restaurantFilter !== 'all') {
        if (f.restaurantId !== restaurantFilter) return false;
      }

      return true;
    });
  }, [feedbacks, searchQuery, statusFilter, categoryFilter, ratingFilter, restaurantFilter]);

  // Overall Statistics
  const stats = useMemo(() => {
    const total = feedbacks.length;
    const complaints = feedbacks.filter(f => f.isComplaint).length;
    const positive = feedbacks.filter(f => f.isPositive).length;
    const resolved = feedbacks.filter(f => f.status === 'Resolved').length;
    const csatPercent = total > 0 ? Math.round((positive / total) * 100) : 100;

    return { total, complaints, positive, resolved, csatPercent };
  }, [feedbacks]);

  // Open Details Modal
  const handleOpenDetails = (item: IFeedbackItem) => {
    setSelectedItem(item);
    setSelectedStaffAssignee(item.assignedTo || '');
    setSelectedNewStatus(item.status || 'New');
    setNewInternalNote('');
    setIsDetailsOpen(true);
  };

  // Submit Resolution & Assignment Update
  const handleSaveResolution = async () => {
    if (!selectedItem) return;
    setIsSavingAction(true);
    const targetTenant = selectedItem.restaurantId || tenantId || 'default';

    try {
      const now = new Date().toISOString();
      const staffMember = employees.find(e => e.id === selectedStaffAssignee);

      const historyEntry = {
        action: `Status changed to ${selectedNewStatus}${staffMember ? `, assigned to ${staffMember.fullName || staffMember.name}` : ''}`,
        by: user?.displayName || user?.email || 'Owner',
        timestamp: now,
        notes: newInternalNote.trim() || undefined
      };

      const existingHistory = selectedItem.resolutionHistory || [];
      const updatedHistory = [historyEntry, ...existingHistory];

      const updatePayload: any = {
        status: selectedNewStatus,
        assignedTo: selectedStaffAssignee || null,
        assignedToName: staffMember ? (staffMember.fullName || staffMember.name) : null,
        resolutionHistory: updatedHistory,
        updatedAt: now
      };

      if (newInternalNote.trim()) {
        updatePayload.internalNotes = selectedItem.internalNotes 
          ? `${selectedItem.internalNotes}\n[${now.slice(0, 10)}] ${newInternalNote.trim()}`
          : newInternalNote.trim();
      }

      await updateDoc(doc(db, 'restaurants', targetTenant, 'satisfactionRatings', selectedItem.id), updatePayload);

      await logAuditEvent({
        userId: user?.uid || '',
        userEmail: user?.email || '',
        userName: user?.displayName || 'Owner',
        userRole: user?.role || 'owner',
        tenantId: targetTenant,
        module: 'Feedback',
        action: 'UPDATE',
        targetEntity: `Feedback for Order #${selectedItem.orderId || selectedItem.id}`,
        newValue: updatePayload
      });

      toast.success('Feedback status & resolution recorded');
      setIsDetailsOpen(false);
    } catch (err) {
      console.error('Update feedback error:', err);
      toast.error('Failed to update resolution');
    } finally {
      setIsSavingAction(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 select-none">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-2 rounded-xl bg-[#12352D] text-white shadow-sm">
              <MessageSquareQuote className="w-5 h-5 text-[#B33E26]" />
            </span>
            <h1 className="text-2xl font-serif font-bold text-[#17202A] tracking-tight">
              Customer Feedback & Complaints
            </h1>
          </div>
          <p className="text-xs text-[#475569] mt-1">
            Centralized diner reviews, complaint resolution workflows, and guest satisfaction analytics.
          </p>
        </div>

        {feedbacks.length > 0 && (
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsPurgeFeedbackOpen(true)}
              className="text-xs font-bold border-red-200 text-red-700 hover:bg-red-50 hover:border-red-300 flex items-center space-x-1.5 rounded-xl shadow-2xs"
              title="Remove fake and testing feedback records from Firestore"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-600" />
              <span>Purge Test Feedback</span>
            </Button>
          </div>
        )}
      </div>

      {/* ── KPI Metric Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] shadow-sm flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-[#12352D]/10 flex items-center justify-center text-[#12352D]">
            <MessageSquareQuote className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[#6B7280] uppercase">Total Reviews</p>
            <p className="text-xl font-bold font-serif text-[#17202A]">{stats.total}</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] shadow-sm flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-[#16845B]/10 flex items-center justify-center text-[#16845B]">
            <ThumbsUp className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[#6B7280] uppercase">CSAT Score</p>
            <p className="text-xl font-bold font-serif text-[#16845B]">{stats.csatPercent}%</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] shadow-sm flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-600">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[#6B7280] uppercase">Complaints</p>
            <p className="text-xl font-bold font-serif text-red-600">{stats.complaints}</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] shadow-sm flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-[#12352D]/10 flex items-center justify-center text-[#12352D]">
            <CheckCircle2 className="w-5 h-5 text-[#16845B]" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[#6B7280] uppercase">Resolved Issues</p>
            <p className="text-xl font-bold font-serif text-[#17202A]">{stats.resolved}</p>
          </div>
        </div>
      </div>

      {/* ── Filters & Search ── */}
      <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="w-full md:w-80">
          <SearchBar 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
            placeholder="Search by diner, order #, table, notes..." 
          />
        </div>

        <div className="flex items-center space-x-2.5 overflow-x-auto w-full md:w-auto">
          {/* Status Filter */}
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs font-semibold rounded-xl border border-[#E5E7EB] bg-[#F8F6F2] text-[#17202A] focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="New">New</option>
            <option value="Assigned">Assigned</option>
            <option value="In Progress">In Progress</option>
            <option value="Resolved">Resolved</option>
          </select>

          {/* Category Filter */}
          <select 
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 text-xs font-semibold rounded-xl border border-[#E5E7EB] bg-[#F8F6F2] text-[#17202A] focus:outline-none"
          >
            <option value="all">All Categories</option>
            <option value="Food">Food Quality</option>
            <option value="Service">Service</option>
            <option value="Cleanliness">Cleanliness</option>
            <option value="Ambience">Ambience</option>
            <option value="Waiting Time">Waiting Time</option>
            <option value="Other">Other</option>
          </select>

          {/* Rating filter */}
          <select 
            value={ratingFilter}
            onChange={(e) => setRatingFilter(e.target.value)}
            className="px-3 py-2 text-xs font-semibold rounded-xl border border-[#E5E7EB] bg-[#F8F6F2] text-[#17202A] focus:outline-none"
          >
            <option value="all">All Ratings</option>
            <option value="positive">Positive / Commendations</option>
            <option value="complaint">Complaints / Issues</option>
          </select>
        </div>
      </div>

      {/* ── Main Feedback Cards ── */}
      {isLoading ? (
        <div className="py-24 flex flex-col items-center justify-center">
          <LoadingSpinner label="Loading customer feedback registry..." />
        </div>
      ) : filteredFeedbacks.length === 0 ? (
        <EmptyState 
          title="No customer feedback found"
          description="Customer satisfaction ratings, feedback, and complaints will appear here in real-time as diners review their experience."
        />
      ) : (
        <div className="space-y-3">
          {filteredFeedbacks.map((item) => (
            <div 
              key={item.id} 
              className="p-4 rounded-2xl bg-white border border-[#E5E7EB] hover:border-[#C9533B]/40 transition-all shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4"
            >
              {/* Left Column: Customer & Rating */}
              <div className="flex items-start space-x-3.5 min-w-[280px]">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 shadow-2xs border ${
                  item.isComplaint 
                    ? 'bg-red-50 text-red-700 border-red-200' 
                    : 'bg-[#FFF8F2] text-[#B33E26] border-[#F5CBC4]'
                }`}>
                  {item.isComplaint ? <AlertTriangle className="w-5 h-5 text-red-600" /> : <Star className="w-5 h-5 text-amber-500 fill-amber-500" />}
                </div>

                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="font-serif font-bold text-sm text-[#17202A]">
                      {item.customerName}
                    </h3>
                    <Badge variant={item.isComplaint ? 'danger' : 'success'}>
                      {item.rating}
                    </Badge>
                  </div>

                  <p className="text-xs text-[#17202A] mt-1 line-clamp-2">
                    "{item.notes}"
                  </p>

                  <div className="flex items-center space-x-3 text-[11px] text-[#475569] mt-1.5">
                    <span className="bg-[#F8F6F2] px-2 py-0.5 rounded font-semibold text-[#17202A] border border-[#E5E7EB]">
                      Category: {item.category || 'General'}
                    </span>
                    {item.tableNumber && <span>Table {item.tableNumber}</span>}
                    {item.orderId && <span>Order #{item.orderId}</span>}
                  </div>
                </div>
              </div>

              {/* Middle Column: Status & Assignment */}
              <div className="flex items-center space-x-6 text-xs text-[#17202A] border-y md:border-y-0 md:border-x border-[#E5E7EB] py-2 md:py-0 md:px-6">
                <div>
                  <p className="text-[10px] uppercase font-bold text-[#475569]">Resolution Status</p>
                  <Badge variant={
                    item.status === 'Resolved' ? 'success' :
                    item.status === 'In Progress' ? 'primary' :
                    item.status === 'Assigned' ? 'warning' : 'danger'
                  }>
                    {item.status || 'New'}
                  </Badge>
                </div>

                <div>
                  <p className="text-[10px] uppercase font-bold text-[#475569]">Assigned Staff</p>
                  <p className="font-bold text-[#17202A] mt-0.5 truncate max-w-[130px]">
                    {item.assignedToName || 'Unassigned'}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] uppercase font-bold text-[#475569]">Submitted</p>
                  <p className="text-[#475569] mt-0.5">
                    {new Date(item.submittedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* Right Column: Actions */}
              <div className="flex items-center space-x-2 shrink-0 justify-end">
                <Button 
                  variant="secondary"
                  onClick={() => handleOpenDetails(item)}
                  className="text-xs font-bold flex items-center space-x-1.5 px-3 py-1.5"
                >
                  <span>Resolve / Details</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>

                <button
                  type="button"
                  onClick={() => setDeleteTargetFeedback(item)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors"
                  title="Delete this feedback from Firestore"
                  aria-label="Delete feedback"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Feedback Details & Resolution Modal ── */}
      {isDetailsOpen && selectedItem && (
        <Modal
          isOpen={isDetailsOpen}
          onClose={() => setIsDetailsOpen(false)}
          title={`Feedback & Complaint Resolution — #${selectedItem.id}`}
          variant="light"
        >
          <div className="space-y-4 p-1 select-none">
            {/* Feedback Summary Card (Accessible Light Surface) */}
            <div className={`p-4 rounded-2xl border space-y-3 ${
              selectedItem.isComplaint 
                ? 'bg-red-50 border-red-200' 
                : 'bg-[#F8F6F2] border-[#E5E0D9]'
            }`}>
              <div className="flex items-start justify-between">
                <div>
                  <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                    selectedItem.isComplaint
                      ? 'bg-red-100 text-red-800'
                      : 'bg-[#E5E0D9] text-[#334155]'
                  }`}>
                    Category: {selectedItem.category || 'General'}
                  </span>
                  <h3 className="text-base font-serif font-bold mt-1 text-[#17202A]">
                    {selectedItem.customerName}
                  </h3>
                  <p className="text-xs text-[#475569] mt-0.5 font-medium">
                    Order #{selectedItem.orderId || 'Direct'} &middot; Table {selectedItem.tableNumber || 'Walk-in'} &middot; {new Date(selectedItem.submittedAt).toLocaleDateString()}
                  </p>
                </div>

                <Badge variant={selectedItem.isComplaint ? 'danger' : 'success'}>
                  {selectedItem.rating}
                </Badge>
              </div>

              <div className="bg-white border border-[#E5E0D9] p-3 rounded-xl shadow-2xs">
                <p className="text-xs text-[#17202A] italic leading-relaxed">
                  "{selectedItem.notes}"
                </p>
              </div>
            </div>

            {/* Resolution Form Controls */}
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#17202A] mb-1">Update Status</label>
                  <select
                    value={selectedNewStatus}
                    onChange={(e) => setSelectedNewStatus(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-[#E5E7EB] bg-white text-[#17202A] focus:outline-none"
                  >
                    <option value="New">New</option>
                    <option value="Assigned">Assigned</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Resolved">Resolved</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#17202A] mb-1">Assign to Staff / Manager</label>
                  <select
                    value={selectedStaffAssignee}
                    onChange={(e) => setSelectedStaffAssignee(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-[#E5E7EB] bg-white text-[#17202A] focus:outline-none"
                  >
                    <option value="">-- Unassigned --</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.fullName || emp.name} ({emp.role || 'Staff'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#17202A] mb-1">Add Internal Resolution Note</label>
                <Input 
                  value={newInternalNote}
                  onChange={(e) => setNewInternalNote(e.target.value)}
                  placeholder="e.g. Contacted diner, offered 15% voucher for dessert compensation."
                />
              </div>
            </div>

            {/* Resolution History Trail */}
            <div>
              <h4 className="text-xs font-bold text-[#17202A] uppercase tracking-wider mb-2">
                Resolution & Audit History
              </h4>
              <div className="p-3 rounded-xl bg-[#F8F6F2] border border-[#E5E7EB] space-y-2 max-h-40 overflow-y-auto">
                {(!selectedItem.resolutionHistory || selectedItem.resolutionHistory.length === 0) ? (
                  <p className="text-xs text-[#475569] text-center py-2">No resolution updates logged yet.</p>
                ) : (
                  selectedItem.resolutionHistory.map((h, idx) => (
                    <div key={idx} className="text-xs border-b border-[#E5E7EB] pb-2 last:border-b-0">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-[#17202A]">{h.action}</span>
                        <span className="text-[#475569]">{new Date(h.timestamp).toLocaleString()}</span>
                      </div>
                      <p className="text-[11px] text-[#475569]">By: {h.by}</p>
                      {h.notes && <p className="text-[11px] text-[#17202A] mt-0.5 italic">"{h.notes}"</p>}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between">
              <Button 
                variant="secondary" 
                type="button"
                onClick={() => {
                  setDeleteTargetFeedback(selectedItem);
                  setIsDetailsOpen(false);
                }}
                className="text-xs font-bold flex items-center space-x-1.5 border-red-200 text-red-700 hover:bg-red-50 hover:border-red-300 rounded-xl"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-600" />
                <span>Delete Feedback</span>
              </Button>

              <div className="flex items-center space-x-2">
                <Button variant="secondary" onClick={() => setIsDetailsOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  variant="primary" 
                  onClick={handleSaveResolution}
                  disabled={isSavingAction}
                  className="bg-[#B33E26] hover:bg-[#9B331D] text-white font-bold"
                >
                  {isSavingAction ? 'Saving...' : 'Save Resolution'}
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Delete Single Feedback Confirmation Dialog ── */}
      {deleteTargetFeedback && (
        <Dialog
          isOpen={Boolean(deleteTargetFeedback)}
          onClose={() => setDeleteTargetFeedback(null)}
          onConfirm={handleDeleteSingleFeedback}
          title="Delete Feedback Record?"
          message={`Are you sure you want to permanently delete this feedback entry for Order #${deleteTargetFeedback.orderId || 'Direct'} from Firestore? This action cannot be undone.`}
          confirmLabel={isDeletingFeedback ? 'Deleting...' : 'Delete Feedback'}
          isDangerous={true}
        />
      )}

      {/* ── Purge Test Feedback Confirmation Dialog ── */}
      {isPurgeFeedbackOpen && (
        <Dialog
          isOpen={isPurgeFeedbackOpen}
          onClose={() => setIsPurgeFeedbackOpen(false)}
          onConfirm={handlePurgeTestFeedback}
          title="Purge All Test Feedback?"
          message="This will scan your satisfaction ratings collection and permanently remove all testing and duplicate feedback records (e.g. repeated test submissions) from Firestore. Only genuine diner reviews will remain."
          confirmLabel={isPurgingFeedback ? 'Purging...' : 'Purge Test Feedback'}
          isDangerous={true}
        />
      )}
    </div>
  );
};

export default OwnerFeedback;
