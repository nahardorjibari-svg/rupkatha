import React, { useEffect, useMemo, useState } from 'react';
import { Palette, Plus, Ruler, Trash2, X } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { formatNumberBD } from '../../lib/storeFormat';
import type { OrderColorSize } from '../../types/merchandising';

const PRESET_COLORS = [
  'VINTAGE BLACK',
  'WHITE',
  'CLOUDY GREY',
  'NAVY BLUE',
  'OLIVE GREEN',
  'MAROON',
] as const;

const STANDARD_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'] as const;

const SIZE_SORT_ORDER: Record<string, number> = {
  XXS: 1,
  XS: 2,
  S: 3,
  M: 4,
  L: 5,
  XL: 6,
  XXL: 7,
  '2XL': 7,
  '3XL': 8,
  XXXL: 8,
  '4XL': 9,
};

function sortSizes(sizes: string[]): string[] {
  return [...sizes].sort((a, b) => {
    const ua = a.toUpperCase();
    const ub = b.toUpperCase();
    const oa = SIZE_SORT_ORDER[ua];
    const ob = SIZE_SORT_ORDER[ub];
    if (oa !== undefined && ob !== undefined) return oa - ob;
    if (oa !== undefined) return -1;
    if (ob !== undefined) return 1;
    const na = Number(a);
    const nb = Number(b);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
    return a.localeCompare(b);
  });
}

export interface ColorSizeMatrixProps {
  rows: OrderColorSize[];
  onChange?: (nextRows: OrderColorSize[], totalQty: number) => void;
  readOnly?: boolean;
}

export const ColorSizeMatrix: React.FC<ColorSizeMatrixProps> = ({
  rows,
  onChange,
  readOnly = false,
}) => {
  const { isDark } = useTheme();

  const [colors, setColors] = useState<string[]>([]);
  const [sizes, setSizes] = useState<string[]>([]);
  const [qtyMap, setQtyMap] = useState<Record<string, number>>({});

  const [newColorInput, setNewColorInput] = useState('');
  const [customSizeInput, setCustomSizeInput] = useState('');

  // Sync internal matrix structure when external rows change (e.g. opening Edit modal or viewing ReadOnly)
  useEffect(() => {
    const colorList: string[] = [];
    const colorSet = new Set<string>();
    const sizeSet = new Set<string>();
    const nextQtyMap: Record<string, number> = {};

    rows.forEach((r) => {
      const c = (r.color_name || '').trim().toUpperCase();
      const s = (r.size_name || '').trim().toUpperCase();
      const q = Math.max(0, Math.round(Number(r.ratio_qty || 0)));
      if (!c || !s) return;
      if (!colorSet.has(c)) {
        colorSet.add(c);
        colorList.push(c);
      }
      sizeSet.add(s);
      nextQtyMap[`${c}::${s}`] = (nextQtyMap[`${c}::${s}`] || 0) + q;
    });

    if (readOnly) {
      setColors(colorList);
      setSizes(sortSizes(Array.from(sizeSet)));
      setQtyMap(nextQtyMap);
    } else {
      setColors((prev) => {
        if (colorList.length === 0 && prev.length === 0) return [];
        const merged = [...prev];
        colorList.forEach((c) => {
          if (!merged.includes(c)) merged.push(c);
        });
        return colorList.length > 0 && prev.length === 0 ? colorList : merged;
      });
      setSizes((prev) => {
        if (sizeSet.size === 0 && prev.length === 0) return ['S', 'M', 'L', 'XL'];
        const merged = new Set(prev);
        sizeSet.forEach((s) => merged.add(s));
        return sortSizes(Array.from(merged));
      });
      setQtyMap((prev) => {
        // When opening edit with populated rows, adopt incoming map cleanly
        if (Object.keys(nextQtyMap).length > 0) return nextQtyMap;
        return prev;
      });
    }
  }, [rows, readOnly]);

  const emitChange = (
    nextColors: string[],
    nextSizes: string[],
    nextQtyMap: Record<string, number>
  ) => {
    if (!onChange) return;
    const nextRows: OrderColorSize[] = [];
    let total = 0;

    nextColors.forEach((c) => {
      nextSizes.forEach((s) => {
        const val = Math.max(0, Math.round(Number(nextQtyMap[`${c}::${s}`] || 0)));
        if (val > 0) {
          nextRows.push({
            color_name: c,
            size_name: s,
            ratio_qty: val,
          });
          total += val;
        }
      });
    });

    onChange(nextRows, total);
  };

  const handleAddColor = (rawName: string) => {
    const clean = rawName.trim().toUpperCase();
    if (!clean) return;
    if (colors.includes(clean)) {
      setNewColorInput('');
      return;
    }
    const nextColors = [...colors, clean];
    const nextSizes = sizes.length > 0 ? sizes : ['S', 'M', 'L', 'XL'];
    setColors(nextColors);
    if (sizes.length === 0) setSizes(nextSizes);
    setNewColorInput('');
    emitChange(nextColors, nextSizes, qtyMap);
  };

  const handleRemoveColor = (colorToRemove: string) => {
    const nextColors = colors.filter((c) => c !== colorToRemove);
    const nextMap: Record<string, number> = {};
    Object.entries(qtyMap).forEach(([k, v]) => {
      if (!k.startsWith(`${colorToRemove}::`)) nextMap[k] = v;
    });
    setColors(nextColors);
    setQtyMap(nextMap);
    emitChange(nextColors, sizes, nextMap);
  };

  const handleToggleSize = (sizeName: string) => {
    const clean = sizeName.trim().toUpperCase();
    if (!clean) return;
    let nextSizes: string[];
    let nextMap = { ...qtyMap };

    if (sizes.includes(clean)) {
      nextSizes = sizes.filter((s) => s !== clean);
      Object.keys(nextMap).forEach((k) => {
        if (k.endsWith(`::${clean}`)) delete nextMap[k];
      });
    } else {
      nextSizes = sortSizes([...sizes, clean]);
    }

    setSizes(nextSizes);
    setQtyMap(nextMap);
    emitChange(colors, nextSizes, nextMap);
  };

  const handleAddCustomSize = () => {
    const clean = customSizeInput.trim().toUpperCase();
    if (!clean) return;
    if (!sizes.includes(clean)) {
      const nextSizes = sortSizes([...sizes, clean]);
      setSizes(nextSizes);
      emitChange(colors, nextSizes, qtyMap);
    }
    setCustomSizeInput('');
  };

  const handleCellChange = (color: string, size: string, rawVal: string) => {
    const parsed = rawVal === '' ? 0 : Math.max(0, Math.round(Number(rawVal) || 0));
    const nextMap = {
      ...qtyMap,
      [`${color}::${size}`]: parsed,
    };
    setQtyMap(nextMap);
    emitChange(colors, sizes, nextMap);
  };

  const totals = useMemo(() => {
    const byColor: Record<string, number> = {};
    const bySize: Record<string, number> = {};
    let grandTotal = 0;

    colors.forEach((c) => {
      let cSum = 0;
      sizes.forEach((s) => {
        const val = Math.max(0, Math.round(Number(qtyMap[`${c}::${s}`] || 0)));
        cSum += val;
        bySize[s] = (bySize[s] || 0) + val;
        grandTotal += val;
      });
      byColor[c] = cSum;
    });

    return { byColor, bySize, grandTotal };
  }, [colors, sizes, qtyMap]);

  const inputClass = `px-3 py-1.5 text-xs rounded-xl border transition-all focus:outline-none focus:ring-2 focus:ring-[#2BA5B5] ${
    isDark
      ? 'bg-[#0B2E33] border-white/15 text-white placeholder:text-slate-400'
      : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'
  }`;

  if (readOnly) {
    if (colors.length === 0 || sizes.length === 0) {
      return (
        <div
          className={`rounded-xl border p-6 text-center text-xs ${
            isDark
              ? 'bg-white/5 border-white/10 text-slate-400'
              : 'bg-slate-50 border-slate-200 text-slate-500'
          }`}
        >
          <Palette className="w-6 h-6 mx-auto mb-1.5 opacity-45" />
          <p className="font-semibold">No Colour &amp; Size breakdown recorded for this order yet.</p>
          <p className="font-bangla text-[11px] opacity-75 mt-0.5">
            অর্ডার এডিট করে কালার ও সাইজ অনুপাত যোগ করা যাবে
          </p>
        </div>
      );
    }

    return (
      <div
        className={`rounded-xl border overflow-hidden ${
          isDark ? 'border-white/10 bg-[#0B2E33]/70' : 'border-slate-200 bg-white'
        }`}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr
                className={`border-b ${
                  isDark
                    ? 'bg-white/5 border-white/10 text-slate-300'
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                <th className="py-2.5 px-3 text-left font-bold">Garment Colour</th>
                {sizes.map((s) => (
                  <th key={s} className="py-2.5 px-2.5 text-right font-bold tabular-nums">
                    {s}
                  </th>
                ))}
                <th className="py-2.5 px-3 text-right font-extrabold text-[#0F8B8D] dark:text-[#2BA5B5]">
                  Colour Total
                </th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-white/5' : 'divide-slate-100'}`}>
              {colors.map((c) => {
                const rowTotal = totals.byColor[c] || 0;
                const pct =
                  totals.grandTotal > 0 ? ((rowTotal / totals.grandTotal) * 100).toFixed(1) : '0.0';
                return (
                  <tr key={c} className="hover:bg-slate-50/70 dark:hover:bg-white/5">
                    <td className="py-2.5 px-3 font-bold">
                      <span>{c}</span>
                      <span className="ml-1.5 text-[10px] font-normal opacity-65 tabular-nums">
                        ({pct}%)
                      </span>
                    </td>
                    {sizes.map((s) => {
                      const val = qtyMap[`${c}::${s}`] || 0;
                      return (
                        <td
                          key={s}
                          className={`py-2.5 px-2.5 text-right tabular-nums ${
                            val > 0 ? 'font-semibold' : 'opacity-40'
                          }`}
                        >
                          {val > 0 ? formatNumberBD(val) : '-'}
                        </td>
                      );
                    })}
                    <td className="py-2.5 px-3 text-right font-extrabold tabular-nums text-[#0F8B8D] dark:text-[#2BA5B5]">
                      {formatNumberBD(rowTotal)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr
                className={`border-t font-extrabold ${
                  isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <td className="py-2.5 px-3">Size Total ({colors.length} Colours)</td>
                {sizes.map((s) => (
                  <td key={s} className="py-2.5 px-2.5 text-right tabular-nums">
                    {formatNumberBD(totals.bySize[s] || 0)}
                  </td>
                ))}
                <td className="py-2.5 px-3 text-right tabular-nums text-[#0F8B8D] dark:text-[#2BA5B5]">
                  {formatNumberBD(totals.grandTotal)} PCS
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl border p-4 space-y-3.5 ${
        isDark ? 'bg-[#0B2E33]/80 border-white/15' : 'bg-slate-50/90 border-slate-200'
      }`}
    >
      {/* Matrix Section Title */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#0F8B8D]/15 text-[#0F8B8D] dark:text-[#2BA5B5] flex items-center justify-center">
            <Palette className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-extrabold tracking-tight">
              Colour &amp; Size Breakdown Matrix
            </h3>
            <p className="text-[10px] font-bangla opacity-70">
              কালার ও সাইজ অনুযায়ী সংখ্যা দিন — মোট অর্ডার পরিমাণ স্বয়ংক্রিয়ভাবে আপডেট হবে
            </p>
          </div>
        </div>

        <div className="text-xs font-bold tabular-nums">
          Matrix Sum:{' '}
          <span className="text-[#0F8B8D] dark:text-[#2BA5B5] font-extrabold">
            {formatNumberBD(totals.grandTotal)} PCS
          </span>
        </div>
      </div>

      {/* Add Colour Controls */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={newColorInput}
            onChange={(e) => setNewColorInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddColor(newColorInput);
              }
            }}
            placeholder="Enter Garment Colour (e.g. VINTAGE BLACK)"
            className={`${inputClass} flex-1 min-w-[200px] uppercase`}
          />
          <button
            type="button"
            onClick={() => handleAddColor(newColorInput)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0F8B8D] hover:bg-[#0b6f71] text-white text-xs font-bold cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Colour
          </button>
        </div>

        {/* Quick Preset Colours */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-semibold opacity-65 mr-1">Quick Colours:</span>
          {PRESET_COLORS.map((preset) => {
            const added = colors.includes(preset);
            return (
              <button
                key={preset}
                type="button"
                disabled={added}
                onClick={() => handleAddColor(preset)}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                  added
                    ? 'bg-[#0F8B8D]/15 border-[#0F8B8D]/30 text-[#0F8B8D] dark:text-[#2BA5B5] opacity-60 cursor-default'
                    : isDark
                    ? 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-300'
                    : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-700'
                }`}
              >
                {added ? `✓ ${preset}` : `+ ${preset}`}
              </button>
            );
          })}
        </div>
      </div>

      {/* Size Selector Bar */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-200/40 dark:border-white/10">
        <span className="inline-flex items-center gap-1 text-[10px] font-bold opacity-70 mr-1">
          <Ruler className="w-3 h-3" />
          Sizes:
        </span>
        {STANDARD_SIZES.map((s) => {
          const active = sizes.includes(s);
          return (
            <button
              key={s}
              type="button"
              onClick={() => handleToggleSize(s)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                active
                  ? 'bg-[#0F8B8D] border-[#0F8B8D] text-white shadow-xs'
                  : isDark
                  ? 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {s}
            </button>
          );
        })}

        {/* Custom sizes added outside standard list */}
        {sizes
          .filter((s) => !(STANDARD_SIZES as readonly string[]).includes(s))
          .map((custom) => (
            <button
              key={custom}
              type="button"
              onClick={() => handleToggleSize(custom)}
              title="Click to remove size"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#2BA5B5] text-white cursor-pointer"
            >
              <span>{custom}</span>
              <X className="w-3 h-3" />
            </button>
          ))}

        {/* Custom Size Input */}
        <div className="inline-flex items-center gap-1 ml-auto">
          <input
            type="text"
            value={customSizeInput}
            onChange={(e) => setCustomSizeInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddCustomSize();
              }
            }}
            placeholder="Custom (e.g. 32)"
            className={`${inputClass} w-28 py-1 text-[11px] uppercase`}
          />
          <button
            type="button"
            onClick={handleAddCustomSize}
            className="px-2.5 py-1 rounded-lg text-[11px] font-bold border border-[#2BA5B5]/40 text-[#0F8B8D] dark:text-[#2BA5B5] hover:bg-[#2BA5B5]/10 cursor-pointer"
          >
            + Size
          </button>
        </div>
      </div>

      {/* Interactive Grid Matrix */}
      {colors.length === 0 ? (
        <div
          className={`rounded-xl border border-dashed p-5 text-center text-xs ${
            isDark ? 'border-white/15 text-slate-400' : 'border-slate-300 text-slate-500'
          }`}
        >
          Add at least one Garment Colour above to build the Colour × Size quantity grid.
        </div>
      ) : (
        <div
          className={`rounded-xl border overflow-hidden ${
            isDark ? 'border-white/10 bg-[#103A40]' : 'border-slate-200 bg-white'
          }`}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr
                  className={`border-b ${
                    isDark
                      ? 'bg-white/5 border-white/10 text-slate-300'
                      : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                >
                  <th className="py-2 px-3 text-left font-bold min-w-[140px]">Colour</th>
                  {sizes.map((s) => (
                    <th key={s} className="py-2 px-2 text-center font-bold min-w-[74px]">
                      {s}
                    </th>
                  ))}
                  <th className="py-2 px-3 text-right font-extrabold text-[#0F8B8D] dark:text-[#2BA5B5] min-w-[85px]">
                    Total
                  </th>
                  <th className="py-2 px-2 w-9" />
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-white/5' : 'divide-slate-100'}`}>
                {colors.map((c) => (
                  <tr key={c}>
                    <td className="py-2 px-3 font-bold whitespace-nowrap">{c}</td>
                    {sizes.map((s) => {
                      const val = qtyMap[`${c}::${s}`] ?? 0;
                      return (
                        <td key={s} className="py-1.5 px-1.5">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={val === 0 ? '' : val}
                            placeholder="0"
                            onChange={(e) => handleCellChange(c, s, e.target.value)}
                            className={`w-full px-2 py-1 text-right text-xs font-bold tabular-nums rounded-lg border focus:outline-none focus:ring-2 focus:ring-[#2BA5B5] ${
                              isDark
                                ? 'bg-[#0B2E33] border-white/15 text-white'
                                : 'bg-slate-50 border-slate-200 text-slate-900'
                            }`}
                          />
                        </td>
                      );
                    })}
                    <td className="py-2 px-3 text-right font-extrabold tabular-nums text-[#0F8B8D] dark:text-[#2BA5B5]">
                      {formatNumberBD(totals.byColor[c] || 0)}
                    </td>
                    <td className="py-2 px-2 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveColor(c)}
                        title={`Remove ${c}`}
                        className="p-1 rounded-lg text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr
                  className={`border-t font-extrabold ${
                    isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <td className="py-2 px-3">Size Total</td>
                  {sizes.map((s) => (
                    <td key={s} className="py-2 px-2 text-right tabular-nums">
                      {formatNumberBD(totals.bySize[s] || 0)}
                    </td>
                  ))}
                  <td className="py-2 px-3 text-right tabular-nums text-[#0F8B8D] dark:text-[#2BA5B5]">
                    {formatNumberBD(totals.grandTotal)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ColorSizeMatrix;
