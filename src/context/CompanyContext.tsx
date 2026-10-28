/**
 * CompanyContext.tsx
 * Global company branding and ERP settings
 */
import React, { createContext, useContext, useState, useMemo } from 'react';
import { COMPANY_CONFIG } from '../config/company';

export interface HeroPalette {
  primary: string;
  secondary: string;
  soft: string;
  deep: string;
  hasAlpha: boolean;
}

interface CompanyContextType {
  companyName: string;
  logoUrl: string | null;
  heroUrl: string | null;
  heroPalette: HeroPalette | null;
  heroFocusX: number;
  heroFocusY: number;
  heroStyle: 'rounded' | 'arch' | 'circle' | 'blob';
  primaryColor: string;
  updateSettings: (settings: Partial<{
    company_name: string;
    logo_url: string | null;
    hero_url: string | null;
    hero_palette: HeroPalette | null;
    hero_focus_x: number;
    hero_focus_y: number;
    hero_style: 'rounded' | 'arch' | 'circle' | 'blob';
  }>) => Promise<void>;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export const CompanyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [companyName, setCompanyName] = useState(COMPANY_CONFIG.name);
  const [logoUrl, setLogoUrl] = useState<string | null>(COMPANY_CONFIG.logoUrl || null);
  const [heroUrl, setHeroUrl] = useState<string | null>(null);
  const [heroPalette, setHeroPalette] = useState<HeroPalette | null>(null);
  const [heroFocusX, setHeroFocusX] = useState(50);
  const [heroFocusY, setHeroFocusY] = useState(30);
  const [heroStyle, setHeroStyle] = useState<'rounded' | 'arch' | 'circle' | 'blob'>('rounded');

  // Persistence logic (in a real app this would fetch from a 'settings' table)
  // For now we'll keep it in memory but provide the update function as requested
  const updateSettings = async (settings: any) => {
    if (settings.company_name !== undefined) setCompanyName(settings.company_name);
    if (settings.logo_url !== undefined) setLogoUrl(settings.logo_url);
    if (settings.hero_url !== undefined) setHeroUrl(settings.hero_url);
    if (settings.hero_palette !== undefined) setHeroPalette(settings.hero_palette);
    if (settings.hero_focus_x !== undefined) setHeroFocusX(settings.hero_focus_x);
    if (settings.hero_focus_y !== undefined) setHeroFocusY(settings.hero_focus_y);
    if (settings.hero_style !== undefined) setHeroStyle(settings.hero_style);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
  };

  const value = useMemo(() => ({
    companyName,
    logoUrl,
    heroUrl,
    heroPalette,
    heroFocusX,
    heroFocusY,
    heroStyle,
    primaryColor: COMPANY_CONFIG.primaryColor,
    updateSettings,
  }), [companyName, logoUrl, heroUrl, heroPalette, heroFocusX, heroFocusY, heroStyle]);

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
};

export const useCompany = () => {
  const context = useContext(CompanyContext);
  if (!context) throw new Error('useCompany must be used within CompanyProvider');
  return context;
};
