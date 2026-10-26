import React from 'react';

export interface FilterTabOption {
  id: string;
  label: string;
  count?: number;
}

interface MobileFilterTabsProps {
  tabs: FilterTabOption[];
  activeTab: string;
  onSelectTab: (tabId: string) => void;
  className?: string;
}

export const MobileFilterTabs: React.FC<MobileFilterTabsProps> = ({
  tabs,
  activeTab,
  onSelectTab,
  className = '',
}) => {
  return (
    <div className={`overflow-x-auto no-scrollbar py-2 -mx-4 px-4 ${className}`}>
      <div className="flex items-center gap-2 min-w-max">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 select-none ${
                isActive
                  ? 'bg-[#FF7518] text-white shadow-sm shadow-[#FF7518]/25'
                  : 'bg-white text-[#707070] border border-[#EBEBEB] hover:border-[#D1D5DB]'
              }`}
            >
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isActive ? 'bg-white/25 text-white' : 'bg-[#F3F4F6] text-[#707070]'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default MobileFilterTabs;
