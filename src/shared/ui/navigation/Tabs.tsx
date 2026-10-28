import React from 'react';
import { cn } from '../../../utils/cn';

export interface ITabItem {
  id: string;
  label: string;
  icon?: React.ComponentType<any>;
}

export interface ITabsProps {
  tabs: ITabItem[];
  activeTabId: string;
  onTabChange: (id: string) => void;
  className?: string;
}

export const Tabs: React.FC<ITabsProps> = ({
  tabs,
  activeTabId,
  onTabChange,
  className
}) => {
  return (
    <div className={cn("flex items-center space-x-1.5 p-1 border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950/40 rounded-xl max-w-max select-none", className)}>
      {tabs.map((tab) => {
        const IconComp = tab.icon;
        const isActive = tab.id === activeTabId;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-300",
              isActive 
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-primary shadow border border-slate-300 dark:border-slate-850 font-bold" 
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-textPearl hover:bg-white/60 dark:hover:bg-slate-900/30"
            )}
          >
            {IconComp ? <IconComp className="w-3.5 h-3.5" /> : null}
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
};
export default Tabs;
