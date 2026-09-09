import React from 'react';
import { X } from 'lucide-react';

export default function Modal({ isOpen, onClose, title, children, maxWidth = 'max-w-md' }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 dark:bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 select-none">
      <div className={`relative bg-white dark:bg-slate-900/95 text-slate-900 dark:text-white rounded-3xl shadow-2xl dark:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] border border-slate-200 dark:border-slate-800 w-full ${maxWidth} overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200`}>
        {/* Top Accent Gradient Border Line */}
        <div className="h-1 w-full bg-gradient-to-r from-amber-500 via-amber-300 to-emerald-400" />

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between bg-slate-50 dark:bg-slate-950/50">
          <h3 className="font-display font-bold text-base sm:text-lg text-slate-900 dark:text-white tracking-tight">{title}</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-90 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
