import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export default function Modal({ isOpen, onClose, title, children, maxWidth = 'max-w-2xl' }) {
  // Prevent body scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && onClose) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 select-none w-screen min-h-screen">
      {/* Click outside backdrop overlay */}
      <div 
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm" 
        onClick={onClose} 
        aria-hidden="true" 
      />

      <div className={`relative bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full ${maxWidth} max-h-[90vh] flex flex-col overflow-hidden my-auto z-10 transform transition-all animate-in fade-in zoom-in-95 duration-200`}>
        {/* Top Accent Gradient Border Line */}
        <div className="h-1.5 w-full shrink-0 bg-gradient-to-r from-amber-500 via-amber-300 to-emerald-400" />

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/70 shrink-0">
          <h3 className="font-display font-bold text-base sm:text-lg text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 transition active:scale-90 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-6 overflow-y-auto flex-1 overscroll-contain">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
