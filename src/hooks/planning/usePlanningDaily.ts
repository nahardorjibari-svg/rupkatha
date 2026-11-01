import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import type { PlanningDaily, DailyCellType } from '../../types/planning';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

export type DailyMatrix = Record<
  string, // order_id
  Record<
    string, // entry_date (YYYY-MM-DD)
    {
      input_qty: number | null;
      output_qty: number | null;
      wash_sent_qty: number | null;
      wash_recv_qty: number | null;
      finishing_qty: number | null;
      id?: string;
    }
  >
>;

interface UsePlanningDailyProps {
  orderIds: string[];
  startDateStr: string;
  endDateStr: string;
  onDataChanged?: () => void;
}

export function usePlanningDaily({
  orderIds,
  startDateStr,
  endDateStr,
  onDataChanged,
}: UsePlanningDailyProps) {
  const { profile } = useAuth();
  const [dailyData, setDailyData] = useState<DailyMatrix>({});
  const [loading, setLoading] = useState(false);
  const [flashedCells, setFlashedCells] = useState<Record<string, boolean>>({});
  const [savingCells, setSavingCells] = useState<Record<string, boolean>>({});
  const isMounted = useRef(true);

  // Load daily data for visible order IDs and date range
  const fetchDaily = useCallback(async () => {
    if (orderIds.length === 0) {
      setDailyData({});
      return;
    }

    try {
      const { data, error } = await supabase
        .from('planning_daily')
        .select('id, order_id, entry_date, input_qty, output_qty, wash_sent_qty, wash_recv_qty, finishing_qty, updated_at')
        .in('order_id', orderIds)
        .gte('entry_date', startDateStr)
        .lte('entry_date', endDateStr);

      if (error) throw error;

      const matrix: DailyMatrix = {};
      (data || []).forEach((row: PlanningDaily) => {
        if (!matrix[row.order_id]) {
          matrix[row.order_id] = {};
        }
        matrix[row.order_id][row.entry_date] = {
          input_qty: row.input_qty !== null && row.input_qty !== undefined ? Number(row.input_qty) : null,
          output_qty: row.output_qty !== null && row.output_qty !== undefined ? Number(row.output_qty) : null,
          wash_sent_qty: row.wash_sent_qty !== null && row.wash_sent_qty !== undefined ? Number(row.wash_sent_qty) : null,
          wash_recv_qty: row.wash_recv_qty !== null && row.wash_recv_qty !== undefined ? Number(row.wash_recv_qty) : null,
          finishing_qty: row.finishing_qty !== null && row.finishing_qty !== undefined ? Number(row.finishing_qty) : null,
          id: row.id,
        };
      });

      if (isMounted.current) {
        setDailyData(matrix);
      }
    } catch (err: any) {
      console.error('Error fetching planning daily:', err);
    }
  }, [orderIds, startDateStr, endDateStr]);

  useEffect(() => {
    isMounted.current = true;
    fetchDaily();

    return () => {
      isMounted.current = false;
    };
  }, [fetchDaily]);

  // Subscribe to realtime updates on planning_daily
  useEffect(() => {
    const channel = supabase
      .channel('realtime_planning_daily')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'planning_daily' },
        (payload) => {
          const newRow = payload.new as PlanningDaily;
          const oldRow = payload.old as PlanningDaily;
          const targetOrderId = newRow?.order_id || oldRow?.order_id;
          const targetDate = newRow?.entry_date || oldRow?.entry_date;

          if (!targetOrderId || !targetDate) return;

          // Check if active element is currently editing this cell
          const activeEl = document.activeElement;
          const activeCellKey = activeEl?.getAttribute('data-cell-key');
          const cellKeyInput = `${targetOrderId}_${targetDate}_input`;
          const cellKeyOutput = `${targetOrderId}_${targetDate}_output`;
          const cellKeyWashSent = `${targetOrderId}_${targetDate}_wash_sent`;
          const cellKeyWashRecv = `${targetOrderId}_${targetDate}_wash_recv`;
          const cellKeyFinishing = `${targetOrderId}_${targetDate}_finishing`;

          if (
            activeCellKey === cellKeyInput ||
            activeCellKey === cellKeyOutput ||
            activeCellKey === cellKeyWashSent ||
            activeCellKey === cellKeyWashRecv ||
            activeCellKey === cellKeyFinishing
          ) {
            // User is typing in this exact cell; do not overwrite typed value
            return;
          }

          // Trigger flash
          const flashKey = `${targetOrderId}_${targetDate}`;
          setFlashedCells((prev) => ({ ...prev, [flashKey]: true }));
          setTimeout(() => {
            if (isMounted.current) {
              setFlashedCells((prev) => {
                const next = { ...prev };
                delete next[flashKey];
                return next;
              });
            }
          }, 1000);

          // Update matrix
          setDailyData((prev) => {
            const currentOrder = prev[targetOrderId] || {};
            if (payload.eventType === 'DELETE') {
              const updatedOrder = { ...currentOrder };
              delete updatedOrder[targetDate];
              return { ...prev, [targetOrderId]: updatedOrder };
            }

            return {
              ...prev,
              [targetOrderId]: {
                ...currentOrder,
                [targetDate]: {
                  input_qty: newRow.input_qty !== null && newRow.input_qty !== undefined ? Number(newRow.input_qty) : null,
                  output_qty: newRow.output_qty !== null && newRow.output_qty !== undefined ? Number(newRow.output_qty) : null,
                  wash_sent_qty: newRow.wash_sent_qty !== null && newRow.wash_sent_qty !== undefined ? Number(newRow.wash_sent_qty) : null,
                  wash_recv_qty: newRow.wash_recv_qty !== null && newRow.wash_recv_qty !== undefined ? Number(newRow.wash_recv_qty) : null,
                  finishing_qty: newRow.finishing_qty !== null && newRow.finishing_qty !== undefined ? Number(newRow.finishing_qty) : null,
                  id: newRow.id,
                },
              },
            };
          });

          if (onDataChanged) {
            onDataChanged();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [onDataChanged]);

  // Upsert cell value
  const upsertDailyCell = useCallback(
    async (
      orderId: string,
      dateStr: string,
      type: DailyCellType,
      rawVal: string | number | null
    ) => {
      const cellKey = `${orderId}_${dateStr}_${type}`;
      const numVal =
        rawVal === '' || rawVal === null || rawVal === undefined
          ? null
          : Math.max(0, parseInt(String(rawVal), 10) || 0);

      // Check current values
      const currentCell = dailyData[orderId]?.[dateStr] || {
        input_qty: null,
        output_qty: null,
        wash_sent_qty: null,
        wash_recv_qty: null,
        finishing_qty: null,
      };

      const newInput = type === 'input' ? numVal : currentCell.input_qty;
      const newOutput = type === 'output' ? numVal : currentCell.output_qty;
      const newWashSent = type === 'wash_sent' ? numVal : currentCell.wash_sent_qty;
      const newWashRecv = type === 'wash_recv' ? numVal : currentCell.wash_recv_qty;
      const newFinishing = type === 'finishing' ? numVal : currentCell.finishing_qty;

      // If nothing changed, return
      if (
        (type === 'input' && currentCell.input_qty === numVal) ||
        (type === 'output' && currentCell.output_qty === numVal) ||
        (type === 'wash_sent' && currentCell.wash_sent_qty === numVal) ||
        (type === 'wash_recv' && currentCell.wash_recv_qty === numVal) ||
        (type === 'finishing' && currentCell.finishing_qty === numVal)
      ) {
        return;
      }

      // Optimistic update
      setDailyData((prev) => ({
        ...prev,
        [orderId]: {
          ...(prev[orderId] || {}),
          [dateStr]: {
            input_qty: newInput,
            output_qty: newOutput,
            wash_sent_qty: newWashSent,
            wash_recv_qty: newWashRecv,
            finishing_qty: newFinishing,
            id: currentCell.id,
          },
        },
      }));

      setSavingCells((prev) => ({ ...prev, [cellKey]: true }));

      try {
        if (
          newInput === null &&
          newOutput === null &&
          newWashSent === null &&
          newWashRecv === null &&
          newFinishing === null
        ) {
          // If all null, delete the row to keep table lean
          await supabase
            .from('planning_daily')
            .delete()
            .match({ order_id: orderId, entry_date: dateStr });
        } else {
          // Whitelist: input_qty, output_qty, wash_sent_qty, wash_recv_qty, finishing_qty
          const { error } = await supabase.from('planning_daily').upsert(
            {
              order_id: orderId,
              entry_date: dateStr,
              input_qty: newInput,
              output_qty: newOutput,
              wash_sent_qty: newWashSent,
              wash_recv_qty: newWashRecv,
              finishing_qty: newFinishing,
              entered_by: profile?.id || null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'order_id,entry_date' }
          );

          if (error) throw error;
        }

        if (onDataChanged) {
          onDataChanged();
        }
      } catch (err: any) {
        console.error('Error saving daily planning:', err);
        toast.error('Failed to save cell: ' + err.message);
        // Re-sync on failure
        fetchDaily();
      } finally {
        if (isMounted.current) {
          setSavingCells((prev) => {
            const next = { ...prev };
            delete next[cellKey];
            return next;
          });
        }
      }
    },
    [dailyData, profile?.id, onDataChanged, fetchDaily]
  );

  return {
    dailyData,
    loading,
    flashedCells,
    savingCells,
    upsertDailyCell,
    fetchDaily,
  };
}
