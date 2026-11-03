import React, { useEffect, useRef } from 'react';
import { create } from 'zustand';
import { AlertCircle, CheckCircle, Info, X } from 'lucide-react';
import { cn } from '../../../utils/cn';

export type TToastType = 'success' | 'error' | 'info';

interface IToast {
  id: string;
  message: string;
  type: TToastType;
}

interface IToastStore {
  toasts: IToast[];
  addToast: (message: string, type: TToastType) => void;
  removeToast: (id: string) => void;
}

// Global lightweight state for notification triggers
export const useToastStore = create<IToastStore>((set) => ({
  toasts: [],
  addToast: (message, type) => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({ toasts: [...state.toasts, { id, message, type }] }));
  },
  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },
}));

export const Toast: React.FC<IToast & { onClose: () => void }> = ({
  message,
  type,
  onClose
}) => {
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startTimer = () => {
    // Errors stay longer (7000ms) so users have time to read and act; success/info 4500ms
    const duration = type === 'error' ? 7000 : 4500;
    timerRef.current = setTimeout(onClose, duration);
  };

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    startTimer();
    return () => clearTimer();
  }, [onClose, type]);

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />,
    error: <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />,
    info: <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
  };

  const typeConfig = {
    success: {
      card: 'bg-white border border-emerald-200 border-l-4 border-l-emerald-600 shadow-2xl shadow-emerald-950/10',
      badge: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      title: 'Success',
      text: 'text-slate-900',
      closeBtn: 'text-slate-400 hover:text-emerald-800 hover:bg-emerald-50'
    },
    error: {
      card: 'bg-white border border-red-200 border-l-4 border-l-red-600 shadow-2xl shadow-red-950/15',
      badge: 'text-red-700 bg-red-50 border-red-200',
      title: 'Error',
      text: 'text-slate-900',
      closeBtn: 'text-slate-400 hover:text-red-800 hover:bg-red-50'
    },
    info: {
      card: 'bg-white border border-blue-200 border-l-4 border-l-blue-600 shadow-2xl shadow-blue-950/10',
      badge: 'text-blue-700 bg-blue-50 border-blue-200',
      title: 'Information',
      text: 'text-slate-900',
      closeBtn: 'text-slate-400 hover:text-blue-800 hover:bg-blue-50'
    }
  };

  const current = typeConfig[type];

  return (
    <div
      role="alert"
      aria-live={type === 'error' ? 'assertive' : 'polite'}
      onMouseEnter={clearTimer}
      onMouseLeave={startTimer}
      className={cn(
        "flex items-start space-x-3.5 px-4 py-3.5 rounded-2xl shadow-2xl max-w-sm sm:max-w-md w-full animate-in slide-in-from-bottom-3 duration-300 transition-all select-text",
        current.card
      )}
    >
      {icons[type]}
      <div className="flex-1 min-w-0 pr-1">
        <div className="flex items-center space-x-2 mb-1">
          <span className={cn("text-[10px] font-extrabold tracking-wider uppercase px-1.5 py-0.5 rounded border leading-none", current.badge)}>
            {current.title}
          </span>
        </div>
        <p className={cn("text-xs sm:text-sm font-semibold leading-relaxed break-words", current.text)}>
          {message}
        </p>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close notification"
        className={cn("p-1.5 rounded-lg transition-colors flex-shrink-0 cursor-pointer", current.closeBtn)}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-6 right-6 z-[9999] flex flex-col space-y-3 pointer-events-auto max-w-sm sm:max-w-md w-[calc(100vw-3rem)]"
    >
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          {...toast}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
};

export default ToastContainer;
