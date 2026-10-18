import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { cn } from '../../../utils/cn';
import Button from '../buttons/Button';

export interface IDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDangerous?: boolean;
  variant?: 'dark' | 'light';
}

export const Dialog: React.FC<IDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  message = 'This action cannot be undone and will modify the system settings.',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDangerous = false,
  variant = 'light'
}) => {
  if (!isOpen) return null;

  const isLight = variant === 'light';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Background Overlay */}
      <div 
        className={cn(
          "fixed inset-0 transition-opacity",
          isLight ? "bg-[rgba(20,25,22,0.55)] backdrop-blur-xs" : "bg-slate-950/70 backdrop-blur-sm"
        )}
        onClick={onClose} 
      />

      {/* Dialog box frame */}
      <div className={cn(
        "w-full max-w-sm shadow-2xl rounded-3xl relative z-10 flex flex-col p-6 text-center animate-in fade-in zoom-in-95 duration-200",
        isLight
          ? "bg-white border border-[#D8DDD6] text-[#202820]"
          : "bg-slate-900 border border-slate-800 backdrop-blur-md text-slate-100"
      )}>
        <div className={cn(
          "w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3.5 border",
          isDangerous 
            ? (isLight ? "bg-[#FEE4E2] border-[#FECDCA] text-[#B42318]" : "bg-red-500/10 border-red-500/20 text-red-500")
            : (isLight ? "bg-[#FEF3D6] border-[#FDE68A] text-[#8A5700]" : "bg-amber-500/10 border-amber-500/20 text-amber-500")
        )}>
          <AlertTriangle className="w-5 h-5" />
        </div>

        <h3 className={cn(
          "font-display font-extrabold text-base mb-1.5",
          isLight ? "text-[#202820]" : "text-textPearl"
        )}>
          {title}
        </h3>
        <p className={cn(
          "text-xs leading-relaxed mb-6 font-medium",
          isLight ? "text-[#5F675F]" : "text-mutedAsh"
        )}>
          {message}
        </p>

        <div className="flex items-center space-x-3">
          <Button 
            variant="secondary" 
            size="sm" 
            className={cn(
              "flex-1 font-bold rounded-xl",
              isLight && "border border-[#D8DDD6] bg-white text-[#202820] hover:bg-[#FAF8F4]"
            )}
            onClick={onClose}
          >
            {cancelLabel}
          </Button>
          <Button 
            variant={isDangerous ? 'danger' : 'primary'} 
            size="sm" 
            className={cn(
              "flex-1 font-extrabold rounded-xl",
              isDangerous 
                ? "bg-[#B42318] hover:bg-[#912018] text-white" 
                : "bg-[#D94F2B] hover:bg-[#C2411F] text-white"
            )}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};
export default Dialog;
