import React, { useState, useEffect, useMemo } from 'react';
import { Trash2, Calendar, Loader2 } from 'lucide-react';
import type { PlanningOrder, DayColumn, DailyCellType } from '../../types/planning';
import type { DailyMatrix } from '../../hooks/planning/usePlanningDaily';
import { getOrderStatus } from '../../lib/planningStatus';
import { useAuth } from '../../context/AuthContext';

// Helper component for Sub-Contract editable input cell with interactive suggestions dropdown and saving spinner
const SubContractCell: React.FC<{
  orderId: string;
  initialValue?: string | null;
  suggestions: string[];
  onSave: (val: string) => Promise<void>;
}> = ({ orderId, initialValue, suggestions, onSave }) => {
  const [val, setVal] = useState(initialValue || '');
  const [saving, setSaving] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    setVal(initialValue || '');
  }, [initialValue]);

  // Filter suggestions based on typed text (case-insensitive)
  const filteredSuggestions = useMemo(() => {
    const q = val.trim().toLowerCase();
    if (!q) return suggestions;
    return suggestions.filter((s) => s.toLowerCase().includes(q));
  }, [suggestions, val]);

  const handleCommit = async (customVal?: string) => {
    const targetVal = (customVal !== undefined ? customVal : val).trim();
    setIsOpen(false);
    if (targetVal === (initialValue || '')) return;
    setSaving(true);
    try {
      await onSave(targetVal);
    } finally {
      setSaving(false);
    }
  };

  const handleSelectSuggestion = (suggestion: string) => {
    setVal(suggestion);
    setIsOpen(false);
    handleCommit(suggestion);
  };

  return (
    <div ref={containerRef} className="relative flex items-center w-full">
      <input
        type="text"
        value={val}
        onFocus={() => {
          if (suggestions.length > 0) {
            setIsOpen(true);
          }
        }}
        onChange={(e) => {
          setVal(e.target.value);
          setIsOpen(true);
        }}
        onBlur={() => {
          setTimeout(() => {
            if (!containerRef.current?.contains(document.activeElement)) {
              setIsOpen(false);
              handleCommit();
            }
          }, 150);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            setIsOpen(false);
            handleCommit();
            (e.target as HTMLInputElement).blur();
          } else if (e.key === 'Tab') {
            setIsOpen(false);
            handleCommit();
          } else if (e.key === 'Escape') {
            setIsOpen(false);
          }
        }}
        placeholder="Sub-contract co."
        className="w-full px-2 py-1.5 text-[11px] font-semibold rounded-md bg-white dark:bg-slate-900 text-gray-900 dark:text-white border border-gray-200 dark:border-white/20 focus:outline-none focus:ring-1 focus:ring-[#0F8B8D] focus:border-[#0F8B8D] placeholder:text-gray-400 dark:placeholder:text-slate-500 placeholder:italic transition-all pr-6"
        title="Sub-contract company"
      />
      {saving && (
        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none">
          <Loader2 className="w-3.5 h-3.5 text-[#0F8B8D] animate-spin" />
        </span>
      )}

      {/* Floating Suggestions Dropdown */}
      {isOpen && filteredSuggestions.length > 0 && (
        <div className="absolute left-0 top-full mt-1 w-full min-w-[140px] max-h-44 overflow-y-auto bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 shadow-xl z-50 py-1 text-left scrollbar-custom">
          {filteredSuggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelectSuggestion(suggestion);
              }}
              className="w-full text-left px-2.5 py-1.5 text-[11px] font-bold text-slate-800 dark:text-slate-200 hover:bg-[#0F8B8D]/15 hover:text-[#0F8B8D] dark:hover:bg-teal-950/50 dark:hover:text-teal-300 transition-colors flex items-center justify-between cursor-pointer"
            >
              <span className="truncate">{suggestion}</span>
              {suggestion === val.trim() && (
                <span className="text-[9px] text-[#0F8B8D] font-extrabold ml-1">✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

interface LinePlanTableProps {
  orders: PlanningOrder[];
  days: DayColumn[];
  dailyData: DailyMatrix;
  flashedCells: Record<string, boolean>;
  savingCells: Record<string, boolean>;
  searchQuery: string;
  allSubContracts?: string[];
  onUpdateOrder: (
    orderId: string,
    updates: Partial<Omit<PlanningOrder, 'id' | 'is_done' | 'total_input' | 'total_output'>>
  ) => Promise<void>;
  onDeleteOrder: (orderId: string) => Promise<void>;
  onUpsertDailyCell: (
    orderId: string,
    dateStr: string,
    type: DailyCellType,
    val: string | number | null
  ) => Promise<void>;
  onEarlier?: () => void;
  onLater?: () => void;
  dateRangeLabel?: string;
}

const LINE_GROUP_CONFIGS: Record<string, { label: string; borderClass: string; bgHeader: string; textHeader: string }> = {
  'Line-1': { label: 'LINE 1', borderClass: 'border-blue-600', bgHeader: 'bg-blue-50 dark:bg-blue-900/40', textHeader: 'text-blue-800 dark:text-blue-200' },
  'Line-2': { label: 'LINE 2', borderClass: 'border-purple-600', bgHeader: 'bg-purple-50 dark:bg-purple-900/40', textHeader: 'text-purple-800 dark:text-purple-200' },
  'Line-3': { label: 'LINE 3', borderClass: 'border-orange-600', bgHeader: 'bg-orange-50 dark:bg-orange-900/40', textHeader: 'text-orange-800 dark:text-orange-200' },
  'Line-4': { label: 'LINE 4', borderClass: 'border-teal-600', bgHeader: 'bg-teal-50 dark:bg-teal-900/40', textHeader: 'text-teal-800 dark:text-teal-200' },
  'No line yet': { label: 'NO LINE YET', borderClass: 'border-slate-500', bgHeader: 'bg-slate-50 dark:bg-slate-800/60', textHeader: 'text-slate-700 dark:text-slate-200' },
};

export const LinePlanTable: React.FC<LinePlanTableProps> = ({
  orders,
  days,
  dailyData,
  flashedCells,
  savingCells,
  searchQuery,
  allSubContracts,
  onUpdateOrder,
  onDeleteOrder,
  onUpsertDailyCell,
  onEarlier,
  onLater,
  dateRangeLabel,
}) => {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Local storage / state for cutting daily entries
  const [cuttingDaily, setCuttingDaily] = useState<Record<string, Record<string, number>>>(() => {
    try {
      const saved = localStorage.getItem('rupkatha_planning_cutting_daily');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Local storage / state for remarks (typing kore leka jabe)
  const [orderRemarks, setOrderRemarks] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('rupkatha_planning_order_remarks');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const handleUpdateRemarks = (orderId: string, val: string) => {
    setOrderRemarks((prev) => {
      const next = { ...prev, [orderId]: val };
      try {
        localStorage.setItem('rupkatha_planning_order_remarks', JSON.stringify(next));
      } catch (e) {
        console.error(e);
      }
      return next;
    });

    try {
      onUpdateOrder(orderId, { remarks: val } as any).catch(() => {});
    } catch {
      // ignore
    }
  };

  const getOrderCuttingForDate = (order: PlanningOrder, dateStr: string): number | null => {
    const fromMap = cuttingDaily[order.id]?.[dateStr];
    if (fromMap !== undefined) {
      return fromMap > 0 ? fromMap : null;
    }
    // Fallback: if order has start_date matching dateStr and cutting_qty > 0
    if (order.start_date && order.start_date === dateStr && Number(order.cutting_qty || 0) > 0) {
      return Number(order.cutting_qty);
    }
    return null;
  };

  const handleUpdateCuttingDaily = (order: PlanningOrder, dateStr: string, rawVal: string) => {
    const numVal = rawVal.trim() === '' ? 0 : Math.max(0, parseInt(rawVal, 10) || 0);
    const orderId = order.id;

    setCuttingDaily((prev) => {
      const orderMap = { ...(prev[orderId] || {}) };
      // If order previously had cutting_qty on order.start_date but not yet in orderMap
      if (order.start_date && Number(order.cutting_qty || 0) > 0 && !orderMap[order.start_date]) {
        orderMap[order.start_date] = Number(order.cutting_qty);
      }

      if (numVal === 0) {
        delete orderMap[dateStr];
      } else {
        orderMap[dateStr] = numVal;
      }
      const next = { ...prev, [orderId]: orderMap };
      try {
        localStorage.setItem('rupkatha_planning_cutting_daily', JSON.stringify(next));
      } catch (e) {
        console.error(e);
      }

      const totalCut = Object.values(orderMap).reduce((s, v) => s + v, 0);
      onUpdateOrder(orderId, {
        cutting_qty: totalCut,
        start_date: orderMap[dateStr] ? dateStr : order.start_date,
      });

      return next;
    });
  };

  // Distinct previous sub_contract companies for auto-suggestions
  const distinctSubContracts = useMemo(() => {
    const set = new Set<string>();
    if (allSubContracts) {
      allSubContracts.forEach((s) => {
        const trimmed = (s || '').trim();
        if (trimmed) set.add(trimmed);
      });
    }
    orders.forEach((o) => {
      const s = (o.sub_contract || '').trim();
      if (s) set.add(s);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [orders, allSubContracts]);

  // Compute total Order Qty grouped by PO across all colour rows
  const poTotalQtyMap = useMemo(() => {
    const map: Record<string, number> = {};
    orders.forEach((o) => {
      map[o.po] = (map[o.po] || 0) + Number(o.order_qty || 0);
    });
    return map;
  }, [orders]);

  // Group orders by line_no and sort each group by start_date ascending (nulls at bottom)
  const groupedOrders = useMemo(() => {
    const map: Record<string, PlanningOrder[]> = {
      'Line-1': [],
      'Line-2': [],
      'Line-3': [],
      'Line-4': [],
      'No line yet': [],
    };
    orders.forEach((o) => {
      const line = (o.line_no || '').trim();
      if (line && map[line]) {
        map[line].push(o);
      } else if (line) {
        if (!map[line]) map[line] = [];
        map[line].push(o);
      } else {
        map['No line yet'].push(o);
      }
    });

    const sortGroup = (arr: PlanningOrder[]) => {
      return [...arr].sort((a, b) => {
        const dateA = a.start_date ? new Date(a.start_date).getTime() : NaN;
        const dateB = b.start_date ? new Date(b.start_date).getTime() : NaN;
        const hasA = !isNaN(dateA);
        const hasB = !isNaN(dateB);

        if (hasA && hasB) return dateA - dateB;
        if (hasA && !hasB) return -1;
        if (!hasA && hasB) return 1;
        return 0;
      });
    };

    Object.keys(map).forEach((k) => {
      map[k] = sortGroup(map[k]);
    });

    return map;
  }, [orders]);

  // Page-wide sequential SL map (1, 2, 3...)
  const orderSlMap = useMemo(() => {
    const map = new Map<string, number>();
    let counter = 1;
    ['Line-1', 'Line-2', 'Line-3', 'Line-4', 'No line yet'].forEach((lineName) => {
      if (groupedOrders[lineName]) {
        groupedOrders[lineName].forEach((o) => {
          map.set(o.id, counter++);
        });
      }
    });
    Object.keys(groupedOrders).forEach((lineName) => {
      if (!['Line-1', 'Line-2', 'Line-3', 'Line-4', 'No line yet'].includes(lineName)) {
        groupedOrders[lineName].forEach((o) => {
          if (!map.has(o.id)) {
            map.set(o.id, counter++);
          }
        });
      }
    });
    return map;
  }, [groupedOrders]);

  // Highlight helper for search query
  const highlightMatch = (text?: string | null) => {
    if (!text) return '-';
    if (!searchQuery || !searchQuery.trim()) return text;

    const query = searchQuery.trim().toLowerCase();
    const str = String(text);
    const index = str.toLowerCase().indexOf(query);

    if (index === -1) return str;

    const before = str.substring(0, index);
    const match = str.substring(index, index + query.length);
    const after = str.substring(index + query.length);

    return (
      <>
        {before}
        <mark className="bg-amber-300 text-slate-950 font-bold px-0.5 rounded shadow-xs">
          {match}
        </mark>
        {after}
      </>
    );
  };

  const handleDelete = async (orderId: string) => {
    setIsDeleting(true);
    try {
      await onDeleteOrder(orderId);
      setConfirmDeleteId(null);
    } finally {
      setIsDeleting(false);
    }
  };

  if (orders.length === 0) {
    return (
      <div className="py-16 text-center bg-white dark:bg-[#103A40]/40 rounded-2xl border border-slate-200 dark:border-slate-700 p-8 shadow-xs">
        <div className="w-12 h-12 mx-auto rounded-2xl bg-[#2BA5B5]/10 text-[#2BA5B5] flex items-center justify-center mb-3">
          <Calendar className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
          No planning orders found
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          {searchQuery
            ? `No records matching "${searchQuery}". Clear the search or add a new order.`
            : 'There are currently no orders in this tab. Click "+ Add Order" to start planning.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="px-4 py-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 print:hidden shadow-sm">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
          <span className="w-2 h-2 rounded-full bg-teal-600"></span>
          <span>{orders.length} Orders</span>
          <span className="text-slate-500 dark:text-slate-400">·</span>
          <span className="text-slate-500 dark:text-slate-400">8-Day Window</span>
        </div>

        {onEarlier && onLater && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onEarlier}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 shadow-sm transition-all active:scale-95 cursor-pointer"
              title="Move window 8 days earlier"
            >
              ‹ Earlier
            </button>
            <span className="px-3 py-1 rounded-xl text-xs font-black tracking-wide bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-400 border border-teal-200 dark:border-teal-800">
              {dateRangeLabel}
            </span>
            <button
              type="button"
              onClick={onLater}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 shadow-sm transition-all active:scale-95 cursor-pointer"
              title="Move window 8 days later"
            >
              Later ›
            </button>
          </div>
        )}
      </div>

      {/* Render each line group in its own boxed card */}
      {Object.entries(groupedOrders).map(([lineName, groupOrders]) => {
        if (groupOrders.length === 0) return null;

        const config = LINE_GROUP_CONFIGS[lineName] || {
          label: lineName.toUpperCase(),
          borderClass: 'border-slate-500',
          bgHeader: 'bg-slate-100',
          textHeader: 'text-slate-800',
        };

        // Group stats for header strip
        let groupTotalQty = 0;
        let groupOutput = 0;
        const statusCounts: Record<string, number> = {};

        groupOrders.forEach((o) => {
          groupTotalQty += Number(o.order_qty || 0);
          groupOutput += Number(o.total_output || 0);
          const st = getOrderStatus(o);
          statusCounts[st.label] = (statusCounts[st.label] || 0) + 1;
        });

        const statusSummaryText = Object.entries(statusCounts)
          .map(([lbl, count]) => `${count} ${lbl}`)
          .join(', ');

        return (
          <div
            key={lineName}
            className={`rounded-xl border-2 ${config.borderClass} bg-white dark:bg-slate-900 overflow-hidden mb-6 shadow-sm`}
          >
            {/* Colored Box Header Strip */}
            <div className={`${config.bgHeader} ${config.textHeader} px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs font-bold border-b ${config.borderClass}`}>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-black/10 dark:bg-black/20 font-black tracking-wider text-[11px]">
                  {config.label}
                </span>
                <span>·</span>
                <span>{groupOrders.length} {groupOrders.length === 1 ? 'order' : 'orders'}</span>
                <span>·</span>
                <span>Total Qty: {groupTotalQty.toLocaleString()}</span>
                <span>·</span>
                <span>Output: {groupOutput.toLocaleString()}</span>
              </div>
              <div className="text-[11px] text-gray-700 dark:text-slate-200 font-medium">
                Status: {statusSummaryText}
              </div>
            </div>

            {/* Table inside Box Card with cell borders and border-collapse */}
            <div className="overflow-x-auto scrollbar-custom">
              <table className="w-full text-left border-collapse text-[11px] text-gray-900 dark:text-gray-100">
                {/* Header */}
                <thead className="sticky top-0 z-30 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700 select-none text-[12px] font-bold tracking-wider">
                  <tr className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                    <th
                      colSpan={11}
                      className="sticky left-0 z-40 bg-white dark:bg-slate-900 px-3 py-1 text-left text-[11px] text-slate-700 dark:text-slate-300 border-[1.5px] border-gray-200 dark:border-slate-700 uppercase font-bold"
                    >
                      Order Particulars ({config.label})
                    </th>
                    <th
                      colSpan={days.length}
                      className="bg-white dark:bg-slate-800 px-2 py-1 text-center border-[1.5px] border-gray-200 dark:border-slate-700"
                    >
                      <div className="flex items-center justify-center gap-2 print:hidden">
                        {onEarlier && (
                          <button
                            type="button"
                            onClick={onEarlier}
                            className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-900 dark:text-white border border-gray-200 dark:border-slate-600 shadow-2xs transition-colors cursor-pointer"
                            title="Move 8 days earlier"
                          >
                            ‹ Earlier
                          </button>
                        )}
                        <span className="font-extrabold text-[11px] text-gray-900 dark:text-white tracking-wide">
                          {dateRangeLabel}
                        </span>
                        {onLater && (
                          <button
                            type="button"
                            onClick={onLater}
                            className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-900 dark:text-white border border-gray-200 dark:border-slate-600 shadow-2xs transition-colors cursor-pointer"
                            title="Move 8 days later"
                          >
                            Later ›
                          </button>
                        )}
                      </div>
                      <div className="hidden print:block font-bold text-[10px] text-slate-800">
                        {dateRangeLabel}
                      </div>
                    </th>
                    <th
                      colSpan={isAdmin ? 5 : 4}
                      className="bg-white dark:bg-slate-900 px-2 py-1 text-center text-[11px] text-gray-700 dark:text-slate-300 uppercase font-bold border-[1.5px] border-gray-200 dark:border-slate-700"
                    >
                      Totals, Balance, Remarks & Status
                    </th>
                  </tr>
                  <tr>
                    {/* Sticky Column 1: SL */}
                    <th className="sticky left-0 z-40 bg-white dark:bg-[#082024] px-2 py-2.5 text-center w-10 border-[1.5px] border-gray-200 dark:border-slate-700 text-[#1F2937] dark:text-slate-200">
                      SL
                    </th>

                    {/* Sticky Column 2: Buyer */}
                    <th className="sticky left-10 z-40 bg-white dark:bg-[#082024] px-2.5 py-2.5 min-w-[95px] max-w-[120px] border-[1.5px] border-gray-200 dark:border-slate-700 text-[#1F2937] dark:text-slate-200">
                      BUYER
                    </th>

                    {/* Sticky Column 3: PO */}
                    <th className="sticky left-[135px] z-40 bg-white dark:bg-[#082024] px-2.5 py-2.5 min-w-[95px] border-[1.5px] border-gray-200 dark:border-slate-700 text-[#1F2937] dark:text-slate-200">
                      PO
                    </th>

                    {/* Sticky Column 4: Style */}
                    <th className="sticky left-[230px] z-40 bg-white dark:bg-[#082024] px-2.5 py-2.5 min-w-[105px] border-[1.5px] border-gray-200 dark:border-slate-700 text-[#1F2937] dark:text-slate-200 shadow-[4px_0_6px_-2px_rgba(0,0,0,0.06)]">
                      STYLE
                    </th>

                    {/* Colour */}
                    <th className="px-2 py-2.5 min-w-[85px] border-[1.5px] border-gray-200 dark:border-slate-700 text-[#1F2937] dark:text-slate-200">
                      COLOUR
                    </th>

                    {/* Wash */}
                    <th className="px-2 py-2.5 min-w-[75px] border-[1.5px] border-gray-200 dark:border-slate-700 text-[#1F2937] dark:text-slate-200">
                      WASH
                    </th>

                    {/* Line */}
                    <th className="px-2 py-2.5 min-w-[85px] border-[1.5px] border-gray-200 dark:border-slate-700 text-[#1F2937] dark:text-slate-200">
                      LINE
                    </th>

                    {/* Sub-Contract */}
                    <th className="px-2 py-2.5 min-w-[120px] max-w-[140px] border-[1.5px] border-gray-200 dark:border-slate-700 text-[#1F2937] dark:text-slate-200">
                      SUB-CONTRACT
                    </th>

                    {/* Start Date */}
                    <th className="px-2 py-2.5 min-w-[105px] border-[1.5px] border-gray-200 dark:border-slate-700 text-[#1F2937] dark:text-slate-200">
                      START DATE
                    </th>

                    {/* Qty */}
                    <th className="px-2 py-2.5 text-right min-w-[65px] border-[1.5px] border-gray-200 dark:border-slate-700 text-[#1F2937] dark:text-slate-200">
                      QTY
                    </th>

                    {/* Type */}
                    <th className="px-2 py-2.5 text-center min-w-[85px] border-[1.5px] border-gray-200 dark:border-slate-700 bg-[#E5E7EB] dark:bg-black/20 text-[#1F2937] dark:text-slate-200">
                      TYPE
                    </th>

                    {/* 8 Day Columns - Dates Only */}
                    {days.map((day) => (
                      <th
                        key={day.dateStr}
                        className={`px-1 py-2 text-center min-w-[50px] border-[1.5px] border-gray-200 dark:border-slate-700 ${
                          day.isFriday
                            ? 'text-[#DC2626] font-extrabold bg-rose-50/50 dark:bg-rose-950/20'
                            : day.isToday
                            ? 'bg-teal-50 dark:bg-teal-950/60 text-[#0F8B8D] dark:text-teal-300'
                            : 'text-[#1F2937] dark:text-slate-200'
                        }`}
                      >
                        <div className="leading-tight text-[11px] font-bold">
                          {day.displayDay}
                        </div>
                      </th>
                    ))}

                    {/* Total */}
                    <th className="px-2 py-2.5 text-right min-w-[65px] border-[1.5px] border-gray-200 dark:border-slate-700 text-[#1F2937] dark:text-slate-200">
                      TOTAL
                    </th>

                    {/* Balance */}
                    <th className="px-2 py-2.5 text-right min-w-[120px] border-[1.5px] border-gray-200 dark:border-slate-700 text-[#1F2937] dark:text-slate-200">
                      BALANCE
                    </th>

                    {/* Remarks - typing kore leka jabe */}
                    <th className="px-3 py-2.5 text-center min-w-[160px] max-w-[220px] border-[1.5px] border-gray-200 dark:border-slate-700 text-[#1F2937] dark:text-slate-200">
                      REMARKS
                    </th>

                    {/* Status */}
                    <th className="px-3 py-2.5 text-center min-w-[125px] border-[1.5px] border-gray-200 dark:border-slate-700 text-[#1F2937] dark:text-slate-200">
                      STATUS
                    </th>

                    {/* Action */}
                    {isAdmin && (
                      <th className="px-2 py-2.5 text-center w-9 border-[1.5px] border-gray-200 dark:border-slate-700 text-[#1F2937] dark:text-slate-200">
                        ACT
                      </th>
                    )}
                  </tr>
                </thead>

                {/* Table Body */}
                <tbody className="divide-y divide-[#D1D5DB] dark:divide-white/10">
                  {groupOrders.map((order, index) => {
                    const status = getOrderStatus(order);
                    const orderId = order.id;

                    const totalInput = Number(order.total_input || 0);
                    const totalOutput = Number(order.total_output || 0);
                    const totalWashSent = Number(order.total_wash_sent || 0);
                    const totalWashRecv = Number(order.total_wash_recv || 0);
                    const totalFinishing = Number(order.total_finishing || 0);

                    const rowOrderQty = Number(order.order_qty || 0);
                    const cuttingQty = Number(order.cutting_qty || 0);

                    // Whole PO total Order Qty
                    const poTotalOrderQty = poTotalQtyMap[order.po] || rowOrderQty;

                    // Extra % = round((cutting_qty - order_qty) / order_qty * 100)
                    const extraPct =
                      rowOrderQty > 0
                        ? Math.round(((cuttingQty - rowOrderQty) / rowOrderQty) * 100)
                        : 0;

                    // Cut status
                    let cutStatusLabel = 'Not cut';
                    let cutStatusBadgeBg = 'bg-[#6B7280] dark:bg-slate-700';
                    let cutBorderColor = '#6B7280';
                    if (cuttingQty >= rowOrderQty && rowOrderQty > 0) {
                      cutStatusLabel = 'Cut done';
                      cutStatusBadgeBg = 'bg-[#16A34A] dark:bg-emerald-600';
                      cutBorderColor = '#16A34A';
                    } else if (cuttingQty > 0) {
                      cutStatusLabel = 'Cutting';
                      cutStatusBadgeBg = 'bg-[#D97706] dark:bg-amber-600';
                      cutBorderColor = '#D97706';
                    }

                    // Balances
                    const inputBalance = cuttingQty - totalInput;
                    const outputBalance = totalInput - totalOutput;
                    const washRemaining = cuttingQty - totalWashSent;
                    const washRecvRemaining = totalWashSent - totalWashRecv;
                    const finishingRemaining = totalWashRecv - totalFinishing;

                    // Wash & Finishing Right Column Styling
                    const washSentColor =
                      cuttingQty > 0
                        ? totalWashSent >= cuttingQty
                          ? 'text-[#16A34A] dark:text-emerald-400 font-extrabold'
                          : 'text-[#D97706] dark:text-amber-400 font-bold'
                        : 'text-gray-900 dark:text-slate-300 font-bold';

                    const washRemColor =
                      washRemaining === 0
                        ? 'text-[#16A34A] dark:text-emerald-400 font-bold'
                        : washRemaining < 0
                        ? 'text-[#D97706] dark:text-amber-400 font-extrabold'
                        : 'text-[#DC2626] dark:text-rose-400 font-extrabold';

                    const washRecvColor =
                      totalWashSent > 0
                        ? totalWashRecv >= totalWashSent
                          ? 'text-[#16A34A] dark:text-emerald-400 font-extrabold'
                          : 'text-[#D97706] dark:text-amber-400 font-bold'
                        : 'text-gray-900 dark:text-slate-300 font-bold';

                    const washRecvRemColor =
                      washRecvRemaining > 0
                        ? 'text-[#DC2626] dark:text-rose-400 font-extrabold'
                        : 'text-[#16A34A] dark:text-emerald-400 font-bold';

                    const finishingColor =
                      totalWashRecv > 0
                        ? totalFinishing >= totalWashRecv
                          ? 'text-[#16A34A] dark:text-emerald-400 font-extrabold'
                          : 'text-[#D97706] dark:text-amber-400 font-bold'
                        : 'text-gray-900 dark:text-slate-300 font-bold';

                    const finishingRemColor =
                      finishingRemaining > 0
                        ? 'text-[#DC2626] dark:text-rose-400 font-extrabold'
                        : 'text-[#16A34A] dark:text-emerald-400 font-bold';

                    return (
                      <React.Fragment key={orderId}>
                        {/* ========================================================
                            SUB-ROW 1: CUTTING (Starts order, merges left & right)
                           ======================================================== */}
                        <tr className="transition-colors bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100/80 dark:hover:bg-white/5 border-t border-gray-200 dark:border-slate-700">
                          {/* Sticky Column 1: SL (Rowspan 6) with Line-color left accent */}
                          <td
                            rowSpan={6}
                            className={`sticky left-0 z-20 px-2 py-1.5 text-center font-bold text-gray-700 dark:text-slate-300 border-[1.5px] border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 border-l-[4px] ${config.borderClass}`}
                          >
                            {orderSlMap.get(orderId) || (index + 1)}
                          </td>

                          {/* Sticky Column 2: Buyer (Rowspan 6) */}
                          <td
                            rowSpan={6}
                            className="sticky left-10 z-20 px-2.5 py-1.5 font-bold text-gray-900 dark:text-gray-100 border-[1.5px] border-gray-200 dark:border-slate-700 whitespace-nowrap max-w-[120px] truncate bg-white dark:bg-slate-800"
                            title={order.buyer || '-'}
                          >
                            {order.buyer && order.buyer.trim() ? highlightMatch(order.buyer) : '-'}
                          </td>

                          {/* Sticky Column 3: PO (Rowspan 6) */}
                          <td
                            rowSpan={6}
                            className="sticky left-[135px] z-20 px-2.5 py-1.5 font-extrabold text-gray-900 dark:text-white border-[1.5px] border-gray-200 dark:border-slate-700 whitespace-nowrap bg-white dark:bg-slate-800"
                          >
                            {highlightMatch(order.po)}
                          </td>

                          {/* Sticky Column 4: Style (Rowspan 6) */}
                          <td
                            rowSpan={6}
                            className="sticky left-[230px] z-20 px-2.5 py-1.5 font-medium text-gray-700 dark:text-slate-300 border-[1.5px] border-gray-200 dark:border-slate-700 max-w-[130px] truncate bg-white dark:bg-slate-800 shadow-[4px_0_6px_-2px_rgba(0,0,0,0.06)]"
                            title={order.style || ''}
                          >
                            {highlightMatch(order.style)}
                          </td>

                          {/* Column 5: Colour (Rowspan 6) */}
                          <td
                            rowSpan={6}
                            className="px-2 py-1.5 text-gray-900 dark:text-slate-300 border-[1.5px] border-gray-200 dark:border-slate-700 font-bold text-[13px] whitespace-nowrap bg-white dark:bg-slate-800"
                          >
                            {highlightMatch(order.colour) || '-'}
                          </td>

                          {/* Column 6: Wash (Rowspan 6) */}
                          <td
                            rowSpan={6}
                            className="px-2 py-1.5 text-gray-900 dark:text-slate-400 border-[1.5px] border-gray-200 dark:border-slate-700 font-bold text-[13px] bg-white dark:bg-slate-800"
                          >
                            {order.wash || '-'}
                          </td>

                          {/* Column 7: Line (Rowspan 6) */}
                          <td
                            rowSpan={6}
                            className="px-1 py-1 border-[1.5px] border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                          >
                            <select
                              value={order.line_no || ''}
                              onChange={(e) =>
                                onUpdateOrder(orderId, { line_no: e.target.value })
                              }
                              className="w-full px-2 py-1.5 text-[13px] font-bold rounded-md border border-gray-200 dark:border-white/20 focus:border-[#0F8B8D] bg-white dark:bg-slate-900 transition-all cursor-pointer text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0F8B8D]"
                            >
                              <option value="">No line</option>
                              <option value="Line-1">Line-1</option>
                              <option value="Line-2">Line-2</option>
                              <option value="Line-3">Line-3</option>
                              <option value="Line-4">Line-4</option>
                            </select>
                          </td>

                          {/* Column 8: Sub-Contract (Rowspan 6) */}
                          <td
                            rowSpan={6}
                            className="px-1.5 py-1 border-[1.5px] border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 min-w-[120px] max-w-[140px]"
                          >
                            <SubContractCell
                              orderId={orderId}
                              initialValue={order.sub_contract}
                              suggestions={distinctSubContracts}
                              onSave={async (val) => {
                                await onUpdateOrder(orderId, { sub_contract: val });
                              }}
                            />
                          </td>

                          {/* Column 9: Start Date (Rowspan 6) */}
                          <td
                            rowSpan={6}
                            className="px-1 py-1 border-[1.5px] border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                          >
                            <input
                              type="date"
                              value={order.start_date || ''}
                              onChange={(e) =>
                                onUpdateOrder(orderId, {
                                  start_date: e.target.value || null,
                                })
                              }
                              className="w-full px-2.5 py-1.5 text-[13px] font-semibold rounded-md bg-white dark:bg-slate-900 text-gray-900 dark:text-white border border-gray-200 dark:border-white/20 focus:outline-none focus:ring-2 focus:ring-[#0F8B8D] focus:border-[#0F8B8D] cursor-pointer placeholder:text-[#6B7280]"
                            />
                          </td>

                          {/* Column 10: Qty (Rowspan 6) */}
                          <td
                            rowSpan={6}
                            className="px-2 py-1.5 text-right font-extrabold text-gray-900 dark:text-slate-200 border-[1.5px] border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                          >
                            {rowOrderQty.toLocaleString()}
                          </td>

                          {/* TYPE: CUTTING with Cut-Status color left stripe */}
                          <td
                            className="px-1.5 py-1 text-center font-bold text-[10px] text-white bg-slate-700 dark:bg-slate-800 border-[1.5px] border-gray-200 dark:border-slate-700 border-l-[6px]"
                            style={{ borderLeftColor: cutBorderColor }}
                          >
                            <span className="font-black tracking-wide">CUTTING</span>
                          </td>

                          {/* 8 Daily CUTTING cells (User can enter daily cutting numbers here!) */}
                          {days.map((day) => {
                            const cutVal = getOrderCuttingForDate(order, day.dateStr);

                            return (
                              <td
                                key={`cut_${day.dateStr}`}
                                className={`p-0 text-center relative border-[1.5px] border-gray-200 dark:border-slate-700 transition-colors ${
                                  day.isFriday
                                    ? 'bg-[#F3F4F6] dark:bg-slate-800/80'
                                    : 'bg-white/60 dark:bg-slate-900/60'
                                }`}
                              >
                                <input
                                  type="number"
                                  min="0"
                                  placeholder="-"
                                  defaultValue={cutVal ?? ''}
                                  key={`cut_${orderId}_${day.dateStr}_${cutVal ?? 'empty'}`}
                                  onBlur={(e) => {
                                    handleUpdateCuttingDaily(order, day.dateStr, e.target.value);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      (e.target as HTMLInputElement).blur();
                                    }
                                  }}
                                  className="w-full h-7 px-0.5 text-center text-[10px] font-bold text-gray-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 bg-transparent focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-[#0F8B8D] transition-all"
                                  title={`Daily cutting on ${day.displayDay}`}
                                />
                              </td>
                            );
                          })}

                          {/* Total (CUTTING) */}
                          <td className="px-2 py-1 text-right font-extrabold text-gray-900 dark:text-white border-[1.5px] border-gray-200 dark:border-slate-700 bg-slate-100/70 dark:bg-slate-800">
                            {cuttingQty.toLocaleString()}
                          </td>

                          {/* Smart Combined BALANCE & STATUS (CUTTING Row) */}
                          <td className="px-2 py-1 text-right border-[1.5px] border-gray-200 dark:border-slate-700 bg-slate-100/70 dark:bg-slate-800">
                            {cuttingQty === 0 ? (
                              <span className="text-gray-400 font-semibold text-[10px]">- Not cut</span>
                            ) : (
                              <div className="flex flex-col items-end leading-tight">
                                <div className="font-black text-gray-900 dark:text-white text-[11px]">
                                  {cuttingQty.toLocaleString()}{' '}
                                  <span
                                    className={`font-bold text-[10px] ${
                                      extraPct >= 0
                                        ? 'text-[#16A34A] dark:text-emerald-400'
                                        : 'text-[#DC2626] dark:text-rose-400'
                                    }`}
                                  >
                                    ({extraPct >= 0 ? `+${extraPct}%` : `${extraPct}%`})
                                  </span>
                                </div>
                                <span
                                  className={`inline-block mt-0.5 px-2 py-0.2 rounded-full text-[9px] font-bold text-white whitespace-nowrap ${cutStatusBadgeBg}`}
                                >
                                  {cutStatusLabel}
                                </span>
                              </div>
                            )}
                          </td>

                          {/* Merged Column: REMARKS (Rowspan 6) - typing kore leka jabe */}
                          <td
                            rowSpan={6}
                            className="p-1.5 border-[1.5px] border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 min-w-[160px] max-w-[220px]"
                          >
                            <textarea
                              value={orderRemarks[orderId] ?? order.remarks ?? ''}
                              onChange={(e) => handleUpdateRemarks(orderId, e.target.value)}
                              placeholder="Type remarks..."
                              rows={4}
                              className="w-full h-full min-h-[95px] p-2 text-[11px] font-medium leading-relaxed text-gray-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-900/60 rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-1 focus:ring-[#0F8B8D] focus:border-[#0F8B8D] resize-none transition-all placeholder:text-slate-400 placeholder:italic"
                              title="Type remarks for this order"
                            />
                          </td>

                          {/* Status Badge (Rowspan 6) */}
                          <td
                            rowSpan={6}
                            className={`px-2 py-1 text-center border-[1.5px] border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 ${status.rowTintClass}`}
                          >
                            <span
                              className={`inline-block px-2.5 py-1 rounded-full text-[10px] border whitespace-nowrap font-bold shadow-2xs ${status.badgeClass}`}
                            >
                              {status.label}
                            </span>
                          </td>

                          {/* Admin Delete Action (Rowspan 6) */}
                          {isAdmin && (
                            <td
                              rowSpan={6}
                              className={`px-1 py-1 text-center border-[1.5px] border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 ${status.rowTintClass}`}
                            >
                              {confirmDeleteId === orderId ? (
                                <div className="flex flex-col items-center gap-1 p-1 bg-white dark:bg-slate-900 rounded border border-rose-300 shadow-md">
                                  <span className="text-[9px] text-rose-600 font-bold">
                                    Del?
                                  </span>
                                  <div className="flex gap-1">
                                    <button
                                      type="button"
                                      disabled={isDeleting}
                                      onClick={() => handleDelete(orderId)}
                                      className="px-1 py-0.5 bg-rose-600 text-white rounded text-[8px] font-bold"
                                    >
                                      {isDeleting ? '...' : 'Y'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeleteId(null)}
                                      className="px-1 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-[8px] font-bold"
                                    >
                                      N
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(orderId)}
                                  className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                                  title="Delete order"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </td>
                          )}
                        </tr>

                        {/* ========================================================
                            SUB-ROW 2: INPUT
                           ======================================================== */}
                        <tr className="transition-colors bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-white/5 border-t border-gray-200 dark:border-slate-700">
                          {/* TYPE: INPUT with Blue left border */}
                          <td className="px-1.5 py-1 text-center font-bold text-[10px] text-white bg-blue-600 dark:bg-blue-800 border-[1.5px] border-gray-200 dark:border-slate-700 border-l-[6px] border-l-[#2563EB] dark:border-l-blue-500">
                            INPUT
                          </td>

                          {/* 8 Daily INPUT cells */}
                          {days.map((day) => {
                            const cellKey = `${orderId}_${day.dateStr}_input`;
                            const flashKey = `${orderId}_${day.dateStr}`;
                            const isFlashed = Boolean(flashedCells[flashKey]);
                            const isSaving = Boolean(savingCells[cellKey]);
                            const cellValue =
                              dailyData[orderId]?.[day.dateStr]?.input_qty;

                            return (
                              <td
                                key={`in_${day.dateStr}`}
                                className={`p-0 text-center relative border-[1.5px] border-gray-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-800 ${
                                  day.isFriday
                                    ? 'bg-[#F3F4F6] dark:bg-slate-800/80'
                                    : isFlashed
                                    ? 'bg-emerald-300 dark:bg-emerald-700'
                                    : ''
                                }`}
                              >
                                <input
                                  type="number"
                                  min="0"
                                  data-cell-key={cellKey}
                                  placeholder="-"
                                  defaultValue={cellValue ?? ''}
                                  key={`input_${orderId}_${day.dateStr}_${cellValue ?? 'empty'}`}
                                  onBlur={(e) => {
                                    const val = e.target.value.trim();
                                    onUpsertDailyCell(
                                      orderId,
                                      day.dateStr,
                                      'input',
                                      val
                                    );
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      (e.target as HTMLInputElement).blur();
                                    }
                                  }}
                                  className="w-full h-7 px-0.5 text-center text-[10px] font-bold text-gray-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 bg-transparent focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-[#0F8B8D] transition-all"
                                />
                                {isSaving && (
                                  <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-[#0F8B8D] animate-ping" />
                                )}
                              </td>
                            );
                          })}

                          {/* Total (INPUT) */}
                          <td className="px-2 py-1 text-right font-extrabold text-gray-900 dark:text-white border-[1.5px] border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                            {totalInput.toLocaleString()}
                          </td>

                          {/* Input Bal. with Done / Short Alert */}
                          <td
                            className="px-2 py-1 text-right border-[1.5px] border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                            title={`Input Bal: ${inputBalance}`}
                          >
                            {inputBalance <= 0 ? (
                              <span className="text-[#16A34A] dark:text-emerald-400 font-black text-[11px]">
                                0 ✓ Done
                              </span>
                            ) : (
                              <div className="flex flex-col items-end leading-tight">
                                <span className="text-[#DC2626] dark:text-rose-400 font-black text-[11px]">
                                  {inputBalance.toLocaleString()}
                                </span>
                                <span className="text-[9px] text-[#DC2626] dark:text-rose-400 font-bold">
                                  Short
                                </span>
                              </div>
                            )}
                          </td>
                        </tr>

                        {/* ========================================================
                            SUB-ROW 3: OUTPUT
                           ======================================================== */}
                        <tr className="transition-colors bg-emerald-50/25 dark:bg-emerald-950/15 hover:bg-emerald-50/40 dark:hover:bg-white/5 border-t border-gray-200 dark:border-slate-700">
                          {/* TYPE: OUTPUT with Green left border */}
                          <td className="px-1.5 py-1 text-center font-bold text-[10px] text-white bg-emerald-600 dark:bg-emerald-800 border-[1.5px] border-gray-200 dark:border-slate-700 border-l-[6px] border-l-[#16A34A] dark:border-l-emerald-500">
                            OUTPUT
                          </td>

                          {/* 8 Daily OUTPUT cells */}
                          {days.map((day) => {
                            const cellKey = `${orderId}_${day.dateStr}_output`;
                            const flashKey = `${orderId}_${day.dateStr}`;
                            const isFlashed = Boolean(flashedCells[flashKey]);
                            const isSaving = Boolean(savingCells[cellKey]);
                            const cellValue =
                              dailyData[orderId]?.[day.dateStr]?.output_qty;

                            return (
                              <td
                                key={`out_${day.dateStr}`}
                                className={`p-0 text-center relative border-[1.5px] border-gray-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-800 ${
                                  day.isFriday
                                    ? 'bg-[#F3F4F6] dark:bg-slate-800/80'
                                    : isFlashed
                                    ? 'bg-emerald-300 dark:bg-emerald-700'
                                    : ''
                                }`}
                              >
                                <input
                                  type="number"
                                  min="0"
                                  data-cell-key={cellKey}
                                  placeholder="-"
                                  defaultValue={cellValue ?? ''}
                                  key={`output_${orderId}_${day.dateStr}_${cellValue ?? 'empty'}`}
                                  onBlur={(e) => {
                                    const val = e.target.value.trim();
                                    onUpsertDailyCell(
                                      orderId,
                                      day.dateStr,
                                      'output',
                                      val
                                    );
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      (e.target as HTMLInputElement).blur();
                                    }
                                  }}
                                  className="w-full h-7 px-0.5 text-center text-[10px] font-bold text-gray-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 bg-transparent focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-[#0F8B8D] transition-all"
                                />
                                {isSaving && (
                                  <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-[#0F8B8D] animate-ping" />
                                )}
                              </td>
                            );
                          })}

                          {/* Total (OUTPUT) */}
                          <td className="px-2 py-1 text-right font-extrabold text-gray-900 dark:text-white border-[1.5px] border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                            {totalOutput.toLocaleString()}
                          </td>

                          {/* Output Bal. with Done / Short Alert */}
                          <td
                            className="px-2 py-1 text-right border-[1.5px] border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                            title={`Output Bal: ${outputBalance}`}
                          >
                            {outputBalance <= 0 ? (
                              <span className="text-[#16A34A] dark:text-emerald-400 font-black text-[11px]">
                                0 ✓ Done
                              </span>
                            ) : (
                              <div className="flex flex-col items-end leading-tight">
                                <span className="text-[#DC2626] dark:text-rose-400 font-black text-[11px]">
                                  {outputBalance.toLocaleString()}
                                </span>
                                <span className="text-[9px] text-[#DC2626] dark:text-rose-400 font-bold">
                                  Short
                                </span>
                              </div>
                            )}
                          </td>
                        </tr>

                        {/* ========================================================
                            SUB-ROW 4: WASH SENT
                           ======================================================== */}
                        <tr className="transition-colors bg-purple-50/25 dark:bg-purple-950/15 hover:bg-purple-50/40 dark:hover:bg-white/5 border-t border-gray-200 dark:border-slate-700">
                          {/* TYPE: WASH SENT with Purple left border */}
                          <td className="px-1.5 py-1 text-center font-bold text-[10px] text-white bg-purple-600 dark:bg-purple-800 border-[1.5px] border-gray-200 dark:border-slate-700 border-l-[6px] border-l-[#7C3AED] dark:border-l-purple-500">
                            WASH SENT
                          </td>

                          {days.map((day) => {
                            const cellKey = `${orderId}_${day.dateStr}_wash_sent`;
                            const flashKey = `${orderId}_${day.dateStr}`;
                            const isFlashed = Boolean(flashedCells[flashKey]);
                            const isSaving = Boolean(savingCells[cellKey]);
                            const cellValue =
                              dailyData[orderId]?.[day.dateStr]?.wash_sent_qty;

                            return (
                              <td
                                key={`ws_${day.dateStr}`}
                                className={`p-0 text-center relative border-[1.5px] border-gray-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-800 ${
                                  day.isFriday
                                    ? 'bg-[#F3F4F6] dark:bg-slate-800/80'
                                    : isFlashed
                                    ? 'bg-emerald-300 dark:bg-emerald-700'
                                    : ''
                                }`}
                              >
                                <input
                                  type="number"
                                  min="0"
                                  data-cell-key={cellKey}
                                  placeholder="-"
                                  defaultValue={cellValue ?? ''}
                                  key={`wash_sent_${orderId}_${day.dateStr}_${cellValue ?? 'empty'}`}
                                  onBlur={(e) => {
                                    const val = e.target.value.trim();
                                    onUpsertDailyCell(
                                      orderId,
                                      day.dateStr,
                                      'wash_sent',
                                      val
                                    );
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      (e.target as HTMLInputElement).blur();
                                    }
                                  }}
                                  className="w-full h-7 px-0.5 text-center text-[10px] font-bold text-gray-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 bg-transparent focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-[#0F8B8D] transition-all"
                                />
                                {isSaving && (
                                  <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-[#0F8B8D] animate-ping" />
                                )}
                              </td>
                            );
                          })}

                          <td className="px-2 py-1 text-right font-extrabold text-gray-900 dark:text-white border-[1.5px] border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                            {totalWashSent.toLocaleString()}
                          </td>

                          <td
                            className="px-2 py-1 text-right border-[1.5px] border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                            title={`Wash Rem: ${washRemaining}`}
                          >
                            {washRemaining === 0 ? (
                              <span className="text-[#16A34A] dark:text-emerald-400 font-black text-[11px]">
                                0 ✓ Done
                              </span>
                            ) : washRemaining < 0 ? (
                              <span className="text-[#D97706] dark:text-amber-400 font-black text-[11px]">
                                +{Math.abs(washRemaining).toLocaleString()} Excess
                              </span>
                            ) : (
                              <span className="text-[#DC2626] dark:text-rose-400 font-black text-[11px]">
                                {washRemaining.toLocaleString()} Rem.
                              </span>
                            )}
                          </td>
                        </tr>

                        {/* ========================================================
                            SUB-ROW 5: WASH RECV
                           ======================================================== */}
                        <tr className="transition-colors bg-teal-50/25 dark:bg-teal-950/15 hover:bg-teal-50/40 dark:hover:bg-white/5 border-t border-gray-200 dark:border-slate-700">
                          {/* TYPE: WASH RECV with Teal left border */}
                          <td className="px-1.5 py-1 text-center font-bold text-[10px] text-white bg-teal-600 dark:bg-teal-800 border-[1.5px] border-gray-200 dark:border-slate-700 border-l-[6px] border-l-[#0891B2] dark:border-l-teal-500">
                            WASH RECV
                          </td>

                          {days.map((day) => {
                            const cellKey = `${orderId}_${day.dateStr}_wash_recv`;
                            const flashKey = `${orderId}_${day.dateStr}`;
                            const isFlashed = Boolean(flashedCells[flashKey]);
                            const isSaving = Boolean(savingCells[cellKey]);
                            const cellValue =
                              dailyData[orderId]?.[day.dateStr]?.wash_recv_qty;

                            return (
                              <td
                                key={`wr_${day.dateStr}`}
                                className={`p-0 text-center relative border-[1.5px] border-gray-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-800 ${
                                  day.isFriday
                                    ? 'bg-[#F3F4F6] dark:bg-slate-800/80'
                                    : isFlashed
                                    ? 'bg-emerald-300 dark:bg-emerald-700'
                                    : ''
                                }`}
                              >
                                <input
                                  type="number"
                                  min="0"
                                  data-cell-key={cellKey}
                                  placeholder="-"
                                  defaultValue={cellValue ?? ''}
                                  key={`wash_recv_${orderId}_${day.dateStr}_${cellValue ?? 'empty'}`}
                                  onBlur={(e) => {
                                    const val = e.target.value.trim();
                                    onUpsertDailyCell(
                                      orderId,
                                      day.dateStr,
                                      'wash_recv',
                                      val
                                    );
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      (e.target as HTMLInputElement).blur();
                                    }
                                  }}
                                  className="w-full h-7 px-0.5 text-center text-[10px] font-bold text-gray-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 bg-transparent focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-[#0F8B8D] transition-all"
                                />
                                {isSaving && (
                                  <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-[#0F8B8D] animate-ping" />
                                )}
                              </td>
                            );
                          })}

                          <td className="px-2 py-1 text-right font-extrabold text-gray-900 dark:text-white border-[1.5px] border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                            {totalWashRecv.toLocaleString()}
                          </td>

                          <td
                            className="px-2 py-1 text-right border-[1.5px] border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                            title={`Wash Recv Rem: ${washRecvRemaining}`}
                          >
                            {washRecvRemaining <= 0 ? (
                              <span className="text-[#16A34A] dark:text-emerald-400 font-black text-[11px]">
                                0 ✓ Done
                              </span>
                            ) : (
                              <span className="text-[#DC2626] dark:text-rose-400 font-black text-[11px]">
                                {washRecvRemaining.toLocaleString()} Rem.
                              </span>
                            )}
                          </td>
                        </tr>

                        {/* ========================================================
                            SUB-ROW 6: FINISHING (Ends order with 3px line-colored border)
                           ======================================================== */}
                        <tr className={`transition-colors bg-orange-50/25 dark:bg-orange-950/15 hover:bg-orange-50/40 dark:hover:bg-white/5 border-t border-gray-200 dark:border-slate-700 border-b-[3px] ${config.borderClass}`}>
                          {/* TYPE: FINISHING with Orange left border */}
                          <td className="px-1.5 py-1 text-center font-bold text-[10px] text-white bg-orange-600 dark:bg-orange-800 border-[1.5px] border-gray-200 dark:border-slate-700 border-l-[6px] border-l-[#EA580C] dark:border-l-orange-500">
                            FINISHING
                          </td>

                          {days.map((day) => {
                            const cellKey = `${orderId}_${day.dateStr}_finishing`;
                            const flashKey = `${orderId}_${day.dateStr}`;
                            const isFlashed = Boolean(flashedCells[flashKey]);
                            const isSaving = Boolean(savingCells[cellKey]);
                            const cellValue =
                              dailyData[orderId]?.[day.dateStr]?.finishing_qty;

                            return (
                              <td
                                key={`fn_${day.dateStr}`}
                                className={`p-0 text-center relative border-[1.5px] border-gray-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-800 ${
                                  day.isFriday
                                    ? 'bg-[#F3F4F6] dark:bg-slate-800/80'
                                    : isFlashed
                                    ? 'bg-emerald-300 dark:bg-emerald-700'
                                    : ''
                                }`}
                              >
                                <input
                                  type="number"
                                  min="0"
                                  data-cell-key={cellKey}
                                  placeholder="-"
                                  defaultValue={cellValue ?? ''}
                                  key={`finishing_${orderId}_${day.dateStr}_${cellValue ?? 'empty'}`}
                                  onBlur={(e) => {
                                    const val = e.target.value.trim();
                                    onUpsertDailyCell(
                                      orderId,
                                      day.dateStr,
                                      'finishing',
                                      val
                                    );
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      (e.target as HTMLInputElement).blur();
                                    }
                                  }}
                                  className="w-full h-7 px-0.5 text-center text-[10px] font-bold text-gray-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 bg-transparent focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-[#0F8B8D] transition-all"
                                />
                                {isSaving && (
                                  <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-[#0F8B8D] animate-ping" />
                                )}
                              </td>
                            );
                          })}

                          <td className="px-2 py-1 text-right font-extrabold text-gray-900 dark:text-white border-[1.5px] border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                            {totalFinishing.toLocaleString()}
                          </td>

                          <td
                            className="px-2 py-1 text-right border-[1.5px] border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                            title={`Finish Rem: ${finishingRemaining}`}
                          >
                            {finishingRemaining <= 0 ? (
                              <span className="text-[#16A34A] dark:text-emerald-400 font-black text-[11px]">
                                0 ✓ Done
                              </span>
                            ) : (
                              <span className="text-[#DC2626] dark:text-rose-400 font-black text-[11px]">
                                {finishingRemaining.toLocaleString()} Rem.
                              </span>
                            )}
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })}
                </tbody>

                {/* Pinned Totals Row for this Line Group */}
                <tfoot className="sticky bottom-0 z-30 bg-[#E5E7EB] dark:bg-[#071B1E] text-gray-900 dark:text-white border-t-2 border-[#9CA3AF] dark:border-white/20 font-black text-[10px] uppercase">
                  <tr className="border-b border-gray-200 dark:border-slate-700">
                    <td
                      colSpan={4}
                      className="sticky left-0 z-40 bg-[#E5E7EB] dark:bg-[#071B1E] px-2.5 py-2 text-right border-[1.5px] border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white"
                    >
                      {config.label} TOTALS ({groupOrders.length} orders)
                    </td>
                    <td colSpan={5} className="px-2 py-2 text-center text-slate-600 dark:text-slate-400 border-[1.5px] border-gray-200 dark:border-slate-700">
                      -
                    </td>
                    <td className="px-2 py-2 text-right border-[1.5px] border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white font-extrabold">
                      {groupOrders.reduce((s, o) => s + Number(o.order_qty || 0), 0).toLocaleString()}
                    </td>
                    <td className="px-1.5 py-2 text-center font-bold text-teal-800 dark:text-teal-300 bg-teal-100/70 dark:bg-teal-950/60 border-[1.5px] border-gray-200 dark:border-white/15">
                      IN Σ
                    </td>
                    {days.map((day) => {
                      let dayIn = 0;
                      groupOrders.forEach((o) => {
                        dayIn += Number(dailyData[o.id]?.[day.dateStr]?.input_qty || 0);
                      });
                      return (
                        <td
                          key={`group_sum_in_${day.dateStr}`}
                          className={`px-1 py-2 text-center text-[10px] border-[1.5px] border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white ${
                            day.isFriday ? 'bg-slate-300/80 dark:bg-slate-800 text-[#DC2626] font-extrabold' : ''
                          }`}
                        >
                          {dayIn ? dayIn.toLocaleString() : '-'}
                        </td>
                      );
                    })}
                    <td className="px-2 py-2 text-right border-[1.5px] border-gray-200 dark:border-slate-700 text-teal-800 dark:text-teal-300 font-bold">
                      {groupOrders.reduce((s, o) => s + Number(o.total_input || 0), 0).toLocaleString()}
                    </td>
                    <td className="px-2 py-2 text-right border-[1.5px] border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white">
                      -
                    </td>
                    {/* Remarks column placeholder */}
                    <td className="px-2 py-2 text-center text-slate-600 dark:text-slate-400 border-[1.5px] border-gray-200 dark:border-slate-700">
                      -
                    </td>
                    <td colSpan={isAdmin ? 2 : 1} className="px-2 py-2 text-center text-slate-600 dark:text-slate-400 border-[1.5px] border-gray-200 dark:border-slate-700">
                      -
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
};
