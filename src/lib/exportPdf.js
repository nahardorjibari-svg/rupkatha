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

/**
 * @param {Object} options
 * @param {Array} options.reports
 * @param {Array} [options.finishingReports]
 * @param {string} options.date
 * @param {string} options.unit
 */
export function exportSewingReportsToPdf({ reports, finishingReports = [], editLogs = [], date, unit }) {
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
    `ERP Hourly Production & Shortage Report | Date: ${date || 'All Dates'} | Unit: ${unit?.toUpperCase() || 'All'}`,
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

  const allFinishingLines = [];
  finishingReports.forEach((rep) => {
    (rep.lines || []).forEach((l) => {
      allFinishingLines.push({
        ...l,
        report_date: rep.report_date,
        factory_unit: rep.factory_unit,
        status: rep.status,
      });
    });
  });

  const summary = calculateManagementSummary(allLines);
  const finishingSummary = calculateManagementSummary(allFinishingLines);

  // 1. TOP MANAGEMENT SUMMARY TABLE
  const summaryRows = [];
  
  // Sewing Rows
  ['output', 'back', 'front', 'asm'].forEach((pKey) => {
    const pData = summary.byPart[pKey] || {};
    const label =
      pKey === 'output'
        ? 'Sewing: Out Put'
        : pKey === 'back'
        ? 'Sewing: Back Part'
        : pKey === 'front'
        ? 'Sewing: Front Part'
        : 'Sewing: A.S.M';
    summaryRows.push([
      label,
      pData.totalTarget !== null ? formatNum(pData.totalTarget) : 'No Target',
      pData.totalActual !== null ? formatNum(pData.totalActual) : '-',
      pData.achievement !== null ? `${pData.achievement}%` : '-',
      pData.shortQty ? `-${formatNum(pData.shortQty)} pcs` : '0',
      pData.shortPct ? `${pData.shortPct}%` : '0%',
      pData.status?.toUpperCase() || '-',
    ]);
  });

  // Finishing Rows
  ['output', 'back', 'front', 'asm'].forEach((pKey) => {
    const pData = finishingSummary.byPart[pKey] || {};
    const label =
      pKey === 'output'
        ? 'Finishing: Top Side'
        : pKey === 'back'
        ? 'Finishing: Inside'
        : pKey === 'front'
        ? 'Finishing: Iron'
        : 'Finishing: Poly';
    summaryRows.push([
      label,
      pData.totalTarget !== null ? formatNum(pData.totalTarget) : 'No Target',
      pData.totalActual !== null ? formatNum(pData.totalActual) : '-',
      pData.achievement !== null ? `${pData.achievement}%` : '-',
      pData.shortQty ? `-${formatNum(pData.shortQty)} pcs` : '0',
      pData.shortPct ? `${pData.shortPct}%` : '0%',
      pData.status?.toUpperCase() || '-',
    ]);
  });

  doc.autoTable({
    startY: 32,
    head: [[
      'Management Overview Module/Part',
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

  // 2. DETAILED PERFORMANCE TABLE (SEWING)
  const sewingRows = [];
  allLines.forEach((l) => {
    const outM = calculatePartMetrics(l, 'output');
    const backM = calculatePartMetrics(l, 'back');
    const frontM = calculatePartMetrics(l, 'front');
    const asmM = calculatePartMetrics(l, 'asm');

    const shortExcessText = outM.shortExcessQty !== null
      ? (outM.shortExcessQty > 0 ? `+${outM.shortExcessQty}` : `${outM.shortExcessQty}`)
      : '-';

    sewingRows.push([
      `Line 0${l.line_no}`,
      l.buyer_name || '-',
      l.style_no || '-',
      l.order_qty || '-',
      `${l.op || 0}/${l.hp || 0}/${l.ir || 0}`,
      `${outM.workingHours}h`,
      `B:${backM.hourTarget??'-'} F:${frontM.hourTarget??'-'} O:${outM.hourTarget??'-'} A:${asmM.hourTarget??'-'}`,
      outM.totalTarget ?? '-',
      outM.totalActual ?? '-',
      shortExcessText,
      `${outM.achievement}%`,
      l.remarks || '-',
    ]);
  });

  doc.autoTable({
    startY: doc.lastAutoTable.finalY + 10,
    head: [['Sewing Line', 'Buyer', 'Style', 'Order', 'M.P', 'Hrs', 'Hr Tgts', 'Tot Tgt', 'Actual', 'Short', 'Ach%', 'Remarks']],
    body: sewingRows,
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59], fontSize: 8 },
    bodyStyles: { fontSize: 7 },
    margin: { left: 14, right: 14 },
  });

  // 3. DETAILED PERFORMANCE TABLE (FINISHING)
  if (allFinishingLines.length > 0) {
    doc.addPage();
    doc.text('FINISHING MODULE PRODUCTION DETAILS', 14, 15);
    
    const finRows = [];
    allFinishingLines.forEach((l) => {
      const topM = calculatePartMetrics(l, 'output');
      const inM = calculatePartMetrics(l, 'back');
      const irM = calculatePartMetrics(l, 'front');
      const poM = calculatePartMetrics(l, 'asm');

      const shortExcessText = topM.shortExcessQty !== null
        ? (topM.shortExcessQty > 0 ? `+${topM.shortExcessQty}` : `${topM.shortExcessQty}`)
        : '-';

      const totMan = Number(l.quality_man || 0) + Number(l.folding_man || 0) + Number(l.poly_man || 0) + Number(l.packing_man || 0);

      finRows.push([
        'Finishing',
        l.buyer_name || '-',
        l.style_no || '-',
        l.order_qty || '-',
        `Q:${l.quality_man||0}/F:${l.folding_man||0}/P:${l.poly_man||0}/Pk:${l.packing_man||0} (${totMan})`,
        `${topM.workingHours}h`,
        `In:${inM.hourTarget??'-'} Ir:${irM.hourTarget??'-'} TS:${topM.hourTarget??'-'} Po:${poM.hourTarget??'-'}`,
        topM.totalTarget ?? '-',
        topM.totalActual ?? '-',
        shortExcessText,
        `${topM.achievement}%`,
        l.remarks || '-',
      ]);
    });

    doc.autoTable({
      startY: 20,
      head: [['Section', 'Buyer', 'Style', 'Order', 'Manpower Breakdown', 'Hrs', 'Hr Tgts', 'Tot Tgt', 'Actual', 'Short', 'Ach%', 'Remarks']],
      body: finRows,
      theme: 'grid',
      headStyles: { fillColor: [180, 83, 9], fontSize: 8 }, // Amber-700
      bodyStyles: { fontSize: 7 },
      margin: { left: 14, right: 14 },
    });
  }

  // Footer & Signatures
  const addFooter = () => {
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Page ${i} of ${pageCount}`, pageWidth - 25, doc.internal.pageSize.getHeight() - 10);
      
      const sigY = doc.internal.pageSize.getHeight() - 25;
      const sigWidth = 45;
      const startX = 14;
      const gap = 12;
      const roles = ['Reporter', 'APM', 'PM', 'DGM', 'GM'];
      
      roles.forEach((role, idx) => {
        const x = startX + idx * (sigWidth + gap);
        doc.setDrawColor(200);
        doc.line(x, sigY, x + sigWidth, sigY);
        doc.text(role, x + (sigWidth / 2), sigY + 5, { align: 'center' });
      });
    }
  };

  addFooter();
  const fileName = `Rupkatha_ERP_Report_${date || 'all'}_${unit || 'all'}.pdf`;
  doc.save(fileName);
}

