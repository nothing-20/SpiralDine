import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../../../../config/firebase';
import { IPromotion } from '../../../../shared/domain/promotions/types';
import { isPromotionActive } from '../../../../shared/services/promotionEngine';
import { Sparkles, Tag, ChevronRight, Copy, Gift, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';

interface PromotionsCarouselProps {
  restaurants: any[];
  currentCity?: string;
}

export const PromotionsCarousel: React.FC<PromotionsCarouselProps> = ({
  restaurants,
  currentCity = 'Hyderabad'
}) => {
  const navigate = useNavigate();
  const [promotions, setPromotions] = useState<(IPromotion & { restaurantName?: string; restaurantCity?: string })[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    const loadActivePromotions = async () => {
      setIsLoading(true);
      try {
        const promos: (IPromotion & { restaurantName?: string; restaurantCity?: string })[] = [];
        
        // Take restaurants in current city (up to 12) and fetch their active promotions
        const targetRestaurants = restaurants.slice(0, 12);

        await Promise.all(
          targetRestaurants.map(async (r) => {
            try {
              const promoCol = collection(db, 'restaurants', r.id, 'promotions');
              const q = query(promoCol, where('status', '==', 'active'), limit(6));
              const snap = await getDocs(q);
              snap.forEach(d => {
                const data = d.data() as IPromotion;
                const placements = Array.isArray(data.placements) 
                  ? data.placements 
                  : (data.placement ? [data.placement as any] : ['home_carousel']);
                const isHomePlacement = placements.includes('home_carousel') || placements.includes('HOME_CAROUSEL' as any) || placements.includes('ALL' as any);
                if (isPromotionActive(data) && isHomePlacement) {
                  const codeVal = (data.code || data.couponCode) ? String(data.code || data.couponCode).toUpperCase() : undefined;
                  const promoVal = Number(data.value ?? data.discountValue ?? 0);
                  promos.push({
                    ...data,
                    id: d.id,
                    tenantId: data.tenantId || r.id,
                    restaurantId: data.restaurantId || r.id,
                    restaurantName: r.name || data.restaurantName || 'Restaurant',
                    restaurantCity: r.city || currentCity,
                    code: codeVal,
                    couponCode: codeVal,
                    value: promoVal,
                    discountValue: promoVal,
                    placements
                  });
                }
              });
            } catch (_) {
              // Ignore subcollection access warnings for restaurants without promotions
            }
          })
        );

        if (isMounted) {
          setPromotions(promos);
        }
      } catch (err) {
        console.warn('[PromotionsCarousel] Load active promos warning:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    if (restaurants.length > 0) {
      loadActivePromotions();
    } else {
      setIsLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [restaurants, currentCity]);

  const copyCode = (code: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    toast.success(`Coupon code "${code}" copied!`);
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-4 bg-[#F3E8DF] rounded-md w-36 animate-pulse" />
        </div>
        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none">
          {[1, 2, 3].map(i => (
            <div key={i} className="min-w-[280px] sm:min-w-[320px] h-36 bg-[#FCFAF7] border border-[#E5DCD5] rounded-3xl animate-pulse shrink-0" />
          ))}
        </div>
      </div>
    );
  }

  // If there are no real promotions in the database, don't show an artificial banner
  if (promotions.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 pt-1">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-xl bg-[#F3E8DF] text-[#C85A3F]">
            <Gift className="w-4 h-4" />
          </span>
          <div>
            <h3 className="text-base font-extrabold text-[#202124] tracking-tight">
              Offers & Promotions for You
            </h3>
            <p className="text-[11px] text-[#756B64] font-medium">
              Verified active dining deals and discount coupons
            </p>
          </div>
        </div>
      </div>

      {/* Swipeable Carousel */}
      <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-2 pt-1 scrollbar-none snap-x snap-mandatory select-none">
        {promotions.map((p) => {
          return (
            <div
              key={`${p.tenantId}_${p.id}`}
              onClick={() => navigate(`/customer/restaurant/${p.tenantId}`)}
              className="group min-w-[280px] sm:min-w-[340px] max-w-[360px] bg-gradient-to-br from-[#202124] via-[#2d2421] to-[#3a221d] text-white rounded-3xl p-5 flex flex-col justify-between shrink-0 shadow-sm hover:shadow-lg transition-all duration-200 cursor-pointer snap-start relative overflow-hidden border border-white/10"
            >
              {/* Background ambient light */}
              <div className="absolute -right-8 -bottom-8 w-28 h-28 bg-[#C85A3F]/20 rounded-full blur-2xl pointer-events-none" />

              <div className="space-y-2 relative z-10">
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-[#C85A3F] text-white text-[10px] font-extrabold uppercase tracking-wide flex items-center gap-1 shadow-xs">
                    <Sparkles className="w-3 h-3" />
                    <span>{p.badgeText || (p.type === 'bogo' ? 'BUY 1 GET 1' : `${p.value}% OFF`)}</span>
                  </span>

                  <span className="text-[10px] text-white/70 font-medium truncate max-w-[130px]">
                    {p.restaurantName}
                  </span>
                </div>

                <div>
                  <h4 className="text-sm sm:text-base font-extrabold tracking-tight group-hover:text-[#F3E8DF] transition-colors line-clamp-1">
                    {p.name}
                  </h4>
                  <p className="text-[11px] text-white/80 line-clamp-2 mt-0.5 font-medium leading-relaxed">
                    {p.description || `Claim ${p.value}% discount on eligible dining orders.`}
                  </p>
                </div>
              </div>

              {/* Card Bottom: Coupon Code + CTA */}
              <div className="pt-4 border-t border-white/10 flex items-center justify-between gap-2 relative z-10">
                {p.code ? (
                  <button
                    type="button"
                    onClick={(e) => copyCode(p.code!, e)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-mono font-bold text-xs transition-colors cursor-pointer"
                    title="Click to copy coupon code"
                  >
                    <span>{p.code}</span>
                    <Copy className="w-3 h-3 text-white/70" />
                  </button>
                ) : (
                  <span className="text-[10px] text-white/60 font-medium">
                    Auto-applied at checkout
                  </span>
                )}

                <span className="inline-flex items-center gap-1 text-xs font-extrabold text-[#F3E8DF] group-hover:text-white transition-colors">
                  <span>Order Now</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PromotionsCarousel;
