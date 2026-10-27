import React from 'react';
import type { FactoryUnit } from '../lib/constants';

export interface UnitContextType {
  selectedUnit: FactoryUnit;
  setSelectedUnit: (unit: FactoryUnit) => void;
  unitLabel: string;
  unitLabelBangla: string;
}

export declare const UnitProvider: React.FC<{ children: React.ReactNode }>;
export declare function useUnit(): UnitContextType;
declare const UnitContext: React.Context<UnitContextType | undefined>;
export default UnitContext;
