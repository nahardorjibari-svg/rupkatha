/**
 * Store & Inventory Formatting and Export Utilities
 * - Bangladeshi Lakh/Crore Number Formatting (23,45,750)
 * - BDT (৳) & USD Currency Formatting
 * - ExcelJS (.xlsx) & jsPDF (.pdf with Hind Siliguri Bangla font support)
 */

import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { StoreGrn, StoreItem, StoreStockStatusRow } from '../types/store';

/**
 * Formats a number in Bangladeshi comma grouping (e.g. 23,45,750).
 */
export function formatNumberBD(value: number | null | undefined, decimals = 0): string {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return '0';
  return num.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Formats BDT currency with Bangladeshi grouping: ৳ 23,45,750
 */
export function formatBDT(value: number | null | undefined, decimals = 0): string {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return '৳ 0';
  const abs = Math.abs(num);
  const formatted = abs.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return num < 0 ? `-৳ ${formatted}` : `৳ ${formatted}`;
}

/**
 * Formats currency (BDT or USD)
 */
export function formatStoreCurrency(
  value: number | null | undefined,
  currency: string = 'BDT',
  decimals?: number
): string {
  const dec = decimals ?? (currency === 'USD' ? 2 : 0);
  if (currency === 'USD') {
    const num = Number(value ?? 0);
    return `$ ${num.toLocaleString('en-US', {
      minimumFractionDigits: dec,
      maximumFractionDigits: dec,
    })}`;
  }
  return formatBDT(value, dec);
}

/**
 * Formats YYYY-MM or ISO month string into "Nov 2026"
 */
export function formatMonthLabel(monthStr: string): string {
  if (!monthStr) return '';
  const clean = monthStr.slice(0, 7);
  const parts = clean.split('-');
  if (parts.length === 2) {
    const y = Number(parts[0]);
    const m = Number(parts[1]);
    if (y && m) {
      const d = new Date(Date.UTC(y, m - 1, 1));
      return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' });
    }
  }
  return monthStr;
}

/**
 * Formats date/timestamp in Asia/Dhaka
 */
export function formatStoreDateTime(iso?: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-GB', {
    timeZone: 'Asia/Dhaka',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatStoreDate(dateStr?: string | null): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T12:00:00+06:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-GB', {
    timeZone: 'Asia/Dhaka',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// Cached Hind Siliguri Base64 Font for jsPDF Bangla rendering
let cachedBanglaFontBase64: string | null = null;
let fontFetchAttempted = false;

async function getHindSiliguriBase64(): Promise<string | null> {
  if (cachedBanglaFontBase64) return cachedBanglaFontBase64;
  if (fontFetchAttempted) return null;
  fontFetchAttempted = true;

  const fontUrls = [
    'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/hindsiliguri/HindSiliguri-Regular.ttf',
    'https://raw.githubusercontent.com/google/fonts/main/ofl/hindsiliguri/HindSiliguri-Regular.ttf',
  ];

  for (const url of fontUrls) {
    try {
      const res = await fetch(url, { mode: 'cors' });
      if (!res.ok) continue;
      const buf = await res.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = '';
      const chunkSize = 0x8000;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
      }
      cachedBanglaFontBase64 = btoa(binary);
      return cachedBanglaFontBase64;
    } catch {
      // Try next CDN URL
    }
  }
  return null;
}

export async function registerBanglaFontOnPdf(doc: jsPDF): Promise<string> {
  const base64 = await getHindSiliguriBase64();
  if (base64) {
    try {
      doc.addFileToVFS('HindSiliguri-Regular.ttf', base64);
      doc.addFont('HindSiliguri-Regular.ttf', 'HindSiliguri', 'normal');
      return 'HindSiliguri';
    } catch {
      return 'helvetica';
    }
  }
  return 'helvetica';
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface ItemExportRow {
  statusRow: StoreStockStatusRow;
  item?: StoreItem;
}

export async function exportStoreItemsExcel(rows: ItemExportRow[], filenameDate: string) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Item Master');

  sheet.mergeCells('A1:J1');
  sheet.getCell('A1').value = 'RUPKATHA APPARELS LTD.';
  sheet.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FF0F172A' } };
  sheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };

  sheet.mergeCells('A2:J2');
  sheet.getCell('A2').value = `Store Item Master & Stock Summary | Generated: ${filenameDate}`;
  sheet.getCell('A2').font = { size: 10, color: { argb: 'FF475569' } };
  sheet.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };

  sheet.addRow([]);

  const headers = [
    'SKU',
    'Item Name',
    'Bangla Name',
    'Category',
    'UOM',
    'Knit Qty',
    'Woven Qty',
    'Total Stock',
    'Minimum Stock',
    'Default Cost',
    'Stock Value (BDT)',
    'Status',
  ];

  // Unmerge and re-merge across 12 cols
  sheet.unMergeCells('A1:J1');
  sheet.unMergeCells('A2:J2');
  sheet.mergeCells('A1:L1');
  sheet.mergeCells('A2:L2');

  const headerRow = sheet.addRow(headers);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F8B8D' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    };
  });

  rows.forEach(({ statusRow, item }) => {
    const r = sheet.addRow([
      statusRow.sku,
      statusRow.item_name,
      statusRow.item_name_bn || item?.name_bn || '',
      statusRow.category_name,
      statusRow.uom,
      Number(statusRow.knit_qty || 0),
      Number(statusRow.woven_qty || 0),
      Number(statusRow.current_stock || 0),
      Number(statusRow.minimum_stock || 0),
      item ? `${item.default_currency || 'BDT'} ${Number(item.default_unit_cost || 0)}` : '-',
      Number(statusRow.stock_value || 0),
      statusRow.status.replace('_', ' ').toUpperCase(),
    ]);
    r.eachCell((cell, colNumber) => {
      cell.font = { size: 9.5 };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
      if (colNumber >= 6 && colNumber <= 11 && colNumber !== 10) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.numFmt = '#,##0.##';
      } else {
        cell.alignment = { vertical: 'middle' };
      }
    });
  });

  sheet.columns = [
    { width: 16 },
    { width: 28 },
    { width: 24 },
    { width: 18 },
    { width: 10 },
    { width: 12 },
    { width: 12 },
    { width: 13 },
    { width: 14 },
    { width: 15 },
    { width: 18 },
    { width: 13 },
  ];

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `Store_Items_${filenameDate}.xlsx`
  );
}

export async function exportStoreItemsPdf(rows: ItemExportRow[], filenameDate: string) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const banglaFont = await registerBanglaFontOnPdf(doc);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('RUPKATHA APPARELS LTD.', 14, 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Store Item Master & Current Stock | Date: ${filenameDate}`, 14, 20);

  autoTable(doc, {
    startY: 25,
    head: [[
      'SKU',
      'Name',
      'Bangla Name',
      'Category',
      'UOM',
      'Knit',
      'Woven',
      'Total',
      'Min Stock',
      'Default Cost',
      'Status',
    ]],
    body: rows.map(({ statusRow, item }) => [
      statusRow.sku,
      statusRow.item_name,
      statusRow.item_name_bn || item?.name_bn || '-',
      statusRow.category_name,
      statusRow.uom,
      formatNumberBD(statusRow.knit_qty, 2),
      formatNumberBD(statusRow.woven_qty, 2),
      formatNumberBD(statusRow.current_stock, 2),
      formatNumberBD(statusRow.minimum_stock, 2),
      item ? formatStoreCurrency(item.default_unit_cost, item.default_currency || 'BDT', 2) : '-',
      statusRow.status.replace('_', ' ').toUpperCase(),
    ]),
    styles: {
      font: banglaFont,
      fontSize: 8,
      cellPadding: 2,
    },
    headStyles: {
      fillColor: [15, 139, 141],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    columnStyles: {
      5: { halign: 'right' },
      6: { halign: 'right' },
      7: { halign: 'right' },
      8: { halign: 'right' },
      9: { halign: 'right' },
    },
  });

  doc.save(`Store_Items_${filenameDate}.pdf`);
}

export interface GrnExportRow {
  grn: StoreGrn;
  totalBdt: number;
  totalOriginal: number;
}

export async function exportStoreGrnExcel(rows: GrnExportRow[], filenameDate: string) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('GRN Register');

  sheet.mergeCells('A1:I1');
  sheet.getCell('A1').value = 'RUPKATHA APPARELS LTD.';
  sheet.getCell('A1').font = { bold: true, size: 14 };
  sheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };

  sheet.mergeCells('A2:I2');
  sheet.getCell('A2').value = `Goods Received Notes (GRN) Register | Generated: ${filenameDate}`;
  sheet.getCell('A2').font = { size: 10, color: { argb: 'FF475569' } };
  sheet.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };

  sheet.addRow([]);

  const headerRow = sheet.addRow([
    'GRN No',
    'Date',
    'Supplier',
    'Challan No',
    'PO Reference',
    'Unit',
    'Currency',
    'Total Value (BDT)',
    'Status',
  ]);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F8B8D' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  rows.forEach(({ grn, totalBdt }) => {
    const r = sheet.addRow([
      grn.grn_no,
      grn.grn_date,
      grn.supplier_name,
      grn.challan_no || '-',
      grn.po_reference || '-',
      grn.unit.toUpperCase(),
      grn.currency,
      totalBdt,
      grn.status.toUpperCase(),
    ]);
    r.getCell(8).numFmt = '#,##0.00';
    r.getCell(8).alignment = { horizontal: 'right' };
  });

  sheet.columns = [
    { width: 18 },
    { width: 13 },
    { width: 28 },
    { width: 16 },
    { width: 16 },
    { width: 10 },
    { width: 10 },
    { width: 18 },
    { width: 14 },
  ];

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `Store_GRN_${filenameDate}.xlsx`
  );
}

export async function exportStoreGrnPdf(rows: GrnExportRow[], filenameDate: string) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const banglaFont = await registerBanglaFontOnPdf(doc);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('RUPKATHA APPARELS LTD.', 14, 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Goods Received Notes (GRN) Register | Date: ${filenameDate}`, 14, 20);

  autoTable(doc, {
    startY: 25,
    head: [['GRN No', 'Date', 'Supplier', 'Challan', 'PO Ref', 'Unit', 'Currency', 'Total Value (BDT)', 'Status']],
    body: rows.map(({ grn, totalBdt }) => [
      grn.grn_no,
      formatStoreDate(grn.grn_date),
      grn.supplier_name,
      grn.challan_no || '-',
      grn.po_reference || '-',
      grn.unit.toUpperCase(),
      grn.currency,
      formatBDT(totalBdt, 2),
      grn.status.toUpperCase(),
    ]),
    styles: { font: banglaFont, fontSize: 8.5, cellPadding: 2.5 },
    headStyles: { fillColor: [15, 139, 141], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: { 7: { halign: 'right' } },
  });

  doc.save(`Store_GRN_${filenameDate}.pdf`);
}

export interface LedgerExportRow {
  sku: string;
  item_name: string;
  category_name: string;
  unit_label: string;
  uom: string;
  opening_stock: number;
  total_in: number;
  total_out: number;
  current_balance: number;
}

export async function exportStoreLedgerExcel(rows: LedgerExportRow[], filenameDate: string) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Stock Ledger');

  sheet.mergeCells('A1:I1');
  sheet.getCell('A1').value = 'RUPKATHA APPARELS LTD.';
  sheet.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FF0F172A' } };
  sheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };

  sheet.mergeCells('A2:I2');
  sheet.getCell('A2').value = `Live Store Stock Ledger Summary | Generated: ${filenameDate}`;
  sheet.getCell('A2').font = { size: 10, color: { argb: 'FF475569' } };
  sheet.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };

  sheet.addRow([]);

  const headerRow = sheet.addRow([
    'SKU',
    'Item Name',
    'Category',
    'Unit',
    'UOM',
    'Opening Stock',
    'Total Received (GRN In)',
    'Total Issued (Out)',
    'Current Live Balance',
  ]);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F8B8D' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    };
  });

  rows.forEach((row) => {
    const r = sheet.addRow([
      row.sku,
      row.item_name,
      row.category_name,
      row.unit_label,
      row.uom,
      Number(row.opening_stock || 0),
      Number(row.total_in || 0),
      Number(row.total_out || 0),
      Number(row.current_balance || 0),
    ]);
    r.eachCell((cell, colNumber) => {
      cell.font = { size: 9.5 };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
      if (colNumber >= 6) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.numFmt = '#,##0.##';
        if (colNumber === 9) {
          cell.font = { bold: true, size: 9.5 };
        }
      } else {
        cell.alignment = { vertical: 'middle' };
      }
    });
  });

  sheet.columns = [
    { width: 16 },
    { width: 30 },
    { width: 20 },
    { width: 15 },
    { width: 10 },
    { width: 16 },
    { width: 22 },
    { width: 18 },
    { width: 22 },
  ];

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    `Store_Stock_Ledger_${filenameDate}.xlsx`
  );
}
