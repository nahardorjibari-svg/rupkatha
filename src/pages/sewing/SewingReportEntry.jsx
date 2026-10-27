/**
 * Sewing Hourly Production Report Entry Page (Per-Hour Lock Model)
 * Rupkatha Apparels Ltd. (src/pages/sewing/SewingReportEntry.jsx)
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { useTheme } from '../../context/ThemeContext';
import { useCompany } from '../../context/CompanyContext';
import { useAuth } from '../../context/AuthContext';
import {
  fetchSewingReports,
  saveSewingReport,
  fetchHourLocks,
  submitHourLock,
  reopenHourLock,
  fetchEditLogs,
  subscribeSewingRealtime,
} from '../../lib/sewingQueries';
import { calculateLineHourTotals } from '../../lib/sewingCalc';
import {
  FileText,
  Calendar,
  Factory,
  Save,
  Lock,
  Unlock,
  CheckCircle2,
  Clock,
  History,
  ShieldAlert,
  Send,
  X,
  Check,
} from 'lucide-react';
import toast from 'react-hot-toast';

export const SewingReportEntry = () => {
  const { isDark } = useTheme();
  const { companyName } = useCompany();
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const userName = profile?.full_name || profile?.email || 'ERP User';

  const getBdtDate = () => new Date().toISOString().split('T')[0];

  const [date, setDate] = useState(getBdtDate());
  const [factoryUnit, setFactoryUnit] = useState('knit');
  const [reportId, setReportId] = useState(null);

  const [lines, setLines] = useState([1, 2, 3, 4].map((lineNo) => ({
    lineNo,
    buyerName: '',
    styleNo: '',
    op: '',
    hp: '',
    ir: '',
    totalTarget: '',
    hourTarget: '',
    remarks: '',
    hours: Array.from({ length: 10 }, (_, i) => ({
      hourNo: i + 1,
      backQty: '',
      frontQty: '',
      outputQty: '',
      asm: '',
    })),
  })));

  const [hourLocks, setHourLocks] = useState([]); // [{ hour_no, submitted_by_name, submitted_at, ... }]
  const [editLogs, setEditLogs] = useState([]);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [historyFilter, setHistoryFilter] = useState('all'); // 'all' | 'after_submit'

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [adminWarnedSession, setAdminWarnedSession] = useState(false);

  const loadReportData = useCallback(async () => {
    setLoading(true);
    try {
      const reports = await fetchSewingReports({ date, unit: factoryUnit });
      const matched = reports.find((r) => r.report_date === date && r.factory_unit === factoryUnit);

      if (matched) {
        setReportId(matched.id);
        const locks = await fetchHourLocks(matched.id);
        setHourLocks(locks);
        const logs = await fetchEditLogs(matched.id);
        setEditLogs(logs);

        const loadedLines = [1, 2, 3, 4].map((lineNo) => {
          const existingLine = (matched.lines || []).find((l) => l.line_no === lineNo);
          if (existingLine) {
            const hoursArr = Array.from({ length: 10 }, (_, i) => {
              const hrNo = i + 1;
              const foundHr = (existingLine.hours || []).find((h) => h.hour_no === hrNo);
              return {
                hourNo: hrNo,
                backQty: foundHr && foundHr.back_qty !== null ? foundHr.back_qty : '',
                frontQty: foundHr && foundHr.front_qty !== null ? foundHr.front_qty : '',
                outputQty: foundHr && foundHr.output_qty !== null ? foundHr.output_qty : '',
                asm: foundHr && foundHr.asm ? foundHr.asm : '',
              };
            });
            return {
              lineNo,
              buyerName: existingLine.buyer_name || '',
              styleNo: existingLine.style_no || '',
              op: existingLine.op !== null ? existingLine.op : '',
              hp: existingLine.hp !== null ? existingLine.hp : '',
              ir: existingLine.ir !== null ? existingLine.ir : '',
              totalTarget: existingLine.total_target !== null ? existingLine.total_target : '',
              hourTarget: existingLine.hour_target !== null ? existingLine.hour_target : '',
              remarks: existingLine.remarks || '',
              hours: hoursArr,
            };
          } else {
            return {
              lineNo,
              buyerName: '',
              styleNo: '',
              op: '',
              hp: '',
              ir: '',
              totalTarget: '',
              hourTarget: '',
              remarks: '',
              hours: Array.from({ length: 10 }, (_, i) => ({
                hourNo: i + 1,
                backQty: '',
                frontQty: '',
                outputQty: '',
                asm: '',
              })),
            };
          }
        });
        setLines(loadedLines);
      } else {
        setReportId(null);
        setHourLocks([]);
        setEditLogs([]);
        setLines([1, 2, 3, 4].map((lineNo) => ({
          lineNo,
          buyerName: '',
          styleNo: '',
          op: '',
          hp: '',
          ir: '',
          totalTarget: '',
          hourTarget: '',
          remarks: '',
          hours: Array.from({ length: 10 }, (_, i) => ({
            hourNo: i + 1,
            backQty: '',
            frontQty: '',
            outputQty: '',
            asm: '',
          })),
        })));
      }
      setIsDirty(false);
    } catch (err) {
      console.error('Failed to load report:', err);
    } finally {
      setLoading(false);
    }
  }, [date, factoryUnit]);

  useEffect(() => {
    loadReportData();
    const unsubscribe = subscribeSewingRealtime(() => {
      if (!isDirty) {
        loadReportData();
      }
    });
    return () => unsubscribe();
  }, [loadReportData, isDirty]);

  const saveTimeoutRef = useRef(null);
  const triggerAutosave = useCallback((updatedLines) => {
    setIsDirty(true);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        setSaving(true);
        const res = await saveSewingReport({
          reportDate: date,
          factoryUnit,
          lines: updatedLines,
          createdByName: userName,
        });
        if (res?.reportId && !reportId) {
          setReportId(res.reportId);
          const locks = await fetchHourLocks(res.reportId);
          setHourLocks(locks);
        }
        setLastSaved(new Date());
        setIsDirty(false);
      } catch (err) {
        if (err?.message?.includes('RLS') || err?.message?.includes('locked')) {
          toast.error('This hour is submitted and locked. Changes reverted.');
          loadReportData();
        } else {
          console.error('Autosave error:', err);
        }
      } finally {
        setSaving(false);
      }
    }, 1500);
  }, [date, factoryUnit, reportId, userName, loadReportData]);

  const handleLineChange = (lineIndex, field, value) => {
    const updated = [...lines];
    updated[lineIndex][field] = value;
    setLines(updated);
    triggerAutosave(updated);
  };

  const handleHourChange = (lineIndex, hourIndex, field, value, hourNo) => {
    const isHourLocked = hourLocks.some((l) => l.hour_no === hourNo);
    if (isHourLocked && !isAdmin) {
      toast.error(`Hour ${String(hourNo).padStart(2, '0')} is submitted and locked. Contact admin.`);
      return;
    }
    if (isHourLocked && isAdmin && !adminWarnedSession) {
      toast('This hour is submitted. Your change will be logged as After-submit edit.', { icon: '⚠️' });
      setAdminWarnedSession(true);
    }

    const updated = [...lines];
    updated[lineIndex].hours[hourIndex][field] = value;
    setLines(updated);
    triggerAutosave(updated);
  };

  // Check if an hour has data across any line
  const isHourFilled = (hourNo) => {
    return lines.some((l) => {
      const hr = l.hours.find((h) => h.hour_no === hourNo);
      return hr && ((hr.backQty !== '' && hr.backQty !== null) || (hr.frontQty !== '' && hr.frontQty !== null) || (hr.outputQty !== '' && hr.outputQty !== null));
    });
  };

  // Check if any earlier hour has data and is not locked
  const hasEarlierUnlockedData = (hourNo) => {
    for (let h = 1; h < hourNo; h++) {
      if (isHourFilled(h) && !hourLocks.some((l) => l.hour_no === h)) {
        return true;
      }
    }
    return false;
  };

  const handleSubmitHour = async (hourNo) => {
    if (!reportId) {
      // Save first to get reportId
      try {
        setSaving(true);
        const res = await saveSewingReport({
          reportDate: date,
          factoryUnit,
          lines,
          createdByName: userName,
        });
        setReportId(res.reportId);
        await submitHourLock(res.reportId, hourNo);
        const locks = await fetchHourLocks(res.reportId);
        setHourLocks(locks);
        toast.success(`Hour ${String(hourNo).padStart(2, '0')} submitted and locked successfully.`);
      } catch (err) {
        toast.error('Failed to submit hour.');
      } finally {
        setSaving(false);
      }
      return;
    }

    try {
      await submitHourLock(reportId, hourNo);
      const locks = await fetchHourLocks(reportId);
      setHourLocks(locks);
      toast.success(`Hour ${String(hourNo).padStart(2, '0')} submitted and locked successfully.`);
    } catch (err) {
      toast.error('Failed to submit hour lock.');
    }
  };

  const handleReopenHour = async (hourNo) => {
    if (!isAdmin) return;
    if (window.confirm(`Reopen Hour ${String(hourNo).padStart(2, '0')} for editing?`)) {
      try {
        await reopenHourLock(reportId, hourNo);
        const locks = await fetchHourLocks(reportId);
        setHourLocks(locks);
        toast.success(`Hour ${String(hourNo).padStart(2, '0')} reopened successfully.`);
      } catch (err) {
        toast.error('Failed to reopen hour.');
      }
    }
  };

  const handleSubmitAllFilled = async () => {
    if (!reportId) {
      toast.error('Please save report first.');
      return;
    }
    for (let h = 1; h <= 10; h++) {
      if (isHourFilled(h) && !hourLocks.some((l) => l.hour_no === h)) {
        try {
          await submitHourLock(reportId, h);
        } catch (err) {
          console.error(`Failed to lock hour ${h}`);
        }
      }
    }
    const locks = await fetchHourLocks(reportId);
    setHourLocks(locks);
    toast.success('All filled hours submitted.');
  };

  const getCumulativeAtHour = (line, hourNo) => {
    let sum = 0;
    let hasVal = false;
    for (let i = 0; i < hourNo; i++) {
      const q = line.hours[i]?.output_qty;
      if (q !== '' && q !== null && q !== undefined && !isNaN(Number(q))) {
        sum += Number(q);
        hasVal = true;
      }
    }
    return hasVal ? sum : null;
  };

  // Edit log counts & filtered items
  const draftEditsCount = editLogs.filter((l) => !l.after_submit).length;
  const afterSubmitEditsCount = editLogs.filter((l) => l.after_submit).length;
  const filteredEditLogs = editLogs.filter((l) => {
    if (historyFilter === 'after_submit') return l.after_submit;
    return true;
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Paper Header Block */}
        <div className={`p-6 rounded-2xl border shadow-sm ${
          isDark ? 'bg-[#103A40] border-white/25 text-white' : 'bg-white border-[#1E293B] text-[#0F172A]'
        }`}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-current/20">
            <div>
              <h2 className="text-xl font-extrabold tracking-wide uppercase">{companyName}</h2>
              <p className="text-xs text-[#475569] dark:text-slate-300 mt-0.5">
                Raj Place, Singair Road, Padma Moor (Rishipara), Hemayetpur, Savar, Dhaka-1213
              </p>
            </div>
            <div className="text-right flex items-center gap-4 justify-end">
              <div>
                <h1 className="text-lg font-black uppercase tracking-wider text-[#0F8B8D] dark:text-[#2BA5B5]">
                  HOURLY PRODUCTION REPORT
                </h1>
                <p className="text-xs font-bangla text-[#475569] dark:text-slate-300 mt-0.5">
                  ঘণ্টাভিত্তিক প্রোডাকশন রিপোর্ট (পার-আওয়ার লক মডেল)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowHistoryDrawer(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-[#0F8B8D]/15 text-[#0F8B8D] dark:text-[#2BA5B5] border border-[#0F8B8D]/30 hover:bg-[#0F8B8D]/25 transition-colors cursor-pointer"
              >
                <History className="w-4 h-4" />
                <span>Edit History ({editLogs.length})</span>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-4">
            <div className="flex flex-wrap items-center gap-6 text-xs font-semibold">
              <div className="flex items-center gap-2">
                <Factory className="w-4 h-4 text-[#0F8B8D]" />
                <span>Unit: <strong className="uppercase">{factoryUnit} Sewing</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#0F8B8D]" />
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={`px-2 py-1 rounded border text-xs font-bold outline-none ${
                    isDark ? 'bg-[#0B2E33] border-white/30 text-white' : 'bg-white border-[#1E293B] text-[#0F172A]'
                  }`}
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              {saving && <span className="text-xs text-[#0F8B8D] animate-pulse">Saving...</span>}
              {!saving && isDirty && <span className="text-xs text-amber-500 font-bold">Unsaved</span>}
              {lastSaved && !isDirty && !saving && (
                <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Saved
                </span>
              )}

              <button
                type="button"
                onClick={handleSubmitAllFilled}
                className="px-3 py-1.5 text-xs font-bold rounded bg-[#0F8B8D] text-white hover:bg-[#0b6d6f] transition-colors cursor-pointer shadow-sm"
              >
                Submit All Filled Hours
              </button>
            </div>
          </div>
        </div>

        {/* 4 Line Tables with Per-Hour Submit Controls in Header */}
        <div className="space-y-6">
          {lines.map((line, lineIdx) => {
            const { totalOutput, totalBack, totalFront } = calculateLineHourTotals(line.hours);
            const opVal = Number(line.op) || 0;
            const hpVal = Number(line.hp) || 0;
            const totalManpower = opVal + hpVal;

            return (
              <div
                key={line.lineNo}
                className={`p-4 rounded-2xl border shadow-sm ${
                  isDark ? 'bg-[#103A40] border-white/25 text-white' : 'bg-white border-[#1E293B] text-[#0F172A]'
                }`}
              >
                <div className="flex items-center justify-between mb-3 px-1">
                  <h3 className="font-extrabold text-sm uppercase tracking-wider text-[#0F8B8D] dark:text-[#2BA5B5]">
                    Line 0{line.lineNo} Production Register
                  </h3>
                  <span className="text-xs font-bold font-mono">
                    Total Manpower: {totalManpower > 0 ? totalManpower : '-'}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table
                    className="w-full border-collapse text-xs font-mono"
                    style={{ tableLayout: 'fixed', minWidth: '1350px', border: '1px solid #1E293B' }}
                  >
                    <thead>
                      <tr className={isDark ? 'bg-[#0B2E33] text-slate-200' : 'bg-[#F1F5F9] text-[#0F172A]'}>
                        <th className="p-2 border border-[#1E293B] font-extrabold text-center" style={{ width: '110px' }}>Buyer Name</th>
                        <th className="p-2 border border-[#1E293B] font-extrabold text-center" style={{ width: '100px' }}>Style No</th>
                        <th className="p-2 border border-[#1E293B] font-extrabold text-center" style={{ width: '90px' }}>Order Qty / MP</th>
                        <th className="p-2 border border-[#1E293B] font-extrabold text-center" style={{ width: '56px' }}>Line</th>
                        <th className="p-2 border border-[#1E293B] font-extrabold text-center" style={{ width: '80px' }}>Total Target</th>
                        <th className="p-2 border border-[#1E293B] font-extrabold text-center" style={{ width: '80px' }}>Hour Target</th>
                        <th className="p-2 border border-[#1E293B] font-extrabold text-center" style={{ width: '80px' }}>Parts</th>
                        {Array.from({ length: 10 }).map((_, i) => {
                          const hourNo = i + 1;
                          const lockObj = hourLocks.find((l) => l.hour_no === hourNo);
                          const isLockedHour = !!lockObj;
                          const filled = isHourFilled(hourNo);
                          const hasEarlierUnsub = hasEarlierUnlockedData(hourNo);

                          return (
                            <th
                              key={i}
                              className={`p-1 border border-[#1E293B] font-extrabold text-center relative ${
                                isLockedHour
                                  ? isDark ? 'bg-amber-950/40 text-amber-200' : 'bg-amber-50 text-amber-900'
                                  : ''
                              }`}
                              style={{ width: '68px' }}
                            >
                              <div className="flex items-center justify-between text-[10px] pb-0.5 border-b border-current/20 mb-1">
                                <span>{String(hourNo).padStart(2, '0')}</span>
                                {isLockedHour ? (
                                  <span
                                    title={`Submitted by ${lockObj.submitted_by_name || 'Admin'} at ${new Date(lockObj.submitted_at).toLocaleTimeString()}`}
                                    className="text-[9px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-300 flex items-center gap-0.5"
                                  >
                                    <Lock className="w-2.5 h-2.5" />
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={!filled}
                                    title={filled ? 'Submit this hour' : 'Enter data before submitting'}
                                    onClick={() => {
                                      if (hasEarlierUnsub) {
                                        if (!window.confirm('Warning: An earlier hour has data and is not submitted. Proceed?')) return;
                                      }
                                      if (window.confirm(`Submit Hour ${String(hourNo).padStart(2, '0')}? After submit only admin can edit.`)) {
                                        handleSubmitHour(hourNo);
                                      }
                                    }}
                                    className={`px-1 py-0.5 text-[9px] font-bold rounded cursor-pointer ${
                                      filled
                                        ? 'bg-[#0F8B8D] text-white hover:bg-[#0b6d6f]'
                                        : 'bg-slate-300 dark:bg-slate-700 text-slate-500 cursor-not-allowed'
                                    }`}
                                  >
                                    জমা
                                  </button>
                                )}
                              </div>
                              <div className="text-[9px] font-bangla text-[#0F8B8D] dark:text-[#2BA5B5] font-normal">ঘণ্টা</div>
                              {isLockedHour && isAdmin && (
                                <button
                                  type="button"
                                  onClick={() => handleReopenHour(hourNo)}
                                  className="mt-1 w-full text-[8px] bg-rose-500/20 text-rose-600 dark:text-rose-300 rounded py-0.5 hover:bg-rose-500/30"
                                >
                                  Reopen
                                </button>
                              )}
                            </th>
                          );
                        })}
                        <th className="p-2 border border-[#1E293B] font-extrabold text-center" style={{ width: '80px' }}>Total</th>
                        <th className="p-2 border border-[#1E293B] font-extrabold text-center" style={{ width: '140px' }}>Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* ROW 1: BACK */}
                      <tr className={isDark ? 'bg-[#0B2E33]/40' : 'bg-[#F8FAFC]'}>
                        <td rowSpan={4} className="border border-[#1E293B] p-1 align-middle text-center">
                          <input
                            type="text"
                            placeholder="-"
                            disabled={false}
                            value={line.buyerName}
                            onChange={(e) => handleLineChange(lineIdx, 'buyerName', e.target.value)}
                            className={`w-full px-2 py-1.5 text-xs rounded border text-center font-bold outline-none ${
                              isDark ? 'bg-[#12383E] border-white/30 text-white' : 'bg-white border-[#CBD5E1] text-[#0F172A]'
                            }`}
                          />
                        </td>
                        <td rowSpan={4} className="border border-[#1E293B] p-1 align-middle text-center">
                          <input
                            type="text"
                            placeholder="-"
                            disabled={false}
                            value={line.styleNo}
                            onChange={(e) => handleLineChange(lineIdx, 'styleNo', e.target.value)}
                            className={`w-full px-2 py-1.5 text-xs rounded border text-center font-bold outline-none ${
                              isDark ? 'bg-[#12383E] border-white/30 text-white' : 'bg-white border-[#CBD5E1] text-[#0F172A]'
                            }`}
                          />
                        </td>
                        <td rowSpan={4} className="border border-[#1E293B] p-1.5 align-middle text-xs space-y-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold text-[10px]">O.P:</span>
                            <input
                              type="number"
                              inputMode="numeric"
                              value={line.op}
                              onChange={(e) => handleLineChange(lineIdx, 'op', e.target.value)}
                              className={`w-12 px-1 py-0.5 rounded border text-center font-bold outline-none ${
                                isDark ? 'bg-[#12383E] border-white/30 text-white' : 'bg-white border-[#CBD5E1] text-[#0F172A]'
                              }`}
                            />
                          </div>
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold text-[10px]">H.P:</span>
                            <input
                              type="number"
                              inputMode="numeric"
                              value={line.hp}
                              onChange={(e) => handleLineChange(lineIdx, 'hp', e.target.value)}
                              className={`w-12 px-1 py-0.5 rounded border text-center font-bold outline-none ${
                                isDark ? 'bg-[#12383E] border-white/30 text-white' : 'bg-white border-[#CBD5E1] text-[#0F172A]'
                              }`}
                            />
                          </div>
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold text-[10px]">I.R:</span>
                            <input
                              type="number"
                              inputMode="numeric"
                              value={line.ir}
                              onChange={(e) => handleLineChange(lineIdx, 'ir', e.target.value)}
                              className={`w-12 px-1 py-0.5 rounded border text-center font-bold outline-none ${
                                isDark ? 'bg-[#12383E] border-white/30 text-white' : 'bg-white border-[#CBD5E1] text-[#0F172A]'
                              }`}
                            />
                          </div>
                          <div className="pt-1 border-t border-[#1E293B]/30 text-center font-extrabold text-[11px] text-[#0F8B8D]">
                            Tot: {totalManpower > 0 ? totalManpower : '-'}
                          </div>
                        </td>
                        <td rowSpan={4} className="border border-[#1E293B] p-1 align-middle text-center font-black text-base">
                          0{line.lineNo}
                        </td>
                        <td rowSpan={4} className="border border-[#1E293B] p-1 align-middle text-center">
                          <input
                            type="number"
                            inputMode="numeric"
                            value={line.totalTarget}
                            onChange={(e) => handleLineChange(lineIdx, 'totalTarget', e.target.value)}
                            className={`w-full px-2 py-2 text-xs rounded border text-center font-bold outline-none ${
                              isDark ? 'bg-[#12383E] border-white/30 text-white' : 'bg-white border-[#CBD5E1] text-[#0F172A]'
                            }`}
                          />
                        </td>
                        <td rowSpan={4} className="border border-[#1E293B] p-1 align-middle text-center">
                          <input
                            type="number"
                            inputMode="numeric"
                            value={line.hourTarget}
                            onChange={(e) => handleLineChange(lineIdx, 'hourTarget', e.target.value)}
                            className={`w-full px-2 py-2 text-xs rounded border text-center font-bold outline-none ${
                              isDark ? 'bg-[#12383E] border-white/30 text-white' : 'bg-white border-[#CBD5E1] text-[#0F172A]'
                            }`}
                          />
                        </td>
                        <td className="border border-[#1E293B] p-1.5 font-extrabold text-center">Back</td>
                        {line.hours.map((hr, hrIdx) => {
                          const isLocked = hourLocks.some((l) => l.hour_no === hr.hourNo);
                          const isDisabled = isLocked && !isAdmin;

                          return (
                            <td key={hrIdx} className={`border border-[#1E293B] p-1 text-center align-middle ${isLocked ? 'bg-amber-500/10' : ''}`}>
                              <div className="relative">
                                <input
                                  type="number"
                                  inputMode="numeric"
                                  disabled={isDisabled}
                                  value={hr.backQty}
                                  onFocus={(e) => e.target.select()}
                                  onChange={(e) => handleHourChange(lineIdx, hrIdx, 'backQty', e.target.value, hr.hourNo)}
                                  className={`w-full h-7 text-xs rounded border text-center font-bold outline-none tabular-nums ${
                                    isLocked && isAdmin ? 'border-amber-500 ring-1 ring-amber-500' : ''
                                  } ${
                                    isDisabled
                                      ? 'bg-slate-200 dark:bg-slate-800 text-slate-500 cursor-not-allowed'
                                      : isDark ? 'bg-[#12383E] border-white/30 text-white' : 'bg-white border-[#CBD5E1] text-[#0F172A]'
                                  }`}
                                />
                                {isLocked && (
                                  <span className="absolute right-0.5 top-0.5 text-[8px] text-amber-600 dark:text-amber-400">
                                    <Lock className="w-2.5 h-2.5" />
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-[#475569] dark:text-slate-400 font-mono mt-0.5 border-t border-dashed border-[#1E293B]/20 pt-0.5">
                                {getCumulativeAtHour(line, hr.hourNo) !== null ? getCumulativeAtHour(line, hr.hourNo) : ''}
                              </div>
                            </td>
                          );
                        })}
                        <td className="border border-[#1E293B] p-1 text-center font-bold font-mono">
                          {totalBack !== null ? totalBack : '-'}
                        </td>
                        <td rowSpan={4} className="border border-[#1E293B] p-1 align-middle text-center">
                          <textarea
                            rows={4}
                            value={line.remarks}
                            onChange={(e) => handleLineChange(lineIdx, 'remarks', e.target.value)}
                            className={`w-full h-full p-1.5 text-xs rounded border outline-none resize-none ${
                              isDark ? 'bg-[#12383E] border-white/30 text-white' : 'bg-white border-[#CBD5E1] text-[#0F172A]'
                            }`}
                            placeholder="Remarks..."
                          />
                        </td>
                      </tr>

                      {/* ROW 2: FRONT */}
                      <tr className={isDark ? 'bg-[#0B2E33]/60' : 'bg-[#F1F5F9]'}>
                        <td className="border border-[#1E293B] p-1.5 font-extrabold text-center">Front</td>
                        {line.hours.map((hr, hrIdx) => {
                          const isLocked = hourLocks.some((l) => l.hour_no === hr.hourNo);
                          const isDisabled = isLocked && !isAdmin;

                          return (
                            <td key={hrIdx} className={`border border-[#1E293B] p-1 text-center align-middle ${isLocked ? 'bg-amber-500/10' : ''}`}>
                              <div className="relative">
                                <input
                                  type="number"
                                  inputMode="numeric"
                                  disabled={isDisabled}
                                  value={hr.frontQty}
                                  onFocus={(e) => e.target.select()}
                                  onChange={(e) => handleHourChange(lineIdx, hrIdx, 'frontQty', e.target.value, hr.hourNo)}
                                  className={`w-full h-7 text-xs rounded border text-center font-bold outline-none tabular-nums ${
                                    isLocked && isAdmin ? 'border-amber-500 ring-1 ring-amber-500' : ''
                                  } ${
                                    isDisabled
                                      ? 'bg-slate-200 dark:bg-slate-800 text-slate-500 cursor-not-allowed'
                                      : isDark ? 'bg-[#12383E] border-white/30 text-white' : 'bg-white border-[#CBD5E1] text-[#0F172A]'
                                  }`}
                                />
                                {isLocked && (
                                  <span className="absolute right-0.5 top-0.5 text-[8px] text-amber-600 dark:text-amber-400">
                                    <Lock className="w-2.5 h-2.5" />
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-[#475569] dark:text-slate-400 font-mono mt-0.5 border-t border-dashed border-[#1E293B]/20 pt-0.5">
                                {getCumulativeAtHour(line, hr.hourNo) !== null ? getCumulativeAtHour(line, hr.hourNo) : ''}
                              </div>
                            </td>
                          );
                        })}
                        <td className="border border-[#1E293B] p-1 text-center font-bold font-mono">
                          {totalFront !== null ? totalFront : '-'}
                        </td>
                      </tr>

                      {/* ROW 3: OUT PUT */}
                      <tr className={isDark ? 'bg-[#103A40]/80' : 'bg-[#ECFEFF]'}>
                        <td className="border border-[#1E293B] p-1.5 font-extrabold text-center text-[#0F8B8D]">Out Put</td>
                        {line.hours.map((hr, hrIdx) => {
                          const isLocked = hourLocks.some((l) => l.hour_no === hr.hourNo);
                          const isDisabled = isLocked && !isAdmin;
                          const outVal = hr.outputQty !== '' && hr.outputQty !== null ? Number(hr.outputQty) : null;
                          const hrTarget = Number(line.hourTarget) || 0;
                          const isBelow = hrTarget > 0 && outVal !== null && outVal < hrTarget;
                          const isAbove = hrTarget > 0 && outVal !== null && outVal >= hrTarget;

                          let cellBgClass = isDark ? 'bg-[#12383E] text-white' : 'bg-white text-[#0F172A]';
                          if (isBelow) cellBgClass = 'bg-[#FEE2E2] text-rose-900 border-rose-400';
                          else if (isAbove) cellBgClass = 'bg-[#DCFCE7] text-emerald-900 border-emerald-400';

                          if (isDisabled) {
                            cellBgClass = 'bg-slate-200 dark:bg-slate-800 text-slate-500 cursor-not-allowed';
                          }

                          return (
                            <td key={hrIdx} className={`border border-[#1E293B] p-1 text-center align-middle ${isLocked ? 'bg-amber-500/10' : ''}`}>
                              <div className="relative">
                                <input
                                  type="number"
                                  inputMode="numeric"
                                  disabled={isDisabled}
                                  value={hr.outputQty}
                                  onFocus={(e) => e.target.select()}
                                  onChange={(e) => handleHourChange(lineIdx, hrIdx, 'outputQty', e.target.value, hr.hourNo)}
                                  className={`w-full h-7 text-xs rounded border text-center font-bold outline-none tabular-nums ${
                                    isLocked && isAdmin ? 'border-amber-500 ring-1 ring-amber-500' : ''
                                  } ${cellBgClass}`}
                                />
                                {isLocked && (
                                  <span className="absolute right-0.5 top-0.5 text-[8px] text-amber-600 dark:text-amber-400">
                                    <Lock className="w-2.5 h-2.5" />
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-[#475569] dark:text-slate-400 font-mono mt-0.5 border-t border-dashed border-[#1E293B]/20 pt-0.5">
                                {getCumulativeAtHour(line, hr.hourNo) !== null ? getCumulativeAtHour(line, hr.hourNo) : ''}
                              </div>
                            </td>
                          );
                        })}
                        <td className="border border-[#1E293B] p-1 text-center font-extrabold font-mono text-[#0F8B8D]">
                          {totalOutput !== null ? totalOutput : '-'}
                        </td>
                      </tr>

                      {/* ROW 4: A.S.M */}
                      <tr className={isDark ? 'bg-[#2A2415]/60' : 'bg-[#FFFBEB]'}>
                        <td className="border border-[#1E293B] p-1.5 font-extrabold text-center">A.S.M</td>
                        {line.hours.map((hr, hrIdx) => {
                          const isLocked = hourLocks.some((l) => l.hour_no === hr.hourNo);
                          const isDisabled = isLocked && !isAdmin;

                          return (
                            <td key={hrIdx} className={`border border-[#1E293B] p-1 text-center align-middle ${isLocked ? 'bg-amber-500/10' : ''}`}>
                              <div className="relative">
                                <input
                                  type="text"
                                  disabled={isDisabled}
                                  value={hr.asm}
                                  onFocus={(e) => e.target.select()}
                                  onChange={(e) => handleHourChange(lineIdx, hrIdx, 'asm', e.target.value, hr.hourNo)}
                                  className={`w-full h-7 text-[11px] rounded border text-center font-bold outline-none ${
                                    isLocked && isAdmin ? 'border-amber-500 ring-1 ring-amber-500' : ''
                                  } ${
                                    isDisabled
                                      ? 'bg-slate-200 dark:bg-slate-800 text-slate-500 cursor-not-allowed'
                                      : isDark ? 'bg-[#12383E] border-white/30 text-white' : 'bg-white border-[#CBD5E1] text-[#0F172A]'
                                  }`}
                                  placeholder="-"
                                />
                                {isLocked && (
                                  <span className="absolute right-0.5 top-0.5 text-[8px] text-amber-600 dark:text-amber-400">
                                    <Lock className="w-2.5 h-2.5" />
                                  </span>
                                )}
                              </div>
                            </td>
                          );
                        })}
                        <td className="border border-[#1E293B] p-1 text-center font-bold">-</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>

        {/* EDIT HISTORY DRAWER */}
        {showHistoryDrawer && (
          <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex justify-end">
            <div className={`w-full max-w-md h-full flex flex-col shadow-2xl ${
              isDark ? 'bg-[#103A40] text-white border-l border-white/10' : 'bg-white text-[#0F172A]'
            }`}>
              <div className="p-4 border-b border-current/20 flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-base flex items-center gap-2">
                    <History className="w-5 h-5 text-[#0F8B8D]" /> Edit History &amp; Audit
                  </h3>
                  <p className="text-xs text-[#475569] dark:text-slate-300">Detailed change log and per-hour submit timeline</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowHistoryDrawer(false)}
                  className="p-1 rounded-lg hover:bg-current/10"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Summary Cards */}
              <div className="p-4 grid grid-cols-3 gap-3 border-b border-current/10 bg-current/5">
                <div className="p-3 rounded-xl bg-white/5 border border-current/10 text-center">
                  <p className="text-[10px] font-bold uppercase text-[#475569] dark:text-slate-300">Draft Edits</p>
                  <p className="text-lg font-black text-[#0F8B8D] dark:text-[#2BA5B5] mt-1">{draftEditsCount}</p>
                </div>
                <div className="p-3 rounded-xl bg-white/5 border border-current/10 text-center">
                  <p className="text-[10px] font-bold uppercase text-[#475569] dark:text-slate-300">After-Submit</p>
                  <p className="text-lg font-black text-rose-500 mt-1">{afterSubmitEditsCount}</p>
                </div>
                <div className="p-3 rounded-xl bg-white/5 border border-current/10 text-center">
                  <p className="text-[10px] font-bold uppercase text-[#475569] dark:text-slate-300">Hours Locked</p>
                  <p className="text-lg font-black text-amber-500 mt-1">{hourLocks.length} / 10</p>
                </div>
              </div>

              {/* Submitted Hours Timeline */}
              <div className="p-4 border-b border-current/10 space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-[#475569] dark:text-slate-300">Hours Submitted Timeline</p>
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: 10 }).map((_, i) => {
                    const hrNo = i + 1;
                    const lock = hourLocks.find((l) => l.hour_no === hrNo);
                    return (
                      <div
                        key={hrNo}
                        className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 border ${
                          lock
                            ? 'bg-amber-500/20 text-amber-600 dark:text-amber-300 border-amber-500/40'
                            : 'bg-slate-200 dark:bg-white/5 text-slate-400 border-current/10'
                        }`}
                        title={lock ? `Submitted by ${lock.submitted_by_name} at ${new Date(lock.submitted_at).toLocaleTimeString()}` : 'Not submitted'}
                      >
                        <Lock className="w-3 h-3" />
                        <span>H{String(hrNo).padStart(2, '0')}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Filter */}
              <div className="p-4 flex items-center gap-2 border-b border-current/10">
                <span className="text-xs font-bold">Filter:</span>
                <button
                  type="button"
                  onClick={() => setHistoryFilter('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                    historyFilter === 'all' ? 'bg-[#0F8B8D] text-white' : 'bg-current/10'
                  }`}
                >
                  All Edits ({editLogs.length})
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryFilter('after_submit')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                    historyFilter === 'after_submit' ? 'bg-rose-600 text-white' : 'bg-current/10'
                  }`}
                >
                  Only After-Submit ({afterSubmitEditsCount})
                </button>
              </div>

              {/* Log List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {filteredEditLogs.length === 0 ? (
                  <p className="text-center text-xs text-[#475569] dark:text-slate-400 py-8">No edit logs found.</p>
                ) : (
                  filteredEditLogs.map((log) => (
                    <div key={log.id} className="p-3 rounded-xl border border-current/15 bg-white/5 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#0F8B8D] dark:text-[#2BA5B5]">{log.editor_name || 'User'}</span>
                        {log.after_submit && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-500/20 text-rose-500 border border-rose-500/30">
                            After-Submit
                          </span>
                        )}
                      </div>
                      <p className="text-[#475569] dark:text-slate-300">
                        Hour {String(log.hour_no).padStart(2, '0')} (Line {log.line_no}): <strong className="text-white">{log.old_value ?? '-'}</strong> → <strong className="text-emerald-400">{log.new_value ?? '-'}</strong>
                      </p>
                      <p className="text-[10px] text-slate-400">{new Date(log.edited_at).toLocaleString()}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default SewingReportEntry;
