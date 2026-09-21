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
  closeAriaLabel = 'Close dialog'
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

  const modalNode = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-hidden">
      {/* Background Overlay */}
      <div 
        className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm transition-opacity" 
        onClick={onClose} 
      />

      {/* Modal Dialog Content */}
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby={title && !hideHeader ? "modal-dialog-title" : undefined}
        className={cn(
          "w-full bg-slate-900 border border-slate-800 backdrop-blur-md shadow-2xl rounded-2xl relative z-10 flex flex-col max-h-[min(90vh,860px)] animate-in fade-in zoom-in-95 duration-200 overflow-hidden",
          sizeClasses[size] || 'max-w-lg',
          className
        )}
      >
        {/* Fixed Header (omitted if hideHeader is true or title is explicitly empty) */}
        {!hideHeader && title !== '' && (
          <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-800/60 shrink-0">
            <h3 id="modal-dialog-title" className="font-display font-bold text-base sm:text-lg text-textPearl pr-3">
              {title || 'Dialog'}
            </h3>
            <button 
              type="button"
              onClick={onClose}
              className="w-10 h-10 min-w-[40px] min-h-[40px] flex items-center justify-center text-mutedAsh hover:text-textPearl hover:bg-slate-800/80 rounded-xl transition-all cursor-pointer"
              aria-label={closeAriaLabel}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Scrollable Content Body */}
        <div className={cn("flex-1 min-h-0 overflow-y-auto px-5 sm:px-6 py-4 text-sm text-slate-300 overscroll-contain", contentClassName)}>
          {children}
        </div>

        {/* Fixed Footer */}
        {footer && (
          <div className="flex items-center justify-end px-5 sm:px-6 py-3.5 border-t border-slate-800/60 shrink-0 bg-slate-900/50">
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
