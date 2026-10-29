/**
 * PDF Export Utility for Sewing ERP Reports
 * Rupkatha Apparels Ltd. (src/lib/exportPdf.js)
 * Includes Management Summary Block, Target vs Actual comparisons, and Shortage analytics.
 */
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import {
  calculatePartMetrics,
  calculateManagementSummary,
  formatNum,
} from './sewingCalc';

export function exportSewingReportsToPdf({ reports, date, unit }) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  // Company Header
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text('RUPKATHA APPARELS LTD.', 14, 15);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105); // slate-600
  doc.text('Raj place, Rishipara, Padma, Dhaka · Knit & Woven Garments ERP', 14, 21);
  doc.text(
    `Sewing Hourly Production & Shortage Report | Date: ${date || 'All Dates'} | Unit: ${unit?.toUpperCase() || 'All'}`,
    14,
    26
  );

  // Horizontal Rule
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.5);
  doc.line(14, 29, pageWidth - 14, 29);

  // Flatten lines
  const allLines = [];
  reports.forEach((rep) => {
    (rep.lines || []).forEach((l) => {
      allLines.push({
        ...l,
        report_date: rep.report_date,
        factory_unit: rep.factory_unit,
        status: rep.status,
      });
    });
  });

  const summary = calculateManagementSummary(allLines);

  // 1. TOP MANAGEMENT SUMMARY TABLE
  const summaryRows = ['output', 'back', 'front', 'asm'].map((pKey) => {
    const pData = summary.byPart[pKey] || {};
    const label =
      pKey === 'output'
        ? 'Out Put (Total Garments)'
        : pKey === 'back'
        ? 'Back Part'
        : pKey === 'front'
        ? 'Front Part'
        : 'A.S.M';
    return [
      label,
      pData.totalTarget !== null ? formatNum(pData.totalTarget) : 'No Target',
      pData.totalActual !== null ? formatNum(pData.totalActual) : '-',
      pData.achievement !== null ? `${pData.achievement}%` : '-',
      pData.shortQty ? `-${formatNum(pData.shortQty)} pcs` : '0',
      pData.shortPct ? `${pData.shortPct}%` : '0%',
      pData.status?.toUpperCase() || '-',
    ];
  });

  doc.autoTable({
    startY: 32,
    head: [[
      'Management Overview Part',
      'Total Target',
      'Actual Output',
      'Achievement %',
      'Short Qty',
      'Short %',
      'Status',
    ]],
    body: summaryRows,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 139, 141], // #0F8B8D teal
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 41, 59],
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: 14, right: 14 },
  });

  // 2. DETAILED LINE PERFORMANCE TABLE
  const lineRows = [];
  allLines.forEach((l) => {
    const outM = calculatePartMetrics(l, 'output');
    const backM = calculatePartMetrics(l, 'back');
    const frontM = calculatePartMetrics(l, 'front');
    const asmM = calculatePartMetrics(l, 'asm');

    const shortExcessText = outM.shortExcessQty !== null
      ? (outM.shortExcessQty > 0 ? `+${outM.shortExcessQty}` : `${outM.shortExcessQty}`)
      : '-';

    lineRows.push([
      `Line 0${l.line_no} (${l.factory_unit?.toUpperCase() || '-'})`,
      l.buyer_name || '-',
      l.style_no || '-',
      l.order_qty || '-',
      `${l.op || 0}/${l.hp || 0}/${l.ir || 0} (${Number(l.op || 0) + Number(l.hp || 0) + Number(l.ir || 0)})`,
      `${outM.workingHours} hrs`,
      `B: ${backM.hourTarget ?? '-'} | F: ${frontM.hourTarget ?? '-'} | O: ${outM.hourTarget ?? '-'} | A: ${asmM.hourTarget ?? '-'}`,
      outM.totalTarget !== null ? formatNum(outM.totalTarget) : 'No Target',
      outM.totalActual !== null ? formatNum(outM.totalActual) : '-',
      shortExcessText,
      outM.achievement !== null ? `${outM.achievement}%` : '-',
      l.remarks || '-',
      l.line_chief_name || '-',
      l.line_chief_phone || '-',
    ]);
  });

  const nextY = doc.lastAutoTable.finalY + 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('Production Lines Target & Shortage Breakdown', 14, nextY);

  doc.autoTable({
    startY: nextY + 3,
    head: [[
      'Line',
      'Buyer',
      'Style No',
      'Order Qty',
      'M.P (O/H/I)',
      'Hrs',
      'Hr Tgts',
      'Out Tgt',
      'Actual',
      'Short',
      'Ach%',
      'Remarks',
      'Chief',
      'Mobile',
    ]],
    body: lineRows,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59], // Slate-800
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 41, 59],
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    didParseCell: (data) => {
      // Color short/excess column
      if (data.section === 'body' && data.column.index === 7) {
        const text = String(data.cell.raw || '');
        if (text.startsWith('-')) {
          data.cell.styles.textColor = [220, 38, 38]; // Red
          data.cell.styles.fontStyle = 'bold';
        } else if (text.startsWith('+')) {
          data.cell.styles.textColor = [217, 119, 6]; // Amber
          data.cell.styles.fontStyle = 'bold';
        } else if (text === '0') {
          data.cell.styles.textColor = [22, 101, 52]; // Green
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
    margin: { left: 14, right: 14 },
  });

  // Signature Block at Bottom
  const finalY = doc.lastAutoTable.finalY + 16;
  if (finalY < 185) {
    const sigY = finalY;
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);

    const sigWidth = 45;
    const startX = 14;
    const gap = 12;

    const roles = ['Prepared By (Reporter)', 'Checked By (APM)', 'Approved By (PM)', 'Verified By (DGM)', 'Authorized By (GM)'];
    roles.forEach((role, i) => {
      const x = startX + i * (sigWidth + gap);
      doc.setDrawColor(148, 163, 184);
      doc.line(x, sigY, x + sigWidth, sigY);
      doc.text(role, x, sigY + 4);
    });
  }

  const fileName = `Rupkatha_Sewing_Report_${date || 'all'}_${unit || 'all'}.pdf`;
  doc.save(fileName);
}
