import React, { useState } from 'react';
import { Star } from 'lucide-react';

interface StarRatingControlProps {
  value: number;
  onChange?: (rating: number) => void;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  readOnly?: boolean;
  required?: boolean;
  id?: string;
}

export const StarRatingControl: React.FC<StarRatingControlProps> = ({
  value,
  onChange,
  label,
  size = 'md',
  readOnly = false,
  required = false,
  id
}) => {
  const [hoverValue, setHoverValue] = useState<number | null>(null);

  const starSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  const buttonPaddings = {
    sm: 'p-1',
    md: 'p-1.5 min-w-[36px] min-h-[36px]',
    lg: 'p-2 min-w-[44px] min-h-[44px]'
  };

  const activeRating = hoverValue !== null ? hoverValue : value;

  const handleKeyDown = (e: React.KeyboardEvent, star: number) => {
    if (readOnly || !onChange) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onChange(star);
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      const next = Math.min(5, star + 1);
      onChange(next);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      const prev = Math.max(1, star - 1);
      onChange(prev);
    }
  };

  return (
    <div className="space-y-1">
      {label && (
        <div className="flex items-center justify-between">
          <label 
            htmlFor={id} 
            className="text-[11px] font-bold text-[#6B6B6B] uppercase tracking-wider block select-none"
          >
            {label} {required && <span className="text-[#E85D3F]">*</span>}
          </label>
          {!readOnly && (
            <span className="text-xs font-bold text-[#E85D3F]">
              {activeRating > 0 ? `${activeRating}/5` : 'Rate'}
            </span>
          )}
        </div>
      )}

      <div 
        id={id}
        role={readOnly ? 'img' : 'radiogroup'}
        aria-label={label ? `${label} rating: ${value} of 5 stars` : `Rating: ${value} of 5 stars`}
        className="flex items-center space-x-0.5"
        onMouseLeave={() => !readOnly && setHoverValue(null)}
      >
        {[1, 2, 3, 4, 5].map((star) => {
          const isFilled = star <= activeRating;

          if (readOnly) {
            return (
              <span
                key={star}
                className="inline-flex items-center justify-center p-0.5"
                aria-hidden="true"
              >
                <Star
                  className={`${starSizes[size]} transition-colors ${
                    isFilled 
                      ? 'text-[#F4B942] fill-[#F4B942]' 
                      : 'text-[#E5DCD5] fill-none'
                  }`}
                />
              </span>
            );
          }

          return (
            <button
              key={star}
              type="button"
              role="radio"
              aria-checked={star === value}
              aria-label={`${star} star${star > 1 ? 's' : ''}`}
              tabIndex={0}
              onClick={() => onChange && onChange(star)}
              onMouseEnter={() => setHoverValue(star)}
              onKeyDown={(e) => handleKeyDown(e, star)}
              className={`${buttonPaddings[size]} rounded-xl inline-flex items-center justify-center transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#E85D3F]/40 active:scale-95 text-[#D4C8BE] hover:text-[#F4B942]`}
            >
              <Star
                className={`${starSizes[size]} transition-all duration-150 ${
                  isFilled
                    ? 'text-[#F4B942] fill-[#F4B942] scale-105 drop-shadow-[0_1px_2px_rgba(244,185,66,0.3)]'
                    : 'text-[#D4C8BE] fill-none hover:text-[#F4B942]/60'
                }`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default StarRatingControl;
