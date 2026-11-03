import React, { useState, useMemo } from 'react';
import {
  CalendarDays,
  Plus,
  Search,
  X,
  RefreshCw,
  Sparkles,
  Clock,
  CheckCircle2,
  ClipboardList,
  BarChart3,
  Sun,
  Moon,
  Filter,
  ChevronDown,
} from 'lucide-react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { useUnit } from '../../context/UnitContext';
import { useTheme } from '../../context/ThemeContext';
import { getDhakaDateString } from '../../lib/dhakaTime';
import { buildWindowDays } from '../../lib/planningStatus';
import { usePlanningOrders } from '../../hooks/planning/usePlanningOrders';
import { usePlanningDaily } from '../../hooks/planning/usePlanningDaily';
import { LinePlanTable } from '../../components/planning/LinePlanTable';
import { LineSummaryCard } from '../../components/planning/LineSummaryCard';
import { AddOrderDrawer } from '../../components/planning/AddOrderDrawer';
import { ExportButtons } from '../../components/planning/ExportButtons';
import type { PlanningTab } from '../../types/planning';

type ViewMode = 'production_plan' | 'line_summary';

export const LinePlanPage: React.FC = () => {
  const { activeUnit, setActiveUnit, unitLabel } = useUnit();
  const { isDark, toggleTheme } = useTheme();

  // View toggle: Production Plan vs Line Summary
  const [viewMode, setViewMode] = useState<ViewMode>('production_plan');

  // Active tab: 'active' | 'upcoming' | 'done'
  const [currentTab, setCurrentTab] = useState<PlanningTab>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Buyer Multi-Select Filter state
  const [selectedBuyers, setSelectedBuyers] = useState<string[]>([]);
  const [buyerDropdownOpen, setBuyerDropdownOpen] = useState(false);

  // Window position in React state: default -1 (yesterday is index 0)
  const [offsetDays, setOffsetDays] = useState(-1);

  // Dhaka today
  const dhakaTodayStr = useMemo(() => getDhakaDateString(), []);

  // 8-Day rolling window
  const days = useMemo(
    () => buildWindowDays(dhakaTodayStr, offsetDays, 8),
    [dhakaTodayStr, offsetDays]
  );
  const startDateStr = days[0].dateStr;
  const endDateStr = days[days.length - 1].dateStr;

  // Formatted date range label (e.g. "31/10 – 07/11")
  const dateRangeLabel = useMemo(() => {
    const startParts = days[0].displayDay;
    const endParts = days[days.length - 1].displayDay;
    return `${startParts} – ${endParts}`;
  }, [days]);

  // Window navigation handlers (moves by 8 days)
  const handleEarlier = () => setOffsetDays((prev) => prev - 8);
  const handleLater = () => setOffsetDays((prev) => prev + 8);

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

  // Distinct buyers list sorted A-Z from loaded orders
  const allBuyers = useMemo(() => {
    const set = new Set<string>();
    orders.forEach((o) => {
      const b = (o.buyer || '').trim();
      if (b) set.add(b);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [orders]);

  // Tab Filtering & Search Overrides combined with Buyer Multi-Select
  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return orders.filter((o) => {
      // 1. Buyer multi-select filter
      if (selectedBuyers.length > 0) {
        const orderBuyer = (o.buyer || '').trim();
        if (!selectedBuyers.includes(orderBuyer)) {
          return false;
        }
      }

      // 2. Search query filter
      if (q) {
        const poMatch = (o.po || '').toLowerCase().includes(q);
        const styleMatch = (o.style || '').toLowerCase().includes(q);
        const buyerMatch = (o.buyer || '').toLowerCase().includes(q);
        const subMatch = (o.sub_contract || '').toLowerCase().includes(q);
        return poMatch || styleMatch || buyerMatch || subMatch;
      }

      // 3. Otherwise apply tab filters
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
  }, [orders, selectedBuyers, searchQuery, currentTab]);

  // Tab counts (reflects selected buyers if filtered)
  const counts = useMemo(() => {
    let active = 0;
    let upcoming = 0;
    let done = 0;

    orders.forEach((o) => {
      if (selectedBuyers.length > 0) {
        const orderBuyer = (o.buyer || '').trim();
        if (!selectedBuyers.includes(orderBuyer)) return;
      }

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
  }, [orders, selectedBuyers]);

  return (
    <AdminLayout>
      <div className="min-h-screen bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 pb-12 print:p-0 print:space-y-2">
        {/* Sticky Top Header Bar */}
        <div className="sticky top-0 z-30 -mt-2 -mx-4 px-4 py-3 bg-white dark:bg-slate-900 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 print:static print:bg-white print:p-0">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Title & Date Window */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#0F8B8D] to-teal-700 text-white flex items-center justify-center shadow-xs">
                <CalendarDays className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
                    Planning & Production
                  </h1>
                  <span className="text-xs font-bangla text-[#2BA5B5] font-bold">
                    পরিকল্পনা ও উৎপাদন
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5">
                  <span>8-Day Window:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {dateRangeLabel} (Dhaka)
                  </span>
                </p>
              </div>
            </div>

            {/* TOP BAR VIEW TOGGLE (Two Buttons: Production Plan vs Line Summary) */}
            <div className="flex items-center gap-2">
              <div className="flex items-center p-1 rounded-2xl bg-gray-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 print:hidden">
                <button
                  type="button"
                  onClick={() => setViewMode('production_plan')}
                  className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    viewMode === 'production_plan'
                      ? 'bg-[#2BA5B5] text-white shadow-xs'
                      : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <ClipboardList className="w-4 h-4" />
                  <span>📋 Production Plan</span>
                </button>

                <button
                  type="button"
                  onClick={() => setViewMode('line_summary')}
                  className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    viewMode === 'line_summary'
                      ? 'bg-[#2BA5B5] text-white shadow-xs'
                      : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  <span>📊 Line Summary</span>
                </button>
              </div>
              <button
                type="button"
                onClick={toggleTheme}
                className="p-2 rounded-xl bg-gray-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
              >
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            </div>

            {/* Mode-specific Controls (Only visible in Production Plan mode) */}
            {viewMode === 'production_plan' && (
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
                <div className="relative min-w-[170px] sm:min-w-[200px]">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search PO, Style, Buyer..."
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

                {/* Buyer Multi-Select Filter */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setBuyerDropdownOpen((prev) => !prev)}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer shadow-xs ${
                      selectedBuyers.length > 0
                        ? 'bg-[#0F8B8D]/15 text-[#0F8B8D] dark:text-[#2BA5B5] border-[#0F8B8D]/40'
                        : 'bg-white dark:bg-black/20 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/15 hover:bg-slate-50 dark:hover:bg-white/5'
                    }`}
                    title="Filter by buyer"
                  >
                    <Filter className="w-3.5 h-3.5 text-[#0F8B8D]" />
                    <span>
                      {selectedBuyers.length === 0
                        ? 'All Buyers'
                        : selectedBuyers.length === 1
                        ? selectedBuyers[0]
                        : `${selectedBuyers.length} Buyers`}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 opacity-60" />
                  </button>

                  {buyerDropdownOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setBuyerDropdownOpen(false)}
                      />
                      <div className="absolute right-0 top-full mt-1.5 w-64 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl z-50 p-2.5 space-y-2">
                        <div className="flex items-center justify-between pb-1.5 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500">
                          <span>Filter Buyers ({allBuyers.length})</span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedBuyers([...allBuyers])}
                              className="text-[#0F8B8D] hover:underline cursor-pointer"
                            >
                              Select all
                            </button>
                            <span>·</span>
                            <button
                              type="button"
                              onClick={() => setSelectedBuyers([])}
                              className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                            >
                              Clear
                            </button>
                          </div>
                        </div>

                        <div className="max-h-52 overflow-y-auto space-y-1 scrollbar-custom pr-1">
                          {allBuyers.length === 0 ? (
                            <div className="text-xs text-slate-400 py-3 text-center">
                              No buyers found
                            </div>
                          ) : (
                            allBuyers.map((buyer) => {
                              const isChecked = selectedBuyers.includes(buyer);
                              return (
                                <label
                                  key={buyer}
                                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/80 cursor-pointer text-xs font-semibold text-slate-800 dark:text-slate-200 select-none"
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => {
                                      if (isChecked) {
                                        setSelectedBuyers((prev) =>
                                          prev.filter((b) => b !== buyer)
                                        );
                                      } else {
                                        setSelectedBuyers((prev) => [...prev, buyer]);
                                      }
                                    }}
                                    className="rounded text-[#0F8B8D] focus:ring-[#0F8B8D] w-3.5 h-3.5 accent-[#0F8B8D]"
                                  />
                                  <span className="truncate flex-1" title={buyer}>
                                    {buyer}
                                  </span>
                                </label>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Export Buttons (Print, Excel, PDF) */}
                <ExportButtons
                  orders={filteredOrders}
                  days={days}
                  dailyData={dailyData}
                  dateRangeLabel={dateRangeLabel}
                  unitLabel={unitLabel}
                  selectedBuyers={selectedBuyers}
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
            )}
          </div>

          {/* Sub Navigation Tabs (Only in Production Plan mode) */}
          {viewMode === 'production_plan' && (
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
                      ? 'bg-[#0F8B8D] text-white shadow-xs'
                      : 'bg-[#F3F4F6] text-[#374151] border border-[#D1D5DB] hover:bg-[#E5E7EB] dark:bg-white/5 dark:text-slate-300 dark:border-white/10'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Active</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/15 text-white">
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
                      ? 'bg-[#0F8B8D] text-white shadow-xs'
                      : 'bg-[#F3F4F6] text-[#374151] border border-[#D1D5DB] hover:bg-[#E5E7EB] dark:bg-white/5 dark:text-slate-300 dark:border-white/10'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Upcoming</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/15 text-white">
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
                      ? 'bg-[#0F8B8D] text-white shadow-xs'
                      : 'bg-[#F3F4F6] text-[#374151] border border-[#D1D5DB] hover:bg-[#E5E7EB] dark:bg-white/5 dark:text-slate-300 dark:border-white/10'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Done</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/15 text-white">
                    {counts.done}
                  </span>
                </button>
              </div>

              {/* Date Navigation Buttons: ‹ Earlier & Later › */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleEarlier}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-white/10 hover:bg-slate-100 dark:hover:bg-white/20 text-slate-800 dark:text-white border border-slate-300 dark:border-white/15 shadow-xs transition-all active:scale-95 cursor-pointer"
                  title="Move window 8 days earlier"
                >
                  ‹ Earlier
                </button>
                <span className="px-3 py-1 rounded-xl text-xs font-black tracking-wide bg-[#2BA5B5]/15 text-[#0F8B8D] dark:text-[#2BA5B5] border border-[#2BA5B5]/30">
                  {dateRangeLabel}
                </span>
                <button
                  type="button"
                  onClick={handleLater}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-white/10 hover:bg-slate-100 dark:hover:bg-white/20 text-slate-800 dark:text-white border border-slate-300 dark:border-white/15 shadow-xs transition-all active:scale-95 cursor-pointer"
                  title="Move window 8 days later"
                >
                  Later ›
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {selectedBuyers.length > 0 && (
                  <div className="text-xs font-semibold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/40 px-3 py-1 rounded-lg border border-teal-200 dark:border-teal-800 flex items-center gap-1.5 shadow-2xs">
                    <span>
                      Buyers ({selectedBuyers.length}): {selectedBuyers.join(', ')}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedBuyers([])}
                      className="underline hover:text-teal-900 dark:hover:text-white ml-1 cursor-pointer font-bold"
                    >
                      Clear
                    </button>
                  </div>
                )}

                {searchQuery && (
                  <div className="text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-3 py-1 rounded-lg border border-amber-200 dark:border-amber-800 flex items-center gap-1.5 shadow-2xs">
                    <span>
                      Filtering {filteredOrders.length} search matches for &quot;{searchQuery}&quot;
                    </span>
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="underline hover:text-amber-800 ml-1 cursor-pointer font-bold"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Print Only Header */}
        <div className="hidden print:block mb-4 border-b pb-2">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                RUPKATHA APPARELS LTD.
              </h1>
              <h2 className="text-sm font-semibold text-slate-700">
                {viewMode === 'production_plan'
                  ? `8-Day Line Plan (${unitLabel})${selectedBuyers.length > 0 ? ` — Buyers: ${selectedBuyers.join(', ')}` : ''}`
                  : `Line Summary (${unitLabel})`}
              </h2>
            </div>
            <div className="text-right text-xs text-slate-600">
              <p>Period: {dateRangeLabel}</p>
              <p>Date Printed: {new Date().toLocaleDateString()}</p>
            </div>
          </div>
        </div>

        {/* VIEW 1: Main Production Plan Matrix Table */}
        {viewMode === 'production_plan' ? (
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
            onEarlier={handleEarlier}
            onLater={handleLater}
            dateRangeLabel={dateRangeLabel}
          />
        ) : (
          /* VIEW 2: Full Standalone Line Summary View */
          <div className="space-y-4">
            <LineSummaryCard
              orders={orders}
              isStandalone={true}
              unitLabel={unitLabel}
              dateStr={dateRangeLabel}
            />
          </div>
        )}

        {/* Print 4 Signature Lines (Merchandise Manager, General Manager, Managing Director, Chairman) */}
        <div className="hidden print:grid grid-cols-4 gap-8 mt-16 pt-8 border-t border-slate-400 text-center text-xs font-semibold text-slate-800">
          <div>
            <div className="border-t border-dashed border-slate-400 pt-2">
              Merchandise Manager
            </div>
          </div>
          <div>
            <div className="border-t border-dashed border-slate-400 pt-2">
              General Manager
            </div>
          </div>
          <div>
            <div className="border-t border-dashed border-slate-400 pt-2">
              Managing Director
            </div>
          </div>
          <div>
            <div className="border-t border-dashed border-slate-400 pt-2">
              Chairman
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
