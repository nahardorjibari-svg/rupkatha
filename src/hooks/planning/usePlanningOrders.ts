import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import type { PlanningOrder } from '../../types/planning';
import type { FactoryUnit } from '../../lib/constants';
import toast from 'react-hot-toast';

interface UsePlanningOrdersProps {
  factoryUnit: FactoryUnit;
}

export function usePlanningOrders({ factoryUnit }: UsePlanningOrdersProps) {
  const [orders, setOrders] = useState<PlanningOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);

  const fetchOrders = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('planning_orders_with_status')
        .select('*')
        .order('created_at', { ascending: false });

      if (factoryUnit === 'knit' || factoryUnit === 'woven') {
        query = query.eq('factory_unit', factoryUnit);
      }

      const { data, error: fetchErr } = await query;
      if (fetchErr) throw fetchErr;

      if (isMounted.current) {
        setOrders(data || []);
      }
    } catch (err: any) {
      if (isMounted.current) {
        console.error('Error fetching planning orders:', err);
        setError(err.message || 'Failed to load planning orders');
      }
    } finally {
      if (isMounted.current && showLoading) {
        setLoading(false);
      }
    }
  }, [factoryUnit]);

  useEffect(() => {
    isMounted.current = true;
    fetchOrders(true);

    // Subscribe to realtime changes on planning_orders
    const channel = supabase
      .channel('realtime_planning_orders')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'planning_orders' },
        () => {
          // Re-fetch view to compute updated totals and is_done status
          fetchOrders(false);
        }
      )
      .subscribe();

    return () => {
      isMounted.current = false;
      supabase.removeChannel(channel);
    };
  }, [fetchOrders]);

  const updateOrder = useCallback(
    async (
      orderId: string,
      updates: Partial<Omit<PlanningOrder, 'id' | 'is_done' | 'total_input' | 'total_output'>>
    ) => {
      // Optimistic local update
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, ...updates } : o))
      );

      try {
        // Strip forbidden fields
        const cleanUpdates: any = { ...updates };
        delete cleanUpdates.is_done;
        delete cleanUpdates.total_input;
        delete cleanUpdates.total_output;
        cleanUpdates.updated_at = new Date().toISOString();

        const { error: updateErr } = await supabase
          .from('planning_orders')
          .update(cleanUpdates)
          .eq('id', orderId);

        if (updateErr) throw updateErr;
      } catch (err: any) {
        console.error('Error updating planning order:', err);
        toast.error('Failed to save order change: ' + err.message);
        // Revert on error
        fetchOrders(false);
        throw err;
      }
    },
    [fetchOrders]
  );

  const deleteOrder = useCallback(
    async (orderId: string) => {
      try {
        const { error: delErr } = await supabase
          .from('planning_orders')
          .delete()
          .eq('id', orderId);

        if (delErr) throw delErr;

        setOrders((prev) => prev.filter((o) => o.id !== orderId));
        toast.success('Order removed successfully');
      } catch (err: any) {
        console.error('Error deleting planning order:', err);
        toast.error('Failed to delete order: ' + err.message);
        throw err;
      }
    },
    []
  );

  return {
    orders,
    loading,
    error,
    refreshOrders: () => fetchOrders(false),
    updateOrder,
    deleteOrder,
  };
}
