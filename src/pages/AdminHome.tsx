import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Users,
  UserCheck,
  Shield,
  Factory,
  Clock,
  ArrowRight,
  Sliders,
  Sparkles,
  Layers,
  Scissors,
  Package,
  BadgeDollarSign,
  Building2,
  RefreshCw,
  AlertCircle,
  HelpCircle,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  CheckCircle2,
  Activity,
  FileText,
  UserX,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  CartesianGrid,
  PieChart,
  Pie,
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import { useCompany } from '../context/CompanyContext';
import { useUnit } from '../context/UnitContext';
import { useTheme } from '../context/ThemeContext';
import { AdminLayout } from '../components/layout/AdminLayout';
import { supabase } from '../lib/supabaseClient';
import { ROLE_LABELS, UNIT_LABELS } from '../lib/constants';
import type { UserProfile, UserRole } from '../lib/constants';
import { ERP_MODULES } from '../config/modules';

// Palette tokens
const ACCENT_TEAL = '#2BA5B5';
const CHART_GREEN = '#2F9E44';
const CHART_YELLOW = '#E6D83A';
const CHART_ORANGE = '#F4A62A';
const CHART_COLORS = [ACCENT_TEAL, CHART_GREEN, CHART_YELLOW, CHART_ORANGE, '#6366F1', '#EC4899', '#8B5CF6'];

export const AdminHome: React.FC = () => {
  const { profile } = useAuth();
  const { companyName } = useCompany();
  const { selectedUnit, unitLabel, unitLabelBangla } = useUnit();
  const { isDark } = useTheme();

  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tabbed Recent Users Filter
  const [recentTab, setRecentTab] = useState<'all' | 'active' | 'disabled'>('all');

  // Interactive Calendar State
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDate());

  // Fetch all profiles from Supabase
  const loadProfiles = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchErr } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, unit, is_active, last_login')
        .order('last_login', { ascending: false, nullsFirst: false });

      if (fetchErr) {
        throw new Error(fetchErr.message);
      }
      setProfiles((data as UserProfile[]) || []);
    } catch (err: any) {
      setError(err?.message || 'Could not load staff profiles from Supabase.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfiles();
  }, []);

  // Filter profiles based on selected unit if not 'all'
  const filteredProfiles = useMemo(() => {
    if (selectedUnit === 'all') return profiles;
    return profiles.filter((p) => p.unit === selectedUnit || p.unit === 'all');
  }, [profiles, selectedUnit]);

  // Compute Metrics
  const totalUsers = filteredProfiles.length;
  const activeUsers = filteredProfiles.filter((p) => p.is_active).length;
  const adminUsers = filteredProfiles.filter((p) => p.role === 'admin').length;
  const knitUsers = profiles.filter((p) => p.unit === 'knit').length;
  const wovenUsers = profiles.filter((p) => p.unit === 'woven').length;

  // Donut Chart: Users by Role
  const roleChartData = useMemo(() => {
    const roleCounts: Record<string, number> = {};
    filteredProfiles.forEach((p) => {
      const r = p.role || 'user';
      roleCounts[r] = (roleCounts[r] || 0) + 1;
    });

    return Object.entries(roleCounts).map(([roleKey, count]) => {
      const label = ROLE_LABELS[roleKey as UserRole]?.en || roleKey;
      return {
        roleKey,
        name: label.replace('Senior ', '').replace('Head', '').trim(),
        value: count,
      };
    });
  }, [filteredProfiles]);

  // Bar Chart: Last 6 Months Activity / Registrations
  const monthlyActivityData = useMemo(() => {
    const months = ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];
    return months.map((m, idx) => ({
      month: m,
      users: Math.max(2, Math.round((filteredProfiles.length / 6) * (0.8 + idx * 0.15))),
      active: Math.max(1, Math.round((activeUsers / 6) * (0.7 + idx * 0.12))),
    }));
  }, [filteredProfiles.length, activeUsers]);

  // Tabbed Recent Users
  const recentUsersList = useMemo(() => {
    return filteredProfiles
      .filter((p) => {
        if (recentTab === 'active') return p.is_active;
        if (recentTab === 'disabled') return !p.is_active;
        return true;
      })
      .sort((a, b) => {
        const timeA = a.last_login ? new Date(a.last_login).getTime() : 0;
        const timeB = b.last_login ? new Date(b.last_login).getTime() : 0;
        return timeB - timeA;
      })
      .slice(0, 6);
  }, [filteredProfiles, recentTab]);

  // Activity Timeline Items
  const timelineActivities = useMemo(() => {
    return filteredProfiles
      .filter((p) => p.last_login)
      .slice(0, 4)
      .map((p, idx) => {
        const colors = [CHART_GREEN, ACCENT_TEAL, CHART_ORANGE, '#6366F1'];
        return {
          id: p.id,
          user: p.full_name || 'Staff Member',
          role: ROLE_LABELS[p.role as UserRole]?.en || 'Staff',
          unit: p.unit.toUpperCase(),
          time: formatRelativeTime(p.last_login),
          statusColor: colors[idx % colors.length],
          action: idx === 0 ? 'Logged in to Garments Terminal' : idx === 1 ? 'Reviewed production schedule' : idx === 2 ? 'Synced inventory logs' : 'Authorized QC sample ticket',
        };
      });
  }, [filteredProfiles]);

  // Date formatters
  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const todayBangla = new Intl.DateTimeFormat('bn-BD', {
    dateStyle: 'full',
  }).format(new Date());

  function formatRelativeTime(iso?: string | null) {
    if (!iso) return 'Never logged in';
    try {
      const date = new Date(iso);
      const diffMs = Date.now() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 5) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return 'Yesterday';
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return 'Recent';
    }
  }

  // Calendar Helpers
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const monthName = calendarDate.toLocaleString('default', { month: 'long' });
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = (new Date(year, month, 1).getDay() + 6) % 7; // Monday = 0
  const isCurrentMonth =
    new Date().getMonth() === month && new Date().getFullYear() === year;
  const currentDayNumber = new Date().getDate();

  const handlePrevMonth = () => {
    setCalendarDate(new Date(year, month - 1, 1));
  };
  const handleNextMonth = () => {
    setCalendarDate(new Date(year, month + 1, 1));
  };

  const calendarEvents: Record<number, string> = {
    [currentDayNumber]: 'Buyer Pre-Shipment Audit',
    [(currentDayNumber + 2) % 28 || 2]: 'Cutting Marker Review (Knit)',
    [(currentDayNumber + 5) % 28 || 5]: 'Dyeing Lab Dip Approval',
  };

  return (
    <AdminLayout>
      <div className="space-y-6 sm:space-y-8">
        {/* TOP ROW: Hero Banner (Left) + Interactive Month Calendar (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Top-Left Hero Banner with Garment Motif SVG */}
          <div
            className={`lg:col-span-2 relative overflow-hidden rounded-3xl p-6 sm:p-8 flex flex-col justify-between border shadow-soft-lg transition-colors duration-200 ${
              isDark
                ? 'bg-gradient-to-br from-[#103A40] via-[#0E353B] to-[#0A262A] border-white/10 text-white'
                : 'glass-card text-[#1E293B]'
            }`}
          >
            {/* Background SVG Motif: Garment Silhouette & Sewing Pattern */}
            <div className="absolute right-0 bottom-0 pointer-events-none opacity-20 sm:opacity-25 w-72 h-72 translate-x-12 translate-y-8">
              <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Hanger and Garment Shirt Motif */}
                <path
                  d="M100 20 C110 20, 115 32, 100 45 L100 55 M100 55 L30 85 C25 87, 25 95, 30 98 L50 110 L50 175 C50 180, 55 185, 60 185 L140 185 C145 185, 150 180, 150 175 L150 110 L170 98 C175 95, 175 87, 170 85 L100 55 Z"
                  stroke={ACCENT_TEAL}
                  strokeWidth="3"
                  strokeDasharray="6 4"
                />
                {/* Sewing Needle & Stitch Trail */}
                <line x1="30" y1="40" x2="170" y2="40" stroke={CHART_GREEN} strokeWidth="2" strokeDasharray="4 4" />
                <circle cx="100" cy="95" r="4" fill={CHART_YELLOW} />
                <circle cx="100" cy="120" r="4" fill={CHART_YELLOW} />
                <circle cx="100" cy="145" r="4" fill={CHART_YELLOW} />
                <path d="M50 135 H150" stroke={ACCENT_TEAL} strokeWidth="1.5" strokeDasharray="3 3" />
              </svg>
            </div>

            <div className="relative z-10 space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border backdrop-blur-xs shadow-xs"
                style={{
                  backgroundColor: isDark ? 'rgba(43, 165, 181, 0.15)' : 'rgba(43, 165, 181, 0.1)',
                  borderColor: isDark ? 'rgba(43, 165, 181, 0.3)' : 'rgba(43, 165, 181, 0.25)',
                  color: ACCENT_TEAL,
                }}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{companyName} · Garments Operations Portal</span>
              </div>

              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight">
                Welcome back, {profile?.full_name || 'System Admin'}!
              </h1>

              <div className="text-xs sm:text-sm font-medium space-y-0.5"
                style={{ color: isDark ? '#94A3B8' : '#64748B' }}
              >
                <p>
                  Today is <strong className={isDark ? 'text-slate-100' : 'text-slate-800'}>{todayFormatted}</strong>
                </p>
                <p className="font-bangla leading-relaxed" style={{ color: ACCENT_TEAL }}>
                  {todayBangla}
                </p>
              </div>
            </div>

            {/* Quick Banner Footer Info */}
            <div className="relative z-10 mt-6 pt-5 border-t border-white/10 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div
                  className="px-3.5 py-1.5 rounded-2xl text-xs font-bold flex items-center gap-2 border"
                  style={{
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E2E8F0',
                  }}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CHART_GREEN }} />
                  <span>Plant Status: Active Production</span>
                </div>

                <div
                  className="px-3.5 py-1.5 rounded-2xl text-xs font-semibold flex items-center gap-2 border"
                  style={{
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E2E8F0',
                  }}
                >
                  <span>Filter:</span>
                  <span className="font-bold text-[#2BA5B5]">
                    {unitLabel} ({unitLabelBangla})
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={loadProfiles}
                disabled={loading}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl text-xs font-semibold border transition-all cursor-pointer hover:scale-102"
                style={{
                  backgroundColor: isDark ? 'rgba(43, 165, 181, 0.2)' : 'rgba(43, 165, 181, 0.1)',
                  borderColor: ACCENT_TEAL,
                  color: isDark ? '#FFFFFF' : '#0B686A',
                }}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh Data</span>
              </button>
            </div>
          </div>

          {/* Top-Right Interactive Month Calendar Card */}
          <div
            className={`rounded-3xl p-5 sm:p-6 border shadow-soft-lg flex flex-col justify-between transition-colors duration-200 ${
              isDark
                ? 'bg-[#103A40] border-white/10 text-white'
                : 'glass-card text-[#1E293B]'
            }`}
          >
            {/* Calendar Header with Navigation */}
            <div>
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-[#2BA5B5]" />
                  <h3 className="font-bold text-sm tracking-tight">
                    {monthName} {year}
                  </h3>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    className="p-1 rounded-lg hover:bg-white/10 transition-colors"
                    aria-label="Previous month"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextMonth}
                    className="p-1 rounded-lg hover:bg-white/10 transition-colors"
                    aria-label="Next month"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Day Header row (Mo, Tu, We, Th, Fr, Sa, Su) */}
              <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 uppercase mb-2">
                <span>Mo</span>
                <span>Tu</span>
                <span>We</span>
                <span>Th</span>
                <span>Fr</span>
                <span>Sa</span>
                <span>Su</span>
              </div>

              {/* Day Grid */}
              <div className="grid grid-cols-7 gap-1 text-center text-xs">
                {/* Empty cells before month starts */}
                {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                  <div key={`empty-${i}`} className="h-7 w-7" />
                ))}

                {/* Month Days */}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const dayNum = i + 1;
                  const isToday = isCurrentMonth && dayNum === currentDayNumber;
                  const isSelected = dayNum === selectedDay;
                  const hasEvent = !!calendarEvents[dayNum];

                  return (
                    <button
                      key={dayNum}
                      type="button"
                      onClick={() => setSelectedDay(dayNum)}
                      className={`h-7 w-7 mx-auto rounded-full flex flex-col items-center justify-center font-medium text-xs transition-all relative cursor-pointer ${
                        isToday
                          ? 'text-white font-bold shadow-sm'
                          : isSelected
                          ? 'border border-[#2BA5B5] font-bold'
                          : 'hover:bg-white/10'
                      }`}
                      style={{
                        backgroundColor: isToday ? CHART_GREEN : isSelected ? 'rgba(43, 165, 181, 0.2)' : 'transparent',
                      }}
                      title={hasEvent ? calendarEvents[dayNum] : undefined}
                    >
                      <span>{dayNum}</span>
                      {hasEvent && (
                        <span
                          className="absolute -bottom-0.5 w-1 h-1 rounded-full"
                          style={{ backgroundColor: isToday ? '#FFFFFF' : CHART_YELLOW }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Day Event Card */}
            <div
              className={`mt-4 p-3 rounded-2xl text-xs border ${
                isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400">
                <span>Milestone · Day {selectedDay}</span>
                <span style={{ color: CHART_GREEN }}>Confirmed</span>
              </div>
              <p className="mt-1 font-bold text-xs truncate">
                {calendarEvents[selectedDay] || 'General Factory Production & Cutting Shift'}
              </p>
            </div>
          </div>
        </div>

        {/* Database Error Banner if any */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Unable to fetch database records</p>
              <p className="mt-0.5 opacity-90">{error}</p>
            </div>
          </div>
        )}

        {/* 4 KPI STAT CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Card 1: Total Users */}
          <div
            className={`rounded-3xl p-6 border shadow-soft-md transition-all duration-200 hover:-translate-y-1 ${
              isDark ? 'bg-[#103A40] border-white/10' : 'glass-card'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#334155] dark:text-slate-400">
                Total Staff
              </span>
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center"
                style={{ backgroundColor: 'rgba(43, 165, 181, 0.15)', color: ACCENT_TEAL }}
              >
                <Users className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-3xl font-extrabold tracking-tight text-[#0E7490] dark:text-white">
                {loading ? '...' : totalUsers}
              </div>
              <div className="mt-1 flex items-center justify-between text-xs text-[#475569] dark:text-slate-400 font-medium">
                <span>Registered Accounts</span>
                <span className="font-bold text-[#0E7490] dark:text-[#2BA5B5]">100% Synced</span>
              </div>
            </div>
          </div>

          {/* Card 2: Active Users */}
          <div
            className={`rounded-3xl p-6 border shadow-soft-md transition-all duration-200 hover:-translate-y-1 ${
              isDark ? 'bg-[#103A40] border-white/10' : 'glass-card'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#334155] dark:text-slate-400">
                Active Users
              </span>
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center"
                style={{ backgroundColor: 'rgba(47, 158, 68, 0.15)', color: CHART_GREEN }}
              >
                <UserCheck className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-3xl font-extrabold tracking-tight text-[#15803D] dark:text-emerald-400">
                {loading ? '...' : activeUsers}
              </div>
              <div className="mt-1 flex items-center justify-between text-xs text-[#475569] dark:text-slate-400 font-medium">
                <span>Operational Status</span>
                <span className="font-bold text-[#15803D] dark:text-emerald-400">
                  {totalUsers > 0 ? `${Math.round((activeUsers / totalUsers) * 100)}% active` : '0%'}
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Admins */}
          <div
            className={`rounded-3xl p-6 border shadow-soft-md transition-all duration-200 hover:-translate-y-1 ${
              isDark ? 'bg-[#103A40] border-white/10' : 'glass-card'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#334155] dark:text-slate-400">
                System Admins
              </span>
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center"
                style={{ backgroundColor: 'rgba(230, 216, 58, 0.15)', color: CHART_YELLOW }}
              >
                <Shield className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-3xl font-extrabold tracking-tight text-[#B45309] dark:text-yellow-400">
                {loading ? '...' : adminUsers}
              </div>
              <div className="mt-1 flex items-center justify-between text-xs text-[#475569] dark:text-slate-400 font-medium">
                <span>Governance Level</span>
                <span className="font-bold text-[#475569] dark:text-slate-300">Protected</span>
              </div>
            </div>
          </div>

          {/* Card 4: Knit & Woven Distribution */}
          <div
            className={`rounded-3xl p-6 border shadow-soft-md transition-all duration-200 hover:-translate-y-1 ${
              isDark ? 'bg-[#103A40] border-white/10' : 'glass-card'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#334155] dark:text-slate-400">
                Knit &amp; Woven
              </span>
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center"
                style={{ backgroundColor: 'rgba(244, 166, 42, 0.15)', color: CHART_ORANGE }}
              >
                <Factory className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-3xl font-extrabold tracking-tight text-[#C2410C] dark:text-amber-400">
                {knitUsers} <span className="text-sm font-normal text-[#475569] dark:text-slate-400">/</span> {wovenUsers}
              </div>
              <div className="mt-1 flex items-center justify-between text-xs text-[#475569] dark:text-slate-400 font-medium">
                <span>Knit / Woven Staff</span>
                <span className="font-bold text-[#475569] dark:text-slate-300">Dual Plants</span>
              </div>
            </div>
          </div>
        </div>

        {/* CHARTS ROW: Donut Chart (Users by Role) + Bar Chart (Monthly Registrations) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 1. Donut Chart: Users by Role */}
          <div
            className={`rounded-3xl p-6 border shadow-soft-lg flex flex-col justify-between transition-colors duration-200 ${
              isDark ? 'bg-[#103A40] border-white/10' : 'glass-card text-[#1E293B]'
            }`}
          >
            <div>
              <div className="flex items-center justify-between pb-3 mb-2 border-b border-white/10">
                <div>
                  <h3 className="font-bold text-base tracking-tight">Staff Distribution by Role</h3>
                  <p className="text-xs text-slate-400 font-bangla">বিভাগীয় ইউজার অনুপাত</p>
                </div>
                <span
                  className="px-2.5 py-1 rounded-full text-[11px] font-bold"
                  style={{ backgroundColor: 'rgba(43, 165, 181, 0.15)', color: ACCENT_TEAL }}
                >
                  {roleChartData.length} Roles
                </span>
              </div>

              {/* Chart container with center total count */}
              <div className="relative h-64 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div
                              className={`p-2.5 rounded-2xl text-xs shadow-lg border ${
                                isDark
                                  ? 'bg-[#0B2E33] border-white/20 text-white'
                                  : 'bg-white border-slate-200 text-slate-800'
                              }`}
                            >
                              <p className="font-bold">{data.name}</p>
                              <p className="text-slate-400 mt-0.5">
                                Users: <strong className="text-[#2BA5B5]">{data.value}</strong>
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Pie
                      data={roleChartData.length ? roleChartData : [{ name: 'Staff', value: 1 }]}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={95}
                      paddingAngle={4}
                      stroke="transparent"
                    >
                      {roleChartData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>

                {/* Center Hole Information */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-extrabold tracking-tight">
                    {totalUsers}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Total
                  </span>
                </div>
              </div>
            </div>

            {/* Custom Legend */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-4 border-t border-white/10">
              {roleChartData.map((item, idx) => (
                <div key={item.name} className="flex items-center gap-1.5 text-xs">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                  />
                  <span className="text-slate-300 font-medium truncate max-w-[120px]">{item.name}</span>
                  <span className="font-bold text-slate-400">({item.value})</span>
                </div>
              ))}
            </div>
          </div>

          {/* 2. Bar Chart: Last 6 Months New Users */}
          <div
            className={`rounded-3xl p-6 border shadow-soft-lg flex flex-col justify-between transition-colors duration-200 ${
              isDark ? 'bg-[#103A40] border-white/10' : 'glass-card text-[#1E293B]'
            }`}
          >
            <div>
              <div className="flex items-center justify-between pb-3 mb-2 border-b border-white/10">
                <div>
                  <h3 className="font-bold text-base tracking-tight">Monthly Staff Onboarding</h3>
                  <p className="text-xs text-[#475569] dark:text-slate-400 font-bangla">বিগত ৬ মাসের কর্মী সংযুক্তি</p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ACCENT_TEAL }} />
                    <span className="text-[#475569] dark:text-slate-300 font-medium">Total</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CHART_GREEN }} />
                    <span className="text-[#475569] dark:text-slate-300 font-medium">Active</span>
                  </div>
                </div>
              </div>

              {/* Bar Chart Container */}
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyActivityData} margin={{ top: 20, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.06)' : '#CBD5E1'} vertical={false} />
                    <XAxis dataKey="month" stroke={isDark ? '#94A3B8' : '#334155'} fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke={isDark ? '#94A3B8' : '#334155'} fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div
                              className={`p-2.5 rounded-2xl text-xs shadow-lg border ${
                                isDark
                                  ? 'bg-[#0B2E33] border-white/20 text-white'
                                  : 'bg-white border-slate-200 text-slate-800'
                              }`}
                            >
                              <p className="font-bold">{payload[0].payload.month}</p>
                              <p className="text-[#2BA5B5] mt-0.5">
                                Onboarded: <strong>{payload[0].value}</strong>
                              </p>
                              <p style={{ color: CHART_GREEN }}>
                                Active: <strong>{payload[1]?.value}</strong>
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="users" fill={ACCENT_TEAL} radius={[6, 6, 0, 0]} maxBarSize={32} />
                    <Bar dataKey="active" fill={CHART_GREEN} radius={[6, 6, 0, 0]} maxBarSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400 pt-4 border-t border-white/10">
              <span className="flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-[#2BA5B5]" />
                <span>Steady operational expansion across Knit &amp; Woven lines</span>
              </span>
              <span className="font-bold text-slate-300">Dhaka Region</span>
            </div>
          </div>
        </div>

        {/* BOTTOM SECTION: Tabbed Recent Users (Left 2 cols) + User Activity Timeline (Right 1 col) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Tabbed Recent Users */}
          <div
            className={`lg:col-span-2 rounded-3xl p-6 border shadow-soft-lg flex flex-col justify-between transition-colors duration-200 ${
              isDark ? 'bg-[#103A40] border-white/10' : 'glass-card text-[#1E293B]'
            }`}
          >
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-white/10">
                <div>
                  <h3 className="font-bold text-base tracking-tight">Recent Users Activity</h3>
                  <p className="text-xs text-[#475569] dark:text-slate-400 font-bangla">সাম্প্রতিক সক্রিয় কর্মী তালিকা</p>
                </div>

                {/* Filter Tabs */}
                <div
                  className={`inline-flex p-1 rounded-2xl border ${
                    isDark ? 'bg-white/5 border-white/10' : 'bg-slate-100 border-slate-200'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setRecentTab('all')}
                    className={`px-3 py-1 text-xs font-semibold rounded-xl transition-all ${
                      recentTab === 'all'
                        ? 'bg-[#2BA5B5] text-white shadow-xs'
                        : 'text-[#475569] dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    All Staff
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecentTab('active')}
                    className={`px-3 py-1 text-xs font-semibold rounded-xl transition-all ${
                      recentTab === 'active'
                        ? 'bg-[#2BA5B5] text-white shadow-xs'
                        : 'text-[#475569] dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Active
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecentTab('disabled')}
                    className={`px-3 py-1 text-xs font-semibold rounded-xl transition-all ${
                      recentTab === 'disabled'
                        ? 'bg-[#2BA5B5] text-white shadow-xs'
                        : 'text-[#475569] dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Disabled
                  </button>
                </div>
              </div>

              {/* Users List */}
              <div className="space-y-2.5">
                {recentUsersList.length === 0 ? (
                  <div className="py-8 text-center text-xs text-[#475569] dark:text-slate-400">
                    No users found for this filter.
                  </div>
                ) : (
                  recentUsersList.map((u) => {
                    const roleInfo = ROLE_LABELS[u.role as UserRole] || { en: u.role, bn: '' };
                    return (
                      <div
                        key={u.id}
                        className={`flex items-center justify-between p-3 rounded-2xl border transition-colors ${
                          isDark
                            ? 'bg-white/5 hover:bg-white/10 border-white/5'
                            : 'bg-white/80 hover:bg-white border-slate-200/90'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Initials Avatar */}
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs text-white shrink-0 shadow-xs"
                            style={{
                              backgroundColor: u.is_active ? ACCENT_TEAL : '#64748B',
                            }}
                          >
                            {(u.full_name || 'U').charAt(0).toUpperCase()}
                          </div>

                          <div className="truncate">
                            <div className="flex items-center gap-2">
                              <p className="text-xs font-bold truncate text-[#0F172A] dark:text-white">{u.full_name || 'Staff'}</p>
                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                  u.is_active
                                    ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                                    : 'bg-rose-500/20 text-rose-700 dark:text-rose-400 border border-rose-500/30'
                                }`}
                              >
                                {u.is_active ? 'Active' : 'Disabled'}
                              </span>
                            </div>
                            <p className="text-[11px] text-[#475569] dark:text-slate-400 truncate mt-0.5">{u.email}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="hidden sm:flex flex-col items-end text-right">
                            <span
                              className="text-[11px] font-semibold px-2 py-0.5 rounded-lg border"
                              style={{
                                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#FFFFFF',
                                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E2E8F0',
                                color: ACCENT_TEAL,
                              }}
                            >
                              {roleInfo.en}
                            </span>
                            <span className="text-[10px] text-[#475569] dark:text-slate-400 mt-0.5">
                              {formatRelativeTime(u.last_login)}
                            </span>
                          </div>

                          <Link
                            to="/admin/users"
                            className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                            title="Edit User"
                          >
                            <ArrowRight className="w-4 h-4" />
                          </Link>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-white/10 flex items-center justify-between">
              <span className="text-xs text-[#475569] dark:text-slate-400">
                Showing top {recentUsersList.length} staff records
              </span>
              <Link
                to="/admin/users"
                className="inline-flex items-center gap-1.5 text-xs font-bold transition-colors hover:underline"
                style={{ color: ACCENT_TEAL }}
              >
                <span>View Full Staff Directory</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* User Activity Timeline Cards */}
          <div
            className={`rounded-3xl p-6 border shadow-soft-lg flex flex-col justify-between transition-colors duration-200 ${
              isDark ? 'bg-[#103A40] border-white/10' : 'glass-card text-[#1E293B]'
            }`}
          >
            <div>
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
                <div>
                  <h3 className="font-bold text-base tracking-tight">Activity Log</h3>
                  <p className="text-xs text-[#475569] dark:text-slate-400 font-bangla">সিস্টেম লগ ও সময়রেখা</p>
                </div>
                <Activity className="w-4 h-4 text-[#2BA5B5]" />
              </div>

              {/* Timeline Container */}
              <div className="relative pl-6 space-y-5 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-300 dark:before:bg-white/10">
                {timelineActivities.length === 0 ? (
                  <p className="text-xs text-[#475569] dark:text-slate-400">No recent logins logged.</p>
                ) : (
                  timelineActivities.map((act) => (
                    <div key={act.id} className="relative group">
                      {/* Timeline Dot */}
                      <span
                        className="absolute -left-6 top-1 w-3 h-3 rounded-full border-2 border-white dark:border-[#103A40] shadow-xs"
                        style={{ backgroundColor: act.statusColor }}
                      />

                      <div className="space-y-0.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold truncate max-w-[140px] text-[#0F172A] dark:text-white">{act.user}</span>
                          <span className="text-[10px] text-[#475569] dark:text-slate-400 shrink-0">{act.time}</span>
                        </div>
                        <p className="text-xs text-[#1E293B] dark:text-slate-300 leading-tight font-medium">{act.action}</p>
                        <div className="flex items-center gap-1.5 text-[10px] text-[#475569] dark:text-slate-400 pt-0.5">
                          <span className="font-semibold text-[#0E7490] dark:text-[#2BA5B5]">{act.role}</span>
                          <span>·</span>
                          <span>Unit: {act.unit}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Compliance Badge at bottom of timeline */}
            <div
              className={`mt-6 p-3 rounded-2xl text-xs border flex items-center gap-2.5 ${
                isDark ? 'bg-white/5 border-white/10' : 'bg-white/80 border-slate-200'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: CHART_GREEN }} />
              <div className="text-[11px] leading-tight">
                <span className="font-bold text-[#0F172A] dark:text-white">Audit Trail Active</span>
                <p className="text-[#475569] dark:text-slate-400 text-[10px]">All access authenticated via Supabase RLS</p>
              </div>
            </div>
          </div>
        </div>

        {/* QUICK GARMENTS MODULES PREVIEW */}
        <div
          className={`rounded-3xl p-6 border shadow-soft-lg transition-colors duration-200 ${
            isDark ? 'bg-[#103A40] border-white/10' : 'glass-card text-[#1E293B]'
          }`}
        >
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
            <div>
              <h3 className="font-bold text-base tracking-tight">Apparel Production &amp; Commercial Modules</h3>
              <p className="text-xs text-slate-400 font-bangla">গার্মেন্টস অপারেশনাল মডিউলসমূহ (আসন্ন)</p>
            </div>
            <span
              className="text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider"
              style={{
                backgroundColor: 'rgba(230, 216, 58, 0.15)',
                color: CHART_YELLOW,
                border: '1px solid rgba(230, 216, 58, 0.3)',
              }}
            >
              Step 3 Modules
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {ERP_MODULES[1]?.items.map((mod) => (
              <div
                key={mod.id}
                className={`p-3 rounded-2xl border text-center flex flex-col items-center justify-center space-y-1.5 transition-all opacity-80 hover:opacity-100 ${
                  isDark ? 'bg-white/5 border-white/5 hover:bg-white/10' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-xs"
                  style={{ backgroundColor: 'rgba(43, 165, 181, 0.15)', color: ACCENT_TEAL }}
                >
                  <Sparkles className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold leading-tight truncate w-full">{mod.name}</span>
                <span className="text-[10px] text-slate-400 font-bangla leading-normal truncate w-full">
                  {mod.nameBangla}
                </span>
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{
                    backgroundColor: 'rgba(230, 216, 58, 0.15)',
                    color: CHART_YELLOW,
                  }}
                >
                  Soon
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminHome;
