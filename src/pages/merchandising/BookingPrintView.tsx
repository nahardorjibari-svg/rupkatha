import React, { useMemo } from 'react';
import { ArrowLeft, CheckCircle2, Printer, ShieldCheck } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { formatNumberBD, formatStoreDate } from '../../lib/storeFormat';
import {
  BOOKING_SENSITIVITY_META,
  type MaterialBooking,
  type MaterialBookingItem,
  type MerchOrder,
} from '../../types/merchandising';

export interface SignatoryInfo {
  name: string;
  designation?: string | null;
}

interface BookingPrintViewProps {
  booking: MaterialBooking;
  ordersMap: Map<string, MerchOrder>;
  signatoriesMap?: Map<string, SignatoryInfo>;
  onBack: () => void;
  canApprove?: boolean;
  onApprove?: (booking: MaterialBooking) => void;
  approving?: boolean;
}

function daysBetween(start?: string | null, end?: string | null): string {
  if (!start || !end) return '-';
  const d1 = new Date(start);
  const d2 = new Date(end);
  if (Number.isNaN(d1.getTime()) || Number.isNaN(d2.getTime())) return '-';
  const diff = Math.ceil((d2.getTime() - d1.getTime()) / 86400000);
  return `${diff} Days`;
}

function formatDateTimeBD(iso?: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const BookingPrintView: React.FC<BookingPrintViewProps> = ({
  booking,
  ordersMap,
  signatoriesMap,
  onBack,
  canApprove = false,
  onApprove,
  approving = false,
}) => {
  const { isDark } = useTheme();
  const items = useMemo(() => booking.material_booking_items || [], [booking]);
  const currencySymbol = booking.currency === 'BDT' ? '৳' : '$';
  const statusLower = String(booking.approval_status || booking.status || 'draft').toLowerCase();
  const isApproved = statusLower === 'approved';

  const typeLabel = useMemo(() => {
    const t = String(booking.booking_type || 'TRIMS').toUpperCase();
    if (t === 'FABRIC') return 'Fabric';
    if (t === 'SEWING_THREAD') return 'Sewing Thread';
    if (t === 'PACKING') return 'Packing';
    return 'Trims';
  }, [booking.booking_type]);

  // Group items by Job (order_id)
  const jobSections = useMemo(() => {
    const byOrder = new Map<string, MaterialBookingItem[]>();
    items.forEach((it) => {
      const key = it.order_id || 'UNASSIGNED';
      const arr = byOrder.get(key) || [];
      arr.push(it);
      byOrder.set(key, arr);
    });

    return Array.from(byOrder.entries()).map(([orderId, jobItems]) => {
      const order = ordersMap.get(orderId) || jobItems[0]?.orders || null;
      return {
        orderId,
        order,
        items: jobItems,
        jobWoTotal: jobItems.reduce((s, r) => s + Number(r.wo_qty || 0), 0),
        jobAmtTotal: jobItems.reduce((s, r) => s + Number(r.total_amount || 0), 0),
      };
    });
  }, [items, ordersMap]);

  const totalUniqueOrderQty = useMemo(() => {
    return jobSections.reduce((s, sec) => s + Number(sec.order?.order_qty || 0), 0);
  }, [jobSections]);

  const grandWoQty = useMemo(
    () => items.reduce((s, it) => s + Number(it.wo_qty || 0), 0),
    [items]
  );

  const grandAmount = useMemo(
    () => items.reduce((s, it) => s + Number(it.total_amount || 0), 0),
    [items]
  );

  // Page 8 Item Wise Total Summary grouped by (order_id + item_group + item_description + uom)
  const itemWiseSummary = useMemo(() => {
    const map = new Map<
      string,
      {
        orderNo: string;
        styleNo: string;
        styleDesc: string;
        itemDescription: string;
        itemGroup: string;
        uom: string;
        totalQty: number;
        totalAmount: number;
      }
    >();

    items.forEach((it) => {
      const order = ordersMap.get(it.order_id) || it.orders || null;
      const orderNo = order?.order_no || '-';
      const styleNo = order?.style_no || '-';
      const styleDesc = order?.item_name || '-';
      const key = `${it.order_id}__${it.item_group}__${it.item_description}__${it.uom}`;
      const prev = map.get(key);
      if (prev) {
        prev.totalQty += Number(it.wo_qty || 0);
        prev.totalAmount += Number(it.total_amount || 0);
      } else {
        map.set(key, {
          orderNo,
          styleNo,
          styleDesc,
          itemDescription: it.item_description || '-',
          itemGroup: it.item_group || '-',
          uom: it.uom || 'PCS',
          totalQty: Number(it.wo_qty || 0),
          totalAmount: Number(it.total_amount || 0),
        });
      }
    });

    return Array.from(map.values());
  }, [items, ordersMap]);

  const preparedSignatory = useMemo(() => {
    const info = booking.prepared_by ? signatoriesMap?.get(booking.prepared_by) : undefined;
    return {
      name: info?.name || booking.dealing_merchant || 'Merchandiser',
      designation: info?.designation || 'Merchandiser',
      date: formatDateTimeBD(booking.prepared_at || booking.created_at),
    };
  }, [booking, signatoriesMap]);

  const checkedSignatory = useMemo(() => {
    const info = booking.checked_by ? signatoriesMap?.get(booking.checked_by) : undefined;
    return {
      name: info?.name || (statusLower === 'submitted' || isApproved ? 'Merchandising Head' : 'Pending Check'),
      designation: info?.designation || 'Sr. Merchandiser / Dept. Head',
      date: formatDateTimeBD(booking.checked_at),
    };
  }, [booking, signatoriesMap, statusLower, isApproved]);

  const approvedSignatory = useMemo(() => {
    const info = booking.approved_by ? signatoriesMap?.get(booking.approved_by) : undefined;
    return {
      name: info?.name || (isApproved ? 'Authorized Signatory' : 'Pending Approval'),
      designation: info?.designation || 'Director / GM Operations',
      date: formatDateTimeBD(booking.approved_at),
      approvalNo: isApproved ? `APR-${booking.booking_no}` : '-',
    };
  }, [booking, signatoriesMap, isApproved]);

  return (
    <div className="space-y-4">
      {/* Toolbar (hidden when printing) */}
      <div className="print:hidden flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl border text-xs font-bold cursor-pointer ${
            isDark
              ? 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-200'
              : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
          }`}
        >
          <ArrowLeft className="w-4 h-4" />
          <div className="text-left">
            <span className="block leading-tight">Back to Booking Register</span>
            <span className="block text-[10px] font-bangla opacity-70 leading-tight">
              তালিকায় ফিরে যান
            </span>
          </div>
        </button>

        <div className="flex flex-wrap items-center gap-2.5">
          {!isApproved && canApprove && onApprove && (
            <button
              type="button"
              disabled={approving}
              onClick={() => onApprove(booking)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <div className="text-left">
                <span className="block leading-tight">Approve Booking</span>
                <span className="block text-[10px] font-bangla opacity-85 leading-tight">
                  অনুমোদন করুন
                </span>
              </div>
            </button>
          )}

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-2xl bg-[#0F8B8D] hover:bg-[#0b6f71] text-white text-xs font-bold shadow-md shadow-[#0F8B8D]/20 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <div className="text-left">
              <span className="block leading-tight">Print Booking Sheet</span>
              <span className="block text-[10px] font-bangla opacity-85 leading-tight">
                প্রিন্ট / পিডিএফ সেভ করুন
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* Multi-Page Printable Document */}
      <div className="job-card-paper max-w-[270mm] mx-auto bg-white text-slate-900 rounded-2xl border border-slate-200 shadow-lg p-6 sm:p-8 print:rounded-none print:border-none print:shadow-none print:p-0 space-y-5">
        {/* 1. Company Header */}
        <div className="border-b-2 border-slate-900 pb-3 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900 uppercase">
              Rupkatha Apparels Ltd.
            </h1>
            <p className="text-[11px] text-slate-600">
              Raj place, Rishipara, Padma mor, Hemayetpur, Savar, Dhaka, Bangladesh
            </p>
            <p className="text-sm font-extrabold text-[#0F8B8D] print:text-black mt-1">
              Multiple Job Wise {typeLabel} Booking V2
            </p>
          </div>

          <div className="text-left sm:text-right space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-slate-400 text-[11px] font-extrabold uppercase">
              {isApproved && <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 print:text-black" />}
              <span>Status: {statusLower.toUpperCase()}</span>
            </div>
            <p className="text-xs font-mono font-bold">Booking No: {booking.booking_no}</p>
            <p className="text-[10px] text-slate-500">
              Generated: {formatDateTimeBD(new Date().toISOString())}
            </p>
          </div>
        </div>

        {/* 2. Master Metadata Grid */}
        <div className="border border-slate-800 rounded-lg overflow-hidden text-[11px]">
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-300">
            <div className="p-2.5 space-y-1">
              <div className="flex justify-between gap-2">
                <span className="font-bold text-slate-600">Buyer:</span>
                <span className="font-extrabold text-right">{booking.buyers?.name || '-'}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="font-bold text-slate-600">Brand:</span>
                <span className="font-semibold text-right">{booking.buyers?.name || '-'}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="font-bold text-slate-600">Booking No:</span>
                <span className="font-mono font-bold text-right">{booking.booking_no}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="font-bold text-slate-600">Booking Type:</span>
                <span className="font-bold text-right">{booking.booking_type}</span>
              </div>
            </div>

            <div className="p-2.5 space-y-1">
              <div>
                <span className="font-bold text-slate-600 block">Supplier Name:</span>
                <span className="font-extrabold">{booking.supplier_name || '-'}</span>
              </div>
              <div>
                <span className="font-bold text-slate-600 block">Supplier Add.:</span>
                <span className="text-[10px] leading-snug block">
                  {booking.supplier_address || 'Dhaka, Bangladesh'}
                </span>
              </div>
            </div>

            <div className="p-2.5 space-y-1">
              <div className="flex justify-between gap-2">
                <span className="font-bold text-slate-600">Source:</span>
                <span className="font-semibold">{booking.source_type || 'Local'}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="font-bold text-slate-600">Pay Mode:</span>
                <span className="font-semibold">{booking.pay_mode || 'Credit'}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="font-bold text-slate-600">Currency:</span>
                <span className="font-bold">
                  {booking.currency} (Exch: {Number(booking.exchange_rate || 122)})
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="font-bold text-slate-600">Dealing Merchant:</span>
                <span className="font-bold text-right">{booking.dealing_merchant || '-'}</span>
              </div>
            </div>

            <div className="p-2.5 space-y-1">
              <div className="flex justify-between gap-2">
                <span className="font-bold text-slate-600">Booking Date:</span>
                <span className="font-semibold">{formatStoreDate(booking.booking_date)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="font-bold text-slate-600">Delivery Date:</span>
                <span className="font-semibold">{formatStoreDate(booking.delivery_date)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="font-bold text-slate-600">Shipment Date:</span>
                <span className="font-semibold">{formatStoreDate(booking.shipment_date)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="font-bold text-slate-600">Ship Days in Hand:</span>
                <span className="font-bold">
                  {daysBetween(booking.booking_date, booking.shipment_date)}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="font-bold text-slate-600">Delivery To:</span>
                <span className="font-semibold text-right">
                  {booking.delivery_to || 'Rupkatha Apparels Ltd. Store'}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="font-bold text-slate-600">Ex-factory Status:</span>
                <span className="font-semibold">Pending</span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Job Sections (1 per selected Order/PO) */}
        <div className="space-y-6">
          {jobSections.map((jobSec, jobIdx) => {
            const ord = jobSec.order;
            return (
              <div key={jobSec.orderId} className="space-y-2.5">
                {/* Job Header Banner */}
                <div className="bg-slate-100 print:bg-slate-100 border border-slate-800 px-3 py-2 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-[10px]">
                  <div>
                    <span className="text-slate-500 font-bold block">Job NO #{jobIdx + 1}</span>
                    <span className="font-extrabold font-mono">{ord?.order_no || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-bold block">Fabric Booking No</span>
                    <span className="font-mono font-bold">
                      {ord?.order_no ? `FB-${ord.order_no}` : '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-bold block">Style Ref</span>
                    <span className="font-bold">{ord?.style_no || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-bold block">PO No</span>
                    <span className="font-mono font-bold">{ord?.po_no || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-bold block">PO Qty</span>
                    <span className="font-extrabold tabular-nums">
                      {formatNumberBD(ord?.order_qty || 0)} PCS
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-bold block">Delivery Date</span>
                    <span className="font-semibold">
                      {formatStoreDate(ord?.target_ship_date || booking.delivery_date)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-bold block">Style Desc</span>
                    <span className="font-semibold truncate block">{ord?.item_name || '-'}</span>
                  </div>
                </div>

                {/* Grouped by 5 Sensitivity Headers */}
                {BOOKING_SENSITIVITY_META.map((sensMeta) => {
                  const sensRows = jobSec.items.filter(
                    (r) => String(r.sensitivity || 'NONE').toUpperCase() === sensMeta.key
                  );
                  if (sensRows.length === 0) return null;

                  // Group within sensitivity by item_description so we can show "Item Total" rows
                  const itemGroupTotals = new Map<
                    string,
                    { rows: MaterialBookingItem[]; woTotal: number; amtTotal: number; orderTotal: number }
                  >();
                  sensRows.forEach((r) => {
                    const gKey = `${r.item_group}__${r.item_description}`;
                    const entry = itemGroupTotals.get(gKey) || {
                      rows: [],
                      woTotal: 0,
                      amtTotal: 0,
                      orderTotal: 0,
                    };
                    entry.rows.push(r);
                    entry.woTotal += Number(r.wo_qty || 0);
                    entry.amtTotal += Number(r.total_amount || 0);
                    entry.orderTotal += Number(r.order_qty || 0);
                    itemGroupTotals.set(gKey, entry);
                  });

                  const sensWoTotal = sensRows.reduce((s, r) => s + Number(r.wo_qty || 0), 0);
                  const sensAmtTotal = sensRows.reduce((s, r) => s + Number(r.total_amount || 0), 0);

                  return (
                    <div key={sensMeta.key} className="space-y-1">
                      <div className="bg-teal-50 print:bg-slate-100 border border-slate-400 px-2.5 py-1 text-[11px] font-extrabold text-slate-900 flex items-center justify-between">
                        <span>{sensMeta.pdfHeader}</span>
                        <span className="text-[10px] font-bold text-slate-600">
                          {sensRows.length} rows · WO Qty: {formatNumberBD(sensWoTotal, 2)} ·{' '}
                          {currencySymbol}
                          {formatNumberBD(sensAmtTotal, 2)}
                        </span>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse border border-slate-400 text-[10px]">
                          <thead>
                            <tr className="bg-slate-100 text-slate-800">
                              <th className="border border-slate-400 px-1.5 py-1 text-center">SL</th>
                              <th className="border border-slate-400 px-1.5 py-1 text-left">Item Group</th>
                              <th className="border border-slate-400 px-1.5 py-1 text-left">Item Description</th>
                              <th className="border border-slate-400 px-1.5 py-1 text-left">Gmts Color</th>
                              <th className="border border-slate-400 px-1.5 py-1 text-left">Item Color</th>
                              <th className="border border-slate-400 px-1.5 py-1 text-center">Gmts Size</th>
                              <th className="border border-slate-400 px-1.5 py-1 text-center">Item Size</th>
                              <th className="border border-slate-400 px-1.5 py-1 text-right">Order Qty</th>
                              <th className="border border-slate-400 px-1.5 py-1 text-right">Cons.</th>
                              <th className="border border-slate-400 px-1.5 py-1 text-right">Wast%</th>
                              <th className="border border-slate-400 px-1.5 py-1 text-right">WO Qty</th>
                              <th className="border border-slate-400 px-1.5 py-1 text-center">UOM</th>
                              <th className="border border-slate-400 px-1.5 py-1 text-right">Cone Len</th>
                              <th className="border border-slate-400 px-1.5 py-1 text-right">Cost/Dzn($)</th>
                              <th className="border border-slate-400 px-1.5 py-1 text-right">Rate</th>
                              <th className="border border-slate-400 px-1.5 py-1 text-right">Amount</th>
                              <th className="border border-slate-400 px-1.5 py-1 text-left">Remarks</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Array.from(itemGroupTotals.entries()).map(([gKey, group]) => (
                              <React.Fragment key={gKey}>
                                {group.rows.map((row, idx) => (
                                  <tr key={row.id || `${gKey}-${idx}`}>
                                    <td className="border border-slate-300 px-1.5 py-1 text-center">
                                      {idx + 1}
                                    </td>
                                    <td className="border border-slate-300 px-1.5 py-1 font-semibold">
                                      {row.item_group}
                                    </td>
                                    <td className="border border-slate-300 px-1.5 py-1">
                                      {row.item_description}
                                    </td>
                                    <td className="border border-slate-300 px-1.5 py-1">
                                      {row.gmts_color || '-'}
                                    </td>
                                    <td className="border border-slate-300 px-1.5 py-1">
                                      {row.item_color || '-'}
                                    </td>
                                    <td className="border border-slate-300 px-1.5 py-1 text-center">
                                      {row.gmts_size || '-'}
                                    </td>
                                    <td className="border border-slate-300 px-1.5 py-1 text-center">
                                      {row.item_size || '-'}
                                    </td>
                                    <td className="border border-slate-300 px-1.5 py-1 text-right tabular-nums">
                                      {formatNumberBD(row.order_qty)}
                                    </td>
                                    <td className="border border-slate-300 px-1.5 py-1 text-right tabular-nums">
                                      {Number(row.consumption || 0).toFixed(3)}
                                    </td>
                                    <td className="border border-slate-300 px-1.5 py-1 text-right tabular-nums">
                                      {Number(row.wastage_percent || 0).toFixed(1)}%
                                    </td>
                                    <td className="border border-slate-300 px-1.5 py-1 text-right font-bold tabular-nums">
                                      {formatNumberBD(row.wo_qty, 2)}
                                    </td>
                                    <td className="border border-slate-300 px-1.5 py-1 text-center">
                                      {row.uom}
                                    </td>
                                    <td className="border border-slate-300 px-1.5 py-1 text-right tabular-nums">
                                      {row.cone_length ? formatNumberBD(row.cone_length) : '-'}
                                    </td>
                                    <td className="border border-slate-300 px-1.5 py-1 text-right tabular-nums">
                                      {Number(row.cost_per_dzn || 0).toFixed(3)}
                                    </td>
                                    <td className="border border-slate-300 px-1.5 py-1 text-right tabular-nums">
                                      {currencySymbol}
                                      {Number(row.unit_rate || 0).toFixed(4)}
                                    </td>
                                    <td className="border border-slate-300 px-1.5 py-1 text-right font-bold tabular-nums">
                                      {currencySymbol}
                                      {formatNumberBD(row.total_amount, 2)}
                                    </td>
                                    <td className="border border-slate-300 px-1.5 py-1">
                                      {row.remarks || ''}
                                    </td>
                                  </tr>
                                ))}
                                {/* Item Total Row */}
                                <tr className="bg-slate-50 font-bold">
                                  <td
                                    colSpan={7}
                                    className="border border-slate-400 px-2 py-1 text-right uppercase text-[9px]"
                                  >
                                    Item Total ({group.rows[0]?.item_description}):
                                  </td>
                                  <td className="border border-slate-400 px-1.5 py-1 text-right tabular-nums">
                                    {formatNumberBD(group.orderTotal)}
                                  </td>
                                  <td colSpan={2} className="border border-slate-400 px-1.5 py-1" />
                                  <td className="border border-slate-400 px-1.5 py-1 text-right tabular-nums">
                                    {formatNumberBD(group.woTotal, 2)}
                                  </td>
                                  <td className="border border-slate-400 px-1.5 py-1 text-center">
                                    {group.rows[0]?.uom}
                                  </td>
                                  <td colSpan={3} className="border border-slate-400 px-1.5 py-1" />
                                  <td className="border border-slate-400 px-1.5 py-1 text-right tabular-nums">
                                    {currencySymbol}
                                    {formatNumberBD(group.amtTotal, 2)}
                                  </td>
                                  <td className="border border-slate-400 px-1.5 py-1" />
                                </tr>
                              </React.Fragment>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* 4. Total Order Qty Banner */}
        <div className="border-2 border-slate-900 bg-slate-100 px-4 py-2.5 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs font-extrabold">
          <span>Total Jobs / POs Included: {jobSections.length}</span>
          <span>Total Order Qty: {formatNumberBD(totalUniqueOrderQty)} PCS</span>
          <span>Total WO Qty: {formatNumberBD(grandWoQty, 2)}</span>
          <span>
            Grand Total Amount: {currencySymbol}
            {formatNumberBD(grandAmount, 2)}
          </span>
        </div>

        {/* 5. Page 8: Item Wise Total Summary */}
        <div className="space-y-2 pt-2 print:break-before-page">
          <div className="border-b border-slate-800 pb-1 flex items-center justify-between">
            <h2 className="text-sm font-extrabold uppercase tracking-wide">
              Item Wise Total Summary
            </h2>
            <span className="text-[10px] font-bold text-slate-600">
              Booking # {booking.booking_no}
            </span>
          </div>

          <table className="w-full border-collapse border border-slate-400 text-[10px]">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-400 px-2 py-1.5 text-center">SL</th>
                <th className="border border-slate-400 px-2 py-1.5 text-left">Job No</th>
                <th className="border border-slate-400 px-2 py-1.5 text-left">Style Ref/No</th>
                <th className="border border-slate-400 px-2 py-1.5 text-left">Style Description</th>
                <th className="border border-slate-400 px-2 py-1.5 text-left">Item Description</th>
                <th className="border border-slate-400 px-2 py-1.5 text-left">Item Group</th>
                <th className="border border-slate-400 px-2 py-1.5 text-center">UOM</th>
                <th className="border border-slate-400 px-2 py-1.5 text-right">Total Qty</th>
                <th className="border border-slate-400 px-2 py-1.5 text-right">Total Amount</th>
              </tr>
            </thead>
            <tbody>
              {itemWiseSummary.map((row, idx) => (
                <tr key={idx}>
                  <td className="border border-slate-300 px-2 py-1 text-center">{idx + 1}</td>
                  <td className="border border-slate-300 px-2 py-1 font-mono font-bold">
                    {row.orderNo}
                  </td>
                  <td className="border border-slate-300 px-2 py-1 font-semibold">{row.styleNo}</td>
                  <td className="border border-slate-300 px-2 py-1">{row.styleDesc}</td>
                  <td className="border border-slate-300 px-2 py-1 font-semibold">
                    {row.itemDescription}
                  </td>
                  <td className="border border-slate-300 px-2 py-1">{row.itemGroup}</td>
                  <td className="border border-slate-300 px-2 py-1 text-center">{row.uom}</td>
                  <td className="border border-slate-300 px-2 py-1 text-right font-bold tabular-nums">
                    {formatNumberBD(row.totalQty, 2)}
                  </td>
                  <td className="border border-slate-300 px-2 py-1 text-right font-bold tabular-nums">
                    {currencySymbol}
                    {formatNumberBD(row.totalAmount, 2)}
                  </td>
                </tr>
              ))}
              <tr className="bg-slate-100 font-extrabold">
                <td colSpan={7} className="border border-slate-400 px-2 py-1.5 text-right uppercase">
                  Grand Total:
                </td>
                <td className="border border-slate-400 px-2 py-1.5 text-right tabular-nums">
                  {formatNumberBD(grandWoQty, 2)}
                </td>
                <td className="border border-slate-400 px-2 py-1.5 text-right tabular-nums">
                  {currencySymbol}
                  {formatNumberBD(grandAmount, 2)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Remarks */}
        {booking.remarks && (
          <div className="border border-slate-300 rounded-lg p-2.5 text-[11px]">
            <span className="font-bold uppercase text-slate-600 mr-2">Remarks / Instructions:</span>
            <span>{booking.remarks}</span>
          </div>
        )}

        {/* 6. Approval Signature Blocks */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-10 text-center text-[11px]">
          <div className="border-t border-slate-800 pt-2 space-y-0.5">
            <p className="font-extrabold uppercase">Prepared By</p>
            <p className="font-bold text-slate-800">{preparedSignatory.name}</p>
            <p className="text-[10px] text-slate-600">{preparedSignatory.designation}</p>
            <p className="text-[10px] text-slate-500">Date: {preparedSignatory.date}</p>
          </div>

          <div className="border-t border-slate-800 pt-2 space-y-0.5">
            <p className="font-extrabold uppercase">Checked By</p>
            <p className="font-bold text-slate-800">{checkedSignatory.name}</p>
            <p className="text-[10px] text-slate-600">{checkedSignatory.designation}</p>
            <p className="text-[10px] text-slate-500">Date: {checkedSignatory.date}</p>
          </div>

          <div className="border-t border-slate-800 pt-2 space-y-0.5">
            <p className="font-extrabold uppercase">Approved By</p>
            <p className="font-bold text-slate-800">{approvedSignatory.name}</p>
            <p className="text-[10px] text-slate-600">{approvedSignatory.designation}</p>
            <p className="text-[10px] text-slate-500">Date: {approvedSignatory.date}</p>
            <p className="text-[10px] font-mono font-bold text-slate-700">
              Approval No: {approvedSignatory.approvalNo}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookingPrintView;
