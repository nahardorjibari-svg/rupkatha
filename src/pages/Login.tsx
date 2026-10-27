import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  ArrowRight,
  Sparkles,
  Layers,
  Scissors,
  PackageCheck,
  CheckCircle2,
  ShieldCheck,
  Copy,
  Check,
  Wifi,
  WifiOff,
  Phone,
  Building2,
  Factory,
  Headphones,
  X,
  Info,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCompany } from '../context/CompanyContext';
import { Navbar } from '../components/Navbar';
import { ForgotPasswordModal } from '../components/ForgotPasswordModal';
import { getRememberMePreference } from '../lib/supabaseClient';
import toast from 'react-hot-toast';

const TAGLINES = [
  {
    en: 'Smart Garments Manufacturing & Supply Chain',
    bn: 'স্মার্ট গার্মেন্টস উৎপাদন ও সাপ্লাই চেইন',
  },
  {
    en: 'Precision Merchandising & Floor Control',
    bn: 'সঠিক মার্চেন্ডাইজিং ও ফ্লোর কন্ট্রোল',
  },
  {
    en: 'Real-time Compliance & Export Management',
    bn: 'রিয়েল-টাইম কমপ্লায়েন্স ও এক্সপোর্ট ম্যানেজমেন্ট',
  },
];

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { session, profile, loading: authLoading, signIn } = useAuth();
  const { companyName, heroUrl, heroPalette, heroFocusX, heroFocusY, heroStyle } = useCompany();

  // Form State
  const [email, setEmail] = useState(() => {
    return localStorage.getItem('rupkatha_remember_email') || '';
  });
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(getRememberMePreference());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Caps Lock detection state
  const [capsLockActive, setCapsLockActive] = useState(false);

  // Rate limiting / failed attempts state
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  // Rotating Taglines index
  const [taglineIdx, setTaglineIdx] = useState(0);

  // Forgot password modal state
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);

  // Contact Support Modal state
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Online / Offline status
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // 3D Tilt reference for the login glass card
  const cardRef = useRef<HTMLDivElement>(null);
  const [tiltStyle, setTiltStyle] = useState({ transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg)' });

  // Rotating taglines timer (every 4s)
  useEffect(() => {
    const timer = setInterval(() => {
      setTaglineIdx((prev) => (prev + 1) % TAGLINES.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  // Online / offline event listeners
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutSeconds > 0) {
      const interval = setInterval(() => {
        setLockoutSeconds((s) => (s > 1 ? s - 1 : 0));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [lockoutSeconds]);

  // Auto-redirect if already authenticated
  useEffect(() => {
    if (!authLoading && session && profile) {
      if (profile.role === 'admin') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [authLoading, session, profile, navigate]);

  // 3D mouse tilt handler
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left; // x position within card
    const y = e.clientY - rect.top;  // y position within card
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -4; // Max 4 deg tilt
    const rotateY = ((x - centerX) / centerX) * 4;
    setTiltStyle({
      transform: `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg)`,
    });
  };

  const handleMouseLeave = () => {
    setTiltStyle({
      transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg)',
    });
  };

  // Email format validation check
  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutSeconds > 0) return;
    setErrorMessage(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMessage('Please enter your factory email address.');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    // Save remember email preference
    if (rememberMe) {
      localStorage.setItem('rupkatha_remember_email', trimmedEmail);
    } else {
      localStorage.removeItem('rupkatha_remember_email');
    }

    setIsSubmitting(true);
    try {
      const { profile: userProf } = await signIn({
        email: trimmedEmail,
        password,
        rememberMe,
      });

      toast.success(`Welcome back, ${userProf.full_name || 'Staff Member'}!`, {
        icon: '🏭',
        duration: 3500,
      });

      if (userProf.role === 'admin') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (err: any) {
      const msg = err?.message || 'Login failed. Please check your credentials.';
      setErrorMessage(msg);
      toast.error(msg, { duration: 4000 });

      // Increment failed attempts for rate limit protection
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);
      if (newAttempts >= 5) {
        setLockoutSeconds(30);
        setErrorMessage('Too many failed login attempts. Please wait 30 seconds before trying again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    toast.success(`${fieldName} copied to clipboard!`);
    setTimeout(() => setCopiedField(null), 2500);
  };

  // Dynamic CSS variables from heroPalette
  const customVars = {
    '--hero-primary': heroPalette?.primary || '#0F8B8D',
    '--hero-secondary': heroPalette?.secondary || '#2563EB',
    '--hero-soft': heroPalette?.soft || '#E0F2FE',
    '--hero-deep': heroPalette?.deep || '#0B2E33',
  } as React.CSSProperties;

  // Frame style CSS mapping
  const getFrameStyleClass = (style: string) => {
    switch (style) {
      case 'arch':
        return 'rounded-t-[120px] rounded-b-3xl';
      case 'circle':
        return 'rounded-full aspect-square max-w-sm mx-auto';
      case 'blob':
        return 'rounded-[40%_60%_70%_30%/40%_50%_60%_50%]';
      case 'rounded':
      default:
        return 'rounded-3xl';
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-teal-600 selection:text-white relative overflow-x-hidden" style={customVars} id="top">
      {/* ==================================================== */}
      {/* 3-LAYER DYNAMIC BACKGROUND                           */}
      {/* ==================================================== */}
      {/* Layer 1: Soft animated gradient mesh */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-[#0B2E33] to-[#103A40] opacity-95 pointer-events-none z-0" />
      <div className="absolute inset-0 opacity-30 pointer-events-none z-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-teal-500/20 via-indigo-500/10 to-transparent animate-pulse duration-1000" />

      {/* Layer 2: 5 Large blurred morphing blobs + 20 tiny drifting particles */}
      <div className="absolute top-10 left-10 w-[500px] h-[500px] rounded-full bg-teal-600/15 blur-[120px] pointer-events-none z-0 animate-blob" />
      <div className="absolute bottom-10 right-10 w-[600px] h-[600px] rounded-full bg-indigo-600/15 blur-[140px] pointer-events-none z-0 animate-blob animation-delay-2000" />
      <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] rounded-full bg-cyan-500/10 blur-[100px] pointer-events-none z-0 animate-blob animation-delay-4000" />
      <div className="absolute bottom-1/4 left-1/4 w-[350px] h-[350px] rounded-full bg-blue-500/10 blur-[90px] pointer-events-none z-0 animate-blob animation-delay-3000" />
      <div className="absolute top-2/3 right-10 w-[300px] h-[300px] rounded-full bg-emerald-500/10 blur-[90px] pointer-events-none z-0" />

      {/* Drifting tiny particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 opacity-40">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white/30 animate-float"
            style={{
              top: `${(i * 17) % 100}%`,
              left: `${(i * 23) % 100}%`,
              width: `${(i % 3) + 2}px`,
              height: `${(i % 3) + 2}px`,
              animationDuration: `${12 + (i % 10)}s`,
              animationDelay: `${i * 0.8}s`,
            }}
          />
        ))}
      </div>

      {/* Layer 3: Subtle SVG noise/grain overlay + gentle diagonal wave lines */}
      <div className="absolute inset-0 opacity-10 pointer-events-none z-0 bg-repeat bg-[radial-gradient(#2BA5B5_1px,transparent_1px)] [background-size:24px_24px]" />

      {/* TOP NAVBAR */}
      <div className="relative z-20">
        <Navbar />
      </div>

      {/* ONLINE / OFFLINE STATUS BANNER */}
      <div className="relative z-20 bg-slate-900/80 border-b border-white/10 px-4 py-1.5 text-xs flex items-center justify-between backdrop-blur-md">
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between text-slate-300">
          <div className="flex items-center gap-2">
            {isOnline ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-medium text-emerald-400 flex items-center gap-1">
                  <Wifi className="w-3.5 h-3.5" /> Secure Enterprise Connection Active
                </span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span className="font-medium text-amber-400 flex items-center gap-1">
                  <WifiOff className="w-3.5 h-3.5" /> Network offline — changes will sync when reconnected
                </span>
              </>
            )}
          </div>
          <div className="hidden sm:flex items-center gap-4 text-[11px] text-slate-400 font-mono">
            <span>PLANT: HEMAYETPUR, DHAKA</span>
            <span>·</span>
            <span>ERP v3.8 SECURE</span>
          </div>
        </div>
      </div>

      {/* MAIN HERO SECTION */}
      <main className="flex-1 flex flex-col lg:flex-row min-h-[calc(100vh-110px)] relative z-10">
        {/* ==================================================== */}
        {/* LEFT HALF: Login Form with 3D Tilt & Glassmorphism   */}
        {/* ==================================================== */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-10 lg:p-14 xl:p-20">
          <motion.div
            ref={cardRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={tiltStyle}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-md mx-auto transition-transform duration-100 ease-out"
          >
            {/* Header */}
            <div className="mb-8">
              <div
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider mb-4 border backdrop-blur-md shadow-sm"
                style={{
                  backgroundColor: 'rgba(43, 165, 181, 0.12)',
                  color: '#2BA5B5',
                  borderColor: 'rgba(43, 165, 181, 0.3)',
                }}
              >
                <Sparkles className="w-3.5 h-3.5 text-[#2BA5B5]" />
                <span>Enterprise Authentication Gateway</span>
              </div>

              <div className="relative inline-block">
                <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white drop-shadow-sm">
                  Sign In to ERP
                </h1>
                <div className="w-16 h-1 rounded-full mt-1.5 bg-gradient-to-r from-[#2BA5B5] to-teal-400" />
              </div>

              <p className="text-sm font-medium text-slate-300 mt-3">
                Enter your factory credentials to access production modules
              </p>
              <p className="text-xs font-bangla font-semibold text-teal-300/90 mt-1">
                রুপকথা অ্যাপারেলস লিমিটেড ইআরপি পোর্টাল
              </p>
            </div>

            {/* Lockout Warning Banner */}
            {lockoutSeconds > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-4 mb-6 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs sm:text-sm flex items-start gap-3 backdrop-blur-md"
                role="alert"
              >
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-amber-400" />
                <div className="space-y-1">
                  <p className="font-bold">Too many failed login attempts.</p>
                  <p className="text-amber-200 text-xs">Please wait <span className="font-mono font-bold">{lockoutSeconds}s</span> before trying again.</p>
                </div>
              </motion.div>
            )}

            {/* Inline Error Message */}
            {errorMessage && lockoutSeconds === 0 && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3.5 mb-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs sm:text-sm flex items-start gap-2.5 backdrop-blur-md shadow-lg"
                role="alert"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                <div className="space-y-0.5">
                  <p className="font-semibold">{errorMessage}</p>
                </div>
              </motion.div>
            )}

            {/* Glassmorphism Card */}
            <div className="bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl p-6 sm:p-8 relative overflow-hidden group">
              {/* Subtle diagonal light sheen across card */}
              <div className="absolute -inset-full top-0 block h-full w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/5 to-transparent group-hover:animate-shine pointer-events-none" />

              <form onSubmit={handleSignIn} className="space-y-5" noValidate>
                {/* Email Field with Floating Label & Valid Checkmark */}
                <div className="relative">
                  <div className="absolute top-4 left-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-5 h-5" />
                  </div>
                  <input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder=" "
                    required
                    disabled={lockoutSeconds > 0}
                    className="peer w-full pl-11 pr-10 pt-6 pb-2 text-sm rounded-2xl bg-slate-950/70 border border-white/10 text-white focus:bg-slate-950 focus:ring-2 focus:ring-[#2BA5B5] focus:border-[#2BA5B5] outline-none transition-all shadow-inner disabled:opacity-50"
                  />
                  <label
                    htmlFor="login-email"
                    className="absolute text-xs text-slate-400 duration-150 transform -translate-y-2.5 scale-85 top-3.5 z-10 origin-[0] left-11 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-85 peer-focus:-translate-y-2.5 font-medium pointer-events-none"
                  >
                    Factory Email Address
                  </label>
                  {isValidEmail && (
                    <div className="absolute top-4 right-3.5 text-emerald-400 pointer-events-none">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                  )}
                </div>

                {/* Password Field with Caps Lock Warning */}
                <div className="relative">
                  <div className="absolute top-4 left-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-5 h-5" />
                  </div>
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => {
                      const caps = e.getModifierState?.('CapsLock');
                      setCapsLockActive(!!caps);
                    }}
                    onKeyUp={(e) => {
                      const caps = e.getModifierState?.('CapsLock');
                      setCapsLockActive(!!caps);
                    }}
                    placeholder=" "
                    required
                    disabled={lockoutSeconds > 0}
                    className="peer w-full pl-11 pr-11 pt-6 pb-2 text-sm rounded-2xl bg-slate-950/70 border border-white/10 text-white focus:bg-slate-950 focus:ring-2 focus:ring-[#2BA5B5] focus:border-[#2BA5B5] outline-none transition-all shadow-inner disabled:opacity-50"
                  />
                  <label
                    htmlFor="login-password"
                    className="absolute text-xs text-slate-400 duration-150 transform -translate-y-2.5 scale-85 top-3.5 z-10 origin-[0] left-11 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-85 peer-focus:-translate-y-2.5 font-medium pointer-events-none"
                  >
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute top-4 right-3.5 flex items-center text-slate-400 hover:text-white focus:outline-none"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>

                {/* Caps Lock Active Warning */}
                {capsLockActive && (
                  <div className="text-[11px] text-amber-400 font-medium flex items-center gap-1.5 px-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Caps Lock is ON</span>
                  </div>
                )}

                {/* Remember Me & Forgot Password */}
                <div className="flex items-center justify-between text-xs pt-1">
                  <label className="flex items-center gap-2.5 cursor-pointer text-slate-300 select-none group">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded text-[#2BA5B5] border-white/20 bg-slate-950 focus:ring-[#2BA5B5] cursor-pointer"
                    />
                    <span className="font-medium group-hover:text-white transition-colors">Remember me</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => setIsForgotModalOpen(true)}
                    className="font-semibold text-[#2BA5B5] hover:text-teal-300 hover:underline transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>

                {/* Login Button with Shimmer & Scale Animation */}
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={isSubmitting || lockoutSeconds > 0}
                  className="w-full relative overflow-hidden flex items-center justify-center gap-2 py-4 px-6 rounded-2xl text-sm font-bold text-white uppercase tracking-wider bg-gradient-to-r from-[#2BA5B5] to-teal-600 hover:from-[#2593a1] hover:to-teal-700 transition-all shadow-xl shadow-teal-950/50 disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                  <span className="absolute inset-0 w-full h-full bg-white/20 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin text-white" />
                      <span>AUTHENTICATING...</span>
                    </>
                  ) : (
                    <>
                      <span>LOGIN TO ERP</span>
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </motion.button>

                <div className="pt-3 text-center space-y-1">
                  <p className="text-xs text-slate-400 font-medium">
                    Need factory access? <button type="button" onClick={() => setIsContactModalOpen(true)} className="text-[#2BA5B5] font-semibold hover:underline">Contact IT Support</button>
                  </p>
                  <p className="text-[11px] text-slate-500 font-bangla">
                    অ্যাকাউন্টের জন্য আপনার ডিপার্টমেন্ট হেড বা আইটি ম্যানেজারের সাথে যোগাযোগ করুন।
                  </p>
                </div>
              </form>
            </div>
          </motion.div>
        </div>

        {/* ==================================================== */}
        {/* RIGHT HALF: Left Panel & Hero Illustration           */}
        {/* ==================================================== */}
        <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-center items-center p-12 xl:p-16 overflow-hidden bg-slate-900/60 border-l border-white/10">
          {/* Subtle concentric arc lines & dot grid */}
          <div className="absolute inset-0 bg-dot-grid opacity-20 pointer-events-none" />
          <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full bg-teal-500/10 blur-3xl pointer-events-none" />

          <div className="relative z-10 w-full max-w-lg space-y-8 flex flex-col items-center">
            {/* Glass-white Welcome Card with Waving Hand 👋 */}
            <motion.div
              initial={{ opacity: 0, y: -15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="w-full bg-slate-900/70 backdrop-blur-xl border border-white/15 p-5 rounded-3xl shadow-2xl flex items-center justify-between"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#2BA5B5] to-teal-700 flex items-center justify-center text-white text-2xl shadow-lg ring-1 ring-white/20">
                  👋
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Welcome to {companyName}</h3>
                  <p className="text-xs text-teal-300 font-medium">Knit &amp; Woven Garments ERP</p>
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Verified</span>
              </div>
            </motion.div>

            {/* Hero Illustration / Uploaded Hero Image with Frame Styles */}
            <div
              className={`relative w-full aspect-[4/3] overflow-hidden shadow-2xl border border-white/20 transition-all duration-700 ${getFrameStyleClass(
                heroStyle
              )}`}
              style={{ backgroundColor: 'rgba(11, 46, 51, 0.8)' }}
            >
              {heroUrl ? (
                <img
                  src={heroUrl}
                  alt={companyName}
                  className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-1000"
                  style={{ objectPosition: `${heroFocusX}% ${heroFocusY}%` }}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-gradient-to-br from-[#0B2E33] via-slate-900 to-[#103A40] text-center">
                  <div className="w-20 h-20 rounded-3xl bg-teal-500/20 text-[#2BA5B5] flex items-center justify-center mb-4 ring-2 ring-teal-400/30 animate-pulse">
                    <Factory className="w-10 h-10" />
                  </div>
                  <h4 className="text-xl font-bold text-white tracking-wide">{companyName}</h4>
                  <p className="text-xs text-teal-200 mt-1 max-w-xs">
                    Comprehensive Garments Manufacturing &amp; Supply Chain ERP System
                  </p>
                </div>
              )}

              {/* Subtle feathered gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent pointer-events-none" />

              {/* Floating glass chips / badges inside image */}
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 bg-slate-950/70 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-white/15 text-white text-xs shadow-lg">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-semibold">Production Live</span>
                </div>
                <div className="flex items-center gap-2 bg-slate-950/70 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-white/15 text-white text-xs shadow-lg">
                  <PackageCheck className="w-3.5 h-3.5 text-[#2BA5B5]" />
                  <span className="font-semibold">Orders On Track</span>
                </div>
                <div className="flex items-center gap-2 bg-slate-950/70 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-white/15 text-white text-xs shadow-lg">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="font-semibold">Export Ready</span>
                </div>
              </div>
            </div>

            {/* Rotating Tagline Carousel */}
            <div className="w-full text-center space-y-2 min-h-[70px] flex flex-col justify-center">
              <AnimatePresence mode="wait">
                <motion.div
                  key={taglineIdx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.4 }}
                  className="space-y-1"
                >
                  <h2 className="text-lg xl:text-xl font-bold text-white tracking-tight drop-shadow-sm">
                    {TAGLINES[taglineIdx].en}
                  </h2>
                  <p className="text-xs text-teal-300/90 font-bangla font-semibold">
                    {TAGLINES[taglineIdx].bn}
                  </p>
                </motion.div>
              </AnimatePresence>

              {/* Carousel Indicators */}
              <div className="flex items-center justify-center gap-1.5 pt-2">
                {TAGLINES.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setTaglineIdx(idx)}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      taglineIdx === idx ? 'w-6 bg-[#2BA5B5]' : 'w-1.5 bg-white/30 hover:bg-white/50'
                    }`}
                    aria-label={`Go to slide ${idx + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ==================================================== */}
      {/* FOOTER WITH COPYRIGHT & POWERED BY                   */}
      {/* ==================================================== */}
      <footer className="relative z-20 bg-slate-950 border-t border-white/10 py-6 px-4 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 Rupkatha Apparels Ltd. All rights reserved. Hemayetpur, Dhaka, Bangladesh.</p>
          <div className="flex items-center gap-3">
            <span className="text-slate-500">System Architecture &amp; Engineering:</span>
            <span className="font-semibold text-[#2BA5B5]">Md Johurul Islam</span>
          </div>
        </div>
      </footer>

      {/* ==================================================== */}
      {/* FORGOT PASSWORD MODAL                                */}
      {/* ==================================================== */}
      <ForgotPasswordModal
        isOpen={isForgotModalOpen}
        onClose={() => setIsForgotModalOpen(false)}
        defaultEmail={email}
      />

      {/* ==================================================== */}
      {/* CONTACT IT SUPPORT MODAL                             */}$
      {/* ==================================================== */}
      <AnimatePresence>
        {isContactModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsContactModalOpen(false)}
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
              aria-hidden="true"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: 'spring', duration: 0.35, bounce: 0.1 }}
              className="relative w-full max-w-lg bg-slate-900 border border-white/15 rounded-3xl shadow-2xl p-6 sm:p-8 z-10 text-slate-100"
              role="dialog"
              aria-modal="true"
            >
              <button
                type="button"
                onClick={() => setIsContactModalOpen(false)}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3.5 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-teal-500/20 text-[#2BA5B5] flex items-center justify-center ring-1 ring-teal-400/30 shrink-0">
                  <Headphones className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-extrabold text-white">IT Support &amp; Helpdesk</h3>
                  <p className="text-xs text-teal-300 font-bangla">আইটি সাপোর্ট ও সিস্টেম অ্যাডমিন যোগাযোগ</p>
                </div>
              </div>

              <div className="space-y-4 text-sm">
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Customer Service / IT Lead</span>
                    <span className="text-xs text-emerald-400 font-medium">Online (8 AM - 8 PM)</span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 text-slate-200 truncate">
                      <Mail className="w-4 h-4 text-[#2BA5B5] shrink-0" />
                      <span className="font-mono text-xs truncate">nurislam@rupkathaapparels.com</span>
                    </div>
                    <button
                      onClick={() => copyToClipboard('nurislam@rupkathaapparels.com', 'Email')}
                      className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-medium text-white transition-colors flex items-center gap-1 shrink-0"
                    >
                      {copiedField === 'Email' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedField === 'Email' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10">
                    <div className="flex items-center gap-2.5 text-slate-200">
                      <Phone className="w-4 h-4 text-teal-400 shrink-0" />
                      <span className="font-mono text-xs">+8801795094961</span>
                    </div>
                    <button
                      onClick={() => copyToClipboard('+8801795094961', 'Phone')}
                      className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-medium text-white transition-colors flex items-center gap-1 shrink-0"
                    >
                      {copiedField === 'Phone' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedField === 'Phone' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/10 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Corporate &amp; Factory Headquarters</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Raj place, Rishipara, Padma mor, Hemayetpur, Dhaka, Bangladesh.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsContactModalOpen(false)}
                  className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-[#2BA5B5] to-teal-600 text-white font-semibold text-xs tracking-wider uppercase transition-all shadow-lg"
                >
                  Close Helpdesk
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Login;
