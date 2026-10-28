import React, { useState, useEffect, useRef } from 'react';
import { cn } from '../../../utils/cn';

export interface IDropdownItem {
  label: string;
  onClick: () => void;
  className?: string;
  icon?: React.ComponentType<any>;
}

export interface IDropdownProps {
  trigger: React.ReactNode;
  items: IDropdownItem[];
  className?: string;
  align?: 'left' | 'right';
}

export const Dropdown: React.FC<IDropdownProps> = ({
  trigger,
  items,
  className,
  align = 'right'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  return (
    <div className={cn("relative inline-block text-left", className)} ref={containerRef}>
      {/* Trigger toggle button */}
      <div onClick={() => setIsOpen(!isOpen)} className="cursor-pointer">
        {trigger}
      </div>

      {/* Dropdown panel overlay */}
      {isOpen ? (
        <div className={cn(
          "absolute mt-2.5 w-48 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl z-40 p-1 animate-in fade-in slide-in-from-top-2 duration-250",
          align === 'right' ? 'right-0' : 'left-0'
        )}>
          {items.map((item, idx) => {
            const IconComp = item.icon;
            return (
              <button
                key={idx}
                onClick={() => {
                  item.onClick();
                  setIsOpen(false);
                }}
                className={cn(
                  "flex items-center space-x-2.5 w-full px-3 py-2 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-textPearl hover:bg-slate-100 dark:hover:bg-slate-850 transition-colors text-left",
                  item.className
                )}
              >
                {IconComp ? <IconComp className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" /> : null}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};
export default Dropdown;
