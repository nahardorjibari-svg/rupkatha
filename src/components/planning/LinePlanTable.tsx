import React, { useState, useMemo } from 'react';
import { Trash2, Loader2, Calendar } from 'lucide-react';
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

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
      {/* Scrollable table container with sticky columns */}
      <div className="overflow-x-auto max-h-[calc(100vh-250px)] scrollbar-custom">
        <table className="w-full text-left border-collapse text-[11px]">
          {/* Header */}
          <thead className="sticky top-0 z-30 bg-slate-100 dark:bg-[#082024] text-slate-700 dark:text-slate-200 border-b border-slate-300 dark:border-white/15 select-none text-[10px] uppercase font-bold tracking-wider">
            <tr>
              {/* Sticky Left Column 1: Admin Delete */}
              {isAdmin && (
                <th className="sticky left-0 z-40 bg-slate-100 dark:bg-[#082024] px-2 py-2.5 text-center w-8 border-r border-slate-300 dark:border-white/10">
                  Act
                </th>
              )}

              {/* Sticky Left Column 2: Line */}
              <th
                className={`sticky z-40 bg-slate-100 dark:bg-[#082024] px-2 py-2.5 w-24 border-r border-slate-300 dark:border-white/10 ${
                  isAdmin ? 'left-8' : 'left-0'
                }`}
              >
                Line
              </th>

              {/* Sticky Left Column 3: Start Date */}
              <th
                className={`sticky z-40 bg-slate-100 dark:bg-[#082024] px-2 py-2.5 w-24 border-r border-slate-300 dark:border-white/10 ${
                  isAdmin ? 'left-32' : 'left-24'
                }`}
              >
                Start Date
              </th>

              {/* Sticky Left Column 4: PO */}
              <th
                className={`sticky z-40 bg-slate-100 dark:bg-[#082024] px-2.5 py-2.5 min-w-[100px] border-r border-slate-300 dark:border-white/10 ${
                  isAdmin ? 'left-56' : 'left-48'
                }`}
              >
                PO
              </th>

              {/* Non-sticky order metadata */}
              <th className="px-2.5 py-2.5 min-w-[100px] border-r border-slate-200 dark:border-white/10">
                Style
              </th>
              <th className="px-2 py-2.5 min-w-[80px] border-r border-slate-200 dark:border-white/10">
                Colour
              </th>
              <th className="px-2 py-2.5 min-w-[70px] border-r border-slate-200 dark:border-white/10">
                Wash
              </th>
              <th className="px-2 py-2.5 text-right min-w-[70px] border-r border-slate-200 dark:border-white/10">
                Order Qty
              </th>
              <th className="px-2 py-2.5 text-right min-w-[70px] border-r border-slate-200 dark:border-white/10">
                Cutting
              </th>
              <th className="px-2 py-2.5 text-right min-w-[65px] border-r border-slate-200 dark:border-white/10">
                Wash Send
              </th>
              <th className="px-2 py-2.5 text-center min-w-[55px] border-r border-slate-300 dark:border-white/15 bg-slate-200/50 dark:bg-black/20">
                Type
              </th>
              <th className="px-2 py-2.5 text-right min-w-[65px] border-r border-slate-200 dark:border-white/10">
                Total
              </th>
              <th className="px-2 py-2.5 text-right min-w-[60px] border-r border-slate-200 dark:border-white/10">
                Extra %
              </th>
              <th className="px-2 py-2.5 text-right min-w-[65px] border-r border-slate-300 dark:border-white/20">
                Balance
              </th>

              {/* 30 Day Columns */}
              {days.map((day) => (
                <th
                  key={day.dateStr}
                  className={`px-1.5 py-1.5 text-center min-w-[52px] border-r border-slate-200 dark:border-white/10 ${
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

              {/* Status Header */}
              <th className="sticky right-0 z-30 bg-slate-100 dark:bg-[#082024] px-3 py-2.5 text-center min-w-[120px] border-l border-slate-300 dark:border-white/15 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.05)]">
                Status
              </th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-slate-200 dark:divide-white/10">
            {orders.map((order) => {
              const status = getOrderStatus(order);
              const orderId = order.id;

              const totalInput = Number(order.total_input || 0);
              const totalOutput = Number(order.total_output || 0);
              const orderQty = Number(order.order_qty || 0);
              const cuttingQty = Number(order.cutting_qty || 0);

              // Extra % calculations
              const inputExtraPct =
                orderQty > 0
                  ? (((totalInput - orderQty) / orderQty) * 100).toFixed(1)
                  : '0.0';
              const outputExtraPct =
                orderQty > 0
                  ? (((totalOutput - orderQty) / orderQty) * 100).toFixed(1)
                  : '0.0';

              // Balances
              const inputBalance = cuttingQty - totalInput;
              const outputBalance = totalInput - totalOutput;

              return (
                <React.Fragment key={orderId}>
                  {/* SUB-ROW 1: INPUT */}
                  <tr
                    className={`transition-colors ${status.rowTintClass} hover:bg-slate-50 dark:hover:bg-white/5 border-t border-slate-200 dark:border-white/10`}
                  >
                    {/* Admin Delete Action (Rowspan 2) */}
                    {isAdmin && (
                      <td
                        rowSpan={2}
                        className={`sticky left-0 z-20 px-1 py-1 text-center border-r border-slate-300 dark:border-white/10 ${status.rowTintClass} bg-inherit`}
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

                    {/* Line No (Rowspan 2) */}
                    <td
                      rowSpan={2}
                      className={`sticky z-20 px-1 py-1 border-r border-slate-300 dark:border-white/10 ${
                        isAdmin ? 'left-8' : 'left-0'
                      } ${status.rowTintClass} bg-inherit`}
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

                    {/* Start Date (Rowspan 2) */}
                    <td
                      rowSpan={2}
                      className={`sticky z-20 px-1 py-1 border-r border-slate-300 dark:border-white/10 ${
                        isAdmin ? 'left-32' : 'left-24'
                      } ${status.rowTintClass} bg-inherit`}
                    >
                      <input
                        type="date"
                        value={order.start_date || ''}
                        onChange={(e) =>
                          onUpdateOrder(orderId, {
                            start_date: e.target.value || null,
                          })
                        }
                        className="w-full px-1 py-0.5 text-[10px] rounded border border-transparent hover:border-slate-300 dark:hover:border-white/20 focus:border-[#2BA5B5] bg-transparent focus:bg-white dark:focus:bg-slate-900"
                      />
                    </td>

                    {/* PO (Rowspan 2) */}
                    <td
                      rowSpan={2}
                      className={`sticky z-20 px-2 py-1 font-bold text-slate-900 dark:text-white border-r border-slate-300 dark:border-white/10 ${
                        isAdmin ? 'left-56' : 'left-48'
                      } ${status.rowTintClass} bg-inherit`}
                    >
                      <div className="truncate max-w-[120px]" title={order.po}>
                        {highlightMatch(order.po)}
                      </div>
                    </td>

                    {/* Style (Rowspan 2) */}
                    <td
                      rowSpan={2}
                      className="px-2 py-1 text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-white/10"
                    >
                      <div
                        className="truncate max-w-[120px]"
                        title={order.style || '-'}
                      >
                        {highlightMatch(order.style)}
                      </div>
                    </td>

                    {/* Colour (Rowspan 2) */}
                    <td
                      rowSpan={2}
                      className="px-2 py-1 text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-white/10"
                    >
                      <div
                        className="truncate max-w-[100px]"
                        title={order.colour || '-'}
                      >
                        {order.colour || '-'}
                      </div>
                    </td>

                    {/* Wash (Rowspan 2) */}
                    <td
                      rowSpan={2}
                      className="px-2 py-1 text-slate-600 dark:text-slate-400 border-r border-slate-200 dark:border-white/10"
                    >
                      <div
                        className="truncate max-w-[90px]"
                        title={order.wash || '-'}
                      >
                        {order.wash || '-'}
                      </div>
                    </td>

                    {/* Order Qty (Rowspan 2) */}
                    <td
                      rowSpan={2}
                      className="px-2 py-1 text-right font-extrabold text-slate-900 dark:text-white border-r border-slate-200 dark:border-white/10"
                    >
                      {orderQty.toLocaleString()}
                    </td>

                    {/* Cutting Qty (Rowspan 2) */}
                    <td
                      rowSpan={2}
                      className="px-1 py-1 text-right border-r border-slate-200 dark:border-white/10"
                    >
                      <input
                        type="number"
                        min="0"
                        defaultValue={order.cutting_qty ?? 0}
                        onBlur={(e) => {
                          const val = Math.max(
                            0,
                            parseInt(e.target.value, 10) || 0
                          );
                          if (val !== order.cutting_qty) {
                            onUpdateOrder(orderId, { cutting_qty: val });
                          }
                        }}
                        className="w-16 px-1.5 py-0.5 text-right font-bold text-[11px] rounded border border-transparent hover:border-slate-300 dark:hover:border-white/20 focus:border-[#2BA5B5] bg-transparent focus:bg-white dark:focus:bg-slate-900"
                      />
                    </td>

                    {/* Wash Send (Rowspan 2) */}
                    <td
                      rowSpan={2}
                      className="px-1 py-1 text-right border-r border-slate-200 dark:border-white/10"
                    >
                      <input
                        type="number"
                        min="0"
                        defaultValue={order.wash_send ?? 0}
                        onBlur={(e) => {
                          const val = Math.max(
                            0,
                            parseInt(e.target.value, 10) || 0
                          );
                          if (val !== order.wash_send) {
                            onUpdateOrder(orderId, { wash_send: val });
                          }
                        }}
                        className="w-14 px-1.5 py-0.5 text-right font-medium text-[11px] rounded border border-transparent hover:border-slate-300 dark:hover:border-white/20 focus:border-[#2BA5B5] bg-transparent focus:bg-white dark:focus:bg-slate-900"
                      />
                    </td>

                    {/* ROW 1 METRIC: INPUT */}
                    <td className="px-1.5 py-1 text-center font-bold text-[10px] text-teal-700 dark:text-teal-300 bg-teal-50/60 dark:bg-teal-950/30 border-r border-slate-300 dark:border-white/15">
                      IN
                    </td>

                    {/* Total Input */}
                    <td className="px-2 py-1 text-right font-bold text-slate-800 dark:text-slate-200 border-r border-slate-200 dark:border-white/10">
                      {totalInput.toLocaleString()}
                    </td>

                    {/* Input Extra % */}
                    <td
                      className={`px-2 py-1 text-right font-semibold text-[10px] border-r border-slate-200 dark:border-white/10 ${
                        Number(inputExtraPct) >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {Number(inputExtraPct) > 0 ? `+${inputExtraPct}%` : `${inputExtraPct}%`}
                    </td>

                    {/* Input Balance */}
                    <td
                      className={`px-2 py-1 text-right font-bold border-r border-slate-300 dark:border-white/20 ${
                        inputBalance <= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {inputBalance.toLocaleString()}
                    </td>

                    {/* Row 1: 30 Daily INPUT cells */}
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
                            className="w-full h-7 px-0.5 text-center text-[10px] font-bold text-slate-800 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-600 bg-transparent focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-[#2BA5B5] transition-all"
                          />
                          {isSaving && (
                            <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-[#2BA5B5] animate-ping" />
                          )}
                        </td>
                      );
                    })}

                    {/* Status Badge (Rowspan 2) */}
                    <td
                      rowSpan={2}
                      className={`sticky right-0 z-20 px-2.5 py-1 text-center border-l border-slate-300 dark:border-white/15 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.05)] ${status.rowTintClass} bg-inherit`}
                    >
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] border whitespace-nowrap ${status.badgeClass}`}
                      >
                        {status.label}
                      </span>
                    </td>
                  </tr>

                  {/* SUB-ROW 2: OUTPUT */}
                  <tr
                    className={`transition-colors ${status.rowTintClass} hover:bg-slate-50 dark:hover:bg-white/5`}
                  >
                    {/* ROW 2 METRIC: OUTPUT */}
                    <td className="px-1.5 py-1 text-center font-bold text-[10px] text-indigo-700 dark:text-indigo-300 bg-indigo-50/60 dark:bg-indigo-950/30 border-r border-slate-300 dark:border-white/15">
                      OUT
                    </td>

                    {/* Total Output */}
                    <td className="px-2 py-1 text-right font-extrabold text-slate-900 dark:text-white border-r border-slate-200 dark:border-white/10">
                      {totalOutput.toLocaleString()}
                    </td>

                    {/* Output Extra % */}
                    <td
                      className={`px-2 py-1 text-right font-semibold text-[10px] border-r border-slate-200 dark:border-white/10 ${
                        Number(outputExtraPct) >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {Number(outputExtraPct) > 0 ? `+${outputExtraPct}%` : `${outputExtraPct}%`}
                    </td>

                    {/* Output Balance */}
                    <td
                      className={`px-2 py-1 text-right font-bold border-r border-slate-300 dark:border-white/20 ${
                        outputBalance <= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {outputBalance.toLocaleString()}
                    </td>

                    {/* Row 2: 30 Daily OUTPUT cells */}
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
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
