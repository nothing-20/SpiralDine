import React from 'react';
import { Star, Utensils, Sparkles, ShieldCheck, HeartHandshake, CheckCircle2, UserCheck, Shield, Trash2 } from 'lucide-react';
import { ISatisfactionRatingRecord, maskCustomerName } from '../../../../shared/services/reviewService';

interface ReviewCardProps {
  review: ISatisfactionRatingRecord;
  onDelete?: (review: ISatisfactionRatingRecord) => void;
}

export const ReviewCard: React.FC<ReviewCardProps> = ({ review, onDelete }) => {
  // Determine customer name to display
  const isAnon = Boolean(review.isAnonymous);
  const displayName = isAnon
    ? 'Anonymous Customer'
    : review.publicCustomerName || review.submittedByName || 'Guest Diner';

  const initial = displayName.charAt(0).toUpperCase();

  // Format date and time nicely
  const formatDateTime = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch (_) {
      return '';
    }
  };

  const reviewDateTime = formatDateTime(review.submittedAt || review.createdAt);
  const starScore = review.starRating || 5;

  const rawNotes = (review.notes || review.comments || review.feedback || '').trim();
  const hasValidNotes = rawNotes.length > 0 && 
    !rawNotes.toLowerCase().includes('no additional comments') && 
    !rawNotes.toLowerCase().includes('feedback registered without');

  const foodScore = review.foodQuality;
  const serviceScore = review.service || review.serviceSpeed;
  const cleanScore = review.cleanliness;
  const ambienceScore = review.ambience;

  return (
    <div className="p-5 bg-white border border-[#EEE7E1] hover:border-[#E85D3F]/40 rounded-2xl space-y-3.5 shadow-2xs hover:shadow-xs transition-all">
      {/* Top Header: Avatar, Name, Anonymous tag, Date, Stars */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center space-x-3">
          {/* Avatar Icon */}
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-display font-extrabold text-sm shrink-0 border ${
            isAnon
              ? 'bg-slate-100 text-slate-700 border-slate-200'
              : 'bg-[#FFF8F2] text-[#E85D3F] border-[#EEE7E1]'
          }`}>
            {isAnon ? <Shield className="w-4 h-4 text-slate-600" /> : initial}
          </div>

          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-extrabold text-[#242424] font-display">
                {displayName}
              </h4>
              {isAnon ? (
                <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full border border-slate-200 flex items-center gap-1">
                  <Shield className="w-2.5 h-2.5" />
                  <span>Anonymous</span>
                </span>
              ) : (
                <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200 flex items-center gap-1">
                  <UserCheck className="w-2.5 h-2.5" />
                  <span>Verified</span>
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#6B6B6B]">
              {review.orderId && (
                <span>Order #{review.orderId.replace(/^ORD-/i, '')}</span>
              )}
              {review.orderId && reviewDateTime && <span>•</span>}
              {reviewDateTime && <span>{reviewDateTime}</span>}
              {review.tableNumber && review.tableNumber !== 'Walk-in' && (
                <>
                  <span>•</span>
                  <span>Table {review.tableNumber.replace(/^TBL-/i, '')}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Stars & Delete Action */}
        <div className="flex items-center space-x-2 self-start sm:self-auto">
          <div className="flex items-center space-x-1 bg-[#FFF8F2] px-2.5 py-1 rounded-xl border border-[#EEE7E1]">
            <div className="flex items-center">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`w-3.5 h-3.5 ${
                    star <= starScore
                      ? 'text-[#D98B00] fill-[#D98B00]'
                      : 'text-[#EEE7E1] fill-none'
                  }`}
                />
              ))}
            </div>
            <span className="text-xs font-bold text-[#17202A] ml-1 font-mono">
              {starScore.toFixed(1)}
            </span>
          </div>

          {onDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(review);
              }}
              className="p-1.5 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors"
              title="Delete this review from Firestore"
              aria-label="Delete review"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Subcategory Scores Chips (Food, Service, Cleanliness, Ambience) */}
      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
        {foodScore && (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-[#F8F6F2] border border-[#E5E0D9] rounded-lg text-[11px] font-semibold text-[#17202A]">
            <Utensils className="w-3 h-3 text-[#B33E26]" />
            <span>Food: {foodScore}★</span>
          </span>
        )}
        {serviceScore && (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-[#F8F6F2] border border-[#E5E0D9] rounded-lg text-[11px] font-semibold text-[#17202A]">
            <Sparkles className="w-3 h-3 text-amber-600" />
            <span>Service: {serviceScore}★</span>
          </span>
        )}
        {cleanScore && (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-[#F8F6F2] border border-[#E5E0D9] rounded-lg text-[11px] font-semibold text-[#17202A]">
            <ShieldCheck className="w-3 h-3 text-emerald-700" />
            <span>Clean: {cleanScore}★</span>
          </span>
        )}
        {ambienceScore && (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-[#F8F6F2] border border-[#E5E0D9] rounded-lg text-[11px] font-semibold text-[#17202A]">
            <HeartHandshake className="w-3 h-3 text-indigo-700" />
            <span>Ambience: {ambienceScore}★</span>
          </span>
        )}
        {(review.revisitIntention === 'Yes' || review.repeatCustomer) && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-[10px] font-bold ml-auto">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>Would visit again</span>
          </span>
        )}
      </div>

      {/* Written Comment */}
      {hasValidNotes ? (
        <p className="text-xs sm:text-[13px] text-[#17202A] leading-relaxed bg-[#F8F6F2] border border-[#E5E0D9] p-3 rounded-xl italic">
          "{rawNotes}"
        </p>
      ) : (
        <p className="text-xs sm:text-[12px] text-[#52606D] italic bg-[#F9F9F8] border border-[#E5E0D9]/50 p-2.5 rounded-xl">
          No written comment
        </p>
      )}
    </div>
  );
};

export default ReviewCard;
