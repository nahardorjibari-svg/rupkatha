/**
 * Excel Export Utility for Sewing ERP Reports
 * Rupkatha Apparels Ltd. (src/lib/exportExcel.js)
 * Includes Management Summary Sheet, per-part targets, Short/Excess, and Remaining tracking.
 */
import * as XLSX from 'xlsx';
import {
  calculatePartMetrics,
  calculatePartHourlyBreakdown,
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
export function exportSewingReportsToExcel({ reports, finishingReports = [], editLogs = [], date, unit }) {
  const wb = XLSX.utils.book_new();

  // Flatten all Sewing lines
  const allLines = [];
  reports.forEach((rep) => {
    (rep.lines || []).forEach((line) => {
      allLines.push({
        ...line,
        report_date: rep.report_date,
        factory_unit: rep.factory_unit,
        status: rep.status,
      });
    });
  });

  // Flatten all Finishing lines
  const allFinishingLines = [];
  finishingReports.forEach((rep) => {
    (rep.lines || []).forEach((line) => {
      allFinishingLines.push({
        ...line,
        report_date: rep.report_date,
        factory_unit: rep.factory_unit,
        status: rep.status,
      });
    });
  });

  const mgmtSummary = calculateManagementSummary(allLines);
  const finishingMgmtSummary = calculateManagementSummary(allFinishingLines);

  // SHEET 1: MANAGEMENT SUMMARY
  const mgmtRows = [
    ['RUPKATHA APPARELS LTD.'],
    ['Raj place, Rishipara, Padma, Dhaka · Knit & Woven Garments ERP'],
    [`Top Management Summary - Date: ${date || 'All Dates'} | Unit: ${unit?.toUpperCase() || 'All'}`],
    [],
    ['SEWING PART OVERVIEW', 'TOTAL TARGET (PCS)', 'ACTUAL OUTPUT (PCS)', 'ACHIEVEMENT %', 'SHORT QTY (PCS)', 'SHORT %', 'STATUS'],
  ];

  ['output', 'back', 'front', 'asm'].forEach((pKey) => {
    const pData = mgmtSummary.byPart[pKey] || {};
    const label =
      pKey === 'output'
        ? 'Out Put (Total Garments)'
        : pKey === 'back'
        ? 'Back Part'
        : pKey === 'front'
        ? 'Front Part'
        : 'A.S.M';
    mgmtRows.push([
      label,
      pData.totalTarget !== null ? pData.totalTarget : 'No Target',
      pData.totalActual !== null ? pData.totalActual : '-',
      pData.achievement !== null ? `${pData.achievement}%` : '-',
      pData.shortQty ? `-${pData.shortQty}` : '0',
      pData.shortPct ? `${pData.shortPct}%` : '0%',
      pData.status?.toUpperCase() || '-',
    ]);
  });

  mgmtRows.push([]);
  mgmtRows.push(['FINISHING PROCESS OVERVIEW', 'TOTAL TARGET (PCS)', 'ACTUAL OUTPUT (PCS)', 'ACHIEVEMENT %', 'SHORT QTY (PCS)', 'SHORT %', 'STATUS']);
  
  ['output', 'back', 'front', 'asm'].forEach((pKey) => {
    const pData = finishingMgmtSummary.byPart[pKey] || {};
    const label =
      pKey === 'output'
        ? 'Top Side'
        : pKey === 'back'
        ? 'Inside'
        : pKey === 'front'
        ? 'Iron'
        : 'Poly';
    mgmtRows.push([
      label,
      pData.totalTarget !== null ? pData.totalTarget : 'No Target',
      pData.totalActual !== null ? pData.totalActual : '-',
      pData.achievement !== null ? `${pData.achievement}%` : '-',
      pData.shortQty ? `-${pData.shortQty}` : '0',
      pData.shortPct ? `${pData.shortPct}%` : '0%',
      pData.status?.toUpperCase() || '-',
    ]);
  });

  mgmtRows.push([]);
  mgmtRows.push(['LINE PERFORMANCE SUMMARY (SEWING)']);
  mgmtRows.push([
    'Line',
    'Unit',
    'Buyer',
    'Style No',
    'Order Qty',
    'Working Hours',
    'Out Put Target',
    'Actual Output',
    'Short / Excess',
    'Short %',
    'Ach %',
    'Status',
  ]);

  allLines.forEach((l) => {
    const m = calculatePartMetrics(l, 'output');
    mgmtRows.push([
      `Line 0${l.line_no}`,
      l.factory_unit?.toUpperCase() || '-',
      l.buyer_name || '-',
      l.style_no || '-',
      l.order_qty || '-',
      `${m.workingHours} hrs`,
      m.totalTarget !== null ? m.totalTarget : 'No Target',
      m.totalActual !== null ? m.totalActual : '-',
      m.shortExcessQty !== null ? (m.shortExcessQty > 0 ? `+${m.shortExcessQty}` : m.shortExcessQty) : '-',
      m.shortPct ? `${m.shortPct}%` : '0%',
      m.achievement !== null ? `${m.achievement}%` : '-',
      m.status?.toUpperCase() || '-',
    ]);
  });

  const wsMgmt = XLSX.utils.aoa_to_sheet(mgmtRows);
  wsMgmt['!cols'] = [
    { wch: 25 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 16 },
    { wch: 14 },
    { wch: 16 },
  ];
  XLSX.utils.book_append_sheet(wb, wsMgmt, 'Management Summary');

  // SHEET 2: SEWING DETAILED REGISTER
  const detailRows = [
    ['RUPKATHA APPARELS LTD. - SEWING PRODUCTION REGISTER'],
    [`Date: ${date || 'All Dates'} | Factory Unit: ${unit?.toUpperCase() || 'All'}`],
    [],
    [
      'Line',
      'Buyer',
      'Style No',
      'Order Qty',
      'OP',
      'HP',
      'IR%',
      'Parts',
      'Hour Target',
      'Total Target',
      'H01', 'H02', 'H03', 'H04', 'H05', 'H06', 'H07', 'H08', 'H09', 'H10',
      'Total',
      'Remarks',
    ],
  ];

  allLines.forEach((l) => {
    const parts = ['back', 'front', 'output', 'asm'];
    const partLabels = ['Back', 'Front', 'Out Put', 'A.S.M'];
    
    parts.forEach((p, pIdx) => {
      const bd = calculatePartHourlyBreakdown(l, p);
      detailRows.push([
        pIdx === 0 ? `Line 0${l.line_no}` : '',
        pIdx === 0 ? l.buyer_name || '-' : '',
        pIdx === 0 ? l.style_no || '-' : '',
        pIdx === 0 ? l.order_qty || '-' : '',
        pIdx === 0 ? l.op ?? '-' : '',
        pIdx === 0 ? l.hp ?? '-' : '',
        pIdx === 0 ? l.ir ?? '-' : '',
        partLabels[pIdx],
        bd.metrics.hourTarget ?? '-',
        bd.metrics.totalTarget ?? '-',
        ...bd.hourly.map((h) => h.hourActual ?? '-'),
        bd.metrics.totalActual ?? '-',
        pIdx === 0 ? l.remarks || '-' : '',
      ]);
    });
    detailRows.push(['', '', '', '', '', '', '', 'Line Chief:', l.line_chief_name || '-']);
    detailRows.push(['', '', '', '', '', '', '', 'Mobile:', l.line_chief_phone || '-']);
    detailRows.push([]);
  });

  const wsSewing = XLSX.utils.aoa_to_sheet(detailRows);
  XLSX.utils.book_append_sheet(wb, wsSewing, 'Sewing Register');

  // SHEET 3: FINISHING DETAILED REGISTER
  if (allFinishingLines.length > 0) {
    const finRows = [
      ['RUPKATHA APPARELS LTD. - FINISHING PRODUCTION REGISTER'],
      [`Date: ${date || 'All Dates'} | Factory Unit: ${unit?.toUpperCase() || 'All'}`],
      [],
      [
        'Section',
        'Buyer',
        'Style No',
        'Order Qty',
        'Quality', 'Folding', 'Poly', 'Packing',
        'Process',
        'Hour Target',
        'Total Target',
        'H01', 'H02', 'H03', 'H04', 'H05', 'H06', 'H07', 'H08', 'H09', 'H10',
        'Total',
        'Remarks',
      ],
    ];

    allFinishingLines.forEach((l) => {
      const processes = ['back', 'front', 'output', 'asm'];
      const procLabels = ['Inside', 'Iron', 'Top Side', 'Poly'];
      
      processes.forEach((p, pIdx) => {
        const bd = calculatePartHourlyBreakdown(l, p);
        finRows.push([
          pIdx === 0 ? 'Finishing' : '',
          pIdx === 0 ? l.buyer_name || '-' : '',
          pIdx === 0 ? l.style_no || '-' : '',
          pIdx === 0 ? l.order_qty || '-' : '',
          pIdx === 0 ? l.quality_man ?? '-' : '',
          pIdx === 0 ? l.folding_man ?? '-' : '',
          pIdx === 0 ? l.poly_man ?? '-' : '',
          pIdx === 0 ? l.packing_man ?? '-' : '',
          procLabels[pIdx],
          bd.metrics.hourTarget ?? '-',
          bd.metrics.totalTarget ?? '-',
          ...bd.hourly.map((h) => h.hourActual ?? '-'),
          bd.metrics.totalActual ?? '-',
          pIdx === 0 ? l.remarks || '-' : '',
        ]);
      });
      finRows.push(['', '', '', '', '', '', '', '', 'Section Chief:', l.line_chief_name || '-']);
      finRows.push(['', '', '', '', '', '', '', '', 'Mobile:', l.line_chief_phone || '-']);
      finRows.push([]);
    });

    const wsFinishing = XLSX.utils.aoa_to_sheet(finRows);
    XLSX.utils.book_append_sheet(wb, wsFinishing, 'Finishing Report');
  }

  // SHEET 4: EDIT HISTORY
  if (editLogs && editLogs.length > 0) {
    const historyRows = [
      ['RUPKATHA APPARELS LTD. - PRODUCTION EDIT HISTORY'],
      [`Export Date: ${new Date().toLocaleString()}`],
      [],
      ['Type', 'Line/Sec', 'Hour', 'Field', 'Old Value', 'New Value', 'Editor', 'Timestamp'],
    ];

    editLogs.forEach((log) => {
      historyRows.push([
        log.type || 'Sewing',
        log.line_no ? `Line 0${log.line_no}` : 'Finishing',
        log.hour_no ? `H${String(log.hour_no).padStart(2, '0')}` : '-',
        log.field_name,
        log.old_value ?? '-',
        log.new_value ?? '-',
        log.editor_name || 'System',
        new Date(log.edited_at).toLocaleString(),
      ]);
    });

    const wsHistory = XLSX.utils.aoa_to_sheet(historyRows);
    XLSX.utils.book_append_sheet(wb, wsHistory, 'Edit History');
  }

  const fileName = `Rupkatha_ERP_Report_${date || 'all'}_${unit || 'all'}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
