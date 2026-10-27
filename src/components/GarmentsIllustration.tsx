import React from 'react';
import { motion } from 'framer-motion';

export const GarmentsIllustration: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <motion.div
      animate={{ y: [0, -8, 0] }}
      transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
      className={`relative w-full max-w-lg mx-auto flex flex-col items-center select-none ${className}`}
    >
      <svg
        viewBox="0 0 600 480"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto drop-shadow-xl"
      >
        <defs>
          {/* Gradients */}
          <linearGradient id="podiumGrad" x1="100" y1="360" x2="500" y2="440" gradientUnits="userSpaceOnUse">
            <stop stopColor="#ffffff" stopOpacity="0.25" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0.08" />
          </linearGradient>

          <linearGradient id="boardGrad" x1="180" y1="180" x2="420" y2="250" gradientUnits="userSpaceOnUse">
            <stop stopColor="#ffffff" />
            <stop offset="1" stopColor="#F1F5F9" />
          </linearGradient>

          <linearGradient id="fabricTeal" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop stopColor="#0F8B8D" />
            <stop offset="1" stopColor="#14B8A6" />
          </linearGradient>

          <linearGradient id="fabricIndigo" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop stopColor="#312E81" />
            <stop offset="1" stopColor="#4338CA" />
          </linearGradient>

          <linearGradient id="skinTone1" x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#E2A784" />
            <stop offset="1" stopColor="#D2906C" />
          </linearGradient>

          <linearGradient id="skinTone2" x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#F3C3A6" />
            <stop offset="1" stopColor="#E2A784" />
          </linearGradient>

          <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* 1. Translucent Circular Platform / Podium */}
        <ellipse cx="300" cy="400" rx="240" ry="50" fill="url(#podiumGrad)" />
        <ellipse cx="300" cy="396" rx="220" ry="42" fill="#ffffff" fillOpacity="0.15" />
        <ellipse cx="300" cy="392" rx="190" ry="34" fill="#ffffff" fillOpacity="0.2" />

        {/* Ambient Ring Lights */}
        <circle cx="300" cy="240" r="190" stroke="#ffffff" strokeOpacity="0.1" strokeWidth="2" strokeDasharray="6 6" />

        {/* 2. Left Side: Industrial Sewing Machine on Table */}
        <g id="sewing-machine">
          {/* Table stand */}
          <rect x="70" y="320" width="100" height="8" rx="3" fill="#334155" />
          <path d="M85 328v60M155 328v60" stroke="#1E293B" strokeWidth="4" strokeLinecap="round" />
          <path d="M80 375h80" stroke="#475569" strokeWidth="3" />

          {/* Sewing machine body */}
          <path
            d="M85 315h65a6 6 0 0 0 6-6v-28a12 12 0 0 0-12-12h-40c-6 0-10 4-10 10v4h24a4 4 0 0 1 4 4v4a4 4 0 0 1-4 4h-24v18h-9a4 4 0 0 0-4 4v2z"
            fill="#E2E8F0"
          />
          {/* Machine needle & foot */}
          <rect x="94" y="291" width="3" height="18" fill="#64748B" />
          <rect x="92" y="307" width="7" height="3" rx="1" fill="#0F8B8D" />
          {/* Thread Spool on top */}
          <rect x="138" y="259" width="8" height="12" rx="2" fill="#0F8B8D" />
          <path d="M142 258v-4" stroke="#CBD5E1" strokeWidth="2" />
          <path d="M142 254c-18 0-44 14-46 37" stroke="#38BDF8" strokeWidth="1.5" strokeDasharray="3 2" fill="none" />
          {/* Fabric being sewn */}
          <path d="M75 312c12-3 24 0 35 2l12-1" stroke="#F43F5E" strokeWidth="4" strokeLinecap="round" />
        </g>

        {/* 3. Left Character: Factory Production Specialist / Merchandiser */}
        <g id="character-left">
          {/* Shadow */}
          <ellipse cx="210" cy="385" rx="26" ry="7" fill="#0F172A" fillOpacity="0.2" />

          {/* Legs & Shoes */}
          <rect x="198" y="295" width="11" height="85" rx="5" fill="#1E293B" />
          <rect x="214" y="295" width="11" height="85" rx="5" fill="#334155" />
          <path d="M194 378h17a4 4 0 0 1 4 4v3h-23a2 2 0 0 1-2-2v-3a2 2 0 0 1 4-2z" fill="#0F172A" />
          <path d="M210 378h17a4 4 0 0 1 4 4v3h-23a2 2 0 0 1-2-2v-3a2 2 0 0 1 4-2z" fill="#0F172A" />

          {/* Torso / Shirt */}
          <path d="M192 195h38c8 0 14 6 14 14v86h-66v-86c0-8 6-14 14-14z" fill="url(#fabricTeal)" />

          {/* Measuring tape across shoulder */}
          <path d="M198 195c6 22 8 45 4 70" stroke="#FBBF24" strokeWidth="3.5" strokeDasharray="4 2" fill="none" />

          {/* Neck & Head */}
          <rect x="206" y="180" width="10" height="18" fill="url(#skinTone1)" rx="3" />
          <ellipse cx="211" cy="165" rx="16" ry="19" fill="url(#skinTone1)" />

          {/* Hair */}
          <path d="M195 165c0-12 7-19 19-19s19 7 19 19c0 3-1 6-2 8-3-8-8-12-17-12s-14 4-17 12c-1-2-2-5-2-8z" fill="#0F172A" />

          {/* Face details */}
          <ellipse cx="216" cy="164" rx="2" ry="2.5" fill="#1E293B" />
          <path d="M213 172c3 2 7 2 9 0" stroke="#1E293B" strokeWidth="1.5" strokeLinecap="round" fill="none" />
          {/* Glasses */}
          <rect x="211" y="160" width="9" height="7" rx="2" stroke="#0F172A" strokeWidth="1.5" fill="none" />

          {/* Left Arm holding the Welcome Board */}
          <path d="M236 215l22 24" stroke="url(#skinTone1)" strokeWidth="9" strokeLinecap="round" />
          <ellipse cx="260" cy="240" rx="6" ry="6" fill="url(#skinTone1)" />
        </g>

        {/* 4. Center: Big Friendly "WELCOME" Signboard */}
        <g id="welcome-board" filter="url(#softGlow)">
          {/* Board base shadow */}
          <rect x="236" y="200" width="138" height="84" rx="14" fill="#0F172A" fillOpacity="0.25" />
          {/* Main Board */}
          <rect x="234" y="196" width="136" height="80" rx="12" fill="url(#boardGrad)" stroke="#38BDF8" strokeWidth="2.5" />

          {/* Header Bar on Board */}
          <rect x="234" y="196" width="136" height="12" rx="12" fill="#0F8B8D" />
          <rect x="234" y="202" width="136" height="6" fill="#0F8B8D" />

          {/* Rupkatha Star Motif */}
          <circle cx="302" cy="222" r="4" fill="#0F8B8D" />

          {/* WELCOME text in bold clean lettering */}
          <text
            x="302"
            y="250"
            textAnchor="middle"
            fill="#0F172A"
            fontSize="21"
            fontWeight="900"
            fontFamily="'Inter', sans-serif"
            letterSpacing="3.5"
          >
            WELCOME
          </text>

          {/* Subtext on board */}
          <text
            x="302"
            y="266"
            textAnchor="middle"
            fill="#0F8B8D"
            fontSize="8.5"
            fontWeight="700"
            fontFamily="'Inter', sans-serif"
            letterSpacing="1"
          >
            RUPKATHA APPARELS
          </text>
        </g>

        {/* 5. Right Character: Senior Designer / Pattern Master */}
        <g id="character-right">
          {/* Shadow */}
          <ellipse cx="395" cy="385" rx="26" ry="7" fill="#0F172A" fillOpacity="0.2" />

          {/* Legs & Skirt / Pants */}
          <rect x="382" y="295" width="11" height="85" rx="5" fill="#334155" />
          <rect x="398" y="295" width="11" height="85" rx="5" fill="#1E293B" />
          <path d="M378 378h17a4 4 0 0 1 4 4v3h-23a2 2 0 0 1-2-2v-3a2 2 0 0 1 4-2z" fill="#0F172A" />
          <path d="M394 378h17a4 4 0 0 1 4 4v3h-23a2 2 0 0 1-2-2v-3a2 2 0 0 1 4-2z" fill="#0F172A" />

          {/* Torso / Knit Polo */}
          <path d="M375 195h38c8 0 14 6 14 14v86h-66v-86c0-8 6-14 14-14z" fill="url(#fabricIndigo)" />

          {/* Scarf / Tech-pack lanyard */}
          <path d="M390 195v40l8-8 8 8v-40" fill="#38BDF8" fillOpacity="0.8" />

          {/* Neck & Head */}
          <rect x="388" y="180" width="10" height="18" fill="url(#skinTone2)" rx="3" />
          <ellipse cx="393" cy="165" rx="16" ry="19" fill="url(#skinTone2)" />

          {/* Hair (Bun style) */}
          <path d="M377 165c0-13 8-20 20-20s20 7 20 20c0 4-2 7-4 9-3-9-9-13-16-13s-14 4-16 13c-2-2-4-5-4-9z" fill="#1E293B" />
          <circle cx="393" cy="142" r="8" fill="#1E293B" />

          {/* Face details */}
          <ellipse cx="388" cy="164" rx="2" ry="2.5" fill="#1E293B" />
          <path d="M386 172c3 2 7 2 9 0" stroke="#1E293B" strokeWidth="1.5" strokeLinecap="round" fill="none" />

          {/* Right Arm holding the Welcome Board */}
          <path d="M378 215l-22 24" stroke="url(#skinTone2)" strokeWidth="9" strokeLinecap="round" />
          <ellipse cx="354" cy="240" rx="6" ry="6" fill="url(#skinTone2)" />
        </g>

        {/* 6. Far Right: Clothes Hanger Stand with Garments */}
        <g id="hanger-stand">
          {/* Base */}
          <ellipse cx="490" cy="390" rx="28" ry="8" fill="#334155" />
          <path d="M490 388V230" stroke="#475569" strokeWidth="4" strokeLinecap="round" />
          {/* Top T-bar */}
          <path d="M465 238h50" stroke="#334155" strokeWidth="4" strokeLinecap="round" />

          {/* Hanger 1 with Polo Shirt (Teal) */}
          <path d="M472 238l-15 12h30z" fill="none" stroke="#FBBF24" strokeWidth="2" />
          <path d="M455 250c4-2 20-2 24 0l10 12-4 12-7-6v68h-26v-68l-7 6-4-12 10-12z" fill="#0F8B8D" />

          {/* Hanger 2 with Dress Shirt (Coral) */}
          <path d="M502 238l-15 12h30z" fill="none" stroke="#FBBF24" strokeWidth="2" />
          <path d="M485 250c4-2 20-2 24 0l10 12-4 12-7-6v62h-26v-62l-7 6-4-12 10-12z" fill="#FB7185" />
        </g>

        {/* 7. Lush Potted Plants on Sides */}
        {/* Left Plant */}
        <g id="left-plant">
          <path d="M54 395h24l-4 22h-16z" fill="#D97706" />
          <path d="M66 395c-15-20-8-36 2-46 4 15 1 32-2 46z" fill="#10B981" />
          <path d="M66 395c14-16 18-32 10-44-6 14-8 30-10 44z" fill="#059669" />
          <path d="M66 395c-4-24 6-38 16-48-2 16-6 32-16 48z" fill="#34D399" />
        </g>

        {/* Right Plant */}
        <g id="right-plant">
          <path d="M528 395h22l-3 20h-16z" fill="#0F766E" />
          <path d="M539 395c-10-18-6-30 2-40 4 12 1 28-2 40z" fill="#10B981" />
          <path d="M539 395c12-14 14-26 8-36-5 12-6 24-8 36z" fill="#059669" />
        </g>

        {/* 8. Floating Decorative Fabric Swatches & Thread icons */}
        <g id="decorative-floats">
          {/* Button float */}
          <circle cx="150" cy="180" r="10" fill="#38BDF8" fillOpacity="0.7" />
          <circle cx="147" cy="177" r="1.5" fill="#ffffff" />
          <circle cx="153" cy="177" r="1.5" fill="#ffffff" />
          <circle cx="147" cy="183" r="1.5" fill="#ffffff" />
          <circle cx="153" cy="183" r="1.5" fill="#ffffff" />

          {/* Fabric roll badge */}
          <path d="M430 150c12-6 24 2 24 14s-12 18-24 14z" fill="#F43F5E" fillOpacity="0.6" />

          {/* Scissors float */}
          <path d="M465 185l12 12m-12 0l12-12" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeOpacity="0.7" />
        </g>
      </svg>
    </motion.div>
  );
};

export default GarmentsIllustration;
