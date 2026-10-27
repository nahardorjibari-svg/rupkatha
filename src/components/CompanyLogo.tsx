import React, { useState } from 'react';
import { useCompany } from '../context/CompanyContext';

interface CompanyLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showName?: boolean;
  textColor?: string;
  variant?: 'light' | 'dark' | 'auto';
}

export const CompanyLogo: React.FC<CompanyLogoProps> = ({
  className = '',
  size = 'md',
  showName = true,
  textColor,
  variant = 'auto',
}) => {
  const { companyName, logoUrl } = useCompany();
  const [imageError, setImageError] = useState(false);

  const sizeDimensions = {
    sm: { box: 'w-8 h-8', text: 'text-base', img: 'max-h-7 max-w-[120px]' },
    md: { box: 'w-10 h-10', text: 'text-lg', img: 'max-h-9 max-w-[160px]' },
    lg: { box: 'w-12 h-12', text: 'text-xl', img: 'max-h-11 max-w-[200px]' },
    xl: { box: 'w-16 h-16', text: 'text-2xl', img: 'max-h-14 max-w-[240px]' },
  };

  const currentSize = sizeDimensions[size];

  // If dynamic logo_url is available and hasn't errored
  const hasValidLogo = Boolean(logoUrl && !imageError);

  const resolvedTextColor =
    textColor ||
    (variant === 'light'
      ? 'text-white'
      : variant === 'dark'
      ? 'text-slate-900'
      : 'text-slate-900');

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {hasValidLogo ? (
        <img
          src={logoUrl!}
          alt={companyName}
          onError={() => setImageError(true)}
          className={`${currentSize.img} object-contain shrink-0`}
        />
      ) : (
        /* Default Placeholder "R" Monogram (Indigo-Teal Gradient) */
        <div
          className={`${currentSize.box} shrink-0 rounded-xl bg-gradient-to-br from-[#0F8B8D] via-teal-600 to-indigo-600 text-white font-extrabold flex items-center justify-center shadow-md shadow-teal-900/10 ring-1 ring-white/20`}
        >
          <span className="leading-none tracking-tight font-serif text-lg sm:text-xl">
            R
          </span>
        </div>
      )}

      {showName && (
        <div className="flex flex-col">
          <span
            className={`font-bold tracking-tight leading-snug ${currentSize.text} ${resolvedTextColor}`}
          >
            {companyName}
          </span>
          <span className="text-[10px] tracking-wider uppercase font-semibold text-teal-700/80">
            Knit &amp; Woven Garments ERP
          </span>
        </div>
      )}
    </div>
  );
};

export default CompanyLogo;
