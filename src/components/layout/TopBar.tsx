import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Menu,
  Sliders,
  LogOut,
  ChevronDown,
  Building2,
  Shield,
  Search,
  Bell,
  CheckCircle2,
  Clock,
  Sparkles,
  PanelLeftOpen,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUnit } from '../../context/UnitContext';
import { useTheme } from '../../context/ThemeContext';
import { useSidebar } from '../../context/SidebarContext';
import { ROLE_LABELS } from '../../lib/constants';
import type { FactoryUnit } from '../../lib/constants';
import toast from 'react-hot-toast';

interface TopBarProps {
  onOpenMobileMenu?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onOpenMobileMenu }) => {
  const { profile, signOut } = useAuth();
  const { activeUnit, setActiveUnit } = useUnit();
  const { isDark } = useTheme();
  const { mode, show, setMobileOpen, lastVisibleMode } = useSidebar();
  const location = useLocation();

  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute page title and breadcrumb from path
  const getPageMeta = () => {
    if (location.pathname === '/admin/users') {
      return { title: 'Users & Permissions', bangla: 'ইউজার ও এক্সেস কন্ট্রোল', breadcrumb: 'Users' };
    }
    if (location.pathname === '/admin/settings') {
      return { title: 'Company & System Settings', bangla: 'সিস্টেম ও ব্র্যান্ড সেটিংস', breadcrumb: 'Settings' };
    }
    if (location.pathname === '/sewing/report') {
      return { title: 'Hourly Production Report', bangla: 'ঘণ্টাভিত্তিক প্রোডাকশন রিপোর্ট', breadcrumb: 'Sewing' };
    }
    if (location.pathname === '/sewing/dashboard') {
      return { title: 'Production Dashboard', bangla: 'সুইং প্রোডাকশন ড্যাশবোর্ড', breadcrumb: 'Sewing' };
    }
    if (location.pathname === '/sewing/reports') {
      return { title: 'Reports & Exports', bangla: 'রিপোর্ট ও এক্সপোর্ট', breadcrumb: 'Sewing' };
    }
    return { title: 'Executive Overview', bangla: 'ফ্যাক্টরি ড্যাশবোর্ড ওভারভিউ', breadcrumb: 'Dashboard' };
  };

  const pageMeta = getPageMeta();
  const roleName = profile?.role ? ROLE_LABELS[profile.role]?.en || 'Staff' : 'Staff';
  const isAdmin = profile?.role === 'admin';

  const handleLogout = async () => {
    setDropdownOpen(false);
    await signOut();
    toast.success('Successfully logged out of ERP session.');
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    toast(`Searching: "${searchQuery}" (Quick Finder ready in upcoming modules)`, {
      icon: '🔍',
    });
  };

  const unitOptions: Array<{ id: FactoryUnit; label: string; bangla: string }> = [
    { id: 'all', label: 'All Units', bangla: 'সব' },
    { id: 'knit', label: 'Knit', bangla: 'নিট' },
    { id: 'woven', label: 'Woven', bangla: 'উভেন' },
  ];

  const mockNotifications = [
    {
      id: 1,
      title: 'Buyer Techpack Update',
      desc: 'H&M Summer Knitwear style #HM-9042 revised specs uploaded.',
      time: '12m ago',
      unread: true,
    },
    {
      id: 2,
      title: 'Fabric Inspection Lot Ready',
      desc: '100% Cotton Single Jersey 180 GSM passed shade test.',
      time: '1h ago',
      unread: true,
    },
    {
      id: 3,
      title: 'Monthly Biometric Attendance',
      desc: 'Export summary generated for Hemayetpur plant staff.',
      time: '3h ago',
      unread: false,
    },
  ];

  return (
    <header
      className={`h-20 sticky top-0 z-30 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 transition-colors duration-200 ${
        isDark
          ? 'bg-[#103A40]/90 backdrop-blur-md border-b border-white/5 text-white'
          : 'glass-topbar text-slate-900'
      }`}
    >
      {/* Left: Mobile Hamburger / Hidden Sidebar Restore + Breadcrumb & Title */}
      <div className="flex items-center gap-3 sm:gap-4 shrink-0">
        {/* Mobile Hamburger Button */}
        <button
          type="button"
          onClick={onOpenMobileMenu || (() => setMobileOpen(true))}
          className={`lg:hidden p-2 rounded-2xl transition-colors cursor-pointer ${
            isDark
              ? 'text-slate-300 hover:text-white hover:bg-white/10'
              : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
          }`}
          aria-label="Open sidebar menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Desktop "Show sidebar" button when hidden */}
        {mode === 'hidden' && (
          <button
            type="button"
            onClick={show}
            className={`hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all text-xs font-semibold shadow-xs cursor-pointer animate-in fade-in duration-150 ${
              isDark
                ? 'bg-[#0B2E33]/90 border-white/10 text-teal-300 hover:text-white hover:bg-white/10 hover:border-[#2BA5B5]/50'
                : 'bg-white border-slate-200 text-[#0E7490] hover:text-[#0B686A] hover:bg-slate-50 hover:border-[#2BA5B5]/50'
            }`}
            title={`Show sidebar (Ctrl+B) - Restores ${lastVisibleMode}`}
            aria-label="Show sidebar"
          >
            <PanelLeftOpen className="w-4 h-4 text-[#2BA5B5]" />
            <span className="hidden xl:inline">Show Sidebar</span>
            <kbd className="text-[10px] font-mono px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 text-slate-400">
              Ctrl+B
            </kbd>
          </button>
        )}

        <div className="flex flex-col truncate">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#475569] uppercase tracking-wider">
            <span>ERP</span>
            <span>/</span>
            <span className="text-[#0E7490] font-bold">{pageMeta.breadcrumb}</span>
          </div>
          <div className="flex items-baseline gap-2">
            <h1 className="text-base sm:text-lg font-bold text-[#0F172A] dark:text-white tracking-tight truncate leading-tight">
              {pageMeta.title}
            </h1>
            <span className="hidden xl:inline-block text-xs font-bangla text-[#475569] font-medium truncate">
              ({pageMeta.bangla})
            </span>
          </div>
        </div>
      </div>

      {/* Center: Search Bar ("Search orders, buyers, styles...") with rounded-full pill */}
      <form
        onSubmit={handleSearchSubmit}
        className="hidden md:flex flex-1 max-w-md mx-4 relative"
      >
        <div className="relative w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search orders, buyers, styles..."
            className={`w-full pl-10 pr-12 py-2 text-xs rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-[#2BA5B5] ${
              isDark
                ? 'bg-[#0B2E33]/70 text-slate-100 placeholder:text-slate-400 border border-white/10 focus:border-[#2BA5B5]'
                : 'glass-input text-[#1E293B] font-medium placeholder:text-[#64748B] focus:bg-white'
            }`}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
            <kbd
              className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                isDark ? 'bg-white/10 text-slate-300' : 'bg-slate-200 text-slate-600'
              }`}
            >
              ⌘K
            </kbd>
          </div>
        </div>
      </form>

      {/* Right: Unit Switcher + Notifications + User Avatar */}
      <div className="flex items-center gap-2.5 sm:gap-3.5 shrink-0">
        {/* FACTORY UNIT SWITCHER (Segmented control: All / Knit / Woven) */}
        <div
          className={`flex items-center p-1 rounded-2xl border transition-colors ${
            isDark
              ? 'bg-[#0B2E33]/80 border-white/10'
              : 'bg-slate-100 border-slate-200/80'
          }`}
        >
          {unitOptions.map((opt) => {
            const isActive = activeUnit === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setActiveUnit(opt.id);
                  toast.success(`Unit filter: ${opt.label} (${opt.bangla})`, {
                    id: 'unit-toast',
                    duration: 1500,
                  });
                }}
                className={`px-2.5 sm:px-3 py-1 text-xs font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-[#2BA5B5] text-white shadow-sm font-bold'
                    : isDark
                    ? 'text-slate-300 hover:text-white hover:bg-white/5'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <span>{opt.label}</span>
                <span className="hidden md:inline font-bangla text-[10px] ml-1 opacity-80">
                  ({opt.bangla})
                </span>
              </button>
            );
          })}
        </div>

        {/* NOTIFICATION BELL WITH PING BADGE */}
        <div className="relative" ref={notifRef}>
          <button
            type="button"
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className={`relative p-2.5 rounded-2xl border transition-colors focus-visible:ring-2 focus-visible:ring-[#2BA5B5] ${
              isDark
                ? 'bg-[#0B2E33]/80 border-white/10 text-slate-200 hover:text-white hover:bg-white/10'
                : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
            aria-label="View notifications"
          >
            <Bell className="w-4 h-4" />
            {/* Ping indicator badge */}
            <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
            </span>
          </button>

          {/* Notifications Dropdown Panel */}
          {notificationsOpen && (
            <div
              className={`absolute right-0 mt-2 w-80 rounded-3xl border shadow-xl p-3 z-50 animate-in fade-in zoom-in-95 duration-150 ${
                isDark
                  ? 'bg-[#103A40] border-white/10 text-slate-100'
                  : 'bg-white border-slate-200 text-slate-800'
              }`}
            >
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10 px-2">
                <span className="text-xs font-bold uppercase tracking-wider">
                  Factory Alerts
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  2 New
                </span>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto scrollbar-custom">
                {mockNotifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`p-2.5 rounded-2xl text-xs transition-colors cursor-pointer ${
                      notif.unread
                        ? isDark
                          ? 'bg-white/5 hover:bg-white/10'
                          : 'bg-teal-50/60 hover:bg-teal-50'
                        : isDark
                        ? 'hover:bg-white/5 opacity-70'
                        : 'hover:bg-slate-50 opacity-75'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold truncate">{notif.title}</span>
                      <span className="text-[10px] text-slate-400 shrink-0 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {notif.time}
                      </span>
                    </div>
                    <p
                      className={`text-[11px] mt-1 leading-normal ${
                        isDark ? 'text-slate-300' : 'text-slate-600'
                      }`}
                    >
                      {notif.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* USER PROFILE DROPDOWN */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className={`flex items-center gap-2 p-1.5 sm:pr-3 rounded-2xl border transition-all focus-visible:ring-2 focus-visible:ring-[#2BA5B5] ${
              isDark
                ? 'bg-[#0B2E33]/80 border-white/10 hover:border-white/20'
                : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
            }`}
            aria-expanded={dropdownOpen}
            aria-label="User account menu"
          >
            {/* Avatar Pill */}
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#2BA5B5] to-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
              {(profile?.full_name || 'A').charAt(0).toUpperCase()}
            </div>

            <div className="hidden sm:flex flex-col text-left text-xs leading-none">
              <span className="font-bold truncate max-w-[120px]">
                {profile?.full_name || 'Admin'}
              </span>
              <span className="text-[10px] text-[#2BA5B5] font-semibold mt-0.5">
                {roleName}
              </span>
            </div>

            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                dropdownOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {/* User Popover Menu */}
          {dropdownOpen && (
            <div
              className={`absolute right-0 mt-2 w-64 rounded-3xl border shadow-xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150 ${
                isDark
                  ? 'bg-[#103A40] border-white/10 text-slate-100'
                  : 'bg-white border-slate-200 text-slate-800'
              }`}
            >
              <div
                className={`p-3 rounded-2xl mb-1 ${
                  isDark ? 'bg-white/5' : 'bg-slate-50'
                }`}
              >
                <p className="text-sm font-bold truncate">
                  {profile?.full_name || 'Administrator'}
                </p>
                <p className="text-xs text-slate-400 truncate mt-0.5">
                  {profile?.email}
                </p>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#2BA5B5]/20 text-[#2BA5B5] border border-[#2BA5B5]/40 text-[10px] font-bold uppercase tracking-wider">
                    <Shield className="w-3 h-3" />
                    {roleName}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <Link
                  to="/admin/settings"
                  onClick={() => setDropdownOpen(false)}
                  className={`flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-xl transition-colors ${
                    isDark
                      ? 'text-slate-200 hover:text-white hover:bg-white/10'
                      : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Sliders className="w-4 h-4 text-slate-400" />
                  <span>Company &amp; System Settings</span>
                </Link>

                <Link
                  to="/admin/users"
                  onClick={() => setDropdownOpen(false)}
                  className={`flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-xl transition-colors ${
                    isDark
                      ? 'text-slate-200 hover:text-white hover:bg-white/10'
                      : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Building2 className="w-4 h-4 text-slate-400" />
                  <span>Manage Factory Staff</span>
                </Link>

                <div className={`pt-1 border-t ${isDark ? 'border-white/10' : 'border-slate-100'}`}>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-rose-500 hover:bg-rose-500/10 rounded-xl transition-colors text-left"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default TopBar;
