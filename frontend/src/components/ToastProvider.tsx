/**
 * Lightweight toast notification system.
 * - Provides a global <ToastContainer /> to render toasts
 * - useToast() hook gives components access to show()
 * Usage:
 *   const toast = useToast();
 *   toast.success('Saved!');
 *   toast.error('Something went wrong');
 */
import { createContext, useContext, useState, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  success: (msg: string) => void;
  error: (msg: string) => void;
  warning: (msg: string) => void;
  info: (msg: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastType, ReactNode> = {
  success: <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />,
  error:   <XCircle     className="w-4 h-4 text-rose-400 shrink-0" />,
  warning: <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />,
  info:    <Info        className="w-4 h-4 text-blue-400 shrink-0" />,
};

const STYLES: Record<ToastType, string> = {
  success: 'bg-zinc-900 border border-emerald-500/30 shadow-emerald-900/30',
  error:   'bg-zinc-900 border border-rose-500/30 shadow-rose-900/30',
  warning: 'bg-zinc-900 border border-amber-500/30 shadow-amber-900/30',
  info:    'bg-zinc-900 border border-blue-500/30 shadow-blue-900/30',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const show = useCallback((type: ToastType, message: string) => {
    const id = ++counter.current;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const ctx: ToastContextValue = {
    success: (msg) => show('success', msg),
    error:   (msg) => show('error', msg),
    warning: (msg) => show('warning', msg),
    info:    (msg) => show('info', msg),
  };

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl min-w-[280px] max-w-sm pointer-events-auto animate-in slide-in-from-right-4 duration-300 ${STYLES[toast.type]}`}
          >
            {ICONS[toast.type]}
            <span className="text-sm text-zinc-200 flex-1">{toast.message}</span>
            <button
              onClick={() => dismiss(toast.id)}
              className="text-zinc-500 hover:text-zinc-300 transition-colors ml-1 shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
