/**
 * Export Shipment Logistics, Commercial Invoicing, Payment Realization & Order Closing Hub
 * Rupkatha Apparels Ltd. ERP (src/pages/commercial/ShipmentInvoicePage.tsx)
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Truck,
  FileText,
  DollarSign,
  CheckCircle2,
  Plus,
  Search,
  RefreshCw,
  Edit3,
  Trash2,
  X,
  Loader2,
  AlertTriangle,
  Calendar,
  BadgeDollarSign,
  FileSpreadsheet,
  Package,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '../../lib/supabaseClient';
import { formatNumberBD, formatStoreDate } from '../../lib/storeFormat';

type ActiveTab = 'shipments' | 'invoices' | 'realization';

interface OrderRef {
  id: string;
  order_no: string;
  po_no?: string | null;
  style_no: string;
  item_name?: string;
  order_qty: number;
  fob_price?: number;
  status: string;
  buyers?: { name: string; code: string } | null;
}

interface ShipmentRecord {
  id: string;
  order_id: string;
  invoice_no: string;
  ship_date: string;
  shipped_qty: number;
  carton_qty: number;
  destination: string;
  forwarder?: string | null;
  container_no?: string | null;
  gross_weight?: number | null;
  net_weight?: number | null;
  cbm?: number | null;
  bl_awb?: string | null;
  etd?: string | null;
  eta?: string | null;
  status: string;
  remarks?: string | null;
  created_at?: string;
  orders?: OrderRef | null;
}

interface BuyerInvoiceRecord {
  id: string;
  shipment_id?: string | null;
  order_id: string;
  invoice_no: string;
  invoice_date: string;
  buyer_name: string;
  invoiced_qty: number;
  fob_rate: number;
  invoice_amount: number;
  due_date: string;
  payment_status: 'Unpaid' | 'Partial' | 'Realized';
  received_amount: number;
  bank_charges: number;
  short_realization: number;
  net_realized: number;
  is_order_closed: boolean;
  remarks?: string | null;
  created_at?: string;
  orders?: OrderRef | null;
  order_shipments?: ShipmentRecord | null;
}

function getTodayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export const ShipmentInvoicePage: React.FC = () => {
  const { isDark } = useTheme();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('shipments');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [shipments, setShipments] = useState<ShipmentRecord[]>([]);
  const [invoices, setInvoices] = useState<BuyerInvoiceRecord[]>([]);
  const [orders, setOrders] = useState<OrderRef[]>([]);

  // Modals
  const [shipmentModalOpen, setShipmentModalOpen] = useState(false);
  const [editingShipment, setEditingShipment] = useState<ShipmentRecord | null>(null);

  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [selectedShipmentForInvoice, setSelectedShipmentForInvoice] = useState<ShipmentRecord | null>(null);

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<BuyerInvoiceRecord | null>(null);

  // Shipment Form State
  const [shipOrderId, setShipOrderId] = useState('');
  const [shipRefNo, setShipRefNo] = useState('');
  const [shipDate, setShipDate] = useState(getTodayIso());
  const [shipQty, setShipQty] = useState('');
  const [shipCartons, setShipCartons] = useState('');
  const [shipDestination, setShipDestination] = useState('');
  const [shipForwarder, setShipForwarder] = useState('');
  const [shipContainer, setShipContainer] = useState('');
  const [shipGrossWt, setShipGrossWt] = useState('');
  const [shipNetWt, setShipNetWt] = useState('');
  const [shipCbm, setShipCbm] = useState('');
  const [shipBlAwb, setShipBlAwb] = useState('');
  const [shipEtd, setShipEtd] = useState('');
  const [shipEta, setShipEta] = useState('');
  const [shipStatus, setShipStatus] = useState('Shipped');
  const [shipRemarks, setShipRemarks] = useState('');

  // Invoice Form State
  const [invNo, setInvNo] = useState('');
  const [invDate, setInvDate] = useState(getTodayIso());
  const [invDueDate, setInvDueDate] = useState(getTodayIso());
  const [invFobRate, setInvFobRate] = useState('');
  const [invRemarks, setInvRemarks] = useState('');

  // Payment Realization Form State
  const [payReceived, setPayReceived] = useState('');
  const [payBankCharges, setPayBankCharges] = useState('0');
  const [payShortReal, setPayShortReal] = useState('0');
  const [payRemarks, setPayRemarks] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [shipRes, invRes, ordRes] = await Promise.all([
        supabase
          .from('order_shipments')
          .select('*, orders(id, order_no, po_no, style_no, order_qty, fob_price, status, buyers(name, code))')
          .order('ship_date', { ascending: false }),
        supabase
          .from('buyer_invoices')
          .select('*, orders(id, order_no, po_no, style_no, order_qty, fob_price, status, buyers(name, code)), order_shipments(id, invoice_no, ship_date, shipped_qty)')
          .order('invoice_date', { ascending: false }),
        supabase
          .from('orders')
          .select('id, order_no, po_no, style_no, order_qty, fob_price, status, buyers(name, code)')
          .order('order_no', { ascending: false }),
      ]);

      if (shipRes.error) {
        console.warn('order_shipments query notice:', shipRes.error.message);
      }
      if (invRes.error) {
        console.warn('buyer_invoices query notice:', invRes.error.message);
      }
      if (ordRes.error) throw ordRes.error;

      setShipments((shipRes.data || []) as unknown as ShipmentRecord[]);
      setInvoices((invRes.data || []) as unknown as BuyerInvoiceRecord[]);
      setOrders((ordRes.data || []) as unknown as OrderRef[]);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load shipments and invoices data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const orderMap = useMemo(() => {
    const map = new Map<string, OrderRef>();
    orders.forEach((o) => map.set(o.id, o));
    return map;
  }, [orders]);

  // KPI Calculations
  const kpiTotals = useMemo(() => {
    const totalShippedQty = shipments.reduce((acc, s) => acc + Number(s.shipped_qty || 0), 0);
    const totalInvoicedSales = invoices.reduce((acc, i) => acc + Number(i.invoice_amount || 0), 0);
    const totalRealized = invoices.reduce((acc, i) => acc + Number(i.net_realized || 0), 0);
    const outstandingReceivables = Math.max(0, totalInvoicedSales - totalRealized);
    return {
      totalShippedQty,
      totalInvoicedSales,
      totalRealized,
      outstandingReceivables,
    };
  }, [shipments, invoices]);

  const openNewShipmentModal = () => {
    setEditingShipment(null);
    setShipOrderId(orders[0]?.id || '');
    setShipRefNo(`EXP-SHP-${Math.floor(1000 + Math.random() * 9000)}`);
    setShipDate(getTodayIso());
    setShipQty('');
    setShipCartons('');
    setShipDestination('USA / Europe');
    setShipForwarder('Expeditors BD Ltd.');
    setShipContainer('');
    setShipGrossWt('');
    setShipNetWt('');
    setShipCbm('');
    setShipBlAwb('');
    setShipEtd(getTodayIso());
    setShipEta(getTodayIso());
    setShipStatus('Shipped');
    setShipRemarks('');
    setShipmentModalOpen(true);
  };

  const openEditShipmentModal = (rec: ShipmentRecord) => {
    setEditingShipment(rec);
    setShipOrderId(rec.order_id);
    setShipRefNo(rec.invoice_no);
    setShipDate(rec.ship_date || getTodayIso());
    setShipQty(String(rec.shipped_qty));
    setShipCartons(String(rec.carton_qty || ''));
    setShipDestination(rec.destination || '');
    setShipForwarder(rec.forwarder || '');
    setShipContainer(rec.container_no || '');
    setShipGrossWt(rec.gross_weight ? String(rec.gross_weight) : '');
    setShipNetWt(rec.net_weight ? String(rec.net_weight) : '');
    setShipCbm(rec.cbm ? String(rec.cbm) : '');
    setShipBlAwb(rec.bl_awb || '');
    setShipEtd(rec.etd || getTodayIso());
    setShipEta(rec.eta || getTodayIso());
    setShipStatus(rec.status || 'Shipped');
    setShipRemarks(rec.remarks || '');
    setShipmentModalOpen(true);
  };

  const handleSaveShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shipOrderId || !shipRefNo.trim() || !shipQty) {
      toast.error('Please fill in Order, Reference No, and Shipped Quantity.');
      return;
    }

    const qtyNum = Number(shipQty);
    const ord = orderMap.get(shipOrderId);
    if (ord && !editingShipment && qtyNum > ord.order_qty) {
      toast.error(`Shipped qty (${qtyNum}) cannot exceed order quantity (${ord.order_qty}).`);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        order_id: shipOrderId,
        invoice_no: shipRefNo.trim(),
        ship_date: shipDate,
        shipped_qty: qtyNum,
        carton_qty: Number(shipCartons) || 0,
        destination: shipDestination.trim(),
        forwarder: shipForwarder.trim() || null,
        container_no: shipContainer.trim() || null,
        gross_weight: shipGrossWt ? Number(shipGrossWt) : null,
        net_weight: shipNetWt ? Number(shipNetWt) : null,
        cbm: shipCbm ? Number(shipCbm) : null,
        bl_awb: shipBlAwb.trim() || null,
        etd: shipEtd || null,
        eta: shipEta || null,
        status: shipStatus,
        remarks: shipRemarks.trim() || null,
      };

      if (editingShipment) {
        const { error } = await supabase
          .from('order_shipments')
          .update(payload)
          .eq('id', editingShipment.id);
        if (error) throw error;
        toast.success(`Shipment ${shipRefNo} updated successfully!`);
      } else {
        const { error } = await supabase.from('order_shipments').insert([payload]);
        if (error) throw error;
        toast.success(`Export shipment recorded successfully!`);
      }

      setShipmentModalOpen(false);
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save export shipment.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteShipment = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this shipment record?')) return;
    try {
      const { error } = await supabase.from('order_shipments').delete().eq('id', id);
      if (error) throw error;
      toast.success('Shipment record deleted.');
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete shipment.');
    }
  };

  const openGenerateInvoiceModal = (ship: ShipmentRecord) => {
    setSelectedShipmentForInvoice(ship);
    const ord = ship.orders || orderMap.get(ship.order_id);
    setInvNo(`INV-${ship.invoice_no}`);
    setInvDate(getTodayIso());
    setInvDueDate(getTodayIso());
    setInvFobRate(String(ord?.fob_price || 5.50));
    setInvRemarks('');
    setInvoiceModalOpen(true);
  };

  const handleGenerateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShipmentForInvoice) return;

    const ship = selectedShipmentForInvoice;
    const ord = ship.orders || orderMap.get(ship.order_id);
    const rateNum = Number(invFobRate);
    const qtyNum = Number(ship.shipped_qty);
    const invAmount = Number((qtyNum * rateNum).toFixed(2));
    const buyerName = ord?.buyers?.name || 'International Buyer';

    setSaving(true);
    try {
      const payload = {
        shipment_id: ship.id,
        order_id: ship.order_id,
        invoice_no: invNo.trim(),
        invoice_date: invDate,
        buyer_name: buyerName,
        invoiced_qty: qtyNum,
        fob_rate: rateNum,
        invoice_amount: invAmount,
        due_date: invDueDate,
        payment_status: 'Unpaid',
        received_amount: 0,
        bank_charges: 0,
        short_realization: 0,
        net_realized: 0,
        is_order_closed: false,
        remarks: invRemarks.trim() || null,
      };

      const { error } = await supabase.from('buyer_invoices').insert([payload]);
      if (error) throw error;

      toast.success(`Commercial Invoice ${invNo} generated ($${invAmount.toLocaleString()})!`);
      setInvoiceModalOpen(false);
      setActiveTab('invoices');
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to generate commercial invoice.');
    } finally {
      setSaving(false);
    }
  };

  const openPaymentModal = (inv: BuyerInvoiceRecord) => {
    setSelectedInvoiceForPayment(inv);
    setPayReceived(String(inv.invoice_amount - inv.net_realized));
    setPayBankCharges(String(inv.bank_charges || 0));
    setPayShortReal(String(inv.short_realization || 0));
    setPayRemarks(inv.remarks || '');
    setPaymentModalOpen(true);
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoiceForPayment) return;

    const inv = selectedInvoiceForPayment;
    const recNum = Number(payReceived) || 0;
    const bankNum = Number(payBankCharges) || 0;
    const shortNum = Number(payShortReal) || 0;
    const totalRealized = Number((recNum + bankNum + shortNum).toFixed(2));
    const netRealized = Number((inv.net_realized + recNum).toFixed(2));

    let status: 'Unpaid' | 'Partial' | 'Realized' = 'Partial';
    if (netRealized >= inv.invoice_amount || netRealized + 1 >= inv.invoice_amount) {
      status = 'Realized';
    } else if (netRealized <= 0) {
      status = 'Unpaid';
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('buyer_invoices')
        .update({
          received_amount: Number((inv.received_amount + recNum).toFixed(2)),
          bank_charges: bankNum,
          short_realization: shortNum,
          net_realized: netRealized,
          payment_status: status,
          remarks: payRemarks.trim() || null,
        })
        .eq('id', inv.id);

      if (error) throw error;

      toast.success(`Payment realization recorded ($${recNum.toLocaleString()})!`);
      setPaymentModalOpen(false);
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to record buyer payment.');
    } finally {
      setSaving(false);
    }
  };

  const handleCloseOrder = async (inv: BuyerInvoiceRecord) => {
    if (!window.confirm(`Mark Order & Invoice ${inv.invoice_no} as Fully Closed and Completed?`)) return;

    setSaving(true);
    try {
      // Update buyer_invoices is_order_closed = true, payment_status = Realized
      const { error: invErr } = await supabase
        .from('buyer_invoices')
        .update({ is_order_closed: true, payment_status: 'Realized' })
        .eq('id', inv.id);
      if (invErr) throw invErr;

      // Update orders status = 'completed'
      if (inv.order_id) {
        const { error: ordErr } = await supabase
          .from('orders')
          .update({ status: 'completed' })
          .eq('id', inv.order_id);
        if (ordErr) throw ordErr;
      }

      toast.success('Order closed and archived successfully!');
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to close order.');
    } finally {
      setSaving(false);
    }
  };

  // Filtered lists
  const filteredShipments = useMemo(() => {
    return shipments.filter((s) => {
      const ord = s.orders || orderMap.get(s.order_id);
      const matchSearch =
        s.invoice_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.destination.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (ord?.order_no || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (ord?.style_no || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = statusFilter === 'ALL' || s.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [shipments, orderMap, searchTerm, statusFilter]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((i) => {
      const ord = i.orders || orderMap.get(i.order_id);
      const matchSearch =
        i.invoice_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
        i.buyer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (ord?.order_no || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (ord?.style_no || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = statusFilter === 'ALL' || i.payment_status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [invoices, orderMap, searchTerm, statusFilter]);

  return (
    <AdminLayout>
      <div className={`space-y-6 pb-12 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
        {/* Header Banner */}
        <div
          className={`p-6 rounded-3xl border shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 backdrop-blur-md ${
            isDark
              ? 'bg-gradient-to-r from-[#103A40] via-[#0D3136] to-[#0B2E33] border-white/10 text-white shadow-black/30'
              : 'bg-gradient-to-r from-[#0F8B8D]/15 via-teal-50 to-white border-slate-200/80 text-slate-900 shadow-slate-200/50'
          }`}
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#0F8B8D] text-white flex items-center justify-center shadow-lg shadow-[#0F8B8D]/30 shrink-0">
              <Truck className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-extrabold tracking-tight">
                  Export Shipments & Commercial Invoices
                </h1>
                <span className="text-[11px] font-bold font-bangla px-2.5 py-1 rounded-full bg-[#2BA5B5]/20 text-[#2BA5B5] border border-[#2BA5B5]/30">
                  শিপমেন্ট ও ইনভয়েস
                </span>
              </div>
              <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                Manage packing lists, Bill of Lading, commercial invoices, payment realization, and order closing.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={loadData}
              className={`p-2.5 rounded-2xl border transition-all cursor-pointer ${
                isDark ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-white border-slate-300 hover:bg-slate-100'
              }`}
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={openNewShipmentModal}
              className="px-4 py-2.5 rounded-2xl bg-[#0F8B8D] hover:bg-[#2BA5B5] text-white text-xs font-bold shadow-lg shadow-[#0F8B8D]/30 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Shipment Entry</span>
            </button>
          </div>
        </div>

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div
            className={`p-5 rounded-2xl border shadow-md flex items-center justify-between ${
              isDark ? 'bg-[#103A40]/80 border-white/10' : 'bg-white border-slate-200'
            }`}
          >
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Shipped Qty</span>
              <p className="text-2xl font-black text-[#2BA5B5]">{formatNumberBD(kpiTotals.totalShippedQty)} pcs</p>
              <span className="text-[10px] font-bangla opacity-80">মোট প্রেরিত পরিমাণ</span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-[#2BA5B5]/15 text-[#2BA5B5] flex items-center justify-center">
              <Truck className="w-6 h-6" />
            </div>
          </div>

          <div
            className={`p-5 rounded-2xl border shadow-md flex items-center justify-between ${
              isDark ? 'bg-[#103A40]/80 border-white/10' : 'bg-white border-slate-200'
            }`}
          >
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Invoiced Sales</span>
              <p className="text-2xl font-black text-emerald-500">${kpiTotals.totalInvoicedSales.toLocaleString()}</p>
              <span className="text-[10px] font-bangla opacity-80">মোট ইনভয়েস মূল্য (USD)</span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
              <BadgeDollarSign className="w-6 h-6" />
            </div>
          </div>

          <div
            className={`p-5 rounded-2xl border shadow-md flex items-center justify-between ${
              isDark ? 'bg-[#103A40]/80 border-white/10' : 'bg-white border-slate-200'
            }`}
          >
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Payment Realized</span>
              <p className="text-2xl font-black text-sky-400">
                ${invoices.reduce((a, b) => a + Number(b.net_realized || 0), 0).toLocaleString()}
              </p>
              <span className="text-[10px] font-bangla opacity-80">অর্জিত পেমেন্ট</span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-sky-500/15 text-sky-400 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </div>

          <div
            className={`p-5 rounded-2xl border shadow-md flex items-center justify-between ${
              isDark ? 'bg-[#103A40]/80 border-white/10' : 'bg-white border-slate-200'
            }`}
          >
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Outstanding Receivables</span>
              <p className="text-2xl font-black text-amber-400">${kpiTotals.outstandingReceivables.toLocaleString()}</p>
              <span className="text-[10px] font-bangla opacity-80">বকেয়া পাওনা</span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-400 flex items-center justify-center">
              <DollarSign className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Tab Navigation & Search Filter */}
        <div
          className={`p-4 rounded-2xl border flex flex-col md:flex-row items-center justify-between gap-4 ${
            isDark ? 'bg-[#103A40]/60 border-white/10' : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto">
            <button
              type="button"
              onClick={() => setActiveTab('shipments')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
                activeTab === 'shipments'
                  ? 'bg-[#0F8B8D] text-white shadow-md shadow-[#0F8B8D]/30'
                  : isDark
                  ? 'bg-white/5 text-slate-300 hover:bg-white/10'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Truck className="w-4 h-4" />
              <span>Export Shipments (শিপমেন্ট ও প্যাকিং লিস্ট)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('invoices')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
                activeTab === 'invoices'
                  ? 'bg-[#0F8B8D] text-white shadow-md shadow-[#0F8B8D]/30'
                  : isDark
                  ? 'bg-white/5 text-slate-300 hover:bg-white/10'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Commercial Invoices (কমার্শিয়াল ইনভয়েস)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('realization')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
                activeTab === 'realization'
                  ? 'bg-[#0F8B8D] text-white shadow-md shadow-[#0F8B8D]/30'
                  : isDark
                  ? 'bg-white/5 text-slate-300 hover:bg-white/10'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <DollarSign className="w-4 h-4" />
              <span>Payment Realization & Closing (রিয়ালাইজেশন ও ক্লোজিং)</span>
            </button>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search invoice, buyer, style..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full pl-9 pr-3 py-2 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-[#2BA5B5] ${
                  isDark ? 'bg-[#0B2E33] border-white/15 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              />
            </div>
          </div>
        </div>

        {/* Tab 1: Export Shipments */}
        {activeTab === 'shipments' && (
          <div className={`rounded-3xl border shadow-xl overflow-hidden ${isDark ? 'bg-[#103A40]/80 border-white/10' : 'bg-white border-slate-200'}`}>
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h2 className="text-sm font-extrabold uppercase tracking-wider flex items-center gap-2">
                <Truck className="w-4 h-4 text-[#2BA5B5]" />
                <span>Export Shipment Register ({filteredShipments.length})</span>
              </h2>
            </div>

            <div className="overflow-x-auto">
              {loading ? (
                <div className="py-16 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-[#2BA5B5]" />
                </div>
              ) : filteredShipments.length === 0 ? (
                <div className="py-16 text-center text-slate-400 text-xs font-semibold">
                  No export shipments recorded yet. Click "New Shipment Entry" to start.
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className={`border-b ${isDark ? 'border-white/10 text-slate-300 bg-white/5' : 'border-slate-200 text-slate-700 bg-slate-50'}`}>
                      <th className="py-3 px-4 font-bold">Ref / Invoice #</th>
                      <th className="py-3 px-4 font-bold">Date</th>
                      <th className="py-3 px-4 font-bold">Order / PO #</th>
                      <th className="py-3 px-4 font-bold">Style</th>
                      <th className="py-3 px-4 font-bold text-right">Shipped Qty</th>
                      <th className="py-3 px-4 font-bold text-center">Cartons</th>
                      <th className="py-3 px-4 font-bold">Forwarder</th>
                      <th className="py-3 px-4 font-bold">Container / BL</th>
                      <th className="py-3 px-4 font-bold">Destination</th>
                      <th className="py-3 px-4 font-bold text-center">Status</th>
                      <th className="py-3 px-4 font-bold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredShipments.map((s) => {
                      const ord = s.orders || orderMap.get(s.order_id);
                      return (
                        <tr key={s.id} className={`transition-colors ${isDark ? 'hover:bg-white/5' : 'hover:bg-slate-50'}`}>
                          <td className="py-3 px-4 font-bold text-[#2BA5B5]">{s.invoice_no}</td>
                          <td className="py-3 px-4">{formatStoreDate(s.ship_date)}</td>
                          <td className="py-3 px-4 font-semibold">
                            {ord?.order_no || '—'}
                            {ord?.po_no ? <span className="block text-[10px] opacity-75 font-normal">PO: {ord.po_no}</span> : null}
                          </td>
                          <td className="py-3 px-4 font-medium">{ord?.style_no || '—'}</td>
                          <td className="py-3 px-4 text-right font-extrabold">{formatNumberBD(s.shipped_qty)} pcs</td>
                          <td className="py-3 px-4 text-center font-medium">{s.carton_qty || 0} ctn</td>
                          <td className="py-3 px-4 font-medium">{s.forwarder || '—'}</td>
                          <td className="py-3 px-4">
                            <span className="font-mono text-[11px]">{s.container_no || '—'}</span>
                            {s.bl_awb ? <span className="block text-[10px] text-slate-400 font-mono">BL: {s.bl_awb}</span> : null}
                          </td>
                          <td className="py-3 px-4">{s.destination || '—'}</td>
                          <td className="py-3 px-4 text-center">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                              s.status === 'Delivered'
                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                : 'bg-sky-500/15 text-sky-400 border-sky-500/30'
                            }`}>
                              {s.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right space-x-2">
                            <button
                              type="button"
                              onClick={() => openGenerateInvoiceModal(s)}
                              className="px-2.5 py-1 rounded-xl bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30 font-bold text-[11px] cursor-pointer"
                              title="Generate Commercial Invoice"
                            >
                              Invoice
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditShipmentModal(s)}
                              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 cursor-pointer"
                              title="Edit Shipment"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteShipment(s.id)}
                              className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 cursor-pointer"
                              title="Delete Shipment"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Commercial Invoices */}
        {activeTab === 'invoices' && (
          <div className={`rounded-3xl border shadow-xl overflow-hidden ${isDark ? 'bg-[#103A40]/80 border-white/10' : 'bg-white border-slate-200'}`}>
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h2 className="text-sm font-extrabold uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#2BA5B5]" />
                <span>Commercial Invoice Register ({filteredInvoices.length})</span>
              </h2>
            </div>

            <div className="overflow-x-auto">
              {loading ? (
                <div className="py-16 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-[#2BA5B5]" />
                </div>
              ) : filteredInvoices.length === 0 ? (
                <div className="py-16 text-center text-slate-400 text-xs font-semibold">
                  No commercial invoices generated yet. Click "Invoice" on any Export Shipment to generate.
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className={`border-b ${isDark ? 'border-white/10 text-slate-300 bg-white/5' : 'border-slate-200 text-slate-700 bg-slate-50'}`}>
                      <th className="py-3 px-4 font-bold">Invoice #</th>
                      <th className="py-3 px-4 font-bold">Date</th>
                      <th className="py-3 px-4 font-bold">Buyer</th>
                      <th className="py-3 px-4 font-bold">Order / PO #</th>
                      <th className="py-3 px-4 font-bold text-right">Invoiced Qty</th>
                      <th className="py-3 px-4 font-bold text-right">FOB Rate</th>
                      <th className="py-3 px-4 font-bold text-right">Invoice Amount ($)</th>
                      <th className="py-3 px-4 font-bold">Due Date</th>
                      <th className="py-3 px-4 font-bold text-center">Status</th>
                      <th className="py-3 px-4 font-bold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredInvoices.map((inv) => {
                      const ord = inv.orders || orderMap.get(inv.order_id);
                      return (
                        <tr key={inv.id} className={`transition-colors ${isDark ? 'hover:bg-white/5' : 'hover:bg-slate-50'}`}>
                          <td className="py-3 px-4 font-bold text-emerald-400">{inv.invoice_no}</td>
                          <td className="py-3 px-4">{formatStoreDate(inv.invoice_date)}</td>
                          <td className="py-3 px-4 font-semibold">{inv.buyer_name}</td>
                          <td className="py-3 px-4 font-medium">
                            {ord?.order_no || '—'}
                            {ord?.po_no ? <span className="block text-[10px] opacity-75 font-normal">PO: {ord.po_no}</span> : null}
                          </td>
                          <td className="py-3 px-4 text-right font-bold">{formatNumberBD(inv.invoiced_qty)} pcs</td>
                          <td className="py-3 px-4 text-right">${Number(inv.fob_rate || 0).toFixed(2)}</td>
                          <td className="py-3 px-4 text-right font-black text-emerald-400">${Number(inv.invoice_amount || 0).toLocaleString()}</td>
                          <td className="py-3 px-4">{formatStoreDate(inv.due_date)}</td>
                          <td className="py-3 px-4 text-center">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                              inv.payment_status === 'Realized'
                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                : inv.payment_status === 'Partial'
                                ? 'bg-sky-500/15 text-sky-400 border-sky-500/30'
                                : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                            }`}>
                              {inv.payment_status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right space-x-2">
                            <button
                              type="button"
                              onClick={() => openPaymentModal(inv)}
                              className="px-2.5 py-1 rounded-xl bg-sky-500/15 text-sky-400 hover:bg-sky-500/25 border border-sky-500/30 font-bold text-[11px] cursor-pointer"
                            >
                              Realize
                            </button>
                            {!inv.is_order_closed && (
                              <button
                                type="button"
                                onClick={() => handleCloseOrder(inv)}
                                className="px-2.5 py-1 rounded-xl bg-purple-500/15 text-purple-400 hover:bg-purple-500/25 border border-purple-500/30 font-bold text-[11px] cursor-pointer"
                                title="Close & Complete Order"
                              >
                                Close Order
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Payment Realization & Order Closing */}
        {activeTab === 'realization' && (
          <div className={`rounded-3xl border shadow-xl overflow-hidden ${isDark ? 'bg-[#103A40]/80 border-white/10' : 'bg-white border-slate-200'}`}>
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h2 className="text-sm font-extrabold uppercase tracking-wider flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-[#2BA5B5]" />
                <span>Payment Realization & Order Closure ({invoices.length})</span>
              </h2>
            </div>

            <div className="overflow-x-auto">
              {loading ? (
                <div className="py-16 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-[#2BA5B5]" />
                </div>
              ) : invoices.length === 0 ? (
                <div className="py-16 text-center text-slate-400 text-xs font-semibold">
                  No invoices available for payment realization.
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className={`border-b ${isDark ? 'border-white/10 text-slate-300 bg-white/5' : 'border-slate-200 text-slate-700 bg-slate-50'}`}>
                      <th className="py-3 px-4 font-bold">Invoice #</th>
                      <th className="py-3 px-4 font-bold">Buyer</th>
                      <th className="py-3 px-4 font-bold text-right">Invoice Value ($)</th>
                      <th className="py-3 px-4 font-bold text-right">Received ($)</th>
                      <th className="py-3 px-4 font-bold text-right">Bank Charges ($)</th>
                      <th className="py-3 px-4 font-bold text-right">Short Real. ($)</th>
                      <th className="py-3 px-4 font-bold text-right">Net Realized ($)</th>
                      <th className="py-3 px-4 font-bold text-center">Order Status</th>
                      <th className="py-3 px-4 font-bold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {invoices.map((inv) => {
                      const ord = inv.orders || orderMap.get(inv.order_id);
                      return (
                        <tr key={inv.id} className={`transition-colors ${isDark ? 'hover:bg-white/5' : 'hover:bg-slate-50'}`}>
                          <td className="py-3 px-4 font-bold text-[#2BA5B5]">{inv.invoice_no}</td>
                          <td className="py-3 px-4 font-semibold">{inv.buyer_name}</td>
                          <td className="py-3 px-4 text-right font-bold">${Number(inv.invoice_amount || 0).toLocaleString()}</td>
                          <td className="py-3 px-4 text-right text-emerald-400 font-bold">${Number(inv.received_amount || 0).toLocaleString()}</td>
                          <td className="py-3 px-4 text-right text-amber-400">${Number(inv.bank_charges || 0).toLocaleString()}</td>
                          <td className="py-3 px-4 text-right text-rose-400">${Number(inv.short_realization || 0).toLocaleString()}</td>
                          <td className="py-3 px-4 text-right font-black text-emerald-400">${Number(inv.net_realized || 0).toLocaleString()}</td>
                          <td className="py-3 px-4 text-center">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                              inv.is_order_closed || ord?.status === 'completed'
                                ? 'bg-purple-500/15 text-purple-400 border-purple-500/30'
                                : 'bg-sky-500/15 text-sky-400 border-sky-500/30'
                            }`}>
                              {inv.is_order_closed || ord?.status === 'completed' ? 'Completed & Closed' : 'In Progress'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right space-x-2">
                            <button
                              type="button"
                              onClick={() => openPaymentModal(inv)}
                              className="px-3 py-1 rounded-xl bg-[#0F8B8D] hover:bg-[#2BA5B5] text-white font-bold text-[11px] cursor-pointer shadow-sm"
                            >
                              Record Payment
                            </button>
                            {!inv.is_order_closed && (
                              <button
                                type="button"
                                onClick={() => handleCloseOrder(inv)}
                                className="px-3 py-1 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-[11px] cursor-pointer shadow-sm"
                              >
                                Close Order
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Modal 1: New / Edit Shipment Modal */}
        {shipmentModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
            <div
              className={`w-full max-w-2xl rounded-3xl border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 ${
                isDark ? 'bg-[#0B2E33] border-white/15 text-white' : 'bg-white border-slate-200 text-slate-900'
              }`}
            >
              <div className={`px-6 py-4 border-b flex items-center justify-between ${isDark ? 'bg-[#103A40] border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                <h3 className="text-base font-extrabold flex items-center gap-2">
                  <Truck className="w-5 h-5 text-[#2BA5B5]" />
                  <span>{editingShipment ? 'Edit Export Shipment' : 'New Export Shipment Entry'}</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setShipmentModalOpen(false)}
                  className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveShipment} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold mb-1 opacity-90">Select Buyer Order *</label>
                    <select
                      value={shipOrderId}
                      onChange={(e) => setShipOrderId(e.target.value)}
                      required
                      className={`w-full px-3 py-2 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-[#2BA5B5] ${
                        isDark ? 'bg-[#103A40] border-white/15 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    >
                      <option value="">-- Choose Buyer Order --</option>
                      {orders.map((ord) => (
                        <option key={ord.id} value={ord.id}>
                          Order #{ord.order_no} {ord.po_no ? `(PO: ${ord.po_no})` : ''} — Style: {ord.style_no} ({ord.order_qty} pcs)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold mb-1 opacity-90">Invoice / Packing Ref # *</label>
                    <input
                      type="text"
                      value={shipRefNo}
                      onChange={(e) => setShipRefNo(e.target.value)}
                      required
                      placeholder="e.g. EXP-SHP-2026-01"
                      className={`w-full px-3 py-2 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-[#2BA5B5] ${
                        isDark ? 'bg-[#103A40] border-white/15 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold mb-1 opacity-90">Shipment Date *</label>
                    <input
                      type="date"
                      value={shipDate}
                      onChange={(e) => setShipDate(e.target.value)}
                      required
                      className={`w-full px-3 py-2 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-[#2BA5B5] ${
                        isDark ? 'bg-[#103A40] border-white/15 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold mb-1 opacity-90">Shipped Quantity (Pcs) *</label>
                    <input
                      type="number"
                      value={shipQty}
                      onChange={(e) => setShipQty(e.target.value)}
                      required
                      min="1"
                      placeholder="e.g. 5000"
                      className={`w-full px-3 py-2 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-[#2BA5B5] ${
                        isDark ? 'bg-[#103A40] border-white/15 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold mb-1 opacity-90">Carton Quantity (Ctn)</label>
                    <input
                      type="number"
                      value={shipCartons}
                      onChange={(e) => setShipCartons(e.target.value)}
                      placeholder="e.g. 250"
                      className={`w-full px-3 py-2 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-[#2BA5B5] ${
                        isDark ? 'bg-[#103A40] border-white/15 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold mb-1 opacity-90">Destination Port / Country</label>
                    <input
                      type="text"
                      value={shipDestination}
                      onChange={(e) => setShipDestination(e.target.value)}
                      placeholder="e.g. New York, USA / Hamburg, Germany"
                      className={`w-full px-3 py-2 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-[#2BA5B5] ${
                        isDark ? 'bg-[#103A40] border-white/15 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold mb-1 opacity-90">Freight Forwarder</label>
                    <input
                      type="text"
                      value={shipForwarder}
                      onChange={(e) => setShipForwarder(e.target.value)}
                      placeholder="e.g. Expeditors / Kuehne+Nagel"
                      className={`w-full px-3 py-2 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-[#2BA5B5] ${
                        isDark ? 'bg-[#103A40] border-white/15 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold mb-1 opacity-90">Container #</label>
                    <input
                      type="text"
                      value={shipContainer}
                      onChange={(e) => setShipContainer(e.target.value)}
                      placeholder="e.g. TCLU-9823714"
                      className={`w-full px-3 py-2 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-[#2BA5B5] ${
                        isDark ? 'bg-[#103A40] border-white/15 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold mb-1 opacity-90">Gross Weight (KG)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={shipGrossWt}
                      onChange={(e) => setShipGrossWt(e.target.value)}
                      placeholder="e.g. 1420.50"
                      className={`w-full px-3 py-2 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-[#2BA5B5] ${
                        isDark ? 'bg-[#103A40] border-white/15 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold mb-1 opacity-90">Net Weight (KG)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={shipNetWt}
                      onChange={(e) => setShipNetWt(e.target.value)}
                      placeholder="e.g. 1280.00"
                      className={`w-full px-3 py-2 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-[#2BA5B5] ${
                        isDark ? 'bg-[#103A40] border-white/15 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold mb-1 opacity-90">CBM (Cubic Meters)</label>
                    <input
                      type="number"
                      step="0.001"
                      value={shipCbm}
                      onChange={(e) => setShipCbm(e.target.value)}
                      placeholder="e.g. 24.50"
                      className={`w-full px-3 py-2 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-[#2BA5B5] ${
                        isDark ? 'bg-[#103A40] border-white/15 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold mb-1 opacity-90">B/L or AWB Number</label>
                    <input
                      type="text"
                      value={shipBlAwb}
                      onChange={(e) => setShipBlAwb(e.target.value)}
                      placeholder="e.g. BL-DAC-NY-8921"
                      className={`w-full px-3 py-2 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-[#2BA5B5] ${
                        isDark ? 'bg-[#103A40] border-white/15 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold mb-1 opacity-90">ETD (Estimated Time of Departure)</label>
                    <input
                      type="date"
                      value={shipEtd}
                      onChange={(e) => setShipEtd(e.target.value)}
                      className={`w-full px-3 py-2 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-[#2BA5B5] ${
                        isDark ? 'bg-[#103A40] border-white/15 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold mb-1 opacity-90">ETA (Estimated Time of Arrival)</label>
                    <input
                      type="date"
                      value={shipEta}
                      onChange={(e) => setShipEta(e.target.value)}
                      className={`w-full px-3 py-2 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-[#2BA5B5] ${
                        isDark ? 'bg-[#103A40] border-white/15 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1 opacity-90">Shipment Status</label>
                  <select
                    value={shipStatus}
                    onChange={(e) => setShipStatus(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-[#2BA5B5] ${
                      isDark ? 'bg-[#103A40] border-white/15 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value="Shipped">Shipped</option>
                    <option value="In Transit">In Transit</option>
                    <option value="Delivered">Delivered</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1 opacity-90">Remarks / Special Instructions</label>
                  <textarea
                    rows={2}
                    value={shipRemarks}
                    onChange={(e) => setShipRemarks(e.target.value)}
                    placeholder="Enter notes about container sealing, inspection certificates..."
                    className={`w-full px-3 py-2 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-[#2BA5B5] ${
                      isDark ? 'bg-[#103A40] border-white/15 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                <div className={`px-6 py-4 border-t flex justify-end gap-2.5 ${isDark ? 'bg-[#103A40] border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                  <button
                    type="button"
                    onClick={() => setShipmentModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-300 dark:border-white/15 text-xs font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2 rounded-xl bg-[#0F8B8D] hover:bg-[#2BA5B5] text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-2"
                  >
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>{editingShipment ? 'Update Shipment' : 'Save Shipment'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal 2: Generate Commercial Invoice Modal */}
        {invoiceModalOpen && selectedShipmentForInvoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
            <div
              className={`w-full max-w-lg rounded-3xl border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 ${
                isDark ? 'bg-[#0B2E33] border-white/15 text-white' : 'bg-white border-slate-200 text-slate-900'
              }`}
            >
              <div className={`px-6 py-4 border-b flex items-center justify-between ${isDark ? 'bg-[#103A40] border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                <h3 className="text-base font-extrabold flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#2BA5B5]" />
                  <span>Generate Commercial Invoice</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setInvoiceModalOpen(false)}
                  className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleGenerateInvoice} className="p-6 space-y-4">
                <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1 text-xs">
                  <p><span className="opacity-70">Shipment Ref:</span> <strong className="text-[#2BA5B5]">{selectedShipmentForInvoice.invoice_no}</strong></p>
                  <p><span className="opacity-70">Shipped Qty:</span> <strong>{formatNumberBD(selectedShipmentForInvoice.shipped_qty)} pcs</strong></p>
                  <p><span className="opacity-70">Destination:</span> <strong>{selectedShipmentForInvoice.destination || '—'}</strong></p>
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1 opacity-90">Commercial Invoice # *</label>
                  <input
                    type="text"
                    value={invNo}
                    onChange={(e) => setInvNo(e.target.value)}
                    required
                    className={`w-full px-3 py-2 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-[#2BA5B5] ${
                      isDark ? 'bg-[#103A40] border-white/15 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold mb-1 opacity-90">Invoice Date *</label>
                    <input
                      type="date"
                      value={invDate}
                      onChange={(e) => setInvDate(e.target.value)}
                      required
                      className={`w-full px-3 py-2 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-[#2BA5B5] ${
                        isDark ? 'bg-[#103A40] border-white/15 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1 opacity-90">Payment Due Date *</label>
                    <input
                      type="date"
                      value={invDueDate}
                      onChange={(e) => setInvDueDate(e.target.value)}
                      required
                      className={`w-full px-3 py-2 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-[#2BA5B5] ${
                        isDark ? 'bg-[#103A40] border-white/15 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1 opacity-90">FOB Unit Rate ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={invFobRate}
                    onChange={(e) => setInvFobRate(e.target.value)}
                    required
                    className={`w-full px-3 py-2 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-[#2BA5B5] ${
                      isDark ? 'bg-[#103A40] border-white/15 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                  <p className="text-[11px] text-emerald-400 mt-1 font-bold">
                    Calculated Invoice Amount: ${(Number(selectedShipmentForInvoice.shipped_qty) * Number(invFobRate || 0)).toLocaleString()} USD
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1 opacity-90">Remarks</label>
                  <textarea
                    rows={2}
                    value={invRemarks}
                    onChange={(e) => setInvRemarks(e.target.value)}
                    placeholder="Bank negotiation instructions..."
                    className={`w-full px-3 py-2 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-[#2BA5B5] ${
                      isDark ? 'bg-[#103A40] border-white/15 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                <div className={`px-6 py-4 border-t flex justify-end gap-2.5 ${isDark ? 'bg-[#103A40] border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                  <button
                    type="button"
                    onClick={() => setInvoiceModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-300 dark:border-white/15 text-xs font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-2"
                  >
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>Confirm & Generate Invoice</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal 3: Record Buyer Payment Realization Modal */}
        {paymentModalOpen && selectedInvoiceForPayment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
            <div
              className={`w-full max-w-lg rounded-3xl border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 ${
                isDark ? 'bg-[#0B2E33] border-white/15 text-white' : 'bg-white border-slate-200 text-slate-900'
              }`}
            >
              <div className={`px-6 py-4 border-b flex items-center justify-between ${isDark ? 'bg-[#103A40] border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                <h3 className="text-base font-extrabold flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-400" />
                  <span>Record Buyer Payment Realization</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setPaymentModalOpen(false)}
                  className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSavePayment} className="p-6 space-y-4">
                <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1 text-xs">
                  <p><span className="opacity-70">Invoice No:</span> <strong className="text-emerald-400">{selectedInvoiceForPayment.invoice_no}</strong></p>
                  <p><span className="opacity-70">Total Invoice Value:</span> <strong>${selectedInvoiceForPayment.invoice_amount.toLocaleString()} USD</strong></p>
                  <p><span className="opacity-70">Already Realized:</span> <strong className="text-sky-400">${selectedInvoiceForPayment.net_realized.toLocaleString()} USD</strong></p>
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1 opacity-90">Payment Received Amount ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={payReceived}
                    onChange={(e) => setPayReceived(e.target.value)}
                    required
                    className={`w-full px-3 py-2 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-[#2BA5B5] ${
                      isDark ? 'bg-[#103A40] border-white/15 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold mb-1 opacity-90">Bank Charges Deducted ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={payBankCharges}
                      onChange={(e) => setPayBankCharges(e.target.value)}
                      className={`w-full px-3 py-2 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-[#2BA5B5] ${
                        isDark ? 'bg-[#103A40] border-white/15 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1 opacity-90">Short Realization ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={payShortReal}
                      onChange={(e) => setPayShortReal(e.target.value)}
                      className={`w-full px-3 py-2 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-[#2BA5B5] ${
                        isDark ? 'bg-[#103A40] border-white/15 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1 opacity-90">Remarks</label>
                  <textarea
                    rows={2}
                    value={payRemarks}
                    onChange={(e) => setPayRemarks(e.target.value)}
                    placeholder="TT / LC negotiation reference..."
                    className={`w-full px-3 py-2 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-[#2BA5B5] ${
                      isDark ? 'bg-[#103A40] border-white/15 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                <div className={`px-6 py-4 border-t flex justify-end gap-2.5 ${isDark ? 'bg-[#103A40] border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                  <button
                    type="button"
                    onClick={() => setPaymentModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-300 dark:border-white/15 text-xs font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-2"
                  >
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>Save Payment Realization</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default ShipmentInvoicePage;
