import React from 'react';

export interface CompanyContextType {
  companyName: string;
  logoUrl: string | null;
  heroUrl: string | null;
  heroPalette: {
    primary: string;
    secondary: string;
    soft: string;
    deep: string;
    hasAlpha?: boolean;
  } | null;
  heroFocusX: number;
  heroFocusY: number;
  heroStyle: 'rounded' | 'arch' | 'circle' | 'blob';
  loading: boolean;
  updateSettings: (params: {
    company_name?: string;
    logo_url?: string | null;
    hero_url?: string | null;
    hero_palette?: any;
    hero_focus_x?: number;
    hero_focus_y?: number;
    hero_style?: string;
  }) => Promise<boolean>;
  refreshSettings: () => Promise<void>;
}

export declare const CompanyProvider: React.FC<{ children: React.ReactNode }>;
export declare function useCompany(): CompanyContextType;
declare const CompanyContext: React.Context<CompanyContextType | undefined>;
export default CompanyContext;
