import React, { useState } from 'react';
import { Printer, FileSpreadsheet, FileText, Download, Loader2 } from 'lucide-react';
import type { PlanningOrder, DayColumn } from '../../types/planning';
import type { DailyMatrix } from '../../hooks/planning/usePlanningDaily';
import { getOrderStatus } from '../../lib/planningStatus';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import toast from 'react-hot-toast';

interface ExportButtonsProps {
  orders: PlanningOrder[];
  days: DayColumn[];
  dailyData: DailyMatrix;
  dateRangeLabel: string;
  unitLabel: string;
}

export const ExportButtons: React.FC<ExportButtonsProps> = ({
  orders,
  days,
  dailyData,
  dateRangeLabel,
  unitLabel,
}) => {
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Trigger browser print dialog
  const handlePrint = () => {
    window.print();
  };

  // Export Excel (.xlsx) using SheetJS with smart styling & borders
  const handleExcelExport = () => {
    setIsExportingExcel(true);
    try {
      const headerRow = [
        'Line',
        'Buyer',
        'PO',
        'Style',
        'Colour',
        'Wash',
        'Start Date',
        'Order Qty',
        'Type',
        'Total',
        'Balance & Status',
        ...days.map((d) => d.displayDay),
        'Total Wash Sent',
        'Wash Rem.',
        'Total Wash Recv',
        'Wash Recv Rem.',
        'Total Finishing',
        'Finishing Rem.',
        'Status',
      ];

      const sheetData: any[][] = [];

      // Add Title Rows
      sheetData.push(['RUPKATHA APPARELS LTD.']);
      sheetData.push([`8-Day Line Plan — ${unitLabel}`]);
      sheetData.push([`Period: ${dateRangeLabel}`]);
      sheetData.push([]); // Blank row
      sheetData.push(headerRow);

      // Read any locally stored cutting daily map
      let cuttingDailyMap: Record<string, Record<string, number>> = {};
      try {
        const saved = localStorage.getItem('rupkatha_planning_cutting_daily');
        if (saved) cuttingDailyMap = JSON.parse(saved);
      } catch {
        // ignore
      }

      orders.forEach((order) => {
        const orderId = order.id;
        const status = getOrderStatus(order);
        const orderQty = Number(order.order_qty || 0);
        const cutQty = Number(order.cutting_qty || 0);
        const totalIn = Number(order.total_input || 0);
        const totalOut = Number(order.total_output || 0);
        const totalWashSent = Number(order.total_wash_sent || 0);
        const totalWashRecv = Number(order.total_wash_recv || 0);
        const totalFinishing = Number(order.total_finishing || 0);

        const extraPct =
          orderQty > 0 ? Math.round(((cutQty - orderQty) / orderQty) * 100) : 0;
        let cutStatusLabel = 'Not cut';
        if (cutQty >= orderQty && orderQty > 0) {
          cutStatusLabel = 'Cut done';
        } else if (cutQty > 0) {
          cutStatusLabel = 'Cutting';
        }

        const cuttingBalanceStr =
          cutQty === 0
            ? '- Not cut'
            : `${cutQty} (${extraPct >= 0 ? '+' : ''}${extraPct}%) ${cutStatusLabel}`;

        const inBal = cutQty - totalIn;
        const inBalStr =
          cutQty === 0 ? '-' : inBal <= 0 ? '0 ✓ Done' : `${inBal} Short`;

        const outBal = totalIn - totalOut;
        const outBalStr =
          totalIn === 0 ? '-' : outBal <= 0 ? '0 ✓ Done' : `${outBal} Short`;

        const washRem = orderQty - totalWashSent;
        const washRemStr = washRem <= 0 ? '0 ✓ Done' : `${washRem} Rem.`;

        const washRecvRem = totalWashSent - totalWashRecv;
        const washRecvRemStr =
          totalWashSent === 0 ? '-' : washRecvRem <= 0 ? '0 ✓ Done' : `${washRecvRem} Rem.`;

        const finishRem = totalWashRecv - totalFinishing;
        const finishRemStr =
          totalWashRecv === 0 ? '-' : finishRem <= 0 ? '0 ✓ Done' : `${finishRem} Rem.`;

        const buyerDisplay = order.buyer || '-';

        // Sub-row 1: CUTTING
        const cutDays = days.map((d) => {
          const val = cuttingDailyMap[orderId]?.[d.dateStr];
          if (val !== undefined && val > 0) return val;
          if (order.start_date === d.dateStr && cutQty > 0) return cutQty;
          return '';
        });

        const cutRow = [
          order.line_no || 'No line',
          buyerDisplay,
          order.po,
          order.style || '',
          order.colour || '',
          order.wash || '',
          order.start_date || '',
          orderQty,
          'CUTTING',
          cutQty,
          cuttingBalanceStr,
          ...cutDays,
          totalWashSent,
          washRemStr,
          totalWashRecv,
          washRecvRemStr,
          totalFinishing,
          finishRemStr,
          status.label,
        ];
        sheetData.push(cutRow);

        // Sub-row 2: INPUT
        const inRow = [
          order.line_no || 'No line',
          buyerDisplay,
          order.po,
          order.style || '',
          order.colour || '',
          order.wash || '',
          order.start_date || '',
          orderQty,
          'INPUT',
          totalIn,
          inBalStr,
          ...days.map((d) => dailyData[orderId]?.[d.dateStr]?.input_qty ?? ''),
          totalWashSent,
          washRemStr,
          totalWashRecv,
          washRecvRemStr,
          totalFinishing,
          finishRemStr,
          status.label,
        ];
        sheetData.push(inRow);

        // Sub-row 3: OUTPUT
        const outRow = [
          order.line_no || 'No line',
          buyerDisplay,
          order.po,
          order.style || '',
          order.colour || '',
          order.wash || '',
          order.start_date || '',
          orderQty,
          'OUTPUT',
          totalOut,
          outBalStr,
          ...days.map((d) => dailyData[orderId]?.[d.dateStr]?.output_qty ?? ''),
          totalWashSent,
          washRemStr,
          totalWashRecv,
          washRecvRemStr,
          totalFinishing,
          finishRemStr,
          status.label,
        ];
        sheetData.push(outRow);

        // Sub-row 4: WASH SENT
        const wsRow = [
          order.line_no || 'No line',
          buyerDisplay,
          order.po,
          order.style || '',
          order.colour || '',
          order.wash || '',
          order.start_date || '',
          orderQty,
          'WASH SENT',
          totalWashSent,
          washRemStr,
          ...days.map((d) => dailyData[orderId]?.[d.dateStr]?.wash_sent_qty ?? ''),
          totalWashSent,
          washRemStr,
          totalWashRecv,
          washRecvRemStr,
          totalFinishing,
          finishRemStr,
          status.label,
        ];
        sheetData.push(wsRow);

        // Sub-row 5: WASH RECV
        const wrRow = [
          order.line_no || 'No line',
          buyerDisplay,
          order.po,
          order.style || '',
          order.colour || '',
          order.wash || '',
          order.start_date || '',
          orderQty,
          'WASH RECV',
          totalWashRecv,
          washRecvRemStr,
          ...days.map((d) => dailyData[orderId]?.[d.dateStr]?.wash_recv_qty ?? ''),
          totalWashSent,
          washRemStr,
          totalWashRecv,
          washRecvRemStr,
          totalFinishing,
          finishRemStr,
          status.label,
        ];
        sheetData.push(wrRow);

        // Sub-row 6: FINISHING
        const fnRow = [
          order.line_no || 'No line',
          buyerDisplay,
          order.po,
          order.style || '',
          order.colour || '',
          order.wash || '',
          order.start_date || '',
          orderQty,
          'FINISHING',
          totalFinishing,
          finishRemStr,
          ...days.map((d) => dailyData[orderId]?.[d.dateStr]?.finishing_qty ?? ''),
          totalWashSent,
          washRemStr,
          totalWashRecv,
          washRecvRemStr,
          totalFinishing,
          finishRemStr,
          status.label,
        ];
        sheetData.push(fnRow);
      });

      const ws = XLSX.utils.aoa_to_sheet(sheetData);

      // Set smart column widths
      ws['!cols'] = [
        { wch: 10 }, // Line
        { wch: 16 }, // Buyer
        { wch: 15 }, // PO
        { wch: 18 }, // Style
        { wch: 12 }, // Colour
        { wch: 10 }, // Wash
        { wch: 12 }, // Start Date
        { wch: 11 }, // Order Qty
        { wch: 12 }, // Type
        { wch: 10 }, // Total
        { wch: 18 }, // Balance & Status
        ...days.map(() => ({ wch: 8 })),
        { wch: 14 }, // Total Wash Sent
        { wch: 12 }, // Wash Rem
        { wch: 14 }, // Total Wash Recv
        { wch: 13 }, // Wash Recv Rem
        { wch: 13 }, // Total Finishing
        { wch: 13 }, // Finishing Rem
        { wch: 16 }, // Status
      ];

      // Vertical merges for 6 sub-rows per order
      const merges: XLSX.Range[] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: headerRow.length - 1 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: headerRow.length - 1 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: headerRow.length - 1 } },
      ];

      // Data starts at row index 5 (0-indexed)
      let curRow = 5;
      const rightColStart = 11 + days.length;
      orders.forEach(() => {
        // Merge columns 0 to 7: Line, Buyer, PO, Style, Colour, Wash, Start Date, Order Qty
        for (let col = 0; col <= 7; col++) {
          merges.push({
            s: { r: curRow, c: col },
            e: { r: curRow + 5, c: col },
          });
        }
        // Merge Right Wash & Finishing + Status columns
        for (let col = rightColStart; col < headerRow.length; col++) {
          merges.push({
            s: { r: curRow, c: col },
            e: { r: curRow + 5, c: col },
          });
        }
        curRow += 6;
      });
      ws['!merges'] = merges;

      // Smart borders & styling on all table cells
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
          if (!ws[cellAddress]) {
            if (R >= 4) {
              ws[cellAddress] = { t: 's', v: '' };
            } else {
              continue;
            }
          }
          const cell = ws[cellAddress];

          if (R < 3) {
            cell.s = {
              font: { bold: true, sz: R === 0 ? 15 : 11, color: { rgb: R === 0 ? '0F8B8D' : '334155' } },
              alignment: { horizontal: 'left', vertical: 'center' },
            };
          } else if (R === 4) {
            cell.s = {
              fill: { fgColor: { rgb: 'F3F4F6' } },
              font: { bold: true, color: { rgb: '111827' }, sz: 10 },
              alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
              border: {
                top: { style: 'thin', color: { rgb: 'D1D5DB' } },
                bottom: { style: 'medium', color: { rgb: 'D1D5DB' } },
                left: { style: 'thin', color: { rgb: 'D1D5DB' } },
                right: { style: 'thin', color: { rgb: 'D1D5DB' } },
              },
            };
          } else {
            const isRightAlign = C === 7 || C === 9 || C === 10 || (C >= rightColStart && C < headerRow.length - 1);
            const isCenterAlign = C === 0 || C === 5 || C === 6 || C === 8 || (C >= 11 && C < rightColStart) || C === headerRow.length - 1;
            cell.s = {
              font: { sz: 9.5, bold: C === 1 || C === 2 || C === 8 },
              alignment: {
                vertical: 'center',
                horizontal: isRightAlign ? 'right' : isCenterAlign ? 'center' : 'left',
              },
              border: {
                top: { style: 'thin', color: { rgb: 'D1D5DB' } },
                bottom: { style: 'thin', color: { rgb: 'D1D5DB' } },
                left: { style: 'thin', color: { rgb: 'D1D5DB' } },
                right: { style: 'thin', color: { rgb: 'D1D5DB' } },
              },
            };
          }
        }
      }

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Line Plan');

      const fileName = `Rupkatha_Line_Plan_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success('Excel line plan downloaded successfully');
    } catch (err: any) {
      console.error('Excel export error:', err);
      toast.error('Failed to export Excel: ' + err.message);
    } finally {
      setIsExportingExcel(false);
    }
  };

  // Export PDF using jsPDF + autoTable with clean border grid
  const handlePdfExport = () => {
    setIsExportingPdf(true);
    try {
      // Landscape A3 format to fit 8 days and wash/finishing columns comfortably
      const doc = new jsPDF({ orientation: 'landscape', format: 'a3' });

      doc.setFontSize(16);
      doc.setTextColor(15, 139, 141);
      doc.text('RUPKATHA APPARELS LTD.', 14, 15);

      doc.setFontSize(12);
      doc.setTextColor(30, 41, 59);
      doc.text(`8-Day Line Plan (${unitLabel})`, 14, 23);

      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text(`Period: ${dateRangeLabel} | Generated: ${new Date().toLocaleString()}`, 14, 29);

      const tableHeaders = [
        'Line',
        'Buyer',
        'PO',
        'Style',
        'Colour',
        'Ord Qty',
        'Type',
        'Tot',
        'Balance & Status',
        ...days.map((d) => d.displayDay),
        'Wash Sent',
        'Wash Rem',
        'Wash Recv',
        'Finishing',
        'Status',
      ];

      const tableRows: any[][] = [];

      let cuttingDailyMap: Record<string, Record<string, number>> = {};
      try {
        const saved = localStorage.getItem('rupkatha_planning_cutting_daily');
        if (saved) cuttingDailyMap = JSON.parse(saved);
      } catch {
        // ignore
      }

      orders.forEach((order) => {
        const orderId = order.id;
        const status = getOrderStatus(order);
        const orderQty = Number(order.order_qty || 0);
        const cutQty = Number(order.cutting_qty || 0);
        const totalIn = Number(order.total_input || 0);
        const totalOut = Number(order.total_output || 0);
        const totalWashSent = Number(order.total_wash_sent || 0);
        const totalWashRecv = Number(order.total_wash_recv || 0);
        const totalFinishing = Number(order.total_finishing || 0);

        const extraPct =
          orderQty > 0 ? Math.round(((cutQty - orderQty) / orderQty) * 100) : 0;
        let cutStatusLabel = 'Not cut';
        if (cutQty >= orderQty && orderQty > 0) {
          cutStatusLabel = 'Cut done';
        } else if (cutQty > 0) {
          cutStatusLabel = 'Cutting';
        }

        const cuttingBalanceStr =
          cutQty === 0
            ? '- Not cut'
            : `${cutQty} (${extraPct >= 0 ? '+' : ''}${extraPct}%) ${cutStatusLabel}`;

        const inBal = cutQty - totalIn;
        const inBalStr =
          cutQty === 0 ? '-' : inBal <= 0 ? '0 ✓ Done' : `${inBal} Short`;

        const outBal = totalIn - totalOut;
        const outBalStr =
          totalIn === 0 ? '-' : outBal <= 0 ? '0 ✓ Done' : `${outBal} Short`;

        const washRem = orderQty - totalWashSent;
        const washRemStr = washRem <= 0 ? '0 ✓ Done' : `${washRem} Rem.`;

        const washRecvRem = totalWashSent - totalWashRecv;
        const washRecvRemStr =
          totalWashSent === 0 ? '-' : washRecvRem <= 0 ? '0 ✓ Done' : `${washRecvRem} Rem.`;

        const finishRem = totalWashRecv - totalFinishing;
        const finishRemStr =
          totalWashRecv === 0 ? '-' : finishRem <= 0 ? '0 ✓ Done' : `${finishRem} Rem.`;

        const cutDays = days.map((d) => {
          const val = cuttingDailyMap[orderId]?.[d.dateStr];
          if (val !== undefined && val > 0) return String(val);
          if (order.start_date === d.dateStr && cutQty > 0) return String(cutQty);
          return '-';
        });

        // CUTTING row
        tableRows.push([
          order.line_no || 'No line',
          order.buyer || '-',
          order.po,
          order.style || '-',
          order.colour || '-',
          orderQty.toLocaleString(),
          'CUTTING',
          cutQty.toLocaleString(),
          cuttingBalanceStr,
          ...cutDays,
          totalWashSent.toLocaleString(),
          washRemStr,
          totalWashRecv.toLocaleString(),
          totalFinishing.toLocaleString(),
          status.label,
        ]);

        // IN row
        tableRows.push([
          '',
          '',
          '',
          '',
          '',
          '',
          'INPUT',
          totalIn.toLocaleString(),
          inBalStr,
          ...days.map((d) => dailyData[orderId]?.[d.dateStr]?.input_qty ?? '-'),
          totalWashSent.toLocaleString(),
          washRemStr,
          totalWashRecv.toLocaleString(),
          totalFinishing.toLocaleString(),
          status.label,
        ]);

        // OUT row
        tableRows.push([
          '',
          '',
          '',
          '',
          '',
          '',
          'OUTPUT',
          totalOut.toLocaleString(),
          outBalStr,
          ...days.map((d) => dailyData[orderId]?.[d.dateStr]?.output_qty ?? '-'),
          '',
          '',
          '',
          '',
          '',
        ]);

        // WASH SENT row
        tableRows.push([
          '',
          '',
          '',
          '',
          '',
          '',
          'WASH SENT',
          totalWashSent.toLocaleString(),
          washRemStr,
          ...days.map((d) => dailyData[orderId]?.[d.dateStr]?.wash_sent_qty ?? '-'),
          '',
          '',
          '',
          '',
          '',
        ]);

        // WASH RECV row
        tableRows.push([
          '',
          '',
          '',
          '',
          '',
          '',
          'WASH RECV',
          totalWashRecv.toLocaleString(),
          washRecvRemStr,
          ...days.map((d) => dailyData[orderId]?.[d.dateStr]?.wash_recv_qty ?? '-'),
          '',
          '',
          '',
          '',
          '',
        ]);

        // FINISHING row
        tableRows.push([
          '',
          '',
          '',
          '',
          '',
          '',
          'FINISHING',
          totalFinishing.toLocaleString(),
          finishRemStr,
          ...days.map((d) => dailyData[orderId]?.[d.dateStr]?.finishing_qty ?? '-'),
          '',
          '',
          '',
          '',
          '',
        ]);
      });

      autoTable(doc, {
        head: [tableHeaders],
        body: tableRows,
        startY: 34,
        theme: 'grid',
        styles: {
          fontSize: 7,
          cellPadding: 1.5,
          halign: 'center',
          lineColor: [209, 213, 219],
          lineWidth: 0.2,
        },
        headStyles: {
          fillColor: [243, 244, 246],
          textColor: [17, 24, 39],
          fontStyle: 'bold',
          lineColor: [209, 213, 219],
          lineWidth: 0.3,
        },
        alternateRowStyles: {
          fillColor: [255, 255, 255],
        },
      });

      const fileName = `Rupkatha_Line_Plan_${new Date().toISOString().slice(0, 10)}.pdf`;
      doc.save(fileName);
      toast.success('PDF line plan downloaded successfully');
    } catch (err: any) {
      console.error('PDF export error:', err);
      toast.error('Failed to export PDF: ' + err.message);
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="flex items-center gap-1.5 print:hidden">
      {/* Print */}
      <button
        type="button"
        onClick={handlePrint}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors shadow-xs cursor-pointer"
        title="Print Line Plan (Ctrl+P)"
      >
        <Printer className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Print</span>
      </button>

      {/* Excel */}
      <button
        type="button"
        disabled={isExportingExcel}
        onClick={handleExcelExport}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
        title="Download Excel Spreadsheet (.xlsx)"
      >
        {isExportingExcel ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <FileSpreadsheet className="w-3.5 h-3.5" />
        )}
        <span className="hidden sm:inline">Excel</span>
      </button>

      {/* PDF */}
      <button
        type="button"
        disabled={isExportingPdf}
        onClick={handlePdfExport}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
        title="Download PDF Document (.pdf)"
      >
        {isExportingPdf ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <FileText className="w-3.5 h-3.5" />
        )}
        <span className="hidden sm:inline">PDF</span>
      </button>
    </div>
  );
};
