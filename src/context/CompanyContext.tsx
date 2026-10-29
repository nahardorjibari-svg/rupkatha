/**
 * CompanyContext.tsx
 * Global company branding and ERP settings
 */
import React, { createContext, useContext, useState, useMemo, useEffect, useCallback } from 'react';
import { COMPANY_CONFIG } from '../config/company';
import { supabase } from '../lib/supabaseClient';

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
  updatedAt: string | null;
  primaryColor: string;
  loading: boolean;
  refreshSettings: () => Promise<void>;
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
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .eq('id', 1)
        .single();

      if (error) throw error;
      if (data) {
        setCompanyName(data.company_name || COMPANY_CONFIG.name);
        setLogoUrl(data.logo_url);
        setHeroUrl(data.hero_url);
        setHeroPalette(data.hero_palette);
        setHeroFocusX(data.hero_focus_x ?? 50);
        setHeroFocusY(data.hero_focus_y ?? 30);
        setHeroStyle(data.hero_style || 'rounded');
        setUpdatedAt(data.updated_at);
      }
    } catch (err) {
      console.error('Failed to fetch company settings:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSettings = async (settings: any) => {
    try {
      const { error } = await supabase
        .from('company_settings')
        .update({
          ...settings,
          updated_at: new Date().toISOString()
        })
        .eq('id', 1);

      if (error) throw error;
      await fetchSettings();
    } catch (err) {
      console.error('Failed to update company settings:', err);
      throw err;
    }
  };

  const value = useMemo(() => ({
    companyName,
    logoUrl,
    heroUrl,
    heroPalette,
    heroFocusX,
    heroFocusY,
    heroStyle,
    updatedAt,
    primaryColor: COMPANY_CONFIG.primaryColor,
    loading,
    refreshSettings: fetchSettings,
    updateSettings,
  }), [companyName, logoUrl, heroUrl, heroPalette, heroFocusX, heroFocusY, heroStyle, updatedAt, loading, fetchSettings]);

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
};

export const useCompany = () => {
  const context = useContext(CompanyContext);
  if (!context) throw new Error('useCompany must be used within CompanyProvider');
  return context;
};
