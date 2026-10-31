import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import type { FactoryUnit } from '../../lib/constants';
import toast from 'react-hot-toast';

interface AddOrderDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderAdded: () => void;
  currentFactoryUnit: FactoryUnit;
}

interface ParsedColour {
  colour: string;
  qty: number;
}

export const AddOrderDrawer: React.FC<AddOrderDrawerProps> = ({
  isOpen,
  onClose,
  onOrderAdded,
  currentFactoryUnit,
}) => {
  const { profile } = useAuth();

  const [po, setPo] = useState('');
  const [style, setStyle] = useState('');
  const [wash, setWash] = useState('');
  const [orderQty, setOrderQty] = useState('');
  const [colourInput, setColourInput] = useState('');
  const [factoryUnit, setFactoryUnit] = useState<'knit' | 'woven'>(
    currentFactoryUnit === 'woven' ? 'woven' : 'knit'
  );
  const [lineNo, setLineNo] = useState('');
  const [startDate, setStartDate] = useState('');
  const [cuttingQty, setCuttingQty] = useState('');
  const [washSend, setWashSend] = useState('');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setPo('');
    setStyle('');
    setWash('');
    setOrderQty('');
    setColourInput('');
    setLineNo('');
    setStartDate('');
    setCuttingQty('');
    setWashSend('');
    setErrorMsg(null);
  };

  const handleClose = () => {
    if (isSubmitting) return;
    resetForm();
    onClose();
  };

  /**
   * Parse colour input according to specifications:
   * 1. If blank -> 1 row with colour='', qty=orderQty
   * 2. If numbers provided ("Black 400, Navy 400") -> sum must equal orderQty
   * 3. If no numbers ("Black, Navy, White") -> split orderQty equally, remainder to last
   */
  const parseColours = (
    totalQty: number,
    rawColours: string
  ): { colours: ParsedColour[]; error?: string } => {
    const trimmed = rawColours.trim();
    if (!trimmed) {
      return { colours: [{ colour: '', qty: totalQty }] };
    }

    const parts = trimmed
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);

    if (parts.length === 0) {
      return { colours: [{ colour: '', qty: totalQty }] };
    }

    // Check if parts have explicit quantities: e.g. "Black 400"
    let anyHasNumber = false;
    let allHaveNumber = true;

    const parsedItems: { name: string; qty?: number }[] = parts.map((part) => {
      // Matches colour name and trailing digits, e.g. "Black 400" or "Royal Blue 350"
      const match = part.match(/^(.*?)(?:\s+(\d+))$/);
      if (match) {
        anyHasNumber = true;
        return { name: match[1].trim(), qty: parseInt(match[2], 10) };
      } else {
        allHaveNumber = false;
        return { name: part };
      }
    });

    if (anyHasNumber) {
      if (!allHaveNumber) {
        return {
          colours: [],
          error:
            'Please specify quantity for all colours (e.g. "Black 400, Navy 600") or leave numbers out for equal split.',
        };
      }

      const sum = parsedItems.reduce((acc, curr) => acc + (curr.qty || 0), 0);
      if (sum !== totalQty) {
        const diff = Math.abs(sum - totalQty);
        const condition = sum < totalQty ? `${diff} short` : `${diff} extra`;
        return {
          colours: [],
          error: `Colour qty adds up to ${sum.toLocaleString()} but order qty is ${totalQty.toLocaleString()} (${condition}).`,
        };
      }

      return {
        colours: parsedItems.map((item) => ({
          colour: item.name,
          qty: item.qty || 0,
        })),
      };
    }

    // Equal split with remainder to last colour
    const count = parsedItems.length;
    const baseQty = Math.floor(totalQty / count);
    const remainder = totalQty - baseQty * count;

    const colours: ParsedColour[] = parsedItems.map((item, idx) => ({
      colour: item.name,
      qty: idx === count - 1 ? baseQty + remainder : baseQty,
    }));

    return { colours };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanPo = po.trim();
    if (!cleanPo) {
      setErrorMsg('PO number is required.');
      return;
    }

    const totalOrderQty = parseInt(orderQty, 10);
    if (isNaN(totalOrderQty) || totalOrderQty <= 0) {
      setErrorMsg('Please enter a valid positive Order Quantity.');
      return;
    }

    const { colours, error } = parseColours(totalOrderQty, colourInput);
    if (error) {
      setErrorMsg(error);
      return;
    }

    setIsSubmitting(true);

    try {
      const cutQty = parseInt(cuttingQty, 10) || 0;
      const wSend = parseInt(washSend, 10) || 0;

      // Create orders. Note: NEVER send is_done!
      const rowsToInsert = colours.map((c) => ({
        po: cleanPo,
        style: style.trim() || null,
        colour: c.colour,
        wash: wash.trim() || null,
        order_qty: c.qty,
        line_no: lineNo.trim(),
        start_date: startDate || null,
        cutting_qty: colours.length === 1 ? cutQty : 0, // if split colours, cutting can be entered per line
        wash_send: colours.length === 1 ? wSend : 0,
        factory_unit: factoryUnit,
        created_by: profile?.id || null,
      }));

      const { error: insertErr } = await supabase
        .from('planning_orders')
        .insert(rowsToInsert);

      if (insertErr) throw insertErr;

      toast.success(
        colours.length > 1
          ? `Added ${colours.length} colour order lines for PO: ${cleanPo}`
          : `Order PO: ${cleanPo} added successfully`
      );

      resetForm();
      onOrderAdded();
      onClose();
    } catch (err: any) {
      console.error('Error adding planning order:', err);
      setErrorMsg(err.message || 'Failed to add order to planning.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs"
          />

          {/* Slide-over panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 26, stiffness: 220 }}
            className="fixed top-0 bottom-0 right-0 z-50 w-full max-w-lg bg-white dark:bg-[#103A40] border-l border-slate-200 dark:border-white/10 shadow-2xl flex flex-col text-slate-900 dark:text-white"
          >
            {/* Header */}
            <div className="p-5 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold flex items-center gap-2">
                  <Plus className="w-5 h-5 text-[#2BA5B5]" />
                  Add Planning Order
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-bangla mt-0.5">
                  নতুন অর্ডার এন্ট্রি ও লাইন বরাদ্দ
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form
              onSubmit={handleSubmit}
              className="flex-1 p-5 space-y-4 overflow-y-auto scrollbar-custom"
            >
              {errorMsg && (
                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="font-medium leading-relaxed">{errorMsg}</span>
                </div>
              )}

              {/* Unit Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Factory Unit *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFactoryUnit('knit')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                      factoryUnit === 'knit'
                        ? 'bg-[#2BA5B5] text-white border-[#2BA5B5] shadow-xs'
                        : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10'
                    }`}
                  >
                    Knit Unit (নিট)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFactoryUnit('woven')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                      factoryUnit === 'woven'
                        ? 'bg-[#2BA5B5] text-white border-[#2BA5B5] shadow-xs'
                        : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10'
                    }`}
                  >
                    Woven Unit (ওভেন)
                  </button>
                </div>
              </div>

              {/* PO and Style */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    PO Number *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. PO-98124"
                    value={po}
                    onChange={(e) => setPo(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-black/20 focus:outline-none focus:ring-2 focus:ring-[#2BA5B5]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Style Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. RP-Polo-24"
                    value={style}
                    onChange={(e) => setStyle(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-black/20 focus:outline-none focus:ring-2 focus:ring-[#2BA5B5]"
                  />
                </div>
              </div>

              {/* Order Qty and Wash */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Total Order Qty *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="e.g. 1200"
                    value={orderQty}
                    onChange={(e) => setOrderQty(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-black/20 focus:outline-none focus:ring-2 focus:ring-[#2BA5B5]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Wash Type
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Silicon Wash / Enzyme"
                    value={wash}
                    onChange={(e) => setWash(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-black/20 focus:outline-none focus:ring-2 focus:ring-[#2BA5B5]"
                  />
                </div>
              </div>

              {/* Colour input with detailed instruction */}
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Colour Breakdown (কালার বিবরণ)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Black 400, Navy 400, White 400 or Black, Navy, White"
                  value={colourInput}
                  onChange={(e) => setColourInput(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-black/20 focus:outline-none focus:ring-2 focus:ring-[#2BA5B5]"
                />
                <div className="mt-1.5 p-2.5 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
                  <p className="font-semibold text-slate-700 dark:text-slate-300">
                    💡 Colour input options:
                  </p>
                  <p>
                    • With quantities: <code className="text-[#2BA5B5] font-mono">Black 400, Navy 400, White 400</code> (must sum exactly to order qty).
                  </p>
                  <p>
                    • Names only: <code className="text-[#2BA5B5] font-mono">Black, Navy, White</code> (auto-splits total order quantity).
                  </p>
                  <p>• Leave empty if single color or color not specified.</p>
                </div>
              </div>

              {/* Line Allocation and Start Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Line Allocation
                  </label>
                  <select
                    value={lineNo}
                    onChange={(e) => setLineNo(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-black/20 focus:outline-none focus:ring-2 focus:ring-[#2BA5B5]"
                  >
                    <option value="">No line yet (Upcoming)</option>
                    <option value="Line-1">Line-1</option>
                    <option value="Line-2">Line-2</option>
                    <option value="Line-3">Line-3</option>
                    <option value="Line-4">Line-4</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Plan Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-black/20 focus:outline-none focus:ring-2 focus:ring-[#2BA5B5]"
                  />
                </div>
              </div>

              {/* Initial Cutting & Wash Send */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Cutting Qty (কাটিং পরিমাণ)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={cuttingQty}
                    onChange={(e) => setCuttingQty(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-black/20 focus:outline-none focus:ring-2 focus:ring-[#2BA5B5]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Wash Send (ওয়াশ পাঠানো)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={washSend}
                    onChange={(e) => setWashSend(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-black/20 focus:outline-none focus:ring-2 focus:ring-[#2BA5B5]"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="pt-4 border-t border-slate-200 dark:border-white/10 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-md bg-[#2BA5B5] hover:bg-[#228f9d] disabled:opacity-50 transition-all cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving Order...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Add Order
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
