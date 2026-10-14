import React, { useState, useEffect } from 'react';
import { 
  Star, 
  Utensils, 
  Sparkles, 
  ShieldCheck, 
  HeartHandshake, 
  Shield, 
  CheckCircle2, 
  ArrowRight, 
  Clock, 
  Receipt, 
  Home, 
  Loader2, 
  AlertCircle 
} from 'lucide-react';
import toast from 'react-hot-toast';
import { 
  OverallExperienceType, 
  RevisitIntentionType, 
  reviewService, 
  maskCustomerName,
  ISatisfactionRatingRecord 
} from '../../../../shared/services/reviewService';
import StarRatingControl from './StarRatingControl';
import OverallExperienceSelector from './OverallExperienceSelector';

interface CustomerReviewSubmissionFormProps {
  tenantId: string;
  orderId: string;
  restaurantName: string;
  restaurantImage?: string;
  orderDate?: string;
  tableNumber?: string;
  customerName?: string;
  customerId?: string;
  onSkipReceipt: () => void;
  onFinishHome?: () => void;
}

export const CustomerReviewSubmissionForm: React.FC<CustomerReviewSubmissionFormProps> = ({
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
  // Form State
  const [overallExperience, setOverallExperience] = useState<OverallExperienceType>('Excellent');
  const [foodRating, setFoodRating] = useState<number>(5);
  const [serviceRating, setServiceRating] = useState<number>(5);
  const [cleanlinessRating, setCleanlinessRating] = useState<number>(5);
  const [ambienceRating, setAmbienceRating] = useState<number>(5);
  const [comments, setComments] = useState<string>('');
  const [isAnonymous, setIsAnonymous] = useState<boolean>(false);
  const [revisitIntention, setRevisitIntention] = useState<RevisitIntentionType>('Yes');

  // Submission & Validation States
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [submittedReview, setSubmittedReview] = useState<ISatisfactionRatingRecord | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [alreadyReviewed, setAlreadyReviewed] = useState<boolean>(false);
  const [isCheckingExisting, setIsCheckingExisting] = useState<boolean>(true);

  // Maximum characters for comments
  const MAX_COMMENT_LENGTH = 500;

  // Masked name preview for anonymous option
  const maskedNamePreview = maskCustomerName(customerName || 'Table Guest');

  // Check if an existing review has already been submitted for this order
  useEffect(() => {
    let isMounted = true;
    const checkDuplicate = async () => {
      if (!tenantId || !orderId) {
        setIsCheckingExisting(false);
        return;
      }
      try {
        const existing = await reviewService.getExistingReviewForOrder(tenantId, orderId);
        if (isMounted) {
          if (existing) {
            setAlreadyReviewed(true);
            setSubmittedReview(existing);
          }
          setIsCheckingExisting(false);
        }
      } catch (err) {
        if (isMounted) setIsCheckingExisting(false);
      }
    };

    checkDuplicate();
    return () => {
      isMounted = false;
    };
  }, [tenantId, orderId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || alreadyReviewed) return;

    setErrorMessage(null);

    // Validation
    const validation = reviewService.validateReviewPayload({
      tenantId,
      orderId,
      overallExperience,
      categoryScores: {
        foodQuality: foodRating,
        service: serviceRating,
        cleanliness: cleanlinessRating,
        ambience: ambienceRating
      },
      comments,
      isAnonymous,
      revisitIntention,
      customerName,
      customerId,
      tableNumber,
      restaurantName
    });

    if (!validation.isValid) {
      setErrorMessage(validation.error || 'Please fill out all required fields.');
      toast.error(validation.error || 'Please check your inputs.');
      return;
    }

    setIsSubmitting(true);

    try {
      const starRating = reviewService.mapOverallToScore(overallExperience);
      const res = await reviewService.submitReview({
        tenantId,
        orderId,
        overallExperience,
        starRating,
        categoryScores: {
          foodQuality: foodRating,
          service: serviceRating,
          cleanliness: cleanlinessRating,
          ambience: ambienceRating
        },
        comments,
        isAnonymous,
        revisitIntention,
        customerName: customerName || 'Table Guest',
        customerId,
        tableNumber,
        restaurantName
      });

      if (res.success) {
        toast.success('Thank you! Your dining review was published.');
        setSubmittedReview({
          id: res.reviewId,
          orderId,
          tenantId,
          tableNumber: tableNumber || 'Walk-in',
          restaurantName,
          rating: overallExperience,
          starRating,
          foodQuality: foodRating,
          service: serviceRating,
          serviceSpeed: serviceRating,
          cleanliness: cleanlinessRating,
          ambience: ambienceRating,
          notes: comments.trim() || 'No additional comments provided.',
          comments: comments.trim() || 'No additional comments provided.',
          feedback: comments.trim() || 'No additional comments provided.',
          isAnonymous,
          submittedByName: customerName || 'Table Guest',
          publicCustomerName: isAnonymous ? maskedNamePreview : customerName || 'Table Guest',
          revisitIntention,
          repeatCustomer: revisitIntention === 'Yes',
          isPositive: starRating >= 4,
          isComplaint: starRating <= 2,
          status: 'Published',
          submittedAt: new Date().toISOString(),
          createdAt: new Date().toISOString()
        });
        setIsSuccess(true);
      } else {
        setErrorMessage(res.error || 'Failed to submit review.');
        toast.error(res.error || 'Submission failed.');
      }
    } catch (err: any) {
      const msg = err?.message || 'An unexpected error occurred while saving your review.';
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1. Initial Loading Skeleton
  if (isCheckingExisting) {
    return (
      <div className="bg-white border border-[#EEE7E1] rounded-3xl p-8 max-w-xl mx-auto space-y-4 animate-pulse shadow-xs">
        <div className="h-6 bg-slate-100 rounded w-1/2 mx-auto" />
        <div className="h-4 bg-slate-100 rounded w-1/3 mx-auto" />
        <div className="h-32 bg-slate-50 rounded-2xl" />
        <div className="h-20 bg-slate-50 rounded-2xl" />
      </div>
    );
  }

  // 2. Already Reviewed State
  if (alreadyReviewed && submittedReview) {
    return (
      <div className="bg-white border border-[#EEE7E1] rounded-3xl p-6 sm:p-8 max-w-xl mx-auto space-y-6 shadow-sm text-center">
        <div className="w-16 h-16 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-2xs">
          <CheckCircle2 className="w-8 h-8" />
        </div>

        <div className="space-y-1.5">
          <h2 className="text-2xl font-display font-extrabold text-[#242424]">
            Review Already Submitted
          </h2>
          <p className="text-xs text-[#6B6B6B] leading-relaxed max-w-sm mx-auto">
            You've already shared feedback for this order at {restaurantName}. Your valuable rating is published to help other diners!
          </p>
        </div>

        {/* Card showing their submitted review */}
        <div className="p-4 bg-[#FFF8F2] border border-[#EEE7E1] rounded-2xl text-left space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-[#242424]">Your Rating</span>
            <div className="flex items-center space-x-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`w-3.5 h-3.5 ${
                    star <= (submittedReview.starRating || 5)
                      ? 'text-[#F4B942] fill-[#F4B942]'
                      : 'text-[#EEE7E1]'
                  }`}
                />
              ))}
            </div>
          </div>
          {submittedReview.notes && (
            <p className="text-xs text-[#6B6B6B] italic">"{submittedReview.notes}"</p>
          )}
          <div className="text-[11px] text-[#9E9E9E] pt-1">
            Order #{orderId.replace(/^ORD-/i, '')} · {submittedReview.isAnonymous ? 'Submitted Anonymously' : 'Public Review'}
          </div>
        </div>

        <div className="space-y-2 pt-2">
          <button
            type="button"
            onClick={onSkipReceipt}
            className="w-full py-3 bg-[#E85D3F] hover:bg-[#D04B2F] text-white text-xs font-extrabold rounded-xl transition-all shadow-md shadow-[#E85D3F]/20 cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Receipt className="w-4 h-4" />
            <span>View Order Receipt</span>
          </button>
          {onFinishHome && (
            <button
              type="button"
              onClick={onFinishHome}
              className="w-full py-2.5 bg-white border border-[#EEE7E1] hover:border-[#E85D3F]/50 text-[#242424] text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Home className="w-4 h-4 text-[#6B6B6B]" />
              <span>Return to Restaurant Home</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // 3. Post-Submission Success Screen
  if (isSuccess && submittedReview) {
    return (
      <div className="bg-white border border-[#EEE7E1] rounded-3xl p-6 sm:p-8 max-w-xl mx-auto space-y-6 shadow-sm text-center">
        <div className="w-16 h-16 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto shadow-2xs animate-bounce">
          <CheckCircle2 className="w-8 h-8" />
        </div>

        <div className="space-y-1.5">
          <h2 className="text-2xl font-display font-extrabold text-[#242424]">
            Thank You for Your Feedback!
          </h2>
          <p className="text-xs text-[#6B6B6B] leading-relaxed max-w-sm mx-auto">
            Your review helps {restaurantName} maintain top-tier kitchen craft and service hospitality.
          </p>
        </div>

        {/* Snapshot of their review */}
        <div className="p-4 bg-[#FFF8F2] border border-[#EEE7E1] rounded-2xl text-left space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#242424] font-display">
              {submittedReview.rating} Experience
            </span>
            <div className="flex items-center space-x-0.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`w-3.5 h-3.5 ${
                    star <= (submittedReview.starRating || 5)
                      ? 'text-[#F4B942] fill-[#F4B942]'
                      : 'text-[#EEE7E1]'
                  }`}
                />
              ))}
            </div>
          </div>
          {submittedReview.notes && (
            <p className="text-xs text-[#6B6B6B] italic">"{submittedReview.notes}"</p>
          )}
          <div className="flex items-center justify-between text-[11px] text-[#9E9E9E] pt-1 border-t border-[#EEE7E1]/60">
            <span>Name shown: <strong className="text-[#242424]">{submittedReview.publicCustomerName}</strong></span>
            <span>{submittedReview.revisitIntention === 'Yes' ? 'Would visit again ✓' : ''}</span>
          </div>
        </div>

        <div className="space-y-2.5 pt-2">
          <button
            type="button"
            onClick={onSkipReceipt}
            className="w-full py-3.5 bg-[#E85D3F] hover:bg-[#D04B2F] text-white text-xs font-extrabold rounded-xl transition-all shadow-md shadow-[#E85D3F]/20 cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Receipt className="w-4 h-4" />
            <span>View Final Receipt</span>
          </button>
          {onFinishHome && (
            <button
              type="button"
              onClick={onFinishHome}
              className="w-full py-2.5 bg-white border border-[#EEE7E1] hover:border-[#E85D3F]/50 text-[#242424] text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Home className="w-4 h-4 text-[#6B6B6B]" />
              <span>Finish & Return Home</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // 4. Main Submission Form
  return (
    <form 
      onSubmit={handleSubmit}
      className="bg-white border border-[#EEE7E1] rounded-3xl p-6 sm:p-8 max-w-xl mx-auto space-y-6 shadow-sm text-left"
    >
      {/* A. PAGE HEADER */}
      <div className="pb-5 border-b border-[#EEE7E1] space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-xl sm:text-2xl font-display font-extrabold text-[#242424]">
              Rate Your Dining Experience
            </h2>
            <p className="text-xs text-[#6B6B6B]">
              Your feedback helps us serve you better.
            </p>
          </div>

          {/* Restaurant logo / icon */}
          <div className="w-12 h-12 rounded-2xl bg-[#FFF8F2] border border-[#EEE7E1] overflow-hidden flex items-center justify-center shrink-0 text-[#E85D3F] font-extrabold font-display shadow-2xs">
            {restaurantImage ? (
              <img src={restaurantImage} alt={restaurantName} className="w-full h-full object-cover" />
            ) : (
              <span>{restaurantName.charAt(0).toUpperCase()}</span>
            )}
          </div>
        </div>

        {/* Order details chip */}
        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-[#6B6B6B] font-semibold">
          <span className="text-[#242424] font-bold">{restaurantName}</span>
          <span>•</span>
          <span>Order #{orderId.replace(/^ORD-/i, '')}</span>
          {orderDate && (
            <>
              <span>•</span>
              <span className="flex items-center gap-1 font-normal text-[#9E9E9E]">
                <Clock className="w-3 h-3 text-[#E85D3F]" /> {orderDate}
              </span>
            </>
          )}
          {tableNumber && tableNumber !== 'Walk-in' && (
            <>
              <span>•</span>
              <span className="px-2 py-0.5 bg-[#FFF8F2] border border-[#EEE7E1] text-[#E85D3F] rounded-full text-[10px] font-bold">
                Table {tableNumber.replace(/^TBL-/i, '')}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Error banner if submission failed */}
      {errorMessage && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* B. OVERALL EXPERIENCE RATING */}
      <OverallExperienceSelector
        value={overallExperience}
        onChange={setOverallExperience}
      />

      {/* C. CATEGORY RATINGS (Separate 5-star controls) */}
      <div className="space-y-3 pt-1">
        <label className="text-xs font-extrabold uppercase tracking-wider text-[#6B6B6B] block">
          Rate by Category
        </label>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#FFFCF9] border border-[#EEE7E1] rounded-2xl p-4 sm:p-5">
          <StarRatingControl
            label="Food Quality"
            value={foodRating}
            onChange={setFoodRating}
            id="cat-food-quality"
            required
          />

          <StarRatingControl
            label="Service & Hospitality"
            value={serviceRating}
            onChange={setServiceRating}
            id="cat-service"
            required
          />

          <StarRatingControl
            label="Cleanliness & Hygiene"
            value={cleanlinessRating}
            onChange={setCleanlinessRating}
            id="cat-cleanliness"
            required
          />

          <StarRatingControl
            label="Dining Ambience"
            value={ambienceRating}
            onChange={setAmbienceRating}
            id="cat-ambience"
            required
          />
        </div>
      </div>

      {/* D. WRITTEN REVIEW */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between">
          <label 
            htmlFor="written-review-comments"
            className="text-xs font-extrabold uppercase tracking-wider text-[#6B6B6B] block"
          >
            Share Your Experience
          </label>
          <span className={`text-[11px] font-mono ${
            comments.length > MAX_COMMENT_LENGTH ? 'text-red-600 font-bold' : 'text-[#6B6B6B]'
          }`}>
            {comments.length} / {MAX_COMMENT_LENGTH} characters
          </span>
        </div>

        <textarea
          id="written-review-comments"
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          maxLength={MAX_COMMENT_LENGTH}
          rows={3}
          placeholder="Tell us what you enjoyed or how we could improve..."
          className="w-full bg-white border border-[#EEE7E1] focus:border-[#E85D3F] focus:ring-1 focus:ring-[#E85D3F] rounded-2xl p-3.5 text-xs text-[#242424] placeholder-[#6B6B6B]/60 outline-none resize-none transition-all shadow-2xs"
        />
      </div>

      {/* E. ANONYMOUS REVIEW OPTION */}
      <div className="p-4 bg-[#FFF8F2] border border-[#EEE7E1] rounded-2xl space-y-2">
        <label className="flex items-start space-x-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            id="anonymous-review-checkbox"
            checked={isAnonymous}
            onChange={(e) => setIsAnonymous(e.target.checked)}
            className="w-4 h-4 mt-0.5 accent-[#E85D3F] rounded cursor-pointer"
          />
          <div className="space-y-0.5">
            <span className="text-xs font-extrabold text-[#242424] block">
              Submit my review anonymously
            </span>
            <p className="text-[11px] text-[#6B6B6B] leading-relaxed">
              {isAnonymous ? (
                <>Your name will be publicly shown as <strong className="text-[#E85D3F] font-mono">{maskedNamePreview}</strong>. The review remains linked to your order internally for authentic verification.</>
              ) : (
                <>Your display name will appear alongside your published review. Check this box if you prefer a masked identity.</>
              )}
            </p>
          </div>
        </label>
      </div>

      {/* F. REVISIT INTENTION */}
      <div className="space-y-2 pt-1">
        <label className="text-xs font-extrabold uppercase tracking-wider text-[#6B6B6B] block">
          Would you visit this restaurant again?
        </label>

        <div className="grid grid-cols-3 gap-2">
          {(['Yes', 'Maybe', 'No'] as const).map((choice) => {
            const isSelected = revisitIntention === choice;
            return (
              <button
                key={choice}
                type="button"
                onClick={() => setRevisitIntention(choice)}
                className={`py-2.5 px-3 rounded-xl border text-xs font-extrabold transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#E85D3F] text-white border-[#E85D3F] shadow-sm'
                    : 'bg-white border-[#EEE7E1] text-[#242424] hover:bg-[#FFF8F2]'
                }`}
              >
                {choice === 'Yes' && '✓ '}
                {choice}
              </button>
            );
          })}
        </div>
      </div>

      {/* G. SUBMIT BUTTON & H. SKIP OPTION */}
      <div className="space-y-2.5 pt-3 border-t border-[#EEE7E1]">
        <button
          type="submit"
          disabled={isSubmitting || comments.length > MAX_COMMENT_LENGTH}
          className="w-full py-3.5 bg-[#E85D3F] hover:bg-[#D04B2F] disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-extrabold rounded-xl transition-all shadow-md shadow-[#E85D3F]/20 cursor-pointer flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Saving Review...</span>
            </>
          ) : (
            <span>Submit Review</span>
          )}
        </button>

        <button
          type="button"
          onClick={onSkipReceipt}
          className="w-full py-2.5 text-xs font-bold text-[#6B6B6B] hover:text-[#242424] transition-colors cursor-pointer flex items-center justify-center gap-1"
        >
          <span>Skip & View Receipt</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </form>
  );
};

export default CustomerReviewSubmissionForm;
