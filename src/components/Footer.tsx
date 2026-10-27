import React from 'react';
import { COMPANY_CONFIG } from '../config/company';
import { useCompany } from '../context/CompanyContext';

export const Footer: React.FC = () => {
  const { companyName } = useCompany();

  return (
    <footer className="bg-slate-900 text-slate-300 py-8 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-2">
        <p className="text-sm font-semibold text-white tracking-wide">
          {companyName}
        </p>
        <p className="text-xs text-slate-400 font-medium">
          {COMPANY_CONFIG.footerText}
        </p>
        <p className="text-[11px] text-slate-500 font-bangla pt-1">
          বাংলাদেশ পোষাক প্রস্তুতকারক ও রপ্তানিকারক সমিতি (BGMEA) কমপ্লায়েন্ট গার্মেন্টস ফ্যাক্টরি
        </p>
      </div>
    </footer>
  );
};

export default Footer;
