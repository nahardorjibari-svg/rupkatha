/**
 * Excel Export Utility for Sewing ERP Reports
 * Rupkatha Apparels Ltd. (src/lib/exportExcel.js)
 */
import * as XLSX from 'xlsx';
import { calculateLineHourTotals, calculateAchievement, calculateOutputPerManpower } from './sewingCalc';

export function exportSewingReportsToExcel({ reports, date, unit }) {
  const wb = XLSX.utils.book_new();

  // Flatten all lines across reports
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

  // Build Sheet rows
  const rows = [
    ['RUPKATHA APPARELS LTD.'],
    ['Raj place, Rishipara, Padma, Dhaka · Knit & Woven Garments ERP'],
    [`Sewing Production Report - Date: ${date || 'All Dates'} | Unit: ${unit?.toUpperCase() || 'All'}`],
    [],
    [
      'Line No',
      'Unit',
      'Buyer',
      'Style No',
      'OP',
      'HP',
      'IR%',
      'Manpower',
      'Target',
      'H1',
      'H2',
      'H3',
      'H4',
      'H5',
      'H6',
      'H7',
      'H8',
      'H9',
      'H10',
      'Total Output',
      'Ach%',
      'ASM',
      'Remarks',
    ],
  ];

  allLines.forEach((l) => {
    const hoursMap = {};
    (l.hours || []).forEach((h) => {
      hoursMap[h.hour_no] = h.output_qty ?? '-';
    });

    const { totalOutput } = calculateLineHourTotals(l.hours || []);
    const ach = calculateAchievement(totalOutput, l.total_target);
    const asms = Array.from(new Set((l.hours || []).map((h) => h.asm).filter(Boolean))).join(', ');

    rows.push([
      `Line ${l.line_no}`,
      l.factory_unit?.toUpperCase(),
      l.buyer_name || '-',
      l.style_no || '-',
      l.op ?? '-',
      l.hp ?? '-',
      l.ir ? `${l.ir}%` : '-',
      l.manpower_total ?? '-',
      l.total_target ?? '-',
      hoursMap[1] ?? '-',
      hoursMap[2] ?? '-',
      hoursMap[3] ?? '-',
      hoursMap[4] ?? '-',
      hoursMap[5] ?? '-',
      hoursMap[6] ?? '-',
      hoursMap[7] ?? '-',
      hoursMap[8] ?? '-',
      hoursMap[9] ?? '-',
      hoursMap[10] ?? '-',
      totalOutput ?? '-',
      ach !== null ? `${ach}%` : '-',
      asms || '-',
      l.remarks || '-',
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Column widths
  ws['!cols'] = [
    { wch: 10 },
    { wch: 8 },
    { wch: 18 },
    { wch: 18 },
    { wch: 6 },
    { wch: 6 },
    { wch: 6 },
    { wch: 10 },
    { wch: 10 },
    ...Array.from({ length: 10 }, () => ({ wch: 6 })),
    { wch: 12 },
    { wch: 8 },
    { wch: 15 },
    { wch: 25 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Sewing Production');

  const fileName = `Rupkatha_Sewing_Report_${date || 'all'}_${unit || 'all'}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
