import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, Layers, CheckCircle2 } from 'lucide-react';
import type { PlanningOrder } from '../../types/planning';
import { getOrderStatus } from '../../lib/planningStatus';

interface LineSummaryCardProps {
  orders: PlanningOrder[];
}

export const LineSummaryCard: React.FC<LineSummaryCardProps> = ({ orders }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showOnlyCutReady, setShowOnlyCutReady] = useState(true);

  // Filter orders according to HTML reference rule: cutting_qty > 0 && cutting_qty >= order_qty OR done
  const filteredOrders = useMemo(() => {
    if (!showOnlyCutReady) return orders;
    return orders.filter(
      (r) =>
        (r.cutting_qty > 0 && r.cutting_qty >= r.order_qty) || r.is_done
    );
  }, [orders, showOnlyCutReady]);

  // Group by line: Line-1, Line-2, Line-3, Line-4, No line yet
  const groupedByLine = useMemo(() => {
    const groups: Record<string, PlanningOrder[]> = {
      'Line-1': [],
      'Line-2': [],
      'Line-3': [],
      'Line-4': [],
      'No line yet': [],
    };

    filteredOrders.forEach((o) => {
      const line = (o.line_no || '').trim();
      if (line && groups[line]) {
        groups[line].push(o);
      } else if (line) {
        if (!groups[line]) groups[line] = [];
        groups[line].push(o);
      } else {
        groups['No line yet'].push(o);
      }
    });

    return groups;
  }, [filteredOrders]);

  // Compute Grand Total
  const grandTotal = useMemo(() => {
    let cuttingDone = 0;
    let inputDone = 0;
    let inputPending = 0;
    let outputDone = 0;
    let outputPending = 0;

    filteredOrders.forEach((o) => {
      const cut = Number(o.cutting_qty || 0);
      const inD = Number(o.total_input || 0);
      const outD = Number(o.total_output || 0);
      const inP = Math.max(0, cut - inD);
      const outP = Math.max(0, inD - outD);

      cuttingDone += cut;
      inputDone += inD;
      inputPending += inP;
      outputDone += outD;
      outputPending += outP;
    });

    return {
      cuttingDone,
      inputDone,
      inputPending,
      outputDone,
      outputPending,
      count: filteredOrders.length,
    };
  }, [filteredOrders]);

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0E2E33] shadow-soft-sm overflow-hidden">
      {/* Header bar */}
      <div className="px-5 py-3.5 bg-slate-50 dark:bg-[#082024] border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#2BA5B5]/10 text-[#2BA5B5] flex items-center justify-center font-bold">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              Line-wise Summary
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300 font-semibold">
                {filteredOrders.length} orders
              </span>
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bangla">
              লাইনভিত্তিক কাটিং, ইনপুট ও আউটপুট সামারি
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showOnlyCutReady}
              onChange={(e) => setShowOnlyCutReady(e.target.checked)}
              className="rounded border-slate-300 text-[#2BA5B5] focus:ring-[#2BA5B5]"
            />
            <span>Cut-ready orders only</span>
          </label>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400 transition-colors"
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="overflow-x-auto scrollbar-custom">
          {filteredOrders.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
              No orders qualify for line summary (cut-ready or completed). Uncheck &quot;Cut-ready orders only&quot; to view all lines.
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-[11px]">
              <thead className="bg-slate-100 dark:bg-[#0A262B] text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-white/10 text-[10px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-2 w-20">Line</th>
                  <th className="px-3 py-2 min-w-[90px]">PO</th>
                  <th className="px-3 py-2 min-w-[100px]">Style</th>
                  <th className="px-3 py-2 min-w-[90px]">Colour</th>
                  <th className="px-3 py-2 text-right">Cutting Done</th>
                  <th className="px-3 py-2 text-right">Input Done</th>
                  <th className="px-3 py-2 text-right">Input Pending</th>
                  <th className="px-3 py-2 text-right">Output Done</th>
                  <th className="px-3 py-2 text-right">Output Pending</th>
                  <th className="px-3 py-2 text-center w-28">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {Object.entries(groupedByLine).map(([lineName, groupOrders]) => {
                  if (groupOrders.length === 0) return null;

                  // Sub-totals for this line
                  let subCut = 0;
                  let subInD = 0;
                  let subInP = 0;
                  let subOutD = 0;
                  let subOutP = 0;

                  return (
                    <React.Fragment key={lineName}>
                      {groupOrders.map((order) => {
                        const cut = Number(order.cutting_qty || 0);
                        const inD = Number(order.total_input || 0);
                        const outD = Number(order.total_output || 0);
                        const inP = Math.max(0, cut - inD);
                        const outP = Math.max(0, inD - outD);

                        subCut += cut;
                        subInD += inD;
                        subInP += inP;
                        subOutD += outD;
                        subOutP += outP;

                        const status = getOrderStatus(order);

                        return (
                          <tr
                            key={order.id}
                            className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                          >
                            <td className="px-3 py-1.5 font-bold text-slate-700 dark:text-slate-300">
                              {lineName}
                            </td>
                            <td className="px-3 py-1.5 font-semibold text-slate-900 dark:text-white">
                              {order.po}
                            </td>
                            <td className="px-3 py-1.5 text-slate-600 dark:text-slate-400">
                              {order.style || '-'}
                            </td>
                            <td className="px-3 py-1.5 text-slate-600 dark:text-slate-400">
                              {order.colour || '-'}
                            </td>
                            <td className="px-3 py-1.5 text-right font-medium text-slate-700 dark:text-slate-300">
                              {cut.toLocaleString()}
                            </td>
                            <td className="px-3 py-1.5 text-right font-medium text-teal-700 dark:text-teal-400">
                              {inD.toLocaleString()}
                            </td>
                            <td
                              className={`px-3 py-1.5 text-right font-semibold ${
                                inP > 0
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-slate-400'
                              }`}
                            >
                              {inP.toLocaleString()}
                            </td>
                            <td className="px-3 py-1.5 text-right font-bold text-slate-900 dark:text-white">
                              {outD.toLocaleString()}
                            </td>
                            <td
                              className={`px-3 py-1.5 text-right font-semibold ${
                                outP > 0
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-slate-400'
                              }`}
                            >
                              {outP.toLocaleString()}
                            </td>
                            <td className="px-3 py-1.5 text-center">
                              <span
                                className={`inline-block px-2 py-0.5 rounded-full text-[9px] border font-medium ${status.badgeClass}`}
                              >
                                {status.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}

                      {/* Line Sub-total Row */}
                      <tr className="bg-slate-100/70 dark:bg-black/30 font-bold border-y border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-200">
                        <td colSpan={4} className="px-3 py-2 text-xs">
                          {lineName} Total · {groupOrders.length} {groupOrders.length === 1 ? 'order' : 'orders'}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {subCut.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right text-teal-700 dark:text-teal-400">
                          {subInD.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right text-amber-600 dark:text-amber-400">
                          {subInP.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right text-indigo-700 dark:text-indigo-400">
                          {subOutD.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right text-amber-600 dark:text-amber-400">
                          {subOutP.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-center text-[10px] text-slate-400">
                          -
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })}

                {/* Grand Total Row */}
                <tr className="bg-slate-200/90 dark:bg-[#06181B] font-extrabold border-t-2 border-slate-400 dark:border-white/20 text-slate-900 dark:text-white text-xs">
                  <td colSpan={4} className="px-3 py-2.5 uppercase tracking-wider">
                    Grand Total · {grandTotal.count} Orders
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {grandTotal.cuttingDone.toLocaleString()}
                  </td>
                  <td className="px-3 py-2.5 text-right text-[#0F8B8D] dark:text-teal-300">
                    {grandTotal.inputDone.toLocaleString()}
                  </td>
                  <td className="px-3 py-2.5 text-right text-amber-600 dark:text-amber-400">
                    {grandTotal.inputPending.toLocaleString()}
                  </td>
                  <td className="px-3 py-2.5 text-right text-indigo-700 dark:text-indigo-300">
                    {grandTotal.outputDone.toLocaleString()}
                  </td>
                  <td className="px-3 py-2.5 text-right text-amber-600 dark:text-amber-400">
                    {grandTotal.outputPending.toLocaleString()}
                  </td>
                  <td className="px-3 py-2.5 text-center text-slate-400">-</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};
