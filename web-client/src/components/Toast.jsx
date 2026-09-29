import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export default function Toast({ message, type = 'success', onClose, duration = 4000 }) {
  useEffect(() => {
    if (!message || !onClose) return;
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [message, onClose, duration]);

  if (!message || typeof document === 'undefined') return null;

  const bgStyles = {
    success: 'bg-emerald-950/95 border-emerald-500/50 text-emerald-100 shadow-emerald-950/50',
    error: 'bg-rose-950/95 border-rose-500/50 text-rose-100 shadow-rose-950/50',
    warning: 'bg-amber-950/95 border-amber-500/50 text-amber-100 shadow-amber-950/50',
    info: 'bg-slate-900/95 border-cyan-500/50 text-cyan-100 shadow-cyan-950/50'
  };

  const icons = {
    success: <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />,
    error: <AlertCircle className="h-5 w-5 text-rose-400 shrink-0" />,
    warning: <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />,
    info: <Info className="h-5 w-5 text-cyan-400 shrink-0" />
  };

  // Errors interrupt screen readers; everything else is announced politely
  const isError = type === 'error';

  return createPortal(
    // Full-width with side gutters on phones; fixed 24rem card from sm up
    <div className="fixed bottom-4 left-4 right-4 sm:bottom-6 sm:left-auto sm:right-6 sm:w-full sm:max-w-sm z-[10000] animate-in slide-in-from-bottom-5 fade-in duration-300 pointer-events-auto">
      <div
        role={isError ? 'alert' : 'status'}
        aria-live={isError ? 'assertive' : 'polite'}
        className={`flex items-center justify-between gap-3 p-4 rounded-2xl border shadow-2xl backdrop-blur-xl ${bgStyles[type] || bgStyles.info}`}
      >
        <div className="flex items-center gap-3">
          {icons[type]}
          <p className="text-xs font-semibold leading-snug">{message}</p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Dismiss notification"
            className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>,
    document.body
  );
}
