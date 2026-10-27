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
 */
export async function saveSewingReport({ reportDate, factoryUnit, lines, createdByName }) {
  try {
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
          created_by_name: createdByName || 'ERP User',
        })
        .select('id')
        .single();
      if (insertErr) throw insertErr;
      reportId = newRep.id;
    }

    for (const lineData of lines) {
      const { lineNo, buyerName, styleNo, op, hp, ir, totalTarget, hourTarget, remarks, hours, enteredByName } = lineData;
      
      const manpowerTotal = (op !== null && op !== undefined && !isNaN(Number(op)) ? Number(op) : 0) +
                            (hp !== null && hp !== undefined && !isNaN(Number(hp)) ? Number(hp) : 0);

      let { data: existingLine, error: lineFindErr } = await supabase
        .from('sewing_report_lines')
        .select('id')
        .eq('report_id', reportId)
        .eq('line_no', lineNo)
        .maybeSingle();

      if (lineFindErr) throw lineFindErr;

      let lineId;
      if (existingLine) {
        lineId = existingLine.id;
        const { error: lineUpdErr } = await supabase
          .from('sewing_report_lines')
          .update({
            buyer_name: buyerName || null,
            style_no: styleNo || null,
            op: op !== '' && op !== null ? Number(op) : null,
            hp: hp !== '' && hp !== null ? Number(hp) : null,
            ir: ir !== '' && ir !== null ? Number(ir) : null,
            manpower_total: manpowerTotal,
            total_target: totalTarget !== '' && totalTarget !== null ? Number(totalTarget) : null,
            hour_target: hourTarget !== '' && hourTarget !== null ? Number(hourTarget) : null,
            remarks: remarks || null,
            entered_by_name: enteredByName || 'ERP User',
            updated_at: new Date().toISOString(),
          })
          .eq('id', lineId);
        if (lineUpdErr) throw lineUpdErr;
      } else {
        const { data: newLine, error: lineInsErr } = await supabase
          .from('sewing_report_lines')
          .insert({
            report_id: reportId,
            line_no: lineNo,
            buyer_name: buyerName || null,
            style_no: styleNo || null,
            op: op !== '' && op !== null ? Number(op) : null,
            hp: hp !== '' && hp !== null ? Number(hp) : null,
            ir: ir !== '' && ir !== null ? Number(ir) : null,
            manpower_total: manpowerTotal,
            total_target: totalTarget !== '' && totalTarget !== null ? Number(totalTarget) : null,
            hour_target: hourTarget !== '' && hourTarget !== null ? Number(hourTarget) : null,
            remarks: remarks || null,
            entered_by_name: enteredByName || 'ERP User',
          })
          .select('id')
          .single();
        if (lineInsErr) throw lineInsErr;
        lineId = newLine.id;
      }

      if (hours && Array.isArray(hours)) {
        for (const hr of hours) {
          const { hourNo, backQty, frontQty, outputQty, asm } = hr;
          
          let { data: existingHour, error: hourFindErr } = await supabase
            .from('sewing_report_hours')
            .select('id')
            .eq('line_id', lineId)
            .eq('hour_no', hourNo)
            .maybeSingle();

          if (hourFindErr) throw hourFindErr;

          const hourPayload = {
            line_id: lineId,
            hour_no: hourNo,
            back_qty: backQty !== '' && backQty !== null && backQty !== undefined && !isNaN(Number(backQty)) ? Number(backQty) : null,
            front_qty: frontQty !== '' && frontQty !== null && frontQty !== undefined && !isNaN(Number(frontQty)) ? Number(frontQty) : null,
            output_qty: outputQty !== '' && outputQty !== null && outputQty !== undefined && !isNaN(Number(outputQty)) ? Number(outputQty) : null,
            asm: asm || null,
            entered_by_name: enteredByName || 'ERP User',
            updated_at: new Date().toISOString(),
          };

          if (existingHour) {
            const { error: updErr } = await supabase
              .from('sewing_report_hours')
              .update(hourPayload)
              .eq('id', existingHour.id);
            if (updErr) throw updErr;
          } else {
            const { error: insErr } = await supabase
              .from('sewing_report_hours')
              .insert(hourPayload);
            if (insErr) throw insErr;
          }
        }
      }
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
