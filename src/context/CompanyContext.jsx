/**
 * CompanyContext.jsx
 * Fetches dynamic company logo, name, and login hero image settings from Supabase "company_settings" (id = 1).
 * Provides reactive updates across the entire application.
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { COMPANY_CONFIG } from '../config/company';

const CompanyContext = createContext(undefined);

export const CompanyProvider = ({ children }) => {
  const [companyName, setCompanyName] = useState(COMPANY_CONFIG.name);
  const [logoUrl, setLogoUrl] = useState(null);
  const [heroUrl, setHeroUrl] = useState(null);
  const [heroPalette, setHeroPalette] = useState(null);
  const [heroFocusX, setHeroFocusX] = useState(50);
  const [heroFocusY, setHeroFocusY] = useState(30);
  const [heroStyle, setHeroStyle] = useState('rounded');
  const [loading, setLoading] = useState(true);

  // Fetch company_settings where id = 1
  const fetchCompanySettings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('company_settings')
        .select('id, company_name, logo_url, hero_url, hero_palette, hero_focus_x, hero_focus_y, hero_style, updated_at')
        .eq('id', 1)
        .maybeSingle();

      if (error) {
        console.warn('Notice fetching company_settings from Supabase:', error.message);
        return;
      }

      if (data) {
        if (data.company_name) {
          setCompanyName(data.company_name);
        }
        setLogoUrl(data.logo_url || null);
        setHeroUrl(data.hero_url || null);
        setHeroPalette(data.hero_palette || null);
        if (data.hero_focus_x !== null && data.hero_focus_x !== undefined) {
          setHeroFocusX(Number(data.hero_focus_x));
        }
        if (data.hero_focus_y !== null && data.hero_focus_y !== undefined) {
          setHeroFocusY(Number(data.hero_focus_y));
        }
        if (data.hero_style) {
          setHeroStyle(data.hero_style);
        }
      }
    } catch (err) {
      console.warn('Unexpected error in fetchCompanySettings:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCompanySettings();
  }, [fetchCompanySettings]);

  // Update company settings (admin only in DB via RLS)
  const updateSettings = useCallback(async ({
    company_name,
    logo_url,
    hero_url,
    hero_palette,
    hero_focus_x,
    hero_focus_y,
    hero_style,
  }) => {
    const payload = {
      updated_at: new Date().toISOString(),
    };
    if (company_name !== undefined) payload.company_name = company_name;
    if (logo_url !== undefined) payload.logo_url = logo_url;
    if (hero_url !== undefined) payload.hero_url = hero_url;
    if (hero_palette !== undefined) payload.hero_palette = hero_palette;
    if (hero_focus_x !== undefined) payload.hero_focus_x = hero_focus_x;
    if (hero_focus_y !== undefined) payload.hero_focus_y = hero_focus_y;
    if (hero_style !== undefined) payload.hero_style = hero_style;

    // Check if row 1 exists
    const { data: existing } = await supabase
      .from('company_settings')
      .select('id')
      .eq('id', 1)
      .maybeSingle();

    let result;
    if (existing) {
      result = await supabase
        .from('company_settings')
        .update(payload)
        .eq('id', 1);
    } else {
      result = await supabase
        .from('company_settings')
        .insert({ id: 1, company_name: company_name || COMPANY_CONFIG.name, ...payload });
    }

    if (result.error) {
      throw new Error(result.error.message);
    }

    if (company_name !== undefined) setCompanyName(company_name);
    if (logo_url !== undefined) setLogoUrl(logo_url);
    if (hero_url !== undefined) setHeroUrl(hero_url);
    if (hero_palette !== undefined) setHeroPalette(hero_palette);
    if (hero_focus_x !== undefined) setHeroFocusX(hero_focus_x);
    if (hero_focus_y !== undefined) setHeroFocusY(hero_focus_y);
    if (hero_style !== undefined) setHeroStyle(hero_style);

    return true;
  }, []);

  const value = useMemo(
    () => ({
      companyName,
      logoUrl,
      heroUrl,
      heroPalette,
      heroFocusX,
      heroFocusY,
      heroStyle,
      loading,
      updateSettings,
      refreshSettings: fetchCompanySettings,
    }),
    [
      companyName,
      logoUrl,
      heroUrl,
      heroPalette,
      heroFocusX,
      heroFocusY,
      heroStyle,
      loading,
      updateSettings,
      fetchCompanySettings,
    ]
  );

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
};

export function useCompany() {
  const context = useContext(CompanyContext);
  if (!context) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
}

export default CompanyContext;
