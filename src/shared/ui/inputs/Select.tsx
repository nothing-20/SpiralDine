import React from 'react';
import { cn } from '../../../utils/cn';

export interface ISelectOption {
  value: string;
  label: string;
}

export interface ISelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: ISelectOption[];
  error?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, ISelectProps>(
  ({ label, options, error, className, ...props }, ref) => {
    return (
      <div className="w-full flex flex-col space-y-1.5 text-left">
        {label ? (
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 select-none">{label}</span>
        ) : null}
        <select
          ref={ref}
          className={cn(
            "w-full px-4 py-2.5 bg-white dark:bg-slate-900/60 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-textPearl rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all cursor-pointer",
            error ? "border-red-500/50 focus:ring-red-500/30 focus:border-red-500" : "",
            className
          )}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-textPearl">
              {opt.label}
            </option>
          ))}
        </select>
        {error ? (
          <span className="text-[11px] font-semibold text-red-500 pl-1">{error}</span>
        ) : null}
      </div>
    );
  }
);

Select.displayName = 'Select';
export default Select;
