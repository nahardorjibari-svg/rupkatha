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

export function exportSewingReportsToExcel({ reports, date, unit }) {
  const wb = XLSX.utils.book_new();

  // Flatten all lines
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

  const mgmtSummary = calculateManagementSummary(allLines);

  // SHEET 1: MANAGEMENT SUMMARY
  const mgmtRows = [
    ['RUPKATHA APPARELS LTD.'],
    ['Raj place, Rishipara, Padma, Dhaka · Knit & Woven Garments ERP'],
    [`Top Management Summary - Date: ${date || 'All Dates'} | Unit: ${unit?.toUpperCase() || 'All'}`],
    [],
    ['PART OVERVIEW', 'TOTAL TARGET (PCS)', 'ACTUAL OUTPUT (PCS)', 'ACHIEVEMENT %', 'SHORT QTY (PCS)', 'SHORT %', 'STATUS'],
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
  mgmtRows.push(['LINE PERFORMANCE SUMMARY']);
  mgmtRows.push([
    'Line',
    'Unit',
    'Buyer',
    'Style No',
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

  // SHEET 2: DETAILED SEWING PRODUCTION REGISTER
  const detailRows = [
    ['RUPKATHA APPARELS LTD. - HOURLY PRODUCTION REGISTER'],
    [`Date: ${date || 'All Dates'} | Factory Unit: ${unit?.toUpperCase() || 'All'}`],
    [],
    [
      'Line',
      'Buyer',
      'Style No',
      'OP',
      'HP',
      'IR%',
      'Parts / Row Type',
      'Hour Target',
      'Total Target',
      'H01',
      'H02',
      'H03',
      'H04',
      'H05',
      'H06',
      'H07',
      'H08',
      'H09',
      'H10',
      'Total / Final',
      'Remarks / Status',
    ],
  ];

  allLines.forEach((l) => {
    const backB = calculatePartHourlyBreakdown(l, 'back');
    const frontB = calculatePartHourlyBreakdown(l, 'front');
    const outB = calculatePartHourlyBreakdown(l, 'output');
    const asmB = calculatePartHourlyBreakdown(l, 'asm');

    const asms = Array.from(new Set((l.hours || []).map((h) => h.asm).filter(Boolean))).join(', ');
    const linePrefix = `Line 0${l.line_no}`;

    // 1. Back Row
    detailRows.push([
      linePrefix,
      l.buyer_name || '-',
      l.style_no || '-',
      l.op ?? '-',
      l.hp ?? '-',
      l.ir ? `${l.ir}%` : '-',
      'Back',
      backB.metrics.hourTarget ?? '-',
      backB.metrics.totalTarget ?? '-',
      ...backB.hourly.map((h) => h.hourActual ?? '-'),
      backB.metrics.totalActual ?? '-',
      l.remarks || '-',
    ]);

    // 2. Front Row
    detailRows.push([
      '',
      '',
      '',
      '',
      '',
      '',
      'Front',
      frontB.metrics.hourTarget ?? '-',
      frontB.metrics.totalTarget ?? '-',
      ...frontB.hourly.map((h) => h.hourActual ?? '-'),
      frontB.metrics.totalActual ?? '-',
      '',
    ]);

    // 3. Out Put Row
    detailRows.push([
      '',
      '',
      '',
      '',
      '',
      '',
      'Out Put',
      outB.metrics.hourTarget ?? '-',
      outB.metrics.totalTarget ?? '-',
      ...outB.hourly.map((h) => h.hourActual ?? '-'),
      outB.metrics.totalActual ?? '-',
      outB.metrics.achievement !== null ? `${outB.metrics.achievement}% Achieved` : '-',
    ]);

    // 4. A.S.M Row
    detailRows.push([
      '',
      '',
      '',
      '',
      '',
      '',
      'A.S.M',
      asmB.metrics.hourTarget ?? '-',
      asmB.metrics.totalTarget ?? '-',
      ...asmB.hourly.map((h) => h.hourActual ?? '-'),
      asmB.metrics.totalActual ?? '-',
      asms ? `ASM: ${asms}` : '',
    ]);

    // 5. SHORT / EXCESS Rows for Back, Front, Out Put, A.S.M
    ['back', 'front', 'output', 'asm'].forEach((pKey) => {
      const breakdown = pKey === 'back' ? backB : pKey === 'front' ? frontB : pKey === 'asm' ? asmB : outB;
      const partName = pKey === 'back' ? 'Back' : pKey === 'front' ? 'Front' : pKey === 'asm' ? 'A.S.M' : 'Out Put';
      const m = breakdown.metrics;
      detailRows.push([
        '',
        '',
        '',
        '',
        '',
        '',
        `SHORT/EXCESS (${partName})`,
        '-',
        '-',
        ...breakdown.hourly.map((h) => (h.shortExcess !== null ? (h.shortExcess > 0 ? `+${h.shortExcess}` : h.shortExcess) : '-')),
        m.shortExcessQty !== null ? (m.shortExcessQty > 0 ? `+${m.shortExcessQty}` : m.shortExcessQty) : '-',
        m.shortPct ? `Short ${m.shortPct}%` : '',
      ]);
    });

    // 6. REMAINING Rows for Back, Front, Out Put, A.S.M
    ['back', 'front', 'output', 'asm'].forEach((pKey) => {
      const breakdown = pKey === 'back' ? backB : pKey === 'front' ? frontB : pKey === 'asm' ? asmB : outB;
      const partName = pKey === 'back' ? 'Back' : pKey === 'front' ? 'Front' : pKey === 'asm' ? 'A.S.M' : 'Out Put';
      const m = breakdown.metrics;
      detailRows.push([
        '',
        '',
        '',
        '',
        '',
        '',
        `REMAINING (${partName})`,
        '-',
        '-',
        ...breakdown.hourly.map((h) => (h.remaining !== null ? h.remaining : '-')),
        m.totalTarget !== null ? Math.max(0, m.totalTarget - (m.totalActual || 0)) : '-',
        '',
      ]);
    });

    // Separator line
    detailRows.push([]);
  });

  const wsDetail = XLSX.utils.aoa_to_sheet(detailRows);
  wsDetail['!cols'] = [
    { wch: 10 },
    { wch: 14 },
    { wch: 14 },
    { wch: 6 },
    { wch: 6 },
    { wch: 6 },
    { wch: 22 },
    { wch: 12 },
    { wch: 12 },
    ...Array.from({ length: 10 }, () => ({ wch: 7 })),
    { wch: 14 },
    { wch: 20 },
  ];
  XLSX.utils.book_append_sheet(wb, wsDetail, 'Line Register & Shortage');

  const fileName = `Rupkatha_Sewing_Report_${date || 'all'}_${unit || 'all'}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
