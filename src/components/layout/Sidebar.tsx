import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Users,
  Sliders,
  Layers,
  Sparkles,
  Shirt,
  Scissors,
  Cog,
  Palette,
  PackageCheck,
  Warehouse,
  ShieldCheck,
  BadgeDollarSign,
  Calculator,
  Contact,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  PanelLeftClose,
  X,
  Factory,
  Sun,
  Moon,
  LogOut,
  Settings,
  FileText,
  FileSpreadsheet,
  Clock,
  CalendarDays,
} from 'lucide-react';
import { useCompany } from '../../context/CompanyContext';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useSidebar } from '../../context/SidebarContext';
import { ERP_MODULES } from '../../config/modules';
import toast from 'react-hot-toast';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  Users,
  Sliders,
  Layers,
  Sparkles,
  Shirt,
  Scissors,
  Cog,
  Palette,
  PackageCheck,
  Warehouse,
  ShieldCheck,
  BadgeDollarSign,
  Calculator,
  Contact,
  FileText,
  FileSpreadsheet,
  Clock,
  CalendarDays,
  Factory,
};

interface TooltipData {
  label: string;
  sublabel?: string;
  badge?: string | null;
  shortcut?: string;
  top: number;
}

export const Sidebar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { companyName, logoUrl, updatedAt } = useCompany();
  const { toggleTheme, isDark } = useTheme();
  const { profile, signOut } = useAuth();
  const { mode, toggleMini, hide, mobileOpen, setMobileOpen } = useSidebar();

  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({
    sewing: true, // default expand sewing
    hr_payroll: true, // default expand hr_payroll
  });

  const isMini = mode === 'mini';
  const isHidden = mode === 'hidden';
  const isAdmin = profile?.role === 'admin';

  const toggleExpand = (id: string) => {
    setExpandedMenus((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const showTooltip = (
    e: React.MouseEvent<HTMLElement>,
    label: string,
    sublabel?: string,
    badge?: string | null,
    shortcut?: string
  ) => {
    if (isMini && !mobileOpen) {
      const rect = e.currentTarget.getBoundingClientRect();
      setTooltip({
        label,
        sublabel,
        badge,
        shortcut,
        top: rect.top + rect.height / 2,
      });
    }
  };

  const clearTooltip = () => setTooltip(null);

  const renderIcon = (iconName: string) => {
    const Component = ICON_MAP[iconName] || Factory;
    return <Component className="w-[18px] h-[18px] shrink-0" />;
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('Signed out of ERP session.');
      navigate('/login');
    } catch {
      toast.error('Failed to sign out.');
    }
  };

  return (
    <>
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-xs lg:hidden"
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {isMini && !mobileOpen && tooltip && (
        <div
          style={{ top: tooltip.top }}
          className="fixed left-[76px] -translate-y-1/2 z-[100] pointer-events-none select-none transition-all duration-150 animate-in fade-in zoom-in-95"
        >
          <div
            className={`px-3 py-2 rounded-xl shadow-xl border text-xs whitespace-nowrap flex items-center gap-2 backdrop-blur-md ${
              isDark
                ? 'bg-[#103A40]/95 text-white border-white/10 shadow-black/40'
                : 'bg-slate-900/95 text-white border-slate-700/50 shadow-slate-900/25'
            }`}
          >
            <div
              className={`absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rotate-45 ${
                isDark ? 'bg-[#103A40]' : 'bg-slate-900'
              }`}
            />
            <div className="flex flex-col relative z-10">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-xs">{tooltip.label}</span>
                {tooltip.badge && (
                  <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                    {tooltip.badge}
                  </span>
                )}
                {tooltip.shortcut && (
                  <kbd className="text-[9px] font-mono px-1 py-0.5 rounded bg-white/20 text-slate-200">
                    {tooltip.shortcut}
                  </kbd>
                )}
              </div>
              {tooltip.sublabel && (
                <span className="text-[10px] font-bangla text-slate-300 opacity-90 leading-tight mt-0.5">
                  {tooltip.sublabel}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      <aside
        onMouseLeave={clearTooltip}
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col transition-all duration-200 ease-in-out ${
          isDark
            ? 'bg-[#103A40]/90 backdrop-blur-md text-slate-200 border-r border-white/5'
            : 'glass-sidebar text-slate-900'
        } ${
          isHidden
            ? 'lg:w-0 lg:overflow-hidden lg:border-none lg:pointer-events-none'
            : isMini
            ? 'lg:w-[68px]'
            : 'lg:w-[220px]'
        } ${
          mobileOpen
            ? 'translate-x-0 w-[260px]'
            : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div
          className={`h-16 flex items-center justify-between px-3 shrink-0 border-b ${
            isDark ? 'border-white/5' : 'border-slate-100'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0 overflow-hidden">
            {logoUrl ? (
              <img
                src={updatedAt ? `${logoUrl}?v=${updatedAt}` : logoUrl}
                alt={companyName}
                className="w-8 h-8 object-contain shrink-0 rounded-lg"
              />
            ) : (
              <div className="w-8 h-8 shrink-0 rounded-xl bg-gradient-to-br from-[#0F8B8D] via-teal-600 to-indigo-600 text-white font-extrabold flex items-center justify-center text-sm shadow-xs ring-1 ring-white/20">
                R
              </div>
            )}

            {(!isMini || mobileOpen) && (
              <div className="flex flex-col truncate">
                <span
                  className={`text-xs font-bold truncate leading-tight ${
                    isDark ? 'text-white' : 'text-slate-900'
                  }`}
                  title={companyName}
                >
                  {companyName}
                </span>
                <span className="text-[9px] font-bangla text-[#2BA5B5] font-semibold truncate leading-none mt-0.5">
                  গার্মেন্টস ইআরপি
                </span>
              </div>
            )}
          </div>

          <div className="hidden lg:flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={toggleMini}
              onMouseEnter={(e) =>
                showTooltip(
                  e,
                  isMini ? 'Expand sidebar' : 'Mini sidebar',
                  undefined,
                  null,
                  'Click'
                )
              }
              onMouseLeave={clearTooltip}
              className={`p-1.5 rounded-lg transition-colors ${
                isDark
                  ? 'text-slate-400 hover:text-white hover:bg-white/5'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title={isMini ? 'Expand sidebar' : 'Mini sidebar'}
              aria-label={isMini ? 'Expand sidebar' : 'Mini sidebar'}
            >
              {isMini ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </button>

            <button
              type="button"
              onClick={hide}
              onMouseEnter={(e) =>
                showTooltip(e, 'Hide sidebar', undefined, null, 'Ctrl+B')
              }
              onMouseLeave={clearTooltip}
              className={`p-1.5 rounded-lg transition-colors ${
                isDark
                  ? 'text-slate-400 hover:text-white hover:bg-white/5'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="Hide sidebar (Ctrl+B)"
              aria-label="Hide sidebar (Ctrl+B)"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className={`lg:hidden p-1.5 rounded-lg transition-colors ${
              isDark
                ? 'text-slate-400 hover:text-white hover:bg-white/5'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
            }`}
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-3 px-2 space-y-4 scrollbar-custom">
          {(() => {
            const userPermissions = profile?.permissions || [];

            const canAccessItem = (item: any): boolean => {
              if (item.id === 'dashboard' && isAdmin) return true;
              if (item.id === 'dashboard' && !isAdmin) return false;
              if (item.isAdminOnly) return isAdmin;
              if (isAdmin) return true;
              return userPermissions.includes(item.id);
            };

            const visibleGroups = ERP_MODULES.map((group) => {
              const filteredItems = group.items.filter(canAccessItem);
              return {
                ...group,
                items: filteredItems,
              };
            }).filter((group) => group.items.length > 0);

            return visibleGroups.map((group) => (
              <div key={group.group} className="space-y-1">
                {!isMini || mobileOpen ? (
                  <div className="px-3 pt-2 pb-1">
                    <p
                      className={`text-[11px] font-bold uppercase tracking-wider ${
                        isDark ? 'text-slate-400' : 'text-[#334155]'
                      }`}
                    >
                      {group.group}
                    </p>
                  </div>
                ) : (
                  <div
                    className={`my-2 mx-1 border-t ${
                      isDark ? 'border-white/5' : 'border-slate-200'
                    }`}
                  />
                )}

                <div className="space-y-1">
                  {group.items.map((item) => {
                    const isComingSoon = item.status === 'coming_soon';
                    const hasChildren = item.children && item.children.length > 0;
                    const isChildActive = hasChildren && item.children?.some((c: any) => location.pathname === c.path);
                    const isParentActive = item.path && location.pathname === item.path;
                    const isActive = isParentActive || isChildActive;
                    const isExpanded = expandedMenus[item.id] !== false; // default true

                    if (isComingSoon) {
                      return (
                        <div
                          key={item.id}
                          onMouseEnter={(e) =>
                            showTooltip(
                              e,
                              item.name,
                              item.nameBangla,
                              item.badge,
                              'Upcoming'
                            )
                          }
                          onMouseLeave={clearTooltip}
                          className={`h-10 min-h-[40px] px-3 flex items-center rounded-2xl text-sm font-medium cursor-not-allowed select-none transition-colors ${
                            isDark
                              ? 'text-slate-400/70 hover:bg-white/5'
                              : 'text-slate-500 hover:bg-slate-100/60'
                          } ${isMini && !mobileOpen ? 'justify-center px-0' : 'justify-between'}`}
                        >
                          <div className="flex items-center gap-3 overflow-hidden">
                            <span className="text-slate-400 shrink-0">
                              {renderIcon(item.icon)}
                            </span>
                            {(!isMini || mobileOpen) && (
                              <span
                                className={`truncate text-sm ${
                                  isDark ? 'text-slate-400' : 'text-[#1E293B] font-medium'
                                }`}
                              >
                                {item.name}
                              </span>
                            )}
                          </div>

                          {(!isMini || mobileOpen) && item.badge && (
                            <span
                              className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full shrink-0 shadow-xs"
                              style={{
                                backgroundColor: isDark ? 'rgba(230, 216, 58, 0.15)' : '#FEF3C7',
                                color: isDark ? '#E6D83A' : '#92400E',
                                border: isDark ? '1px solid rgba(230, 216, 58, 0.3)' : '1px solid #FDE68A',
                              }}
                            >
                              {item.badge}
                            </span>
                          )}
                        </div>
                      );
                    }

                    if (hasChildren) {
                      return (
                        <div key={item.id} className="space-y-1">
                          <button
                            type="button"
                            onClick={() => toggleExpand(item.id)}
                            onMouseEnter={(e) =>
                              showTooltip(e, item.name, item.nameBangla, null, 'Module')
                            }
                            onMouseLeave={clearTooltip}
                            className={`w-full h-10 min-h-[40px] px-3 flex items-center justify-between rounded-2xl text-sm font-medium transition-all group ${
                              isActive
                                ? 'bg-[#2BA5B5]/15 text-[#2BA5B5] font-semibold'
                                : isDark
                                ? 'text-slate-300 hover:text-white hover:bg-white/5'
                                : 'text-[#0F172A] font-semibold hover:text-slate-900 hover:bg-slate-100/80'
                            } ${isMini && !mobileOpen ? 'justify-center px-0' : ''}`}
                          >
                            <div className="flex items-center gap-3 overflow-hidden">
                              <span className={isActive ? 'text-[#2BA5B5]' : 'text-slate-400 group-hover:text-current'}>
                                {renderIcon(item.icon)}
                              </span>
                              {(!isMini || mobileOpen) && (
                                <span className="truncate text-sm">{item.name}</span>
                              )}
                            </div>
                            {(!isMini || mobileOpen) && (
                              <ChevronDown
                                className={`w-4 h-4 transition-transform duration-200 text-slate-400 ${
                                  isExpanded ? 'rotate-180' : ''
                                }`}
                              />
                            )}
                          </button>

                          {/* Children List */}
                          {(!isMini || mobileOpen) && isExpanded && item.children && (
                            <div className="pl-6 space-y-1 border-l border-white/10 ml-4 my-1">
                              {item.children.map((child) => {
                                const isChildActive = location.pathname === child.path;
                                return (
                                  <NavLink
                                    key={child.id}
                                    to={child.path}
                                    onClick={() => setMobileOpen(false)}
                                    className={`h-9 px-3 flex items-center gap-2.5 rounded-xl text-xs font-medium transition-all ${
                                      isChildActive
                                        ? 'bg-[#2BA5B5] text-white shadow-xs font-bold'
                                        : isDark
                                        ? 'text-slate-300 hover:text-white hover:bg-white/5'
                                        : 'text-[#1E293B] hover:text-slate-900 hover:bg-slate-100'
                                    }`}
                                  >
                                    <span className="truncate">{child.name}</span>
                                  </NavLink>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    }

                    return (
                      <NavLink
                        key={item.id}
                        to={item.path!}
                        onClick={() => setMobileOpen(false)}
                        onMouseEnter={(e) =>
                          showTooltip(
                            e,
                            item.name,
                            item.nameBangla,
                            null,
                            isActive ? 'Active' : undefined
                          )
                        }
                        onMouseLeave={clearTooltip}
                        className={`h-10 min-h-[40px] px-3 flex items-center gap-3 rounded-2xl text-sm font-medium transition-all group relative ${
                          isActive
                            ? 'bg-[#2BA5B5] text-white shadow-md shadow-[#2BA5B5]/25 font-semibold'
                            : isDark
                            ? 'text-slate-300 hover:text-white hover:bg-white/5'
                            : 'text-[#0F172A] font-semibold hover:text-slate-900 hover:bg-slate-100/80'
                        } ${isMini && !mobileOpen ? 'justify-center px-0' : ''}`}
                      >
                        <span
                          className={
                            isActive
                              ? 'text-white'
                              : 'text-slate-400 group-hover:text-current'
                          }
                        >
                          {renderIcon(item.icon)}
                        </span>

                        {(!isMini || mobileOpen) && (
                          <span className="truncate text-sm">{item.name}</span>
                        )}
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            ));
          })()}
        </div>

        <div
          className={`p-2 shrink-0 space-y-1.5 border-t ${
            isDark
              ? 'border-white/5 bg-[#0D3136]'
              : 'border-slate-200/80 bg-slate-50/90'
          }`}
        >
          <div
            className={`flex items-center rounded-2xl transition-colors ${
              isDark ? 'bg-[#103A40]/80' : 'bg-slate-100/90'
            } ${
              isMini && !mobileOpen
                ? 'justify-center p-2'
                : 'justify-between p-2'
            }`}
          >
            {(!isMini || mobileOpen) ? (
              <>
                <div className="flex items-center gap-2 text-xs font-semibold select-none">
                  {isDark ? (
                    <Moon className="w-4 h-4 text-[#2BA5B5]" />
                  ) : (
                    <Sun className="w-4 h-4 text-amber-500" />
                  )}
                  <span className={isDark ? 'text-slate-200' : 'text-[#0F172A] font-semibold'}>
                    {isDark ? 'Dark Mode' : 'Light Mode'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={toggleTheme}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-[#2BA5B5] cursor-pointer ${
                    isDark ? 'bg-[#2BA5B5]' : 'bg-slate-300'
                  }`}
                  title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
                  aria-label={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow-xs ${
                      isDark ? 'translate-x-4.5' : 'translate-x-1'
                    }`}
                  />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={toggleTheme}
                onMouseEnter={(e) =>
                  showTooltip(
                    e,
                    isDark ? 'Light Mode' : 'Dark Mode',
                    'থিম পরিবর্তন',
                    null,
                    'Click'
                  )
                }
                onMouseLeave={clearTooltip}
                className="p-1 rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer"
                title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
                aria-label={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
              >
                {isDark ? (
                  <Moon className="w-4 h-4 text-[#2BA5B5]" />
                ) : (
                  <Sun className="w-4 h-4 text-amber-500" />
                )}
              </button>
            )}
          </div>

          <div className="space-y-1">
            {isAdmin && (
              <NavLink
                to="/admin/settings"
                onClick={() => setMobileOpen(false)}
                onMouseEnter={(e) =>
                  showTooltip(e, 'Settings', 'সিস্টেম সেটিংস', null, 'Manage')
                }
                onMouseLeave={clearTooltip}
                className={`h-10 min-h-[40px] px-3 flex items-center gap-3 rounded-2xl text-sm font-medium transition-colors ${
                  location.pathname === '/admin/settings'
                    ? 'text-[#2BA5B5] font-bold bg-[#2BA5B5]/10'
                    : isDark
                    ? 'text-slate-300 hover:text-white hover:bg-white/5'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
                } ${isMini && !mobileOpen ? 'justify-center px-0' : ''}`}
              >
                <Settings className="w-[18px] h-[18px] shrink-0 text-slate-400" />
                {(!isMini || mobileOpen) && <span>Settings</span>}
              </NavLink>
            )}

            <button
              type="button"
              onClick={handleSignOut}
              onMouseEnter={(e) =>
                showTooltip(e, 'Sign Out', 'লগআউট', null, 'Session')
              }
              onMouseLeave={clearTooltip}
              className={`w-full h-10 min-h-[40px] px-3 flex items-center gap-3 rounded-2xl text-sm font-medium text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer ${
                isMini && !mobileOpen ? 'justify-center px-0' : ''
              }`}
            >
              <LogOut className="w-[18px] h-[18px] shrink-0" />
              {(!isMini || mobileOpen) && <span>Logout</span>}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
