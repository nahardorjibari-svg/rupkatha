/**
 * Attendance & HR Utilities
 * Rupkatha Apparels Ltd.
 */

import { supabase } from './supabaseClient';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { minutesToHhMm, calculateServiceLength } from './dhakaTime';

/**
 * Compresses an image file in the browser to max 600px width/height and 0.6 JPEG quality (~40-60 KB)
 */
export async function compressSelfie(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 600;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context could not be created.'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to encode selfie image.'));
            }
          },
          'image/jpeg',
          0.6
        );
      };
      img.onerror = () => reject(new Error('Could not parse selfie image file.'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Could not read image file.'));
    reader.readAsDataURL(file);
  });
}

export interface GeolocationData {
  lat: number | null;
  lng: number | null;
  acc: number | null;
  error?: string | null;
}

/**
 * Requests high-accuracy geolocation with 15s timeout
 */
export function getBrowserGeolocation(timeoutMs = 15000): Promise<GeolocationData> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({
        lat: null,
        lng: null,
        acc: null,
        error: 'Geolocation is not supported by your browser device.',
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
          acc: Math.round(pos.coords.accuracy),
        });
      },
      (err) => {
        let msg = 'Unable to determine GPS location.';
        if (err.code === 1) {
          msg = 'Location permission was denied. Please allow GPS location in your device settings or browser.';
        } else if (err.code === 2) {
          msg = 'GPS location is currently unavailable.';
        } else if (err.code === 3) {
          msg = 'GPS location request timed out after 15 seconds.';
        }
        resolve({
          lat: null,
          lng: null,
          acc: null,
          error: msg,
        });
      },
      {
        enableHighAccuracy: true,
        timeout: timeoutMs,
        maximumAge: 0,
      }
    );
  });
}

/**
 * Gets a signed URL for a private bucket thumbnail valid for 60s
 */
export async function getSelfieSignedUrl(photoPath: string): Promise<string | null> {
  if (!photoPath) return null;
  try {
    const { data, error } = await supabase.storage
      .from('attendance')
      .createSignedUrl(photoPath, 60);
    if (error || !data?.signedUrl) {
      return null;
    }
    return data.signedUrl;
  } catch {
    return null;
  }
}

/**
 * Export staff directory to Excel
 */
export function exportStaffToExcel(staffList: any[], companyName = 'RUPKATHA APPARELS LTD.'): void {
  const wb = XLSX.utils.book_new();

  const titleRows = [
    [companyName.toUpperCase()],
    ['HR & PAYROLL - STAFF INFORMATION DIRECTORY'],
    [`Generated Date: ${new Date().toLocaleDateString('en-GB')}`],
    [],
  ];

  const headers = [
    'SL',
    'Employee ID',
    'Full Name',
    'Login Email',
    'Department',
    'Designation',
    'Mobile',
    'Joining Date',
    'Service Length',
  ];

  const dataRows = staffList.map((s, idx) => [
    idx + 1,
    s.employee_id || '-',
    s.full_name || s.email || '-',
    s.email || '-',
    s.department || '-',
    s.designation || '-',
    s.mobile || '-',
    s.joining_date || '-',
    calculateServiceLength(s.joining_date),
  ]);

  const sheetData = [...titleRows, headers, ...dataRows];
  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  ws['!cols'] = [
    { wch: 6 },
    { wch: 15 },
    { wch: 25 },
    { wch: 28 },
    { wch: 18 },
    { wch: 20 },
    { wch: 16 },
    { wch: 14 },
    { wch: 22 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Staff Directory');
  XLSX.writeFile(wb, `Staff_Directory_${new Date().toISOString().split('T')[0]}.xlsx`);
}

/**
 * Export Monthly Attendance Summary Report to Excel (.xlsx)
 */
export function exportMonthlyAttendanceToExcel(
  records: any[],
  year: number,
  month: number,
  companyName = 'RUPKATHA APPARELS LTD.'
): void {
  const wb = XLSX.utils.book_new();
  const monthName = new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });

  const titleRows = [
    [companyName.toUpperCase()],
    ['Plot # 12, Road # 03, Sector # 01, Tongi I/A, Gazipur, Bangladesh'],
    [`MONTHLY ATTENDANCE REPORT - ${monthName.toUpperCase()}`],
    [],
  ];

  const headers = [
    'SL',
    'Employee ID',
    'Name',
    'Department',
    'Designation',
    'Present',
    'Absent',
    'Late',
    'Missing OUT',
    'Total Hours',
  ];

  let sumPresent = 0;
  let sumAbsent = 0;
  let sumLate = 0;
  let sumMissingOut = 0;
  let sumMinutes = 0;

  const dataRows = records.map((r, idx) => {
    sumPresent += Number(r.days_present || 0);
    sumAbsent += Number(r.days_absent || 0);
    sumLate += Number(r.days_late || 0);
    sumMissingOut += Number(r.missing_out || 0);
    sumMinutes += Number(r.total_minutes || 0);

    return [
      idx + 1,
      r.employee_id || '-',
      r.full_name || '-',
      r.department || '-',
      r.designation || '-',
      r.days_present ?? 0,
      r.days_absent ?? 0,
      r.days_late ?? 0,
      r.missing_out ?? 0,
      minutesToHhMm(r.total_minutes),
    ];
  });

  const totalsRow = [
    'TOTAL',
    '',
    `${records.length} Staff`,
    '',
    '',
    sumPresent,
    sumAbsent,
    sumLate,
    sumMissingOut,
    minutesToHhMm(sumMinutes),
  ];

  const signatures = [
    [],
    [],
    ['Prepared by (HR)', '', '', 'Checked by', '', '', '', 'Approved by'],
  ];

  const sheetData = [...titleRows, headers, ...dataRows, totalsRow, ...signatures];
  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  ws['!cols'] = [
    { wch: 6 },
    { wch: 15 },
    { wch: 25 },
    { wch: 20 },
    { wch: 20 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 14 },
    { wch: 14 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Monthly Attendance');
  XLSX.writeFile(wb, `Monthly_Attendance_${year}_${String(month).padStart(2, '0')}.xlsx`);
}

/**
 * Export Monthly Attendance Summary Report to PDF
 */
export function exportMonthlyAttendanceToPdf(
  records: any[],
  year: number,
  month: number,
  companyName = 'RUPKATHA APPARELS LTD.'
): void {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const monthName = new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });

  // Header
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(companyName.toUpperCase(), 148, 14, { align: 'center' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Plot # 12, Road # 03, Sector # 01, Tongi I/A, Gazipur, Bangladesh', 148, 19, { align: 'center' });

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`MONTHLY ATTENDANCE REPORT - ${monthName.toUpperCase()}`, 148, 25, { align: 'center' });

  let sumPresent = 0;
  let sumAbsent = 0;
  let sumLate = 0;
  let sumMissingOut = 0;
  let sumMinutes = 0;

  const tableRows = records.map((r, idx) => {
    sumPresent += Number(r.days_present || 0);
    sumAbsent += Number(r.days_absent || 0);
    sumLate += Number(r.days_late || 0);
    sumMissingOut += Number(r.missing_out || 0);
    sumMinutes += Number(r.total_minutes || 0);

    return [
      idx + 1,
      r.employee_id || '-',
      r.full_name || '-',
      r.department || '-',
      r.designation || '-',
      r.days_present ?? 0,
      r.days_absent ?? 0,
      r.days_late ?? 0,
      r.missing_out ?? 0,
      minutesToHhMm(r.total_minutes),
    ];
  });

  // Totals row
  const totalsRow = [
    'TOTAL',
    '',
    `${records.length} Staff`,
    '',
    '',
    sumPresent,
    sumAbsent,
    sumLate,
    sumMissingOut,
    minutesToHhMm(sumMinutes),
  ];

  autoTable(doc, {
    startY: 29,
    head: [[
      'SL',
      'Employee ID',
      'Name',
      'Department',
      'Designation',
      'Present',
      'Absent',
      'Late',
      'Missing OUT',
      'Total Hours',
    ]],
    body: [...tableRows, totalsRow],
    theme: 'grid',
    styles: {
      fontSize: 8.5,
      cellPadding: 2,
      lineColor: [200, 200, 200],
      lineWidth: 0.1,
      textColor: [30, 41, 59],
    },
    headStyles: {
      fillColor: [15, 139, 141],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
    },
    didParseCell: (data) => {
      if (data.row.index === tableRows.length) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [226, 232, 240];
      }
    },
    margin: { left: 14, right: 14 },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 18;
  if (finalY < 190) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.line(20, finalY, 70, finalY);
    doc.text('Prepared by (HR)', 32, finalY + 5);

    doc.line(125, finalY, 175, finalY);
    doc.text('Checked by', 140, finalY + 5);

    doc.line(230, finalY, 280, finalY);
    doc.text('Approved by', 242, finalY + 5);
  }

  doc.save(`Monthly_Attendance_${year}_${String(month).padStart(2, '0')}.pdf`);
}

/**
 * Export Individual Staff Month Sheet to Excel (.xlsx)
 */
export function exportStaffMonthSheetToExcel(
  staff: any,
  days: any[],
  year: number,
  month: number,
  summary: any,
  companyName = 'RUPKATHA APPARELS LTD.'
): void {
  const wb = XLSX.utils.book_new();
  const monthName = new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });

  const titleRows = [
    [companyName.toUpperCase()],
    ['Plot # 12, Road # 03, Sector # 01, Tongi I/A, Gazipur, Bangladesh'],
    [`INDIVIDUAL MONTHLY ATTENDANCE SHEET - ${monthName.toUpperCase()}`],
    [],
    [`Staff Name: ${staff.full_name || staff.email || '-'}`, `Employee ID: ${staff.employee_id || '-'}`],
    [`Department: ${staff.department || '-'}`, `Designation: ${staff.designation || '-'}`],
    [`Joining Date: ${staff.joining_date || '-'}`, `Service Length: ${calculateServiceLength(staff.joining_date)}`],
    [],
    [`Present Days: ${summary.present}`, `Absent Days: ${summary.absent}`, `Fridays: ${summary.fridays}`, `Late Days: ${summary.late}`, `Total Hours: ${summary.totalHours}`],
    [],
  ];

  const headers = [
    'SL',
    'Date (dd-mm-yyyy)',
    'Day Name',
    'IN Time',
    'OUT Time',
    'Working Hours',
    'Late Status',
    'Status',
    'Remarks / Note',
  ];

  const dataRows = days.map((r, idx) => {
    const isFri = r.is_friday;
    let statusText = 'Upcoming';
    if (isFri) statusText = 'Friday - Holiday';
    else if (r.status === 'present') statusText = 'Present';
    else if (r.status === 'absent') statusText = 'ABSENT';
    else if (r.status === 'missing_out') statusText = 'Missing OUT';

    return [
      idx + 1,
      r.d ? `${String(r.d).padStart(2, '0')}-${String(month).padStart(2, '0')}-${year}` : '-',
      r.dow || '-',
      r.check_in_at ? new Date(r.check_in_at).toLocaleTimeString('en-US', { timeZone: 'Asia/Dhaka', hour: '2-digit', minute: '2-digit', hour12: true }) : '-',
      r.check_out_at ? new Date(r.check_out_at).toLocaleTimeString('en-US', { timeZone: 'Asia/Dhaka', hour: '2-digit', minute: '2-digit', hour12: true }) : '-',
      minutesToHhMm(r.minutes),
      r.is_late ? 'LATE' : '-',
      statusText,
      r.note || '',
    ];
  });

  const totalsRow = [
    'TOTAL',
    '',
    '',
    '',
    '',
    summary.totalHours,
    `${summary.late} Late`,
    `${summary.present} Present, ${summary.absent} Absent`,
    '',
  ];

  const signatures = [
    [],
    [],
    ['Prepared by (HR)', '', '', 'Checked by', '', '', 'Approved by'],
  ];

  const sheetData = [...titleRows, headers, ...dataRows, totalsRow, ...signatures];
  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  ws['!cols'] = [
    { wch: 6 },
    { wch: 18 },
    { wch: 12 },
    { wch: 14 },
    { wch: 14 },
    { wch: 16 },
    { wch: 14 },
    { wch: 20 },
    { wch: 24 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Staff Sheet');
  XLSX.writeFile(wb, `Attendance_${staff.employee_id || 'Staff'}_${year}_${String(month).padStart(2, '0')}.xlsx`);
}

/**
 * Export Individual Staff Month Sheet to PDF (A4 Portrait)
 */
export function exportStaffMonthSheetToPdf(
  staff: any,
  days: any[],
  year: number,
  month: number,
  summary: any,
  companyName = 'RUPKATHA APPARELS LTD.'
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const monthName = new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });

  // Header
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text(companyName.toUpperCase(), 105, 12, { align: 'center' });

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text('Plot # 12, Road # 03, Sector # 01, Tongi I/A, Gazipur, Bangladesh', 105, 17, { align: 'center' });

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`MONTHLY ATTENDANCE SHEET - ${monthName.toUpperCase()}`, 105, 23, { align: 'center' });

  // Staff Info Block Box
  doc.setDrawColor(200, 200, 200);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(12, 26, 186, 20, 2, 2, 'FD');

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Name:', 16, 31);
  doc.setFont('helvetica', 'normal');
  doc.text(staff.full_name || staff.email || '-', 30, 31);

  doc.setFont('helvetica', 'bold');
  doc.text('Employee ID:', 110, 31);
  doc.setFont('helvetica', 'normal');
  doc.text(staff.employee_id || '-', 132, 31);

  doc.setFont('helvetica', 'bold');
  doc.text('Department:', 16, 37);
  doc.setFont('helvetica', 'normal');
  doc.text(staff.department || '-', 36, 37);

  doc.setFont('helvetica', 'bold');
  doc.text('Designation:', 110, 37);
  doc.setFont('helvetica', 'normal');
  doc.text(staff.designation || '-', 132, 37);

  doc.setFont('helvetica', 'bold');
  doc.text('Joining Date:', 16, 43);
  doc.setFont('helvetica', 'normal');
  doc.text(staff.joining_date || '-', 36, 43);

  doc.setFont('helvetica', 'bold');
  doc.text('Service Length:', 110, 43);
  doc.setFont('helvetica', 'normal');
  doc.text(calculateServiceLength(staff.joining_date), 134, 43);

  // Summary KPI Mini strip
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(`Present: ${summary.present}  |  Absent: ${summary.absent}  |  Fridays: ${summary.fridays}  |  Late: ${summary.late}  |  Total Hours: ${summary.totalHours}`, 105, 50, { align: 'center' });

  const tableRows = days.map((r, idx) => {
    const isFri = r.is_friday;
    let statusText = 'Upcoming';
    if (isFri) statusText = 'Friday (Holiday)';
    else if (r.status === 'present') statusText = 'Present';
    else if (r.status === 'absent') statusText = 'ABSENT';
    else if (r.status === 'missing_out') statusText = 'Missing OUT';

    const inTime = r.check_in_at ? new Date(r.check_in_at).toLocaleTimeString('en-US', { timeZone: 'Asia/Dhaka', hour: '2-digit', minute: '2-digit', hour12: true }) : '-';
    const outTime = r.check_out_at ? new Date(r.check_out_at).toLocaleTimeString('en-US', { timeZone: 'Asia/Dhaka', hour: '2-digit', minute: '2-digit', hour12: true }) : '-';

    return [
      idx + 1,
      r.d ? `${String(r.d).padStart(2, '0')}-${String(month).padStart(2, '0')}-${year}` : '-',
      r.dow || '-',
      inTime,
      outTime,
      minutesToHhMm(r.minutes),
      r.is_late ? 'LATE' : '-',
      statusText,
      r.note || '',
    ];
  });

  const totalsRow = [
    'TOTAL',
    '',
    '',
    '',
    '',
    summary.totalHours,
    `${summary.late} Late`,
    `${summary.present}P / ${summary.absent}A`,
    '',
  ];

  autoTable(doc, {
    startY: 53,
    head: [[
      'SL',
      'Date',
      'Day',
      'IN Time',
      'OUT Time',
      'Hours',
      'Late',
      'Status',
      'Remarks',
    ]],
    body: [...tableRows, totalsRow],
    theme: 'grid',
    styles: {
      fontSize: 7.2,
      cellPadding: 1.4,
      lineColor: [210, 210, 210],
      lineWidth: 0.1,
      textColor: [30, 41, 59],
    },
    headStyles: {
      fillColor: [15, 139, 141],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
    },
    didParseCell: (data) => {
      if (data.row.index === tableRows.length) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [226, 232, 240];
        return;
      }
      const rawRow = days[data.row.index];
      if (rawRow?.is_friday) {
        data.cell.styles.fillColor = [254, 243, 199]; // amber-100
        data.cell.styles.textColor = [146, 64, 14];
      } else if (rawRow?.status === 'absent') {
        data.cell.styles.fillColor = [254, 226, 226]; // red-100
        data.cell.styles.textColor = [185, 28, 28];
      } else if (rawRow?.status === 'missing_out') {
        data.cell.styles.fillColor = [255, 237, 213]; // orange-100
      }
    },
    margin: { left: 12, right: 12 },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 16;
  if (finalY < 275) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.line(16, finalY, 60, finalY);
    doc.text('Prepared by (HR)', 24, finalY + 4);

    doc.line(85, finalY, 125, finalY);
    doc.text('Checked by', 95, finalY + 4);

    doc.line(150, finalY, 190, finalY);
    doc.text('Approved by', 160, finalY + 4);
  }

  doc.save(`Attendance_Sheet_${staff.employee_id || 'Staff'}_${year}_${String(month).padStart(2, '0')}.pdf`);
}
