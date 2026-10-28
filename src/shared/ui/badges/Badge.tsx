import React from 'react';
import { cn } from '../../../utils/cn';

export interface IBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'muted' | 'info' | 'secondary' | 'neutral';
  isLarge?: boolean;
}

export const Badge: React.FC<IBadgeProps> = ({
  children,
  variant = 'muted',
  isLarge = false,
  className,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-semibold rounded-full select-none';

  const variants = {
    primary: 'bg-primary/10 text-primary border border-primary/30 shadow-sm shadow-primary/5 font-bold',
    success: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 shadow-sm shadow-emerald-500/5 font-bold',
    warning: 'bg-amber-500/10 text-amber-800 dark:text-amber-400 border border-amber-500/30 shadow-sm font-bold',
    danger: 'bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/30 shadow-sm font-bold',
    muted: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/50 font-medium',
    info: 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/30 shadow-sm shadow-sky-500/5 font-bold',
    secondary: 'bg-slate-100 dark:bg-slate-700/30 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600/30 shadow-sm font-medium',
    neutral: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/50 font-medium'
  };

  const sizes = isLarge ? 'px-3.5 py-1 text-sm' : 'px-2.5 py-0.5 text-xs';

  return (
    <span
      className={cn(baseStyles, variants[variant], sizes, className)}
      {...props}
    >
      {children}
    </span>
  );
};
export default Badge;
