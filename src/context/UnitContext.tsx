/**
 * UnitContext.tsx
 * Global factory unit selection (Knit, Woven, Both)
 */
import React, { createContext, useContext, useState, useMemo } from 'react';
import { UNIT_LABELS } from '../lib/constants';
import type { FactoryUnit } from '../lib/constants';

interface UnitContextType {
  activeUnit: FactoryUnit;
  selectedUnit: FactoryUnit; // Alias for activeUnit
  setActiveUnit: (unit: FactoryUnit) => void;
  unitLabel: string;
  unitLabelBangla: string;
}

const UnitContext = createContext<UnitContextType | undefined>(undefined);

export const UnitProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeUnit, setActiveUnit] = useState<FactoryUnit>('all');

  const value = useMemo(() => ({
    activeUnit,
    selectedUnit: activeUnit,
    setActiveUnit,
    unitLabel: UNIT_LABELS[activeUnit]?.en || 'All Units',
    unitLabelBangla: UNIT_LABELS[activeUnit]?.bn || 'সব ইউনিট',
  }), [activeUnit]);

  return <UnitContext.Provider value={value}>{children}</UnitContext.Provider>;
};

export const useUnit = () => {
  const context = useContext(UnitContext);
  if (!context) throw new Error('useUnit must be used within UnitProvider');
  return context;
};
