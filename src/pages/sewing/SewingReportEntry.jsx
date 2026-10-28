/**
 * Sewing Hourly Production Report Entry Page (Per-Hour Lock Model)
 * Rupkatha Apparels Ltd. (src/pages/sewing/SewingReportEntry.jsx)
 * Supports per-part targets, live color-coding, Short/Excess, Remaining target & Management Summary.
 */
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
import {
  calculateLineHourTotals,
  calculatePartMetrics,
  calculatePartHourlyBreakdown,
  calculateManagementSummary,
  formatNum,
} from '../../lib/sewingCalc';
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
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Award,
  Layers,
  Copy,
} from 'lucide-react';
import toast from 'react-hot-toast';

const FIELD_LABEL_MAP = {
  back_hour_target: 'Back hour target',
  front_hour_target: 'Front hour target',
  output_hour_target: 'Out Put hour target',
  asm_hour_target: 'A.S.M hour target',
  working_hours: 'Working hours',
  back_qty: 'Back Qty',
  front_qty: 'Front Qty',
  output_qty: 'Out Put Qty',
  asm: 'A.S.M',
  op: 'O.P',
  hp: 'H.P',
  ir: 'I.R',
  buyer_name: 'Buyer Name',
  style_no: 'Style No',
  remarks: 'Remarks',
};

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

  const initLine = (lineNo) => ({
    lineNo,
    buyerName: '',
    styleNo: '',
    op: '',
    hp: '',
    ir: '',
    backHourTarget: '',
    frontHourTarget: '',
    outputHourTarget: '',
    asmHourTarget: '',
    workingHours: 8,
    remarks: '',
    hours: Array.from({ length: 10 }, (_, i) => ({
      hourNo: i + 1,
      backQty: '',
      frontQty: '',
      outputQty: '',
      asm: '',
    })),
  });

  const [lines, setLines] = useState([1, 2, 3, 4].map(initLine));
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
              backHourTarget: existingLine.back_hour_target !== null && existingLine.back_hour_target !== undefined ? existingLine.back_hour_target : '',
              frontHourTarget: existingLine.front_hour_target !== null && existingLine.front_hour_target !== undefined ? existingLine.front_hour_target : '',
              outputHourTarget: existingLine.output_hour_target !== null && existingLine.output_hour_target !== undefined ? existingLine.output_hour_target : '',
              asmHourTarget: existingLine.asm_hour_target !== null && existingLine.asm_hour_target !== undefined ? existingLine.asm_hour_target : '',
              workingHours: existingLine.working_hours !== null && existingLine.working_hours !== undefined ? existingLine.working_hours : 8,
              remarks: existingLine.remarks || '',
              hours: hoursArr,
            };
          } else {
            return initLine(lineNo);
          }
        });
        setLines(loadedLines);
      } else {
        setReportId(null);
        setHourLocks([]);
        setEditLogs([]);
        setLines([1, 2, 3, 4].map(initLine));
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
  }, [loadReportData]);

  // Unsaved changes warning when user navigates away or closes tab
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const handleSaveAll = async (linesToSave) => {
    const dataToSave = linesToSave || lines;
    try {
      setSaving(true);
      const res = await saveSewingReport({
        reportDate: date,
        factoryUnit,
        lines: dataToSave,
        createdByName: userName,
      });
      if (res?.reportId) {
        setReportId(res.reportId);
      }
      setLastSaved(new Date());
      setIsDirty(false);
      toast.success('All changes saved to database.');
      // Reload the saved values from server to keep cumulative & total calculations in sync
      await loadReportData();
      return true;
    } catch (err) {
      console.error('Save error detailed:', err);
      if (err?.message?.includes('RLS') || err?.message?.includes('locked')) {
        toast.error('This hour is submitted and locked. Changes reverted.');
        await loadReportData();
      } else {
        toast.error(err?.message || 'Failed to save data.');
      }
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleLineChange = (lineIndex, field, value) => {
    setLines((prevLines) => {
      const updatedLines = [...prevLines];
      updatedLines[lineIndex] = { ...updatedLines[lineIndex], [field]: value };
      setIsDirty(true);
      return updatedLines;
    });
  };

  const handleApplySameTarget = (lineIndex) => {
    const targetVal = lines[lineIndex].backHourTarget;
    const ok = window.confirm(
      `Copy Back hour target (${targetVal !== '' && targetVal !== null && targetVal !== undefined ? targetVal : 'blank'}) to Front, Out Put, and A.S.M?`
    );
    if (!ok) return;

    setLines((prevLines) => {
      const updatedLines = [...prevLines];
      updatedLines[lineIndex] = {
        ...updatedLines[lineIndex],
        frontHourTarget: targetVal,
        outputHourTarget: targetVal,
        asmHourTarget: targetVal,
      };
      setIsDirty(true);
      return updatedLines;
    });
    toast.success(`Copied Back target to Front, Out Put & A.S.M.`);
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

    setLines((prevLines) => {
      const updatedLines = [...prevLines];
      const updatedLine = { ...updatedLines[lineIndex] };
      const updatedHours = [...updatedLine.hours];
      updatedHours[hourIndex] = { ...updatedHours[hourIndex], [field]: value };
      updatedLine.hours = updatedHours;
      updatedLines[lineIndex] = updatedLine;
      setIsDirty(true);
      return updatedLines;
    });
  };

  // Check if an hour has data across any line
  const isHourFilled = (hourNo) => {
    return lines.some((l) => {
      const hr = l.hours.find((h) => h.hourNo === hourNo);
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
    if (isDirty) {
      const wantSave = window.confirm(`You have unsaved changes. Save all changes before submitting Hour ${String(hourNo).padStart(2, '0')}?`);
      if (!wantSave) return;
      const ok = await handleSaveAll(lines);
      if (!ok) return;
    }

    const currentReportId = reportId;
    if (!currentReportId) {
      toast.error('Report must be saved first.');
      return;
    }

    try {
      await submitHourLock(currentReportId, hourNo);
      const locks = await fetchHourLocks(currentReportId);
      setHourLocks(locks);
      toast.success(`Hour ${String(hourNo).padStart(2, '0')} submitted and locked successfully.`);
      await loadReportData();
    } catch (err) {
      toast.error(err?.message || 'Failed to submit hour lock.');
    }
  };

  const handleReopenHour = async (hourNo) => {
    if (!isAdmin) return;
    if (!window.confirm(`Reopen Hour ${String(hourNo).padStart(2, '0')} for regular editing?`)) return;

    try {
      await reopenHourLock(reportId, hourNo);
      const locks = await fetchHourLocks(reportId);
      setHourLocks(locks);
      toast.success(`Hour ${String(hourNo).padStart(2, '0')} reopened.`);
      await loadReportData();
    } catch (err) {
      toast.error(err?.message || 'Failed to reopen hour lock.');
    }
  };

  const handleSubmitAllFilled = async () => {
    const filledUnlockedHours = [];
    for (let h = 1; h <= 10; h++) {
      if (isHourFilled(h) && !hourLocks.some((l) => l.hour_no === h)) {
        filledUnlockedHours.push(h);
      }
    }

    if (filledUnlockedHours.length === 0) {
      toast('No unlocked filled hours found to submit.', { icon: 'ℹ️' });
      return;
    }

    if (isDirty) {
      const wantSave = window.confirm('You have unsaved changes. Save all changes before submitting all filled hours?');
      if (!wantSave) return;
      const ok = await handleSaveAll(lines);
      if (!ok) return;
    }

    const currentReportId = reportId;
    if (!currentReportId) {
      toast.error('Report must be saved first.');
      return;
    }

    if (!window.confirm(`Submit and lock ${filledUnlockedHours.length} filled hours (H${filledUnlockedHours.join(', H')})?`)) {
      return;
    }

    try {
      for (const h of filledUnlockedHours) {
        try {
          await submitHourLock(currentReportId, h);
        } catch (err) {
          console.error(`Failed to lock hour ${h}:`, err);
        }
      }
      const locks = await fetchHourLocks(currentReportId);
      setHourLocks(locks);
      toast.success('All filled hours submitted.');
      await loadReportData();
    } catch (err) {
      toast.error(err?.message || 'Failed to submit all filled hours.');
    }
  };

  // Memoized line calculations, hourly breakdowns & management summary
  const lineCalculations = useMemo(() => {
    return lines.map((line) => {
      const opVal = Number(line.op) || 0;
      const hpVal = Number(line.hp) || 0;
      const irVal = Number(line.ir) || 0;
      const totalManpower = opVal + hpVal + irVal;

      const { totalBack, totalFront, totalOutput, totalAsm } = calculateLineHourTotals(line.hours);
      const backBreakdown = calculatePartHourlyBreakdown(line, 'back');
      const frontBreakdown = calculatePartHourlyBreakdown(line, 'front');
      const outputBreakdown = calculatePartHourlyBreakdown(line, 'output');
      const asmBreakdown = calculatePartHourlyBreakdown(line, 'asm');

      // Find last hour with entered output
      let lastEnteredHourNo = 0;
      line.hours.forEach((h) => {
        if (h.outputQty !== '' && h.outputQty !== null && !isNaN(Number(h.outputQty))) {
          if (h.hourNo > lastEnteredHourNo) lastEnteredHourNo = h.hourNo;
        }
      });

      return {
        totalManpower,
        totalBack,
        totalFront,
        totalOutput,
        totalAsm,
        backBreakdown,
        frontBreakdown,
        outputBreakdown,
        asmBreakdown,
        lastEnteredHourNo,
      };
    });
  }, [lines]);

  // Day Management Summary
  const daySummary = useMemo(() => {
    return calculateManagementSummary(lines);
  }, [lines]);

  // Edit log counts & filtered items
  const draftEditsCount = editLogs.filter((l) => !l.after_submit).length;
  const afterSubmitEditsCount = editLogs.filter((l) => l.after_submit).length;
  const filteredEditLogs = editLogs.filter((l) => {
    if (historyFilter === 'after_submit') return l.after_submit;
    return true;
  });

  // Cell coloring helper
  const getCellStyling = (actualVal, hourTarget, isDisabled) => {
    if (isDisabled) {
      return {
        bgClass: 'bg-slate-200 dark:bg-slate-800 text-slate-500 cursor-not-allowed',
        badge: null,
      };
    }
    if (hourTarget === null || hourTarget === undefined || hourTarget === '' || isNaN(Number(hourTarget))) {
      return {
        bgClass: isDark ? 'bg-[#12383E] text-white border-white/20' : 'bg-white text-[#0F172A] border-[#CBD5E1]',
        badge: null,
      };
    }
    if (actualVal === null || actualVal === undefined || actualVal === '' || isNaN(Number(actualVal))) {
      return {
        bgClass: isDark ? 'bg-[#12383E] text-white border-white/20' : 'bg-white text-[#0F172A] border-[#CBD5E1]',
        badge: null,
      };
    }

    const act = Number(actualVal);
    const tgt = Number(hourTarget);
    const diff = act - tgt;

    if (diff < 0) {
      return {
        bgClass: isDark ? 'bg-red-950/70 text-red-200 border-red-500/60 font-semibold' : 'bg-[#FEE2E2] text-[#991B1B] border-red-300 font-semibold',
        badge: `${diff}`,
        badgeClass: isDark ? 'bg-red-900/80 text-red-100' : 'bg-red-200 text-red-900',
      };
    } else if (diff === 0) {
      return {
        bgClass: isDark ? 'bg-emerald-950/70 text-emerald-200 border-emerald-500/60 font-semibold' : 'bg-[#DCFCE7] text-[#166534] border-emerald-300 font-semibold',
        badge: '✓',
        badgeClass: isDark ? 'bg-emerald-900/80 text-emerald-100' : 'bg-emerald-200 text-emerald-900',
      };
    } else {
      return {
        bgClass: isDark ? 'bg-amber-950/70 text-amber-200 border-amber-500/60 font-semibold' : 'bg-[#FEF9C3] text-[#854D0E] border-amber-300 font-semibold',
        badge: `+${diff}`,
        badgeClass: isDark ? 'bg-amber-900/80 text-amber-100' : 'bg-amber-200 text-amber-900',
      };
    }
  };

  // Cumulative text color helper
  const getCumulativeColorClass = (cumActual, cumTarget) => {
    if (cumActual === null || cumTarget === null) {
      return 'text-[#0F8B8D] dark:text-[#2BA5B5]';
    }
    if (cumActual < cumTarget) {
      return isDark ? 'text-red-400 font-bold' : 'text-red-700 font-bold';
    } else if (cumActual === cumTarget) {
      return isDark ? 'text-emerald-400 font-bold' : 'text-emerald-700 font-bold';
    } else {
      return isDark ? 'text-amber-400 font-bold' : 'text-amber-700 font-bold';
    }
  };

  // Total cell display helper
  const renderTotalCell = (actualTotal, totalTarget) => {
    if (actualTotal === null) {
      return <span className="text-slate-400">-</span>;
    }
    if (totalTarget === null || totalTarget <= 0) {
      return <span className="font-bold font-mono">{actualTotal}</span>;
    }
    const diff = actualTotal - totalTarget;
    if (diff < 0) {
      return (
        <span className={isDark ? 'text-red-400 font-black' : 'text-red-700 font-black'}>
          {actualTotal} <span className="text-[10px]">({diff})</span>
        </span>
      );
    } else if (diff === 0) {
      return (
        <span className={isDark ? 'text-emerald-400 font-black' : 'text-emerald-700 font-black'}>
          {actualTotal} <span className="text-[10px]">(✓)</span>
        </span>
      );
    } else {
      return (
        <span className={isDark ? 'text-amber-400 font-black' : 'text-amber-700 font-black'}>
          {actualTotal} <span className="text-[10px]">(+{diff})</span>
        </span>
      );
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* TOP CONTROLS & DATE/UNIT SELECTION */}
        <div
          className={`p-6 rounded-2xl border shadow-sm ${
            isDark ? 'bg-[#103A40] border-white/25 text-white' : 'bg-white border-[#1E293B] text-[#0F172A]'
          }`}
        >
          <div className="flex items-center justify-between gap-4 pb-4 border-b border-current/20">
            <div className="flex flex-col gap-1">
              <h2 className={`text-xl font-extrabold ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>
                {companyName}
              </h2>
              <h1 className="text-2xl font-black tracking-tight text-[#0F8B8D] dark:text-[#2BA5B5]">
                HOURLY PRODUCTION REPORT
              </h1>
              <p className="text-sm text-[#475569] dark:text-slate-300">
                {companyName} · {factoryUnit.toUpperCase()} UNIT · {date}
              </p>
            </div>
            <div className="text-right flex items-center gap-4 justify-end">
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
                <span>
                  Unit: <strong className="uppercase">{factoryUnit} Sewing</strong>
                </span>
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
              {saving && (
                <span className="text-xs text-[#0F8B8D] dark:text-[#2BA5B5] animate-pulse font-bold flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 animate-spin" /> Saving...
                </span>
              )}
              {!saving && isDirty && (
                <span className="text-xs text-amber-500 dark:text-amber-400 font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  Unsaved changes
                </span>
              )}
              {!saving && !isDirty && (
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> All changes saved
                </span>
              )}

              <button
                type="button"
                disabled={saving}
                onClick={() => handleSaveAll(lines)}
                className="px-3.5 py-1.5 text-xs font-bold rounded bg-slate-700 hover:bg-slate-800 text-white disabled:opacity-50 transition-colors cursor-pointer shadow-sm flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{saving ? 'Saving...' : 'Save All Changes'}</span>
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleSubmitAllFilled}
                className="px-3 py-1.5 text-xs font-bold rounded bg-[#0F8B8D] text-white hover:bg-[#0b6d6f] disabled:opacity-50 transition-colors cursor-pointer shadow-sm flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Submit All Filled Hours</span>
              </button>
            </div>
          </div>
        </div>

        {/* TOP MANAGEMENT VIEW: DAY SUMMARY CARD */}
        <div
          className={`p-5 rounded-2xl border shadow-sm ${
            isDark ? 'bg-[#0D3137] border-white/20 text-white' : 'bg-white border-slate-300 text-slate-900'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-4 border-b border-current/15 gap-2">
            <div>
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#0F8B8D]" />
                <h3 className="font-extrabold text-sm uppercase tracking-wider text-[#0F8B8D] dark:text-[#2BA5B5]">
                  Top Management Overview · দৈনিক সুইং লক্ষ্যমাত্রা ও ঘাটতি সারসংক্ষেপ
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Target vs Actual achievement &amp; Shortage tracking across all 4 production lines
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs">
              {daySummary.bestLine && (
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-bold flex items-center gap-1">
                  <Award className="w-3.5 h-3.5" /> Best: Line 0{daySummary.bestLine.lineNo} ({daySummary.bestLine.output.achievement}%)
                </span>
              )}
              {daySummary.worstLine && daySummary.worstLine.lineNo !== daySummary.bestLine?.lineNo && (
                <span className="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30 font-bold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Shortest: Line 0{daySummary.worstLine.lineNo} ({daySummary.worstLine.output.achievement}%)
                </span>
              )}
            </div>
          </div>

          {/* 4 KPI Part Cards: Out Put, Back, Front, A.S.M */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {[
              { key: 'output', label: 'Out Put (সর্বমোট সমাপ্ত পোশাক)', color: '#0F8B8D' },
              { key: 'back', label: 'Back Part (ব্যাক পার্ট)', color: '#3B82F6' },
              { key: 'front', label: 'Front Part (ফ্রন্ট পার্ট)', color: '#8B5CF6' },
              { key: 'asm', label: 'A.S.M (অ্যাসেম্বলি)', color: '#F59E0B' },
            ].map(({ key, label }) => {
              const partData = daySummary.byPart[key] || {};
              const hasTgt = partData.totalTarget !== null;
              const isShort = partData.status === 'short';
              const isAchieved = partData.status === 'achieved';
              const isExcess = partData.status === 'excess';

              return (
                <div
                  key={key}
                  className={`p-4 rounded-xl border ${
                    isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{label}</span>
                    {hasTgt ? (
                      <span
                        className={`text-[11px] font-black px-2 py-0.5 rounded-full ${
                          isShort
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200'
                            : isAchieved
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
                        }`}
                      >
                        {partData.achievement !== null ? `${partData.achievement}% Achieved` : 'Pending'}
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-bold">No Target Set</span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-mono mt-2">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase">Target:</span>
                      <p className="font-extrabold text-sm">{partData.totalTarget !== null ? formatNum(partData.totalTarget) : '-'}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase">Actual:</span>
                      <p className="font-extrabold text-sm text-[#0F8B8D] dark:text-[#2BA5B5]">
                        {partData.totalActual !== null ? formatNum(partData.totalActual) : '-'}
                      </p>
                    </div>
                  </div>

                  {hasTgt && (
                    <div className="mt-2.5 pt-2 border-t border-current/10 flex items-center justify-between text-xs font-semibold">
                      {isShort && (
                        <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1 font-bold">
                          <TrendingDown className="w-3.5 h-3.5" /> Short {formatNum(partData.shortQty)} pcs ({partData.shortPct}%)
                        </span>
                      )}
                      {isAchieved && (
                        <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-bold">
                          <Check className="w-3.5 h-3.5" /> 100% Target Met
                        </span>
                      )}
                      {isExcess && (
                        <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1 font-bold">
                          <TrendingUp className="w-3.5 h-3.5" /> Excess +{formatNum(partData.shortExcessQty)} pcs
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Line By Line Performance Table */}
          <div className="overflow-x-auto border border-current/15 rounded-xl">
            <table className="w-full text-xs font-mono text-left">
              <thead className={isDark ? 'bg-[#0B2E33] text-slate-300' : 'bg-slate-100 text-slate-700'}>
                <tr>
                  <th className="p-2 border-r border-current/10 text-center">Line</th>
                  <th className="p-2 border-r border-current/10">Buyer / Style</th>
                  <th className="p-2 border-r border-current/10 text-center">Working Hrs</th>
                  <th className="p-2 border-r border-current/10 text-center">Out Put Target</th>
                  <th className="p-2 border-r border-current/10 text-center">Actual Output</th>
                  <th className="p-2 border-r border-current/10 text-center">Ach%</th>
                  <th className="p-2 border-r border-current/10 text-center">Short / Excess</th>
                  <th className="p-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-current/10">
                {daySummary.lines.map((lSum) => {
                  const m = lSum.output;
                  const hasTgt = m.totalTarget !== null;

                  let statusBadge = <span className="text-slate-400 font-normal">No Target</span>;
                  if (hasTgt) {
                    if (m.status === 'short') {
                      statusBadge = (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-600 dark:text-rose-300 border border-rose-500/30">
                          SHORT {m.shortPct}%
                        </span>
                      );
                    } else if (m.status === 'achieved') {
                      statusBadge = (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30">
                          ACHIEVED
                        </span>
                      );
                    } else if (m.status === 'excess') {
                      statusBadge = (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/30">
                          EXCESS +{m.shortExcessQty}
                        </span>
                      );
                    } else {
                      statusBadge = <span className="text-slate-400">Pending</span>;
                    }
                  }

                  return (
                    <tr
                      key={lSum.lineNo}
                      className={`hover:bg-white/5 transition-colors ${
                        daySummary.bestLine?.lineNo === lSum.lineNo ? 'bg-emerald-500/5' : ''
                      }`}
                    >
                      <td className="p-2 border-r border-current/10 text-center font-bold">
                        Line 0{lSum.lineNo}
                      </td>
                      <td className="p-2 border-r border-current/10 font-medium">
                        {lSum.buyer} · {lSum.style}
                      </td>
                      <td className="p-2 border-r border-current/10 text-center font-bold">
                        {m.workingHours} hrs
                      </td>
                      <td className="p-2 border-r border-current/10 text-center font-bold">
                        {m.totalTarget !== null ? formatNum(m.totalTarget) : '-'}
                      </td>
                      <td className="p-2 border-r border-current/10 text-center font-bold text-[#0F8B8D] dark:text-[#2BA5B5]">
                        {m.totalActual !== null ? formatNum(m.totalActual) : '-'}
                      </td>
                      <td className="p-2 border-r border-current/10 text-center font-bold">
                        {m.achievement !== null ? `${m.achievement}%` : '-'}
                      </td>
                      <td className="p-2 border-r border-current/10 text-center font-bold">
                        {m.shortExcessQty !== null ? (
                          m.shortExcessQty < 0 ? (
                            <span className="text-rose-600 dark:text-rose-400">{m.shortExcessQty} pcs</span>
                          ) : m.shortExcessQty === 0 ? (
                            <span className="text-emerald-600 dark:text-emerald-400">0</span>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-400">+{m.shortExcessQty} pcs</span>
                          )
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="p-2 text-center">{statusBadge}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 4 PRODUCTION LINE TABLES */}
        <div className="space-y-6">
          {lines.map((line, lineIdx) => {
            const {
              totalManpower,
              totalBack,
              totalFront,
              totalOutput,
              totalAsm,
              backBreakdown,
              frontBreakdown,
              outputBreakdown,
              asmBreakdown,
              lastEnteredHourNo,
            } = lineCalculations[lineIdx];

            const outMetrics = outputBreakdown.metrics;
            const backMetrics = backBreakdown.metrics;
            const frontMetrics = frontBreakdown.metrics;
            const asmMetrics = asmBreakdown.metrics;

            // Short badge logic
            const workingHours = line.workingHours || 8;
            const isFinishedWorkingHours = lastEnteredHourNo >= workingHours;

            let mainAlertBadge = null;
            if (outMetrics.totalTarget !== null && outMetrics.status === 'short') {
              if (isFinishedWorkingHours) {
                mainAlertBadge = (
                  <span className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-extrabold text-xs shadow-xs flex items-center gap-1.5 animate-pulse">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    SHORT {Math.abs(outMetrics.shortExcessQty)} pcs
                  </span>
                );
              } else if (lastEnteredHourNo > 0) {
                // Short so far based on cumulative target up to last entered hour
                const cumTgtSoFar = (outMetrics.hourTarget || 0) * Math.min(lastEnteredHourNo, workingHours);
                const actualSoFar = line.hours
                  .slice(0, lastEnteredHourNo)
                  .reduce((s, h) => s + (Number(h.outputQty) || 0), 0);
                if (actualSoFar < cumTgtSoFar) {
                  const shortSoFar = cumTgtSoFar - actualSoFar;
                  mainAlertBadge = (
                    <span className="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-600 dark:text-rose-300 border border-rose-500/40 font-bold text-xs flex items-center gap-1.5">
                      <TrendingDown className="w-3.5 h-3.5" />
                      Short so far: {shortSoFar} pcs
                    </span>
                  );
                }
              }
            }

            return (
              <div
                key={line.lineNo}
                className={`p-4 rounded-2xl border shadow-sm ${
                  isDark ? 'bg-[#103A40] border-white/25 text-white' : 'bg-white border-[#1E293B] text-[#0F172A]'
                }`}
              >
                {/* LINE HEADER WITH WORKING HOURS SELECTOR & TARGET SUMMARY BADGES */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-3 px-1 gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="font-extrabold text-sm uppercase tracking-wider text-[#0F8B8D] dark:text-[#2BA5B5]">
                      Line 0{line.lineNo} Production Register
                    </h3>

                    {/* Working hours selector */}
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg border border-current/20 text-xs font-bold">
                      <Clock className="w-3.5 h-3.5 text-[#0F8B8D]" />
                      <span>Working Hours:</span>
                      <select
                        value={line.workingHours || 8}
                        onChange={(e) => handleLineChange(lineIdx, 'workingHours', parseInt(e.target.value, 10))}
                        className={`font-mono font-black rounded px-1.5 py-0.5 outline-none cursor-pointer ${
                          isDark ? 'bg-[#0B2E33] text-white' : 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((h) => (
                          <option key={h} value={h}>
                            {h} hrs
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Helper to copy Back target to Front & Out Put */}
                    <button
                      type="button"
                      title="Apply Back hour target to Front and Out Put"
                      onClick={() => handleApplySameTarget(lineIdx)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-lg bg-teal-500/10 hover:bg-teal-500/20 text-[#0F8B8D] dark:text-[#2BA5B5] border border-[#0F8B8D]/30 transition-colors cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Apply Back Target to All</span>
                    </button>
                  </div>

                  {/* Summary Chips: Target vs Actual, Shortage */}
                  <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                    <div className="px-2 py-1 rounded bg-black/5 dark:bg-white/5 border border-current/10 font-bold">
                      Total MP: {totalManpower > 0 ? totalManpower : '-'}
                    </div>

                    <div className="px-2 py-1 rounded bg-[#0F8B8D]/10 text-[#0F8B8D] dark:text-[#2BA5B5] border border-[#0F8B8D]/25 font-bold">
                      Total Output: {totalOutput !== null ? totalOutput : '-'}
                    </div>

                    {outMetrics.totalTarget !== null && (
                      <div
                        className={`px-2.5 py-1 rounded-lg border font-bold text-xs flex items-center gap-1.5 ${
                          outMetrics.status === 'short'
                            ? isDark
                              ? 'bg-red-950/60 border-red-800 text-red-200'
                              : 'bg-red-50 border-red-300 text-red-800'
                            : outMetrics.status === 'achieved'
                            ? isDark
                              ? 'bg-emerald-950/60 border-emerald-800 text-emerald-200'
                              : 'bg-emerald-50 border-emerald-300 text-emerald-800'
                            : isDark
                            ? 'bg-amber-950/60 border-amber-800 text-amber-200'
                            : 'bg-amber-50 border-amber-300 text-amber-800'
                        }`}
                      >
                        <span>Target {outMetrics.totalTarget}</span>
                        <span>|</span>
                        <span>Actual {outMetrics.totalActual ?? 0}</span>
                        <span>|</span>
                        <span>Ach {outMetrics.achievement ?? 0}%</span>
                        <span>|</span>
                        {outMetrics.status === 'short' && (
                          <span className="font-extrabold text-rose-600 dark:text-rose-400">
                            Short {Math.abs(outMetrics.shortExcessQty)} pcs ({outMetrics.shortPct}%)
                          </span>
                        )}
                        {outMetrics.status === 'achieved' && (
                          <span className="font-extrabold text-emerald-600 dark:text-emerald-400">Achieved 100%</span>
                        )}
                        {outMetrics.status === 'excess' && (
                          <span className="font-extrabold text-amber-600 dark:text-amber-400">
                            Excess +{outMetrics.shortExcessQty} pcs ({outMetrics.excessPct}%)
                          </span>
                        )}
                      </div>
                    )}

                    {asmMetrics.totalTarget !== null && (
                      <div
                        className={`px-2.5 py-1 rounded-lg border font-bold text-xs flex items-center gap-1.5 ${
                          asmMetrics.status === 'short'
                            ? isDark
                              ? 'bg-red-950/60 border-red-800 text-red-200'
                              : 'bg-red-50 border-red-300 text-red-800'
                            : asmMetrics.status === 'achieved'
                            ? isDark
                              ? 'bg-emerald-950/60 border-emerald-800 text-emerald-200'
                              : 'bg-emerald-50 border-emerald-300 text-emerald-800'
                            : isDark
                            ? 'bg-amber-950/60 border-amber-800 text-amber-200'
                            : 'bg-amber-50 border-amber-300 text-amber-800'
                        }`}
                      >
                        <span>A.S.M Tgt {asmMetrics.totalTarget}</span>
                        <span>|</span>
                        <span>Act {asmMetrics.totalActual ?? 0}</span>
                        <span>|</span>
                        <span>Ach {asmMetrics.achievement ?? 0}%</span>
                        <span>|</span>
                        {asmMetrics.status === 'short' && (
                          <span className="font-extrabold text-rose-600 dark:text-rose-400">
                            Short {Math.abs(asmMetrics.shortExcessQty)} pcs ({asmMetrics.shortPct}%)
                          </span>
                        )}
                        {asmMetrics.status === 'achieved' && (
                          <span className="font-extrabold text-emerald-600 dark:text-emerald-400">Achieved 100%</span>
                        )}
                        {asmMetrics.status === 'excess' && (
                          <span className="font-extrabold text-amber-600 dark:text-amber-400">
                            Excess +{asmMetrics.shortExcessQty} pcs ({asmMetrics.excessPct}%)
                          </span>
                        )}
                      </div>
                    )}

                    {mainAlertBadge}
                  </div>
                </div>

                {/* THE MAIN REGISTER GRID */}
                <div className="overflow-x-auto">
                  <table
                    className="w-full border-collapse text-xs font-mono"
                    style={{ tableLayout: 'fixed', minWidth: '1420px', border: '1px solid #1E293B' }}
                  >
                    <thead>
                      <tr className={isDark ? 'bg-[#0B2E33] text-slate-200' : 'bg-[#F1F5F9] text-[#0F172A]'}>
                        <th className="p-2 border border-[#1E293B] font-extrabold text-center" style={{ width: '105px' }}>
                          Buyer Name
                        </th>
                        <th className="p-2 border border-[#1E293B] font-extrabold text-center" style={{ width: '95px' }}>
                          Style No
                        </th>
                        <th className="p-2 border border-[#1E293B] font-extrabold text-center" style={{ width: '85px' }}>
                          Order / MP
                        </th>
                        <th className="p-2 border border-[#1E293B] font-extrabold text-center" style={{ width: '48px' }}>
                          Line
                        </th>
                        <th className="p-2 border border-[#1E293B] font-extrabold text-center" style={{ width: '70px' }}>
                          Parts
                        </th>
                        <th className="p-2 border border-[#1E293B] font-extrabold text-center" style={{ width: '80px' }}>
                          <div>Hour Target</div>
                          <div className="text-[9px] text-[#0F8B8D] dark:text-[#2BA5B5] font-bangla font-normal leading-[1.6]">
                            লক্ষ্যমাত্রা/ঘণ্টা
                          </div>
                        </th>
                        <th className="p-2 border border-[#1E293B] font-extrabold text-center" style={{ width: '80px' }}>
                          <div>Total Target</div>
                          <div className="text-[9px] text-[#0F8B8D] dark:text-[#2BA5B5] font-bangla font-normal leading-[1.6]">
                            মোট লক্ষ্য
                          </div>
                        </th>

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
                                  ? isDark
                                    ? 'bg-amber-950/40 text-amber-200'
                                    : 'bg-amber-50 text-amber-900'
                                  : ''
                              }`}
                              style={{ width: '68px' }}
                            >
                              <div className="flex items-center justify-between text-[10px] pb-0.5 border-b border-current/20 mb-1">
                                <span>{String(hourNo).padStart(2, '0')}</span>
                                {isLockedHour ? (
                                  <span
                                    title={`Submitted by ${lockObj.submitted_by_name || 'Admin'} at ${new Date(
                                      lockObj.submitted_at
                                    ).toLocaleTimeString()}`}
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
                                        if (
                                          !window.confirm(
                                            'Warning: An earlier hour has data and is not submitted. Proceed?'
                                          )
                                        )
                                          return;
                                      }
                                      if (
                                        window.confirm(
                                          `Submit Hour ${String(hourNo).padStart(
                                            2,
                                            '0'
                                          )}? After submit only admin can edit.`
                                        )
                                      ) {
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
                              <div className="text-[9px] font-bangla text-[#0F8B8D] dark:text-[#2BA5B5] font-normal leading-[1.6]">
                                ঘণ্টা
                              </div>
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

                        <th className="p-2 border border-[#1E293B] font-extrabold text-center" style={{ width: '85px' }}>
                          <div>Total</div>
                          <div className="text-[9px] text-[#0F8B8D] dark:text-[#2BA5B5] font-bangla font-normal leading-[1.6]">মোট</div>
                        </th>
                        <th className="p-2 border border-[#1E293B] font-extrabold text-center" style={{ width: '130px' }}>
                          <div>Remarks</div>
                          <div className="text-[9px] text-[#475569] dark:text-slate-400 font-bangla font-normal leading-[1.6]">
                            মন্তব্য
                          </div>
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {/* ROW 1: BACK */}
                      <tr className={isDark ? 'bg-[#0B2E33]/40' : 'bg-[#F8FAFC]'}>
                        <td rowSpan={4} className="border border-[#1E293B] p-1 align-middle text-center">
                          <input
                            type="text"
                            placeholder="-"
                            value={line.buyerName}
                            onChange={(e) => handleLineChange(lineIdx, 'buyerName', e.target.value)}
                            className={`w-full px-2 py-1.5 text-xs rounded border text-center font-bold outline-none ${
                              isDark ? 'bg-[#12383E] border-[#1E293B] text-white' : 'bg-white border-[#1E293B] text-[#0F172A]'
                            }`}
                          />
                        </td>
                        <td rowSpan={4} className="border border-[#1E293B] p-1 align-middle text-center">
                          <input
                            type="text"
                            placeholder="-"
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
                              className={`w-11 px-1 py-0.5 rounded border text-center font-bold outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
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
                              className={`w-11 px-1 py-0.5 rounded border text-center font-bold outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
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
                              className={`w-11 px-1 py-0.5 rounded border text-center font-bold outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                                isDark ? 'bg-[#12383E] border-white/30 text-white' : 'bg-white border-[#CBD5E1] text-[#0F172A]'
                              }`}
                            />
                          </div>
                          <div className="pt-1 border-t border-[#1E293B]/30 text-center font-extrabold text-[11px] text-[#0F8B8D] dark:text-[#2BA5B5]">
                            Tot: {totalManpower > 0 ? totalManpower : '-'}
                          </div>
                        </td>
                        <td rowSpan={4} className="border border-[#1E293B] p-1 align-middle text-center font-black text-base">
                          0{line.lineNo}
                        </td>
                        <td className="border border-[#1E293B] p-1.5 font-extrabold text-center">Back</td>

                        {/* Back Hour Target */}
                        <td className="border border-[#1E293B] p-1 align-middle text-center">
                          <input
                            type="number"
                            inputMode="numeric"
                            placeholder="-"
                            value={line.backHourTarget}
                            onChange={(e) => handleLineChange(lineIdx, 'backHourTarget', e.target.value)}
                            className={`w-full px-1 py-1.5 text-xs rounded border text-center font-bold outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                              isDark ? 'bg-[#12383E] border-white/30 text-white' : 'bg-white border-[#CBD5E1] text-[#0F172A]'
                            }`}
                          />
                        </td>

                        {/* Back Total Target = backHourTarget * workingHours */}
                        <td className="border border-[#1E293B] p-1 align-middle text-center font-black text-xs">
                          {backMetrics.totalTarget !== null ? backMetrics.totalTarget : '-'}
                        </td>

                        {/* Back 10 Hours */}
                        {line.hours.map((hr, hrIdx) => {
                          const isLocked = hourLocks.some((l) => l.hour_no === hr.hourNo);
                          const isDisabled = isLocked && !isAdmin;
                          const hBreak = backBreakdown.hourly[hrIdx] || {};
                          const cellStyle = getCellStyling(hr.backQty, backMetrics.hourTarget, isDisabled);
                          const cumColor = getCumulativeColorClass(hBreak.cumActual, hBreak.cumTarget);

                          return (
                            <td
                              key={hrIdx}
                              className={`border border-[#1E293B] p-1 text-center align-middle ${
                                isLocked ? 'bg-amber-500/10' : ''
                              }`}
                            >
                              <div className="relative">
                                <input
                                  type="number"
                                  inputMode="numeric"
                                  disabled={isDisabled}
                                  value={hr.backQty}
                                  onFocus={(e) => e.target.select()}
                                  onChange={(e) => handleHourChange(lineIdx, hrIdx, 'backQty', e.target.value, hr.hourNo)}
                                  className={`w-full h-7 text-xs rounded border text-center font-bold outline-none tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                                    isLocked && isAdmin ? 'border-amber-500 ring-1 ring-amber-500' : ''
                                  } ${cellStyle.bgClass}`}
                                />
                                {cellStyle.badge && (
                                  <span
                                    className={`absolute left-0.5 top-0.5 text-[8px] px-0.5 rounded font-extrabold ${cellStyle.badgeClass}`}
                                  >
                                    {cellStyle.badge}
                                  </span>
                                )}
                                {isLocked && (
                                  <span className="absolute right-0.5 top-0.5 text-[8px] text-amber-600 dark:text-amber-400">
                                    <Lock className="w-2.5 h-2.5" />
                                  </span>
                                )}
                              </div>
                              <div
                                className={`text-[10px] font-mono mt-0.5 border-t border-dashed border-[#1E293B]/20 pt-0.5 min-h-[16px] text-center ${cumColor}`}
                              >
                                {hBreak.cumActual !== null ? `Σ ${hBreak.cumActual}` : ''}
                              </div>
                            </td>
                          );
                        })}

                        {/* Back Total */}
                        <td className="border border-[#1E293B] p-1 text-center font-bold font-mono">
                          {renderTotalCell(totalBack, backMetrics.totalTarget)}
                        </td>

                        {/* Remarks */}
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

                        {/* Front Hour Target */}
                        <td className="border border-[#1E293B] p-1 align-middle text-center">
                          <input
                            type="number"
                            inputMode="numeric"
                            placeholder="-"
                            value={line.frontHourTarget}
                            onChange={(e) => handleLineChange(lineIdx, 'frontHourTarget', e.target.value)}
                            className={`w-full px-1 py-1.5 text-xs rounded border text-center font-bold outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                              isDark ? 'bg-[#12383E] border-white/30 text-white' : 'bg-white border-[#CBD5E1] text-[#0F172A]'
                            }`}
                          />
                        </td>

                        {/* Front Total Target = frontHourTarget * workingHours */}
                        <td className="border border-[#1E293B] p-1 align-middle text-center font-black text-xs">
                          {frontMetrics.totalTarget !== null ? frontMetrics.totalTarget : '-'}
                        </td>

                        {/* Front 10 Hours */}
                        {line.hours.map((hr, hrIdx) => {
                          const isLocked = hourLocks.some((l) => l.hour_no === hr.hourNo);
                          const isDisabled = isLocked && !isAdmin;
                          const hBreak = frontBreakdown.hourly[hrIdx] || {};
                          const cellStyle = getCellStyling(hr.frontQty, frontMetrics.hourTarget, isDisabled);
                          const cumColor = getCumulativeColorClass(hBreak.cumActual, hBreak.cumTarget);

                          return (
                            <td
                              key={hrIdx}
                              className={`border border-[#1E293B] p-1 text-center align-middle ${
                                isLocked ? 'bg-amber-500/10' : ''
                              }`}
                            >
                              <div className="relative">
                                <input
                                  type="number"
                                  inputMode="numeric"
                                  disabled={isDisabled}
                                  value={hr.frontQty}
                                  onFocus={(e) => e.target.select()}
                                  onChange={(e) => handleHourChange(lineIdx, hrIdx, 'frontQty', e.target.value, hr.hourNo)}
                                  className={`w-full h-7 text-xs rounded border text-center font-bold outline-none tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                                    isLocked && isAdmin ? 'border-amber-500 ring-1 ring-amber-500' : ''
                                  } ${cellStyle.bgClass}`}
                                />
                                {cellStyle.badge && (
                                  <span
                                    className={`absolute left-0.5 top-0.5 text-[8px] px-0.5 rounded font-extrabold ${cellStyle.badgeClass}`}
                                  >
                                    {cellStyle.badge}
                                  </span>
                                )}
                                {isLocked && (
                                  <span className="absolute right-0.5 top-0.5 text-[8px] text-amber-600 dark:text-amber-400">
                                    <Lock className="w-2.5 h-2.5" />
                                  </span>
                                )}
                              </div>
                              <div
                                className={`text-[10px] font-mono mt-0.5 border-t border-dashed border-[#1E293B]/20 pt-0.5 min-h-[16px] text-center ${cumColor}`}
                              >
                                {hBreak.cumActual !== null ? `Σ ${hBreak.cumActual}` : ''}
                              </div>
                            </td>
                          );
                        })}

                        {/* Front Total */}
                        <td className="border border-[#1E293B] p-1 text-center font-bold font-mono">
                          {renderTotalCell(totalFront, frontMetrics.totalTarget)}
                        </td>
                      </tr>

                      {/* ROW 3: OUT PUT */}
                      <tr className={isDark ? 'bg-[#103A40]/80' : 'bg-[#ECFEFF]'}>
                        <td className="border border-[#1E293B] p-1.5 font-extrabold text-center text-[#0F8B8D]">Out Put</td>

                        {/* Out Put Hour Target */}
                        <td className="border border-[#1E293B] p-1 align-middle text-center">
                          <input
                            type="number"
                            inputMode="numeric"
                            placeholder="-"
                            value={line.outputHourTarget}
                            onChange={(e) => handleLineChange(lineIdx, 'outputHourTarget', e.target.value)}
                            className={`w-full px-1 py-1.5 text-xs rounded border text-center font-bold outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                              isDark ? 'bg-[#12383E] border-white/30 text-white' : 'bg-white border-[#CBD5E1] text-[#0F172A]'
                            }`}
                          />
                        </td>

                        {/* Out Put Total Target = outputHourTarget * workingHours */}
                        <td className="border border-[#1E293B] p-1 align-middle text-center font-black text-xs text-[#0F8B8D] dark:text-[#2BA5B5]">
                          {outMetrics.totalTarget !== null ? outMetrics.totalTarget : '-'}
                        </td>

                        {/* Out Put 10 Hours */}
                        {line.hours.map((hr, hrIdx) => {
                          const isLocked = hourLocks.some((l) => l.hour_no === hr.hourNo);
                          const isDisabled = isLocked && !isAdmin;
                          const hBreak = outputBreakdown.hourly[hrIdx] || {};
                          const cellStyle = getCellStyling(hr.outputQty, outMetrics.hourTarget, isDisabled);
                          const cumColor = getCumulativeColorClass(hBreak.cumActual, hBreak.cumTarget);

                          return (
                            <td
                              key={hrIdx}
                              className={`border border-[#1E293B] p-1 text-center align-middle ${
                                isLocked ? 'bg-amber-500/10' : ''
                              }`}
                            >
                              <div className="relative">
                                <input
                                  type="number"
                                  inputMode="numeric"
                                  disabled={isDisabled}
                                  value={hr.outputQty}
                                  onFocus={(e) => e.target.select()}
                                  onChange={(e) => handleHourChange(lineIdx, hrIdx, 'outputQty', e.target.value, hr.hourNo)}
                                  className={`w-full h-7 text-xs rounded border text-center font-bold outline-none tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                                    isLocked && isAdmin ? 'border-amber-500 ring-1 ring-amber-500' : ''
                                  } ${cellStyle.bgClass}`}
                                />
                                {cellStyle.badge && (
                                  <span
                                    className={`absolute left-0.5 top-0.5 text-[8px] px-0.5 rounded font-extrabold ${cellStyle.badgeClass}`}
                                  >
                                    {cellStyle.badge}
                                  </span>
                                )}
                                {isLocked && (
                                  <span className="absolute right-0.5 top-0.5 text-[8px] text-amber-600 dark:text-amber-400">
                                    <Lock className="w-2.5 h-2.5" />
                                  </span>
                                )}
                              </div>
                              <div
                                className={`text-[10px] font-mono mt-0.5 border-t border-dashed border-[#1E293B]/20 pt-0.5 min-h-[16px] text-center ${cumColor}`}
                              >
                                {hBreak.cumActual !== null ? `Σ ${hBreak.cumActual}` : ''}
                              </div>
                            </td>
                          );
                        })}

                        {/* Out Put Total */}
                        <td className="border border-[#1E293B] p-1 text-center font-extrabold font-mono text-[#0F8B8D] dark:text-[#2BA5B5]">
                          {renderTotalCell(totalOutput, outMetrics.totalTarget)}
                        </td>
                      </tr>

                      {/* ROW 4: A.S.M */}
                      <tr className={isDark ? 'bg-[#2A2415]/60' : 'bg-[#FFFBEB]'}>
                        <td className="border border-[#1E293B] p-1.5 font-extrabold text-center">A.S.M</td>

                        {/* A.S.M Hour Target */}
                        <td className="border border-[#1E293B] p-1 align-middle text-center">
                          <input
                            type="number"
                            inputMode="numeric"
                            placeholder="-"
                            value={line.asmHourTarget}
                            onChange={(e) => handleLineChange(lineIdx, 'asmHourTarget', e.target.value)}
                            className={`w-full px-1 py-1.5 text-xs rounded border text-center font-bold outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                              isDark ? 'bg-[#12383E] border-white/30 text-white' : 'bg-white border-[#CBD5E1] text-[#0F172A]'
                            }`}
                          />
                        </td>

                        {/* A.S.M Total Target = asmHourTarget * workingHours */}
                        <td className="border border-[#1E293B] p-1 align-middle text-center font-black text-xs">
                          {asmMetrics.totalTarget !== null ? asmMetrics.totalTarget : '-'}
                        </td>

                        {/* A.S.M 10 Hours */}
                        {line.hours.map((hr, hrIdx) => {
                          const isLocked = hourLocks.some((l) => l.hour_no === hr.hourNo);
                          const isDisabled = isLocked && !isAdmin;
                          const hBreak = asmBreakdown.hourly[hrIdx] || {};
                          const cellStyle = getCellStyling(hr.asm, asmMetrics.hourTarget, isDisabled);
                          const cumColor = getCumulativeColorClass(hBreak.cumActual, hBreak.cumTarget);

                          return (
                            <td
                              key={hrIdx}
                              className={`border border-[#1E293B] p-1 text-center align-middle ${
                                isLocked ? 'bg-amber-500/10' : ''
                              }`}
                            >
                              <div className="relative">
                                <input
                                  type="number"
                                  inputMode="numeric"
                                  disabled={isDisabled}
                                  value={hr.asm}
                                  onFocus={(e) => e.target.select()}
                                  onChange={(e) => handleHourChange(lineIdx, hrIdx, 'asm', e.target.value, hr.hourNo)}
                                  className={`w-full h-7 text-xs rounded border text-center font-bold outline-none tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                                    isLocked && isAdmin ? 'border-amber-500 ring-1 ring-amber-500' : ''
                                  } ${cellStyle.bgClass}`}
                                  placeholder="-"
                                />
                                {cellStyle.badge && (
                                  <span
                                    className={`absolute left-0.5 top-0.5 text-[8px] px-0.5 rounded font-extrabold ${cellStyle.badgeClass}`}
                                  >
                                    {cellStyle.badge}
                                  </span>
                                )}
                                {isLocked && (
                                  <span className="absolute right-0.5 top-0.5 text-[8px] text-amber-600 dark:text-amber-400">
                                    <Lock className="w-2.5 h-2.5" />
                                  </span>
                                )}
                              </div>
                              <div
                                className={`text-[10px] font-mono mt-0.5 border-t border-dashed border-[#1E293B]/20 pt-0.5 min-h-[16px] text-center ${cumColor}`}
                              >
                                {hBreak.cumActual !== null ? `Σ ${hBreak.cumActual}` : ''}
                              </div>
                            </td>
                          );
                        })}

                        {/* A.S.M Total */}
                        <td className="border border-[#1E293B] p-1 text-center font-bold font-mono">
                          {renderTotalCell(totalAsm, asmMetrics.totalTarget)}
                        </td>
                      </tr>

                      {/* GROUP 1: HOUR SHORT / EXCESS (প্রতি ঘণ্টা) - Main, bold, placed first */}
                      {['back', 'front', 'output', 'asm'].map((pKey, pIdx) => {
                        const breakdown =
                          pKey === 'back'
                            ? backBreakdown
                            : pKey === 'front'
                            ? frontBreakdown
                            : pKey === 'asm'
                            ? asmBreakdown
                            : outputBreakdown;
                        const partLabel =
                          pKey === 'back'
                            ? 'Back'
                            : pKey === 'front'
                            ? 'Front'
                            : pKey === 'asm'
                            ? 'A.S.M'
                            : 'Out Put';
                        const stripeClass =
                          pKey === 'back'
                            ? 'border-l-4 border-blue-500 text-blue-600 dark:text-blue-400'
                            : pKey === 'front'
                            ? 'border-l-4 border-purple-500 text-purple-600 dark:text-purple-400'
                            : pKey === 'asm'
                            ? 'border-l-4 border-amber-500 text-amber-600 dark:text-amber-400'
                            : 'border-l-4 border-[#0F8B8D] text-[#0F8B8D] dark:text-[#2BA5B5]';
                        const metrics = breakdown.metrics;

                        return (
                          <tr
                            key={`hour_short_${pKey}`}
                            className={
                              isDark
                                ? pKey === 'output'
                                  ? 'bg-rose-950/30'
                                  : 'bg-white/[0.04]'
                                : pKey === 'output'
                                ? 'bg-rose-50/70'
                                : 'bg-slate-50'
                            }
                          >
                            {pIdx === 0 && (
                              <td
                                rowSpan={4}
                                colSpan={4}
                                className="border border-[#1E293B] p-2 text-center align-middle font-black text-xs text-rose-600 dark:text-rose-400 bg-rose-500/10"
                              >
                                <div className="font-extrabold text-xs tracking-tight">HOUR SHORT / EXCESS</div>
                                <div className="text-[10px] font-bangla font-semibold leading-[1.6]">প্রতি ঘণ্টা</div>
                              </td>
                            )}
                            <td className={`border border-[#1E293B] p-1 text-center font-extrabold text-xs ${stripeClass}`}>
                              {partLabel}
                            </td>
                            <td className="border border-[#1E293B] p-1 text-center font-mono text-slate-400 text-xs">-</td>
                            <td className="border border-[#1E293B] p-1 text-center font-mono text-slate-400 text-xs">-</td>

                            {/* 10 Hourly Short/Excess values */}
                            {breakdown.hourly.map((hBreak, hIdx) => {
                              const diff = hBreak.hourDiff;
                              let displayVal = '-';
                              let colorClass = 'text-slate-400';

                              if (diff !== null) {
                                if (diff < 0) {
                                  displayVal = `${diff}`;
                                  colorClass = isDark
                                    ? 'bg-rose-950/70 text-rose-300 font-black'
                                    : 'bg-rose-100 text-rose-700 font-black';
                                } else if (diff === 0) {
                                  displayVal = '0';
                                  colorClass = isDark
                                    ? 'bg-emerald-950/70 text-emerald-300 font-black'
                                    : 'bg-emerald-100 text-emerald-700 font-black';
                                } else {
                                  displayVal = `+${diff}`;
                                  colorClass = isDark
                                    ? 'bg-amber-950/70 text-amber-300 font-black'
                                    : 'bg-amber-100 text-amber-700 font-black';
                                }
                              }

                              return (
                                <td
                                  key={hIdx}
                                  title={hBreak.tooltip || undefined}
                                  className={`border border-[#1E293B] p-1 text-center align-middle font-mono text-xs ${colorClass}`}
                                >
                                  {displayVal}
                                </td>
                              );
                            })}

                            {/* Total Column = SUM of entered hours differences */}
                            <td className="border border-[#1E293B] p-1 text-center font-black font-mono text-xs align-middle">
                              {breakdown.sumHourDiff !== null ? (
                                breakdown.sumHourDiff < 0 ? (
                                  <span className="text-rose-600 dark:text-rose-400 font-black">{breakdown.sumHourDiff}</span>
                                ) : breakdown.sumHourDiff === 0 ? (
                                  <span className="text-emerald-600 dark:text-emerald-400 font-black">0</span>
                                ) : (
                                  <span className="text-amber-600 dark:text-amber-400 font-black">+{breakdown.sumHourDiff}</span>
                                )
                              ) : (
                                '-'
                              )}
                              {breakdown.missingHoursCount > 0 && breakdown.enteredHoursCount > 0 && (
                                <div className="text-[9px] text-slate-500 dark:text-slate-400 font-normal leading-tight mt-0.5 font-sans">
                                  {breakdown.missingHoursCount} hours not entered
                                </div>
                              )}
                            </td>

                            {/* Remarks column */}
                            {pIdx === 0 && (
                              <td
                                rowSpan={4}
                                className="border border-[#1E293B] p-1 text-center align-middle text-[10px] text-slate-500 font-mono"
                              >
                                {outputBreakdown.metrics.status === 'short' && (
                                  <div className="text-rose-600 dark:text-rose-400 font-bold">
                                    Short {Math.abs(outputBreakdown.metrics.shortExcessQty)} pcs
                                    <div className="text-[9px] text-slate-400">({outputBreakdown.metrics.shortPct}%)</div>
                                  </div>
                                )}
                                {outputBreakdown.metrics.status === 'achieved' && (
                                  <div className="text-emerald-600 dark:text-emerald-400 font-bold">100% Target Met</div>
                                )}
                                {outputBreakdown.metrics.status === 'excess' && (
                                  <div className="text-amber-600 dark:text-amber-400 font-bold">
                                    +{outputBreakdown.metrics.shortExcessQty} pcs Excess
                                  </div>
                                )}
                                {outputBreakdown.metrics.status === 'pending' && (
                                  <span className="text-slate-400">Pending</span>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })}

                      {/* GROUP 2: RUNNING SHORT / EXCESS (জমা) - Cumulative logic, smaller/muted */}
                      {['back', 'front', 'output', 'asm'].map((pKey, pIdx) => {
                        const breakdown =
                          pKey === 'back'
                            ? backBreakdown
                            : pKey === 'front'
                            ? frontBreakdown
                            : pKey === 'asm'
                            ? asmBreakdown
                            : outputBreakdown;
                        const partLabel =
                          pKey === 'back'
                            ? 'Back'
                            : pKey === 'front'
                            ? 'Front'
                            : pKey === 'asm'
                            ? 'A.S.M'
                            : 'Out Put';
                        const stripeClass =
                          pKey === 'back'
                            ? 'border-l-2 border-blue-400 text-blue-500 dark:text-blue-400/80'
                            : pKey === 'front'
                            ? 'border-l-2 border-purple-400 text-purple-500 dark:text-purple-400/80'
                            : pKey === 'asm'
                            ? 'border-l-2 border-amber-400 text-amber-500 dark:text-amber-400/80'
                            : 'border-l-2 border-[#0F8B8D]/80 text-[#0F8B8D] dark:text-[#2BA5B5]/80';
                        const metrics = breakdown.metrics;

                        return (
                          <tr
                            key={`run_short_${pKey}`}
                            className={
                              isDark
                                ? 'bg-slate-900/30'
                                : 'bg-slate-50/50'
                            }
                          >
                            {pIdx === 0 && (
                              <td
                                rowSpan={4}
                                colSpan={4}
                                className="border border-[#1E293B] p-1.5 text-center align-middle font-bold text-[11px] text-slate-500 dark:text-slate-400 bg-slate-500/5"
                              >
                                <div className="font-bold text-[11px]">RUNNING SHORT / EXCESS</div>
                                <div className="text-[9px] font-bangla font-medium leading-[1.6]">জমা</div>
                              </td>
                            )}
                            <td className={`border border-[#1E293B] p-1 text-center font-bold text-[10px] ${stripeClass}`}>
                              {partLabel}
                            </td>
                            <td className="border border-[#1E293B] p-1 text-center font-mono text-slate-400 text-[10px]">-</td>
                            <td className="border border-[#1E293B] p-1 text-center font-mono text-slate-400 text-[10px]">-</td>

                            {/* 10 Hourly Running Short/Excess values */}
                            {breakdown.hourly.map((hBreak, hIdx) => {
                              const s = hBreak.shortExcess;
                              let displayVal = '-';
                              let colorClass = 'text-slate-400';

                              if (s !== null) {
                                if (s < 0) {
                                  displayVal = `${s}`;
                                  colorClass = 'text-rose-600/85 dark:text-rose-400/85 font-bold';
                                } else if (s === 0) {
                                  displayVal = '0';
                                  colorClass = 'text-emerald-600/85 dark:text-emerald-400/85 font-bold';
                                } else {
                                  displayVal = `+${s}`;
                                  colorClass = 'text-amber-600/85 dark:text-amber-400/85 font-bold';
                                }
                              }

                              return (
                                <td
                                  key={hIdx}
                                  className={`border border-[#1E293B] p-1 text-center align-middle font-mono text-[10px] ${colorClass}`}
                                >
                                  {displayVal}
                                </td>
                              );
                            })}

                            {/* Final Cumulative Total */}
                            <td className="border border-[#1E293B] p-1 text-center font-bold font-mono text-[11px]">
                              {metrics.shortExcessQty !== null ? (
                                metrics.shortExcessQty < 0 ? (
                                  <span className="text-rose-600/90 dark:text-rose-400/90">{metrics.shortExcessQty}</span>
                                ) : metrics.shortExcessQty === 0 ? (
                                  <span className="text-emerald-600/90 dark:text-emerald-400/90">0</span>
                                ) : (
                                  <span className="text-amber-600/90 dark:text-amber-400/90">+{metrics.shortExcessQty}</span>
                                )
                              ) : (
                                '-'
                              )}
                            </td>

                            {/* Remarks column for running short/excess */}
                            {pIdx === 0 && (
                              <td
                                rowSpan={4}
                                className="border border-[#1E293B] p-1 text-center align-middle text-[9px] text-slate-400 font-mono"
                              >
                                Cumulative status
                              </td>
                            )}
                          </tr>
                        );
                      })}

                      {/* COMPACT SECTION: REMAINING TARGET (বাকি) */}
                      {['back', 'front', 'output', 'asm'].map((pKey, pIdx) => {
                        const breakdown =
                          pKey === 'back'
                            ? backBreakdown
                            : pKey === 'front'
                            ? frontBreakdown
                            : pKey === 'asm'
                            ? asmBreakdown
                            : outputBreakdown;
                        const partLabel =
                          pKey === 'back'
                            ? 'Back'
                            : pKey === 'front'
                            ? 'Front'
                            : pKey === 'asm'
                            ? 'A.S.M'
                            : 'Out Put';
                        const metrics = breakdown.metrics;

                        return (
                          <tr
                            key={`rem_${pKey}`}
                            className={
                              isDark
                                ? pKey === 'output'
                                  ? 'bg-blue-950/20'
                                  : 'bg-white/[0.01]'
                                : pKey === 'output'
                                ? 'bg-cyan-50/50'
                                : 'bg-slate-50/50'
                            }
                          >
                            {pIdx === 0 && (
                              <td
                                rowSpan={4}
                                colSpan={4}
                                className="border border-[#1E293B] p-2 text-center align-middle font-black text-xs text-blue-600 dark:text-blue-400 bg-blue-500/10"
                              >
                                <div>REMAINING TARGET</div>
                                <div className="text-[10px] font-bangla font-semibold leading-[1.6]">বাকি লক্ষ্য</div>
                              </td>
                            )}
                            <td className="border border-[#1E293B] p-1 text-center font-bold text-[11px]">{partLabel}</td>
                            <td className="border border-[#1E293B] p-1 text-center font-mono text-slate-400">-</td>
                            <td className="border border-[#1E293B] p-1 text-center font-mono text-slate-400">-</td>

                            {/* 10 Hourly Remaining values */}
                            {breakdown.hourly.map((hBreak, hIdx) => {
                              const r = hBreak.remaining;
                              return (
                                <td
                                  key={hIdx}
                                  className="border border-[#1E293B] p-1 text-center align-middle font-mono text-[11px] font-semibold text-slate-700 dark:text-slate-300"
                                >
                                  {r !== null ? r : '-'}
                                </td>
                              );
                            })}

                            {/* Final Remaining Total */}
                            <td className="border border-[#1E293B] p-1 text-center font-black font-mono text-xs text-slate-800 dark:text-slate-200">
                              {metrics.totalTarget !== null
                                ? Math.max(0, metrics.totalTarget - (metrics.totalActual || 0))
                                : '-'}
                            </td>

                            {/* Blank remarks cell for remaining */}
                            {pIdx === 0 && (
                              <td
                                rowSpan={4}
                                className="border border-[#1E293B] p-1 text-center align-middle text-[10px] text-slate-400"
                              ></td>
                            )}
                          </tr>
                        );
                      })}
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
            <div
              className={`w-full max-w-md h-full flex flex-col shadow-2xl ${
                isDark ? 'bg-[#103A40] text-white border-l border-white/10' : 'bg-white text-[#0F172A]'
              }`}
            >
              <div className="p-4 border-b border-current/20 flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-base flex items-center gap-2">
                    <History className="w-5 h-5 text-[#0F8B8D]" /> Edit History &amp; Audit
                  </h3>
                  <p className="text-xs text-[#475569] dark:text-slate-300">
                    Detailed change log including targets and per-hour submit timeline
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowHistoryDrawer(false)}
                  className="p-1 rounded-lg hover:bg-current/10 cursor-pointer"
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
                <p className="text-xs font-bold uppercase tracking-wider text-[#475569] dark:text-slate-300">
                  Hours Submitted Timeline
                </p>
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
                        title={
                          lock
                            ? `Submitted by ${lock.submitted_by_name} at ${new Date(lock.submitted_at).toLocaleTimeString()}`
                            : 'Not submitted'
                        }
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
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                    historyFilter === 'all' ? 'bg-[#0F8B8D] text-white' : 'bg-current/10'
                  }`}
                >
                  All Edits ({editLogs.length})
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryFilter('after_submit')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
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
                  filteredEditLogs.map((log) => {
                    const fieldLabel = FIELD_LABEL_MAP[log.field_name] || log.field_name || 'Field';
                    return (
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
                          Line {log.line_no}
                          {log.hour_no ? ` · Hour ${String(log.hour_no).padStart(2, '0')}` : ''} ·{' '}
                          <span className="font-semibold text-slate-200">{fieldLabel}</span>:{' '}
                          <strong className="text-slate-400">{log.old_value ?? '-'}</strong> →{' '}
                          <strong className="text-emerald-400">{log.new_value ?? '-'}</strong>
                        </p>
                        <p className="text-[10px] text-slate-400">{new Date(log.edited_at).toLocaleString()}</p>
                      </div>
                    );
                  })
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
