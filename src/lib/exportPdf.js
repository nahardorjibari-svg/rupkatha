/**
 * PDF Export Utility for Sewing ERP Reports
 * Rupkatha Apparels Ltd. (src/lib/exportPdf.js)
 */
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { calculateLineHourTotals, calculateAchievement } from './sewingCalc';

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
  doc.text(`Sewing Production Report | Date: ${date || 'All Dates'} | Unit: ${unit?.toUpperCase() || 'All'}`, 14, 26);

  // Horizontal Rule
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.5);
  doc.line(14, 30, pageWidth - 14, 30);

  // Flatten lines
  const tableRows = [];
  reports.forEach((rep) => {
    (rep.lines || []).forEach((l) => {
      const { totalOutput } = calculateLineHourTotals(l.hours || []);
      const ach = calculateAchievement(totalOutput, l.total_target);
      const asms = Array.from(new Set((l.hours || []).map((h) => h.asm).filter(Boolean))).join(', ');

      tableRows.push([
        `Line ${l.line_no} (${l.factory_unit?.toUpperCase()})`,
        l.buyer_name || '-',
        l.style_no || '-',
        l.op ?? '-',
        l.hp ?? '-',
        l.manpower_total ?? '-',
        l.total_target ?? '-',
        totalOutput ?? '-',
        ach !== null ? `${ach}%` : '-',
        asms || '-',
        l.remarks || '-',
      ]);
    });
  });

  doc.autoTable({
    startY: 34,
    head: [[
      'Line',
      'Buyer',
      'Style No',
      'OP',
      'HP',
      'Manpower',
      'Target',
      'Output',
      'Ach%',
      'ASM',
      'Remarks',
    ]],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 139, 141], // #0F8B8D teal
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
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

  // Signature Block at Bottom
  const finalY = doc.lastAutoTable.finalY + 20;
  if (finalY < 170) {
    const sigY = finalY;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);

    const sigWidth = 45;
    const startX = 14;
    const gap = 15;

    const roles = ['Prepared By (Reporter)', 'Checked By (APM)', 'Approved By (PM)', 'Verified By (DGM)', 'Authorized By (GM)'];
    roles.forEach((role, i) => {
      const x = startX + i * (sigWidth + gap);
      doc.setDrawColor(148, 163, 184);
      doc.line(x, sigY, x + sigWidth, sigY);
      doc.text(role, x, sigY + 5);
    });
  }

  const fileName = `Rupkatha_Sewing_Report_${date || 'all'}_${unit || 'all'}.pdf`;
  doc.save(fileName);
}
