/**
 * Finishing ERP Data Queries (Merged into Sewing Module)
 * Rupkatha Apparels Ltd. (src/lib/finishingQueries.js)
 */
import { supabase } from './supabaseClient';

/**
 * Fetch finishing reports for a given date and optional factory unit.
 */
export async function fetchFinishingReports({ date, unit = 'all' }) {
  try {
    let query = supabase
      .from('finishing_reports')
      .select(`
        id,
        report_date,
        factory_unit,
        created_by_name,
        created_at,
        updated_at,
        finishing_report_lines (
          id,
          report_id,
          line_no,
          buyer_name,
          style_no,
          order_qty,
          op,
          hp,
          ir,
          quality_man,
          folding_man,
          poly_man,
          packing_man,
          back_hour_target: inside_hour_target,
          front_hour_target: iron_hour_target,
          output_hour_target: topside_hour_target,
          asm_hour_target: poly_hour_target,
          working_hours,
          remarks,
          line_chief_name,
          line_chief_phone,
          updated_at,
          finishing_report_hours (
            id,
            line_id,
            hour_no,
            back_qty: inside_qty,
            front_qty: iron_qty,
            output_qty: topside_qty,
            asm: poly_qty,
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
      console.error('Error fetching finishing reports:', error.message);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    return data.map(r => ({
      ...r,
      lines: (r.finishing_report_lines || []).map(l => ({
        ...l,
        hours: (l.finishing_report_hours || []).sort((a, b) => a.hour_no - b.hour_no),
      })).sort((a, b) => a.line_no - b.line_no),
    }));
  } catch (err) {
    console.error('Exception fetching finishing reports:', err);
    return [];
  }
}

/**
 * Fetch hour locks for a finishing report
 */
export async function fetchFinishingHourLocks(reportId) {
  if (!reportId) return [];
  try {
    const { data, error } = await supabase
      .from('finishing_hour_locks')
      .select('*')
      .eq('report_id', reportId);

    if (error) {
      console.error('Error fetching finishing hour locks:', error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('Exception fetching finishing hour locks:', err);
    return [];
  }
}

/**
 * Fetch edit logs for a finishing report
 */
export async function fetchFinishingEditLogs(reportId) {
  if (!reportId) return [];
  try {
    const { data, error } = await supabase
      .from('finishing_edit_log')
      .select('*')
      .eq('report_id', reportId)
      .order('edited_at', { ascending: false });

    if (error) {
      console.error('Error fetching finishing edit logs:', error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('Exception fetching finishing edit logs:', err);
    return [];
  }
}

/**
 * Upsert or create a finishing report.
 */
export async function saveFinishingReport({ reportDate, factoryUnit, line, createdByName }) {
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

    // 1. Find or create finishing_report
    let { data: existingRep, error: findErr } = await supabase
      .from('finishing_reports')
      .select('id')
      .eq('report_date', reportDate)
      .eq('factory_unit', factoryUnit)
      .maybeSingle();

    if (findErr) throw findErr;

    let reportId;
    if (existingRep) {
      reportId = existingRep.id;
      const { error: updateErr } = await supabase
        .from('finishing_reports')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', reportId);
      if (updateErr) throw updateErr;
    } else {
      const { data: newRep, error: insertErr } = await supabase
        .from('finishing_reports')
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

    // 2. Upsert finishing_report_lines (Line 1 only)
    const linePayload = {
      report_id: reportId,
      line_no: 1,
      buyer_name: toStrOrNull(line.buyerName ?? line.buyer_name),
      style_no: toStrOrNull(line.styleNo ?? line.style_no),
      order_qty: toIntOrNull(line.orderQty ?? line.order_qty),
      op: toIntOrNull(line.op),
      hp: toIntOrNull(line.hp),
      ir: toIntOrNull(line.ir),
      quality_man: toIntOrNull(line.qualityMan ?? line.quality_man),
      folding_man: toIntOrNull(line.foldingMan ?? line.folding_man),
      poly_man: toIntOrNull(line.polyMan ?? line.poly_man),
      packing_man: toIntOrNull(line.packingMan ?? line.packing_man),
      inside_hour_target: toIntOrNull(line.backHourTarget ?? line.back_hour_target),
      iron_hour_target: toIntOrNull(line.frontHourTarget ?? line.front_hour_target),
      topside_hour_target: toIntOrNull(line.outputHourTarget ?? line.output_hour_target),
      poly_hour_target: toIntOrNull(line.asmHourTarget ?? line.asm_hour_target),
      working_hours: toIntOrNull(line.workingHours ?? line.working_hours) || 8,
      remarks: toStrOrNull(line.remarks),
      line_chief_name: toStrOrNull(line.lineChiefName ?? line.line_chief_name),
      line_chief_phone: toStrOrNull(line.lineChiefPhone ?? line.line_chief_phone),
    };

    const { data: savedLines, error: linesErr } = await supabase
      .from('finishing_report_lines')
      .upsert([linePayload], { onConflict: 'report_id,line_no' })
      .select('id');

    if (linesErr) throw linesErr;
    const lineId = savedLines[0].id;

    // 3. Upsert finishing_report_hours
    if (line.hours && Array.isArray(line.hours)) {
      const hoursPayloads = line.hours.map((h) => ({
        line_id: lineId,
        hour_no: parseInt(h.hourNo ?? h.hour_no, 10),
        inside_qty: toIntOrNull(h.backQty ?? h.back_qty),
        iron_qty: toIntOrNull(h.frontQty ?? h.front_qty),
        topside_qty: toIntOrNull(h.outputQty ?? h.output_qty),
        poly_qty: toIntOrNull(h.asm),
      }));

      const { error: hoursErr } = await supabase
        .from('finishing_report_hours')
        .upsert(hoursPayloads, { onConflict: 'line_id,hour_no' });

      if (hoursErr) throw hoursErr;
    }

    return { success: true, reportId };
  } catch (err) {
    console.error('Failed to save finishing report:', err);
    throw err;
  }
}
