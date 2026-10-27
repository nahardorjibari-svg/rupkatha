import React from 'react';
import { APP_CONFIG } from '../lib/constants';

interface LogoProps {
  className?: string;
  variant?: 'light' | 'dark' | 'color';
  showSubtitle?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const Logo: React.FC<LogoProps> = ({
  className = '',
  variant = 'color',
  showSubtitle = false,
  size = 'md',
}) => {
  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-11 h-11',
  };

  const textSizes = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl',
  };

  const isLight = variant === 'light';

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* Precision Garments / Loom / Weaving Mark */}
      <div
        className={`${iconSizes[size]} shrink-0 rounded-xl flex items-center justify-center relative overflow-hidden shadow-sm ${
          isLight
            ? 'bg-white/15 text-white ring-1 ring-white/30 backdrop-blur-md'
            : 'bg-gradient-to-br from-indigo-600 to-blue-600 text-white shadow-indigo-500/25 ring-1 ring-indigo-500/20'
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-5 h-5 drop-shadow-sm"
        >
          {/* Weft & Warp woven geometric loom pattern */}
          <path d="M3 6h18" opacity="0.6" />
          <path d="M3 12h18" />
          <path d="M3 18h18" opacity="0.6" />
          <path d="M7 3v18" opacity="0.6" />
          <path d="M12 3v18" />
          <path d="M17 3v18" opacity="0.6" />
          <circle cx="12" cy="12" r="2.5" fill="currentColor" />
        </svg>
      </div>

      <div className="flex flex-col">
        <div className="flex items-center gap-1.5 leading-none">
          <span
            className={`font-bold tracking-tight ${textSizes[size]} ${
              isLight ? 'text-white' : 'text-slate-900'
            }`}
          >
            {APP_CONFIG.name}
          </span>
          <span
            className={`text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded ${
              isLight
                ? 'bg-white/20 text-indigo-100'
                : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
            }`}
          >
            ERP
          </span>
        </div>
        {showSubtitle && (
          <span
            className={`text-xs mt-1 font-medium tracking-tight ${
              isLight ? 'text-indigo-200' : 'text-slate-500'
            }`}
          >
            Knit &amp; Woven Factory Suite
          </span>
        )}
      </div>
    </div>
  );
};

export default Logo;
