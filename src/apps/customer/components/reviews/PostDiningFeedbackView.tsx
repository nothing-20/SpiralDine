import React, { useState, useEffect } from 'react';
import { CustomerHeader } from '../../../../shared/ui/navigation/CustomerHeader';
import { 
  reviewService, 
  ISatisfactionRatingRecord, 
  IRestaurantRatingSummary 
} from '../../../../shared/services/reviewService';
import CustomerReviewSubmissionForm from './CustomerReviewSubmissionForm';
import RestaurantRatingSummaryCard from './RestaurantRatingSummaryCard';
import ReviewCard from './ReviewCard';
import { Star, MessageSquareQuote, ArrowLeft } from 'lucide-react';

interface PostDiningFeedbackViewProps {
  tenantId: string;
  orderId: string;
  restaurantName: string;
  restaurantImage?: string;
  orderDate?: string;
  tableNumber?: string;
  customerName?: string;
  customerId?: string;
  onSkipReceipt: () => void;
  onFinishHome: () => void;
}

export const PostDiningFeedbackView: React.FC<PostDiningFeedbackViewProps> = ({
  tenantId,
  orderId,
  restaurantName,
  restaurantImage,
  orderDate,
  tableNumber,
  customerName,
  customerId,
  onSkipReceipt,
  onFinishHome
}) => {
  const [reviews, setReviews] = useState<ISatisfactionRatingRecord[]>([]);
  const [summary, setSummary] = useState<IRestaurantRatingSummary>(() => 
    reviewService.calculateRatingSummary([])
  );
  const [isLoadingReviews, setIsLoadingReviews] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const loadReviews = async () => {
      if (!tenantId) return;
      try {
        const fetched = await reviewService.getRestaurantReviews(tenantId, {
          sortBy: 'recent',
          limitCount: 15
        });
        if (isMounted) {
          setReviews(fetched);
          setSummary(reviewService.calculateRatingSummary(fetched));
          setIsLoadingReviews(false);
        }
      } catch (err) {
        if (isMounted) setIsLoadingReviews(false);
      }
    };

    loadReviews();
    return () => {
      isMounted = false;
    };
  }, [tenantId]);

  return (
    <div className="min-h-screen bg-[#FCFAF7] text-left pb-16">
      {/* Navigation Header */}
      <CustomerHeader 
        tableNumber={tableNumber} 
        restaurantName={restaurantName} 
      />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
        {/* Breadcrumb / Top Bar */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onSkipReceipt}
            className="inline-flex items-center space-x-1.5 text-xs font-bold text-[#6B6B6B] hover:text-[#E85D3F] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Skip to Bill & Receipt</span>
          </button>

          <span className="text-xs font-serif italic text-[#E85D3F]/90 hidden sm:inline">
            SpiralDine Guest Experience
          </span>
        </div>

        {/* Responsive Grid: Two-Column on Desktop (Form on left, Summary & Community on right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Column 1: Review Submission Form (7 cols on lg) */}
          <div className="lg:col-span-7">
            <CustomerReviewSubmissionForm
              tenantId={tenantId}
              orderId={orderId}
              restaurantName={restaurantName}
              restaurantImage={restaurantImage}
              orderDate={orderDate}
              tableNumber={tableNumber}
              customerName={customerName}
              customerId={customerId}
              onSkipReceipt={onSkipReceipt}
              onFinishHome={onFinishHome}
            />
          </div>

          {/* Column 2: Restaurant Ratings Summary & Community Reviews (5 cols on lg) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Rating Summary Card */}
            <RestaurantRatingSummaryCard
              summary={summary}
              restaurantName={restaurantName}
            />

            {/* Recent Diner Reviews Snapshot */}
            {reviews.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#6B6B6B] flex items-center gap-1.5">
                    <MessageSquareQuote className="w-3.5 h-3.5 text-[#E85D3F]" />
                    <span>Recent Diner Reviews</span>
                  </h3>
                  <span className="text-[11px] font-bold text-[#6B6B6B]">
                    {reviews.length} published
                  </span>
                </div>

                <div className="space-y-3">
                  {reviews.slice(0, 3).map((r) => (
                    <ReviewCard key={r.id || `${r.orderId}-${r.submittedAt}`} review={r} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default PostDiningFeedbackView;
