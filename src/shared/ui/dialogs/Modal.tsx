import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../../utils/cn';

export interface IModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  hideHeader?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  contentClassName?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | '7xl' | 'max';
  closeAriaLabel?: string;
  variant?: 'dark' | 'light';
}

export const Modal: React.FC<IModalProps> = ({
  isOpen,
  onClose,
  title,
  hideHeader = false,
  children,
  footer,
  className,
  contentClassName,
  size = 'lg',
  closeAriaLabel = 'Close dialog',
  variant
}) => {
  // Prevent background scrolling while modal is open & listen for Escape key
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
    '6xl': 'max-w-6xl',
    '7xl': 'max-w-7xl',
    max: 'max-w-[95vw]'
  };

  // Context-aware theme detection: if page is in owner portal, kds, or customer portal, default to light
  const isPageLight = typeof document !== 'undefined' && Boolean(
    document.querySelector('.owner-theme') || 
    document.querySelector('.kds-theme') ||
    document.body.classList.contains('customer-theme-bg') ||
    document.body.classList.contains('light')
  );
  const effectiveVariant = variant || (isPageLight ? 'light' : 'dark');
  const isLight = effectiveVariant === 'light' || !!className?.includes('bg-white') || !!className?.includes('bg-[#F');

  const modalNode = (
    <div className={cn(
      "fixed inset-0 z-[9999] flex items-center justify-center p-2 min-[340px]:p-3 sm:p-4 md:p-6 overflow-hidden",
      isLight && "owner-theme"
    )}>
      {/* Background Overlay */}
      <div 
        className={cn(
          "fixed inset-0 transition-opacity",
          isLight ? "bg-[rgba(20,25,22,0.55)] backdrop-blur-xs" : "bg-slate-950/70 backdrop-blur-sm"
        )}
        onClick={onClose} 
      />

      {/* Modal Dialog Content */}
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby={title && !hideHeader ? "modal-dialog-title" : undefined}
        className={cn(
          "w-full shadow-2xl relative z-10 flex flex-col max-h-[min(90vh,860px)] animate-in fade-in zoom-in-95 duration-200 overflow-hidden min-w-0",
          isLight
            ? "bg-white border border-[#D8DDD6] rounded-2xl sm:rounded-3xl text-[#202820]"
            : "bg-slate-900 border border-slate-800 backdrop-blur-md rounded-2xl text-slate-100",
          sizeClasses[size] || 'max-w-lg',
          className
        )}
      >
        {/* Fixed Header (omitted if hideHeader is true or title is explicitly empty) */}
        {!hideHeader && title !== '' && (
          <div className={cn(
            "flex items-center justify-between px-3 min-[340px]:px-5 sm:px-6 py-3 min-[340px]:py-4 shrink-0 min-w-0 gap-2",
            isLight
              ? "border-b border-[#D8DDD6] bg-[#FAF8F4]"
              : "border-b border-slate-800/60"
          )}>
            <h3 id="modal-dialog-title" className={cn(
              "font-display font-extrabold text-sm min-[340px]:text-base sm:text-lg min-w-0 flex-1 truncate pr-1",
              isLight ? "text-[#18201D]" : "text-textPearl"
            )}>
              {title || 'Dialog'}
            </h3>
            <button 
              type="button"
              onClick={onClose}
              className={cn(
                "w-8 h-8 min-w-[32px] min-h-[32px] sm:w-9 sm:h-9 sm:min-w-[36px] sm:min-h-[36px] flex items-center justify-center rounded-xl transition-all cursor-pointer shrink-0",
                isLight 
                  ? "text-[#5F675F] hover:text-[#202820] hover:bg-[#F3E8DF]/60" 
                  : "text-mutedAsh hover:text-textPearl hover:bg-slate-800/80"
              )}
              aria-label={closeAriaLabel}
            >
              <X className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </button>
          </div>
        )}

        {/* Scrollable Content Body */}
        <div className={cn(
          "flex-1 min-h-0 overflow-y-auto px-3 min-[340px]:px-5 sm:px-6 py-3.5 min-[340px]:py-5 overscroll-contain min-w-0",
          isLight ? "text-[#202820] bg-white" : "text-sm text-slate-300",
          contentClassName
        )}>
          {children}
        </div>

        {/* Fixed Footer */}
        {footer && (
          <div className={cn(
            "flex items-center justify-end px-3 min-[340px]:px-5 sm:px-6 py-3 shrink-0 min-w-0",
            isLight
              ? "border-t border-[#D8DDD6] bg-[#FAF8F4]"
              : "border-t border-slate-800/60 bg-slate-900/50"
          )}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modalNode, document.body);
  }

  return modalNode;
};
export default Modal;
