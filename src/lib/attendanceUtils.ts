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
    'Designation',
    'Department',
    'Mobile',
    'Joining Date',
    'Service Length',
    'Attendance Allowed',
    'Active Status',
  ];

  const dataRows = staffList.map((s, idx) => [
    idx + 1,
    s.employee_id || '-',
    s.full_name || '-',
    s.designation || '-',
    s.department || '-',
    s.mobile || '-',
    s.joining_date || '-',
    calculateServiceLength(s.joining_date),
    s.has_attendance ? 'Yes' : 'No',
    s.is_active ? 'Active' : 'Inactive',
  ]);

  const sheetData = [...titleRows, headers, ...dataRows];
  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  ws['!cols'] = [
    { wch: 6 },
    { wch: 15 },
    { wch: 25 },
    { wch: 22 },
    { wch: 18 },
    { wch: 16 },
    { wch: 14 },
    { wch: 22 },
    { wch: 18 },
    { wch: 12 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Staff Directory');
  XLSX.writeFile(wb, `Staff_Directory_${new Date().toISOString().split('T')[0]}.xlsx`);
}

/**
 * Export Monthly Attendance Report to Excel (.xlsx) with blank salary columns
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
    'Staff Name',
    'Designation',
    'Joining Date',
    'Service Length',
    'Working Days',
    'Present',
    'Absent',
    'Late',
    'Missing OUT',
    'Total Hours',
    'Basic Salary',
    'Gross Salary',
    'Deduction',
    'Net Pay',
    'Remarks',
  ];

  let sumWorkingDays = 0;
  let sumPresent = 0;
  let sumAbsent = 0;
  let sumLate = 0;
  let sumMissingOut = 0;
  let sumMinutes = 0;

  const dataRows = records.map((r, idx) => {
    sumWorkingDays += Number(r.working_days || 0);
    sumPresent += Number(r.days_present || 0);
    sumAbsent += Number(r.days_absent || 0);
    sumLate += Number(r.days_late || 0);
    sumMissingOut += Number(r.missing_out || 0);
    sumMinutes += Number(r.total_minutes || 0);

    return [
      idx + 1,
      r.employee_id || '-',
      r.full_name || '-',
      r.designation || '-',
      r.joining_date || '-',
      calculateServiceLength(r.joining_date),
      r.working_days ?? 0,
      r.days_present ?? 0,
      r.days_absent ?? 0,
      r.days_late ?? 0,
      r.missing_out ?? 0,
      minutesToHhMm(r.total_minutes),
      '', // Blank for HR salary entry
      '', // Gross
      '', // Deduction
      '', // Net Pay
      '', // Remarks
    ];
  });

  const totalsRow = [
    'TOTAL',
    '',
    `${records.length} Staff`,
    '',
    '',
    '',
    sumWorkingDays,
    sumPresent,
    sumAbsent,
    sumLate,
    sumMissingOut,
    minutesToHhMm(sumMinutes),
    '',
    '',
    '',
    '',
    '',
  ];

  const signatures = [
    [],
    [],
    ['Prepared by (HR)', '', '', 'Checked by', '', '', '', 'Approved by'],
  ];

  const sheetData = [...titleRows, headers, ...dataRows, totalsRow, ...signatures];
  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  ws['!cols'] = [
    { wch: 5 },
    { wch: 14 },
    { wch: 24 },
    { wch: 20 },
    { wch: 13 },
    { wch: 20 },
    { wch: 13 },
    { wch: 10 },
    { wch: 10 },
    { wch: 9 },
    { wch: 12 },
    { wch: 13 },
    { wch: 13 },
    { wch: 13 },
    { wch: 12 },
    { wch: 13 },
    { wch: 16 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Monthly Attendance');
  XLSX.writeFile(wb, `Monthly_Attendance_${year}_${String(month).padStart(2, '0')}.xlsx`);
}

/**
 * Export Monthly Attendance Report to PDF
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

  let sumWorkingDays = 0;
  let sumPresent = 0;
  let sumAbsent = 0;
  let sumLate = 0;
  let sumMissingOut = 0;
  let sumMinutes = 0;

  const tableRows = records.map((r, idx) => {
    sumWorkingDays += Number(r.working_days || 0);
    sumPresent += Number(r.days_present || 0);
    sumAbsent += Number(r.days_absent || 0);
    sumLate += Number(r.days_late || 0);
    sumMissingOut += Number(r.missing_out || 0);
    sumMinutes += Number(r.total_minutes || 0);

    return [
      idx + 1,
      r.employee_id || '-',
      r.full_name || '-',
      r.designation || '-',
      r.joining_date || '-',
      calculateServiceLength(r.joining_date),
      r.working_days ?? 0,
      r.days_present ?? 0,
      r.days_absent ?? 0,
      r.days_late ?? 0,
      r.missing_out ?? 0,
      minutesToHhMm(r.total_minutes),
      '', // Basic
      '', // Gross
      '', // Deduction
      '', // Net Pay
      '', // Remarks
    ];
  });

  // Totals row
  const totalsRow = [
    'TOTAL',
    '',
    `${records.length} Staff`,
    '',
    '',
    '',
    sumWorkingDays,
    sumPresent,
    sumAbsent,
    sumLate,
    sumMissingOut,
    minutesToHhMm(sumMinutes),
    '',
    '',
    '',
    '',
    '',
  ];

  autoTable(doc, {
    startY: 29,
    head: [[
      'SL',
      'ID',
      'Staff Name',
      'Designation',
      'Joining',
      'Service Length',
      'Days',
      'Pres',
      'Abs',
      'Late',
      'No Out',
      'Hours',
      'Basic',
      'Gross',
      'Deduct',
      'Net Pay',
      'Remarks',
    ]],
    body: [...tableRows, totalsRow],
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 1.5,
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
    footStyles: {
      fillColor: [241, 245, 249],
      fontStyle: 'bold',
    },
    didParseCell: (data) => {
      if (data.row.index === tableRows.length) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [226, 232, 240];
      }
    },
    margin: { left: 8, right: 8 },
  });

  // Signature lines at bottom
  const finalY = (doc as any).lastAutoTable.finalY + 18;
  if (finalY < 190) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.line(16, finalY, 60, finalY);
    doc.text('Prepared by (HR)', 25, finalY + 5);

    doc.line(125, finalY, 170, finalY);
    doc.text('Checked by', 140, finalY + 5);

    doc.line(235, finalY, 280, finalY);
    doc.text('Approved by', 248, finalY + 5);
  }

  doc.save(`Monthly_Attendance_${year}_${String(month).padStart(2, '0')}.pdf`);
}
