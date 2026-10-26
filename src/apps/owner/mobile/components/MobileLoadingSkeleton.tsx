import React from 'react';

export const MobileLoadingSkeleton: React.FC<{ count?: number; type?: 'card' | 'row' | 'dashboard' }> = ({
  count = 3,
  type = 'card',
}) => {
  if (type === 'dashboard') {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-2xl p-4 border border-[#EBEBEB] space-y-2">
              <div className="w-16 h-3 bg-gray-200 rounded" />
              <div className="w-24 h-6 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
        <div className="bg-white rounded-2xl p-4 border border-[#EBEBEB] space-y-3">
          <div className="w-32 h-4 bg-gray-200 rounded" />
          <div className="w-full h-16 bg-gray-100 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="bg-white rounded-2xl p-4 border border-[#EBEBEB] space-y-2.5"
        >
          <div className="flex items-center justify-between">
            <div className="w-28 h-4 bg-gray-200 rounded" />
            <div className="w-16 h-4 bg-gray-200 rounded-full" />
          </div>
          <div className="w-40 h-3 bg-gray-100 rounded" />
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <div className="w-20 h-4 bg-gray-200 rounded" />
            <div className="w-24 h-6 bg-gray-100 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
};

export default MobileLoadingSkeleton;
