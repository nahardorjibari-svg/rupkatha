/**
 * Sewing ERP Data Queries & Realtime Subscriptions (Real Data Only)
 * Rupkatha Apparels Ltd. (src/lib/sewingQueries.js)
 */
import { supabase } from './supabaseClient';

/**
 * Fetch sewing reports for a given date and optional factory unit.
 */
export async function fetchSewingReports({ date, unit = 'all' }) {
  try {
    let query = supabase
      .from('sewing_reports')
      .select(`
        id,
        report_date,
        factory_unit,
        created_by_name,
        created_at,
        updated_at,
        sewing_report_lines (
          id,
          report_id,
          line_no,
          buyer_name,
          style_no,
          op,
          hp,
          ir,
          manpower_total,
          total_target,
          hour_target,
          back_hour_target,
          front_hour_target,
          output_hour_target,
          asm_hour_target,
          working_hours,
          remarks,
          entered_by_name,
          updated_at,
          sewing_report_hours (
            id,
            line_id,
            hour_no,
            back_qty,
            front_qty,
            output_qty,
            asm,
            entered_by_name,
            updated_at
          )
        )
      `);

    if (date) {
      query = query.eq('report_date', date);
    }
    if (unit && unit !== 'all') {
      query = query.eq('factory_unit', unit);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching sewing reports:', error.message);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    return data.map(r => ({
      ...r,
      lines: (r.sewing_report_lines || []).map(l => ({
        ...l,
        hours: (l.sewing_report_hours || []).sort((a, b) => a.hour_no - b.hour_no),
      })).sort((a, b) => a.line_no - b.line_no),
    }));
  } catch (err) {
    console.error('Exception fetching sewing reports:', err);
    return [];
  }
}

/**
 * Fetch hour locks for a report
 */
export async function fetchHourLocks(reportId) {
  if (!reportId) return [];
  try {
    const { data, error } = await supabase
      .from('sewing_hour_locks')
      .select('*')
      .eq('report_id', reportId);

    if (error) {
      console.error('Error fetching hour locks:', error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('Exception fetching hour locks:', err);
    return [];
  }
}

/**
 * Submit and lock an hour for a report
 */
export async function submitHourLock(reportId, hourNo) {
  try {
    const { data, error } = await supabase
      .from('sewing_hour_locks')
      .insert({ report_id: reportId, hour_no: hourNo })
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (err) {
    console.error('Failed to submit hour lock:', err);
    throw err;
  }
}

/**
 * Reopen (delete) an hour lock (Admin only)
 */
export async function reopenHourLock(reportId, hourNo) {
  try {
    const { error } = await supabase
      .from('sewing_hour_locks')
      .delete()
      .eq('report_id', reportId)
      .eq('hour_no', hourNo);

    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.error('Failed to reopen hour lock:', err);
    throw err;
  }
}

/**
 * Fetch edit logs for a report including after_submit flag
 */
export async function fetchEditLogs(reportId) {
  if (!reportId) return [];
  try {
    const { data, error } = await supabase
      .from('sewing_edit_log')
      .select('*')
      .eq('report_id', reportId)
      .order('edited_at', { ascending: false });

    if (error) {
      console.error('Error fetching edit logs:', error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('Exception fetching edit logs:', err);
    return [];
  }
}

/**
 * Upsert or create a sewing report with lines and hours.
 * Uses strict whitelists and upsert with onConflict.
 */
export async function saveSewingReport({ reportDate, factoryUnit, lines, createdByName }) {
  try {
    const toIntOrNull = (val) => {
      if (val === '' || val === null || val === undefined) return null;
      const n = parseInt(val, 10);
      return isNaN(n) ? null : n;
    };

    const toStrOrNull = (val) => {
      if (val === '' || val === null || val === undefined) return null;
      const s = String(val).trim();
      return s.length > 0 ? s : null;
    };

    // 1. Find or create sewing_report
    let { data: existingRep, error: findErr } = await supabase
      .from('sewing_reports')
      .select('id')
      .eq('report_date', reportDate)
      .eq('factory_unit', factoryUnit)
      .maybeSingle();

    if (findErr) throw findErr;

    let reportId;
    if (existingRep) {
      reportId = existingRep.id;
      const { error: updateErr } = await supabase
        .from('sewing_reports')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', reportId);
      if (updateErr) throw updateErr;
    } else {
      const { data: newRep, error: insertErr } = await supabase
        .from('sewing_reports')
        .insert({
          report_date: reportDate,
          factory_unit: factoryUnit,
          status: 'draft',
          created_by_name: createdByName || 'ERP User',
        })
        .select('id')
        .single();
      if (insertErr) throw insertErr;
      reportId = newRep.id;
    }

    // 2. Build whitelist payload for sewing_report_lines
    // ONLY: report_id, line_no, buyer_name, style_no, op, hp, ir, back_hour_target, front_hour_target, output_hour_target, asm_hour_target, working_hours, remarks
    const linePayloads = lines.map((l) => ({
      report_id: reportId,
      line_no: parseInt(l.lineNo ?? l.line_no, 10),
      buyer_name: toStrOrNull(l.buyerName ?? l.buyer_name),
      style_no: toStrOrNull(l.styleNo ?? l.style_no),
      op: toIntOrNull(l.op),
      hp: toIntOrNull(l.hp),
      ir: toIntOrNull(l.ir),
      back_hour_target: toIntOrNull(l.backHourTarget ?? l.back_hour_target),
      front_hour_target: toIntOrNull(l.frontHourTarget ?? l.front_hour_target),
      output_hour_target: toIntOrNull(l.outputHourTarget ?? l.output_hour_target),
      asm_hour_target: toIntOrNull(l.asmHourTarget ?? l.asm_hour_target),
      working_hours: toIntOrNull(l.workingHours ?? l.working_hours) || 8,
      remarks: toStrOrNull(l.remarks),
    }));

    const { data: savedLines, error: linesErr } = await supabase
      .from('sewing_report_lines')
      .upsert(linePayloads, { onConflict: 'report_id,line_no' })
      .select('id, line_no');

    if (linesErr) throw linesErr;

    const lineIdByNo = new Map((savedLines || []).map((sl) => [sl.line_no, sl.id]));

    // 3. Build whitelist payload for sewing_report_hours
    // ONLY: line_id, hour_no, back_qty, front_qty, output_qty, asm
    const hoursPayloads = [];
    for (const l of lines) {
      const lineNo = parseInt(l.lineNo ?? l.line_no, 10);
      const lineId = lineIdByNo.get(lineNo);
      if (!lineId || !l.hours || !Array.isArray(l.hours)) continue;

      for (const h of l.hours) {
        hoursPayloads.push({
          line_id: lineId,
          hour_no: parseInt(h.hourNo ?? h.hour_no, 10),
          back_qty: toIntOrNull(h.backQty ?? h.back_qty),
          front_qty: toIntOrNull(h.frontQty ?? h.front_qty),
          output_qty: toIntOrNull(h.outputQty ?? h.output_qty),
          asm: toStrOrNull(h.asm),
        });
      }
    }

    if (hoursPayloads.length > 0) {
      const { error: hoursErr } = await supabase
        .from('sewing_report_hours')
        .upsert(hoursPayloads, { onConflict: 'line_id,hour_no' });

      if (hoursErr) throw hoursErr;
    }

    return { success: true, reportId };
  } catch (err) {
    console.error('Failed to save sewing report:', err);
    throw err;
  }
}

/**
 * Subscribe to realtime changes on sewing report tables and hour locks
 */
export function subscribeSewingRealtime(onUpdate) {
  try {
    const channel = supabase
      .channel('sewing-realtime-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sewing_report_hours' },
        () => { onUpdate(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sewing_report_lines' },
        () => { onUpdate(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sewing_report_locks' },
        () => { onUpdate(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sewing_hour_locks' },
        () => { onUpdate(); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  } catch {
    return () => {};
  }
}
