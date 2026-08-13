'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

/**
 * Minimal toast layer.
 *
 * Its main job is the undo affordance on the food sheet's one-tap add: logging
 * is meant to be fast, which only feels safe if a mistake is one tap to reverse.
 */

interface Toast {
  id: number;
  message: string;
  tone: 'default' | 'error';
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastApi {
  show: (
    message: string,
    opts?: { tone?: Toast['tone']; actionLabel?: string; onAction?: () => void; ms?: number },
  ) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const api = useMemo<ToastApi>(() => {
    const show: ToastApi['show'] = (message, opts = {}) => {
      const id = nextId.current++;
      const toast: Toast = {
        id,
        message,
        tone: opts.tone ?? 'default',
        actionLabel: opts.actionLabel,
        onAction: opts.onAction,
      };
      // One at a time: stacked toasts over a bottom nav is noise, and the undo
      // window only makes sense for the most recent action.
      setToasts([toast]);
      const ms = opts.ms ?? (opts.actionLabel ? 4000 : 2200);
      setTimeout(() => dismiss(id), ms);
    };
    return {
      show,
      error: (message) => show(message, { tone: 'error', ms: 3500 }),
    };
  }, [dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* Sits above the bottom nav so it never covers the primary actions. */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`animate-toast-in pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-xl px-4 py-3 text-sm shadow-lg ${
              t.tone === 'error'
                ? 'bg-rose-600 text-white'
                : 'bg-slate-900 text-white dark:bg-slate-800'
            }`}
          >
            <span className="min-w-0 flex-1">{t.message}</span>
            {t.actionLabel && (
              <button
                type="button"
                onClick={() => {
                  t.onAction?.();
                  dismiss(t.id);
                }}
                className="shrink-0 rounded-lg px-2 py-1 font-semibold text-brand-300 underline-offset-2 hover:underline"
              >
                {t.actionLabel}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
