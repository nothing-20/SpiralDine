import React from 'react';

/**
 * Food Menu Item Skeleton Card
 * Approximates 2-col or 3-col food catalog items
 */
export const MenuItemSkeleton: React.FC = () => {
  return (
    <div className="p-4 bg-white border border-[#EEE7E1] rounded-2xl flex flex-col space-y-3.5 animate-pulse shadow-xs">
      <div className="w-full h-40 rounded-xl bg-[#FFF8F2] relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#EEE7E1]/40 to-transparent animate-shimmer" />
      </div>
      <div className="flex justify-between items-start">
        <div className="h-4 w-36 bg-[#EEE7E1] rounded" />
        <div className="h-4 w-16 bg-[#EEE7E1] rounded" />
      </div>
      <div className="h-3 w-4/5 bg-[#EEE7E1]/60 rounded" />
      <div className="flex gap-2 pt-1">
        <div className="h-6 w-16 bg-[#FFF8F2] rounded-full border border-[#EEE7E1]" />
        <div className="h-6 w-20 bg-[#FFF8F2] rounded-full border border-[#EEE7E1]" />
      </div>
      <div className="flex justify-between items-center pt-2 border-t border-[#EEE7E1]">
        <div className="h-4 w-12 bg-[#EEE7E1] rounded" />
        <div className="h-7 w-20 bg-[#E85D3F]/20 rounded-xl" />
      </div>
    </div>
  );
};

/**
 * Horizontal Restaurant Card Skeleton
 * Used on CustomerHome.tsx to prevent CLS and avoid "Coming Soon" flash
 */
export const RestaurantCardSkeleton: React.FC = () => {
  return (
    <div className="rounded-2xl border border-[#EEE7E1] bg-white overflow-hidden p-2.5 sm:p-3 flex items-center gap-3 sm:gap-4 animate-pulse shadow-xs">
      {/* Left Thumbnail with fixed aspect ratio */}
      <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl bg-[#FFF8F2] shrink-0 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#EEE7E1]/40 to-transparent animate-shimmer" />
      </div>
      {/* Right Details Column */}
      <div className="flex-1 min-w-0 space-y-2 py-0.5">
        <div className="flex items-center justify-between gap-2">
          <div className="h-4 w-36 sm:w-48 bg-[#EEE7E1] rounded" />
          <div className="h-3 w-12 bg-[#EEE7E1]/60 rounded-full" />
        </div>
        <div className="h-3 w-28 bg-[#EEE7E1]/70 rounded" />
        <div className="h-3 w-40 bg-[#EEE7E1]/50 rounded" />
        <div className="flex items-center gap-2 pt-1">
          <div className="h-4 w-14 bg-[#FFF8F2] rounded-full border border-[#EEE7E1]" />
          <div className="h-4 w-20 bg-[#FFF8F2] rounded-full border border-[#EEE7E1]" />
        </div>
      </div>
    </div>
  );
};

/**
 * Grid Restaurant Card Skeleton
 * Used in RestaurantDiscovery.tsx (1-col mobile, 2-col tablet, 3-col desktop)
 */
export const RestaurantGridCardSkeleton: React.FC = () => {
  return (
    <div className="bg-slate-900/30 border border-slate-800/60 rounded-2xl overflow-hidden animate-pulse shadow-lg flex flex-col justify-between">
      {/* Fixed aspect ratio banner */}
      <div className="w-full h-36 bg-slate-950 relative overflow-hidden flex items-center justify-center">
        <div className="w-10 h-10 rounded-xl bg-slate-850/60" />
      </div>
      <div className="p-3.5 space-y-2.5">
        <div className="space-y-1">
          <div className="h-4 w-3/4 bg-slate-800 rounded" />
          <div className="h-3 w-1/2 bg-slate-850 rounded" />
        </div>
        <div className="flex justify-between items-center pt-2 border-t border-slate-850/60">
          <div className="h-3 w-20 bg-slate-850 rounded" />
          <div className="h-3 w-10 bg-slate-850 rounded" />
        </div>
      </div>
    </div>
  );
};

/**
 * Category Chips Skeleton
 */
export const CategorySkeleton: React.FC = () => {
  return (
    <div className="flex items-center space-x-2.5 overflow-x-auto pb-1 scrollbar-none animate-pulse">
      {[1, 2, 3, 4, 5, 6].map(i => (
        <div key={i} className="h-9 w-28 bg-[#FFF8F2] border border-[#EEE7E1] rounded-full shrink-0" />
      ))}
    </div>
  );
};

/**
 * Promotional Banner Skeleton
 */
export const BannerSkeleton: React.FC = () => {
  return (
    <div className="w-full h-44 md:h-56 rounded-3xl bg-[#FFF8F2] border border-[#EEE7E1] animate-pulse relative overflow-hidden p-6 flex flex-col justify-end">
      <div className="h-6 w-48 bg-[#EEE7E1] rounded mb-2" />
      <div className="h-4 w-64 bg-[#EEE7E1]/60 rounded" />
    </div>
  );
};

/**
 * Full Restaurant Details Page Skeleton
 * Used in RestaurantDetails.tsx to avoid full-screen spinner
 */
export const RestaurantDetailsSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 text-left max-w-5xl mx-auto pb-16 animate-pulse select-none">
      {/* Hero Cover Banner Skeleton */}
      <div className="h-60 md:h-72 w-full rounded-3xl bg-[#FFF8F2] border border-[#EEE7E1] relative overflow-hidden p-6 flex flex-col justify-end">
        <div className="space-y-2 max-w-sm">
          <div className="h-7 w-56 bg-[#EEE7E1] rounded-lg" />
          <div className="h-4 w-40 bg-[#EEE7E1]/70 rounded" />
        </div>
      </div>

      {/* Info Pills Skeleton */}
      <div className="flex flex-wrap gap-2.5">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-9 w-32 bg-white border border-[#EEE7E1] rounded-xl" />
        ))}
      </div>

      {/* Categories Bar Skeleton */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="h-10 w-28 bg-white border border-[#EEE7E1] rounded-xl shrink-0" />
        ))}
      </div>

      {/* Menu Items Grid Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-2">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <MenuItemSkeleton key={i} />
        ))}
      </div>
    </div>
  );
};

/**
 * Dashboard Metric Card Skeleton
 * Used in OwnerOverview.tsx for KPI stat cards
 */
export const DashboardMetricSkeleton: React.FC = () => {
  return (
    <div className="bg-white p-5 rounded-2xl border border-[#E5E0D9] space-y-3 animate-pulse shadow-xs">
      <div className="flex justify-between items-center">
        <div className="h-3.5 w-24 bg-[#E5E0D9] rounded" />
        <div className="w-8 h-8 rounded-xl bg-[#F3E8DF]" />
      </div>
      <div className="h-7 w-32 bg-[#E5E0D9] rounded-lg" />
      <div className="h-3 w-40 bg-[#E5E0D9]/60 rounded" />
    </div>
  );
};

/**
 * Order Tracker Skeleton
 */
export const OrderTrackerSkeleton: React.FC = () => {
  return (
    <div className="p-6 bg-white border border-[#EEE7E1] rounded-3xl space-y-4 animate-pulse shadow-xs">
      <div className="flex justify-between items-center pb-3 border-b border-[#EEE7E1]">
        <div className="h-4 w-28 bg-[#EEE7E1] rounded" />
        <div className="h-4 w-20 bg-[#EEE7E1] rounded" />
      </div>
      <div className="space-y-4 py-2">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-[#EEE7E1] shrink-0" />
            <div className="space-y-1.5 flex-1">
              <div className="h-3.5 w-32 bg-[#EEE7E1] rounded" />
              <div className="h-3 w-48 bg-[#EEE7E1]/50 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MenuItemSkeleton;
