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
  variant = 'dark'
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

  const isLight = variant === 'light';

  const modalNode = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-hidden">
      {/* Background Overlay */}
      <div 
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity" 
        onClick={onClose} 
      />

      {/* Modal Dialog Content */}
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby={title && !hideHeader ? "modal-dialog-title" : undefined}
        className={cn(
          "w-full shadow-2xl relative z-10 flex flex-col max-h-[min(90vh,860px)] animate-in fade-in zoom-in-95 duration-200 overflow-hidden",
          isLight
            ? "bg-white border border-[#E5E0D9] rounded-3xl text-[#17202A]"
            : "bg-slate-900 border border-slate-800 backdrop-blur-md rounded-2xl text-slate-100",
          sizeClasses[size] || 'max-w-lg',
          className
        )}
      >
        {/* Fixed Header (omitted if hideHeader is true or title is explicitly empty) */}
        {!hideHeader && title !== '' && (
          <div className={cn(
            "flex items-center justify-between px-5 sm:px-6 py-4 shrink-0",
            isLight
              ? "border-b border-[#F0EBE4] bg-[#FCFAF7]"
              : "border-b border-slate-800/60"
          )}>
            <h3 id="modal-dialog-title" className={cn(
              "font-display font-extrabold text-base sm:text-lg pr-3",
              isLight ? "text-[#17202A]" : "text-textPearl"
            )}>
              {title || 'Dialog'}
            </h3>
            <button 
              type="button"
              onClick={onClose}
              className={cn(
                "w-9 h-9 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-xl transition-all cursor-pointer",
                isLight 
                  ? "text-[#7B8794] hover:text-[#17202A] hover:bg-[#F3E8DF]/60" 
                  : "text-mutedAsh hover:text-textPearl hover:bg-slate-800/80"
              )}
              aria-label={closeAriaLabel}
            >
              <X className="w-4.5 h-4.5" />
            </button>
          </div>
        )}

        {/* Scrollable Content Body */}
        <div className={cn(
          "flex-1 min-h-0 overflow-y-auto px-5 sm:px-6 py-5 overscroll-contain",
          isLight ? "text-[#17202A]" : "text-sm text-slate-300",
          contentClassName
        )}>
          {children}
        </div>

        {/* Fixed Footer */}
        {footer && (
          <div className={cn(
            "flex items-center justify-end px-5 sm:px-6 py-3.5 shrink-0",
            isLight
              ? "border-t border-[#F0EBE4] bg-[#FCFAF7]"
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
