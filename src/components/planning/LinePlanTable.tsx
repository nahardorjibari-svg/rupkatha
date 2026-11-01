import React, { useState, useMemo } from 'react';
import { Trash2, Calendar } from 'lucide-react';
import type { PlanningOrder, DayColumn } from '../../types/planning';
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
    type: 'input' | 'output',
    val: string | number | null
  ) => Promise<void>;
}

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

  // Compute table totals
  const totals = useMemo(() => {
    let totalOrderQty = 0;
    let totalCuttingQty = 0;
    let totalInputQty = 0;
    let totalOutputQty = 0;
    let totalWashSend = 0;

    const dailyInputTotals: Record<string, number> = {};
    const dailyOutputTotals: Record<string, number> = {};

    days.forEach((d) => {
      dailyInputTotals[d.dateStr] = 0;
      dailyOutputTotals[d.dateStr] = 0;
    });

    orders.forEach((o) => {
      totalOrderQty += Number(o.order_qty || 0);
      totalCuttingQty += Number(o.cutting_qty || 0);
      totalInputQty += Number(o.total_input || 0);
      totalOutputQty += Number(o.total_output || 0);
      totalWashSend += Number(o.wash_send || 0);

      days.forEach((d) => {
        const inVal = dailyData[o.id]?.[d.dateStr]?.input_qty;
        const outVal = dailyData[o.id]?.[d.dateStr]?.output_qty;
        if (inVal) dailyInputTotals[d.dateStr] += Number(inVal);
        if (outVal) dailyOutputTotals[d.dateStr] += Number(outVal);
      });
    });

    return {
      totalOrderQty,
      totalCuttingQty,
      totalInputQty,
      totalOutputQty,
      totalWashSend,
      dailyInputTotals,
      dailyOutputTotals,
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
    <div className="relative w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0E2E33] shadow-soft-sm overflow-hidden">
      <div className="overflow-x-auto max-h-[calc(100vh-250px)] scrollbar-custom">
        <table className="w-full text-left border-collapse text-[11px]">
          {/* Header */}
          <thead className="sticky top-0 z-30 bg-slate-100 dark:bg-[#082024] text-slate-700 dark:text-slate-200 border-b border-slate-300 dark:border-white/15 select-none text-[10px] uppercase font-bold tracking-wider">
            <tr>
              {/* Sticky Column 1: SL */}
              <th className="sticky left-0 z-40 bg-slate-100 dark:bg-[#082024] px-2 py-2.5 text-center w-10 border-r border-slate-300 dark:border-white/10">
                SL
              </th>

              {/* Sticky Column 2: Buyer */}
              <th className="sticky left-10 z-40 bg-slate-100 dark:bg-[#082024] px-2.5 py-2.5 min-w-[95px] max-w-[120px] border-r border-slate-300 dark:border-white/10">
                Buyer
              </th>

              {/* Sticky Column 3: PO */}
              <th className="sticky left-[135px] z-40 bg-slate-100 dark:bg-[#082024] px-2.5 py-2.5 min-w-[95px] border-r border-slate-300 dark:border-white/10">
                PO
              </th>

              {/* Sticky Column 4: Style */}
              <th className="sticky left-[230px] z-40 bg-slate-100 dark:bg-[#082024] px-2.5 py-2.5 min-w-[105px] border-r border-slate-300 dark:border-white/10">
                Style
              </th>

              {/* Sticky Column 5: Order Qty (PO total) */}
              <th className="sticky left-[335px] z-40 bg-slate-100 dark:bg-[#082024] px-2.5 py-2.5 text-right min-w-[80px] border-r-2 border-slate-400 dark:border-white/20 shadow-[4px_0_6px_-2px_rgba(0,0,0,0.06)]">
                Order Qty
              </th>

              {/* Column 5: Colour */}
              <th className="px-2 py-2.5 min-w-[85px] border-r border-slate-200 dark:border-white/10">
                Colour
              </th>

              {/* Column 6: Wash */}
              <th className="px-2 py-2.5 min-w-[75px] border-r border-slate-200 dark:border-white/10">
                Wash
              </th>

              {/* Column 7: Line */}
              <th className="px-2 py-2.5 min-w-[80px] border-r border-slate-200 dark:border-white/10">
                Line
              </th>

              {/* Column 8: Start Date */}
              <th className="px-2 py-2.5 min-w-[105px] border-r border-slate-200 dark:border-white/10">
                Start Date
              </th>

              {/* Column 9: Qty (Colour Row Order Qty) */}
              <th className="px-2 py-2.5 text-right min-w-[65px] border-r border-slate-200 dark:border-white/10">
                Qty
              </th>

              {/* Column 10: Cutting */}
              <th className="px-2 py-2.5 text-right min-w-[70px] border-r border-slate-200 dark:border-white/10">
                Cutting
              </th>

              {/* Column 11: Extra % */}
              <th className="px-1.5 py-2.5 text-right min-w-[60px] border-r border-slate-200 dark:border-white/10">
                Extra %
              </th>

              {/* Column 12: Cut Status */}
              <th className="px-2 py-2.5 text-center min-w-[75px] border-r border-slate-200 dark:border-white/10">
                Cut Status
              </th>

              {/* Column 13: Type (INPUT / OUTPUT) */}
              <th className="px-2 py-2.5 text-center min-w-[60px] border-r border-slate-300 dark:border-white/15 bg-slate-200/50 dark:bg-black/20">
                Type
              </th>

              {/* 30 Day Columns */}
              {days.map((day) => (
                <th
                  key={day.dateStr}
                  className={`px-1 py-1 text-center min-w-[50px] border-r border-slate-200 dark:border-white/10 ${
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

              {/* Column: Total */}
              <th className="px-2 py-2.5 text-right min-w-[65px] border-r border-slate-200 dark:border-white/10">
                Total
              </th>

              {/* Column: Balance */}
              <th className="px-2 py-2.5 text-right min-w-[70px] border-r border-slate-200 dark:border-white/10">
                Bal.
              </th>

              {/* Column: Wash Send */}
              <th className="px-2 py-2.5 text-right min-w-[70px] border-r border-slate-200 dark:border-white/10">
                Wash Send
              </th>

              {/* Column: Send Bal. */}
              <th className="px-2 py-2.5 text-right min-w-[70px] border-r border-slate-300 dark:border-white/15">
                Send Bal.
              </th>

              {/* Column: Status */}
              <th className="px-3 py-2.5 text-center min-w-[130px] border-r border-slate-300 dark:border-white/15">
                Status
              </th>

              {/* Column: Action (Admin Delete) */}
              {isAdmin && (
                <th className="px-2 py-2.5 text-center w-9">
                  Act
                </th>
              )}
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-slate-200 dark:divide-white/10">
            {orders.map((order, index) => {
              const status = getOrderStatus(order);
              const orderId = order.id;

              const totalInput = Number(order.total_input || 0);
              const totalOutput = Number(order.total_output || 0);
              const rowOrderQty = Number(order.order_qty || 0);
              const cuttingQty = Number(order.cutting_qty || 0);
              const washSend = Number(order.wash_send || 0);

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
                'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300';
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
              const sendBalance = washSend - totalOutput;

              return (
                <React.Fragment key={orderId}>
                  {/* SUB-ROW 1: INPUT */}
                  <tr
                    className={`transition-colors ${status.rowTintClass} hover:bg-slate-50 dark:hover:bg-white/5 border-t border-slate-200 dark:border-white/10`}
                  >
                    {/* Sticky Column 1: SL (Rowspan 2) */}
                    <td
                      rowSpan={2}
                      className={`sticky left-0 z-20 px-2 py-1.5 text-center font-bold text-slate-500 dark:text-slate-400 border-r border-slate-300 dark:border-white/10 ${status.rowTintClass} bg-inherit`}
                    >
                      {index + 1}
                    </td>

                    {/* Sticky Column 2: Buyer (Rowspan 2) */}
                    <td
                      rowSpan={2}
                      className={`sticky left-10 z-20 px-2.5 py-1.5 font-bold text-slate-800 dark:text-slate-200 border-r border-slate-300 dark:border-white/10 whitespace-nowrap max-w-[120px] truncate ${status.rowTintClass} bg-inherit`}
                      title={order.buyer || '-'}
                    >
                      {order.buyer && order.buyer.trim() ? highlightMatch(order.buyer) : '-'}
                    </td>

                    {/* Sticky Column 3: PO (Rowspan 2) */}
                    <td
                      rowSpan={2}
                      className={`sticky left-[135px] z-20 px-2.5 py-1.5 font-extrabold text-slate-900 dark:text-white border-r border-slate-300 dark:border-white/10 whitespace-nowrap ${status.rowTintClass} bg-inherit`}
                    >
                      {highlightMatch(order.po)}
                    </td>

                    {/* Sticky Column 4: Style (Rowspan 2) */}
                    <td
                      rowSpan={2}
                      className={`sticky left-[230px] z-20 px-2.5 py-1.5 font-medium text-slate-700 dark:text-slate-300 border-r border-slate-300 dark:border-white/10 max-w-[130px] truncate ${status.rowTintClass} bg-inherit`}
                      title={order.style || ''}
                    >
                      {highlightMatch(order.style)}
                    </td>

                    {/* Sticky Column 5: Order Qty (PO total, Rowspan 2) */}
                    <td
                      rowSpan={2}
                      className={`sticky left-[335px] z-20 px-2.5 py-1.5 text-right font-black text-slate-900 dark:text-white border-r-2 border-slate-400 dark:border-white/20 shadow-[4px_0_6px_-2px_rgba(0,0,0,0.06)] ${status.rowTintClass} bg-inherit`}
                    >
                      {poTotalOrderQty.toLocaleString()}
                    </td>

                    {/* Column 5: Colour (Rowspan 2) */}
                    <td
                      rowSpan={2}
                      className="px-2 py-1.5 text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-white/10 font-medium whitespace-nowrap"
                    >
                      {highlightMatch(order.colour) || '-'}
                    </td>

                    {/* Column 6: Wash (Rowspan 2) */}
                    <td
                      rowSpan={2}
                      className="px-2 py-1.5 text-slate-600 dark:text-slate-400 border-r border-slate-200 dark:border-white/10 text-[10px]"
                    >
                      {order.wash || '-'}
                    </td>

                    {/* Column 7: Line (Rowspan 2, inline select) */}
                    <td
                      rowSpan={2}
                      className="px-1 py-1 border-r border-slate-200 dark:border-white/10"
                    >
                      <select
                        value={order.line_no || ''}
                        onChange={(e) =>
                          onUpdateOrder(orderId, { line_no: e.target.value })
                        }
                        className="w-full px-1.5 py-1 text-[11px] font-bold rounded border border-transparent hover:border-slate-300 dark:hover:border-white/20 focus:border-[#2BA5B5] bg-transparent focus:bg-white dark:focus:bg-slate-900 transition-all cursor-pointer"
                      >
                        <option value="">No line</option>
                        <option value="Line-1">Line-1</option>
                        <option value="Line-2">Line-2</option>
                        <option value="Line-3">Line-3</option>
                        <option value="Line-4">Line-4</option>
                      </select>
                    </td>

                    {/* Column 8: Start Date (Rowspan 2, inline date input with amber background) */}
                    <td
                      rowSpan={2}
                      className="px-1 py-1 border-r border-slate-200 dark:border-white/10"
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

                    {/* Column 9: Qty (Colour Row Order Qty, Rowspan 2) */}
                    <td
                      rowSpan={2}
                      className="px-2 py-1.5 text-right font-extrabold text-slate-800 dark:text-slate-200 border-r border-slate-200 dark:border-white/10"
                    >
                      {rowOrderQty.toLocaleString()}
                    </td>

                    {/* Column 10: Cutting (Rowspan 2, inline number input) */}
                    <td
                      rowSpan={2}
                      className="px-1 py-1 border-r border-slate-200 dark:border-white/10"
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
                        className="w-full h-7 px-1 text-right text-[11px] font-bold text-slate-900 dark:text-white rounded border border-transparent hover:border-slate-300 dark:hover:border-white/20 focus:border-[#2BA5B5] bg-transparent focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-[#2BA5B5]"
                      />
                    </td>

                    {/* Column 11: Extra % (Rowspan 2) */}
                    <td
                      rowSpan={2}
                      className={`px-1.5 py-1.5 text-right font-bold text-[10px] border-r border-slate-200 dark:border-white/10 ${
                        extraPct > 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : extraPct < 0
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {extraPct > 0 ? `+${extraPct}%` : `${extraPct}%`}
                    </td>

                    {/* Column 12: Cut Status (Rowspan 2) */}
                    <td
                      rowSpan={2}
                      className="px-1.5 py-1 text-center border-r border-slate-200 dark:border-white/10"
                    >
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold border whitespace-nowrap ${cutStatusClass}`}
                      >
                        {cutStatusLabel}
                      </span>
                    </td>

                    {/* Column 13: Type (INPUT) */}
                    <td className="px-1.5 py-1 text-center font-bold text-[10px] text-teal-700 dark:text-teal-300 bg-teal-50/70 dark:bg-teal-950/40 border-r border-slate-300 dark:border-white/15">
                      INPUT
                    </td>

                    {/* 30 Daily INPUT cells */}
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
                          className={`p-0 text-center relative border-r border-slate-200 dark:border-white/10 transition-colors ${
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
                    <td className="px-2 py-1 text-right font-extrabold text-slate-900 dark:text-white border-r border-slate-200 dark:border-white/10">
                      {totalInput.toLocaleString()}
                    </td>

                    {/* Bal. (INPUT: cutting_qty - total_input) */}
                    <td
                      className={`px-2 py-1 text-right font-bold border-r border-slate-200 dark:border-white/10 ${
                        inputBalance <= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {inputBalance.toLocaleString()}
                    </td>

                    {/* Wash Send (Rowspan 2, inline number input) */}
                    <td
                      rowSpan={2}
                      className="px-1 py-1 border-r border-slate-200 dark:border-white/10"
                    >
                      <input
                        type="number"
                        min="0"
                        defaultValue={washSend || ''}
                        key={`wash_${orderId}_${washSend}`}
                        placeholder="0"
                        onBlur={(e) => {
                          const val = parseInt(e.target.value, 10);
                          const cleanVal = isNaN(val) ? 0 : Math.max(0, val);
                          if (cleanVal !== washSend) {
                            onUpdateOrder(orderId, { wash_send: cleanVal });
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            (e.target as HTMLInputElement).blur();
                          }
                        }}
                        className="w-full h-7 px-1 text-right text-[11px] font-semibold text-slate-900 dark:text-white rounded border border-transparent hover:border-slate-300 dark:hover:border-white/20 focus:border-[#2BA5B5] bg-transparent focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-[#2BA5B5]"
                      />
                    </td>

                    {/* Send Bal. (Rowspan 2: wash_send - total_output) */}
                    <td
                      rowSpan={2}
                      className={`px-2 py-1 text-right font-bold border-r border-slate-300 dark:border-white/15 ${
                        sendBalance < 0
                          ? 'text-rose-600 dark:text-rose-400'
                          : sendBalance === 0 && washSend > 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {sendBalance.toLocaleString()}
                    </td>

                    {/* Status Badge (Rowspan 2) */}
                    <td
                      rowSpan={2}
                      className={`px-2 py-1 text-center border-r border-slate-300 dark:border-white/15 ${status.rowTintClass} bg-inherit`}
                    >
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] border whitespace-nowrap font-medium ${status.badgeClass}`}
                      >
                        {status.label}
                      </span>
                    </td>

                    {/* Admin Delete Action (Rowspan 2) */}
                    {isAdmin && (
                      <td
                        rowSpan={2}
                        className={`px-1 py-1 text-center ${status.rowTintClass} bg-inherit`}
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
                    <td className="px-1.5 py-1 text-center font-bold text-[10px] text-indigo-700 dark:text-indigo-300 bg-indigo-50/60 dark:bg-indigo-950/30 border-r border-slate-300 dark:border-white/15">
                      OUTPUT
                    </td>

                    {/* 30 Daily OUTPUT cells */}
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
                          className={`p-0 text-center relative border-r border-slate-200 dark:border-white/10 transition-colors ${
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
                    <td className="px-2 py-1 text-right font-extrabold text-slate-900 dark:text-white border-r border-slate-200 dark:border-white/10">
                      {totalOutput.toLocaleString()}
                    </td>

                    {/* Bal. (OUTPUT: total_input - total_output) */}
                    <td
                      className={`px-2 py-1 text-right font-bold border-r border-slate-200 dark:border-white/10 ${
                        outputBalance <= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {outputBalance.toLocaleString()}
                    </td>
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>

          {/* Pinned Totals Row */}
          <tfoot className="sticky bottom-0 z-30 bg-slate-200 dark:bg-[#071B1E] text-slate-900 dark:text-white border-t-2 border-slate-400 dark:border-white/20 font-black text-[10px] uppercase">
            {/* Totals Row 1: INPUT TOTALS */}
            <tr className="border-b border-slate-300 dark:border-white/10">
              <td
                colSpan={4}
                className="sticky left-0 z-40 bg-slate-200 dark:bg-[#071B1E] px-2.5 py-2 text-right border-r border-slate-300 dark:border-white/10"
              >
                TOTALS ({orders.length} orders)
              </td>
              <td className="sticky left-[335px] z-40 bg-slate-200 dark:bg-[#071B1E] px-2.5 py-2 text-right border-r-2 border-slate-400 dark:border-white/20 shadow-[4px_0_6px_-2px_rgba(0,0,0,0.06)]">
                {totals.totalOrderQty.toLocaleString()}
              </td>
              <td colSpan={4} className="px-2 py-2 text-center text-slate-500 border-r border-slate-300 dark:border-white/10">
                -
              </td>
              <td className="px-2 py-2 text-right border-r border-slate-300 dark:border-white/10">
                {totals.totalOrderQty.toLocaleString()}
              </td>
              <td className="px-2 py-2 text-right border-r border-slate-300 dark:border-white/10 text-emerald-700 dark:text-emerald-300">
                {totals.totalCuttingQty.toLocaleString()}
              </td>
              <td colSpan={2} className="px-2 py-2 text-center text-slate-500 border-r border-slate-300 dark:border-white/10">
                -
              </td>
              <td className="px-1.5 py-2 text-center font-bold text-teal-800 dark:text-teal-300 bg-teal-100/70 dark:bg-teal-950/60 border-r border-slate-300 dark:border-white/15">
                IN Σ
              </td>
              {days.map((day) => (
                <td
                  key={`sum_in_${day.dateStr}`}
                  className={`px-1 py-2 text-center text-[10px] border-r border-slate-300 dark:border-white/10 ${
                    day.isFriday ? 'bg-slate-300/80 dark:bg-slate-800' : ''
                  }`}
                >
                  {totals.dailyInputTotals[day.dateStr]
                    ? totals.dailyInputTotals[day.dateStr].toLocaleString()
                    : '-'}
                </td>
              ))}
              <td className="px-2 py-2 text-right border-r border-slate-300 dark:border-white/10 text-teal-800 dark:text-teal-300">
                {totals.totalInputQty.toLocaleString()}
              </td>
              <td className="px-2 py-2 text-right border-r border-slate-300 dark:border-white/10">
                {(totals.totalCuttingQty - totals.totalInputQty).toLocaleString()}
              </td>
              <td className="px-2 py-2 text-right border-r border-slate-300 dark:border-white/10">
                {totals.totalWashSend.toLocaleString()}
              </td>
              <td className="px-2 py-2 text-right border-r border-slate-300 dark:border-white/15">
                {(totals.totalWashSend - totals.totalOutputQty).toLocaleString()}
              </td>
              <td colSpan={isAdmin ? 2 : 1} className="px-2 py-2 text-center text-slate-500">
                -
              </td>
            </tr>

            {/* Totals Row 2: OUTPUT TOTALS */}
            <tr>
              <td
                colSpan={13}
                className="sticky left-0 z-40 bg-slate-200 dark:bg-[#071B1E] px-2.5 py-1.5 text-right text-slate-500 border-r border-slate-300 dark:border-white/10"
              >
                OUTPUT DAILY TOTALS
              </td>
              <td className="px-1.5 py-1.5 text-center font-bold text-indigo-800 dark:text-indigo-300 bg-indigo-100/70 dark:bg-indigo-950/60 border-r border-slate-300 dark:border-white/15">
                OUT Σ
              </td>
              {days.map((day) => (
                <td
                  key={`sum_out_${day.dateStr}`}
                  className={`px-1.5 py-1.5 text-center text-[10px] border-r border-slate-300 dark:border-white/10 ${
                    day.isFriday ? 'bg-slate-300/80 dark:bg-slate-800' : ''
                  }`}
                >
                  {totals.dailyOutputTotals[day.dateStr]
                    ? totals.dailyOutputTotals[day.dateStr].toLocaleString()
                    : '-'}
                </td>
              ))}
              <td className="px-2 py-1.5 text-right border-r border-slate-300 dark:border-white/10 text-indigo-800 dark:text-indigo-300">
                {totals.totalOutputQty.toLocaleString()}
              </td>
              <td className="px-2 py-1.5 text-right border-r border-slate-300 dark:border-white/10">
                {(totals.totalInputQty - totals.totalOutputQty).toLocaleString()}
              </td>
              <td colSpan={isAdmin ? 3 : 2} className="px-2 py-1.5 text-center text-slate-500">
                -
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};
