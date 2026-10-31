/**
 * Job Card Export Utilities (Single Staff and All Staff Workbook/PDF)
 * Rupkatha Apparels Ltd.
 */

import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDhakaTimeNoSpace, minutesToHhMm } from './dhakaTime';

export interface JobCardRow {
  sl: number;
  d: number;
  dow: string;
  dateStr: string;
  inTime: string;
  outTime: string;
  otHours: number | string;
  particular: string;
  remarks: string;
  adminEdited?: boolean;
  statusType: 'present' | 'absent' | 'offday' | 'leave' | 'upcoming';
}

export interface JobCardSummary {
  present: number;
  absent: number;
  offday: number;
  leave: number;
  late: number;
  totalOtHours: number;
  totalWorkingHours: string;
}

/**
 * Format a date as DD/MM/YYYY
 */
export function formatDdMmYyyy(d: number, m: number, y: number): string {
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}

export function formatIsoToDdMmYyyy(dateStr?: string | null): string {
  if (!dateStr) return '';
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

/**
 * Get period string: "Period : 01/MM/YYYY to 31/MM/YYYY"
 */
export function getJobCardPeriod(y: number, m: number): string {
  const lastDay = new Date(y, m, 0).getDate();
  return `Period : 01/${String(m).padStart(2, '0')}/${y} to ${String(lastDay).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}

/**
 * Transforms raw rows from hr_staff_month_sheet RPC into JobCardRow[] and JobCardSummary
 */
export function transformRawRowsToJobCard(
  rawRows: any[],
  y: number,
  m: number
): { rows: JobCardRow[]; summary: JobCardSummary } {
  let present = 0;
  let absent = 0;
  let offday = 0;
  let leave = 0;
  let late = 0;
  let totalOt = 0;
  let totalMinutes = 0;

  const rows: JobCardRow[] = (rawRows || []).map((r, idx) => {
    const dateFormatted = formatDdMmYyyy(r.d, m, y);
    const inFormatted = formatDhakaTimeNoSpace(r.check_in_at);
    const outFormatted = formatDhakaTimeNoSpace(r.check_out_at);

    const p = r.particular || '';
    let statusType: 'present' | 'absent' | 'offday' | 'leave' | 'upcoming' = 'upcoming';

    if (p === 'Offday') {
      statusType = 'offday';
      offday++;
    } else if (p === 'Absent') {
      statusType = 'absent';
      absent++;
    } else if (p === 'Leave') {
      statusType = 'leave';
      leave++;
    } else if (p === 'Present') {
      statusType = 'present';
      present++;
    } else {
      statusType = 'upcoming';
    }

    if (r.is_late) late++;
    if (r.ot_hours) totalOt += Number(r.ot_hours);
    if (r.minutes) totalMinutes += Number(r.minutes);

    return {
      sl: r.sl || idx + 1,
      d: r.d,
      dow: r.dow || '',
      dateStr: dateFormatted,
      inTime: inFormatted,
      outTime: outFormatted,
      otHours: r.ot_hours || '',
      particular: p,
      remarks: r.remarks || '',
      adminEdited: Boolean(r.admin_edited),
      statusType,
    };
  });

  const summary: JobCardSummary = {
    present,
    absent,
    offday,
    leave,
    late,
    totalOtHours: Number(totalOt.toFixed(1)),
    totalWorkingHours: minutesToHhMm(totalMinutes),
  };

  return { rows, summary };
}


/**
 * Export a single Job Card to Excel (.xlsx) with print setup fit to 1 page
 */
export function exportSingleJobCardToExcel(
  staff: any,
  rows: JobCardRow[],
  y: number,
  m: number,
  summary: JobCardSummary,
  companyName = 'RUPKATHA APPARELS LTD.'
): void {
  const wb = XLSX.utils.book_new();
  const ws = buildJobCardWorksheet(staff, rows, y, m, summary, companyName);
  XLSX.utils.book_append_sheet(wb, ws, 'Job Card');
  const cardNo = staff.employee_id || 'Staff';
  XLSX.writeFile(wb, `JobCard_${cardNo}_${y}-${String(m).padStart(2, '0')}.xlsx`);
}

/**
 * Helper to build a Job Card worksheet for SheetJS
 */
export function buildJobCardWorksheet(
  staff: any,
  rows: JobCardRow[],
  y: number,
  m: number,
  summary: JobCardSummary,
  companyName = 'RUPKATHA APPARELS LTD.'
): XLSX.WorkSheet {
  const periodStr = getJobCardPeriod(y, m);
  const joiningDateFormatted = formatIsoToDdMmYyyy(staff.joining_date);

  const sheetData: any[][] = [
    // Header lines
    [companyName.toUpperCase()],
    ['JOB CARD'],
    [periodStr],
    [],
    // Left info lines
    [`Card No : ${staff.employee_id || '-'}`, `Name : ${staff.full_name || staff.email || '-'}`],
    [`Designation : ${staff.designation || '-'}`, `Section : ${staff.department || '-'}`],
    [`Joining Date : ${joiningDateFormatted || '-'}`, `Lunch/Dinner Break 1 Hour`],
    [],
    // Table Header
    ['SL', 'Date', 'In Time', 'Out Time', 'OT Hour', 'Particular', 'Remarks'],
  ];

  // Data rows
  rows.forEach((r) => {
    sheetData.push([
      r.sl,
      r.dateStr,
      r.inTime || '',
      r.outTime || '',
      r.otHours !== '' && r.otHours !== 0 ? r.otHours : '',
      r.particular || '',
      r.remarks || '',
    ]);
  });

  // Total OT Row
  sheetData.push([
    'Total',
    '',
    '',
    '',
    summary.totalOtHours > 0 ? summary.totalOtHours : 0,
    '',
    '',
  ]);

  sheetData.push([]);

  // Summary Table Block
  sheetData.push(['--- SUMMARY ---', '']);
  sheetData.push(['Present', summary.present]);
  sheetData.push(['Absent', summary.absent]);
  sheetData.push(['Offday', summary.offday]);
  if (summary.leave > 0) {
    sheetData.push(['Leave', summary.leave]);
  }
  sheetData.push(['Late Count', summary.late]);
  sheetData.push(['Total Working Hours', summary.totalWorkingHours]);

  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  // Column widths
  ws['!cols'] = [
    { wch: 8 },  // SL
    { wch: 14 }, // Date
    { wch: 12 }, // In Time
    { wch: 12 }, // Out Time
    { wch: 10 }, // OT Hour
    { wch: 14 }, // Particular
    { wch: 18 }, // Remarks
  ];

  // Set page setup for 1-page fit
  (ws as any)['!pageSetup'] = {
    orientation: 'portrait',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 1,
    paperSize: 9, // A4
  };

  return ws;
}

/**
 * Export Job Card to A4 Portrait PDF (Single Page Fit)
 */
export function exportSingleJobCardToPdf(
  staff: any,
  rows: JobCardRow[],
  y: number,
  m: number,
  summary: JobCardSummary,
  companyName = 'RUPKATHA APPARELS LTD.'
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  renderJobCardPdfPage(doc, staff, rows, y, m, summary, companyName);

  const cardNo = staff.employee_id || 'Staff';
  doc.save(`JobCard_${cardNo}_${y}-${String(m).padStart(2, '0')}.pdf`);
}

/**
 * Renders a complete Job Card onto a jsPDF page
 */
export function renderJobCardPdfPage(
  doc: jsPDF,
  staff: any,
  rows: JobCardRow[],
  y: number,
  m: number,
  summary: JobCardSummary,
  companyName = 'RUPKATHA APPARELS LTD.'
): void {
  const periodStr = getJobCardPeriod(y, m);
  const joiningDateFormatted = formatIsoToDdMmYyyy(staff.joining_date);

  // 1. Centered Header
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(companyName.toUpperCase(), 105, 11, { align: 'center' });

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('JOB CARD', 105, 16.5, { align: 'center' });

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(periodStr, 105, 21.5, { align: 'center' });

  // 2. Left info lines (Clean 2-column key-value)
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(`Card No : ${staff.employee_id || '-'}`, 14, 27);
  doc.text(`Name : ${staff.full_name || staff.email || '-'}`, 90, 27);

  doc.text(`Designation : ${staff.designation || '-'}`, 14, 32);
  doc.text(`Section : ${staff.department || '-'}`, 90, 32);

  doc.text(`Joining Date : ${joiningDateFormatted || '-'}`, 14, 37);
  doc.setFont('helvetica', 'normal');
  doc.text(`Lunch/Dinner Break 1 Hour`, 90, 37);

  // 3. Table Rows
  const tableBody = rows.map((r) => [
    r.sl,
    r.dateStr,
    r.inTime || '',
    r.outTime || '',
    r.otHours !== '' && r.otHours !== 0 ? r.otHours : '',
    r.particular || '',
    r.remarks || '',
  ]);

  // Total OT row
  tableBody.push([
    'Total',
    '',
    '',
    '',
    summary.totalOtHours > 0 ? summary.totalOtHours : 0,
    '',
    '',
  ]);

  autoTable(doc, {
    startY: 40,
    head: [[
      'SL',
      'Date',
      'In Time',
      'Out Time',
      'OT Hour',
      'Particular',
      'Remarks',
    ]],
    body: tableBody,
    theme: 'grid',
    styles: {
      fontSize: 7.2,
      cellPadding: 1.1, // Ultra compact so 31 rows + header fit perfectly on 1 page
      lineColor: [30, 41, 59],
      lineWidth: 0.15,
      textColor: [0, 0, 0],
      halign: 'center',
    },
    headStyles: {
      fillColor: [226, 232, 240], // Light Gray Header
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      halign: 'center',
      lineColor: [30, 41, 59],
      lineWidth: 0.15,
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 26, halign: 'center' },
      2: { cellWidth: 26, halign: 'center' },
      3: { cellWidth: 26, halign: 'center' },
      4: { cellWidth: 20, halign: 'center' },
      5: { cellWidth: 32, halign: 'center' },
      6: { cellWidth: 42, halign: 'left' },
    },
    didParseCell: (data) => {
      // Last row is total
      if (data.row.index === rows.length) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [241, 245, 249];
        return;
      }

      const raw = rows[data.row.index];
      if (raw) {
        if (raw.statusType === 'offday') {
          data.cell.styles.fillColor = [34, 197, 94]; // Bright Green (#22C55E / #00FF00)
          data.cell.styles.textColor = [255, 255, 255];
          data.cell.styles.fontStyle = 'bold';
        } else if (raw.statusType === 'absent') {
          data.cell.styles.fillColor = [255, 192, 0]; // Orange/Amber (#FFC000)
          data.cell.styles.textColor = [0, 0, 0];
          data.cell.styles.fontStyle = 'bold';
        } else if (raw.statusType === 'leave') {
          data.cell.styles.fillColor = [186, 230, 253]; // Light Blue (#BAE6FD)
          data.cell.styles.textColor = [12, 74, 110];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
    margin: { left: 14, right: 14 },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || 240;

  // 4. Summary Table at Bottom Left
  const summaryBody = [
    ['Present', summary.present],
    ['Absent', summary.absent],
    ['Offday', summary.offday],
  ];
  if (summary.leave > 0) {
    summaryBody.push(['Leave', summary.leave]);
  }
  summaryBody.push(['Late', summary.late]);
  summaryBody.push(['Total Hours', summary.totalWorkingHours]);

  autoTable(doc, {
    startY: finalY + 4,
    head: [['Summary', 'Count / Total']],
    body: summaryBody,
    theme: 'grid',
    styles: {
      fontSize: 6.8,
      cellPadding: 1,
      lineColor: [30, 41, 59],
      lineWidth: 0.15,
      textColor: [0, 0, 0],
    },
    headStyles: {
      fillColor: [226, 232, 240],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
    },
    margin: { left: 14, right: 130 }, // Left-aligned compact box
    tableWidth: 65,
  });

  // 5. Signature Lines at Bottom Right
  const sigY = 282;
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');

  doc.line(90, sigY, 120, sigY);
  doc.text('Prepared by HR', 105, sigY + 3.5, { align: 'center' });

  doc.line(130, sigY, 160, sigY);
  doc.text('Checked by', 145, sigY + 3.5, { align: 'center' });

  doc.line(170, sigY, 196, sigY);
  doc.text('Approved by', 183, sigY + 3.5, { align: 'center' });
}

/**
 * Export all staff Job Cards into a single multi-page PDF (one Job Card per page)
 */
export function exportAllStaffJobCardsToPdf(
  staffList: { staff: any; rows: JobCardRow[]; summary: JobCardSummary }[],
  y: number,
  m: number,
  companyName = 'RUPKATHA APPARELS LTD.'
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  staffList.forEach((item, index) => {
    if (index > 0) {
      doc.addPage('a4', 'portrait');
    }
    renderJobCardPdfPage(doc, item.staff, item.rows, y, m, item.summary, companyName);
  });

  doc.save(`JobCards_AllStaff_${y}-${String(m).padStart(2, '0')}.pdf`);
}

/**
 * Export all staff Job Cards into an Excel workbook (one sheet per staff + Summary sheet)
 */
export function exportAllStaffJobCardsToExcel(
  staffList: { staff: any; rows: JobCardRow[]; summary: JobCardSummary }[],
  y: number,
  m: number,
  companyName = 'RUPKATHA APPARELS LTD.'
): void {
  const wb = XLSX.utils.book_new();

  // 1. Overall Summary Sheet
  const summaryHeaders = [
    'SL',
    'Employee ID',
    'Name',
    'Department',
    'Designation',
    'Present',
    'Absent',
    'Offday',
    'Late',
    'OT Hours',
    'Working Hours',
  ];

  const summaryRows = staffList.map((item, idx) => [
    idx + 1,
    item.staff.employee_id || '-',
    item.staff.full_name || item.staff.email || '-',
    item.staff.department || '-',
    item.staff.designation || '-',
    item.summary.present,
    item.summary.absent,
    item.summary.offday,
    item.summary.late,
    item.summary.totalOtHours,
    item.summary.totalWorkingHours,
  ]);

  const summaryData = [
    [companyName.toUpperCase()],
    [`ALL STAFF JOB CARD SUMMARY - ${getJobCardPeriod(y, m)}`],
    [],
    summaryHeaders,
    ...summaryRows,
  ];

  const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
  summaryWs['!cols'] = [
    { wch: 6 },
    { wch: 15 },
    { wch: 25 },
    { wch: 18 },
    { wch: 20 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 12 },
    { wch: 16 },
  ];
  XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary List');

  // 2. Individual Job Card sheets (sheet name capped at 31 chars for Excel)
  staffList.forEach((item) => {
    const ws = buildJobCardWorksheet(item.staff, item.rows, y, m, item.summary, companyName);
    const rawName = item.staff.employee_id || item.staff.full_name || 'Staff';
    // Clean sheet name: sanitize and limit length
    const cleanName = String(rawName).replace(/[*?:/\\\[\]]/g, '').slice(0, 31);
    // Ensure uniqueness
    let sheetName = cleanName || 'Staff';
    let counter = 1;
    while (wb.SheetNames.includes(sheetName)) {
      sheetName = `${cleanName.slice(0, 27)}_${counter++}`;
    }
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });

  XLSX.writeFile(wb, `JobCards_Workbook_${y}-${String(m).padStart(2, '0')}.xlsx`);
}

