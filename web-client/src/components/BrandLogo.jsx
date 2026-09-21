import React from 'react';

export default function BrandLogo({ className = "h-10 w-auto", showTagline = true, isDark = true }) {
  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      {/* High-res brand asset */}
      <img
        src={isDark ? "/solvance_logo_dark_trans.png" : "/solvance_logo_light_trans.png"}
        alt="Solvance Smart Solar Microgrid"
        className="h-full w-auto object-contain drop-shadow-md rounded-xl"
        onError={(e) => {
          // Fallback SVG render if image file load encounters network latency
          e.target.style.display = 'none';
          e.target.nextSibling.style.display = 'flex';
        }}
      />
      {/* Vector Fallback */}
      <div className="hidden items-center gap-2.5">
        <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-amber-500 via-amber-400 to-emerald-500 p-0.5 shadow-md flex items-center justify-center">
          <div className="h-full w-full bg-slate-950 rounded-[10px] flex items-center justify-center">
            <svg className="h-5 w-5 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
            </svg>
          </div>
        </div>
        <div className="flex flex-col">
          <span className="font-display font-extrabold text-lg tracking-wider bg-gradient-to-r from-amber-400 via-amber-300 to-emerald-400 bg-clip-text text-transparent">
            SOLVANCE
          </span>
          {showTagline && (
            <span className="text-[9px] font-mono tracking-widest uppercase text-slate-400 -mt-1">
              Smart Solar Microgrid
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
