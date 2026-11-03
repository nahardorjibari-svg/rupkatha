import React, { useState } from 'react';
import { Printer, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import type { PlanningOrder, DayColumn } from '../../types/planning';
import type { DailyMatrix } from '../../hooks/planning/usePlanningDaily';
import { getOrderStatus } from '../../lib/planningStatus';
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import toast from 'react-hot-toast';

interface ExportButtonsProps {
  orders: PlanningOrder[];
  days: DayColumn[];
  dailyData: DailyMatrix;
  dateRangeLabel: string;
  unitLabel: string;
  selectedBuyers?: string[];
  selectedSubContracts?: string[];
}

export const ExportButtons: React.FC<ExportButtonsProps> = ({
  orders,
  days,
  dailyData,
  dateRangeLabel,
  unitLabel,
  selectedBuyers = [],
  selectedSubContracts = [],
}) => {
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Trigger browser print dialog
  const handlePrint = () => {
    window.print();
  };

  // Export Excel (.xlsx) using ExcelJS with exact requested formatting
  const handleExcelExport = async () => {
    setIsExportingExcel(true);
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Rupkatha Garments ERP';
      workbook.lastModifiedBy = 'Rupkatha Garments ERP';
      workbook.created = new Date();
      workbook.modified = new Date();

      const worksheet = workbook.addWorksheet('Line Plan', {
        pageSetup: {
          paperSize: 8 as any, // A3
          orientation: 'landscape',
          fitToPage: true,
          fitToWidth: 1,
          fitToHeight: 0,
          showGridLines: true,
        },
        views: [{ state: 'frozen', xSplit: 10, ySplit: 5 }],
      });

      // Repeat header rows 1-5 on printed pages
      worksheet.pageSetup.printTitlesRow = '1:5';

      // 21 Columns:
      // Line (8), Sub-Contract (16), Buyer (22), PO (18), Style (18), Colour (10), Wash (12), Start Date (12), Qty (10), Type (12),
      // [date columns dd/mm x 8, width 7 each],
      // Total (10), Balance & Status (22), Remarks (24)
      const columnWidths = [
        8,  // 1: Line
        16, // 2: Sub-Contract
        22, // 3: Buyer
        18, // 4: PO
        18, // 5: Style
        10, // 6: Colour
        12, // 7: Wash
        12, // 8: Start Date
        10, // 9: Qty
        12, // 10: Type
        ...days.map(() => 7), // 11-18: 8 date columns
        10, // 19: Total
        22, // 20: Balance & Status
        24, // 21: Remarks
      ];

      columnWidths.forEach((w, idx) => {
        worksheet.getColumn(idx + 1).width = w;
      });

      const totalCols = columnWidths.length; // 21

      // HEADER (rows 1-3, merged full width, centered):
      // Row 1: "RUPKATHA APPARELS LTD." bold 12pt
      worksheet.mergeCells(1, 1, 1, totalCols);
      const r1 = worksheet.getCell(1, 1);
      r1.value = 'RUPKATHA APPARELS LTD.';
      r1.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF111827' } };
      r1.alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getRow(1).height = 22;

      // Row 2: "8-Day Line Plan — All Units (Composite)" or Knit/Woven based on filter, 10pt
      const rawUnit = unitLabel || 'All Units';
      const subTitleUnit = rawUnit.toLowerCase().includes('all') ? 'All Units (Composite)' : rawUnit;
      const buyerSubtitle = selectedBuyers.length > 0 ? ` — Buyers: ${selectedBuyers.join(', ')}` : '';
      const subContractSubtitle = selectedSubContracts.length > 0 ? ` — Sub-contract: ${selectedSubContracts.join(', ')}` : '';
      worksheet.mergeCells(2, 1, 2, totalCols);
      const r2 = worksheet.getCell(2, 1);
      r2.value = `8-Day Line Plan — ${subTitleUnit}${buyerSubtitle}${subContractSubtitle}`;
      r2.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF374151' } };
      r2.alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getRow(2).height = 18;

      // Row 3: "Period: 01/11 – 08/11" (current 8-day window), 10pt
      worksheet.mergeCells(3, 1, 3, totalCols);
      const r3 = worksheet.getCell(3, 1);
      r3.value = `Period: ${dateRangeLabel}`;
      r3.font = { name: 'Calibri', size: 10, bold: false, color: { argb: 'FF4B5563' } };
      r3.alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getRow(3).height = 16;

      // Row 4: blank
      worksheet.getRow(4).height = 10;

      // Row 5: column headers (bg #D9D9D9 or light gray, bold, 1px borders, all centered)
      const headerLabels = [
        'Line',
        'Sub-Contract',
        'Buyer',
        'PO',
        'Style',
        'Colour',
        'Wash',
        'Start Date',
        'Qty',
        'Type',
        ...days.map((d) => d.displayDay),
        'Total',
        'Balance & Status',
        'Remarks',
      ];

      const r5 = worksheet.getRow(5);
      r5.height = 24;
      headerLabels.forEach((label, idx) => {
        const cell = r5.getCell(idx + 1);
        cell.value = label;
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF111827' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFD9D9D9' },
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        };
      });

      // Read cutting daily map & order remarks from localStorage
      let cuttingDailyMap: Record<string, Record<string, number>> = {};
      try {
        const saved = localStorage.getItem('rupkatha_planning_cutting_daily');
        if (saved) cuttingDailyMap = JSON.parse(saved);
      } catch {
        // ignore
      }

      let orderRemarksMap: Record<string, string> = {};
      try {
        const saved = localStorage.getItem('rupkatha_planning_order_remarks');
        if (saved) orderRemarksMap = JSON.parse(saved);
      } catch {
        // ignore
      }

      // Group or sort orders so lines stay together
      const lineOrderMap: Record<string, number> = {
        'Line-1': 1,
        'Line-2': 2,
        'Line-3': 3,
        'Line-4': 4,
      };
      const sortedOrders = [...orders].sort((a, b) => {
        const lA = lineOrderMap[a.line_no || ''] || 99;
        const lB = lineOrderMap[b.line_no || ''] || 99;
        if (lA !== lB) return lA - lB;
        const dA = a.start_date ? new Date(a.start_date).getTime() : 0;
        const dB = b.start_date ? new Date(b.start_date).getTime() : 0;
        return dA - dB;
      });

      const subRowConfigs = [
        { type: 'CUTTING', bg: 'FFF0F9FF' },
        { type: 'INPUT', bg: 'FFFFFFFF' },
        { type: 'OUTPUT', bg: 'FFF0FDF4' },
        { type: 'WASH SENT', bg: 'FFFAF5FF' },
        { type: 'WASH RECV', bg: 'FFECFEFF' },
        { type: 'FINISHING', bg: 'FFFFF7ED' },
      ];

      let curRow = 6;

      sortedOrders.forEach((order, orderIdx) => {
        const orderId = order.id;
        const startRow = curRow;
        const endRow = curRow + 5; // 6 sub-rows

        const isLastOrder = orderIdx === sortedOrders.length - 1;
        const nextOrder = !isLastOrder ? sortedOrders[orderIdx + 1] : null;
        const isLineGroupEnd = isLastOrder || (nextOrder && nextOrder.line_no !== order.line_no);

        const orderQty = Number(order.order_qty || 0);
        const cutQty = Number(order.cutting_qty || 0);
        const totalIn = Number(order.total_input || 0);
        const totalOut = Number(order.total_output || 0);
        const totalWashSent = Number(order.total_wash_sent || 0);
        const totalWashRecv = Number(order.total_wash_recv || 0);
        const totalFinishing = Number(order.total_finishing || 0);

        // Daily arrays across 8 days
        const dailyCutVals = days.map((d) => {
          const v = cuttingDailyMap[orderId]?.[d.dateStr];
          if (v !== undefined && v > 0) return v;
          if (order.start_date === d.dateStr && cutQty > 0) return cutQty;
          return null;
        });

        const dailyInVals = days.map((d) => {
          const v = dailyData[orderId]?.[d.dateStr]?.input_qty;
          return v !== null && v !== undefined && Number(v) > 0 ? Number(v) : null;
        });

        const dailyOutVals = days.map((d) => {
          const v = dailyData[orderId]?.[d.dateStr]?.output_qty;
          return v !== null && v !== undefined && Number(v) > 0 ? Number(v) : null;
        });

        const dailyWsVals = days.map((d) => {
          const v = dailyData[orderId]?.[d.dateStr]?.wash_sent_qty;
          return v !== null && v !== undefined && Number(v) > 0 ? Number(v) : null;
        });

        const dailyWrVals = days.map((d) => {
          const v = dailyData[orderId]?.[d.dateStr]?.wash_recv_qty;
          return v !== null && v !== undefined && Number(v) > 0 ? Number(v) : null;
        });

        const dailyFnVals = days.map((d) => {
          const v = dailyData[orderId]?.[d.dateStr]?.finishing_qty;
          return v !== null && v !== undefined && Number(v) > 0 ? Number(v) : null;
        });

        const sumCut = dailyCutVals.reduce<number>((s, v) => s + (v || 0), 0) || cutQty;
        const sumIn = totalIn;
        const sumOut = totalOut;
        const sumWs = totalWashSent;
        const sumWr = totalWashRecv;
        const sumFn = totalFinishing;

        // Balance & Status Calculations for the 6 rows
        // Line 1 (CUTTING): "1236 (+3%) Cut done" — cutting_qty, extra%, cut status text
        const extraPct = orderQty > 0 ? Math.round(((cutQty - orderQty) / orderQty) * 100) : 0;
        let cutStatusText = 'Not cut';
        let cutColor = 'FF6B7280';
        if (cutQty >= orderQty && orderQty > 0) {
          cutStatusText = 'Cut done';
          cutColor = 'FF16A34A';
        } else if (cutQty > 0) {
          cutStatusText = 'Cutting';
          cutColor = 'FFD97706';
        }
        const line1Text =
          cutQty === 0
            ? '- Not cut'
            : `${cutQty} (${extraPct >= 0 ? '+' : ''}${extraPct}%) ${cutStatusText}`;

        // Line 2 (INPUT): cutting_qty - total_input
        // 0 or negative: green "0 ✓ Done", positive: red "N Short"
        const inBal = cutQty - totalIn;
        let line2Text = '';
        let line2Color = 'FF6B7280';
        if (inBal <= 0) {
          line2Text = '0 ✓ Done';
          line2Color = 'FF16A34A';
        } else {
          line2Text = `${inBal} Short`;
          line2Color = 'FFDC2626';
        }

        // Line 3 (OUTPUT): total_input - total_output
        // 0 or negative: green "0 ✓ Done", positive: red "N Short"
        const outBal = totalIn - totalOut;
        let line3Text = '';
        let line3Color = 'FF6B7280';
        if (outBal <= 0) {
          line3Text = '0 ✓ Done';
          line3Color = 'FF16A34A';
        } else {
          line3Text = `${outBal} Short`;
          line3Color = 'FFDC2626';
        }

        // Line 4 (WASH SENT): cutting_qty - total_wash_sent (NOT order_qty)
        // 0: green "0 ✓ Done", positive: red "N Rem.", negative: amber "+N Excess"
        const washRem = cutQty - totalWashSent;
        let line4Text = '';
        let line4Color = 'FF6B7280';
        if (washRem === 0) {
          line4Text = '0 ✓ Done';
          line4Color = 'FF16A34A';
        } else if (washRem < 0) {
          line4Text = `+${Math.abs(washRem)} Excess`;
          line4Color = 'FFD97706';
        } else {
          line4Text = `${washRem} Rem.`;
          line4Color = 'FFDC2626';
        }

        // Line 5 (WASH RECV): total_wash_sent - total_wash_recv
        // 0: green "0 ✓ Done", positive: red "N Rem."
        const washRecvRem = totalWashSent - totalWashRecv;
        let line5Text = '';
        let line5Color = 'FF6B7280';
        if (washRecvRem <= 0) {
          line5Text = '0 ✓ Done';
          line5Color = 'FF16A34A';
        } else {
          line5Text = `${washRecvRem} Rem.`;
          line5Color = 'FFDC2626';
        }

        // Line 6 (FINISHING): total_wash_recv - total_finishing
        // 0: green "0 ✓ Done", positive: red "N Rem."
        const finishRem = totalWashRecv - totalFinishing;
        let line6Text = '';
        let line6Color = 'FF6B7280';
        if (finishRem <= 0) {
          line6Text = '0 ✓ Done';
          line6Color = 'FF16A34A';
        } else {
          line6Text = `${finishRem} Rem.`;
          line6Color = 'FFDC2626';
        }

        // Populate the 6 sub-rows
        subRowConfigs.forEach((cfg, sIdx) => {
          const rowNum = startRow + sIdx;
          const row = worksheet.getRow(rowNum);
          row.height = 18;

          // Col 10: Type
          const typeCell = row.getCell(10);
          typeCell.value = cfg.type;
          typeCell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF111827' } };
          typeCell.alignment = { horizontal: 'left', vertical: 'middle' };

          // Cols 11 to 18: Date columns
          let dailyVals: (number | null)[] = [];
          let rowTotalVal: number | string = '';

          if (sIdx === 0) {
            dailyVals = dailyCutVals;
            rowTotalVal = sumCut > 0 ? sumCut : '';
          } else if (sIdx === 1) {
            dailyVals = dailyInVals;
            rowTotalVal = sumIn > 0 ? sumIn : '';
          } else if (sIdx === 2) {
            dailyVals = dailyOutVals;
            rowTotalVal = sumOut > 0 ? sumOut : '';
          } else if (sIdx === 3) {
            dailyVals = dailyWsVals;
            rowTotalVal = sumWs > 0 ? sumWs : '';
          } else if (sIdx === 4) {
            dailyVals = dailyWrVals;
            rowTotalVal = sumWr > 0 ? sumWr : '';
          } else if (sIdx === 5) {
            dailyVals = dailyFnVals;
            rowTotalVal = sumFn > 0 ? sumFn : '';
          }

          dailyVals.forEach((val, dIdx) => {
            const dCell = row.getCell(11 + dIdx);
            dCell.value = val !== null && val !== undefined ? val : '';
            if (val !== null && val !== undefined) {
              dCell.numFmt = '#,##0';
            }
            dCell.font = { name: 'Calibri', size: 9, bold: false };
            dCell.alignment = { horizontal: 'center', vertical: 'middle' };
          });

          // Col 19: Total
          const totCell = row.getCell(19);
          totCell.value = rowTotalVal;
          if (typeof rowTotalVal === 'number') {
            totCell.numFmt = '#,##0';
          }
          totCell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF111827' } };
          totCell.alignment = { horizontal: 'right', vertical: 'middle' };

          // Apply cell fills and borders for this row (cols 1 to 21)
          for (let col = 1; col <= totalCols; col++) {
            const cell = row.getCell(col);

            const isFridayCol = col >= 11 && col <= 18 && days[col - 11]?.isFriday;
            const cellBg = isFridayCol ? 'FFF3F4F6' : cfg.bg;

            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: cellBg },
            };

            const isFinishingRow = sIdx === 5;
            let bottomBorder: ExcelJS.Border = { style: 'thin', color: { argb: 'FFD1D5DB' } };

            if (isFinishingRow) {
              if (isLineGroupEnd) {
                bottomBorder = { style: 'double', color: { argb: 'FF1F2937' } };
              } else {
                bottomBorder = { style: 'medium', color: { argb: 'FF374151' } };
              }
            }

            cell.border = {
              top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
              bottom: bottomBorder,
              left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
              right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            };
          }
        });

        // Left columns (Line, Sub-Contract, Buyer, PO, Style, Colour, Wash, Start Date, Qty):
        // merged vertically across all 6 sub-rows (cols 1 to 9)
        for (let col = 1; col <= 9; col++) {
          worksheet.mergeCells(startRow, col, endRow, col);
        }

        // Col 1: Line
        const lineCell = worksheet.getCell(startRow, 1);
        lineCell.value = order.line_no || 'No line';
        lineCell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF1F2937' } };
        lineCell.alignment = { horizontal: 'center', vertical: 'middle' };

        // Col 2: Sub-Contract
        const subCell = worksheet.getCell(startRow, 2);
        subCell.value = order.sub_contract || '-';
        subCell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF0F8B8D' } };
        subCell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };

        // Col 3: Buyer
        const buyerCell = worksheet.getCell(startRow, 3);
        buyerCell.value = order.buyer || '-';
        buyerCell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF111827' } };
        buyerCell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };

        // Col 4: PO
        const poCell = worksheet.getCell(startRow, 4);
        poCell.value = order.po || '-';
        poCell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF111827' } };
        poCell.alignment = { horizontal: 'left', vertical: 'middle' };

        // Col 5: Style
        const styleCell = worksheet.getCell(startRow, 5);
        styleCell.value = order.style || '-';
        styleCell.font = { name: 'Calibri', size: 9.5, bold: false, color: { argb: 'FF374151' } };
        styleCell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };

        // Col 6: Colour
        const colourCell = worksheet.getCell(startRow, 6);
        colourCell.value = order.colour || '-';
        colourCell.font = { name: 'Calibri', size: 9, bold: false, color: { argb: 'FF4B5563' } };
        colourCell.alignment = { horizontal: 'center', vertical: 'middle' };

        // Col 7: Wash
        const washCell = worksheet.getCell(startRow, 7);
        washCell.value = order.wash || '-';
        washCell.font = { name: 'Calibri', size: 9, bold: false, color: { argb: 'FF4B5563' } };
        washCell.alignment = { horizontal: 'center', vertical: 'middle' };

        // Col 8: Start Date
        const dateCell = worksheet.getCell(startRow, 8);
        dateCell.value = order.start_date || '-';
        dateCell.font = { name: 'Calibri', size: 9, bold: false, color: { argb: 'FF4B5563' } };
        dateCell.alignment = { horizontal: 'center', vertical: 'middle' };

        // Col 9: Qty
        const oQtyCell = worksheet.getCell(startRow, 9);
        oQtyCell.value = orderQty;
        oQtyCell.numFmt = '#,##0';
        oQtyCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF111827' } };
        oQtyCell.alignment = { horizontal: 'right', vertical: 'middle' };

        // Ensure left merged cells have crisp white background and proper borders
        for (let col = 1; col <= 9; col++) {
          for (let r = startRow; r <= endRow; r++) {
            const c = worksheet.getCell(r, col);
            c.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFFFFFFF' },
            };
            const isFinishingRow = r === endRow;
            c.border = {
              top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
              bottom: isFinishingRow
                ? isLineGroupEnd
                  ? { style: 'double', color: { argb: 'FF1F2937' } }
                  : { style: 'medium', color: { argb: 'FF374151' } }
                : { style: 'thin', color: { argb: 'FFD1D5DB' } },
              left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
              right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            };
          }
        }

        // "Balance & Status" column (Col 20): merged vertically across 6 sub-rows
        worksheet.mergeCells(startRow, 20, endRow, 20);
        const balCell = worksheet.getCell(startRow, 20);
        balCell.value = {
          richText: [
            { text: line1Text + '\n', font: { color: { argb: cutColor }, bold: true, size: 9, name: 'Calibri' } },
            { text: line2Text + '\n', font: { color: { argb: line2Color }, bold: true, size: 9, name: 'Calibri' } },
            { text: line3Text + '\n', font: { color: { argb: line3Color }, bold: true, size: 9, name: 'Calibri' } },
            { text: line4Text + '\n', font: { color: { argb: line4Color }, bold: true, size: 9, name: 'Calibri' } },
            { text: line5Text + '\n', font: { color: { argb: line5Color }, bold: true, size: 9, name: 'Calibri' } },
            { text: line6Text, font: { color: { argb: line6Color }, bold: true, size: 9, name: 'Calibri' } },
          ],
        };
        balCell.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' };
        for (let r = startRow; r <= endRow; r++) {
          const c = worksheet.getCell(r, 20);
          c.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFFFFF' },
          };
          const isFinishingRow = r === endRow;
          c.border = {
            top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            bottom: isFinishingRow
              ? isLineGroupEnd
                ? { style: 'double', color: { argb: 'FF1F2937' } }
                : { style: 'medium', color: { argb: 'FF374151' } }
              : { style: 'thin', color: { argb: 'FFD1D5DB' } },
            left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          };
        }

        // "Remarks" column (Col 21): merged vertically across 6 sub-rows
        worksheet.mergeCells(startRow, 21, endRow, 21);
        const remCell = worksheet.getCell(startRow, 21);
        const savedRemarks = orderRemarksMap[orderId] ?? order.remarks ?? '';
        remCell.value = savedRemarks;
        remCell.font = { name: 'Calibri', size: 9.5, bold: false, color: { argb: 'FF111827' } };
        remCell.alignment = { wrapText: true, vertical: 'middle', horizontal: 'left' };
        for (let r = startRow; r <= endRow; r++) {
          const c = worksheet.getCell(r, 21);
          c.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFFFFF' },
          };
          const isFinishingRow = r === endRow;
          c.border = {
            top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            bottom: isFinishingRow
              ? isLineGroupEnd
                ? { style: 'double', color: { argb: 'FF1F2937' } }
                : { style: 'medium', color: { argb: 'FF374151' } }
              : { style: 'thin', color: { argb: 'FFD1D5DB' } },
            left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          };
        }

        curRow += 6;
      });

      // TOTALS ROW at the bottom
      const totalsRowIdx = curRow;
      const tRow = worksheet.getRow(totalsRowIdx);
      tRow.height = 24;

      // Merge cols 1 to 8 for "TOTALS" label
      worksheet.mergeCells(totalsRowIdx, 1, totalsRowIdx, 8);
      const tLabelCell = worksheet.getCell(totalsRowIdx, 1);
      tLabelCell.value = 'TOTALS:';
      tLabelCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF111827' } };
      tLabelCell.alignment = { horizontal: 'right', vertical: 'middle' };

      // Col 9: Sum of Qty
      const totalOrderQtySum = sortedOrders.reduce((s, o) => s + Number(o.order_qty || 0), 0);
      const tOQtyCell = worksheet.getCell(totalsRowIdx, 9);
      tOQtyCell.value = totalOrderQtySum;
      tOQtyCell.numFmt = '#,##0';
      tOQtyCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF111827' } };
      tOQtyCell.alignment = { horizontal: 'right', vertical: 'middle' };

      // Col 10: Type indicator
      const tTypeCell = worksheet.getCell(totalsRowIdx, 10);
      tTypeCell.value = 'IN / OUT';
      tTypeCell.font = { name: 'Calibri', size: 8.5, bold: true, color: { argb: 'FF374151' } };
      tTypeCell.alignment = { horizontal: 'center', vertical: 'middle' };

      // Cols 11 to 18: Date columns (INPUT and OUTPUT sums)
      days.forEach((d, dIdx) => {
        const dInputSum = sortedOrders.reduce((s, o) => s + Number(dailyData[o.id]?.[d.dateStr]?.input_qty || 0), 0);
        const dOutputSum = sortedOrders.reduce((s, o) => s + Number(dailyData[o.id]?.[d.dateStr]?.output_qty || 0), 0);
        const cell = worksheet.getCell(totalsRowIdx, 11 + dIdx);

        cell.value = {
          richText: [
            { text: `${dInputSum > 0 ? dInputSum.toLocaleString() : '0'}\n`, font: { name: 'Calibri', size: 8.5, bold: true, color: { argb: 'FF2563EB' } } },
            { text: `${dOutputSum > 0 ? dOutputSum.toLocaleString() : '0'}`, font: { name: 'Calibri', size: 8.5, bold: true, color: { argb: 'FF16A34A' } } },
          ],
        };
        cell.alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' };
      });

      // Col 19: Total Input / Total Output
      const grandInputSum = sortedOrders.reduce((s, o) => s + Number(o.total_input || 0), 0);
      const grandOutputSum = sortedOrders.reduce((s, o) => s + Number(o.total_output || 0), 0);
      const tTotCell = worksheet.getCell(totalsRowIdx, 19);
      tTotCell.value = {
        richText: [
          { text: `${grandInputSum > 0 ? grandInputSum.toLocaleString() : '0'}\n`, font: { name: 'Calibri', size: 8.5, bold: true, color: { argb: 'FF2563EB' } } },
          { text: `${grandOutputSum > 0 ? grandOutputSum.toLocaleString() : '0'}`, font: { name: 'Calibri', size: 8.5, bold: true, color: { argb: 'FF16A34A' } } },
        ],
      };
      tTotCell.alignment = { wrapText: true, horizontal: 'right', vertical: 'middle' };

      // Col 20: Balance placeholder
      const tBalCell = worksheet.getCell(totalsRowIdx, 20);
      tBalCell.value = '-';
      tBalCell.alignment = { horizontal: 'center', vertical: 'middle' };

      // Col 21: Remarks placeholder
      const tRemCell = worksheet.getCell(totalsRowIdx, 21);
      tRemCell.value = '-';
      tRemCell.alignment = { horizontal: 'center', vertical: 'middle' };

      // Apply fill and border to all cells in Totals row (1 to 21)
      for (let col = 1; col <= totalCols; col++) {
        const cell = worksheet.getCell(totalsRowIdx, col);
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE5E7EB' },
        };
        cell.border = {
          top: { style: 'medium', color: { argb: 'FF374151' } },
          bottom: { style: 'double', color: { argb: 'FF111827' } },
          left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        };
      }

      // Generate buffer and trigger browser download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      const cleanUnit = (unitLabel || 'AllUnits').replace(/[^a-zA-Z0-9]/g, '');
      const startD = days[0]?.dateStr || 'start';
      const endD = days[days.length - 1]?.dateStr || 'end';
      const fileName = `LinePlan_${cleanUnit}_${startD}_${endD}.xlsx`;

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success('Excel line plan downloaded successfully');
    } catch (err: any) {
      console.error('Excel export error:', err);
      toast.error('Failed to export Excel: ' + (err?.message || 'Unknown error'));
    } finally {
      setIsExportingExcel(false);
    }
  };

  // Export PDF using jsPDF + autoTable with clean border grid
  const handlePdfExport = () => {
    setIsExportingPdf(true);
    try {
      // Landscape A3 format
      const doc = new jsPDF({ orientation: 'landscape', format: 'a3' });

      doc.setFontSize(16);
      doc.setTextColor(15, 139, 141);
      doc.text('RUPKATHA APPARELS LTD.', 14, 15);

      doc.setFontSize(12);
      doc.setTextColor(30, 41, 59);
      const buyerPdfSubtitle = selectedBuyers.length > 0 ? ` — Buyers: ${selectedBuyers.join(', ')}` : '';
      const subContractPdfSubtitle = selectedSubContracts.length > 0 ? ` — Sub-contract: ${selectedSubContracts.join(', ')}` : '';
      doc.text(`8-Day Line Plan (${unitLabel})${buyerPdfSubtitle}${subContractPdfSubtitle}`, 14, 23);

      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text(`Period: ${dateRangeLabel} | Generated: ${new Date().toLocaleString()}`, 14, 29);

      const tableHeaders = [
        'Line',
        'Sub-Contract',
        'Buyer',
        'PO',
        'Style',
        'Colour',
        'Start Date',
        'Qty',
        'Type',
        'Tot',
        'Balance & Status',
        ...days.map((d) => d.displayDay),
        'Remarks',
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

      let orderRemarksMap: Record<string, string> = {};
      try {
        const saved = localStorage.getItem('rupkatha_planning_order_remarks');
        if (saved) orderRemarksMap = JSON.parse(saved);
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
        const inBalStr = inBal <= 0 ? '0 ✓ Done' : `${inBal} Short`;

        const outBal = totalIn - totalOut;
        const outBalStr = outBal <= 0 ? '0 ✓ Done' : `${outBal} Short`;

        const washRem = cutQty - totalWashSent;
        const washRemStr =
          washRem === 0 ? '0 ✓ Done' : washRem < 0 ? `+${Math.abs(washRem)} Excess` : `${washRem} Rem.`;

        const washRecvRem = totalWashSent - totalWashRecv;
        const washRecvRemStr =
          washRecvRem <= 0 ? '0 ✓ Done' : `${washRecvRem} Rem.`;

        const finishRem = totalWashRecv - totalFinishing;
        const finishRemStr =
          finishRem <= 0 ? '0 ✓ Done' : `${finishRem} Rem.`;

        const remarksText = orderRemarksMap[orderId] ?? order.remarks ?? '-';

        const cutDays = days.map((d) => {
          const val = cuttingDailyMap[orderId]?.[d.dateStr];
          if (val !== undefined && val > 0) return String(val);
          if (order.start_date === d.dateStr && cutQty > 0) return String(cutQty);
          return '-';
        });

        // CUTTING row
        tableRows.push([
          order.line_no || 'No line',
          order.sub_contract || '-',
          order.buyer || '-',
          order.po,
          order.style || '-',
          order.colour || '-',
          order.start_date || '-',
          orderQty.toLocaleString(),
          'CUTTING',
          cutQty.toLocaleString(),
          cuttingBalanceStr,
          ...cutDays,
          remarksText,
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
          '',
          '',
          'INPUT',
          totalIn.toLocaleString(),
          inBalStr,
          ...days.map((d) => dailyData[orderId]?.[d.dateStr]?.input_qty ?? '-'),
          '',
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
          '',
          'OUTPUT',
          totalOut.toLocaleString(),
          outBalStr,
          ...days.map((d) => dailyData[orderId]?.[d.dateStr]?.output_qty ?? '-'),
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
          '',
          'WASH SENT',
          totalWashSent.toLocaleString(),
          washRemStr,
          ...days.map((d) => dailyData[orderId]?.[d.dateStr]?.wash_sent_qty ?? '-'),
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
          '',
          'WASH RECV',
          totalWashRecv.toLocaleString(),
          washRecvRemStr,
          ...days.map((d) => dailyData[orderId]?.[d.dateStr]?.wash_recv_qty ?? '-'),
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
          '',
          'FINISHING',
          totalFinishing.toLocaleString(),
          finishRemStr,
          ...days.map((d) => dailyData[orderId]?.[d.dateStr]?.finishing_qty ?? '-'),
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
