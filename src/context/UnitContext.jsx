/**
 * UnitContext.jsx
 * Manages active factory unit selection (All, Knit, Woven) for current session and future modules
 */

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { UNIT_LABELS } from '../lib/constants';

const STORAGE_KEY = 'rupkatha_active_unit';

const UnitContext = createContext(undefined);

export const UnitProvider = ({ children }) => {
  const [selectedUnit, setSelectedUnitState] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'knit' || stored === 'woven' || stored === 'all') {
        return stored;
      }
    } catch {
      // ignore
    }
    return 'all';
  });

  const setSelectedUnit = (unit) => {
    setSelectedUnitState(unit);
    try {
      localStorage.setItem(STORAGE_KEY, unit);
    } catch {
      // ignore
    }
  };

  const value = useMemo(() => {
    const labels = UNIT_LABELS[selectedUnit] || { en: 'All Units', bn: 'সকল ইউনিট' };
    return {
      selectedUnit,
      setSelectedUnit,
      unitLabel: labels.en,
      unitLabelBangla: labels.bn,
    };
  }, [selectedUnit]);

  return <UnitContext.Provider value={value}>{children}</UnitContext.Provider>;
};

export function useUnit() {
  const context = useContext(UnitContext);
  if (!context) {
    throw new Error('useUnit must be used within a UnitProvider');
  }
  return context;
}

export default UnitContext;
