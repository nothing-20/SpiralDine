import React from 'react';
import { Star, Utensils, Sparkles, ShieldCheck, HeartHandshake } from 'lucide-react';
import { IRestaurantRatingSummary } from '../../../../shared/services/reviewService';

interface RestaurantRatingSummaryCardProps {
  summary: IRestaurantRatingSummary;
  restaurantName?: string;
}

export const RestaurantRatingSummaryCard: React.FC<RestaurantRatingSummaryCardProps> = ({
  summary,
  restaurantName = 'Restaurant'
}) => {
  if (!summary.hasReviews || summary.totalReviews === 0) {
    return (
      <div className="bg-white border border-[#EEE7E1] rounded-3xl p-6 sm:p-8 text-center space-y-4 shadow-xs">
        <div className="w-14 h-14 bg-[#FFF8F2] border border-[#EEE7E1] rounded-2xl flex items-center justify-center text-[#E85D3F] mx-auto shadow-inner">
          <Star className="w-7 h-7 text-[#F4B942] fill-[#F4B942]" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-display font-extrabold text-[#242424]">
            No Reviews Yet
          </h3>
          <p className="text-xs text-[#6B6B6B] max-w-sm mx-auto leading-relaxed">
            Be the first guest to share your dining experience at {restaurantName}! Reviews from fellow diners help us serve you better.
          </p>
        </div>
      </div>
    );
  }

  const { averageRating, totalReviews, starDistribution, categoryAverages, revisitRate } = summary;

  return (
    <div className="bg-white border border-[#EEE7E1] rounded-3xl overflow-hidden shadow-xs divide-y divide-[#EEE7E1]">
      {/* Top Banner inspired by Reference Image 2 with star emblem */}
      <div className="bg-gradient-to-br from-[#FFF8F2] via-white to-[#FFF8F2] p-6 sm:p-7 text-center relative overflow-hidden">
        {/* Subtle decorative background glow */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#F4B942]/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-28 h-28 bg-[#E85D3F]/10 rounded-full blur-xl -ml-10 -mb-10 pointer-events-none" />

        {/* Happy Star Icon Badge */}
        <div className="relative inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-amber-50 border-2 border-amber-200 rounded-3xl shadow-sm mb-3">
          <span className="text-3xl sm:text-4xl filter drop-shadow select-none">⭐</span>
        </div>

        {/* Big Overall Rating Number */}
        <div className="space-y-1">
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-3xl sm:text-4xl font-display font-extrabold text-[#242424]">
              {averageRating.toFixed(1)}
            </span>
            <span className="text-base sm:text-lg font-bold text-[#6B6B6B]">
              / 5
            </span>
          </div>

          <div className="flex items-center justify-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`w-4 h-4 ${
                  star <= Math.round(averageRating)
                    ? 'text-[#F4B942] fill-[#F4B942]'
                    : 'text-[#EEE7E1] fill-none'
                }`}
              />
            ))}
          </div>

          <p className="text-xs font-semibold text-[#6B6B6B] pt-0.5">
            Based on {totalReviews} {totalReviews === 1 ? 'verified review' : 'verified reviews'}
          </p>
        </div>

        {/* Category Pill Badges */}
        <div className="flex flex-wrap items-center justify-center gap-2 pt-4">
          <div className="px-3 py-1.5 bg-white border border-[#EEE7E1] rounded-xl text-xs font-bold text-[#242424] flex items-center gap-1.5 shadow-2xs">
            <Utensils className="w-3.5 h-3.5 text-[#E85D3F]" />
            <span>Food ({categoryAverages.foodQuality.toFixed(1)})</span>
          </div>
          <div className="px-3 py-1.5 bg-white border border-[#EEE7E1] rounded-xl text-xs font-bold text-[#242424] flex items-center gap-1.5 shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Service ({categoryAverages.service.toFixed(1)})</span>
          </div>
          <div className="px-3 py-1.5 bg-white border border-[#EEE7E1] rounded-xl text-xs font-bold text-[#242424] flex items-center gap-1.5 shadow-2xs">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Cleanliness ({categoryAverages.cleanliness.toFixed(1)})</span>
          </div>
          <div className="px-3 py-1.5 bg-white border border-[#EEE7E1] rounded-xl text-xs font-bold text-[#242424] flex items-center gap-1.5 shadow-2xs">
            <HeartHandshake className="w-3.5 h-3.5 text-indigo-500" />
            <span>Ambience ({categoryAverages.ambience.toFixed(1)})</span>
          </div>
        </div>

        {/* Verified diners message (inspired by reference image 2) */}
        <div className="mt-4 pt-3 border-t border-[#EEE7E1]/80 text-[11px] text-[#6B6B6B] flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>All reviews are from verified diners who placed orders at this restaurant</span>
        </div>
      </div>

      {/* Rating Distribution Breakdown */}
      <div className="p-6 space-y-2.5">
        <div className="flex items-center justify-between pb-1">
          <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#6B6B6B]">
            Rating Breakdown
          </h4>
          {revisitRate > 0 && (
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              {revisitRate}% would dine again
            </span>
          )}
        </div>

        {([5, 4, 3, 2, 1] as const).map((star) => {
          const item = starDistribution[star];
          return (
            <div key={star} className="flex items-center gap-3 text-xs">
              <span className="w-12 font-bold text-[#242424] flex items-center gap-1 shrink-0">
                <span>{star}</span>
                <Star className="w-3 h-3 text-[#F4B942] fill-[#F4B942]" />
              </span>

              {/* Progress bar */}
              <div className="flex-1 h-2.5 bg-[#FFF8F2] border border-[#EEE7E1] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-400 to-[#E85D3F] rounded-full transition-all duration-500"
                  style={{ width: `${item.percentage}%` }}
                />
              </div>

              {/* Count and percentage */}
              <span className="w-12 text-right font-mono text-[11px] text-[#6B6B6B] shrink-0">
                {item.count} <span className="text-[10px] text-[#9E9E9E]">({item.percentage}%)</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RestaurantRatingSummaryCard;
