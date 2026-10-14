import React, { useState, useMemo } from 'react';
import { ArrowUpDown, Star, MessageSquare } from 'lucide-react';
import { ISatisfactionRatingRecord } from '../../../../shared/services/reviewService';
import ReviewCard from './ReviewCard';

interface RestaurantReviewsListProps {
  reviews: ISatisfactionRatingRecord[];
  isLoading?: boolean;
}

export const RestaurantReviewsList: React.FC<RestaurantReviewsListProps> = ({
  reviews,
  isLoading = false
}) => {
  const [sortBy, setSortBy] = useState<'recent' | 'highest' | 'lowest'>('recent');

  const sortedReviews = useMemo(() => {
    const list = [...reviews];
    if (sortBy === 'highest') {
      return list.sort((a, b) => (b.starRating || 5) - (a.starRating || 5));
    }
    if (sortBy === 'lowest') {
      return list.sort((a, b) => (a.starRating || 5) - (b.starRating || 5));
    }
    return list.sort((a, b) => {
      const timeA = new Date(a.submittedAt || a.createdAt || 0).getTime();
      const timeB = new Date(b.submittedAt || b.createdAt || 0).getTime();
      return timeB - timeA;
    });
  }, [reviews, sortBy]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((n) => (
          <div key={n} className="p-5 bg-white border border-[#EEE7E1] rounded-2xl animate-pulse space-y-3">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-slate-200 rounded-xl" />
              <div className="space-y-1.5 flex-1">
                <div className="h-3.5 bg-slate-200 rounded w-1/3" />
                <div className="h-2.5 bg-slate-100 rounded w-1/4" />
              </div>
            </div>
            <div className="h-10 bg-slate-100 rounded-xl" />
          </div>
        ))}
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div className="p-8 sm:p-12 text-center bg-white border border-[#EEE7E1] rounded-3xl space-y-3 shadow-2xs">
        <div className="w-12 h-12 bg-[#FFF8F2] border border-[#EEE7E1] rounded-2xl flex items-center justify-center text-[#E85D3F] mx-auto">
          <MessageSquare className="w-6 h-6" />
        </div>
        <h4 className="text-sm font-display font-extrabold text-[#242424]">
          No Reviews Yet
        </h4>
        <p className="text-xs text-[#6B6B6B] max-w-sm mx-auto">
          Guest reviews and dining ratings for this restaurant will appear right here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls Bar: Count and Sort Dropdown */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-[#EEE7E1]">
        <div className="flex items-center space-x-2">
          <h3 className="text-sm font-extrabold text-[#242424] font-display">
            Customer Reviews ({reviews.length})
          </h3>
        </div>

        {/* Sorting Dropdown */}
        <div className="flex items-center space-x-2 self-start sm:self-auto">
          <label htmlFor="reviews-sort" className="text-xs text-[#6B6B6B] font-semibold flex items-center gap-1">
            <ArrowUpDown className="w-3 h-3 text-[#E85D3F]" />
            <span>Sort by:</span>
          </label>
          <select
            id="reviews-sort"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="text-xs font-bold bg-white border border-[#EEE7E1] rounded-xl px-2.5 py-1.5 text-[#242424] focus:border-[#E85D3F] focus:ring-1 focus:ring-[#E85D3F] outline-none cursor-pointer"
          >
            <option value="recent">Most Recent</option>
            <option value="highest">Highest Rated</option>
            <option value="lowest">Lowest Rated</option>
          </select>
        </div>
      </div>

      {/* Review Cards */}
      <div className="space-y-3">
        {sortedReviews.map((review) => (
          <ReviewCard key={review.id || `${review.orderId}-${review.submittedAt}`} review={review} />
        ))}
      </div>
    </div>
  );
};

export default RestaurantReviewsList;
