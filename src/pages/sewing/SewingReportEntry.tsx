/**
 * Sewing Hourly Production Report Entry Page (Per-Hour Lock Model)
 * Rupkatha Apparels Ltd. (src/pages/sewing/SewingReportEntry.tsx)
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  fetchFinishingReports,
  saveFinishingReport,
} from '../../lib/finishingQueries';
import {
  calculateLineHourTotals,
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
  History,
  CheckCircle2,
  Clock,
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

const FIELD_LABEL_MAP: Record<string, string> = {
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
  line_chief_name: 'Line Chief name',
  line_chief_phone: 'Line Chief mobile',
  order_qty: 'Order Qty',
};

export const SewingReportEntry: React.FC = () => {
  const { isDark } = useTheme();
  const { companyName } = useCompany();
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const userName = profile?.full_name || profile?.email || 'ERP User';

  const getBdtDate = () => new Date().toISOString().split('T')[0];

  const [date, setDate] = useState(getBdtDate());
  const [factoryUnit, setFactoryUnit] = useState<'knit' | 'woven'>('knit');
  const [reportId, setReportId] = useState<string | null>(null);

  const initLine = (lineNo: number) => ({
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
    lineChiefName: '',
    lineChiefPhone: '',
    hours: Array.from({ length: 10 }, (_, i) => ({
      hourNo: i + 1,
      backQty: '',
      frontQty: '',
      outputQty: '',
      asm: '',
    })),
    orderQty: '',
  });

  const initFinishingLine = () => ({
    buyerName: '',
    styleNo: '',
    orderQty: '',
    op: '',
    hp: '',
    ir: '',
    qualityMan: '',
    foldingMan: '',
    polyMan: '',
    packingMan: '',
    backHourTarget: '', // Inside
    frontHourTarget: '', // Iron
    outputHourTarget: '', // Top Side
    asmHourTarget: '', // Poly
    workingHours: 8,
    remarks: '',
    lineChiefName: '',
    lineChiefPhone: '',
    hours: Array.from({ length: 10 }, (_, i) => ({
      hourNo: i + 1,
      backQty: '',
      frontQty: '',
      outputQty: '',
      asm: '',
    })),
  });

  const [lines, setLines] = useState<any[]>([1, 2, 3, 4].map(initLine));
  const [finishingLine, setFinishingLine] = useState<any>(initFinishingLine());
  const [finishingReportId, setFinishingReportId] = useState<string | null>(null);
  const [hourLocks, setHourLocks] = useState<any[]>([]);
  const [editLogs, setEditLogs] = useState<any[]>([]);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<'all' | 'after_submit'>('all');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [adminWarnedSession, setAdminWarnedSession] = useState(false);

  // DEBUG: Track why state resets
  const logReset = (reason: string) => {
    console.log(`[SewingReportEntry] DRAFT RESET because: ${reason} (Date: ${date}, Unit: ${factoryUnit})`);
  };

  const loadReportData = useCallback(async (isInitialLoad = false) => {
    setLoading(true);
    if (isInitialLoad) logReset('Initial Load / Switch');
    try {
      const [sewingReports, finishingReports] = await Promise.all([
        fetchSewingReports({ date, unit: factoryUnit }),
        fetchFinishingReports({ date, unit: factoryUnit })
      ]);

      const matchedSewing = sewingReports.find((r: any) => r.report_date === date && r.factory_unit === factoryUnit);
      const matchedFinishing = finishingReports.find((r: any) => r.report_date === date && r.factory_unit === factoryUnit);

      // --- HANDLE SEWING DATA ---
      if (matchedSewing) {
        setReportId(matchedSewing.id);
        const [locks, logs] = await Promise.all([
          fetchHourLocks(matchedSewing.id),
          fetchEditLogs(matchedSewing.id)
        ]);
        setHourLocks(locks);
        setEditLogs(logs);

        const loadedLines = [1, 2, 3, 4].map((lineNo) => {
          const existingLine = (matchedSewing.lines || []).find((l: any) => l.line_no === lineNo);
          if (existingLine) {
            const hoursArr = Array.from({ length: 10 }, (_, i) => {
              const hrNo = i + 1;
              const foundHr = (existingLine.hours || []).find((h: any) => h.hour_no === hrNo);
              return {
                hourNo: hrNo,
                backQty: foundHr && foundHr.back_qty !== null ? String(foundHr.back_qty) : '',
                frontQty: foundHr && foundHr.front_qty !== null ? String(foundHr.front_qty) : '',
                outputQty: foundHr && foundHr.output_qty !== null ? String(foundHr.output_qty) : '',
                asm: foundHr && foundHr.asm ? String(foundHr.asm) : '',
              };
            });
            return {
              lineNo,
              buyerName: existingLine.buyer_name || '',
              styleNo: existingLine.style_no || '',
              op: existingLine.op !== null ? String(existingLine.op) : '',
              hp: existingLine.hp !== null ? String(existingLine.hp) : '',
              ir: existingLine.ir !== null ? String(existingLine.ir) : '',
              backHourTarget: existingLine.back_hour_target !== null ? String(existingLine.back_hour_target) : '',
              frontHourTarget: existingLine.front_hour_target !== null ? String(existingLine.front_hour_target) : '',
              outputHourTarget: existingLine.output_hour_target !== null ? String(existingLine.output_hour_target) : '',
              asmHourTarget: existingLine.asm_hour_target !== null ? String(existingLine.asm_hour_target) : '',
              workingHours: existingLine.working_hours ?? 8,
              remarks: existingLine.remarks || '',
              lineChiefName: existingLine.line_chief_name || '',
              lineChiefPhone: existingLine.line_chief_phone || '',
              orderQty: existingLine.order_qty !== null ? String(existingLine.order_qty) : '',
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

      // --- HANDLE FINISHING DATA ---
      if (matchedFinishing) {
        setFinishingReportId(matchedFinishing.id);
        const fLine = (matchedFinishing.lines || []).find((l: any) => l.line_no === 1);
        if (fLine) {
          const fHoursArr = Array.from({ length: 10 }, (_, i) => {
            const hrNo = i + 1;
            const foundHr = (fLine.hours || []).find((h: any) => h.hour_no === hrNo);
            return {
              hourNo: hrNo,
              backQty: foundHr && foundHr.back_qty !== null ? String(foundHr.back_qty) : '',
              frontQty: foundHr && foundHr.front_qty !== null ? String(foundHr.front_qty) : '',
              outputQty: foundHr && foundHr.output_qty !== null ? String(foundHr.output_qty) : '',
              asm: foundHr && foundHr.asm !== null ? String(foundHr.asm) : '',
            };
          });
          setFinishingLine({
            buyerName: fLine.buyer_name || '',
            styleNo: fLine.style_no || '',
            orderQty: fLine.order_qty !== null ? String(fLine.order_qty) : '',
            op: fLine.op !== null ? String(fLine.op) : '',
            hp: fLine.hp !== null ? String(fLine.hp) : '',
            ir: fLine.ir !== null ? String(fLine.ir) : '',
            qualityMan: fLine.quality_man !== null ? String(fLine.quality_man) : '',
            foldingMan: fLine.folding_man !== null ? String(fLine.folding_man) : '',
            polyMan: fLine.poly_man !== null ? String(fLine.poly_man) : '',
            packingMan: fLine.packing_man !== null ? String(fLine.packing_man) : '',
            backHourTarget: fLine.back_hour_target !== null ? String(fLine.back_hour_target) : '',
            frontHourTarget: fLine.front_hour_target !== null ? String(fLine.front_hour_target) : '',
            outputHourTarget: fLine.output_hour_target !== null ? String(fLine.output_hour_target) : '',
            asmHourTarget: fLine.asm_hour_target !== null ? String(fLine.asm_hour_target) : '',
            workingHours: fLine.working_hours ?? 8,
            remarks: fLine.remarks || '',
            lineChiefName: fLine.line_chief_name || '',
            lineChiefPhone: fLine.line_chief_phone || '',
            hours: fHoursArr,
          });
        } else {
          setFinishingLine(initFinishingLine());
        }
      } else {
        setFinishingReportId(null);
        setFinishingLine(initFinishingLine());
      }

      setIsDirty(false);
    } catch (err) {
      console.error('Failed to load report:', err);
    } finally {
      setLoading(false);
    }
  }, [date, factoryUnit]);

  useEffect(() => {
    loadReportData(true);
  }, [date, factoryUnit]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const handleSaveAll = async (linesToSave?: any[], finishingLineToSave?: any) => {
    const dataToSave = linesToSave || lines;
    const finDataToSave = finishingLineToSave || finishingLine;
    
    setSaving(true);
    try {
      // Run both saves
      const [sewingRes, finishingRes] = await Promise.all([
        saveSewingReport({
          reportDate: date,
          factoryUnit,
          lines: dataToSave,
          createdByName: userName,
        }),
        saveFinishingReport({
          reportDate: date,
          factoryUnit,
          line: finDataToSave,
          createdByName: userName,
        })
      ]);

      if (sewingRes?.reportId) {
        setReportId(sewingRes.reportId);
        // Refresh sewing locks/logs
        const [locks, logs] = await Promise.all([
          fetchHourLocks(sewingRes.reportId),
          fetchEditLogs(sewingRes.reportId)
        ]);
        setHourLocks(locks);
        setEditLogs(logs);
      }

      if (finishingRes?.reportId) {
        setFinishingReportId(finishingRes.reportId);
      }

      setIsDirty(false);
      toast.success('All changes (Sewing & Finishing) saved to database.');
      return true;
    } catch (err: any) {
      console.error('Save error detailed:', err);
      if (err?.message?.includes('RLS') || err?.message?.includes('locked')) {
        toast.error('One or more hours are submitted and locked. Changes reverted.');
        await loadReportData(false);
      } else {
        toast.error(err?.message || 'Failed to save data.');
      }
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleLineChange = (lineIndex: number, field: string, value: any) => {
    // If any hour is locked, restrict line-level settings for non-admins
    const hasAnyLock = hourLocks.length > 0;
    if (hasAnyLock && !isAdmin) {
      toast.error('Hours are already submitted. Line settings are locked for non-admins.');
      return;
    }

    setLines((prevLines) => {
      const updatedLines = [...prevLines];
      updatedLines[lineIndex] = { ...updatedLines[lineIndex], [field]: value };
      setIsDirty(true);
      return updatedLines;
    });
  };

  const handleApplySameTarget = (lineIndex: number) => {
    const hasAnyLock = hourLocks.length > 0;
    if (hasAnyLock && !isAdmin) {
      toast.error('Hours are already submitted. Targets are locked for non-admins.');
      return;
    }

    const targetVal = lines[lineIndex].backHourTarget;
    const ok = window.confirm(
      `Copy Back hour target (${targetVal !== '' ? targetVal : 'blank'}) to Front, Out Put, and A.S.M?`
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

  const handleHourChange = (lineIndex: number, hourIndex: number, field: string, value: any, hourNo: number) => {
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

  const handleFinishingLineChange = (field: string, value: any) => {
    const hasAnyLock = hourLocks.length > 0;
    if (hasAnyLock && !isAdmin) {
      toast.error('Hours are already submitted. Line settings are locked for non-admins.');
      return;
    }
    setFinishingLine((prev: any) => {
      setIsDirty(true);
      return { ...prev, [field]: value };
    });
  };

  const handleFinishingHourChange = (hourIndex: number, field: string, value: any, hourNo: number) => {
    const isHourLocked = hourLocks.some((l) => l.hour_no === hourNo);
    if (isHourLocked && !isAdmin) {
      toast.error(`Hour ${String(hourNo).padStart(2, '0')} is submitted and locked. Contact admin.`);
      return;
    }
    setFinishingLine((prev: any) => {
      const updatedHours = [...prev.hours];
      updatedHours[hourIndex] = { ...updatedHours[hourIndex], [field]: value };
      setIsDirty(true);
      return { ...prev, hours: updatedHours };
    });
  };

  const isHourFilled = (hourNo: number) => {
    return lines.some((l) => {
      const hr = l.hours.find((h: any) => h.hourNo === hourNo);
      return hr && ((hr.backQty !== '' && hr.backQty !== null) || (hr.frontQty !== '' && hr.frontQty !== null) || (hr.outputQty !== '' && hr.outputQty !== null));
    });
  };

  const handleSubmitHour = async (hourNo: number) => {
    if (isDirty) {
      const wantSave = window.confirm(`You have unsaved changes. Save all changes before submitting Hour ${String(hourNo).padStart(2, '0')}?`);
      if (!wantSave) return;
      const ok = await handleSaveAll(lines);
      if (!ok) return;
    }

    if (!reportId) {
      toast.error('Report must be saved first.');
      return;
    }

    try {
      await submitHourLock(reportId, hourNo);
      const locks = await fetchHourLocks(reportId);
      setHourLocks(locks);
      toast.success(`Hour ${String(hourNo).padStart(2, '0')} submitted and locked successfully.`);
      // No full reload of lines here, just the locks
    } catch (err: any) {
      toast.error(err?.message || 'Failed to submit hour lock.');
    }
  };

  const handleReopenHour = async (hourNo: number) => {
    if (!isAdmin || !reportId) return;
    if (!window.confirm(`Reopen Hour ${String(hourNo).padStart(2, '0')} for regular editing?`)) return;

    try {
      await reopenHourLock(reportId, hourNo);
      const locks = await fetchHourLocks(reportId);
      setHourLocks(locks);
      toast.success(`Hour ${String(hourNo).padStart(2, '0')} reopened.`);
      // No full reload of lines here, just the locks
    } catch (err: any) {
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

    if (!reportId) {
      toast.error('Report must be saved first.');
      return;
    }

    if (!window.confirm(`Submit and lock ${filledUnlockedHours.length} filled hours (H${filledUnlockedHours.join(', H')})?`)) {
      return;
    }

    try {
      for (const h of filledUnlockedHours) {
        try {
          await submitHourLock(reportId, h);
        } catch (err) {
          console.error(`Failed to lock hour ${h}:`, err);
        }
      }
      const locks = await fetchHourLocks(reportId);
      setHourLocks(locks);
      toast.success('All filled hours submitted.');
      // No full reload of lines here, just the locks
    } catch (err: any) {
      toast.error(err?.message || 'Failed to submit all filled hours.');
    }
  };

  const finishingCalculations = useMemo(() => {
    const fl = finishingLine;
    const opVal = Number(fl.op) || 0;
    const hpVal = Number(fl.hp) || 0;
    const irVal = Number(fl.ir) || 0;
    const qVal = Number(fl.qualityMan) || 0;
    const fVal = Number(fl.foldingMan) || 0;
    const poVal = Number(fl.polyMan) || 0;
    const paVal = Number(fl.packingMan) || 0;
    const totalManpower = opVal + hpVal + irVal + qVal + fVal + poVal + paVal;

    const { totalBack, totalFront, totalOutput, totalAsm } = calculateLineHourTotals(fl.hours);
    const insideBreakdown = calculatePartHourlyBreakdown(fl, 'back'); // Inside -> back
    const ironBreakdown = calculatePartHourlyBreakdown(fl, 'front'); // Iron -> front
    const topSideBreakdown = calculatePartHourlyBreakdown(fl, 'output'); // Top Side -> output
    const polyBreakdown = calculatePartHourlyBreakdown(fl, 'asm'); // Poly -> asm

    return {
      totalManpower,
      totalInside: totalBack,
      totalIron: totalFront,
      totalTopSide: totalOutput,
      totalPoly: totalAsm,
      insideBreakdown,
      ironBreakdown,
      topSideBreakdown,
      polyBreakdown,
    };
  }, [finishingLine]);

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

      let lastEnteredHourNo = 0;
      line.hours.forEach((h: any) => {
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

  const daySummary = useMemo(() => {
    return calculateManagementSummary(lines);
  }, [lines]);

  const draftEditsCount = editLogs.filter((l) => !l.after_submit).length;
  const afterSubmitEditsCount = editLogs.filter((l) => l.after_submit).length;
  const filteredEditLogs = editLogs.filter((l) => {
    if (historyFilter === 'after_submit') return l.after_submit;
    return true;
  });

  const getCellStyling = (actualVal: any, hourTarget: any, isDisabled: boolean) => {
    if (isDisabled) {
      return {
        bgClass: 'bg-slate-200 dark:bg-slate-800 text-slate-500 cursor-not-allowed',
        badge: null,
      };
    }
    if (!hourTarget || isNaN(Number(hourTarget)) || !actualVal || isNaN(Number(actualVal))) {
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

  const getCumulativeColorClass = (cumActual: any, cumTarget: any) => {
    if (cumActual === null || cumTarget === null) return 'text-[#0F8B8D] dark:text-[#2BA5B5]';
    if (cumActual < cumTarget) return isDark ? 'text-red-400 font-bold' : 'text-red-700 font-bold';
    if (cumActual === cumTarget) return isDark ? 'text-emerald-400 font-bold' : 'text-emerald-700 font-bold';
    return isDark ? 'text-amber-400 font-bold' : 'text-amber-700 font-bold';
  };

  const renderTotalCell = (actualTotal: any, totalTarget: any) => {
    if (actualTotal === null) return <span className="text-slate-400">-</span>;
    if (!totalTarget || totalTarget <= 0) return <span className="font-bold font-mono">{actualTotal}</span>;
    const diff = actualTotal - totalTarget;
    if (diff < 0) {
      return <span className={isDark ? 'text-red-400 font-black' : 'text-red-700 font-black'}>{actualTotal} <span className="text-[10px]">({diff})</span></span>;
    } else if (diff === 0) {
      return <span className={isDark ? 'text-emerald-400 font-black' : 'text-emerald-700 font-black'}>{actualTotal} <span className="text-[10px]">(✓)</span></span>;
    } else {
      return <span className={isDark ? 'text-amber-400 font-black' : 'text-amber-700 font-black'}>{actualTotal} <span className="text-[10px]">(+{diff})</span></span>;
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* TOP CONTROLS - STICKY */}
        <div className={`sticky top-0 z-40 p-6 rounded-2xl border shadow-md ${isDark ? 'bg-[#103A40]/95 border-white/25 text-white' : 'bg-white/95 border-[#1E293B] text-[#0F172A]'} backdrop-blur-sm`}>
          <div className="flex items-center justify-between gap-4 pb-4 border-b border-current/20">
            <div className="flex flex-col gap-1">
              <h2 className={`text-xl font-extrabold ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>{companyName}</h2>
              <h1 className="text-2xl font-black tracking-tight text-[#0F8B8D] dark:text-[#2BA5B5]">HOURLY PRODUCTION REPORT</h1>
              <p className="text-sm text-[#475569] dark:text-slate-300">{companyName} · {factoryUnit.toUpperCase()} UNIT · {date}</p>
            </div>
            <button onClick={() => setShowHistoryDrawer(true)} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-[#0F8B8D]/15 text-[#0F8B8D] dark:text-[#2BA5B5] border border-[#0F8B8D]/30 hover:bg-[#0F8B8D]/25 transition-colors cursor-pointer">
              <History className="w-4 h-4" />
              <span>Edit History ({editLogs.length})</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-4">
            <div className="flex flex-wrap items-center gap-6 text-xs font-semibold">
              <div className="flex items-center gap-2">
                <Factory className="w-4 h-4 text-[#0F8B8D]" />
                <span>Unit: <strong className="uppercase">{factoryUnit} Sewing</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#0F8B8D]" />
                <input type="date" value={date ?? ''} onChange={(e) => setDate(e.target.value)} className={`px-2 py-1 rounded border text-xs font-bold outline-none ${isDark ? 'bg-[#0B2E33] border-white/30 text-white' : 'bg-white border-[#1E293B] text-[#0F172A]'}`} />
              </div>
            </div>

            <div className="flex items-center gap-3">
              {saving && <span className="text-xs text-[#0F8B8D] dark:text-[#2BA5B5] animate-pulse font-bold flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 animate-spin" /> Saving...</span>}
              {!saving && isDirty && <span className="text-xs text-amber-500 dark:text-amber-400 font-bold flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" /> Unsaved changes</span>}
              {!saving && !isDirty && <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> All changes saved</span>}

              <button disabled={saving} onClick={() => handleSaveAll()} className="px-3.5 py-1.5 text-xs font-bold rounded bg-slate-700 hover:bg-slate-800 text-white disabled:opacity-50 transition-colors cursor-pointer shadow-sm flex items-center gap-1.5">
                <Save className="w-3.5 h-3.5" />
                <span>{saving ? 'Saving...' : 'Save All Changes'}</span>
              </button>
              <button disabled={saving} onClick={handleSubmitAllFilled} className="px-3 py-1.5 text-xs font-bold rounded bg-[#0F8B8D] text-white hover:bg-[#0b6d6f] disabled:opacity-50 transition-colors cursor-pointer shadow-sm flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5" />
                <span>Submit All Filled Hours</span>
              </button>
            </div>
          </div>
        </div>

        {/* DAY SUMMARY CARD */}
        <div className={`p-5 rounded-2xl border shadow-sm ${isDark ? 'bg-[#0D3137] border-white/20 text-white' : 'bg-white border-slate-300 text-slate-900'}`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-4 border-b border-current/15 gap-2">
            <div>
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#0F8B8D]" />
                <h3 className="font-extrabold text-sm uppercase tracking-wider text-[#0F8B8D] dark:text-[#2BA5B5]">Management Overview · সারসংক্ষেপ</h3>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs">
              {daySummary.bestLine && <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-bold flex items-center gap-1"><Award className="w-3.5 h-3.5" /> Best: Line 0{daySummary.bestLine.lineNo} ({daySummary.bestLine.output.achievement}%)</span>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {[
              { key: 'output', label: 'Out Put', color: '#0F8B8D' },
              { key: 'back', label: 'Back Part', color: '#3B82F6' },
              { key: 'front', label: 'Front Part', color: '#8B5CF6' },
              { key: 'asm', label: 'A.S.M', color: '#F59E0B' },
            ].map(({ key, label }) => {
              const partData = (daySummary.byPart as any)[key] || {};
              const hasTgt = partData.totalTarget !== null;
              return (
                <div key={key} className={`p-4 rounded-xl border ${isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{label}</span>
                    {hasTgt && <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${partData.status === 'short' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>{partData.achievement}% Achieved</span>}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono mt-2">
                    <div><span className="text-[10px] text-slate-400 uppercase">Target:</span><p className="font-extrabold text-sm">{partData.totalTarget ?? '-'}</p></div>
                    <div><span className="text-[10px] text-slate-400 uppercase">Actual:</span><p className="font-extrabold text-sm text-[#0F8B8D]">{partData.totalActual ?? '-'}</p></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* LINE TABLES */}
        <div className="space-y-6">
          {lines.map((line, lineIdx) => {
            const { totalManpower, totalBack, totalFront, totalOutput, totalAsm, backBreakdown, frontBreakdown, outputBreakdown, asmBreakdown } = lineCalculations[lineIdx];
            const outMetrics = outputBreakdown.metrics;
            const backMetrics = backBreakdown.metrics;
            const frontMetrics = frontBreakdown.metrics;
            const asmMetrics = asmBreakdown.metrics;

            return (
              <div key={line.lineNo} className={`p-4 rounded-2xl border shadow-sm ${isDark ? 'bg-[#103A40] border-white/25 text-white' : 'bg-white border-[#1E293B] text-[#0F172A]'}`}>
                <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-3 px-1 gap-3">
                  <h3 className="font-extrabold text-sm uppercase tracking-wider text-[#0F8B8D] dark:text-[#2BA5B5]">Line 0{line.lineNo} Production Register</h3>
                  <div className="flex items-center gap-3">
                     <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg border border-current/20 text-xs font-bold">
                      <Clock className="w-3.5 h-3.5 text-[#0F8B8D]" />
                      <span>Working Hours:</span>
                      <select value={line.workingHours ?? 8} onChange={(e) => handleLineChange(lineIdx, 'workingHours', parseInt(e.target.value, 10))} className={`font-mono font-black rounded px-1.5 py-0.5 outline-none cursor-pointer ${isDark ? 'bg-[#0B2E33] text-white' : 'bg-slate-100 text-slate-800'}`}>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((h) => <option key={h} value={h}>{h} hrs</option>)}
                      </select>
                    </div>
                    <button onClick={() => handleApplySameTarget(lineIdx)} className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-lg bg-teal-500/10 hover:bg-teal-500/20 text-[#0F8B8D] dark:text-[#2BA5B5] border border-[#0F8B8D]/30 transition-colors cursor-pointer">
                      <Copy className="w-3 h-3" />
                      <span>Apply Back Target to All</span>
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-xs font-mono" style={{ tableLayout: 'fixed', minWidth: '1400px', border: '1px solid #1E293B' }}>
                    <thead>
                      <tr className={isDark ? 'bg-[#0B2E33] text-slate-200' : 'bg-[#F1F5F9] text-[#0F172A]'}>
                        <th className="p-2 border border-[#1E293B] text-center" style={{ width: '130px' }}>Buyer Name</th>
                        <th className="p-2 border border-[#1E293B] text-center" style={{ width: '130px' }}>Style No</th>
                        <th className="p-2 border border-[#1E293B] text-center" style={{ width: '90px' }}>Order Qty</th>
                        <th className="p-2 border border-[#1E293B] text-center" style={{ width: '80px' }}>M.P</th>
                        <th className="p-2 border border-[#1E293B] text-center" style={{ width: '45px' }}>Line</th>
                        <th className="p-2 border border-[#1E293B] text-center" style={{ width: '75px' }}>Parts</th>
                        <th className="p-2 border border-[#1E293B] text-center" style={{ width: '70px' }}>Hour Target</th>
                        <th className="p-2 border border-[#1E293B] text-center" style={{ width: '70px' }}>Total Target</th>
                        {Array.from({ length: 10 }).map((_, i) => {
                          const hrNo = i + 1;
                          const isLocked = hourLocks.some((l) => l.hour_no === hrNo);
                          return (
                            <th key={i} className={`p-1 border border-[#1E293B] text-center relative ${isLocked ? 'bg-amber-500/20' : ''}`} style={{ width: '81px' }}>
                              <div className="flex flex-col items-center gap-0.5">
                                <span className="text-[10px]">H{String(hrNo).padStart(2, '0')}</span>
                                {isLocked ? (
                                  <button onClick={() => handleReopenHour(hrNo)} disabled={!isAdmin} className={`p-0.5 rounded ${isAdmin ? 'hover:bg-amber-500/30 text-amber-600' : 'text-amber-400 cursor-not-allowed'}`} title={isAdmin ? 'Click to reopen hour' : 'Locked'}>
                                    <Lock className="w-3 h-3" />
                                  </button>
                                ) : (
                                  <button onClick={() => handleSubmitHour(hrNo)} className="p-0.5 rounded hover:bg-[#0F8B8D]/20 text-[#0F8B8D]" title="Submit and lock hour">
                                    <Send className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </th>
                          );
                        })}
                        <th className="p-2 border border-[#1E293B] text-center" style={{ width: '85px' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* BACK ROW */}
                      <tr className={isDark ? 'bg-[#0B2E33]/40' : 'bg-[#F8FAFC]'}>
                        <td rowSpan={4} className="border border-[#1E293B] p-1 align-middle text-center">
                          <input type="text" value={line.buyerName ?? ''} onChange={(e) => handleLineChange(lineIdx, 'buyerName', e.target.value)} className={`w-full px-2 py-1.5 text-xs rounded border text-center font-bold outline-none ${isDark ? 'bg-[#12383E] border-[#1E293B] text-white' : 'bg-white border-[#1E293B] text-[#0F172A]'}`} />
                        </td>
                        <td rowSpan={4} className="border border-[#1E293B] p-1 align-middle text-center">
                          <input type="text" value={line.styleNo ?? ''} onChange={(e) => handleLineChange(lineIdx, 'styleNo', e.target.value)} className={`w-full px-2 py-1.5 text-xs rounded border text-center font-bold outline-none ${isDark ? 'bg-[#12383E] border-[#1E293B] text-white' : 'bg-white border-[#1E293B] text-[#0F172A]'}`} />
                        </td>
                        <td rowSpan={4} className="border border-[#1E293B] p-1 align-middle text-center bg-slate-50 dark:bg-black/10">
                          <input type="text" value={line.orderQty ?? ''} onChange={(e) => handleLineChange(lineIdx, 'orderQty', e.target.value.replace(/\D/g, ''))} placeholder="0" className={`w-full px-2 py-1.5 text-sm rounded border text-center font-black outline-none ${isDark ? 'bg-[#12383E] border-[#1E293B] text-emerald-400' : 'bg-white border-[#1E293B] text-emerald-700'}`} />
                        </td>
                        <td rowSpan={4} className="border border-[#1E293B] p-1.5 align-middle text-xs space-y-1">
                          {['op', 'hp', 'ir'].map((f) => (
                            <div key={f} className="flex items-center justify-between gap-1">
                              <span className="font-bold text-[10px] uppercase">{f}:</span>
                              <input type="text" value={line[f] ?? ''} onChange={(e) => handleLineChange(lineIdx, f, e.target.value)} className={`w-11 px-1 py-0.5 rounded border text-center font-bold outline-none ${isDark ? 'bg-[#12383E] border-[#1E293B] text-white' : 'bg-white border-[#1E293B] text-[#0F172A]'}`} />
                            </div>
                          ))}
                          <div className="pt-1 border-t border-[#1E293B]/30 text-center font-extrabold text-[11px] text-[#0F8B8D]">Tot: {totalManpower > 0 ? totalManpower : '-'}</div>
                        </td>
                        <td rowSpan={4} className="border border-[#1E293B] p-1 align-middle text-center font-black text-base">0{line.lineNo}</td>
                        <td className="border border-[#1E293B] p-1.5 font-extrabold text-center">Back</td>
                        <td className="border border-[#1E293B] p-1 align-middle text-center">
                          <input type="text" value={line.backHourTarget ?? ''} onChange={(e) => handleLineChange(lineIdx, 'backHourTarget', e.target.value)} className={`w-full px-1 py-1.5 text-xs rounded border text-center font-bold outline-none ${isDark ? 'bg-[#12383E] border-[#1E293B] text-white' : 'bg-white border-[#1E293B] text-[#0F172A]'}`} />
                        </td>
                        <td className="border border-[#1E293B] p-1 align-middle text-center font-black text-xs">{backMetrics.totalTarget ?? '-'}</td>
                        {line.hours.map((hr: any, hrIdx: number) => {
                          const isLocked = hourLocks.some((l) => l.hour_no === hr.hourNo);
                          const isDisabled = isLocked && !isAdmin;
                          const cellStyle = getCellStyling(hr.backQty, backMetrics.hourTarget, isDisabled);
                          const hBreak = backBreakdown.hourly[hrIdx] || {};
                          return (
                            <td key={hrIdx} className={`border border-[#1E293B] p-1 text-center align-middle ${isLocked ? 'bg-amber-500/10' : ''}`}>
                              <div className="relative">
                                <input type="text" disabled={isDisabled} value={hr.backQty ?? ''} onChange={(e) => handleHourChange(lineIdx, hrIdx, 'backQty', e.target.value, hr.hourNo)} className={`w-full h-7 text-xs rounded border text-center font-bold outline-none ${cellStyle.bgClass}`} />
                                {isLocked && <span className="absolute right-0.5 top-0.5 text-amber-600"><Lock className="w-2.5 h-2.5" /></span>}
                              </div>
                              <div className={`text-[10px] font-mono mt-0.5 border-t border-dashed border-[#1E293B]/20 pt-0.5 text-center ${getCumulativeColorClass(hBreak.cumActual, hBreak.cumTarget)}`}>{hBreak.cumActual !== null ? `Σ ${hBreak.cumActual}` : ''}</div>
                            </td>
                          );
                        })}
                        <td className="border border-[#1E293B] p-1 text-center font-bold font-mono">{renderTotalCell(totalBack, backMetrics.totalTarget)}</td>
                      </tr>
                      {/* FRONT ROW */}
                      <tr className={isDark ? 'bg-[#0B2E33]/60' : 'bg-[#F1F5F9]'}>
                        <td className="border border-[#1E293B] p-1.5 font-extrabold text-center">Front</td>
                        <td className="border border-[#1E293B] p-1 align-middle text-center">
                          <input type="text" value={line.frontHourTarget ?? ''} onChange={(e) => handleLineChange(lineIdx, 'frontHourTarget', e.target.value)} className={`w-full px-1 py-1.5 text-xs rounded border text-center font-bold outline-none ${isDark ? 'bg-[#12383E] border-[#1E293B] text-white' : 'bg-white border-[#1E293B] text-[#0F172A]'}`} />
                        </td>
                        <td className="border border-[#1E293B] p-1 align-middle text-center font-black text-xs">{frontMetrics.totalTarget ?? '-'}</td>
                        {line.hours.map((hr: any, hrIdx: number) => {
                          const isLocked = hourLocks.some((l) => l.hour_no === hr.hourNo);
                          const isDisabled = isLocked && !isAdmin;
                          const cellStyle = getCellStyling(hr.frontQty, frontMetrics.hourTarget, isDisabled);
                          const hBreak = frontBreakdown.hourly[hrIdx] || {};
                          return (
                            <td key={hrIdx} className={`border border-[#1E293B] p-1 text-center align-middle ${isLocked ? 'bg-amber-500/10' : ''}`}>
                              <div className="relative">
                                <input type="text" disabled={isDisabled} value={hr.frontQty ?? ''} onChange={(e) => handleHourChange(lineIdx, hrIdx, 'frontQty', e.target.value, hr.hourNo)} className={`w-full h-7 text-xs rounded border text-center font-bold outline-none ${cellStyle.bgClass}`} />
                                {isLocked && <span className="absolute right-0.5 top-0.5 text-amber-600"><Lock className="w-2.5 h-2.5" /></span>}
                              </div>
                              <div className={`text-[10px] font-mono mt-0.5 border-t border-dashed border-[#1E293B]/20 pt-0.5 text-center ${getCumulativeColorClass(hBreak.cumActual, hBreak.cumTarget)}`}>{hBreak.cumActual !== null ? `Σ ${hBreak.cumActual}` : ''}</div>
                            </td>
                          );
                        })}
                        <td className="border border-[#1E293B] p-1 text-center font-bold font-mono">{renderTotalCell(totalFront, frontMetrics.totalTarget)}</td>
                      </tr>
                      {/* OUT PUT ROW */}
                      <tr className={isDark ? 'bg-[#103A40]/80' : 'bg-[#ECFEFF]'}>
                        <td className="border border-[#1E293B] p-1.5 font-extrabold text-center text-[#0F8B8D]">Out Put</td>
                        <td className="border border-[#1E293B] p-1 align-middle text-center">
                          <input type="text" value={line.outputHourTarget ?? ''} onChange={(e) => handleLineChange(lineIdx, 'outputHourTarget', e.target.value)} className={`w-full px-1 py-1.5 text-xs rounded border text-center font-bold outline-none ${isDark ? 'bg-[#12383E] border-[#1E293B] text-white' : 'bg-white border-[#1E293B] text-[#0F172A]'}`} />
                        </td>
                        <td className="border border-[#1E293B] p-1 align-middle text-center font-black text-xs text-[#0F8B8D]">{outMetrics.totalTarget ?? '-'}</td>
                        {line.hours.map((hr: any, hrIdx: number) => {
                          const isLocked = hourLocks.some((l) => l.hour_no === hr.hourNo);
                          const isDisabled = isLocked && !isAdmin;
                          const cellStyle = getCellStyling(hr.outputQty, outMetrics.hourTarget, isDisabled);
                          const hBreak = outputBreakdown.hourly[hrIdx] || {};
                          return (
                            <td key={hrIdx} className={`border border-[#1E293B] p-1 text-center align-middle ${isLocked ? 'bg-amber-500/10' : ''}`}>
                              <div className="relative">
                                <input type="text" disabled={isDisabled} value={hr.outputQty ?? ''} onChange={(e) => handleHourChange(lineIdx, hrIdx, 'outputQty', e.target.value, hr.hourNo)} className={`w-full h-7 text-xs rounded border text-center font-bold outline-none ${cellStyle.bgClass}`} />
                                {isLocked && <span className="absolute right-0.5 top-0.5 text-amber-600"><Lock className="w-2.5 h-2.5" /></span>}
                              </div>
                              <div className={`text-[10px] font-mono mt-0.5 border-t border-dashed border-[#1E293B]/20 pt-0.5 text-center ${getCumulativeColorClass(hBreak.cumActual, hBreak.cumTarget)}`}>{hBreak.cumActual !== null ? `Σ ${hBreak.cumActual}` : ''}</div>
                            </td>
                          );
                        })}
                        <td className="border border-[#1E293B] p-1 text-center font-extrabold font-mono text-[#0F8B8D]">{renderTotalCell(totalOutput, outMetrics.totalTarget)}</td>
                      </tr>
                      {/* A.S.M ROW */}
                      <tr className={isDark ? 'bg-[#2A2415]/60' : 'bg-[#FFFBEB]'}>
                        <td className="border border-[#1E293B] p-1.5 font-extrabold text-center">A.S.M</td>
                        <td className="border border-[#1E293B] p-1 align-middle text-center">
                          <input type="text" value={line.asmHourTarget ?? ''} onChange={(e) => handleLineChange(lineIdx, 'asmHourTarget', e.target.value)} className={`w-full px-1 py-1.5 text-xs rounded border text-center font-bold outline-none ${isDark ? 'bg-[#12383E] border-[#1E293B] text-white' : 'bg-white border-[#1E293B] text-[#0F172A]'}`} />
                        </td>
                        <td className="border border-[#1E293B] p-1 align-middle text-center font-black text-xs">{asmMetrics.totalTarget ?? '-'}</td>
                        {line.hours.map((hr: any, hrIdx: number) => {
                          const isLocked = hourLocks.some((l) => l.hour_no === hr.hourNo);
                          const isDisabled = isLocked && !isAdmin;
                          const cellStyle = getCellStyling(hr.asm, asmMetrics.hourTarget, isDisabled);
                          const hBreak = asmBreakdown.hourly[hrIdx] || {};
                          return (
                            <td key={hrIdx} className={`border border-[#1E293B] p-1 text-center align-middle ${isLocked ? 'bg-amber-500/10' : ''}`}>
                              <div className="relative">
                                <input type="text" disabled={isDisabled} value={hr.asm ?? ''} onChange={(e) => handleHourChange(lineIdx, hrIdx, 'asm', e.target.value, hr.hourNo)} className={`w-full h-7 text-xs rounded border text-center font-bold outline-none ${cellStyle.bgClass}`} />
                                {isLocked && <span className="absolute right-0.5 top-0.5 text-amber-600"><Lock className="w-2.5 h-2.5" /></span>}
                              </div>
                              <div className={`text-[10px] font-mono mt-0.5 border-t border-dashed border-[#1E293B]/20 pt-0.5 text-center ${getCumulativeColorClass(hBreak.cumActual, hBreak.cumTarget)}`}>{hBreak.cumActual !== null ? `Σ ${hBreak.cumActual}` : ''}</div>
                            </td>
                          );
                        })}
                        <td className="border border-[#1E293B] p-1 text-center font-bold font-mono">{renderTotalCell(totalAsm, asmMetrics.totalTarget)}</td>
                      </tr>

                      {/* REMAINING TARGET (বাকি) */}
                      {['back', 'front', 'output', 'asm'].map((pKey, pIdx) => {
                        const breakdown = pKey === 'back' ? backBreakdown : pKey === 'front' ? frontBreakdown : pKey === 'asm' ? asmBreakdown : outputBreakdown;
                        const partLabel = pKey === 'back' ? 'Back' : pKey === 'front' ? 'Front' : pKey === 'asm' ? 'A.S.M' : 'Out Put';
                        return (
                          <tr key={`rem_${pKey}`} className={isDark ? (pKey === 'output' ? 'bg-blue-950/20' : 'bg-white/[0.01]') : (pKey === 'output' ? 'bg-cyan-50/50' : 'bg-slate-50/50')}>
                            {pIdx === 0 && <td rowSpan={4} colSpan={4} className="border border-[#1E293B] p-2 text-center align-middle font-black text-xs text-blue-600 bg-blue-500/10"><div>REMAINING TARGET</div><div className="text-[10px] font-bangla font-semibold">বাকি লক্ষ্য</div></td>}
                            <td className="border border-[#1E293B] p-1 text-center font-bold text-[11px]">{partLabel}</td>
                            <td className="border border-[#1E293B] p-1 text-center font-mono text-slate-400">-</td>
                            <td className="border border-[#1E293B] p-1 text-center font-mono text-slate-400">-</td>
                            {breakdown.hourly.map((hB: any, hIdx: number) => {
                              const r = hB.remaining;
                              return <td key={hIdx} className="border border-[#1E293B] p-1 text-center align-middle font-mono text-[11px] font-semibold text-slate-700">{r !== null ? r : '-'}</td>;
                            })}
                            <td className="border border-[#1E293B] p-1 text-center font-black font-mono text-xs text-slate-800">{breakdown.metrics.totalTarget !== null ? Math.max(0, breakdown.metrics.totalTarget - (breakdown.metrics.totalActual || 0)) : '-'}</td>
                          </tr>
                        );
                      })}

                      {/* BOTTOM INFO ROW */}
                      <tr className={isDark ? 'bg-[#0B2E33]/30' : 'bg-slate-50'}>
                        <td colSpan={7} className="border border-[#1E293B] p-0">
                          <div className="flex flex-col h-full">
                            <div className="bg-slate-200 dark:bg-black/20 px-2 py-0.5 border-b border-[#1E293B] text-[10px] font-bold">
                              Remarks <span className="font-bangla ml-1">মন্তব্য</span>
                            </div>
                            <textarea 
                              rows={2}
                              value={line.remarks ?? ''} 
                              onChange={(e) => handleLineChange(lineIdx, 'remarks', e.target.value)} 
                              className={`w-full p-2 text-xs outline-none resize-none h-full ${isDark ? 'bg-transparent text-white' : 'bg-transparent text-[#0F172A]'}`}
                              placeholder="Write remarks here..."
                            />
                          </div>
                        </td>
                        <td colSpan={7} className="border border-[#1E293B] p-0">
                          <div className="flex flex-col h-full">
                            <div className="bg-slate-200 dark:bg-black/20 px-2 py-0.5 border-b border-[#1E293B] text-[10px] font-bold">
                              Line Chief <span className="font-bangla ml-1">লাইন চিফ</span>
                            </div>
                            <input 
                              type="text"
                              value={line.lineChiefName ?? ''}
                              onChange={(e) => handleLineChange(lineIdx, 'lineChiefName', e.target.value.slice(0, 80))}
                              className={`w-full p-2 text-xs outline-none h-full font-bold ${isDark ? 'bg-transparent text-white' : 'bg-transparent text-[#0F172A]'}`}
                              placeholder="Name"
                            />
                          </div>
                        </td>
                        <td colSpan={4} className="border border-[#1E293B] p-0">
                          <div className="flex flex-col h-full">
                            <div className="bg-slate-200 dark:bg-black/20 px-2 py-0.5 border-b border-[#1E293B] text-[10px] font-bold">
                              Mobile No <span className="font-bangla ml-1">মোবাইল নম্বর</span>
                            </div>
                            <input 
                              type="tel"
                              inputMode="tel"
                              value={line.lineChiefPhone ?? ''}
                              onChange={(e) => {
                                const val = e.target.value.replace(/[^0-9+\- ]/g, '').slice(0, 20);
                                handleLineChange(lineIdx, 'lineChiefPhone', val);
                              }}
                              className={`w-full p-2 text-xs outline-none h-full font-bold font-mono ${isDark ? 'bg-transparent text-white' : 'bg-transparent text-[#0F172A]'}`}
                              placeholder="01XXXXXXXXX"
                            />
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}

          {/* FINISHING SECTION */}
          <div className={`p-4 rounded-2xl border shadow-sm ${isDark ? 'bg-[#103A40] border-white/25 text-white' : 'bg-white border-[#1E293B] text-[#0F172A]'}`}>
            <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-3 px-1 gap-3">
              <div>
                <h3 className="font-extrabold text-sm uppercase tracking-wider text-[#0F8B8D] dark:text-[#2BA5B5]">HOURLY FINISHING PROCESS-WISE PRODUCTION REPORT</h3>
                <p className="text-[11px] font-bangla text-slate-400">ঘণ্টাভিত্তিক ফিনিশিং প্রসেসভিত্তিক প্রোডাকশন রিপোর্ট</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg border border-current/20 text-xs font-bold">
                  <Clock className="w-3.5 h-3.5 text-[#0F8B8D]" />
                  <span>Working Hours:</span>
                  <select value={finishingLine.workingHours ?? 8} onChange={(e) => handleFinishingLineChange('workingHours', parseInt(e.target.value, 10))} className={`font-mono font-black rounded px-1.5 py-0.5 outline-none cursor-pointer ${isDark ? 'bg-[#0B2E33] text-white' : 'bg-slate-100 text-slate-800'}`}>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((h) => <option key={h} value={h}>{h} hrs</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs font-mono" style={{ tableLayout: 'fixed', minWidth: '1400px', border: '1px solid #1E293B' }}>
                <thead>
                  <tr className={isDark ? 'bg-[#0B2E33] text-slate-200' : 'bg-[#F1F5F9] text-[#0F172A]'}>
                    <th className="p-2 border border-[#1E293B] text-center" style={{ width: '130px' }}>Buyer Name</th>
                    <th className="p-2 border border-[#1E293B] text-center" style={{ width: '130px' }}>Style No</th>
                    <th className="p-2 border border-[#1E293B] text-center" style={{ width: '90px' }}>Order Qty</th>
                    <th className="p-2 border border-[#1E293B] text-center" style={{ width: '120px' }}>M.P (Manpower)</th>
                    <th className="p-2 border border-[#1E293B] text-center" style={{ width: '90px' }}>PROCESS NAME</th>
                    <th className="p-2 border border-[#1E293B] text-center" style={{ width: '70px' }}>Hour Target</th>
                    <th className="p-2 border border-[#1E293B] text-center" style={{ width: '70px' }}>Total Target</th>
                    {Array.from({ length: 10 }).map((_, i) => {
                      const hrNo = i + 1;
                      const isLocked = hourLocks.some((l) => l.hour_no === hrNo);
                      return (
                        <th key={i} className={`p-1 border border-[#1E293B] text-center relative ${isLocked ? 'bg-amber-500/20' : ''}`} style={{ width: '81px' }}>
                          <span className="text-[10px]">H{String(hrNo).padStart(2, '0')}</span>
                        </th>
                      );
                    })}
                    <th className="p-2 border border-[#1E293B] text-center" style={{ width: '85px' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {/* FINISHING PROCESS ROWS */}
                  {[
                    { key: 'back', label: 'INSIDE', breakdown: finishingCalculations.insideBreakdown, total: finishingCalculations.totalInside },
                    { key: 'front', label: 'IRON', breakdown: finishingCalculations.ironBreakdown, total: finishingCalculations.totalIron },
                    { key: 'output', label: 'TOP SIDE', breakdown: finishingCalculations.topSideBreakdown, total: finishingCalculations.totalTopSide },
                    { key: 'asm', label: 'POLY', breakdown: finishingCalculations.polyBreakdown, total: finishingCalculations.totalPoly },
                  ].map((proc, pIdx) => (
                    <tr key={proc.key} className={isDark ? 'bg-[#0B2E33]/40' : 'bg-[#F8FAFC]'}>
                      {pIdx === 0 && (
                        <>
                          <td rowSpan={4} className="border border-[#1E293B] p-1 align-middle text-center">
                            <input type="text" value={finishingLine.buyerName ?? ''} onChange={(e) => handleFinishingLineChange('buyerName', e.target.value)} className={`w-full px-2 py-1.5 text-xs rounded border text-center font-bold outline-none ${isDark ? 'bg-[#12383E] border-[#1E293B] text-white' : 'bg-white border-[#1E293B] text-[#0F172A]'}`} />
                          </td>
                          <td rowSpan={4} className="border border-[#1E293B] p-1 align-middle text-center">
                            <input type="text" value={finishingLine.styleNo ?? ''} onChange={(e) => handleFinishingLineChange('styleNo', e.target.value)} className={`w-full px-2 py-1.5 text-xs rounded border text-center font-bold outline-none ${isDark ? 'bg-[#12383E] border-[#1E293B] text-white' : 'bg-white border-[#1E293B] text-[#0F172A]'}`} />
                          </td>
                          <td rowSpan={4} className="border border-[#1E293B] p-1 align-middle text-center bg-slate-50 dark:bg-black/10">
                            <input type="text" value={finishingLine.orderQty ?? ''} onChange={(e) => handleFinishingLineChange('orderQty', e.target.value.replace(/\D/g, ''))} placeholder="0" className={`w-full px-2 py-1.5 text-sm rounded border text-center font-black outline-none ${isDark ? 'bg-[#12383E] border-[#1E293B] text-emerald-400' : 'bg-white border-[#1E293B] text-emerald-700'}`} />
                          </td>
                          <td rowSpan={4} className="border border-[#1E293B] p-1.5 align-middle text-[10px] space-y-0.5">
                            {[
                              { id: 'op', label: 'Op' },
                              { id: 'hp', label: 'Hp' },
                              { id: 'ir', label: 'Ir' },
                              { id: 'qualityMan', label: 'Quality' },
                              { id: 'foldingMan', label: 'Folding' },
                              { id: 'polyMan', label: 'Poly' },
                              { id: 'packingMan', label: 'Packing' },
                            ].map((f) => (
                              <div key={f.id} className="flex items-center justify-between gap-1">
                                <span className="font-bold text-[9px] uppercase">{f.label}:</span>
                                <input type="text" value={finishingLine[f.id] ?? ''} onChange={(e) => handleFinishingLineChange(f.id, e.target.value)} className={`w-10 px-1 py-0.5 rounded border text-center font-bold outline-none ${isDark ? 'bg-[#12383E] border-[#1E293B] text-white' : 'bg-white border-[#1E293B] text-[#0F172A]'}`} />
                              </div>
                            ))}
                            <div className="pt-1 border-t border-[#1E293B]/30 text-center font-extrabold text-[10px] text-[#0F8B8D]">Total: {finishingCalculations.totalManpower > 0 ? finishingCalculations.totalManpower : '-'}</div>
                          </td>
                        </>
                      )}
                      <td className="border border-[#1E293B] p-1.5 font-extrabold text-center text-[10px]">{proc.label}</td>
                      <td className="border border-[#1E293B] p-1 align-middle text-center">
                        <input type="text" value={finishingLine[`${proc.key}HourTarget`] ?? ''} onChange={(e) => handleFinishingLineChange(`${proc.key}HourTarget`, e.target.value)} className={`w-full px-1 py-1.5 text-xs rounded border text-center font-bold outline-none ${isDark ? 'bg-[#12383E] border-[#1E293B] text-white' : 'bg-white border-[#1E293B] text-[#0F172A]'}`} />
                      </td>
                      <td className="border border-[#1E293B] p-1 align-middle text-center font-black text-xs">{proc.breakdown.metrics.totalTarget ?? '-'}</td>
                      {finishingLine.hours.map((hr: any, hrIdx: number) => {
                        const isLocked = hourLocks.some((l) => l.hour_no === hr.hourNo);
                        const isDisabled = isLocked && !isAdmin;
                        const cellStyle = getCellStyling(hr[`${proc.key}Qty`], proc.breakdown.metrics.hourTarget, isDisabled);
                        const hBreak = proc.breakdown.hourly[hrIdx] || {};
                        return (
                          <td key={hrIdx} className={`border border-[#1E293B] p-1 text-center align-middle ${isLocked ? 'bg-amber-500/10' : ''}`}>
                            <div className="relative">
                              <input type="text" disabled={isDisabled} value={hr[`${proc.key}Qty`] ?? ''} onChange={(e) => handleFinishingHourChange(hrIdx, `${proc.key}Qty`, e.target.value, hr.hourNo)} className={`w-full h-7 text-xs rounded border text-center font-bold outline-none ${cellStyle.bgClass}`} />
                              {isLocked && <span className="absolute right-0.5 top-0.5 text-amber-600"><Lock className="w-2.5 h-2.5" /></span>}
                            </div>
                            <div className={`text-[10px] font-mono mt-0.5 border-t border-dashed border-[#1E293B]/20 pt-0.5 text-center ${getCumulativeColorClass(hBreak.cumActual, hBreak.cumTarget)}`}>{hBreak.cumActual !== null ? `Σ ${hBreak.cumActual}` : ''}</div>
                          </td>
                        );
                      })}
                      <td className="border border-[#1E293B] p-1 text-center font-bold font-mono">{renderTotalCell(proc.total, proc.breakdown.metrics.totalTarget)}</td>
                    </tr>
                  ))}

                  {/* REMAINING TARGET (বাকি) */}
                  {['back', 'front', 'output', 'asm'].map((procKey, pIdx) => {
                    const procInfo = [
                      { key: 'back', label: 'INSIDE', breakdown: finishingCalculations.insideBreakdown },
                      { key: 'front', label: 'IRON', breakdown: finishingCalculations.ironBreakdown },
                      { key: 'output', label: 'TOP SIDE', breakdown: finishingCalculations.topSideBreakdown },
                      { key: 'asm', label: 'POLY', breakdown: finishingCalculations.polyBreakdown },
                    ].find(p => p.key === procKey)!;
                    
                    return (
                      <tr key={`frem_${procKey}`} className={isDark ? 'bg-white/[0.01]' : 'bg-slate-50/50'}>
                        {pIdx === 0 && <td rowSpan={4} colSpan={4} className="border border-[#1E293B] p-2 text-center align-middle font-black text-xs text-blue-600 bg-blue-500/10"><div>REMAINING TARGET</div><div className="text-[10px] font-bangla font-semibold">বাকি লক্ষ্য</div></td>}
                        <td className="border border-[#1E293B] p-1 text-center font-bold text-[10px]">{procInfo.label}</td>
                        <td className="border border-[#1E293B] p-1 text-center font-mono text-slate-400">-</td>
                        <td className="border border-[#1E293B] p-1 text-center font-mono text-slate-400">-</td>
                        {procInfo.breakdown.hourly.map((hB: any, hIdx: number) => {
                          const r = hB.remaining;
                          return <td key={hIdx} className="border border-[#1E293B] p-1 text-center align-middle font-mono text-[11px] font-semibold text-slate-700">{r !== null ? r : '-'}</td>;
                        })}
                        <td className="border border-[#1E293B] p-1 text-center font-black font-mono text-xs text-slate-800">{procInfo.breakdown.metrics.totalTarget !== null ? Math.max(0, procInfo.breakdown.metrics.totalTarget - (procInfo.breakdown.metrics.totalActual || 0)) : '-'}</td>
                      </tr>
                    );
                  })}

                  {/* BOTTOM INFO ROW */}
                  <tr className={isDark ? 'bg-[#0B2E33]/30' : 'bg-slate-50'}>
                    <td colSpan={7} className="border border-[#1E293B] p-0">
                      <div className="flex flex-col h-full">
                        <div className="bg-slate-200 dark:bg-black/20 px-2 py-0.5 border-b border-[#1E293B] text-[10px] font-bold">
                          Remarks <span className="font-bangla ml-1">মন্তব্য</span>
                        </div>
                        <textarea 
                          rows={2}
                          value={finishingLine.remarks ?? ''} 
                          onChange={(e) => handleFinishingLineChange('remarks', e.target.value)} 
                          className={`w-full p-2 text-xs outline-none resize-none h-full ${isDark ? 'bg-transparent text-white' : 'bg-transparent text-[#0F172A]'}`}
                          placeholder="Finishing remarks..."
                        />
                      </div>
                    </td>
                    <td colSpan={7} className="border border-[#1E293B] p-0">
                      <div className="flex flex-col h-full">
                        <div className="bg-slate-200 dark:bg-black/20 px-2 py-0.5 border-b border-[#1E293B] text-[10px] font-bold">
                          Line Chief <span className="font-bangla ml-1">লাইন চিফ</span>
                        </div>
                        <input 
                          type="text"
                          value={finishingLine.lineChiefName ?? ''}
                          onChange={(e) => handleFinishingLineChange('lineChiefName', e.target.value.slice(0, 80))}
                          className={`w-full p-2 text-xs outline-none h-full font-bold ${isDark ? 'bg-transparent text-white' : 'bg-transparent text-[#0F172A]'}`}
                          placeholder="Name"
                        />
                      </div>
                    </td>
                    <td colSpan={4} className="border border-[#1E293B] p-0">
                      <div className="flex flex-col h-full">
                        <div className="bg-slate-200 dark:bg-black/20 px-2 py-0.5 border-b border-[#1E293B] text-[10px] font-bold">
                          Mobile No <span className="font-bangla ml-1">মোবাইল নম্বর</span>
                        </div>
                        <input 
                          type="tel"
                          inputMode="tel"
                          value={finishingLine.lineChiefPhone ?? ''}
                          onChange={(e) => {
                            const val = e.target.value.replace(/[^0-9+\- ]/g, '').slice(0, 20);
                            handleFinishingLineChange('lineChiefPhone', val);
                          }}
                          className={`w-full p-2 text-xs outline-none h-full font-bold font-mono ${isDark ? 'bg-transparent text-white' : 'bg-transparent text-[#0F172A]'}`}
                          placeholder="01XXXXXXXXX"
                        />
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* EDIT HISTORY DRAWER */}
      {showHistoryDrawer && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex justify-end">
          <div className={`w-full max-w-md h-full flex flex-col shadow-2xl ${isDark ? 'bg-[#103A40] text-white border-l border-white/10' : 'bg-white text-[#0F172A]'}`}>
            <div className="p-4 border-b border-current/20 flex items-center justify-between">
              <div><h3 className="font-extrabold text-base flex items-center gap-2"><History className="w-5 h-5 text-[#0F8B8D]" /> Edit History</h3></div>
              <button onClick={() => setShowHistoryDrawer(false)} className="p-1 rounded-lg hover:bg-current/10 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {filteredEditLogs.map((log) => {
                const fieldLabel = FIELD_LABEL_MAP[log.field_name] || log.field_name || 'Field';
                return (
                  <div key={log.id} className="p-3 rounded-xl border border-current/15 bg-white/5 text-xs space-y-1">
                    <div className="flex items-center justify-between"><span className="font-bold text-[#0F8B8D]">{log.editor_name || 'User'}</span>{log.after_submit && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-500/20 text-rose-500">After-Submit</span>}</div>
                    <p className="text-[#475569] dark:text-slate-300">Line {log.line_no}{log.hour_no ? ` · Hour ${String(log.hour_no).padStart(2, '0')}` : ''} · <span className="font-semibold text-slate-200">{fieldLabel}</span>: <strong className="text-slate-400">{log.old_value ?? '-'}</strong> → <strong className="text-emerald-400">{log.new_value ?? '-'}</strong></p>
                    <p className="text-[10px] text-slate-400">{new Date(log.edited_at).toLocaleString()}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default SewingReportEntry;
