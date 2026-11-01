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

  // Export Excel (.xlsx) using SheetJS
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
        'Cutting Qty',
        'Type',
        'Total',
        'Balance',
        ...days.map((d) => `${d.displayDay} (${d.dayOfWeek})`),
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

        const inBal = cutQty - totalIn;
        const outBal = totalIn - totalOut;
        const washRem = orderQty - totalWashSent;
        const washRecvRem = totalWashSent - totalWashRecv;
        const finishRem = totalWashRecv - totalFinishing;
        const buyerDisplay = order.buyer || '-';

        // Sub-row 1: INPUT
        const inRow = [
          order.line_no || 'No line',
          buyerDisplay,
          order.po,
          order.style || '',
          order.colour || '',
          order.wash || '',
          order.start_date || '',
          orderQty,
          cutQty,
          'INPUT',
          totalIn,
          inBal,
          ...days.map((d) => dailyData[orderId]?.[d.dateStr]?.input_qty ?? ''),
          totalWashSent,
          washRem,
          totalWashRecv,
          washRecvRem,
          totalFinishing,
          finishRem,
          status.label,
        ];
        sheetData.push(inRow);

        // Sub-row 2: OUTPUT
        const outRow = [
          order.line_no || 'No line',
          buyerDisplay,
          order.po,
          order.style || '',
          order.colour || '',
          order.wash || '',
          order.start_date || '',
          orderQty,
          cutQty,
          'OUTPUT',
          totalOut,
          outBal,
          ...days.map((d) => dailyData[orderId]?.[d.dateStr]?.output_qty ?? ''),
          totalWashSent,
          washRem,
          totalWashRecv,
          washRecvRem,
          totalFinishing,
          finishRem,
          status.label,
        ];
        sheetData.push(outRow);

        // Sub-row 3: WASH SENT
        const wsRow = [
          order.line_no || 'No line',
          buyerDisplay,
          order.po,
          order.style || '',
          order.colour || '',
          order.wash || '',
          order.start_date || '',
          orderQty,
          cutQty,
          'WASH SENT',
          totalWashSent,
          washRem,
          ...days.map((d) => dailyData[orderId]?.[d.dateStr]?.wash_sent_qty ?? ''),
          totalWashSent,
          washRem,
          totalWashRecv,
          washRecvRem,
          totalFinishing,
          finishRem,
          status.label,
        ];
        sheetData.push(wsRow);

        // Sub-row 4: WASH RECV
        const wrRow = [
          order.line_no || 'No line',
          buyerDisplay,
          order.po,
          order.style || '',
          order.colour || '',
          order.wash || '',
          order.start_date || '',
          orderQty,
          cutQty,
          'WASH RECV',
          totalWashRecv,
          washRecvRem,
          ...days.map((d) => dailyData[orderId]?.[d.dateStr]?.wash_recv_qty ?? ''),
          totalWashSent,
          washRem,
          totalWashRecv,
          washRecvRem,
          totalFinishing,
          finishRem,
          status.label,
        ];
        sheetData.push(wrRow);

        // Sub-row 5: FINISHING
        const fnRow = [
          order.line_no || 'No line',
          buyerDisplay,
          order.po,
          order.style || '',
          order.colour || '',
          order.wash || '',
          order.start_date || '',
          orderQty,
          cutQty,
          'FINISHING',
          totalFinishing,
          finishRem,
          ...days.map((d) => dailyData[orderId]?.[d.dateStr]?.finishing_qty ?? ''),
          totalWashSent,
          washRem,
          totalWashRecv,
          washRecvRem,
          totalFinishing,
          finishRem,
          status.label,
        ];
        sheetData.push(fnRow);
      });

      const ws = XLSX.utils.aoa_to_sheet(sheetData);

      // Set smart column widths
      ws['!cols'] = [
        { wch: 11 }, // Line
        { wch: 15 }, // Buyer
        { wch: 14 }, // PO
        { wch: 18 }, // Style
        { wch: 13 }, // Colour
        { wch: 12 }, // Wash
        { wch: 12 }, // Start Date
        { wch: 11 }, // Order Qty
        { wch: 11 }, // Cutting
        { wch: 12 }, // Type
        { wch: 10 }, // Total
        { wch: 10 }, // Balance
        ...days.map(() => ({ wch: 8 })),
        { wch: 14 }, // Total Wash Sent
        { wch: 11 }, // Wash Rem
        { wch: 14 }, // Total Wash Recv
        { wch: 13 }, // Wash Recv Rem
        { wch: 13 }, // Total Finishing
        { wch: 13 }, // Finishing Rem
        { wch: 16 }, // Status
      ];

      // Vertical merges for 5 sub-rows per order
      const merges: XLSX.Range[] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: headerRow.length - 1 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: headerRow.length - 1 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: headerRow.length - 1 } },
      ];

      // Data starts at row index 5 (0-indexed)
      let curRow = 5;
      const rightColStart = 12 + days.length;
      orders.forEach(() => {
        // Merge columns 0 to 8: Line, Buyer, PO, Style, Colour, Wash, Start Date, Order Qty, Cutting Qty
        for (let col = 0; col <= 8; col++) {
          merges.push({
            s: { r: curRow, c: col },
            e: { r: curRow + 4, c: col },
          });
        }
        // Merge Right Wash & Finishing + Status columns
        for (let col = rightColStart; col < headerRow.length; col++) {
          merges.push({
            s: { r: curRow, c: col },
            e: { r: curRow + 4, c: col },
          });
        }
        curRow += 5;
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
              fill: { fgColor: { rgb: '0F8B8D' } },
              font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 10 },
              alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
              border: {
                top: { style: 'thin', color: { rgb: '0A5E60' } },
                bottom: { style: 'medium', color: { rgb: '0A5E60' } },
                left: { style: 'thin', color: { rgb: '14A2A4' } },
                right: { style: 'thin', color: { rgb: '14A2A4' } },
              },
            };
          } else {
            const isRightAlign = (C >= 7 && C <= 8) || C === 10 || C === 11 || (C >= rightColStart && C < headerRow.length - 1);
            const isCenterAlign = C === 0 || C === 6 || C === 9 || (C >= 12 && C < rightColStart) || C === headerRow.length - 1;
            cell.s = {
              font: { sz: 9.5, bold: C === 1 || C === 2 || C === 9 },
              alignment: {
                vertical: 'center',
                horizontal: isRightAlign ? 'right' : isCenterAlign ? 'center' : 'left',
              },
              border: {
                top: { style: 'thin', color: { rgb: 'CBD5E1' } },
                bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
                left: { style: 'thin', color: { rgb: 'CBD5E1' } },
                right: { style: 'thin', color: { rgb: 'CBD5E1' } },
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
        'Cut',
        'Type',
        'Tot',
        'Bal',
        ...days.map((d) => `${d.displayDay}`),
        'Wash Sent',
        'Wash Rem',
        'Wash Recv',
        'Finishing',
        'Status',
      ];

      const tableRows: any[][] = [];

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

        const inBal = cutQty - totalIn;
        const outBal = totalIn - totalOut;
        const washRem = orderQty - totalWashSent;
        const washRecvRem = totalWashSent - totalWashRecv;
        const finishRem = totalWashRecv - totalFinishing;

        // IN row
        tableRows.push([
          order.line_no || 'No line',
          order.buyer || '-',
          order.po,
          order.style || '-',
          order.colour || '-',
          orderQty.toLocaleString(),
          cutQty.toLocaleString(),
          'IN',
          totalIn.toLocaleString(),
          inBal.toLocaleString(),
          ...days.map((d) => dailyData[orderId]?.[d.dateStr]?.input_qty ?? '-'),
          totalWashSent.toLocaleString(),
          washRem.toLocaleString(),
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
          '',
          'OUT',
          totalOut.toLocaleString(),
          outBal.toLocaleString(),
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
          '',
          'WASH IN',
          totalWashSent.toLocaleString(),
          washRem.toLocaleString(),
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
          '',
          'WASH OUT',
          totalWashRecv.toLocaleString(),
          washRecvRem.toLocaleString(),
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
          '',
          'FINISH',
          totalFinishing.toLocaleString(),
          finishRem.toLocaleString(),
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
          fontSize: 6.5,
          cellPadding: 1.5,
          halign: 'center',
          lineColor: [200, 200, 200],
          lineWidth: 0.15,
        },
        headStyles: {
          fillColor: [15, 139, 141],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
        },
        columnStyles: {
          0: { halign: 'left' },
          1: { halign: 'left' },
          2: { halign: 'left', fontStyle: 'bold' },
          3: { halign: 'left' },
          4: { halign: 'left' },
          5: { halign: 'right' },
          6: { halign: 'right' },
          7: { halign: 'center', fontStyle: 'bold' },
          8: { halign: 'right', fontStyle: 'bold' },
          9: { halign: 'right' },
        },
        margin: { left: 10, right: 10 },
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
      <button
        type="button"
        onClick={handlePrint}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/10 transition-colors shadow-xs"
        title="Print A3 Line Plan"
      >
        <Printer className="w-3.5 h-3.5 text-slate-500" />
        <span className="hidden sm:inline">Print</span>
      </button>

      <button
        type="button"
        onClick={handleExcelExport}
        disabled={isExportingExcel}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors shadow-xs disabled:opacity-50"
        title="Download Excel Sheet"
      >
        {isExportingExcel ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
        )}
        <span className="hidden sm:inline">Excel</span>
      </button>

      <button
        type="button"
        onClick={handlePdfExport}
        disabled={isExportingPdf}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors shadow-xs disabled:opacity-50"
        title="Download PDF"
      >
        {isExportingPdf ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <FileText className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
        )}
        <span className="hidden sm:inline">PDF</span>
      </button>
    </div>
  );
};
