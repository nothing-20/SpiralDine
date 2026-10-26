import React from 'react';
import { LucideIcon } from 'lucide-react';

interface MobileEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const MobileEmptyState: React.FC<MobileEmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className = '',
}) => {
  return (
    <div className={`flex flex-col items-center justify-center text-center p-8 bg-white rounded-2xl border border-[#EBEBEB] ${className}`}>
      <div className="w-14 h-14 rounded-2xl bg-[#FFF4EE] border border-[#FFE0CE] text-[#FF7518] flex items-center justify-center mb-3">
        <Icon className="w-7 h-7" />
      </div>
      <h3 className="font-bold text-base text-[#202124] mb-1">{title}</h3>
      <p className="text-xs text-[#707070] max-w-xs leading-relaxed mb-4">{description}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="px-4 py-2 bg-[#FF7518] hover:bg-[#E05D07] text-white text-xs font-bold rounded-xl transition-all shadow-sm shadow-[#FF7518]/20"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};

export default MobileEmptyState;
