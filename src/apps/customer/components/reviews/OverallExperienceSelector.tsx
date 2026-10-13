import React from 'react';
import { OverallExperienceType } from '../../../../shared/services/reviewService';

interface OverallExperienceSelectorProps {
  value: OverallExperienceType;
  onChange: (value: OverallExperienceType) => void;
  id?: string;
}

interface OptionConfig {
  key: OverallExperienceType;
  label: string;
  emoji: string;
  description: string;
}

const OPTIONS: OptionConfig[] = [
  { key: 'Excellent', label: 'Excellent', emoji: '😍', description: 'Exceptional food & dining' },
  { key: 'Good', label: 'Good', emoji: '😊', description: 'Enjoyable meal & service' },
  { key: 'Average', label: 'Average', emoji: '😐', description: 'Met normal expectations' },
  { key: 'Poor', label: 'Poor', emoji: '🙁', description: 'Needs meaningful improvement' },
  { key: 'Very Poor', label: 'Very Poor', emoji: '😡', description: 'Significant dining issues' }
];

export const OverallExperienceSelector: React.FC<OverallExperienceSelectorProps> = ({
  value,
  onChange,
  id = 'overall-experience-group'
}) => {
  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = (index + 1) % OPTIONS.length;
      onChange(OPTIONS[nextIndex].key);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIndex = (index - 1 + OPTIONS.length) % OPTIONS.length;
      onChange(OPTIONS[prevIndex].key);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label 
          htmlFor={id} 
          className="text-xs font-extrabold uppercase tracking-wider text-[#6B6B6B] block"
        >
          How was your overall experience?
        </label>
        <span className="text-xs font-bold text-[#E85D3F]">
          {OPTIONS.find(o => o.key === value)?.label}
        </span>
      </div>

      <div 
        id={id}
        role="radiogroup" 
        aria-label="How was your overall experience?"
        className="grid grid-cols-5 gap-2 sm:gap-2.5 text-center"
      >
        {OPTIONS.map((opt, idx) => {
          const isSelected = value === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={`${opt.label}: ${opt.description}`}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => onChange(opt.key)}
              onKeyDown={(e) => handleKeyDown(e, idx)}
              className={`p-2.5 sm:p-3 rounded-2xl border-2 flex flex-col items-center justify-center transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#E85D3F]/40 ${
                isSelected
                  ? 'bg-[#FFF8F2] border-[#E85D3F] text-[#E85D3F] shadow-sm scale-[1.02]'
                  : 'bg-white border-[#EEE7E1] text-[#6B6B6B] hover:border-[#E85D3F]/30 hover:bg-[#FFFCF9]'
              }`}
            >
              <span className="text-2xl sm:text-3xl filter transition-transform duration-150 transform hover:scale-110 select-none">
                {opt.emoji}
              </span>
              <span className={`text-[10px] sm:text-[11px] font-extrabold mt-1.5 block truncate w-full ${
                isSelected ? 'text-[#E85D3F]' : 'text-[#242424]'
              }`}>
                {opt.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default OverallExperienceSelector;
