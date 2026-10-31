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
  const handleExcelExport = () => {
    setIsExportingExcel(true);
    try {
      const headerRow = [
        'Line',
        'Start Date',
        'PO',
        'Style',
        'Colour',
        'Wash',
        'Order Qty',
        'Cutting Qty',
        'Wash Send',
        'Type',
        'Total',
        'Extra %',
        'Balance',
        ...days.map((d) => `${d.displayDay} (${d.dayOfWeek})`),
        'Status',
      ];

      const sheetData: any[][] = [];

      // Add Title Rows
      sheetData.push(['RUPKATHA APPARELS LTD.']);
      sheetData.push([`30-Day Rolling Line Plan — ${unitLabel}`]);
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

        const inExtraPct =
          orderQty > 0
            ? (((totalIn - orderQty) / orderQty) * 100).toFixed(1) + '%'
            : '0%';
        const outExtraPct =
          orderQty > 0
            ? (((totalOut - orderQty) / orderQty) * 100).toFixed(1) + '%'
            : '0%';

        const inBal = cutQty - totalIn;
        const outBal = totalIn - totalOut;

        // Sub-row 1: INPUT
        const inRow = [
          order.line_no || 'No line',
          order.start_date || '',
          order.po,
          order.style || '',
          order.colour || '',
          order.wash || '',
          orderQty,
          cutQty,
          Number(order.wash_send || 0),
          'IN',
          totalIn,
          inExtraPct,
          inBal,
          ...days.map((d) => dailyData[orderId]?.[d.dateStr]?.input_qty ?? ''),
          status.label,
        ];
        sheetData.push(inRow);

        // Sub-row 2: OUTPUT
        const outRow = [
          order.line_no || 'No line',
          order.start_date || '',
          order.po,
          order.style || '',
          order.colour || '',
          order.wash || '',
          orderQty,
          cutQty,
          Number(order.wash_send || 0),
          'OUT',
          totalOut,
          outExtraPct,
          outBal,
          ...days.map((d) => dailyData[orderId]?.[d.dateStr]?.output_qty ?? ''),
          status.label,
        ];
        sheetData.push(outRow);
      });

      const ws = XLSX.utils.aoa_to_sheet(sheetData);

      // Set column widths
      ws['!cols'] = [
        { wch: 10 }, // Line
        { wch: 12 }, // Start Date
        { wch: 14 }, // PO
        { wch: 16 }, // Style
        { wch: 12 }, // Colour
        { wch: 12 }, // Wash
        { wch: 10 }, // Order Qty
        { wch: 10 }, // Cutting
        { wch: 10 }, // Wash Send
        { wch: 6 }, // Type
        { wch: 10 }, // Total
        { wch: 8 }, // Extra %
        { wch: 10 }, // Balance
        ...days.map(() => ({ wch: 8 })),
        { wch: 20 }, // Status
      ];

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

  // Export PDF using jsPDF + autoTable
  const handlePdfExport = () => {
    setIsExportingPdf(true);
    try {
      // Landscape A3 format to fit 30 days comfortably
      const doc = new jsPDF({ orientation: 'landscape', format: 'a3' });

      doc.setFontSize(16);
      doc.setTextColor(15, 139, 141);
      doc.text('RUPKATHA APPARELS LTD.', 14, 15);

      doc.setFontSize(12);
      doc.setTextColor(30, 41, 59);
      doc.text(`30-Day Rolling Line Plan (${unitLabel})`, 14, 23);

      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text(`Period: ${dateRangeLabel} | Generated: ${new Date().toLocaleString()}`, 14, 29);

      const tableHeaders = [
        'Line',
        'PO',
        'Style',
        'Colour',
        'Ord Qty',
        'Cut',
        'Type',
        'Tot',
        'Bal',
        ...days.map((d) => `${d.displayDay}`),
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

        // IN row
        tableRows.push([
          order.line_no || 'No line',
          order.po,
          order.style || '-',
          order.colour || '-',
          orderQty.toLocaleString(),
          cutQty.toLocaleString(),
          'IN',
          totalIn.toLocaleString(),
          (cutQty - totalIn).toLocaleString(),
          ...days.map((d) => dailyData[orderId]?.[d.dateStr]?.input_qty ?? '-'),
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
          'OUT',
          totalOut.toLocaleString(),
          (totalIn - totalOut).toLocaleString(),
          ...days.map((d) => dailyData[orderId]?.[d.dateStr]?.output_qty ?? '-'),
          '',
        ]);
      });

      autoTable(doc, {
        head: [tableHeaders],
        body: tableRows,
        startY: 34,
        styles: { fontSize: 7, cellPadding: 1.5, halign: 'center' },
        headStyles: { fillColor: [15, 139, 141], textColor: [255, 255, 255], fontStyle: 'bold' },
        columnStyles: {
          0: { halign: 'left' },
          1: { halign: 'left', fontStyle: 'bold' },
          2: { halign: 'left' },
          3: { halign: 'left' },
          4: { halign: 'right' },
          5: { halign: 'right' },
          6: { halign: 'center', fontStyle: 'bold' },
          7: { halign: 'right', fontStyle: 'bold' },
          8: { halign: 'right' },
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
