import React from 'react';
import { Link } from 'react-router-dom';
import { Clock, ArrowLeft, Package } from 'lucide-react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { useTheme } from '../../context/ThemeContext';

interface StorePlaceholderPageProps {
  title: string;
  titleBn: string;
  description: string;
  descriptionBn: string;
}

export const StorePlaceholderPage: React.FC<StorePlaceholderPageProps> = ({
  title,
  titleBn,
  description,
  descriptionBn,
}) => {
  const { isDark } = useTheme();

  return (
    <AdminLayout>
      <div className="max-w-3xl mx-auto py-8">
        <div
          className={`rounded-2xl border p-8 sm:p-10 text-center ${
            isDark
              ? 'bg-[#103A40]/85 border-white/10 text-slate-100'
              : 'glass-card bg-white/85 border-slate-200 text-slate-900'
          }`}
        >
          <div className="w-16 h-16 mx-auto rounded-2xl bg-[#2BA5B5]/15 text-[#0F8B8D] dark:text-[#2BA5B5] flex items-center justify-center mb-5">
            <Clock className="w-8 h-8" />
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30 mb-4">
            Coming next · <span className="font-bangla opacity-80">পরবর্তী ধাপে আসছে</span>
          </span>

          <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
          <p className="text-sm font-bangla opacity-70 mt-1">{titleBn}</p>

          <p className="text-sm text-slate-500 dark:text-slate-300 mt-4 max-w-lg mx-auto">
            {description}
          </p>
          <p className="text-xs font-bangla opacity-70 mt-1 max-w-lg mx-auto">
            {descriptionBn}
          </p>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/store/dashboard"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#0F8B8D] hover:bg-[#0b6f71] text-white text-xs font-bold shadow-sm transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              <div className="text-left">
                <span className="block leading-tight">Back to Store Overview</span>
                <span className="block text-[10px] font-bangla opacity-75 leading-tight">
                  স্টোর ওভারভিউতে ফিরুন
                </span>
              </div>
            </Link>

            <Link
              to="/store/grn"
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl border text-xs font-bold transition-all ${
                isDark
                  ? 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-200'
                  : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
              }`}
            >
              <Package className="w-4 h-4 text-[#2BA5B5]" />
              <div className="text-left">
                <span className="block leading-tight">Go to Stock In (GRN)</span>
                <span className="block text-[10px] font-bangla opacity-70 leading-tight">
                  জিআরএন পেইজে যান
                </span>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default StorePlaceholderPage;
