import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BadgeDollarSign,
  FileSpreadsheet,
  Landmark,
  ArrowRightLeft,
  Plus,
  Search,
  RefreshCw,
  CheckCircle2,
  Edit3,
  Trash2,
  X,
  Loader2,
  AlertTriangle,
  DollarSign,
  Calendar,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '../../lib/supabaseClient';
import { formatNumberBD, formatStoreDate } from '../../lib/storeFormat';
import type {
  Buyer,
  CommercialLc,
  MaterialBooking,
  MerchCurrency,
  SupplierPi,
} from '../../types/merchandising';

type ActiveTab = 'pis' | 'master_lc' | 'btb_lc';

function getTodayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export const CommercialPage: React.FC = () => {
  const { isDark } = useTheme();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [activeTab, setActiveTab] = useState<ActiveTab>('pis');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [pis, setPis] = useState<SupplierPi[]>([]);
  const [lcs, setLcs] = useState<CommercialLc[]>([]);
  const [bookings, setBookings] = useState<MaterialBooking[]>([]);
  const [buyers, setBuyers] = useState<Buyer[]>([]);

  // Modal States
  const [piModalOpen, setPiModalOpen] = useState(false);
  const [editingPiId, setEditingPiId] = useState<string | null>(null);

  const [masterModalOpen, setMasterModalOpen] = useState(false);
  const [editingMasterId, setEditingMasterId] = useState<string | null>(null);

  const [btbModalOpen, setBtbModalOpen] = useState(false);
  const [editingBtbId, setEditingBtbId] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<{
    kind: 'pi' | 'lc';
    id: string;
    label: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // PI Form
  const [piNo, setPiNo] = useState('');
  const [piDate, setPiDate] = useState(getTodayIso());
  const [piBookingId, setPiBookingId] = useState('');
  const [piSupplierName, setPiSupplierName] = useState('');
  const [piCurrency, setPiCurrency] = useState<MerchCurrency>('USD');
  const [piValue, setPiValue] = useState('');
  const [piStatus, setPiStatus] = useState<'Received' | 'Approved'>('Received');
  const [piRemarks, setPiRemarks] = useState('');

  // Master LC Form
  const [mLcNumber, setMLcNumber] = useState('');
  const [mBuyerId, setMBuyerId] = useState('');
  const [mLcDate, setMLcDate] = useState(getTodayIso());
  const [mLcValue, setMLcValue] = useState('');
  const [mIssuingBank, setMIssuingBank] = useState('');
  const [mExpiryDate, setMExpiryDate] = useState('');
  const [mShipmentDate, setMShipmentDate] = useState('');
  const [mStatus, setMStatus] = useState<'Active' | 'Closed' | 'Expired'>('Active');

  // BTB LC Form
  const [bLcNumber, setBLcNumber] = useState('');
  const [bMasterLcId, setBMasterLcId] = useState('');
  const [bPiId, setBPiId] = useState('');
  const [bSupplierName, setBSupplierName] = useState('');
  const [bIssuingBank, setBIssuingBank] = useState('');
  const [bLcDate, setBLcDate] = useState(getTodayIso());
  const [bCurrency, setBCurrency] = useState<MerchCurrency>('USD');
  const [bLcValue, setBLcValue] = useState('');
  const [bMaturityDate, setBMaturityDate] = useState('');
  const [bBankCharges, setBBankCharges] = useState('0');
  const [bStatus, setBStatus] = useState<'Pending' | 'Accepted' | 'Paid'>('Pending');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [piRes, lcRes, bookRes, buyerRes] = await Promise.all([
        supabase
          .from('supplier_pis')
          .select('*, material_bookings(*)')
          .order('created_at', { ascending: false }),
        supabase
          .from('commercial_lcs')
          .select('*, buyers(*)')
          .order('created_at', { ascending: false }),
        supabase
          .from('material_bookings')
          .select('*, material_booking_items(*)')
          .order('created_at', { ascending: false }),
        supabase.from('buyers').select('*').eq('is_active', true).order('name'),
      ]);

      if (piRes.error) throw piRes.error;
      if (lcRes.error) throw lcRes.error;
      if (bookRes.error) throw bookRes.error;
      if (buyerRes.error) throw buyerRes.error;

      setPis((piRes.data || []) as SupplierPi[]);
      setLcs((lcRes.data || []) as CommercialLc[]);
      setBookings((bookRes.data || []) as MaterialBooking[]);
      setBuyers((buyerRes.data || []) as Buyer[]);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load commercial & LC data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Derived collections
  const masterLcs = useMemo(
    () => lcs.filter((l) => String(l.lc_type || '').toUpperCase() === 'MASTER_LC'),
    [lcs]
  );

  const btbLcs = useMemo(
    () => lcs.filter((l) => String(l.lc_type || '').toUpperCase() === 'BTB_LC'),
    [lcs]
  );

  const bookingsMap = useMemo(() => {
    const map = new Map<string, MaterialBooking>();
    bookings.forEach((b) => map.set(b.id, b));
    return map;
  }, [bookings]);

  const pisMap = useMemo(() => {
    const map = new Map<string, SupplierPi>();
    pis.forEach((p) => map.set(p.id, p));
    return map;
  }, [pis]);

  const masterLcMap = useMemo(() => {
    const map = new Map<string, CommercialLc>();
    masterLcs.forEach((m) => map.set(m.id, m));
    return map;
  }, [masterLcs]);

  // BTB Utilized per Master LC
  const utilizedByMasterId = useMemo(() => {
    const map = new Map<string, number>();
    btbLcs.forEach((btb) => {
      if (!btb.master_lc_id) return;
      const valUsd = btb.currency === 'BDT' ? Number(btb.lc_value || 0) / 122 : Number(btb.lc_value || 0);
      map.set(btb.master_lc_id, (map.get(btb.master_lc_id) || 0) + valUsd);
    });
    return map;
  }, [btbLcs]);

  // KPI Metrics
  const kpis = useMemo(() => {
    const totalMasterValue = masterLcs.reduce((s, l) => s + Number(l.lc_value || 0), 0);
    const totalBtbOpened = btbLcs.reduce((s, l) => {
      const valUsd = l.currency === 'BDT' ? Number(l.lc_value || 0) / 122 : Number(l.lc_value || 0);
      return s + valUsd;
    }, 0);
    const utilizationPct = totalMasterValue > 0 ? (totalBtbOpened / totalMasterValue) * 100 : 0;
    const activePisCount = pis.length;
    const activePisUsd = pis.reduce((s, p) => {
      const v = p.currency === 'BDT' ? Number(p.pi_value || 0) / 122 : Number(p.pi_value || 0);
      return s + v;
    }, 0);

    return {
      totalMasterValue,
      totalBtbOpened,
      utilizationPct,
      activePisCount,
      activePisUsd,
    };
  }, [masterLcs, btbLcs, pis]);

  const approvedBookings = useMemo(() => {
    const approved = bookings.filter(
      (b) => String(b.approval_status || b.status || '').toLowerCase() === 'approved'
    );
    return approved.length > 0 ? approved : bookings;
  }, [bookings]);

  const approvedPis = useMemo(() => {
    const approved = pis.filter((p) => String(p.status || '').toLowerCase() === 'approved');
    return approved.length > 0 ? approved : pis;
  }, [pis]);

  // Tab-Filtered Lists
  const filteredPis = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return pis.filter((p) => {
      if (statusFilter !== 'ALL' && p.status.toLowerCase() !== statusFilter.toLowerCase()) {
        return false;
      }
      if (!q) return true;
      const bkNo = (p.material_bookings?.booking_no || bookingsMap.get(p.booking_id || '')?.booking_no || '').toLowerCase();
      return (
        (p.pi_no || '').toLowerCase().includes(q) ||
        (p.supplier_name || '').toLowerCase().includes(q) ||
        bkNo.includes(q)
      );
    });
  }, [pis, searchTerm, statusFilter, bookingsMap]);

  const filteredMasterLcs = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return masterLcs.filter((l) => {
      if (statusFilter !== 'ALL' && l.status.toLowerCase() !== statusFilter.toLowerCase()) {
        return false;
      }
      if (!q) return true;
      return (
        (l.lc_number || '').toLowerCase().includes(q) ||
        (l.buyers?.name || '').toLowerCase().includes(q) ||
        (l.issuing_bank || '').toLowerCase().includes(q)
      );
    });
  }, [masterLcs, searchTerm, statusFilter]);

  const filteredBtbLcs = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return btbLcs.filter((l) => {
      if (statusFilter !== 'ALL' && l.status.toLowerCase() !== statusFilter.toLowerCase()) {
        return false;
      }
      if (!q) return true;
      const mLc = l.master_lc_id ? masterLcMap.get(l.master_lc_id)?.lc_number || '' : '';
      const piRef = l.pi_id ? pisMap.get(l.pi_id)?.pi_no || '' : '';
      return (
        (l.lc_number || '').toLowerCase().includes(q) ||
        (l.supplier_name || '').toLowerCase().includes(q) ||
        mLc.toLowerCase().includes(q) ||
        piRef.toLowerCase().includes(q)
      );
    });
  }, [btbLcs, searchTerm, statusFilter, masterLcMap, pisMap]);

  // Modal Launchers
  const openNewPiModal = () => {
    setEditingPiId(null);
    setPiNo('');
    setPiDate(getTodayIso());
    setPiBookingId('');
    setPiSupplierName('');
    setPiCurrency('USD');
    setPiValue('');
    setPiStatus('Received');
    setPiRemarks('');
    setPiModalOpen(true);
  };

  const openEditPiModal = (p: SupplierPi) => {
    setEditingPiId(p.id);
    setPiNo(p.pi_no);
    setPiDate(p.pi_date ? p.pi_date.slice(0, 10) : getTodayIso());
    setPiBookingId(p.booking_id || '');
    setPiSupplierName(p.supplier_name || '');
    setPiCurrency((p.currency as MerchCurrency) || 'USD');
    setPiValue(String(Number(p.pi_value || 0)));
    setPiStatus(String(p.status).toLowerCase() === 'approved' ? 'Approved' : 'Received');
    setPiRemarks(p.remarks || '');
    setPiModalOpen(true);
  };

  const handleSelectBookingForPi = (bkId: string) => {
    setPiBookingId(bkId);
    const bk = bookingsMap.get(bkId);
    if (!bk) return;
    setPiSupplierName(bk.supplier_name || '');
    setPiCurrency((bk.currency as MerchCurrency) || 'USD');
    const totalAmt = (bk.material_booking_items || []).reduce(
      (s, it) => s + Number(it.total_amount || 0),
      0
    );
    if (totalAmt > 0) setPiValue(totalAmt.toFixed(2));
  };

  const openNewMasterModal = () => {
    setEditingMasterId(null);
    setMLcNumber('');
    setMBuyerId(buyers[0]?.id || '');
    setMLcDate(getTodayIso());
    setMLcValue('');
    setMIssuingBank('');
    setMExpiryDate('');
    setMShipmentDate('');
    setMStatus('Active');
    setMasterModalOpen(true);
  };

  const openEditMasterModal = (lc: CommercialLc) => {
    setEditingMasterId(lc.id);
    setMLcNumber(lc.lc_number);
    setMBuyerId(lc.buyer_id || '');
    setMLcDate(lc.lc_date ? lc.lc_date.slice(0, 10) : getTodayIso());
    setMLcValue(String(Number(lc.lc_value || 0)));
    setMIssuingBank(lc.issuing_bank || '');
    setMExpiryDate(lc.expiry_date ? lc.expiry_date.slice(0, 10) : '');
    setMShipmentDate(lc.maturity_date ? lc.maturity_date.slice(0, 10) : '');
    const st = String(lc.status || 'Active');
    setMStatus(st === 'Closed' ? 'Closed' : st === 'Expired' ? 'Expired' : 'Active');
    setMasterModalOpen(true);
  };

  const openNewBtbModal = (preselectMasterId?: string) => {
    setEditingBtbId(null);
    setBLcNumber('');
    setBMasterLcId(preselectMasterId || masterLcs[0]?.id || '');
    setBPiId('');
    setBSupplierName('');
    setBIssuingBank('');
    setBLcDate(getTodayIso());
    setBCurrency('USD');
    setBLcValue('');
    setBMaturityDate('');
    setBBankCharges('0');
    setBStatus('Pending');
    setBtbModalOpen(true);
  };

  const openEditBtbModal = (lc: CommercialLc) => {
    setEditingBtbId(lc.id);
    setBLcNumber(lc.lc_number);
    setBMasterLcId(lc.master_lc_id || '');
    setBPiId(lc.pi_id || '');
    setBSupplierName(lc.supplier_name || '');
    setBIssuingBank(lc.issuing_bank || '');
    setBLcDate(lc.lc_date ? lc.lc_date.slice(0, 10) : getTodayIso());
    setBCurrency((lc.currency as MerchCurrency) || 'USD');
    setBLcValue(String(Number(lc.lc_value || 0)));
    setBMaturityDate(lc.maturity_date ? lc.maturity_date.slice(0, 10) : '');
    setBBankCharges(String(Number(lc.bank_charges || 0)));
    const st = String(lc.status || 'Pending');
    setBStatus(st === 'Paid' ? 'Paid' : st === 'Accepted' ? 'Accepted' : 'Pending');
    setBtbModalOpen(true);
  };

  const handleSelectPiForBtb = (id: string) => {
    setBPiId(id);
    const pi = pisMap.get(id);
    if (!pi) return;
    setBSupplierName(pi.supplier_name || '');
    setBCurrency((pi.currency as MerchCurrency) || 'USD');
    setBLcValue(String(Number(pi.pi_value || 0)));
  };

  // Save Handlers
  const handleSavePi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!piNo.trim() || !piSupplierName.trim()) {
      toast.error('PI Number and Supplier Name are required.');
      return;
    }
    const val = Number(piValue || 0);
    if (!Number.isFinite(val) || val <= 0) {
      toast.error('PI Value must be greater than 0.');
      return;
    }

    setSaving(true);
    try {
      const bk = piBookingId ? bookingsMap.get(piBookingId) : undefined;
      const firstOrderId = bk?.material_booking_items?.[0]?.order_id || null;

      const payload = {
        pi_no: piNo.trim(),
        pi_date: piDate || getTodayIso(),
        supplier_name: piSupplierName.trim(),
        booking_id: piBookingId || null,
        order_id: firstOrderId,
        currency: piCurrency,
        pi_value: Number(val.toFixed(2)),
        status: piStatus,
        remarks: piRemarks.trim() || null,
      };

      if (editingPiId) {
        const { error } = await supabase.from('supplier_pis').update(payload).eq('id', editingPiId);
        if (error) throw error;
        toast.success(`Supplier PI ${piNo} updated!`);
      } else {
        const { error } = await supabase.from('supplier_pis').insert(payload);
        if (error) throw error;
        toast.success(`Supplier PI ${piNo} recorded!`);
      }

      setPiModalOpen(false);
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save Supplier PI.');
    } finally {
      setSaving(false);
    }
  };

  const handleQuickApprovePi = async (pi: SupplierPi) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('supplier_pis')
        .update({ status: 'Approved' })
        .eq('id', pi.id);
      if (error) throw error;
      toast.success(`PI ${pi.pi_no} approved!`);
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to approve PI.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveMasterLc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mLcNumber.trim() || !mBuyerId) {
      toast.error('Master LC # and Buyer are required.');
      return;
    }
    const val = Number(mLcValue || 0);
    if (!Number.isFinite(val) || val <= 0) {
      toast.error('Master LC Value must be greater than 0.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        lc_number: mLcNumber.trim(),
        lc_type: 'MASTER_LC',
        lc_date: mLcDate || getTodayIso(),
        buyer_id: mBuyerId,
        master_lc_id: null,
        pi_id: null,
        supplier_name: null,
        issuing_bank: mIssuingBank.trim() || null,
        currency: 'USD',
        lc_value: Number(val.toFixed(2)),
        expiry_date: mExpiryDate || null,
        maturity_date: mShipmentDate || null,
        bank_charges: 0,
        status: mStatus,
      };

      if (editingMasterId) {
        const { error } = await supabase
          .from('commercial_lcs')
          .update(payload)
          .eq('id', editingMasterId);
        if (error) throw error;
        toast.success(`Master LC ${mLcNumber} updated!`);
      } else {
        const { error } = await supabase.from('commercial_lcs').insert(payload);
        if (error) throw error;
        toast.success(`Master LC ${mLcNumber} opened!`);
      }

      setMasterModalOpen(false);
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save Master LC.');
    } finally {
      setSaving(false);
    }
  };

  const selectedMasterAvailBalance = useMemo(() => {
    if (!bMasterLcId) return 0;
    const master = masterLcMap.get(bMasterLcId);
    if (!master) return 0;
    const utilized = utilizedByMasterId.get(bMasterLcId) || 0;
    const editingSelfVal = editingBtbId
      ? Number(btbLcs.find((b) => b.id === editingBtbId)?.lc_value || 0)
      : 0;
    return Number(master.lc_value || 0) - utilized + editingSelfVal;
  }, [bMasterLcId, masterLcMap, utilizedByMasterId, editingBtbId, btbLcs]);

  const handleSaveBtbLc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bLcNumber.trim() || !bMasterLcId || !bSupplierName.trim()) {
      toast.error('BTB LC #, Linked Master LC, and Supplier Name are required.');
      return;
    }
    const val = Number(bLcValue || 0);
    if (!Number.isFinite(val) || val <= 0) {
      toast.error('BTB LC Value must be greater than 0.');
      return;
    }

    const valUsd = bCurrency === 'BDT' ? val / 122 : val;
    if (valUsd > selectedMasterAvailBalance + 0.01) {
      toast.error(
        `BTB LC value ($${valUsd.toFixed(2)}) exceeds Master LC available balance ($${selectedMasterAvailBalance.toFixed(2)}).`
      );
      return;
    }

    setSaving(true);
    try {
      const master = masterLcMap.get(bMasterLcId);
      const payload = {
        lc_number: bLcNumber.trim(),
        lc_type: 'BTB_LC',
        lc_date: bLcDate || getTodayIso(),
        buyer_id: master?.buyer_id || null,
        master_lc_id: bMasterLcId,
        pi_id: bPiId || null,
        supplier_name: bSupplierName.trim(),
        issuing_bank: bIssuingBank.trim() || master?.issuing_bank || null,
        currency: bCurrency,
        lc_value: Number(val.toFixed(2)),
        expiry_date: null,
        maturity_date: bMaturityDate || null,
        bank_charges: Number(Number(bBankCharges || 0).toFixed(2)),
        status: bStatus,
      };

      if (editingBtbId) {
        const { error } = await supabase
          .from('commercial_lcs')
          .update(payload)
          .eq('id', editingBtbId);
        if (error) throw error;
        toast.success(`BTB LC ${bLcNumber} updated!`);
      } else {
        const { error } = await supabase.from('commercial_lcs').insert(payload);
        if (error) throw error;
        toast.success(`BTB LC ${bLcNumber} opened!`);
      }

      setBtbModalOpen(false);
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save BTB LC.');
    } finally {
      setSaving(false);
    }
  };

  const handleCycleBtbStatus = async (lc: CommercialLc, nextStatus: 'Accepted' | 'Paid') => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('commercial_lcs')
        .update({ status: nextStatus })
        .eq('id', lc.id);
      if (error) throw error;
      toast.success(`BTB LC ${lc.lc_number} marked as ${nextStatus}`);
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update BTB payment status.');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const table = deleteTarget.kind === 'pi' ? 'supplier_pis' : 'commercial_lcs';
      const { error } = await supabase.from(table).delete().eq('id', deleteTarget.id);
      if (error) throw error;
      toast.success(`Deleted ${deleteTarget.label}`);
      setDeleteTarget(null);
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete record.');
    } finally {
      setDeleting(false);
    }
  };

  const inputClass = `w-full px-3 py-2 text-xs rounded-xl border transition-all focus:outline-none focus:ring-2 focus:ring-[#2BA5B5] ${
    isDark
      ? 'bg-[#0B2E33] border-white/15 text-white placeholder:text-slate-400'
      : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'
  }`;

  const cardClass = `rounded-2xl border p-5 transition-all ${
    isDark
      ? 'bg-[#103A40]/85 border-white/10 text-slate-100'
      : 'glass-card bg-white/90 border-slate-200 text-slate-900'
  }`;

  return (
    <AdminLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2.5">
              <BadgeDollarSign className="w-6 h-6 text-[#0F8B8D] dark:text-[#2BA5B5]" />
              <span>Commercial &amp; LC Management</span>
            </h1>
            <p className="text-xs font-bangla opacity-70 mt-1">
              সাপ্লায়ার পিআই, মাস্টার এক্সপোর্ট এলসি এবং ব্যাক-টু-ব্যাক (BTB) এলসি ও ব্যাংক চার্জ নিয়ন্ত্রণ
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={loadData}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl border text-xs font-semibold cursor-pointer ${
                isDark
                  ? 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-200'
                  : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>

            <button
              type="button"
              onClick={openNewPiModal}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl border text-xs font-bold cursor-pointer ${
                isDark
                  ? 'bg-white/10 border-white/15 hover:bg-white/15 text-white'
                  : 'bg-white border-slate-300 hover:bg-slate-50 text-slate-800'
              }`}
            >
              <Plus className="w-3.5 h-3.5 text-[#0F8B8D] dark:text-[#2BA5B5]" />
              <span>New PI</span>
            </button>

            <button
              type="button"
              onClick={openNewMasterModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-[#0F8B8D] hover:bg-[#0b6f71] text-white text-xs font-bold shadow-sm cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Master LC</span>
            </button>

            <button
              type="button"
              onClick={() => openNewBtbModal()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Open BTB LC</span>
            </button>
          </div>
        </div>

        {/* 4 KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className={cardClass}>
            <span className="text-[11px] uppercase font-bold opacity-65 block">
              Total Master LC Value
            </span>
            <span className="text-2xl font-extrabold text-[#0F8B8D] dark:text-[#2BA5B5] mt-1 block tabular-nums">
              ${formatNumberBD(kpis.totalMasterValue, 2)}
            </span>
            <span className="text-[11px] font-bangla opacity-70">
              মোট মাস্টার এক্সপোর্ট এলসি ({masterLcs.length})
            </span>
          </div>

          <div className={cardClass}>
            <span className="text-[11px] uppercase font-bold opacity-65 block">
              Total BTB LC Opened
            </span>
            <span className="text-2xl font-extrabold mt-1 block tabular-nums">
              ${formatNumberBD(kpis.totalBtbOpened, 2)}
            </span>
            <span className="text-[11px] font-bangla opacity-70">
              খোলা ব্যাক-টু-ব্যাক এলসি ({btbLcs.length})
            </span>
          </div>

          <div className={cardClass}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase font-bold opacity-65 block">
                BTB Utilization %
              </span>
              <span
                className={`text-xs font-extrabold tabular-nums ${
                  kpis.utilizationPct > 70 ? 'text-amber-500' : 'text-emerald-500'
                }`}
              >
                {kpis.utilizationPct.toFixed(1)}%
              </span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-slate-200 dark:bg-white/10 mt-2.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  kpis.utilizationPct > 70 ? 'bg-amber-500' : 'bg-[#0F8B8D]'
                }`}
                style={{ width: `${Math.min(100, kpis.utilizationPct)}%` }}
              />
            </div>
            <span className="text-[11px] font-bangla opacity-70 mt-1.5 block">
              মাস্টার এলসি ইউটিলাইজেশন (স্ট্যান্ডার্ড সীমা ৭০%)
            </span>
          </div>

          <div className={cardClass}>
            <span className="text-[11px] uppercase font-bold opacity-65 block">
              Active Supplier PIs
            </span>
            <span className="text-2xl font-extrabold text-emerald-500 mt-1 block tabular-nums">
              {kpis.activePisCount}
              <span className="text-xs font-bold opacity-75 ml-2">
                (${formatNumberBD(kpis.activePisUsd, 0)})
              </span>
            </span>
            <span className="text-[11px] font-bangla opacity-70">সক্রিয় সাপ্লায়ার পিআই সংখ্যা</span>
          </div>
        </div>

        {/* Connected Tabs + Search Bar */}
        <div className={`${cardClass} space-y-4`}>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-200/20">
            <div
              className={`inline-flex flex-wrap p-1 rounded-2xl border gap-1 ${
                isDark ? 'bg-[#0B2E33] border-white/10' : 'bg-slate-100 border-slate-200'
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  setActiveTab('pis');
                  setStatusFilter('ALL');
                }}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'pis'
                    ? 'bg-[#0F8B8D] text-white shadow-sm'
                    : 'opacity-75 hover:opacity-100'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Supplier PIs</span>
                <span className="font-bangla text-[10px] opacity-85">(সাপ্লায়ার পিআই)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('master_lc');
                  setStatusFilter('ALL');
                }}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'master_lc'
                    ? 'bg-[#0F8B8D] text-white shadow-sm'
                    : 'opacity-75 hover:opacity-100'
                }`}
              >
                <Landmark className="w-3.5 h-3.5" />
                <span>Export / Master LC</span>
                <span className="font-bangla text-[10px] opacity-85">(মাস্টার এলসি)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('btb_lc');
                  setStatusFilter('ALL');
                }}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'btb_lc'
                    ? 'bg-[#0F8B8D] text-white shadow-sm'
                    : 'opacity-75 hover:opacity-100'
                }`}
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>Back-to-Back LC</span>
                <span className="font-bangla text-[10px] opacity-85">(বিটিবি এলসি)</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[220px]">
                <Search className="w-3.5 h-3.5 opacity-50 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search LC #, PI #, Supplier, Buyer..."
                  className={`${inputClass} pl-8`}
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={`${inputClass} w-auto`}
              >
                <option value="ALL">All Status</option>
                {activeTab === 'pis' && (
                  <>
                    <option value="Received">Received</option>
                    <option value="Approved">Approved</option>
                  </>
                )}
                {activeTab === 'master_lc' && (
                  <>
                    <option value="Active">Active</option>
                    <option value="Closed">Closed</option>
                    <option value="Expired">Expired</option>
                  </>
                )}
                {activeTab === 'btb_lc' && (
                  <>
                    <option value="Pending">Pending</option>
                    <option value="Accepted">Accepted</option>
                    <option value="Paid">Paid</option>
                  </>
                )}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-2 opacity-70">
              <Loader2 className="w-6 h-6 animate-spin text-[#0F8B8D] dark:text-[#2BA5B5]" />
              <span className="text-xs font-semibold">Loading commercial records...</span>
            </div>
          ) : (
            <>
              {/* TAB 1: SUPPLIER PIs */}
              {activeTab === 'pis' && (
                <div className="overflow-x-auto">
                  {filteredPis.length === 0 ? (
                    <div className="py-12 text-center text-xs opacity-70">
                      No Supplier PIs found. Click &quot;New PI&quot; to record a Proforma Invoice linked to a Material Booking.
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr
                          className={`border-b ${
                            isDark ? 'border-white/10 text-slate-300' : 'border-slate-200 text-slate-600'
                          }`}
                        >
                          <th className="py-3 px-3 font-bold">PI #</th>
                          <th className="py-3 px-3 font-bold">Date</th>
                          <th className="py-3 px-3 font-bold">Supplier</th>
                          <th className="py-3 px-3 font-bold">Booking #</th>
                          <th className="py-3 px-3 font-bold text-center">Currency</th>
                          <th className="py-3 px-3 font-bold text-right">PI Value</th>
                          <th className="py-3 px-3 font-bold text-center">Status</th>
                          <th className="py-3 px-3 font-bold text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/20">
                        {filteredPis.map((p) => {
                          const bk =
                            p.material_bookings ||
                            (p.booking_id ? bookingsMap.get(p.booking_id) : undefined);
                          const isApproved = String(p.status).toLowerCase() === 'approved';
                          const sym = p.currency === 'BDT' ? '৳' : '$';
                          return (
                            <tr
                              key={p.id}
                              className={isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50/80'}
                            >
                              <td className="py-3 px-3 font-mono font-extrabold text-[#0F8B8D] dark:text-[#2BA5B5]">
                                {p.pi_no}
                              </td>
                              <td className="py-3 px-3">{formatStoreDate(p.pi_date)}</td>
                              <td className="py-3 px-3 font-semibold">{p.supplier_name}</td>
                              <td className="py-3 px-3 font-mono font-bold">
                                {bk?.booking_no || '-'}
                              </td>
                              <td className="py-3 px-3 text-center font-bold">{p.currency}</td>
                              <td className="py-3 px-3 text-right font-extrabold tabular-nums">
                                {sym}
                                {formatNumberBD(p.pi_value, 2)}
                              </td>
                              <td className="py-3 px-3 text-center">
                                <span
                                  className={`inline-block text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-lg border ${
                                    isApproved
                                      ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30'
                                      : 'bg-amber-500/15 text-amber-500 border-amber-500/30'
                                  }`}
                                >
                                  {p.status}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-right">
                                <div className="inline-flex items-center gap-1.5">
                                  {!isApproved && (
                                    <button
                                      type="button"
                                      onClick={() => handleQuickApprovePi(p)}
                                      title="Approve PI"
                                      className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25 cursor-pointer"
                                    >
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => openEditPiModal(p)}
                                    title="Edit PI"
                                    className="p-1.5 rounded-lg bg-slate-200/70 dark:bg-white/10 hover:opacity-80 cursor-pointer"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setDeleteTarget({ kind: 'pi', id: p.id, label: p.pi_no })
                                    }
                                    title="Delete PI"
                                    className="p-1.5 rounded-lg bg-rose-500/15 text-rose-500 hover:bg-rose-500/25 cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* TAB 2: EXPORT / MASTER LC */}
              {activeTab === 'master_lc' && (
                <div className="overflow-x-auto">
                  {filteredMasterLcs.length === 0 ? (
                    <div className="py-12 text-center text-xs opacity-70">
                      No Export / Master LCs found. Click &quot;New Master LC&quot; to register a buyer LC.
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr
                          className={`border-b ${
                            isDark ? 'border-white/10 text-slate-300' : 'border-slate-200 text-slate-600'
                          }`}
                        >
                          <th className="py-3 px-3 font-bold">Master LC #</th>
                          <th className="py-3 px-3 font-bold">Date</th>
                          <th className="py-3 px-3 font-bold">Buyer</th>
                          <th className="py-3 px-3 font-bold text-right">Value (USD)</th>
                          <th className="py-3 px-3 font-bold">Issuing Bank</th>
                          <th className="py-3 px-3 font-bold">Expiry Date</th>
                          <th className="py-3 px-3 font-bold">Latest Ship Date</th>
                          <th className="py-3 px-3 font-bold text-right">BTB Utilized</th>
                          <th className="py-3 px-3 font-bold text-right">Avail. Balance</th>
                          <th className="py-3 px-3 font-bold text-center">Status</th>
                          <th className="py-3 px-3 font-bold text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/20">
                        {filteredMasterLcs.map((lc) => {
                          const utilized = utilizedByMasterId.get(lc.id) || 0;
                          const avail = Number(lc.lc_value || 0) - utilized;
                          return (
                            <tr
                              key={lc.id}
                              className={isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50/80'}
                            >
                              <td className="py-3 px-3 font-mono font-extrabold text-[#0F8B8D] dark:text-[#2BA5B5]">
                                {lc.lc_number}
                              </td>
                              <td className="py-3 px-3">{formatStoreDate(lc.lc_date)}</td>
                              <td className="py-3 px-3 font-semibold">{lc.buyers?.name || '-'}</td>
                              <td className="py-3 px-3 text-right font-extrabold tabular-nums">
                                ${formatNumberBD(lc.lc_value, 2)}
                              </td>
                              <td className="py-3 px-3">{lc.issuing_bank || '-'}</td>
                              <td className="py-3 px-3">{formatStoreDate(lc.expiry_date)}</td>
                              <td className="py-3 px-3">{formatStoreDate(lc.maturity_date)}</td>
                              <td className="py-3 px-3 text-right font-bold text-amber-500 tabular-nums">
                                ${formatNumberBD(utilized, 2)}
                              </td>
                              <td className="py-3 px-3 text-right font-extrabold text-emerald-500 tabular-nums">
                                ${formatNumberBD(avail, 2)}
                              </td>
                              <td className="py-3 px-3 text-center">
                                <span
                                  className={`inline-block text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-lg border ${
                                    lc.status === 'Active'
                                      ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30'
                                      : lc.status === 'Closed'
                                      ? 'bg-slate-500/15 text-slate-400 border-slate-500/30'
                                      : 'bg-rose-500/15 text-rose-500 border-rose-500/30'
                                  }`}
                                >
                                  {lc.status}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-right">
                                <div className="inline-flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => openNewBtbModal(lc.id)}
                                    title="Open BTB LC under this Master LC"
                                    className="px-2 py-1 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold hover:bg-emerald-500/25 cursor-pointer"
                                  >
                                    + BTB
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openEditMasterModal(lc)}
                                    title="Edit Master LC"
                                    className="p-1.5 rounded-lg bg-slate-200/70 dark:bg-white/10 hover:opacity-80 cursor-pointer"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setDeleteTarget({
                                        kind: 'lc',
                                        id: lc.id,
                                        label: lc.lc_number,
                                      })
                                    }
                                    title="Delete Master LC"
                                    className="p-1.5 rounded-lg bg-rose-500/15 text-rose-500 hover:bg-rose-500/25 cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* TAB 3: BACK-TO-BACK LC (BTB LC) */}
              {activeTab === 'btb_lc' && (
                <div className="overflow-x-auto">
                  {filteredBtbLcs.length === 0 ? (
                    <div className="py-12 text-center text-xs opacity-70">
                      No Back-to-Back LCs opened yet. Click &quot;Open BTB LC&quot; to open a BTB LC against a Master LC &amp; PI.
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr
                          className={`border-b ${
                            isDark ? 'border-white/10 text-slate-300' : 'border-slate-200 text-slate-600'
                          }`}
                        >
                          <th className="py-3 px-3 font-bold">BTB LC #</th>
                          <th className="py-3 px-3 font-bold">Linked Master LC #</th>
                          <th className="py-3 px-3 font-bold">Supplier</th>
                          <th className="py-3 px-3 font-bold">Linked PI #</th>
                          <th className="py-3 px-3 font-bold text-right">LC Value</th>
                          <th className="py-3 px-3 font-bold">Maturity Date</th>
                          <th className="py-3 px-3 font-bold text-right">Bank Charges</th>
                          <th className="py-3 px-3 font-bold text-center">Payment Status</th>
                          <th className="py-3 px-3 font-bold text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/20">
                        {filteredBtbLcs.map((lc) => {
                          const master = lc.master_lc_id ? masterLcMap.get(lc.master_lc_id) : undefined;
                          const pi = lc.pi_id ? pisMap.get(lc.pi_id) : undefined;
                          const sym = lc.currency === 'BDT' ? '৳' : '$';
                          return (
                            <tr
                              key={lc.id}
                              className={isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50/80'}
                            >
                              <td className="py-3 px-3 font-mono font-extrabold text-[#0F8B8D] dark:text-[#2BA5B5]">
                                {lc.lc_number}
                              </td>
                              <td className="py-3 px-3 font-mono font-bold">
                                {master?.lc_number || '-'}
                              </td>
                              <td className="py-3 px-3 font-semibold">{lc.supplier_name || '-'}</td>
                              <td className="py-3 px-3 font-mono">{pi?.pi_no || '-'}</td>
                              <td className="py-3 px-3 text-right font-extrabold tabular-nums">
                                {sym}
                                {formatNumberBD(lc.lc_value, 2)}
                              </td>
                              <td className="py-3 px-3">{formatStoreDate(lc.maturity_date)}</td>
                              <td className="py-3 px-3 text-right tabular-nums">
                                {sym}
                                {formatNumberBD(lc.bank_charges || 0, 2)}
                              </td>
                              <td className="py-3 px-3 text-center">
                                <span
                                  className={`inline-block text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-lg border ${
                                    lc.status === 'Paid'
                                      ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30'
                                      : lc.status === 'Accepted'
                                      ? 'bg-sky-500/15 text-sky-500 border-sky-500/30'
                                      : 'bg-amber-500/15 text-amber-500 border-amber-500/30'
                                  }`}
                                >
                                  {lc.status}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-right">
                                <div className="inline-flex items-center gap-1.5">
                                  {lc.status !== 'Paid' && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleCycleBtbStatus(
                                          lc,
                                          lc.status === 'Pending' ? 'Accepted' : 'Paid'
                                        )
                                      }
                                      className="px-2 py-1 rounded-lg bg-emerald-500/15 text-emerald-500 text-[10px] font-bold hover:bg-emerald-500/25 cursor-pointer"
                                    >
                                      {lc.status === 'Pending' ? 'Accept' : 'Mark Paid'}
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => openEditBtbModal(lc)}
                                    title="Edit BTB LC"
                                    className="p-1.5 rounded-lg bg-slate-200/70 dark:bg-white/10 hover:opacity-80 cursor-pointer"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setDeleteTarget({
                                        kind: 'lc',
                                        id: lc.id,
                                        label: lc.lc_number,
                                      })
                                    }
                                    title="Delete BTB LC"
                                    className="p-1.5 rounded-lg bg-rose-500/15 text-rose-500 hover:bg-rose-500/25 cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* MODAL 1: NEW / EDIT SUPPLIER PI */}
      {piModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs">
          <form
            onSubmit={handleSavePi}
            className={`w-full max-w-lg rounded-3xl border shadow-2xl overflow-hidden ${
              isDark
                ? 'bg-[#0B2E33] border-white/15 text-slate-100'
                : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div
              className={`px-6 py-4 border-b flex items-center justify-between ${
                isDark ? 'bg-[#103A40] border-white/10' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div>
                <h3 className="text-base font-extrabold">
                  {editingPiId ? 'Edit Supplier PI' : 'New Supplier PI'}
                </h3>
                <p className="text-[11px] font-bangla opacity-70">
                  বুকিংয়ের সাথে লিংক করে সাপ্লায়ার প্রোফর্মা ইনভয়েস (PI) সংরক্ষণ করুন
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPiModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-3.5">
              <div>
                <label className="block text-[10px] font-bold uppercase opacity-75 mb-1">
                  Link Material Booking (Optional)
                </label>
                <select
                  value={piBookingId}
                  onChange={(e) => handleSelectBookingForPi(e.target.value)}
                  className={inputClass}
                >
                  <option value="">-- Select Approved Booking --</option>
                  {approvedBookings.map((bk) => {
                    const amt = (bk.material_booking_items || []).reduce(
                      (s, it) => s + Number(it.total_amount || 0),
                      0
                    );
                    return (
                      <option key={bk.id} value={bk.id}>
                        {bk.booking_no} — {bk.supplier_name} ({bk.currency} {amt.toFixed(2)})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase opacity-75 mb-1">
                    PI Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={piNo}
                    onChange={(e) => setPiNo(e.target.value)}
                    placeholder="e.g. PI-2026-089"
                    className={`${inputClass} font-mono font-bold`}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase opacity-75 mb-1">
                    PI Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={piDate}
                    onChange={(e) => setPiDate(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase opacity-75 mb-1">
                  Supplier Name *
                </label>
                <input
                  type="text"
                  required
                  value={piSupplierName}
                  onChange={(e) => setPiSupplierName(e.target.value)}
                  placeholder="Supplier company name"
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase opacity-75 mb-1">
                    Currency
                  </label>
                  <select
                    value={piCurrency}
                    onChange={(e) => setPiCurrency(e.target.value as MerchCurrency)}
                    className={inputClass}
                  >
                    <option value="USD">USD ($)</option>
                    <option value="BDT">BDT (৳)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase opacity-75 mb-1">
                    PI Value *
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    required
                    value={piValue}
                    onChange={(e) => setPiValue(e.target.value)}
                    className={`${inputClass} font-bold`}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase opacity-75 mb-1">
                    Status
                  </label>
                  <select
                    value={piStatus}
                    onChange={(e) => setPiStatus(e.target.value as 'Received' | 'Approved')}
                    className={inputClass}
                  >
                    <option value="Received">Received</option>
                    <option value="Approved">Approved</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase opacity-75 mb-1">
                  Remarks
                </label>
                <input
                  type="text"
                  value={piRemarks}
                  onChange={(e) => setPiRemarks(e.target.value)}
                  placeholder="Optional PI notes..."
                  className={inputClass}
                />
              </div>
            </div>

            <div
              className={`px-6 py-4 border-t flex justify-end gap-2.5 ${
                isDark ? 'bg-[#103A40] border-white/10' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <button
                type="button"
                onClick={() => setPiModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-white/15 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#0F8B8D] hover:bg-[#0b6f71] text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Save PI</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 2: NEW / EDIT MASTER LC */}
      {masterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs">
          <form
            onSubmit={handleSaveMasterLc}
            className={`w-full max-w-lg rounded-3xl border shadow-2xl overflow-hidden ${
              isDark
                ? 'bg-[#0B2E33] border-white/15 text-slate-100'
                : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div
              className={`px-6 py-4 border-b flex items-center justify-between ${
                isDark ? 'bg-[#103A40] border-white/10' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div>
                <h3 className="text-base font-extrabold">
                  {editingMasterId ? 'Edit Export / Master LC' : 'New Export / Master LC'}
                </h3>
                <p className="text-[11px] font-bangla opacity-70">
                  বায়ার এক্সপোর্ট মাস্টার এলসি তথ্য ও শিপমেন্ট তারিখ সংরক্ষণ করুন
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMasterModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase opacity-75 mb-1">
                    Master LC # *
                  </label>
                  <input
                    type="text"
                    required
                    value={mLcNumber}
                    onChange={(e) => setMLcNumber(e.target.value)}
                    placeholder="e.g. MLC-EXP-2026-01"
                    className={`${inputClass} font-mono font-bold`}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase opacity-75 mb-1">
                    Buyer *
                  </label>
                  <select
                    required
                    value={mBuyerId}
                    onChange={(e) => setMBuyerId(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">-- Select Buyer --</option>
                    {buyers.map((by) => (
                      <option key={by.id} value={by.id}>
                        {by.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase opacity-75 mb-1">
                    LC Issue Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={mLcDate}
                    onChange={(e) => setMLcDate(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase opacity-75 mb-1">
                    LC Value (USD $) *
                  </label>
                  <div className="relative">
                    <DollarSign className="w-3.5 h-3.5 text-[#0F8B8D] dark:text-[#2BA5B5] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="number"
                      min="0.01"
                      step="any"
                      required
                      value={mLcValue}
                      onChange={(e) => setMLcValue(e.target.value)}
                      className={`${inputClass} pl-8 font-bold`}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase opacity-75 mb-1">
                  Issuing / Advising Bank *
                </label>
                <input
                  type="text"
                  required
                  value={mIssuingBank}
                  onChange={(e) => setMIssuingBank(e.target.value)}
                  placeholder="e.g. HSBC Bangladesh / Eastern Bank PLC"
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase opacity-75 mb-1">
                    <Calendar className="w-3 h-3 inline mr-1" />
                    Expiry Date
                  </label>
                  <input
                    type="date"
                    value={mExpiryDate}
                    onChange={(e) => setMExpiryDate(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase opacity-75 mb-1">
                    Latest Ship Date
                  </label>
                  <input
                    type="date"
                    value={mShipmentDate}
                    onChange={(e) => setMShipmentDate(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase opacity-75 mb-1">
                    Status
                  </label>
                  <select
                    value={mStatus}
                    onChange={(e) => setMStatus(e.target.value as 'Active' | 'Closed' | 'Expired')}
                    className={inputClass}
                  >
                    <option value="Active">Active</option>
                    <option value="Closed">Closed</option>
                    <option value="Expired">Expired</option>
                  </select>
                </div>
              </div>
            </div>

            <div
              className={`px-6 py-4 border-t flex justify-end gap-2.5 ${
                isDark ? 'bg-[#103A40] border-white/10' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <button
                type="button"
                onClick={() => setMasterModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-white/15 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#0F8B8D] hover:bg-[#0b6f71] text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Save Master LC</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 3: OPEN / EDIT BTB LC */}
      {btbModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs">
          <form
            onSubmit={handleSaveBtbLc}
            className={`w-full max-w-lg rounded-3xl border shadow-2xl overflow-hidden ${
              isDark
                ? 'bg-[#0B2E33] border-white/15 text-slate-100'
                : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div
              className={`px-6 py-4 border-b flex items-center justify-between ${
                isDark ? 'bg-[#103A40] border-white/10' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div>
                <h3 className="text-base font-extrabold">
                  {editingBtbId ? 'Edit Back-to-Back (BTB) LC' : 'Open Back-to-Back (BTB) LC'}
                </h3>
                <p className="text-[11px] font-bangla opacity-70">
                  মাস্টার এলসি ও অনুমোদিত পিআই-এর বিপরীতে ব্যাক-টু-ব্যাক এলসি ওপেন করুন
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBtbModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-3.5">
              <div>
                <label className="block text-[10px] font-bold uppercase opacity-75 mb-1">
                  Linked Master LC *
                </label>
                <select
                  required
                  value={bMasterLcId}
                  onChange={(e) => setBMasterLcId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">-- Select Master LC --</option>
                  {masterLcs.map((mlc) => {
                    const ut = utilizedByMasterId.get(mlc.id) || 0;
                    const av = Number(mlc.lc_value || 0) - ut;
                    return (
                      <option key={mlc.id} value={mlc.id}>
                        {mlc.lc_number} · {mlc.buyers?.name || 'Buyer'} · Avail: $
                        {formatNumberBD(av, 2)}
                      </option>
                    );
                  })}
                </select>
                {bMasterLcId && (
                  <p className="text-[11px] font-bold text-emerald-500 mt-1">
                    Available Master LC Balance: ${formatNumberBD(selectedMasterAvailBalance, 2)}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase opacity-75 mb-1">
                  Link Approved Supplier PI (Optional)
                </label>
                <select
                  value={bPiId}
                  onChange={(e) => handleSelectPiForBtb(e.target.value)}
                  className={inputClass}
                >
                  <option value="">-- Select Approved PI --</option>
                  {approvedPis.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.pi_no} — {p.supplier_name} ({p.currency} {formatNumberBD(p.pi_value, 2)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase opacity-75 mb-1">
                    BTB LC # *
                  </label>
                  <input
                    type="text"
                    required
                    value={bLcNumber}
                    onChange={(e) => setBLcNumber(e.target.value)}
                    placeholder="e.g. BTB-2026-014"
                    className={`${inputClass} font-mono font-bold`}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase opacity-75 mb-1">
                    Open Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={bLcDate}
                    onChange={(e) => setBLcDate(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase opacity-75 mb-1">
                    Supplier Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={bSupplierName}
                    onChange={(e) => setBSupplierName(e.target.value)}
                    placeholder="Supplier company"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase opacity-75 mb-1">
                    Issuing Bank
                  </label>
                  <input
                    type="text"
                    value={bIssuingBank}
                    onChange={(e) => setBIssuingBank(e.target.value)}
                    placeholder="Bank name"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase opacity-75 mb-1">
                    Currency
                  </label>
                  <select
                    value={bCurrency}
                    onChange={(e) => setBCurrency(e.target.value as MerchCurrency)}
                    className={inputClass}
                  >
                    <option value="USD">USD ($)</option>
                    <option value="BDT">BDT (৳)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase opacity-75 mb-1">
                    BTB Value *
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    required
                    value={bLcValue}
                    onChange={(e) => setBLcValue(e.target.value)}
                    className={`${inputClass} font-bold`}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase opacity-75 mb-1">
                    Bank Charges
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={bBankCharges}
                    onChange={(e) => setBBankCharges(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase opacity-75 mb-1">
                    Maturity Date
                  </label>
                  <input
                    type="date"
                    value={bMaturityDate}
                    onChange={(e) => setBMaturityDate(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase opacity-75 mb-1">
                    Payment Status
                  </label>
                  <select
                    value={bStatus}
                    onChange={(e) => setBStatus(e.target.value as 'Pending' | 'Accepted' | 'Paid')}
                    className={inputClass}
                  >
                    <option value="Pending">Pending</option>
                    <option value="Accepted">Accepted</option>
                    <option value="Paid">Paid</option>
                  </select>
                </div>
              </div>
            </div>

            <div
              className={`px-6 py-4 border-t flex justify-end gap-2.5 ${
                isDark ? 'bg-[#103A40] border-white/10' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <button
                type="button"
                onClick={() => setBtbModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-white/15 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Save BTB LC</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div
            className={`w-full max-w-md rounded-2xl border p-6 space-y-4 shadow-2xl ${
              isDark
                ? 'bg-[#103A40] border-white/15 text-white'
                : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/15 text-rose-500 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold">Confirm Deletion</h3>
                <p className="text-xs opacity-75 mt-1">
                  Delete <span className="font-mono font-bold">{deleteTarget.label}</span>? This
                  action cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-white/15 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default CommercialPage;
