import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  UploadCloud,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Building,
  Image as ImageIcon,
  Loader2,
  Save,
  RefreshCw,
  Sliders,
  Shield,
  Sparkles,
  Crosshair,
  Maximize2,
  Layout,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCompany } from '../context/CompanyContext';
import { useTheme } from '../context/ThemeContext';
import { CompanyLogo } from '../components/CompanyLogo';
import { AdminLayout } from '../components/layout/AdminLayout';
import { supabase } from '../lib/supabaseClient';
import { optimizeImage, extractPalette } from '../lib/imageUtils';
import toast from 'react-hot-toast';

const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCENT_TEAL = '#2BA5B5';

export const AdminSettings: React.FC = () => {
  const { companyName, logoUrl, heroUrl, heroPalette, heroFocusX, heroFocusY, heroStyle, updateSettings } = useCompany();
  const { isDark } = useTheme();

  // Company Name state
  const [nameInput, setNameInput] = useState(companyName);
  const [isSavingName, setIsSavingName] = useState(false);

  // Logo state
  const [selectedLogoFile, setSelectedLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [isDraggingLogo, setIsDraggingLogo] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isRemovingLogo, setIsRemovingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Hero Image Manager state
  const [heroFile, setHeroFile] = useState<File | null>(null);
  const [heroPreviewUrl, setHeroPreviewUrl] = useState<string | null>(heroUrl);
  const [originalSize, setOriginalSize] = useState<number | null>(null);
  const [optimizedSize, setOptimizedSize] = useState<number | null>(null);
  const [isDraggingHero, setIsDraggingHero] = useState(false);
  const [isProcessingHero, setIsProcessingHero] = useState(false);
  const [isSavingHero, setIsSavingHero] = useState(false);
  const [isRemovingHero, setIsRemovingHero] = useState(false);

  // Hero custom attributes state
  const [palette, setPalette] = useState<any>(heroPalette || {
    primary: '#0F8B8D',
    secondary: '#2563EB',
    soft: '#E0F2FE',
    deep: '#0B2E33',
    hasAlpha: false,
  });
  const [focusX, setFocusX] = useState<number>(heroFocusX ?? 50);
  const [focusY, setFocusY] = useState<number>(heroFocusY ?? 30);
  const [styleOption, setStyleOption] = useState<'rounded' | 'arch' | 'circle' | 'blob'>(heroStyle || 'rounded');

  const heroInputRef = useRef<HTMLInputElement>(null);

  // Keep state synced when context updates
  useEffect(() => {
    if (companyName) setNameInput(companyName);
  }, [companyName]);

  useEffect(() => {
    if (heroUrl && !heroFile) {
      setHeroPreviewUrl(heroUrl);
    }
    if (heroPalette) {
      setPalette(heroPalette);
    }
    if (heroFocusX !== undefined) setFocusX(heroFocusX);
    if (heroFocusY !== undefined) setFocusY(heroFocusY);
    if (heroStyle) setStyleOption(heroStyle);
  }, [heroUrl, heroPalette, heroFocusX, heroFocusY, heroStyle]);

  // Helper to extract bucket file name for cleanup
  const extractBucketFileName = (url?: string | null): string | null => {
    if (!url || !url.includes('/branding/')) return null;
    const parts = url.split('/branding/');
    return parts[1]?.split('?')[0] || null;
  };

  // --- HERO IMAGE HANDLERS ---
  const handleHeroFileSelect = async (file: File) => {
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      toast.error('Invalid image format for hero.');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error('Hero image exceeds 10MB limit.');
      return;
    }

    setIsProcessingHero(true);
    try {
      setOriginalSize(file.size);
      const optimized = await optimizeImage(file);
      setHeroFile(optimized.file);
      setHeroPreviewUrl(optimized.objectUrl);
      setOptimizedSize(optimized.optimizedSize);

      // Extract Palette
      const extracted = await extractPalette(optimized.objectUrl);
      setPalette(extracted);

      toast.success(`Hero optimized: ${Math.round(optimized.optimizedSize / 1024)} KB (WebP/PNG)`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to process hero image.');
    } finally {
      setIsProcessingHero(false);
    }
  };

  const handleHeroDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingHero(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleHeroFileSelect(file);
  };

  const handleFocusClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, Math.round(((e.clientX - rect.left) / rect.width) * 100)));
    const y = Math.max(0, Math.min(100, Math.round(((e.clientY - rect.top) / rect.height) * 100)));
    setFocusX(x);
    setFocusY(y);
    toast.success(`Focus point set to X: ${x}%, Y: ${y}%`);
  };

  const handleSaveHeroSettings = async () => {
    setIsSavingHero(true);
    try {
      let finalHeroUrl = heroUrl;

      if (heroFile) {
        const fileExt = heroFile.type === 'image/png' ? 'png' : 'webp';
        const fileName = `hero_${Date.now()}.${fileExt}`;
        const { error: uploadErr } = await supabase.storage
          .from('branding')
          .upload(fileName, heroFile, { cacheControl: '3600', upsert: true });

        if (uploadErr) throw new Error(uploadErr.message);

        const { data: urlData } = supabase.storage.from('branding').getPublicUrl(fileName);
        finalHeroUrl = urlData.publicUrl;

        const oldHeroFileName = extractBucketFileName(heroUrl);
        if (oldHeroFileName && oldHeroFileName !== fileName) {
          await supabase.storage.from('branding').remove([oldHeroFileName]);
        }
      }

      await updateSettings({
        hero_url: finalHeroUrl,
        hero_palette: palette,
        hero_focus_x: focusX,
        hero_focus_y: focusY,
        hero_style: styleOption,
      });

      toast.success('Login Hero Image & Settings saved successfully!');
      setHeroFile(null);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save hero settings.');
    } finally {
      setIsSavingHero(false);
    }
  };

  const handleRemoveHero = async () => {
    if (!window.confirm('Remove custom login hero image? Login will fallback to default illustration.')) return;
    setIsRemovingHero(true);
    try {
      const oldFileName = extractBucketFileName(heroUrl);
      if (oldFileName) await supabase.storage.from('branding').remove([oldFileName]);

      await updateSettings({
        hero_url: null,
        hero_palette: null,
        hero_focus_x: 50,
        hero_focus_y: 30,
        hero_style: 'rounded',
      });

      setHeroPreviewUrl(null);
      setHeroFile(null);
      toast.success('Login hero image removed.');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to remove hero image.');
    } finally {
      setIsRemovingHero(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-8 max-w-4xl mx-auto pb-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold tracking-tight">Branding &amp; Login Hero Settings</h1>
              <span
                className="text-xs font-bold px-2.5 py-0.5 rounded-full"
                style={{ backgroundColor: 'rgba(43, 165, 181, 0.15)', color: ACCENT_TEAL }}
              >
                ERP Global
              </span>
            </div>
            <p className="text-xs text-slate-400 font-bangla mt-0.5">
              কারখানার নাম, লোগো এবং লগইন পেজ হিরো ইমেজ ম্যানেজমেন্ট
            </p>
          </div>
        </div>

        {/* Live Monogram Preview */}
        <div
          className={`p-6 sm:p-8 rounded-3xl border shadow-soft-lg space-y-4 ${
            isDark ? 'bg-[#103A40] border-white/10' : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Live Brand Monogram Preview
            </span>
            <span className="text-xs text-[#2BA5B5] font-semibold">Realtime Sync</span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-6 pt-2">
            <CompanyLogo size="lg" showName={true} />
            <div className="text-xs text-slate-400 max-w-sm sm:border-l sm:border-white/10 sm:pl-6 text-center sm:text-left">
              This logo and branding name will appear dynamically across the top bar, login portal, export packing slips, and report headers.
            </div>
          </div>
        </div>

        {/* 1. COMPANY NAME */}
        <div
          className={`p-6 sm:p-8 rounded-3xl border shadow-soft-lg space-y-6 ${
            isDark ? 'bg-[#103A40] border-white/10' : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center gap-3 pb-3 border-b border-white/10">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-xs"
              style={{ backgroundColor: 'rgba(43, 165, 181, 0.15)', color: ACCENT_TEAL }}
            >
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">Company Legal Name</h2>
              <p className="text-xs text-slate-400 font-bangla">প্রাতিষ্ঠানিক নাম পরিবর্তন</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              className={`flex-1 px-4 py-2.5 text-xs rounded-2xl border outline-none focus:ring-2 focus:ring-[#2BA5B5] ${
                isDark ? 'bg-[#0B2E33] border-white/15 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
              }`}
            />
            <button
              type="button"
              onClick={async () => {
                if (!nameInput.trim()) return;
                setIsSavingName(true);
                try {
                  await updateSettings({ company_name: nameInput.trim() });
                  toast.success('Company name updated!');
                } catch (err: any) {
                  toast.error(err?.message || 'Failed to update company name');
                } finally {
                  setIsSavingName(false);
                }
              }}
              disabled={isSavingName}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-2xl text-xs font-bold text-white shadow-md cursor-pointer"
              style={{ backgroundColor: ACCENT_TEAL }}
            >
              {isSavingName ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Save Name</span>
            </button>
          </div>
        </div>

        {/* 2. LOGIN PAGE HERO IMAGE MANAGER (NEW) */}
        <div
          className={`p-6 sm:p-8 rounded-3xl border shadow-soft-lg space-y-6 ${
            isDark ? 'bg-[#103A40] border-white/10' : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center gap-3 pb-3 border-b border-white/10">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-xs"
              style={{ backgroundColor: 'rgba(43, 165, 181, 0.15)', color: ACCENT_TEAL }}
            >
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">Login Page Hero Image Manager</h2>
              <p className="text-xs text-slate-400 font-bangla">লগইন পেজের হিরো ইমেজ, কালার প্যালেট ও ফ্রেম কাস্টমাইজেশন</p>
            </div>
          </div>

          {/* Upload Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingHero(true);
            }}
            onDragLeave={() => setIsDraggingHero(false)}
            onDrop={handleHeroDrop}
            onClick={() => heroInputRef.current?.click()}
            className={`p-8 rounded-3xl border-2 border-dashed text-center cursor-pointer transition-all ${
              isDraggingHero
                ? 'border-[#2BA5B5] bg-[#2BA5B5]/10'
                : isDark
                ? 'border-white/15 hover:border-[#2BA5B5] bg-white/5'
                : 'border-slate-300 hover:border-[#2BA5B5] bg-slate-50'
            }`}
          >
            <input
              type="file"
              ref={heroInputRef}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleHeroFileSelect(f);
              }}
              accept="image/png,image/jpeg,image/jpg,image/webp"
              className="hidden"
            />
            {isProcessingHero ? (
              <div className="flex flex-col items-center justify-center py-4 space-y-2">
                <Loader2 className="w-8 h-8 animate-spin text-[#2BA5B5]" />
                <p className="text-xs font-semibold">Processing &amp; Optimizing image (max width 1200px)...</p>
              </div>
            ) : (
              <>
                <UploadCloud className="w-10 h-10 mx-auto text-[#2BA5B5] mb-2" />
                <p className="text-xs font-bold">Click to upload or drag &amp; drop login hero image</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Supports PNG, JPG, WebP (Max 10MB). Automatically resized and compressed to WebP/PNG.
                </p>
              </>
            )}
          </div>

          {/* Compression Stats */}
          {originalSize && optimizedSize && (
            <div className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/10 text-xs">
              <span className="text-slate-400">Optimization Report:</span>
              <div className="flex items-center gap-3">
                <span>Original: {Math.round(originalSize / 1024)} KB</span>
                <span>&rarr;</span>
                <span className="font-bold text-[#2BA5B5]">Optimized: {Math.round(optimizedSize / 1024)} KB</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                  Saved {Math.max(0, Math.round((1 - optimizedSize / originalSize) * 100))}%
                </span>
              </div>
            </div>
          )}

          {/* Live Preview & Focus Point Selector */}
          {heroPreviewUrl && (
            <div className="space-y-6 pt-4 border-t border-white/10">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold">Hero Preview &amp; Focus Point Selector</h3>
                  <p className="text-[11px] text-slate-400">Click anywhere on the image below to set the focus point (X/Y %)</p>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono bg-black/20 px-3 py-1 rounded-xl">
                  <Crosshair className="w-3.5 h-3.5 text-[#2BA5B5]" />
                  <span>X: {focusX}% | Y: {focusY}%</span>
                </div>
              </div>

              {/* Interactive Image Container */}
              <div
                onClick={handleFocusClick}
                className="relative w-full h-72 sm:h-96 rounded-3xl overflow-hidden border border-white/15 cursor-crosshair group shadow-xl"
                style={{ backgroundColor: palette?.deep || '#0B2E33' }}
              >
                <img
                  src={heroPreviewUrl}
                  alt="Login Hero Preview"
                  className="w-full h-full object-cover transition-all"
                  style={{ objectPosition: `${focusX}% ${focusY}%` }}
                />
                <div
                  className="absolute w-6 h-6 -ml-3 -mt-3 rounded-full border-2 border-white bg-[#2BA5B5]/80 shadow-lg pointer-events-none flex items-center justify-center transition-all animate-pulse"
                  style={{ left: `${focusX}%`, top: `${focusY}%` }}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-white" />
                </div>
                <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-semibold text-white">
                  Frame Style: {styleOption}
                </div>
              </div>

              {/* Frame Style Picker */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Hero Frame Style
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { id: 'rounded', label: 'Rounded Card', desc: 'Modern 3xl corners' },
                    { id: 'arch', label: 'Arch Top', desc: 'Curved top header' },
                    { id: 'circle', label: 'Circle Crop', desc: 'Circular medallion' },
                    { id: 'blob', label: 'Organic Blob', desc: 'Smooth fluid curves' },
                  ].map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setStyleOption(st.id as any)}
                      className={`p-3 rounded-2xl border text-left transition-all ${
                        styleOption === st.id
                          ? 'border-[#2BA5B5] bg-[#2BA5B5]/15 ring-2 ring-[#2BA5B5]'
                          : 'border-white/10 bg-white/5 hover:border-white/30'
                      }`}
                    >
                      <p className="text-xs font-bold">{st.label}</p>
                      <p className="text-[10px] text-slate-400">{st.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Color Palette Extractor & Overrides */}
              <div className="space-y-3 p-4 rounded-2xl bg-white/5 border border-white/10">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#2BA5B5]" />
                    <span>Extracted &amp; Dynamic Color Palette</span>
                  </span>
                  {palette?.hasAlpha && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
                      Transparency (PNG Alpha) Detected
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { key: 'primary', label: 'Primary Accent' },
                    { key: 'secondary', label: 'Secondary Tone' },
                    { key: 'soft', label: 'Soft Highlight' },
                    { key: 'deep', label: 'Deep Background' },
                  ].map((col) => (
                    <div key={col.key} className="space-y-1">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase">{col.label}</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={palette?.[col.key as keyof typeof palette] || '#0F8B8D'}
                          onChange={(e) => setPalette({ ...palette, [col.key]: e.target.value })}
                          className="w-8 h-8 rounded-lg border-0 cursor-pointer bg-transparent"
                        />
                        <input
                          type="text"
                          value={palette?.[col.key as keyof typeof palette] || '#0F8B8D'}
                          onChange={(e) => setPalette({ ...palette, [col.key]: e.target.value })}
                          className="w-20 px-2 py-1 text-[11px] rounded-lg bg-black/20 border border-white/10 font-mono"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Save & Remove Buttons */}
              <div className="flex items-center justify-between pt-2">
                {heroUrl && (
                  <button
                    type="button"
                    onClick={handleRemoveHero}
                    disabled={isRemovingHero}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-500/10 border border-rose-500/30 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{isRemovingHero ? 'Removing...' : 'Remove Hero'}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleSaveHeroSettings}
                  disabled={isSavingHero}
                  className="ml-auto inline-flex items-center gap-2 px-6 py-2.5 rounded-2xl text-xs font-bold text-white shadow-lg cursor-pointer"
                  style={{ backgroundColor: ACCENT_TEAL }}
                >
                  {isSavingHero ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving Hero Settings...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Save Login Hero &amp; Palette</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminSettings;
