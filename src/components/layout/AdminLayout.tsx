import React from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { useTheme } from '../../context/ThemeContext';
import { useSidebar } from '../../context/SidebarContext';
import { PanelLeftOpen } from 'lucide-react';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const { isDark } = useTheme();
  const { mode, show, lastVisibleMode } = useSidebar();

  // Dynamic left margin calculation for desktop
  const desktopMarginClass =
    mode === 'expanded'
      ? 'lg:ml-[220px]'
      : mode === 'mini'
      ? 'lg:ml-[68px]'
      : 'lg:ml-0';

  return (
    <div
      className={`min-h-screen flex flex-col antialiased transition-colors duration-200 ${
        isDark ? 'bg-[#0B2E33] text-slate-100' : 'bg-[#F5F6F8] text-slate-800'
      }`}
    >
      {/* 1. Slim Modern Sidebar */}
      <Sidebar />

      {/* 2. Floating Edge Trigger when hidden on desktop */}
      {mode === 'hidden' && (
        <div className="hidden lg:block fixed left-0 top-1/2 -translate-y-1/2 z-40 animate-in fade-in slide-in-from-left duration-200">
          <button
            type="button"
            onClick={show}
            title={`Show sidebar (Ctrl+B) - Restores ${lastVisibleMode}`}
            className={`group flex items-center justify-center w-8 h-12 rounded-r-2xl shadow-lg border-y border-r transition-all duration-200 cursor-pointer ${
              isDark
                ? 'bg-[#103A40] hover:bg-[#2BA5B5] text-teal-300 hover:text-white border-white/10 hover:w-10'
                : 'bg-white hover:bg-[#2BA5B5] text-teal-700 hover:text-white border-slate-200 shadow-slate-300/40 hover:w-10'
            }`}
            aria-label="Show sidebar"
          >
            <PanelLeftOpen className="w-4 h-4 transition-transform group-hover:scale-110" />
          </button>
        </div>
      )}

      {/* 3. Main Content Wrapper with Dynamic Left Margin & 200ms Smooth Transition */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-200 ease-in-out ${desktopMarginClass}`}
      >
        {/* Top Navigation Bar */}
        <TopBar />

        {/* Responsive Content Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
