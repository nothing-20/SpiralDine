import React from 'react';
import { Search } from 'lucide-react';
import { cn } from '../../../utils/cn';

export interface ISearchBarProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onSearchChange?: (val: string) => void;
}

export const SearchBar: React.FC<ISearchBarProps> = ({
  className,
  onSearchChange,
  placeholder = 'Search...',
  ...props
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onSearchChange) {
      onSearchChange(e.target.value);
    }
  };

  return (
    <div className={cn("relative w-full", className)}>
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 dark:text-slate-400" />
      <input
        type="text"
        placeholder={placeholder}
        onChange={handleChange}
        className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900/60 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-textPearl rounded-xl text-sm placeholder-slate-500 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
        {...props}
      />
    </div>
  );
};
export default SearchBar;
