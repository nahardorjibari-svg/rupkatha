import React, { useState, useMemo, useCallback } from 'react';
import {
  CalendarDays,
  Plus,
  Search,
  X,
  RefreshCw,
  Layers,
  Filter,
  CheckCircle2,
  Clock,
  Sparkles,
  Shirt,
} from 'lucide-react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { useUnit } from '../../context/UnitContext';
import { useTheme } from '../../context/ThemeContext';
import { getDhakaDateString } from '../../lib/dhakaTime';
import { buildRolling30Days } from '../../lib/planningStatus';
import { usePlanningOrders } from '../../hooks/planning/usePlanningOrders';
import { usePlanningDaily } from '../../hooks/planning/usePlanningDaily';
import { LinePlanTable } from '../../components/planning/LinePlanTable';
import { LineSummaryCard } from '../../components/planning/LineSummaryCard';
import { AddOrderDrawer } from '../../components/planning/AddOrderDrawer';
import { ExportButtons } from '../../components/planning/ExportButtons';
import type { PlanningTab } from '../../types/planning';

export const LinePlanPage: React.FC = () => {
  const { activeUnit, setActiveUnit, unitLabel } = useUnit();
  const { isDark } = useTheme();

  // Active tab: 'active' | 'upcoming' | 'done'
  const [currentTab, setCurrentTab] = useState<PlanningTab>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Dhaka rolling 30 days
  const dhakaTodayStr = useMemo(() => getDhakaDateString(), []);
  const days = useMemo(() => buildRolling30Days(dhakaTodayStr), [dhakaTodayStr]);
  const startDateStr = days[0].dateStr;
  const endDateStr = days[days.length - 1].dateStr;

  // Formatted date range label (e.g., "24 Oct 2026 – 22 Nov 2026")
  const dateRangeLabel = useMemo(() => {
    const startParts = days[0].displayDay;
    const endParts = days[days.length - 1].displayDay;
    return `${startParts} – ${endParts} (Dhaka)`;
  }, [days]);

  // Orders Hook
  const {
    orders,
    loading: ordersLoading,
    refreshOrders,
    updateOrder,
    deleteOrder,
  } = usePlanningOrders({ factoryUnit: activeUnit });

  // Visible Order IDs for Daily Matrix
  const allOrderIds = useMemo(() => orders.map((o) => o.id), [orders]);

  // Daily Hook
  const {
    dailyData,
    flashedCells,
    savingCells,
    upsertDailyCell,
    fetchDaily,
  } = usePlanningDaily({
    orderIds: allOrderIds,
    startDateStr,
    endDateStr,
    onDataChanged: refreshOrders,
  });

  // Tab Filtering & Search Overrides
  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    // If search active: search across ALL rows, regardless of tab
    if (q) {
      return orders.filter((o) => {
        const poMatch = (o.po || '').toLowerCase().includes(q);
        const styleMatch = (o.style || '').toLowerCase().includes(q);
        return poMatch || styleMatch;
      });
    }

    // Otherwise apply tab filters
    return orders.filter((o) => {
      const isDone = Boolean(o.is_done);
      const lineNo = (o.line_no || '').trim();

      if (currentTab === 'done') {
        return isDone;
      }

      if (currentTab === 'upcoming') {
        return !isDone && !lineNo;
      }

      // 'active': not done AND has line assigned
      return !isDone && Boolean(lineNo);
    });
  }, [orders, searchQuery, currentTab]);

  // Tab counts
  const counts = useMemo(() => {
    let active = 0;
    let upcoming = 0;
    let done = 0;

    orders.forEach((o) => {
      const isDone = Boolean(o.is_done);
      const lineNo = (o.line_no || '').trim();

      if (isDone) {
        done++;
      } else if (!lineNo) {
        upcoming++;
      } else {
        active++;
      }
    });

    return { active, upcoming, done };
  }, [orders]);

  return (
    <AdminLayout>
      <div className="space-y-4 pb-12 print:p-0 print:space-y-2">
        {/* Sticky Top Header Bar */}
        <div className="sticky top-0 z-30 -mt-2 -mx-4 px-4 py-3 bg-slate-50/95 dark:bg-[#0A262B]/95 backdrop-blur-md border-b border-slate-200 dark:border-white/10 print:static print:bg-white print:p-0">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Title & Rolling Date */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#0F8B8D] to-teal-700 text-white flex items-center justify-center shadow-xs">
                <CalendarDays className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
                    Line Plan
                  </h1>
                  <span className="text-xs font-bangla text-[#2BA5B5] font-bold">
                    লাইন পরিকল্পনা
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5">
                  <span>30-Day Rolling Window:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {dateRangeLabel}
                  </span>
                </p>
              </div>
            </div>

            {/* Controls: Unit Toggle, Search, Export, Add Order */}
            <div className="flex flex-wrap items-center gap-2 print:hidden">
              {/* Unit Switcher */}
              <div className="flex items-center bg-white dark:bg-black/20 p-1 rounded-xl border border-slate-200 dark:border-white/10 shadow-xs">
                <button
                  type="button"
                  onClick={() => setActiveUnit('knit')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    activeUnit === 'knit'
                      ? 'bg-[#2BA5B5] text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Knit
                </button>
                <button
                  type="button"
                  onClick={() => setActiveUnit('woven')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    activeUnit === 'woven'
                      ? 'bg-[#2BA5B5] text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Woven
                </button>
                <button
                  type="button"
                  onClick={() => setActiveUnit('all')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    activeUnit === 'all'
                      ? 'bg-[#2BA5B5] text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  All
                </button>
              </div>

              {/* Search Box */}
              <div className="relative min-w-[180px] sm:min-w-[220px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search PO or Style..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-7 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-black/20 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2BA5B5] shadow-xs"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Export Buttons (Print, Excel, PDF) */}
              <ExportButtons
                orders={filteredOrders}
                days={days}
                dailyData={dailyData}
                dateRangeLabel={dateRangeLabel}
                unitLabel={unitLabel}
              />

              {/* Refresh button */}
              <button
                type="button"
                onClick={() => {
                  refreshOrders();
                  fetchDaily();
                }}
                className="p-2 rounded-xl text-slate-500 dark:text-slate-400 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10 transition-colors shadow-xs"
                title="Refresh plan data"
              >
                <RefreshCw
                  className={`w-4 h-4 ${ordersLoading ? 'animate-spin' : ''}`}
                />
              </button>

              {/* Add Order Button */}
              <button
                type="button"
                onClick={() => setIsDrawerOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#0F8B8D] hover:bg-[#0c6e70] shadow-sm transition-all hover:scale-102 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Order</span>
              </button>
            </div>
          </div>

          {/* Sub Navigation Tabs */}
          <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-200/80 dark:border-white/10 print:hidden">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setCurrentTab('active');
                  setSearchQuery('');
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  currentTab === 'active' && !searchQuery
                    ? 'bg-[#2BA5B5] text-white shadow-xs'
                    : 'bg-white dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Active</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/15">
                  {counts.active}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCurrentTab('upcoming');
                  setSearchQuery('');
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  currentTab === 'upcoming' && !searchQuery
                    ? 'bg-[#2BA5B5] text-white shadow-xs'
                    : 'bg-white dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Upcoming</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/15">
                  {counts.upcoming}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCurrentTab('done');
                  setSearchQuery('');
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  currentTab === 'done' && !searchQuery
                    ? 'bg-[#2BA5B5] text-white shadow-xs'
                    : 'bg-white dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Done</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/15">
                  {counts.done}
                </span>
              </button>
            </div>

            {searchQuery && (
              <div className="text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-3 py-1 rounded-lg border border-amber-200 dark:border-amber-800 flex items-center gap-1.5">
                <span>
                  Filtering {filteredOrders.length} search matches for &quot;{searchQuery}&quot;
                </span>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="underline hover:text-amber-800 ml-1"
                >
                  Clear
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Print Only Header */}
        <div className="hidden print:block mb-4 border-b pb-2">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                RUPKATHA APPARELS LTD.
              </h1>
              <h2 className="text-sm font-semibold text-slate-700">
                30-Day Rolling Line Plan ({unitLabel})
              </h2>
            </div>
            <div className="text-right text-xs text-slate-600">
              <p>Period: {dateRangeLabel}</p>
              <p>Date Printed: {new Date().toLocaleDateString()}</p>
            </div>
          </div>
        </div>

        {/* Main Line Plan Matrix Table */}
        <LinePlanTable
          orders={filteredOrders}
          days={days}
          dailyData={dailyData}
          flashedCells={flashedCells}
          savingCells={savingCells}
          searchQuery={searchQuery}
          onUpdateOrder={updateOrder}
          onDeleteOrder={deleteOrder}
          onUpsertDailyCell={upsertDailyCell}
        />

        {/* Line Summary Card (Collapsible) */}
        <div className="print:hidden">
          <LineSummaryCard orders={orders} />
        </div>

        {/* Print Signature Block */}
        <div className="hidden print:grid grid-cols-4 gap-8 mt-16 pt-8 border-t border-slate-400 text-center text-xs font-semibold text-slate-800">
          <div>
            <div className="border-t border-dashed border-slate-400 pt-2">
              Prepared By
            </div>
          </div>
          <div>
            <div className="border-t border-dashed border-slate-400 pt-2">
              Merchandiser
            </div>
          </div>
          <div>
            <div className="border-t border-dashed border-slate-400 pt-2">
              Production Manager
            </div>
          </div>
          <div>
            <div className="border-t border-dashed border-slate-400 pt-2">
              General Manager / MD
            </div>
          </div>
        </div>

        {/* Add Order Slide-over Drawer */}
        <AddOrderDrawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          onOrderAdded={() => {
            refreshOrders();
            fetchDaily();
          }}
          currentFactoryUnit={activeUnit}
        />
      </div>
    </AdminLayout>
  );
};
