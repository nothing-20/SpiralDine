import React from 'react';
import { cn } from '../../../utils/cn';

export interface IButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button: React.FC<IButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  className,
  disabled,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 disabled:cursor-not-allowed';

  const variants = {
    primary: 'bg-primary text-white hover:bg-primary-hover shadow-lg shadow-primary/10',
    secondary: 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700/50',
    danger: 'bg-red-500/10 text-red-700 dark:text-red-400 hover:bg-red-500/20 border border-red-500/30 font-bold',
    ghost: 'text-slate-700 dark:text-mutedAsh hover:text-slate-950 dark:hover:text-textPearl hover:bg-slate-100 dark:hover:bg-slate-900/60',
    outline: 'border border-slate-300 dark:border-slate-850 bg-transparent text-slate-700 dark:text-slate-300 hover:border-primary hover:text-primary',
  };

  const sizes = {
    xs: 'px-2.5 py-1 text-[10px]',
    sm: 'px-3.5 py-1.5 text-xs',
    md: 'px-5 py-2.5 text-sm',
    lg: 'px-7 py-3 text-base',
  };

  return (
    <button
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="w-4 h-4 mr-2 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : null}
      {children}
    </button>
  );
};
export default Button;
