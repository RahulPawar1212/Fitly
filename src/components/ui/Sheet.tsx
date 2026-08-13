'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Bottom sheet.
 *
 * A sheet rather than a route: the food picker is opened dozens of times a day
 * from wherever the user happens to be, and a route change would lose their
 * scroll position and cost a navigation each time.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  /** `full` for the search sheet (needs the height), `auto` for small forms. */
  height = 'full',
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  height?: 'full' | 'auto';
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Escape to close, and lock background scrolling while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div
        className="animate-fade-in absolute inset-0 bg-slate-900/50"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        className={`animate-sheet-in relative flex w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl dark:bg-slate-900 ${
          height === 'full' ? 'h-[92vh]' : 'max-h-[92vh]'
        }`}
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          {/* Drag handle affordance — purely visual, the backdrop closes. */}
          <div className="absolute left-1/2 top-1.5 h-1 w-10 -translate-x-1/2 rounded-full bg-slate-300 dark:bg-slate-700" />
          <div className="min-w-0 flex-1 pt-1 text-base font-semibold">{title}</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* overscroll-contain stops a scroll at the end of the list from
            dragging the page behind the sheet. */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>

        {footer && (
          <div className="safe-bottom shrink-0 border-t border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
