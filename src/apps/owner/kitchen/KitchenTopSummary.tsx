import React from 'react';
import { ChefHat, Clock, Check, Hourglass, Utensils } from 'lucide-react';

interface IKitchenTopSummaryProps {
  activeOrdersCount: number;
  itemsCookingCount: number;
  readyToServeCount: number;
  delayedItemsCount: number;
}

export const KitchenTopSummary: React.FC<IKitchenTopSummaryProps> = ({
  activeOrdersCount,
  itemsCookingCount,
  readyToServeCount,
  delayedItemsCount,
}) => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
      {/* 1. Active Orders (Hero Dark-Green Card) */}
      <div className="bg-[#183B2B] border border-[#132E22] rounded-2xl p-4 flex items-center justify-between shadow-xs text-white">
        <div className="space-y-0.5">
          <div className="text-2xl lg:text-3xl font-black text-white leading-tight">
            {activeOrdersCount}
          </div>
          <div className="text-xs font-semibold text-white/85">
            Active Orders
          </div>
        </div>
        <div className="w-11 h-11 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
          <Utensils className="w-5 h-5 text-white" />
        </div>
      </div>

      {/* 2. Items Cooking */}
      <div className="bg-white border border-[#E3DED5] rounded-2xl p-4 flex items-center justify-between shadow-xs">
        <div className="space-y-0.5">
          <div className="text-2xl lg:text-3xl font-black text-[#18201D] leading-tight">
            {itemsCookingCount}
          </div>
          <div className="text-xs font-semibold text-[#71717A]">
            Items Cooking
          </div>
        </div>
        <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
          <Clock className="w-5 h-5 text-amber-600" />
        </div>
      </div>

      {/* 3. Ready to Serve */}
      <div className="bg-white border border-[#E3DED5] rounded-2xl p-4 flex items-center justify-between shadow-xs">
        <div className="space-y-0.5">
          <div className="text-2xl lg:text-3xl font-black text-[#18201D] leading-tight">
            {readyToServeCount}
          </div>
          <div className="text-xs font-semibold text-[#71717A]">
            Ready to Serve
          </div>
        </div>
        <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
          <Check className="w-5 h-5 text-emerald-600 stroke-[2.5]" />
        </div>
      </div>

      {/* 4. Delayed */}
      <div className={`bg-white border rounded-2xl p-4 flex items-center justify-between shadow-xs ${
        delayedItemsCount > 0 ? 'border-red-200 bg-red-50/20' : 'border-[#E3DED5]'
      }`}>
        <div className="space-y-0.5">
          <div className={`text-2xl lg:text-3xl font-black leading-tight ${
            delayedItemsCount > 0 ? 'text-red-600' : 'text-[#18201D]'
          }`}>
            {delayedItemsCount}
          </div>
          <div className="text-xs font-semibold text-[#71717A]">
            Delayed
          </div>
        </div>
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${
          delayedItemsCount > 0 
            ? 'bg-red-50 border-red-200 text-red-600 animate-pulse' 
            : 'bg-stone-50 border-stone-200 text-stone-500'
        }`}>
          <Hourglass className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
};

export default KitchenTopSummary;

