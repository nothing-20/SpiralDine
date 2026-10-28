import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  limit 
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { useAuth } from '../../../context/AuthContext';
import { 
  ISatisfactionRatingRecord, 
  calculateRatingSummary, 
  IRestaurantRatingSummary,
  reviewService 
} from '../../../shared/services/reviewService';

// UI Kit components
import Card from '../../../components/ui/Card/Card';
import Badge from '../../../components/ui/Badge/Badge';
import Button from '../../../components/ui/Button/Button';
import Dialog from '../../../components/ui/Dialog/Dialog';
import LoadingSpinner from '../../../components/ui/LoadingSpinner/LoadingSpinner';
import ReviewCard from '../../customer/components/reviews/ReviewCard';
import toast from 'react-hot-toast';

// Icons
import { 
  Star, 
  ChevronLeft, 
  Search, 
  ArrowUpDown, 
  ThumbsUp, 
  Clock, 
  UserCheck, 
  AlertTriangle, 
  RefreshCw, 
  Filter, 
  MessageSquare, 
  Utensils, 
  Sparkles, 
  ShieldCheck, 
  HeartHandshake,
  CheckCircle2,
  ChevronRight,
  TrendingUp,
  X,
  Trash2
} from 'lucide-react';

export const OwnerReviews: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const tenantId = user?.tenantId;

  // Real-time Firestore state
  const [reviews, setReviews] = useState<ISatisfactionRatingRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [ratingFilter, setRatingFilter] = useState<'all' | 5 | 4 | 3 | 2 | 1>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'highest' | 'lowest'>('newest');

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 10;

  // Deletion & Test Review Purge State
  const [deleteTarget, setDeleteTarget] = useState<ISatisfactionRatingRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [isPurgeDialogOpen, setIsPurgeDialogOpen] = useState<boolean>(false);
  const [isPurging, setIsPurging] = useState<boolean>(false);

  const handleConfirmDeleteSingle = async () => {
    if (!deleteTarget || !deleteTarget.id || !tenantId) return;
    setIsDeleting(true);
    try {
      const res = await reviewService.deleteReview(tenantId, deleteTarget.id);
      if (res.success) {
        toast.success('Review deleted from Firestore');
        setReviews(prev => prev.filter(r => r.id !== deleteTarget.id));
        setDeleteTarget(null);
      } else {
        toast.error(res.error || 'Failed to delete review');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete review');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConfirmPurgeTest = async () => {
    if (!tenantId) return;
    setIsPurging(true);
    try {
      const res = await reviewService.purgeTestReviews(tenantId);
      if (res.success) {
        toast.success(`Removed ${res.count} test review${res.count !== 1 ? 's' : ''} from Firestore`);
        setReviews(prev => prev.filter(r => {
          const notesStr = String(r.notes || r.comments || r.feedback || '').toLowerCase().trim();
          const orderIdStr = String(r.orderId || '').toUpperCase().trim();
          const isTest = notesStr === 'super' ||
            notesStr === 'test' ||
            orderIdStr === 'ORD-OAPZGOG' ||
            orderIdStr === 'OAPZGOG' ||
            (r.id && r.id.startsWith('REV-'));
          return !isTest;
        }));
        setIsPurgeDialogOpen(false);
      } else {
        toast.error(res.error || 'Failed to purge test reviews');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Purge failed');
    } finally {
      setIsPurging(false);
    }
  };

  // 1. Subscribe to genuine customer satisfaction ratings for current tenant
  useEffect(() => {
    if (!tenantId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    // Query genuine customer satisfactionRatings subcollection scoped to the authenticated tenant
    const colRef = collection(db, 'restaurants', tenantId, 'satisfactionRatings');
    const q = query(colRef, limit(300));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: ISatisfactionRatingRecord[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          list.push({
            id: docSnap.id,
            ...data
          } as ISatisfactionRatingRecord);
        });

        setReviews(list);
        setIsLoading(false);
        setErrorMessage(null);
      },
      (error) => {
        console.error('[OwnerReviews] Firestore access error:', error);
        setErrorMessage(error?.message || 'Failed to retrieve reviews from Firestore. Please check permissions.');
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [tenantId]);

  // 2. Canonical statistics summary derived from genuine reviews
  const summary: IRestaurantRatingSummary = useMemo(() => {
    return calculateRatingSummary(reviews);
  }, [reviews]);

  // Real pending reviews count (awaiting manager review or unresolved complaints)
  const pendingReviewsCount = useMemo(() => {
    return reviews.filter((r) => {
      const statusStr = String(r.status || '');
      const isUnresolvedComplaint = Boolean(r.isComplaint && statusStr !== 'Resolved');
      const isPendingStatus = statusStr === 'New' || statusStr === 'Assigned' || (r as any).resolutionStatus === 'Pending';
      return isUnresolvedComplaint || isPendingStatus;
    }).length;
  }, [reviews]);

  // 3. Search and filtering logic
  const filteredReviews = useMemo(() => {
    const list = reviews.filter((r) => {
      // Rating filter
      if (ratingFilter !== 'all') {
        const starScore = r.starRating || (typeof r.rating === 'number' ? r.rating : 5);
        if (Math.round(starScore) !== ratingFilter) return false;
      }

      // Search query (search comments, non-anonymous customer name, order reference)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const comments = (r.notes || r.comments || r.feedback || '').toLowerCase();
        const orderRef = (r.orderId || '').toLowerCase();
        const customerName = (!r.isAnonymous && (r.publicCustomerName || r.submittedByName))
          ? (r.publicCustomerName || r.submittedByName).toLowerCase()
          : '';

        const matchesComment = comments.includes(q);
        const matchesOrder = orderRef.includes(q);
        const matchesName = customerName.includes(q);

        if (!matchesComment && !matchesOrder && !matchesName) {
          return false;
        }
      }

      return true;
    });

    // Sorting
    list.sort((a, b) => {
      const timeA = new Date(a.submittedAt || a.createdAt || 0).getTime();
      const timeB = new Date(b.submittedAt || b.createdAt || 0).getTime();
      const scoreA = a.starRating || 5;
      const scoreB = b.starRating || 5;

      switch (sortBy) {
        case 'oldest':
          return timeA - timeB;
        case 'highest':
          return scoreB - scoreA || timeB - timeA;
        case 'lowest':
          return scoreA - scoreB || timeB - timeA;
        case 'newest':
        default:
          return timeB - timeA;
      }
    });

    return list;
  }, [reviews, ratingFilter, searchQuery, sortBy]);

  // Reset page when filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, ratingFilter, sortBy]);

  // Pagination slice
  const totalPages = Math.max(1, Math.ceil(filteredReviews.length / itemsPerPage));
  const paginatedReviews = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredReviews.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredReviews, currentPage, itemsPerPage]);

  const handleRetry = () => {
    setIsLoading(true);
    setErrorMessage(null);
    if (!tenantId) return;
    const colRef = collection(db, 'restaurants', tenantId, 'satisfactionRatings');
    onSnapshot(
      query(colRef, limit(300)),
      (snapshot) => {
        const list: ISatisfactionRatingRecord[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as ISatisfactionRatingRecord);
        });
        setReviews(list);
        setIsLoading(false);
      },
      (err) => {
        setErrorMessage(err.message);
        setIsLoading(false);
      }
    );
  };

  return (
    <div className="space-y-6 pb-12 select-none">
      {/* ── Top Navigation & Back Action ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3 mb-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/owner/dashboard')}
              className="text-xs font-bold text-[#52606D] hover:text-[#17202A] flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-[#E5E0D9] bg-white hover:bg-[#F9F8F6] transition-all shadow-2xs"
            >
              <ChevronLeft className="w-4 h-4 text-[#52606D]" />
              <span>Back to Dashboard</span>
            </Button>
          </div>

          <div className="flex items-center space-x-3">
            <span className="p-2.5 rounded-2xl bg-[#12352D] text-white shadow-sm flex items-center justify-center">
              <Star className="w-5 h-5 text-[#D98B00] fill-[#D98B00]" />
            </span>
            <div>
              <h1 className="text-2xl font-serif font-bold text-[#17202A] tracking-tight">
                Customer Reviews
              </h1>
              <p className="text-xs text-[#6B7280] mt-0.5">
                See what your customers think about their dining experience.
              </p>
            </div>
          </div>
        </div>

        {reviews.length > 0 && (
          <div className="flex items-center space-x-2 self-start sm:self-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsPurgeDialogOpen(true)}
              className="text-xs font-bold border-red-200 text-red-700 hover:bg-red-50 hover:border-red-300 flex items-center space-x-1.5 rounded-xl shadow-2xs"
              title="Remove fake and testing reviews from Firestore"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-600" />
              <span>Purge Test Reviews</span>
            </Button>

            <span className="text-[11px] font-bold text-[#16845B] bg-[#EAF7EE] border border-[#C6ECD2] px-3 py-1 rounded-full flex items-center space-x-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#16845B]" />
              <span>Live Reviews Stream</span>
            </span>
          </div>
        )}
      </div>

      {/* ── Error State ── */}
      {errorMessage && (
        <Card className="p-6 border-rose-200 bg-rose-50/70 rounded-2xl space-y-3">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 mt-0.5 shrink-0" />
            <div className="space-y-1 flex-1">
              <h3 className="text-sm font-bold text-rose-900">Failed to load customer reviews</h3>
              <p className="text-xs text-rose-700">{errorMessage}</p>
            </div>
            <Button
              size="sm"
              onClick={handleRetry}
              className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold px-3 py-1.5 flex items-center space-x-1"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </Button>
          </div>
        </Card>
      )}

      {/* ── Summary Cards Section ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* KPI 1: Average Rating */}
        <Card className="p-5 border-[#E5E0D9] bg-white rounded-2xl flex flex-col justify-between shadow-2xs">
          <div className="flex justify-between items-start">
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#52606D]">
              Average Rating
            </span>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#FFF4DC] border border-[#FDE6B0]">
              <Star className="w-4 h-4 text-[#D98B00] fill-[#D98B00]" />
            </div>
          </div>
          <div className="my-2">
            <div className="flex items-baseline space-x-2">
              <span className="text-3xl font-display font-black text-[#17202A]">
                {summary.hasReviews ? summary.averageRating.toFixed(1) : '—'}
              </span>
              <span className="text-xs text-[#52606D] font-bold">
                {summary.hasReviews ? '/ 5.0' : 'No ratings'}
              </span>
            </div>
            <div className="flex items-center space-x-0.5 mt-1.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`w-3.5 h-3.5 ${
                    star <= Math.round(summary.averageRating)
                      ? 'text-[#F4B942] fill-[#F4B942]'
                      : 'text-[#E5E0D9] fill-none'
                  }`}
                />
              ))}
            </div>
          </div>
          <div className="text-[10px] font-bold text-[#52606D] border-t border-[#E5E0D9] pt-2">
            Based on {summary.totalReviews} verified {summary.totalReviews === 1 ? 'review' : 'reviews'}
          </div>
        </Card>

        {/* KPI 2: Total Reviews */}
        <Card className="p-5 border-[#E5E0D9] bg-white rounded-2xl flex flex-col justify-between shadow-2xs">
          <div className="flex justify-between items-start">
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#52606D]">
              Total Reviews
            </span>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#EAF2FB] border border-[#CBE0F7]">
              <MessageSquare className="w-4 h-4 text-[#1D5D9B]" />
            </div>
          </div>
          <div className="my-2">
            <span className="text-3xl font-display font-black text-[#17202A]">
              {summary.totalReviews}
            </span>
            <p className="text-xs text-[#52606D] font-semibold mt-1">
              Customer submissions
            </p>
          </div>
          <div className="text-[10px] font-bold text-[#1D5D9B] border-t border-[#E5E0D9] pt-2">
            100% verified dining orders
          </div>
        </Card>

        {/* KPI 3: Repeat Customer Rate */}
        <Card className="p-5 border-[#E5E0D9] bg-white rounded-2xl flex flex-col justify-between shadow-2xs">
          <div className="flex justify-between items-start">
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#52606D]">
              Repeat Rate
            </span>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#EAF7EE] border border-[#C6ECD2]">
              <ThumbsUp className="w-4 h-4 text-[#16845B]" />
            </div>
          </div>
          <div className="my-2">
            <div className="flex items-baseline space-x-1.5">
              <span className="text-3xl font-display font-black text-[#16845B]">
                {summary.hasReviews ? `${summary.revisitRate}%` : '—'}
              </span>
            </div>
            <p className="text-xs text-[#52606D] font-semibold mt-1">
              Would dine again
            </p>
          </div>
          <div className="text-[10px] font-bold text-[#16845B] border-t border-[#E5E0D9] pt-2">
            Positive revisit intention
          </div>
        </Card>

        {/* KPI 4: Pending Reviews */}
        <Card className="p-5 border-[#E5E0D9] bg-white rounded-2xl flex flex-col justify-between shadow-2xs">
          <div className="flex justify-between items-start">
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#52606D]">
              Pending Reviews
            </span>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#FDF0EC] border border-[#F9D6CD]">
              <Clock className="w-4 h-4 text-[#C9533B]" />
            </div>
          </div>
          <div className="my-2">
            <span className="text-3xl font-display font-black text-[#C9533B]">
              {pendingReviewsCount}
            </span>
            <p className="text-xs text-[#52606D] font-semibold mt-1">
              Awaiting follow-up
            </p>
          </div>
          <div className="text-[10px] font-bold text-[#C9533B] border-t border-[#E5E0D9] pt-2">
            {pendingReviewsCount === 0 ? 'All reviews resolved' : 'Requires management review'}
          </div>
        </Card>

        {/* KPI 5: Star Breakdown Overview */}
        <Card className="p-4 border-[#E5E0D9] bg-white rounded-2xl flex flex-col justify-between shadow-2xs space-y-2">
          <div className="flex justify-between items-center pb-1 border-b border-[#E5E0D9]">
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#52606D]">
              Rating Breakdown
            </span>
            <span className="text-[10px] font-bold text-[#7B8794]">
              Distribution
            </span>
          </div>
          <div className="space-y-1.5 text-xs">
            {([5, 4, 3, 2, 1] as const).map((star) => {
              const item = summary.starDistribution[star];
              return (
                <div key={star} className="flex items-center gap-2">
                  <span className="w-5 font-bold text-[#242424] text-[11px] flex items-center gap-0.5">
                    {star}★
                  </span>
                  <div className="flex-1 h-1.5 bg-[#FFF8F2] border border-[#EEE7E1] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-400 to-[#E85D3F] rounded-full"
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-[#7B8794] w-7 text-right font-mono">
                    {item.count}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* ── Category Ratings Pill Bar (if reviews exist) ── */}
      {summary.hasReviews && (
        <Card className="p-4 border-[#E5E0D9] bg-white rounded-2xl shadow-2xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-[#52606D] uppercase tracking-wider">
              Experience Categories:
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="px-3 py-1.5 bg-[#FFF8F2] border border-[#EEE7E1] rounded-xl text-xs font-bold text-[#17202A] flex items-center space-x-1.5">
              <Utensils className="w-3.5 h-3.5 text-[#E85D3F]" />
              <span>Food: {summary.categoryAverages.foodQuality.toFixed(1)} / 5</span>
            </div>
            <div className="px-3 py-1.5 bg-[#FFF8F2] border border-[#EEE7E1] rounded-xl text-xs font-bold text-[#17202A] flex items-center space-x-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Service: {summary.categoryAverages.service.toFixed(1)} / 5</span>
            </div>
            <div className="px-3 py-1.5 bg-[#FFF8F2] border border-[#EEE7E1] rounded-xl text-xs font-bold text-[#17202A] flex items-center space-x-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Cleanliness: {summary.categoryAverages.cleanliness.toFixed(1)} / 5</span>
            </div>
            <div className="px-3 py-1.5 bg-[#FFF8F2] border border-[#EEE7E1] rounded-xl text-xs font-bold text-[#17202A] flex items-center space-x-1.5">
              <HeartHandshake className="w-3.5 h-3.5 text-indigo-500" />
              <span>Ambience: {summary.categoryAverages.ambience.toFixed(1)} / 5</span>
            </div>
          </div>
        </Card>
      )}

      {/* ── Controls: Search, Rating Filter Pills, Sorting ── */}
      <Card className="p-4 border-[#E5E0D9] bg-white rounded-2xl shadow-2xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search bar */}
          <div className="relative w-full lg:w-96">
            <Search className="w-4 h-4 text-[#7B8794] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search reviews, diner name, order ID..."
              className="w-full pl-10 pr-9 py-2 text-xs font-medium text-[#17202A] bg-[#FAFAF7] border border-[#E5E0D9] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#12352D]/20 focus:border-[#12352D] transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7B8794] hover:text-[#17202A]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Rating filter pills & sorting */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Rating Filter Pills */}
            <div className="flex items-center space-x-1 bg-[#FAFAF7] p-1 border border-[#E5E0D9] rounded-xl overflow-x-auto">
              {[
                { id: 'all', label: 'All Stars' },
                { id: 5, label: '5★' },
                { id: 4, label: '4★' },
                { id: 3, label: '3★' },
                { id: 2, label: '2★' },
                { id: 1, label: '1★' },
              ].map((pill) => {
                const isActive = ratingFilter === pill.id;
                return (
                  <button
                    key={String(pill.id)}
                    onClick={() => setRatingFilter(pill.id as any)}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                      isActive
                        ? 'bg-[#12352D] text-white shadow-2xs'
                        : 'text-[#52606D] hover:text-[#17202A] hover:bg-white'
                    }`}
                  >
                    {pill.label}
                  </button>
                );
              })}
            </div>

            {/* Sorting Dropdown */}
            <div className="flex items-center space-x-1.5 bg-[#FAFAF7] border border-[#E5E0D9] px-2.5 py-1.5 rounded-xl">
              <ArrowUpDown className="w-3.5 h-3.5 text-[#C9533B]" />
              <label htmlFor="sort-reviews" className="text-xs text-[#52606D] font-bold">
                Sort:
              </label>
              <select
                id="sort-reviews"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="text-xs font-bold text-[#17202A] bg-transparent focus:outline-none cursor-pointer"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="highest">Highest Rating</option>
                <option value="lowest">Lowest Rating</option>
              </select>
            </div>
          </div>
        </div>

        {/* Results summary bar */}
        <div className="flex items-center justify-between text-xs text-[#6B7280] font-medium pt-1 border-t border-[#E5E0D9]/60">
          <span>
            Showing <strong className="text-[#17202A]">{filteredReviews.length}</strong> of{' '}
            <strong className="text-[#17202A]">{reviews.length}</strong> reviews
            {ratingFilter !== 'all' && ` (${ratingFilter}★ only)`}
            {searchQuery && ` matching "${searchQuery}"`}
          </span>

          {(ratingFilter !== 'all' || searchQuery) && (
            <button
              onClick={() => {
                setRatingFilter('all');
                setSearchQuery('');
              }}
              className="text-xs font-bold text-[#C9533B] hover:underline flex items-center space-x-1"
            >
              <span>Reset filters</span>
            </button>
          )}
        </div>
      </Card>

      {/* ── Content States: Loading, Empty, or Reviews List ── */}
      {isLoading ? (
        <div className="p-16 bg-white border border-[#E5E0D9] rounded-2xl flex flex-col items-center justify-center space-y-3">
          <LoadingSpinner label="Loading customer reviews..." />
        </div>
      ) : reviews.length === 0 ? (
        /* Empty State: No customer reviews yet */
        <div className="p-12 sm:p-16 bg-white border border-[#E5E0D9] rounded-3xl text-center space-y-4 shadow-2xs">
          <div className="w-16 h-16 bg-[#FFF8F2] border border-[#EEE7E1] rounded-2xl flex items-center justify-center text-[#D98B00] mx-auto shadow-inner">
            <Star className="w-8 h-8 text-[#F4B942] fill-[#F4B942]" />
          </div>
          <div className="space-y-1.5 max-w-md mx-auto">
            <h3 className="text-lg font-serif font-bold text-[#17202A]">
              No customer reviews yet.
            </h3>
            <p className="text-xs text-[#6B7280] leading-relaxed">
              When customers submit reviews, they will appear here. Guest ratings from digital receipts and dining feedback will be automatically synced in real time.
            </p>
          </div>
        </div>
      ) : filteredReviews.length === 0 ? (
        /* Filter Empty State: Reviews exist, but none match filters */
        <div className="p-12 bg-white border border-[#E5E0D9] rounded-3xl text-center space-y-3 shadow-2xs">
          <div className="w-12 h-12 bg-[#F9F8F6] border border-[#E5E0D9] rounded-2xl flex items-center justify-center text-[#7B8794] mx-auto">
            <Search className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-[#17202A]">
            No reviews match your filters
          </h4>
          <p className="text-xs text-[#6B7280] max-w-sm mx-auto">
            Try adjusting your search keywords or select "All Stars" to see all customer feedback.
          </p>
          <Button
            size="sm"
            onClick={() => {
              setRatingFilter('all');
              setSearchQuery('');
            }}
            className="mt-2 bg-[#12352D] hover:bg-[#1a4a3f] text-white text-xs font-bold px-4 py-2 rounded-xl"
          >
            Clear Filters
          </Button>
        </div>
      ) : (
        /* Reviews List */
        <div className="space-y-4">
          <div className="space-y-3.5">
            {paginatedReviews.map((review) => (
              <ReviewCard
                key={review.id || `${review.orderId}-${review.submittedAt}`}
                review={review}
                onDelete={(rev) => setDeleteTarget(rev)}
              />
            ))}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="p-4 bg-white border border-[#E5E0D9] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
              <span className="text-xs text-[#6B7280] font-medium">
                Page <strong className="text-[#17202A]">{currentPage}</strong> of{' '}
                <strong className="text-[#17202A]">{totalPages}</strong> ({filteredReviews.length} total reviews)
              </span>

              <div className="flex items-center space-x-1.5 self-center sm:self-auto">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="text-xs font-bold text-[#52606D] disabled:opacity-40 border border-[#E5E0D9] rounded-xl px-3 py-1.5 bg-[#FAFAF7]"
                >
                  Previous
                </Button>

                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                  .map((p, idx, arr) => {
                    const prev = arr[idx - 1];
                    return (
                      <React.Fragment key={p}>
                        {prev && p - prev > 1 && (
                          <span className="px-1 text-xs text-[#7B8794]">...</span>
                        )}
                        <button
                          onClick={() => setCurrentPage(p)}
                          className={`w-8 h-8 rounded-xl text-xs font-bold transition-all ${
                            currentPage === p
                              ? 'bg-[#12352D] text-white shadow-2xs'
                              : 'text-[#52606D] hover:bg-[#F9F8F6] border border-[#E5E0D9]'
                          }`}
                        >
                          {p}
                        </button>
                      </React.Fragment>
                    );
                  })}

                <Button
                  size="sm"
                  variant="ghost"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="text-xs font-bold text-[#52606D] disabled:opacity-40 border border-[#E5E0D9] rounded-xl px-3 py-1.5 bg-[#FAFAF7]"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Delete Single Review Confirmation Dialog ── */}
      {deleteTarget && (
        <Dialog
          isOpen={Boolean(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleConfirmDeleteSingle}
          title="Delete Customer Review?"
          message={`Are you sure you want to permanently delete this review for Order #${deleteTarget.orderId || 'Direct'} from Firestore? This action will permanently remove it and recalculate rating summaries.`}
          confirmLabel={isDeleting ? 'Deleting...' : 'Delete Review'}
          isDangerous={true}
        />
      )}

      {/* ── Purge Test Reviews Confirmation Dialog ── */}
      {isPurgeDialogOpen && (
        <Dialog
          isOpen={isPurgeDialogOpen}
          onClose={() => setIsPurgeDialogOpen(false)}
          onConfirm={handleConfirmPurgeTest}
          title="Purge All Test Reviews?"
          message="This will scan your restaurant satisfaction ratings and permanently remove all testing, sample, and duplicate reviews (e.g. repeated test submissions) from Firestore. Only genuine diner reviews will remain."
          confirmLabel={isPurging ? 'Purging...' : 'Purge Test Reviews'}
          isDangerous={true}
        />
      )}
    </div>
  );
};

export default OwnerReviews;
