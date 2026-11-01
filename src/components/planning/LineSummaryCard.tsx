import React, { useMemo } from 'react';
import { Layers, FileSpreadsheet, Printer } from 'lucide-react';
import type { PlanningOrder } from '../../types/planning';
import { getOrderStatus } from '../../lib/planningStatus';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';

interface LineSummaryCardProps {
  orders: PlanningOrder[];
  isStandalone?: boolean;
  unitLabel?: string;
  dateStr?: string;
}

export const LineSummaryCard: React.FC<LineSummaryCardProps> = ({
  orders,
  isStandalone = false,
  unitLabel = 'Knit & Woven',
  dateStr = new Date().toLocaleDateString(),
}) => {
  // Filter orders according to HTML reference rule: cutting_qty > 0 && cutting_qty >= order_qty OR done
  const filteredOrders = useMemo(() => {
    return orders.filter(
      (r) =>
        (r.cutting_qty > 0 && r.cutting_qty >= r.order_qty) || r.is_done
    );
  }, [orders]);

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
    let washSentDone = 0;
    let washRecvDone = 0;
    let finishingDone = 0;

    filteredOrders.forEach((o) => {
      const cut = Number(o.cutting_qty || 0);
      const inD = Number(o.total_input || 0);
      const outD = Number(o.total_output || 0);
      const wsD = Number(o.total_wash_sent || 0);
      const wrD = Number(o.total_wash_recv || 0);
      const fnD = Number(o.total_finishing || 0);
      const inP = Math.max(0, cut - inD);
      const outP = Math.max(0, inD - outD);

      cuttingDone += cut;
      inputDone += inD;
      inputPending += inP;
      outputDone += outD;
      outputPending += outP;
      washSentDone += wsD;
      washRecvDone += wrD;
      finishingDone += fnD;
    });

    return {
      cuttingDone,
      inputDone,
      inputPending,
      outputDone,
      outputPending,
      washSentDone,
      washRecvDone,
      finishingDone,
      count: filteredOrders.length,
    };
  }, [filteredOrders]);

  // Excel Export for Line Summary
  const exportSummaryExcel = () => {
    try {
      const rows: any[][] = [];
      rows.push(['RUPKATHA APPARELS LTD. — LINE SUMMARY']);
      rows.push([`Unit: ${unitLabel} | Date: ${dateStr}`]);
      rows.push([]);
      rows.push([
        'Line',
        'Buyer',
        'PO',
        'Style',
        'Colour',
        'Cutting Done',
        'Input Done',
        'Input Pending',
        'Output Done',
        'Output Pending',
        'Wash Sent',
        'Wash Recv',
        'Finishing',
        'Status',
      ]);

      Object.entries(groupedByLine).forEach(([lineName, groupOrders]) => {
        if (groupOrders.length === 0) return;
        let subCut = 0;
        let subInD = 0;
        let subInP = 0;
        let subOutD = 0;
        let subOutP = 0;
        let subWashSent = 0;
        let subWashRecv = 0;
        let subFinishing = 0;

        groupOrders.forEach((order) => {
          const cut = Number(order.cutting_qty || 0);
          const inD = Number(order.total_input || 0);
          const outD = Number(order.total_output || 0);
          const wsD = Number(order.total_wash_sent || 0);
          const wrD = Number(order.total_wash_recv || 0);
          const fnD = Number(order.total_finishing || 0);
          const inP = Math.max(0, cut - inD);
          const outP = Math.max(0, inD - outD);
          const status = getOrderStatus(order);

          subCut += cut;
          subInD += inD;
          subInP += inP;
          subOutD += outD;
          subOutP += outP;
          subWashSent += wsD;
          subWashRecv += wrD;
          subFinishing += fnD;

          rows.push([
            lineName,
            order.buyer || '-',
            order.po,
            order.style || '',
            order.colour || '',
            cut,
            inD,
            inP,
            outD,
            outP,
            wsD,
            wrD,
            fnD,
            status.label,
          ]);
        });

        rows.push([
          `${lineName} Total`,
          '',
          '',
          '',
          '',
          subCut,
          subInD,
          subInP,
          subOutD,
          subOutP,
          subWashSent,
          subWashRecv,
          subFinishing,
          '',
        ]);
      });

      rows.push([
        'GRAND TOTAL',
        '',
        '',
        '',
        '',
        grandTotal.cuttingDone,
        grandTotal.inputDone,
        grandTotal.inputPending,
        grandTotal.outputDone,
        grandTotal.outputPending,
        grandTotal.washSentDone,
        grandTotal.washRecvDone,
        grandTotal.finishingDone,
        '',
      ]);

      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws['!cols'] = [
        { wch: 12 }, // Line
        { wch: 14 }, // Buyer
        { wch: 14 }, // PO
        { wch: 16 }, // Style
        { wch: 12 }, // Colour
        { wch: 12 }, // Cutting Done
        { wch: 12 }, // Input Done
        { wch: 12 }, // Input Pending
        { wch: 12 }, // Output Done
        { wch: 12 }, // Output Pending
        { wch: 12 }, // Wash Sent
        { wch: 12 }, // Wash Recv
        { wch: 12 }, // Finishing
        { wch: 18 }, // Status
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Line Summary');
      XLSX.writeFile(wb, `Line_Summary_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success('Line summary exported to Excel');
    } catch (e: any) {
      toast.error('Export failed: ' + e.message);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0E2E33] shadow-soft-sm overflow-hidden">
      {/* Header bar */}
      <div className="px-5 py-4 bg-slate-50 dark:bg-[#082024] border-b border-slate-200 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#2BA5B5]/10 text-[#2BA5B5] flex items-center justify-center font-bold">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              Line-wise Summary
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300 font-semibold">
                {filteredOrders.length} qualifying orders
              </span>
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bangla">
              লাইনভিত্তিক কাটিং, ইনপুট ও আউটপুট বর্তমান অবস্থা (কাটিং সম্পন্ন অথবা PO Done)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 print:hidden">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>Print</span>
          </button>
          <button
            type="button"
            onClick={exportSummaryExcel}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Excel</span>
          </button>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto scrollbar-custom">
        {filteredOrders.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500 dark:text-slate-400">
            No orders currently qualify for Line Summary (orders where Cutting Done ≥ Order Qty, or PO Done).
          </div>
        ) : (
          <table className="w-full text-left border-collapse text-[11px]">
            <thead className="bg-slate-100 dark:bg-[#0A262B] text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-white/10 text-[10px] font-bold uppercase tracking-wider select-none">
              <tr>
                <th className="px-3 py-2.5 w-24">Line</th>
                <th className="px-3 py-2.5 min-w-[95px]">Buyer</th>
                <th className="px-3 py-2.5 min-w-[90px]">PO</th>
                <th className="px-3 py-2.5 min-w-[100px]">Style</th>
                <th className="px-3 py-2.5 min-w-[90px]">Colour</th>
                <th className="px-3 py-2.5 text-right min-w-[80px]">Cutting Done</th>
                <th className="px-3 py-2.5 text-right min-w-[75px]">Input Done</th>
                <th className="px-3 py-2.5 text-right min-w-[80px]">Input Pending</th>
                <th className="px-3 py-2.5 text-right min-w-[75px]">Output Done</th>
                <th className="px-3 py-2.5 text-right min-w-[80px]">Output Pending</th>
                <th className="px-3 py-2.5 text-right min-w-[75px] text-sky-700 dark:text-sky-300">Wash Sent</th>
                <th className="px-3 py-2.5 text-right min-w-[75px] text-purple-700 dark:text-purple-300">Wash Recv</th>
                <th className="px-3 py-2.5 text-right min-w-[75px] text-emerald-700 dark:text-emerald-300">Finishing</th>
                <th className="px-3 py-2.5 text-center min-w-[110px]">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {Object.entries(groupedByLine).map(([lineName, groupOrders]) => {
                if (groupOrders.length === 0) return null;

                const isNoLine = lineName === 'No line yet';

                let subCut = 0;
                let subInD = 0;
                let subInP = 0;
                let subOutD = 0;
                let subOutP = 0;
                let subWashSent = 0;
                let subWashRecv = 0;
                let subFinishing = 0;

                return (
                  <React.Fragment key={lineName}>
                    {groupOrders.map((order) => {
                      const cut = Number(order.cutting_qty || 0);
                      const inD = Number(order.total_input || 0);
                      const outD = Number(order.total_output || 0);
                      const wsD = Number(order.total_wash_sent || 0);
                      const wrD = Number(order.total_wash_recv || 0);
                      const fnD = Number(order.total_finishing || 0);
                      const inP = Math.max(0, cut - inD);
                      const outP = Math.max(0, inD - outD);

                      subCut += cut;
                      subInD += inD;
                      subInP += inP;
                      subOutD += outD;
                      subOutP += outP;
                      subWashSent += wsD;
                      subWashRecv += wrD;
                      subFinishing += fnD;

                      const status = getOrderStatus(order);

                      return (
                        <tr
                          key={order.id}
                          className={`hover:bg-slate-50 dark:hover:bg-white/5 transition-colors ${
                            isNoLine
                              ? 'bg-rose-50/40 dark:bg-rose-950/20'
                              : ''
                          }`}
                        >
                          <td className={`px-3 py-2 font-bold ${
                            isNoLine
                              ? 'text-rose-700 dark:text-rose-300'
                              : 'text-slate-700 dark:text-slate-300'
                          }`}>
                            {lineName}
                          </td>
                          <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-200">
                            {order.buyer || '-'}
                          </td>
                          <td className="px-3 py-2 font-semibold text-slate-900 dark:text-white">
                            {order.po}
                          </td>
                          <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                            {order.style || '-'}
                          </td>
                          <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                            {order.colour || '-'}
                          </td>
                          <td className="px-3 py-2 text-right font-medium text-slate-800 dark:text-slate-200">
                            {cut.toLocaleString()}
                          </td>
                          <td className="px-3 py-2 text-right font-medium text-teal-700 dark:text-teal-400">
                            {inD.toLocaleString()}
                          </td>
                          <td
                            className={`px-3 py-2 text-right font-semibold ${
                              inP > 0
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-slate-400'
                            }`}
                          >
                            {inP.toLocaleString()}
                          </td>
                          <td className="px-3 py-2 text-right font-bold text-slate-900 dark:text-white">
                            {outD.toLocaleString()}
                          </td>
                          <td
                            className={`px-3 py-2 text-right font-semibold ${
                              outP > 0
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-slate-400'
                            }`}
                          >
                            {outP.toLocaleString()}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-sky-700 dark:text-sky-300">
                            {wsD.toLocaleString()}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-purple-700 dark:text-purple-300">
                            {wrD.toLocaleString()}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-emerald-700 dark:text-emerald-300">
                            {fnD.toLocaleString()}
                          </td>
                          <td className="px-3 py-2 text-center">
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
                    <tr className={`font-bold border-y border-slate-200 dark:border-white/10 ${
                      isNoLine
                        ? 'bg-rose-100/70 dark:bg-rose-950/40 text-rose-950 dark:text-rose-200'
                        : 'bg-slate-100/80 dark:bg-black/40 text-slate-800 dark:text-slate-200'
                    }`}>
                      <td colSpan={5} className="px-3 py-2 text-xs">
                        {lineName} total · {groupOrders.length} {groupOrders.length === 1 ? 'row' : 'rows'}
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
                      <td className="px-3 py-2 text-right text-sky-700 dark:text-sky-300">
                        {subWashSent.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right text-purple-700 dark:text-purple-300">
                        {subWashRecv.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right text-emerald-700 dark:text-emerald-300">
                        {subFinishing.toLocaleString()}
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
                <td colSpan={5} className="px-3 py-2.5 uppercase tracking-wider">
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
                <td className="px-3 py-2.5 text-right text-sky-700 dark:text-sky-300">
                  {grandTotal.washSentDone.toLocaleString()}
                </td>
                <td className="px-3 py-2.5 text-right text-purple-700 dark:text-purple-300">
                  {grandTotal.washRecvDone.toLocaleString()}
                </td>
                <td className="px-3 py-2.5 text-right text-emerald-700 dark:text-emerald-300">
                  {grandTotal.finishingDone.toLocaleString()}
                </td>
                <td className="px-3 py-2.5 text-center text-slate-400">-</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
