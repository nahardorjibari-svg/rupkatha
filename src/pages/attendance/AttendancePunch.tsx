/**
 * Mobile-First Daily Attendance Punch Page
 * Rupkatha Apparels Ltd. (/attendance)
 * Direct database inserts are blocked; uses att_check_in & att_check_out RPCs with server timestamps.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { supabase } from '../../lib/supabaseClient';
import {
  getDhakaDateString,
  formatDhakaTime12,
  formatDhakaDateDisplay,
  formatDhakaDateBangla,
  calculateWorkingHoursBetween,
} from '../../lib/dhakaTime';
import {
  compressSelfie,
  getBrowserGeolocation,
} from '../../lib/attendanceUtils';
import {
  Clock,
  MapPin,
  Camera,
  CheckCircle2,
  AlertTriangle,
  LogIn,
  LogOut,
  Calendar,
  History,
  RefreshCw,
  Info,
  ShieldAlert,
  Loader2,
  WifiOff,
} from 'lucide-react';
import toast from 'react-hot-toast';

export const AttendancePunch: React.FC = () => {
  const { profile, user } = useAuth();
  const { isDark } = useTheme();

  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDateBangla, setCurrentDateBangla] = useState<string>('');
  const [todayRecord, setTodayRecord] = useState<any | null>(null);
  const [monthlyRecords, setMonthlyRecords] = useState<any[]>([]);
  const [loadingToday, setLoadingToday] = useState(true);
  const [loadingMonthly, setLoadingMonthly] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submittingType, setSubmittingType] = useState<'in' | 'out' | null>(null);
  const [note, setNote] = useState('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Hidden file input for front-camera selfie capture
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingActionRef = useRef<'in' | 'out' | null>(null);

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => {
      setIsOnline(false);
      toast.error('Internet connection lost. Attendance punches require network connection.');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Update live Dhaka clock every second
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('en-US', {
          timeZone: 'Asia/Dhaka',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      );
      setCurrentDateBangla(formatDhakaDateBangla(now.toISOString()));
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  const todayStr = getDhakaDateString();

  // Load today's attendance record
  const loadTodayRecord = useCallback(async () => {
    if (!user?.id) return;
    setLoadingToday(true);
    try {
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', user.id)
        .eq('att_date', todayStr)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching today record:', error);
      }
      setTodayRecord(data || null);
    } catch (err: any) {
      console.error('Error loading today attendance:', err);
    } finally {
      setLoadingToday(false);
    }
  }, [user?.id, todayStr]);

  // Load this month's attendance list
  const loadMonthlyRecords = useCallback(async () => {
    if (!user?.id) return;
    setLoadingMonthly(true);
    try {
      const [year, month] = todayStr.split('-');
      const startOfMonth = `${year}-${month}-01`;
      const endOfMonth = `${year}-${month}-31`;

      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', user.id)
        .gte('att_date', startOfMonth)
        .lte('att_date', endOfMonth)
        .order('att_date', { ascending: false });

      if (error) {
        console.error('Error fetching monthly records:', error);
      } else {
        setMonthlyRecords(data || []);
      }
    } catch (err: any) {
      console.error('Error loading monthly attendance:', err);
    } finally {
      setLoadingMonthly(false);
    }
  }, [user?.id, todayStr]);

  useEffect(() => {
    loadTodayRecord();
    loadMonthlyRecords();
  }, [loadTodayRecord, loadMonthlyRecords]);

  // Trigger selfie capture when user taps IN or OUT
  const handleInitiatePunch = (type: 'in' | 'out') => {
    if (!navigator.onLine) {
      toast.error('You are currently offline. An internet connection is required to record attendance.');
      return;
    }

    if (!profile?.employee_id) {
      toast.error('Your Employee ID is not set. Please contact HR to assign your ID card number.');
      return;
    }

    if (type === 'out' && !todayRecord?.check_in_at) {
      toast.error('You must punch IN before punching OUT.');
      return;
    }

    pendingActionRef.current = type;
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  // Process selfie & GPS location, then call Supabase RPC
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const actionType = pendingActionRef.current;
    if (!file || !actionType || !user?.id) return;

    if (!navigator.onLine) {
      toast.error('You are currently offline. Attendance punch aborted.');
      return;
    }

    setSubmitting(true);
    setSubmittingType(actionType);
    const toastId = toast.loading(
      actionType === 'in'
        ? 'Acquiring GPS location & recording Check-IN...'
        : 'Acquiring GPS location & recording Check-OUT...'
    );

    try {
      // 1. Acquire browser geolocation with 15s timeout
      const geo = await getBrowserGeolocation(15000);
      if (geo.error) {
        toast.dismiss(toastId);
        toast.error(`Location required: ${geo.error}`);
        setSubmitting(false);
        setSubmittingType(null);
        return;
      }

      // 2. Compress selfie in the browser (max 600px, 0.6 quality JPEG)
      const compressedBlob = await compressSelfie(file);

      // 3. Upload selfie to private bucket 'attendance'
      const photoPath = `${user.id}/${todayStr}-${actionType}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('attendance')
        .upload(photoPath, compressedBlob, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) {
        toast.dismiss(toastId);
        toast.error(`Photo upload error: ${uploadError.message}`);
        setSubmitting(false);
        setSubmittingType(null);
        return;
      }

      // 4. Call RPC att_check_in or att_check_out with server timestamp
      const rpcName = actionType === 'in' ? 'att_check_in' : 'att_check_out';
      const rpcParams = {
        lat: geo.lat,
        lng: geo.lng,
        acc: geo.acc,
        note: note.trim() || null,
        photo: photoPath,
      };

      const { data, error: rpcError } = await supabase.rpc(rpcName, rpcParams);

      if (rpcError) {
        toast.dismiss(toastId);
        toast.error(`Attendance error: ${rpcError.message}`);
        return;
      }

      toast.dismiss(toastId);
      toast.success(
        actionType === 'in'
          ? 'Check-IN successfully recorded!'
          : 'Check-OUT successfully recorded!'
      );

      setNote('');
      await loadTodayRecord();
      await loadMonthlyRecords();
    } catch (err: any) {
      toast.dismiss(toastId);
      toast.error(err?.message || 'An unexpected error occurred during punch.');
    } finally {
      setSubmitting(false);
      setSubmittingType(null);
      pendingActionRef.current = null;
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const hasIn = Boolean(todayRecord?.check_in_at);
  const hasOut = Boolean(todayRecord?.check_out_at);
  const isDoneForToday = hasIn && hasOut;
  const inTimeFormatted = hasIn ? formatDhakaTime12(todayRecord.check_in_at) : null;
  const outTimeFormatted = hasOut ? formatDhakaTime12(todayRecord.check_out_at) : null;
  const todayHours = hasIn && hasOut ? calculateWorkingHoursBetween(todayRecord.check_in_at, todayRecord.check_out_at) : '-';

  return (
    <AdminLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Offline Warning Banner */}
        {!isOnline && (
          <div className="bg-rose-500 text-white px-4 py-3 rounded-2xl shadow-lg flex items-center gap-3 animate-pulse">
            <WifiOff className="w-5 h-5 shrink-0" />
            <div className="text-sm font-medium">
              <strong>Offline Mode:</strong> Internet connection required to record attendance punch.
            </div>
          </div>
        )}

        {/* Hidden Camera Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="user"
          onChange={handleFileChange}
          className="hidden"
          aria-label="Take selfie for attendance"
        />

        {/* Header Profile & Live Clock Card */}
        <div
          className={`p-6 rounded-3xl border shadow-xl relative overflow-hidden transition-all ${
            isDark
              ? 'bg-[#103A40]/90 border-teal-500/20 text-white'
              : 'bg-gradient-to-br from-white via-teal-50/30 to-emerald-50/30 border-slate-200/90 text-slate-900'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-extrabold tracking-widest text-[#2BA5B5]">
                  Staff Attendance Punch
                </span>
                <span className="text-xs font-bangla text-slate-400">/ হাজিরা পাঞ্চ</span>
              </div>
              <h1 className="text-2xl font-black mt-0.5 tracking-tight">
                {profile?.full_name || 'Staff Member'}
              </h1>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-slate-500 dark:text-slate-300 font-medium">
                <span>
                  ID:{' '}
                  <strong className="text-slate-900 dark:text-white font-mono">
                    {profile?.employee_id || 'Not Assigned'}
                  </strong>
                </span>
                <span>•</span>
                <span>{profile?.designation || 'Factory Staff'}</span>
                {profile?.department && (
                  <>
                    <span>•</span>
                    <span>{profile.department}</span>
                  </>
                )}
              </div>
            </div>

            {/* Live Server Clock Display */}
            <div className="text-left sm:text-right shrink-0 bg-slate-950/10 dark:bg-black/30 p-3 rounded-2xl border border-white/10">
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center sm:justify-end gap-1">
                <Clock className="w-3 h-3 text-[#2BA5B5]" />
                <span>Dhaka Time (UTC+6)</span>
              </div>
              <div className="text-2xl font-black font-mono tracking-tight text-[#0F8B8D] dark:text-[#5EEAD4] mt-0.5">
                {currentTime || '--:--:-- --'}
              </div>
              <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
                {formatDhakaDateDisplay(todayStr)}
              </div>
              <div className="text-[11px] font-bangla text-slate-400 leading-tight">
                {currentDateBangla}
              </div>
            </div>
          </div>

          {/* Missing Employee ID Warning */}
          {!profile?.employee_id && (
            <div className="mb-4 p-4 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-900 dark:text-amber-200 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm">Your Employee ID is not set. Contact HR.</p>
                <p className="text-xs font-bangla mt-0.5 opacity-90">
                  আপনার এমপ্লয়ী আইডি কার্ড নম্বর সেট করা নেই। হাজিরা দেওয়ার জন্য অনুগ্রহ করে এইচআর বিভাগের সাথে যোগাযোগ করুন।
                </p>
              </div>
            </div>
          )}

          {/* Today's Punch Summary Status Card */}
          <div
            className={`p-4 rounded-2xl border ${
              isDoneForToday
                ? isDark
                  ? 'bg-blue-950/30 border-blue-500/30 text-blue-200'
                  : 'bg-blue-50 border-blue-200 text-blue-900'
                : hasIn
                ? isDark
                  ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : isDark
                ? 'bg-slate-800/50 border-slate-700 text-slate-300'
                : 'bg-slate-100 border-slate-200 text-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider">Today's Status / আজকের অবস্থা</span>
              {loadingToday ? (
                <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
              ) : isDoneForToday ? (
                <span className="text-xs font-black uppercase px-2.5 py-0.5 rounded-full bg-blue-500 text-white">
                  Done for today
                </span>
              ) : hasIn ? (
                <div className="flex items-center gap-1.5">
                  {todayRecord?.is_late && (
                    <span className="text-xs font-black uppercase px-2 py-0.5 rounded-full bg-amber-500 text-white">
                      LATE / দেরি
                    </span>
                  )}
                  <span className="text-xs font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-600 text-white">
                    IN DONE
                  </span>
                </div>
              ) : (
                <span className="text-xs font-black uppercase px-2.5 py-0.5 rounded-full bg-slate-400 text-white">
                  Not Checked In
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-current/10 text-center">
              <div>
                <span className="text-[10px] uppercase font-bold opacity-70 block">Punch IN</span>
                <span className="text-base sm:text-lg font-black font-mono">
                  {inTimeFormatted || '--:--'}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold opacity-70 block">Punch OUT</span>
                <span className="text-base sm:text-lg font-black font-mono">
                  {outTimeFormatted || '--:--'}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold opacity-70 block">Total Hours</span>
                <span className="text-base sm:text-lg font-black font-mono">
                  {todayHours}
                </span>
              </div>
            </div>

            {isDoneForToday && (
              <div className="mt-3 pt-2 text-center text-xs font-semibold border-t border-current/15">
                Done for today: IN {inTimeFormatted}, OUT {outTimeFormatted}
              </div>
            )}
          </div>
        </div>

        {/* Optional Note Field */}
        {!isDoneForToday && (
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>Optional Punch Note / সংক্ষিপ্ত মন্তব্য</span>
              <span className="text-[11px] font-normal lowercase">(gate, section, or reason)</span>
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Main Gate, Shift A, Overtime"
              maxLength={120}
              disabled={submitting}
              className={`w-full px-4 py-3 rounded-2xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#2BA5B5] ${
                isDark
                  ? 'bg-[#103A40]/80 border-white/10 text-white placeholder-slate-400'
                  : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
              }`}
            />
          </div>
        )}

        {/* Exactly TWO Big Buttons: IN (Green) & OUT (Red) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* 1. BIG GREEN IN BUTTON */}
          <button
            type="button"
            onClick={() => handleInitiatePunch('in')}
            disabled={hasIn || submitting || !profile?.employee_id || !isOnline}
            className={`w-full py-8 px-6 rounded-3xl font-black flex flex-col items-center justify-center gap-2 transition-all shadow-xl select-none ${
              hasIn
                ? isDark
                  ? 'bg-slate-800/80 text-slate-400 border border-slate-700 cursor-not-allowed opacity-80'
                  : 'bg-slate-200 text-slate-500 border border-slate-300 cursor-not-allowed opacity-80'
                : 'bg-gradient-to-b from-emerald-500 to-emerald-700 text-white hover:from-emerald-400 hover:to-emerald-600 active:scale-95 ring-4 ring-emerald-500/30 cursor-pointer'
            }`}
          >
            {submitting && submittingType === 'in' ? (
              <Loader2 className="w-10 h-10 animate-spin" />
            ) : hasIn ? (
              <CheckCircle2 className="w-10 h-10 text-emerald-500" />
            ) : (
              <LogIn className="w-10 h-10" />
            )}

            <div className="text-center">
              <div className="text-2xl sm:text-3xl tracking-tight leading-tight">
                {hasIn ? `IN done ${inTimeFormatted}` : 'IN / ইন'}
              </div>
              <div className="text-xs font-normal opacity-85 mt-1 font-bangla">
                {hasIn ? 'আজকের ইন সম্পন্ন হয়েছে' : 'ক্যামেরা সেলফি ও জিপিএস দিয়ে প্রবেশ'}
              </div>
            </div>
          </button>

          {/* 2. BIG RED OUT BUTTON */}
          <button
            type="button"
            onClick={() => handleInitiatePunch('out')}
            disabled={!hasIn || hasOut || submitting || !profile?.employee_id || !isOnline}
            className={`w-full py-8 px-6 rounded-3xl font-black flex flex-col items-center justify-center gap-2 transition-all shadow-xl select-none ${
              !hasIn
                ? isDark
                  ? 'bg-slate-800/50 text-slate-500 border border-slate-700 cursor-not-allowed'
                  : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                : hasOut
                ? isDark
                  ? 'bg-slate-800/80 text-slate-400 border border-slate-700 cursor-not-allowed opacity-80'
                  : 'bg-slate-200 text-slate-500 border border-slate-300 cursor-not-allowed opacity-80'
                : 'bg-gradient-to-b from-rose-500 to-rose-700 text-white hover:from-rose-400 hover:to-rose-600 active:scale-95 ring-4 ring-rose-500/30 cursor-pointer animate-pulse'
            }`}
          >
            {submitting && submittingType === 'out' ? (
              <Loader2 className="w-10 h-10 animate-spin" />
            ) : hasOut ? (
              <CheckCircle2 className="w-10 h-10 text-rose-500" />
            ) : (
              <LogOut className="w-10 h-10" />
            )}

            <div className="text-center">
              <div className="text-2xl sm:text-3xl tracking-tight leading-tight">
                {hasOut
                  ? `OUT done ${outTimeFormatted}`
                  : !hasIn
                  ? 'OUT / আউট'
                  : 'OUT / আউট'}
              </div>
              <div className="text-xs font-normal opacity-85 mt-1 font-bangla">
                {!hasIn
                  ? '(আগে ইন পাঞ্চ করুন)'
                  : hasOut
                  ? 'আজকের আউট সম্পন্ন হয়েছে'
                  : 'ক্যামেরা সেলফি ও জিপিএস দিয়ে প্রস্থান'}
              </div>
            </div>
          </button>
        </div>

        {/* Informational Guidance */}
        <div className="flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400 py-1 text-center">
          <Camera className="w-4 h-4 text-[#2BA5B5] shrink-0" />
          <span>Selfie and GPS required on punch. Time is locked by factory server.</span>
        </div>

        {/* This Month's Own Attendance List */}
        <div
          className={`p-6 rounded-3xl border shadow-xl transition-all ${
            isDark ? 'bg-[#103A40]/80 border-white/5' : 'bg-white border-slate-200/90'
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <History className="w-5 h-5 text-[#2BA5B5]" />
                <span>This Month's Punch Log</span>
              </h2>
              <p className="text-xs font-bangla text-slate-500 dark:text-slate-400">
                চলতি মাসের আপনার ব্যক্তিগত হাজিরা রেকর্ড
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                loadTodayRecord();
                loadMonthlyRecords();
              }}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
              title="Refresh attendance records"
              aria-label="Refresh attendance records"
            >
              <RefreshCw className={`w-4 h-4 ${loadingMonthly ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {loadingMonthly ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-[#2BA5B5] mb-2" />
              <span className="text-xs">Loading monthly records...</span>
            </div>
          ) : monthlyRecords.length === 0 ? (
            <div className="py-10 text-center text-slate-400 border border-dashed rounded-2xl border-slate-300 dark:border-white/10">
              <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-semibold">No attendance records yet for this month.</p>
              <p className="text-xs font-bangla mt-0.5">এই মাসে এখনো কোনো হাজিরা রেকর্ড পাওয়া যায়নি।</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-white/10 text-slate-400 uppercase font-black tracking-wider">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">IN Time</th>
                    <th className="py-2.5 px-3">OUT Time</th>
                    <th className="py-2.5 px-3 text-center">Hours</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-medium">
                  {monthlyRecords.map((r) => {
                    const inTime = formatDhakaTime12(r.check_in_at);
                    const outTime = formatDhakaTime12(r.check_out_at);
                    const duration = calculateWorkingHoursBetween(r.check_in_at, r.check_out_at);

                    return (
                      <tr
                        key={r.id || r.att_date}
                        className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                      >
                        <td className="py-3 px-3 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                          {formatDhakaDateDisplay(r.att_date)}
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                          {inTime}
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">
                          {outTime}
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold whitespace-nowrap">
                          {duration}
                        </td>
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          {r.is_late ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                              LATE
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                              PRESENT
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default AttendancePunch;
