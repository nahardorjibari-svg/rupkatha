import React, { useState, useMemo } from 'react';
import { Trash2, Calendar } from 'lucide-react';
import type { PlanningOrder, DayColumn, DailyCellType } from '../../types/planning';
import type { DailyMatrix } from '../../hooks/planning/usePlanningDaily';
import { getOrderStatus } from '../../lib/planningStatus';
import { useAuth } from '../../context/AuthContext';

interface LinePlanTableProps {
  orders: PlanningOrder[];
  days: DayColumn[];
  dailyData: DailyMatrix;
  flashedCells: Record<string, boolean>;
  savingCells: Record<string, boolean>;
  searchQuery: string;
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

const LINE_GROUP_CONFIGS: Record<string, { label: string; borderClass: string; bgHeader: string }> = {
  'Line-1': { label: 'LINE 1', borderClass: 'border-[#2563EB]', bgHeader: 'bg-[#2563EB]' },
  'Line-2': { label: 'LINE 2', borderClass: 'border-[#7C3AED]', bgHeader: 'bg-[#7C3AED]' },
  'Line-3': { label: 'LINE 3', borderClass: 'border-[#EA580C]', bgHeader: 'bg-[#EA580C]' },
  'Line-4': { label: 'LINE 4', borderClass: 'border-[#0D9488]', bgHeader: 'bg-[#0D9488]' },
  'No line yet': { label: 'NO LINE YET', borderClass: 'border-[#6B7280]', bgHeader: 'bg-[#6B7280]' },
};

export const LinePlanTable: React.FC<LinePlanTableProps> = ({
  orders,
  days,
  dailyData,
  flashedCells,
  savingCells,
  searchQuery,
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

  // Compute total Order Qty grouped by PO across all colour rows
  const poTotalQtyMap = useMemo(() => {
    const map: Record<string, number> = {};
    orders.forEach((o) => {
      map[o.po] = (map[o.po] || 0) + Number(o.order_qty || 0);
    });
    return map;
  }, [orders]);

  // Group orders by line_no
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
    return map;
  }, [orders]);

  // Compute overall table totals
  const totals = useMemo(() => {
    let totalOrderQty = 0;
    let totalCuttingQty = 0;
    let totalInputQty = 0;
    let totalOutputQty = 0;
    let totalWashSent = 0;
    let totalWashRecv = 0;
    let totalFinishing = 0;

    const dailyInputTotals: Record<string, number> = {};
    const dailyOutputTotals: Record<string, number> = {};
    const dailyWashSentTotals: Record<string, number> = {};
    const dailyWashRecvTotals: Record<string, number> = {};
    const dailyFinishingTotals: Record<string, number> = {};

    days.forEach((d) => {
      dailyInputTotals[d.dateStr] = 0;
      dailyOutputTotals[d.dateStr] = 0;
      dailyWashSentTotals[d.dateStr] = 0;
      dailyWashRecvTotals[d.dateStr] = 0;
      dailyFinishingTotals[d.dateStr] = 0;
    });

    orders.forEach((o) => {
      totalOrderQty += Number(o.order_qty || 0);
      totalCuttingQty += Number(o.cutting_qty || 0);
      totalInputQty += Number(o.total_input || 0);
      totalOutputQty += Number(o.total_output || 0);
      totalWashSent += Number(o.total_wash_sent || 0);
      totalWashRecv += Number(o.total_wash_recv || 0);
      totalFinishing += Number(o.total_finishing || 0);

      days.forEach((d) => {
        const inVal = dailyData[o.id]?.[d.dateStr]?.input_qty;
        const outVal = dailyData[o.id]?.[d.dateStr]?.output_qty;
        const wsVal = dailyData[o.id]?.[d.dateStr]?.wash_sent_qty;
        const wrVal = dailyData[o.id]?.[d.dateStr]?.wash_recv_qty;
        const fnVal = dailyData[o.id]?.[d.dateStr]?.finishing_qty;
        if (inVal) dailyInputTotals[d.dateStr] += Number(inVal);
        if (outVal) dailyOutputTotals[d.dateStr] += Number(outVal);
        if (wsVal) dailyWashSentTotals[d.dateStr] += Number(wsVal);
        if (wrVal) dailyWashRecvTotals[d.dateStr] += Number(wrVal);
        if (fnVal) dailyFinishingTotals[d.dateStr] += Number(fnVal);
      });
    });

    return {
      totalOrderQty,
      totalCuttingQty,
      totalInputQty,
      totalOutputQty,
      totalWashSent,
      totalWashRecv,
      totalFinishing,
      dailyInputTotals,
      dailyOutputTotals,
      dailyWashSentTotals,
      dailyWashRecvTotals,
      dailyFinishingTotals,
    };
  }, [orders, days, dailyData]);

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
      <div className="py-16 text-center bg-white dark:bg-[#103A40]/40 rounded-2xl border border-slate-200 dark:border-white/10 p-8 shadow-xs">
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
      {/* Top Date Navigation Bar directly above table */}
      <div className="px-4 py-2.5 bg-slate-50 dark:bg-[#082024] rounded-xl border border-slate-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
          <span className="w-2 h-2 rounded-full bg-[#2BA5B5]"></span>
          <span>{orders.length} Orders</span>
          <span className="text-slate-400">·</span>
          <span className="text-slate-500 dark:text-slate-400">8-Day Window</span>
        </div>

        {onEarlier && onLater && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onEarlier}
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
              onClick={onLater}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-white/10 hover:bg-slate-100 dark:hover:bg-white/20 text-slate-800 dark:text-white border border-slate-300 dark:border-white/15 shadow-xs transition-all active:scale-95 cursor-pointer"
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
          bgHeader: 'bg-slate-600',
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
            className={`rounded-xl border-2 ${config.borderClass} bg-white dark:bg-[#0E2E33] shadow-soft-sm overflow-hidden mb-6`}
          >
            {/* Colored Box Header Strip */}
            <div className={`${config.bgHeader} text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs font-bold`}>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-black/20 font-black tracking-wider text-[11px]">
                  {config.label}
                </span>
                <span>·</span>
                <span>{groupOrders.length} {groupOrders.length === 1 ? 'order' : 'orders'}</span>
                <span>·</span>
                <span>Total Qty: {groupTotalQty.toLocaleString()}</span>
                <span>·</span>
                <span>Output: {groupOutput.toLocaleString()}</span>
              </div>
              <div className="text-[11px] opacity-90 font-medium">
                Status: {statusSummaryText}
              </div>
            </div>

            {/* Table inside Box Card with cell borders and border-collapse */}
            <div className="overflow-x-auto scrollbar-custom">
              <table className="w-full text-left border-collapse text-[11px]">
                {/* Header */}
                <thead className="sticky top-0 z-30 bg-slate-100 dark:bg-[#082024] text-slate-700 dark:text-slate-200 border-b border-slate-300 dark:border-slate-700 select-none text-[10px] uppercase font-bold tracking-wider">
                  <tr className="bg-slate-100 dark:bg-[#082024] border-b border-slate-300 dark:border-slate-700">
                    <th
                      colSpan={14}
                      className="sticky left-0 z-40 bg-slate-100 dark:bg-[#082024] px-3 py-1 text-left text-[10px] text-slate-500 dark:text-slate-400 border-r border-slate-300 dark:border-slate-700 uppercase font-semibold"
                    >
                      Order Particulars ({config.label})
                    </th>
                    <th
                      colSpan={days.length}
                      className="bg-slate-200/90 dark:bg-slate-800/90 px-2 py-1 text-center border-r border-slate-300 dark:border-slate-700"
                    >
                      <div className="flex items-center justify-center gap-2 print:hidden">
                        {onEarlier && (
                          <button
                            type="button"
                            onClick={onEarlier}
                            className="px-2 py-0.5 rounded text-[10px] font-bold bg-white dark:bg-white/10 hover:bg-slate-50 dark:hover:bg-white/20 text-slate-800 dark:text-white border border-slate-300 dark:border-slate-700 shadow-2xs transition-colors cursor-pointer"
                            title="Move 8 days earlier"
                          >
                            ‹ Earlier
                          </button>
                        )}
                        <span className="font-extrabold text-[11px] text-slate-900 dark:text-white tracking-wide">
                          {dateRangeLabel}
                        </span>
                        {onLater && (
                          <button
                            type="button"
                            onClick={onLater}
                            className="px-2 py-0.5 rounded text-[10px] font-bold bg-white dark:bg-white/10 hover:bg-slate-50 dark:hover:bg-white/20 text-slate-800 dark:text-white border border-slate-300 dark:border-slate-700 shadow-2xs transition-colors cursor-pointer"
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
                      colSpan={isAdmin ? 10 : 9}
                      className="bg-slate-100 dark:bg-[#082024] px-2 py-1 text-center text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold"
                    >
                      Totals, Balances, Wash & Finishing Tracking
                    </th>
                  </tr>
                  <tr>
                    {/* Sticky Column 1: SL */}
                    <th className="sticky left-0 z-40 bg-slate-100 dark:bg-[#082024] px-2 py-2.5 text-center w-10 border border-slate-300 dark:border-slate-700">
                      SL
                    </th>

                    {/* Sticky Column 2: Buyer */}
                    <th className="sticky left-10 z-40 bg-slate-100 dark:bg-[#082024] px-2.5 py-2.5 min-w-[95px] max-w-[120px] border border-slate-300 dark:border-slate-700">
                      Buyer
                    </th>

                    {/* Sticky Column 3: PO */}
                    <th className="sticky left-[135px] z-40 bg-slate-100 dark:bg-[#082024] px-2.5 py-2.5 min-w-[95px] border border-slate-300 dark:border-slate-700">
                      PO
                    </th>

                    {/* Sticky Column 4: Style */}
                    <th className="sticky left-[230px] z-40 bg-slate-100 dark:bg-[#082024] px-2.5 py-2.5 min-w-[105px] border border-slate-300 dark:border-slate-700">
                      Style
                    </th>

                    {/* Sticky Column 5: Order Qty */}
                    <th className="sticky left-[335px] z-40 bg-slate-100 dark:bg-[#082024] px-2.5 py-2.5 text-right min-w-[80px] border-r-2 border-slate-400 dark:border-slate-600 border border-slate-300 dark:border-slate-700 shadow-[4px_0_6px_-2px_rgba(0,0,0,0.06)]">
                      Order Qty
                    </th>

                    {/* Colour */}
                    <th className="px-2 py-2.5 min-w-[85px] border border-slate-300 dark:border-slate-700">
                      Colour
                    </th>

                    {/* Wash */}
                    <th className="px-2 py-2.5 min-w-[75px] border border-slate-300 dark:border-slate-700">
                      Wash
                    </th>

                    {/* Line */}
                    <th className="px-2 py-2.5 min-w-[80px] border border-slate-300 dark:border-slate-700">
                      Line
                    </th>

                    {/* Start Date */}
                    <th className="px-2 py-2.5 min-w-[105px] border border-slate-300 dark:border-slate-700">
                      Start Date
                    </th>

                    {/* Qty */}
                    <th className="px-2 py-2.5 text-right min-w-[65px] border border-slate-300 dark:border-slate-700">
                      Qty
                    </th>

                    {/* Cutting */}
                    <th className="px-2 py-2.5 text-right min-w-[70px] border border-slate-300 dark:border-slate-700">
                      Cutting
                    </th>

                    {/* Extra % */}
                    <th className="px-1.5 py-2.5 text-right min-w-[60px] border border-slate-300 dark:border-slate-700">
                      Extra %
                    </th>

                    {/* Cut Status */}
                    <th className="px-2 py-2.5 text-center min-w-[75px] border border-slate-300 dark:border-slate-700">
                      Cut Status
                    </th>

                    {/* Type */}
                    <th className="px-2 py-2.5 text-center min-w-[85px] border border-slate-300 dark:border-slate-700 bg-slate-200/50 dark:bg-black/20">
                      Type
                    </th>

                    {/* 8 Day Columns */}
                    {days.map((day) => (
                      <th
                        key={day.dateStr}
                        className={`px-1 py-1 text-center min-w-[50px] border border-slate-300 dark:border-slate-700 ${
                          day.isFriday
                            ? 'bg-slate-200/90 dark:bg-slate-800 text-rose-600 dark:text-rose-400 font-extrabold'
                            : day.isToday
                            ? 'bg-teal-50 dark:bg-teal-950/60 text-[#0F8B8D] dark:text-teal-300'
                            : ''
                        }`}
                      >
                        <div className="leading-tight text-[10px] font-bold">
                          {day.displayDay}
                        </div>
                        <div className="text-[8px] font-medium opacity-75">
                          {day.dayOfWeek}
                        </div>
                      </th>
                    ))}

                    {/* Total */}
                    <th className="px-2 py-2.5 text-right min-w-[65px] border border-slate-300 dark:border-slate-700">
                      Total
                    </th>

                    {/* Balance */}
                    <th className="px-2 py-2.5 text-right min-w-[75px] border border-slate-300 dark:border-slate-700">
                      Balance
                    </th>

                    {/* Total Wash Sent */}
                    <th className="px-2 py-2.5 text-right min-w-[80px] border border-slate-300 dark:border-slate-700 bg-sky-50/50 dark:bg-sky-950/20">
                      Total Wash Sent
                    </th>

                    {/* Wash Rem. */}
                    <th className="px-2 py-2.5 text-right min-w-[75px] border border-slate-300 dark:border-slate-700 bg-sky-50/30 dark:bg-sky-950/10">
                      Wash Rem.
                    </th>

                    {/* Total Wash Recv */}
                    <th className="px-2 py-2.5 text-right min-w-[80px] border border-slate-300 dark:border-slate-700 bg-purple-50/50 dark:bg-purple-950/20">
                      Total Wash Recv
                    </th>

                    {/* Wash Recv Rem. */}
                    <th className="px-2 py-2.5 text-right min-w-[80px] border border-slate-300 dark:border-slate-700 bg-purple-50/30 dark:bg-purple-950/10">
                      Wash Recv Rem.
                    </th>

                    {/* Total Finishing */}
                    <th className="px-2 py-2.5 text-right min-w-[80px] border border-slate-300 dark:border-slate-700 bg-emerald-50/50 dark:bg-emerald-950/20">
                      Total Finishing
                    </th>

                    {/* Finishing Rem. */}
                    <th className="px-2 py-2.5 text-right min-w-[80px] border border-slate-300 dark:border-slate-700 bg-emerald-50/30 dark:bg-emerald-950/10">
                      Finishing Rem.
                    </th>

                    {/* Status */}
                    <th className="px-3 py-2.5 text-center min-w-[125px] border border-slate-300 dark:border-slate-700">
                      Status
                    </th>

                    {/* Action */}
                    {isAdmin && (
                      <th className="px-2 py-2.5 text-center w-9 border border-slate-300 dark:border-slate-700">
                        Act
                      </th>
                    )}
                  </tr>
                </thead>

                {/* Table Body */}
                <tbody className="divide-y divide-slate-300 dark:divide-slate-700">
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
                    let cutStatusClass =
                      'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300';
                    if (cuttingQty >= rowOrderQty && rowOrderQty > 0) {
                      cutStatusLabel = 'Cut done';
                      cutStatusClass =
                        'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300';
                    } else if (cuttingQty > 0) {
                      cutStatusLabel = 'Cutting';
                      cutStatusClass =
                        'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300';
                    }

                    // Balances
                    const inputBalance = cuttingQty - totalInput;
                    const outputBalance = totalInput - totalOutput;
                    const washRemaining = rowOrderQty - totalWashSent;
                    const washRecvRemaining = totalWashSent - totalWashRecv;
                    const finishingRemaining = totalWashRecv - totalFinishing;

                    // Wash & Finishing Right Column Styling
                    const washSentColor =
                      cuttingQty > 0
                        ? totalWashSent >= cuttingQty
                          ? 'text-emerald-600 dark:text-emerald-400 font-extrabold'
                          : 'text-amber-600 dark:text-amber-400 font-bold'
                        : 'text-slate-700 dark:text-slate-300 font-bold';

                    const washRemColor =
                      washRemaining > 0
                        ? 'text-rose-600 dark:text-rose-400 font-extrabold'
                        : 'text-emerald-600 dark:text-emerald-400 font-bold';

                    const washRecvColor =
                      totalWashSent > 0
                        ? totalWashRecv >= totalWashSent
                          ? 'text-emerald-600 dark:text-emerald-400 font-extrabold'
                          : 'text-amber-600 dark:text-amber-400 font-bold'
                        : 'text-slate-700 dark:text-slate-300 font-bold';

                    const washRecvRemColor =
                      washRecvRemaining > 0
                        ? 'text-rose-600 dark:text-rose-400 font-extrabold'
                        : 'text-emerald-600 dark:text-emerald-400 font-bold';

                    const finishingColor =
                      totalWashRecv > 0
                        ? totalFinishing >= totalWashRecv
                          ? 'text-emerald-600 dark:text-emerald-400 font-extrabold'
                          : 'text-amber-600 dark:text-amber-400 font-bold'
                        : 'text-slate-700 dark:text-slate-300 font-bold';

                    const finishingRemColor =
                      finishingRemaining > 0
                        ? 'text-rose-600 dark:text-rose-400 font-extrabold'
                        : 'text-emerald-600 dark:text-emerald-400 font-bold';

                    return (
                      <React.Fragment key={orderId}>
                        {/* SUB-ROW 1: INPUT */}
                        <tr
                          className={`transition-colors ${status.rowTintClass} hover:bg-slate-50 dark:hover:bg-white/5 border-t border-slate-300 dark:border-slate-700`}
                        >
                          {/* Sticky Column 1: SL (Rowspan 5) */}
                          <td
                            rowSpan={5}
                            className={`sticky left-0 z-20 px-2 py-1.5 text-center font-bold text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-slate-700 ${status.rowTintClass} bg-inherit`}
                          >
                            {index + 1}
                          </td>

                          {/* Sticky Column 2: Buyer (Rowspan 5) */}
                          <td
                            rowSpan={5}
                            className={`sticky left-10 z-20 px-2.5 py-1.5 font-bold text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 whitespace-nowrap max-w-[120px] truncate ${status.rowTintClass} bg-inherit`}
                            title={order.buyer || '-'}
                          >
                            {order.buyer && order.buyer.trim() ? highlightMatch(order.buyer) : '-'}
                          </td>

                          {/* Sticky Column 3: PO (Rowspan 5) */}
                          <td
                            rowSpan={5}
                            className={`sticky left-[135px] z-20 px-2.5 py-1.5 font-extrabold text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 whitespace-nowrap ${status.rowTintClass} bg-inherit`}
                          >
                            {highlightMatch(order.po)}
                          </td>

                          {/* Sticky Column 4: Style (Rowspan 5) */}
                          <td
                            rowSpan={5}
                            className={`sticky left-[230px] z-20 px-2.5 py-1.5 font-medium text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 max-w-[130px] truncate ${status.rowTintClass} bg-inherit`}
                            title={order.style || ''}
                          >
                            {highlightMatch(order.style)}
                          </td>

                          {/* Sticky Column 5: Order Qty (PO total, Rowspan 5) */}
                          <td
                            rowSpan={5}
                            className={`sticky left-[335px] z-20 px-2.5 py-1.5 text-right font-black text-slate-900 dark:text-white border-r-2 border-slate-400 dark:border-slate-600 border border-slate-300 dark:border-slate-700 shadow-[4px_0_6px_-2px_rgba(0,0,0,0.06)] ${status.rowTintClass} bg-inherit`}
                          >
                            {poTotalOrderQty.toLocaleString()}
                          </td>

                          {/* Column 5: Colour (Rowspan 5) */}
                          <td
                            rowSpan={5}
                            className="px-2 py-1.5 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 font-medium whitespace-nowrap"
                          >
                            {highlightMatch(order.colour) || '-'}
                          </td>

                          {/* Column 6: Wash (Rowspan 5) */}
                          <td
                            rowSpan={5}
                            className="px-2 py-1.5 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700 text-[10px]"
                          >
                            {order.wash || '-'}
                          </td>

                          {/* Column 7: Line (Rowspan 5, inline select) */}
                          <td
                            rowSpan={5}
                            className="px-1 py-1 border border-slate-300 dark:border-slate-700"
                          >
                            <select
                              value={order.line_no || ''}
                              onChange={(e) =>
                                onUpdateOrder(orderId, { line_no: e.target.value })
                              }
                              className="w-full px-1.5 py-1 text-[11px] font-bold rounded border border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-[#2BA5B5] bg-transparent focus:bg-white dark:focus:bg-slate-900 transition-all cursor-pointer"
                            >
                              <option value="">No line</option>
                              <option value="Line-1">Line-1</option>
                              <option value="Line-2">Line-2</option>
                              <option value="Line-3">Line-3</option>
                              <option value="Line-4">Line-4</option>
                            </select>
                          </td>

                          {/* Column 8: Start Date (Rowspan 5) */}
                          <td
                            rowSpan={5}
                            className="px-1 py-1 border border-slate-300 dark:border-slate-700"
                          >
                            <input
                              type="date"
                              value={order.start_date || ''}
                              onChange={(e) =>
                                onUpdateOrder(orderId, {
                                  start_date: e.target.value || null,
                                })
                              }
                              className="w-full px-1.5 py-1 text-[10px] font-semibold rounded bg-[#FEF9C3] dark:bg-amber-950/40 text-amber-950 dark:text-amber-200 border border-amber-300 dark:border-amber-700/60 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
                            />
                          </td>

                          {/* Column 9: Qty (Rowspan 5) */}
                          <td
                            rowSpan={5}
                            className="px-2 py-1.5 text-right font-extrabold text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700"
                          >
                            {rowOrderQty.toLocaleString()}
                          </td>

                          {/* Column 10: Cutting (Rowspan 5) */}
                          <td
                            rowSpan={5}
                            className="px-1 py-1 border border-slate-300 dark:border-slate-700"
                          >
                            <input
                              type="number"
                              min="0"
                              defaultValue={cuttingQty || ''}
                              key={`cutting_${orderId}_${cuttingQty}`}
                              placeholder="0"
                              onBlur={(e) => {
                                const val = parseInt(e.target.value, 10);
                                const cleanVal = isNaN(val) ? 0 : Math.max(0, val);
                                if (cleanVal !== cuttingQty) {
                                  onUpdateOrder(orderId, { cutting_qty: cleanVal });
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  (e.target as HTMLInputElement).blur();
                                }
                              }}
                              className="w-full h-7 px-1 text-right text-[11px] font-bold text-slate-900 dark:text-white rounded border border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-[#2BA5B5] bg-transparent focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-[#2BA5B5]"
                            />
                          </td>

                          {/* Column 11: Extra % (Rowspan 5) */}
                          <td
                            rowSpan={5}
                            className={`px-1.5 py-1.5 text-right font-bold text-[10px] border border-slate-300 dark:border-slate-700 ${
                              extraPct > 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : extraPct < 0
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            {extraPct > 0 ? `+${extraPct}%` : `${extraPct}%`}
                          </td>

                          {/* Column 12: Cut Status (Rowspan 5) */}
                          <td
                            rowSpan={5}
                            className="px-1.5 py-1 text-center border border-slate-300 dark:border-slate-700"
                          >
                            <span
                              className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold border whitespace-nowrap ${cutStatusClass}`}
                            >
                              {cutStatusLabel}
                            </span>
                          </td>

                          {/* Column 13: Type (INPUT) */}
                          <td className="px-1.5 py-1 text-center font-bold text-[10px] text-teal-700 dark:text-teal-300 bg-teal-50/70 dark:bg-teal-950/40 border border-slate-300 dark:border-slate-700">
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
                                className={`p-0 text-center relative border border-slate-300 dark:border-slate-700 transition-colors ${
                                  day.isFriday
                                    ? 'bg-slate-200/90 dark:bg-slate-800/80'
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
                                  className="w-full h-7 px-0.5 text-center text-[10px] font-bold text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 bg-transparent focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-[#2BA5B5] transition-all"
                                />
                                {isSaving && (
                                  <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-[#2BA5B5] animate-ping" />
                                )}
                              </td>
                            );
                          })}

                          {/* Total (INPUT) */}
                          <td className="px-2 py-1 text-right font-extrabold text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700">
                            {totalInput.toLocaleString()}
                          </td>

                          {/* Input Bal. (cutting_qty - total_input) */}
                          <td
                            className={`px-2 py-1 text-right font-bold border border-slate-300 dark:border-slate-700 ${
                              inputBalance <= 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400 font-extrabold bg-rose-50/50 dark:bg-rose-950/30'
                            }`}
                            title={`Input Bal: ${inputBalance}`}
                          >
                            {inputBalance.toLocaleString()}
                          </td>

                          {/* Merged Column: TOTAL WASH SENT (Rowspan 5) */}
                          <td
                            rowSpan={5}
                            className={`px-2 py-1 text-right border border-slate-300 dark:border-slate-700 ${washSentColor} bg-inherit`}
                          >
                            {totalWashSent.toLocaleString()}
                          </td>

                          {/* Merged Column: WASH REMAINING (Rowspan 5) */}
                          <td
                            rowSpan={5}
                            className={`px-2 py-1 text-right border border-slate-300 dark:border-slate-700 ${washRemColor} bg-inherit`}
                          >
                            {washRemaining.toLocaleString()}
                          </td>

                          {/* Merged Column: TOTAL WASH RECV (Rowspan 5) */}
                          <td
                            rowSpan={5}
                            className={`px-2 py-1 text-right border border-slate-300 dark:border-slate-700 ${washRecvColor} bg-inherit`}
                          >
                            {totalWashRecv.toLocaleString()}
                          </td>

                          {/* Merged Column: WASH RECV REMAINING (Rowspan 5) */}
                          <td
                            rowSpan={5}
                            className={`px-2 py-1 text-right border border-slate-300 dark:border-slate-700 ${washRecvRemColor} bg-inherit`}
                          >
                            {washRecvRemaining.toLocaleString()}
                          </td>

                          {/* Merged Column: TOTAL FINISHING (Rowspan 5) */}
                          <td
                            rowSpan={5}
                            className={`px-2 py-1 text-right border border-slate-300 dark:border-slate-700 ${finishingColor} bg-inherit`}
                          >
                            {totalFinishing.toLocaleString()}
                          </td>

                          {/* Merged Column: FINISHING REMAINING (Rowspan 5) */}
                          <td
                            rowSpan={5}
                            className={`px-2 py-1 text-right border border-slate-300 dark:border-slate-700 ${finishingRemColor} bg-inherit`}
                          >
                            {finishingRemaining.toLocaleString()}
                          </td>

                          {/* Status Badge (Rowspan 5) */}
                          <td
                            rowSpan={5}
                            className={`px-2 py-1 text-center border border-slate-300 dark:border-slate-700 ${status.rowTintClass} bg-inherit`}
                          >
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-[10px] border whitespace-nowrap font-medium ${status.badgeClass}`}
                            >
                              {status.label}
                            </span>
                          </td>

                          {/* Admin Delete Action (Rowspan 5) */}
                          {isAdmin && (
                            <td
                              rowSpan={5}
                              className={`px-1 py-1 text-center border border-slate-300 dark:border-slate-700 ${status.rowTintClass} bg-inherit`}
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
                                      className="px-1 py-0.5 bg-slate-200 text-slate-800 rounded text-[8px]"
                                    >
                                      N
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(orderId)}
                                  className="p-1 text-slate-400 hover:text-rose-500 rounded hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                                  title="Delete order"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </td>
                          )}
                        </tr>

                        {/* SUB-ROW 2: OUTPUT */}
                        <tr
                          className={`transition-colors ${status.rowTintClass} hover:bg-slate-50 dark:hover:bg-white/5`}
                        >
                          {/* Column 13: Type (OUTPUT) */}
                          <td className="px-1.5 py-1 text-center font-bold text-[10px] text-indigo-700 dark:text-indigo-300 bg-indigo-50/60 dark:bg-indigo-950/30 border border-slate-300 dark:border-slate-700">
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
                                className={`p-0 text-center relative border border-slate-300 dark:border-slate-700 transition-colors ${
                                  day.isFriday
                                    ? 'bg-slate-200/90 dark:bg-slate-800/80'
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
                                  className="w-full h-7 px-0.5 text-center text-[10px] font-bold text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 bg-transparent focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-[#2BA5B5] transition-all"
                                />
                                {isSaving && (
                                  <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-[#2BA5B5] animate-ping" />
                                )}
                              </td>
                            );
                          })}

                          {/* Total (OUTPUT) */}
                          <td className="px-2 py-1 text-right font-extrabold text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700">
                            {totalOutput.toLocaleString()}
                          </td>

                          {/* Output Bal. (total_input - total_output) */}
                          <td
                            className={`px-2 py-1 text-right font-bold border border-slate-300 dark:border-slate-700 ${
                              outputBalance <= 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400 font-extrabold bg-rose-50/50 dark:bg-rose-950/30'
                            }`}
                            title={`Output Bal: ${outputBalance}`}
                          >
                            {outputBalance.toLocaleString()}
                          </td>
                        </tr>

                        {/* SUB-ROW 3: WASH SENT */}
                        <tr
                          className={`transition-colors ${status.rowTintClass} hover:bg-slate-50 dark:hover:bg-white/5`}
                        >
                          <td className="px-1.5 py-1 text-center font-bold text-[10px] text-sky-700 dark:text-sky-300 bg-sky-50/70 dark:bg-sky-950/40 border border-slate-300 dark:border-slate-700">
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
                                className={`p-0 text-center relative border border-slate-300 dark:border-slate-700 transition-colors ${
                                  day.isFriday
                                    ? 'bg-slate-200/90 dark:bg-slate-800/80'
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
                                  className="w-full h-7 px-0.5 text-center text-[10px] font-bold text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 bg-transparent focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-[#2BA5B5] transition-all"
                                />
                                {isSaving && (
                                  <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-[#2BA5B5] animate-ping" />
                                )}
                              </td>
                            );
                          })}

                          <td className="px-2 py-1 text-right font-extrabold text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700">
                            {totalWashSent.toLocaleString()}
                          </td>

                          <td
                            className={`px-2 py-1 text-right font-bold border border-slate-300 dark:border-slate-700 ${
                              washRemaining <= 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400 font-extrabold bg-rose-50/50 dark:bg-rose-950/30'
                            }`}
                            title={`Wash Rem: ${washRemaining}`}
                          >
                            {washRemaining.toLocaleString()}
                          </td>
                        </tr>

                        {/* SUB-ROW 4: WASH RECV */}
                        <tr
                          className={`transition-colors ${status.rowTintClass} hover:bg-slate-50 dark:hover:bg-white/5`}
                        >
                          <td className="px-1.5 py-1 text-center font-bold text-[10px] text-purple-700 dark:text-purple-300 bg-purple-50/70 dark:bg-purple-950/40 border border-slate-300 dark:border-slate-700">
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
                                className={`p-0 text-center relative border border-slate-300 dark:border-slate-700 transition-colors ${
                                  day.isFriday
                                    ? 'bg-slate-200/90 dark:bg-slate-800/80'
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
                                  className="w-full h-7 px-0.5 text-center text-[10px] font-bold text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 bg-transparent focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-[#2BA5B5] transition-all"
                                />
                                {isSaving && (
                                  <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-[#2BA5B5] animate-ping" />
                                )}
                              </td>
                            );
                          })}

                          <td className="px-2 py-1 text-right font-extrabold text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700">
                            {totalWashRecv.toLocaleString()}
                          </td>

                          <td
                            className={`px-2 py-1 text-right font-bold border border-slate-300 dark:border-slate-700 ${
                              washRecvRemaining <= 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400 font-extrabold bg-rose-50/50 dark:bg-rose-950/30'
                            }`}
                            title={`Wash Recv Rem: ${washRecvRemaining}`}
                          >
                            {washRecvRemaining.toLocaleString()}
                          </td>
                        </tr>

                        {/* SUB-ROW 5: FINISHING */}
                        <tr
                          className={`transition-colors ${status.rowTintClass} hover:bg-slate-50 dark:hover:bg-white/5`}
                        >
                          <td className="px-1.5 py-1 text-center font-bold text-[10px] text-emerald-700 dark:text-emerald-300 bg-emerald-50/70 dark:bg-emerald-950/40 border border-slate-300 dark:border-slate-700">
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
                                className={`p-0 text-center relative border border-slate-300 dark:border-slate-700 transition-colors ${
                                  day.isFriday
                                    ? 'bg-slate-200/90 dark:bg-slate-800/80'
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
                                  className="w-full h-7 px-0.5 text-center text-[10px] font-bold text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 bg-transparent focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-[#2BA5B5] transition-all"
                                />
                                {isSaving && (
                                  <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-[#2BA5B5] animate-ping" />
                                )}
                              </td>
                            );
                          })}

                          <td className="px-2 py-1 text-right font-extrabold text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700">
                            {totalFinishing.toLocaleString()}
                          </td>

                          <td
                            className={`px-2 py-1 text-right font-bold border border-slate-300 dark:border-slate-700 ${
                              finishingRemaining <= 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400 font-extrabold bg-rose-50/50 dark:bg-rose-950/30'
                            }`}
                            title={`Finish Rem: ${finishingRemaining}`}
                          >
                            {finishingRemaining.toLocaleString()}
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })}
                </tbody>

                {/* Pinned Totals Row for this Line Group */}
                <tfoot className="sticky bottom-0 z-30 bg-slate-200 dark:bg-[#071B1E] text-slate-900 dark:text-white border-t-2 border-slate-400 dark:border-slate-600 font-black text-[10px] uppercase">
                  {/* Totals Row 1: INPUT TOTALS */}
                  <tr className="border-b border-slate-300 dark:border-slate-700">
                    <td
                      colSpan={4}
                      className="sticky left-0 z-40 bg-slate-200 dark:bg-[#071B1E] px-2.5 py-2 text-right border border-slate-300 dark:border-slate-700"
                    >
                      {config.label} TOTALS ({groupOrders.length} orders)
                    </td>
                    <td className="sticky left-[335px] z-40 bg-slate-200 dark:bg-[#071B1E] px-2.5 py-2 text-right border-r-2 border-slate-400 dark:border-slate-600 border border-slate-300 dark:border-slate-700 shadow-[4px_0_6px_-2px_rgba(0,0,0,0.06)]">
                      {groupOrders.reduce((s, o) => s + Number(o.order_qty || 0), 0).toLocaleString()}
                    </td>
                    <td colSpan={4} className="px-2 py-2 text-center text-slate-500 border border-slate-300 dark:border-slate-700">
                      -
                    </td>
                    <td className="px-2 py-2 text-right border border-slate-300 dark:border-slate-700">
                      {groupOrders.reduce((s, o) => s + Number(o.order_qty || 0), 0).toLocaleString()}
                    </td>
                    <td className="px-2 py-2 text-right border border-slate-300 dark:border-slate-700 text-emerald-700 dark:text-emerald-300">
                      {groupOrders.reduce((s, o) => s + Number(o.cutting_qty || 0), 0).toLocaleString()}
                    </td>
                    <td colSpan={2} className="px-2 py-2 text-center text-slate-500 border border-slate-300 dark:border-slate-700">
                      -
                    </td>
                    <td className="px-1.5 py-2 text-center font-bold text-teal-800 dark:text-teal-300 bg-teal-100/70 dark:bg-teal-950/60 border border-slate-300 dark:border-slate-700">
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
                          className={`px-1 py-2 text-center text-[10px] border border-slate-300 dark:border-slate-700 ${
                            day.isFriday ? 'bg-slate-300/80 dark:bg-slate-800' : ''
                          }`}
                        >
                          {dayIn ? dayIn.toLocaleString() : '-'}
                        </td>
                      );
                    })}
                    <td className="px-2 py-2 text-right border border-slate-300 dark:border-slate-700 text-teal-800 dark:text-teal-300">
                      {groupOrders.reduce((s, o) => s + Number(o.total_input || 0), 0).toLocaleString()}
                    </td>
                    <td className="px-2 py-2 text-right border border-slate-300 dark:border-slate-700">
                      -
                    </td>
                    <td className="px-2 py-2 text-right border border-slate-300 dark:border-slate-700 text-sky-800 dark:text-sky-300 font-bold">
                      {groupOrders.reduce((s, o) => s + Number(o.total_wash_sent || 0), 0).toLocaleString()}
                    </td>
                    <td className="px-2 py-2 text-right border border-slate-300 dark:border-slate-700 font-bold">
                      {groupOrders.reduce((s, o) => s + (Number(o.order_qty || 0) - Number(o.total_wash_sent || 0)), 0).toLocaleString()}
                    </td>
                    <td className="px-2 py-2 text-right border border-slate-300 dark:border-slate-700 text-purple-800 dark:text-purple-300 font-bold">
                      {groupOrders.reduce((s, o) => s + Number(o.total_wash_recv || 0), 0).toLocaleString()}
                    </td>
                    <td className="px-2 py-2 text-right border border-slate-300 dark:border-slate-700 font-bold">
                      {groupOrders.reduce((s, o) => s + (Number(o.total_wash_sent || 0) - Number(o.total_wash_recv || 0)), 0).toLocaleString()}
                    </td>
                    <td className="px-2 py-2 text-right border border-slate-300 dark:border-slate-700 text-emerald-800 dark:text-emerald-300 font-bold">
                      {groupOrders.reduce((s, o) => s + Number(o.total_finishing || 0), 0).toLocaleString()}
                    </td>
                    <td className="px-2 py-2 text-right border border-slate-300 dark:border-slate-700 font-bold">
                      {groupOrders.reduce((s, o) => s + (Number(o.total_wash_recv || 0) - Number(o.total_finishing || 0)), 0).toLocaleString()}
                    </td>
                    <td colSpan={isAdmin ? 2 : 1} className="px-2 py-2 text-center text-slate-500 border border-slate-300 dark:border-slate-700">
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
