import React, { createContext, useContext, useState, useEffect } from 'react';

export type GlassThemeId =
  | 'glass-dark'
  | 'glass-light'
  | 'glass-cyber'
  | 'glass-emerald'
  | 'glass-amber'
  | 'glass-stealth';

export interface ThemeConfig {
  id: GlassThemeId;
  name: string;
  tagline: string;
  isDark: boolean;
  accentHex: string;
  previewGradient: string;
  // Dynamic CSS classes for consistent glass styling
  appBg: string;
  ambientGlow: string;
  glassPanel: string;
  glassCard: string;
  glassHeader: string;
  glassBorder: string;
  glassInput: string;
  textPrimary: string;
  textSecondary: string;
  accentText: string;
  accentBg: string;
  accentBorder: string;
}

export const GLASS_THEMES: Record<GlassThemeId, ThemeConfig> = {
  'glass-dark': {
    id: 'glass-dark',
    name: 'Obsidian Frost',
    tagline: 'Deep cosmic slate with icy cyan frosted glass & translucent reflections',
    isDark: true,
    accentHex: '#38bdf8',
    previewGradient: 'from-slate-950 via-slate-900 to-sky-950',
    appBg: 'bg-slate-950 text-slate-100',
    ambientGlow: 'from-sky-500/15 via-indigo-500/10 to-transparent',
    glassPanel: 'bg-slate-900/60 backdrop-blur-2xl border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.4)]',
    glassCard: 'bg-slate-900/50 hover:bg-slate-900/70 backdrop-blur-xl border-white/10 hover:border-sky-400/30 transition-all shadow-md',
    glassHeader: 'bg-slate-950/70 backdrop-blur-2xl border-white/10',
    glassBorder: 'border-white/10',
    glassInput: 'bg-slate-900/60 border-white/15 text-white placeholder-slate-400 focus:border-sky-400',
    textPrimary: 'text-white',
    textSecondary: 'text-slate-400',
    accentText: 'text-sky-400',
    accentBg: 'bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold',
    accentBorder: 'border-sky-500/40',
  },
  'glass-light': {
    id: 'glass-light',
    name: 'Crystal Ice',
    tagline: 'Ultra-clean luminous crystal glass with sapphire refraction',
    isDark: false,
    accentHex: '#2563eb',
    previewGradient: 'from-sky-50 via-slate-100 to-indigo-50',
    appBg: 'bg-slate-100 text-slate-900',
    ambientGlow: 'from-blue-400/15 via-indigo-300/10 to-transparent',
    glassPanel: 'bg-white/70 backdrop-blur-2xl border-white/60 shadow-[0_8px_32px_0_rgba(31,38,135,0.08)]',
    glassCard: 'bg-white/65 hover:bg-white/85 backdrop-blur-xl border-slate-200/70 hover:border-blue-400/50 transition-all shadow-sm',
    glassHeader: 'bg-white/75 backdrop-blur-2xl border-slate-200/80',
    glassBorder: 'border-slate-200/80',
    glassInput: 'bg-white/80 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-500',
    textPrimary: 'text-slate-900',
    textSecondary: 'text-slate-600',
    accentText: 'text-blue-600',
    accentBg: 'bg-blue-600 hover:bg-blue-700 text-white font-semibold',
    accentBorder: 'border-blue-300',
  },
  'glass-cyber': {
    id: 'glass-cyber',
    name: 'Neon Aurora',
    tagline: 'Cyber noir translucent glass with radiant violet & electric magenta halos',
    isDark: true,
    accentHex: '#e879f9',
    previewGradient: 'from-[#0d0714] via-[#160a26] to-[#250d3a]',
    appBg: 'bg-[#0a0512] text-slate-100',
    ambientGlow: 'from-fuchsia-600/20 via-purple-600/15 to-cyan-500/10',
    glassPanel: 'bg-[#150a24]/65 backdrop-blur-2xl border-fuchsia-500/20 shadow-[0_8px_32px_0_rgba(217,70,239,0.15)]',
    glassCard: 'bg-[#1a0e2d]/60 hover:bg-[#23123d]/70 backdrop-blur-xl border-fuchsia-500/20 hover:border-fuchsia-400/50 transition-all shadow-md',
    glassHeader: 'bg-[#0d0714]/75 backdrop-blur-2xl border-fuchsia-500/20',
    glassBorder: 'border-fuchsia-500/20',
    glassInput: 'bg-[#180c2b]/70 border-fuchsia-500/30 text-white placeholder-purple-300/50 focus:border-fuchsia-400',
    textPrimary: 'text-white',
    textSecondary: 'text-purple-200/70',
    accentText: 'text-fuchsia-400',
    accentBg: 'bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-semibold shadow-lg shadow-fuchsia-600/30',
    accentBorder: 'border-fuchsia-500/50',
  },
  'glass-emerald': {
    id: 'glass-emerald',
    name: 'Boreal Spruce',
    tagline: 'Deep Scandinavian spruce forest frosted glass with mint luminescence',
    isDark: true,
    accentHex: '#34d399',
    previewGradient: 'from-[#05130e] via-[#09231a] to-[#0c3124]',
    appBg: 'bg-[#040e0a] text-slate-100',
    ambientGlow: 'from-emerald-500/20 via-teal-500/15 to-transparent',
    glassPanel: 'bg-[#092219]/65 backdrop-blur-2xl border-emerald-500/20 shadow-[0_8px_32px_0_rgba(16,185,129,0.15)]',
    glassCard: 'bg-[#0b281e]/60 hover:bg-[#10372a]/70 backdrop-blur-xl border-emerald-500/20 hover:border-emerald-400/50 transition-all shadow-md',
    glassHeader: 'bg-[#05130e]/75 backdrop-blur-2xl border-emerald-500/20',
    glassBorder: 'border-emerald-500/20',
    glassInput: 'bg-[#0a231a]/70 border-emerald-500/30 text-white placeholder-emerald-200/50 focus:border-emerald-400',
    textPrimary: 'text-white',
    textSecondary: 'text-emerald-200/70',
    accentText: 'text-emerald-400',
    accentBg: 'bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-lg shadow-emerald-600/25',
    accentBorder: 'border-emerald-500/50',
  },
  'glass-amber': {
    id: 'glass-amber',
    name: 'Smoky Sunset',
    tagline: 'Warm volcanic obsidian with molten amber and golden hour glass',
    isDark: true,
    accentHex: '#fbbf24',
    previewGradient: 'from-[#140b07] via-[#24130a] to-[#381c0d]',
    appBg: 'bg-[#0f0805] text-amber-50',
    ambientGlow: 'from-amber-500/20 via-orange-500/15 to-transparent',
    glassPanel: 'bg-[#22120a]/65 backdrop-blur-2xl border-amber-500/20 shadow-[0_8px_32px_0_rgba(245,158,11,0.15)]',
    glassCard: 'bg-[#29170d]/60 hover:bg-[#361e11]/70 backdrop-blur-xl border-amber-500/20 hover:border-amber-400/50 transition-all shadow-md',
    glassHeader: 'bg-[#140b07]/75 backdrop-blur-2xl border-amber-500/20',
    glassBorder: 'border-amber-500/20',
    glassInput: 'bg-[#23130a]/70 border-amber-500/30 text-white placeholder-amber-200/50 focus:border-amber-400',
    textPrimary: 'text-white',
    textSecondary: 'text-amber-200/70',
    accentText: 'text-amber-400',
    accentBg: 'bg-amber-600 hover:bg-amber-500 text-slate-950 font-semibold shadow-lg shadow-amber-600/25',
    accentBorder: 'border-amber-500/50',
  },
  'glass-stealth': {
    id: 'glass-stealth',
    name: 'Midnight OLED',
    tagline: 'Pure deep black OLED canvas with minimalist hairline platinum frost',
    isDark: true,
    accentHex: '#f8fafc',
    previewGradient: 'from-black via-[#09090b] to-[#121215]',
    appBg: 'bg-black text-zinc-100',
    ambientGlow: 'from-zinc-700/10 via-zinc-800/5 to-transparent',
    glassPanel: 'bg-zinc-950/70 backdrop-blur-2xl border-zinc-800 shadow-[0_8px_32px_0_rgba(0,0,0,0.8)]',
    glassCard: 'bg-zinc-950/60 hover:bg-zinc-900/70 backdrop-blur-xl border-zinc-800 hover:border-zinc-700 transition-all shadow-md',
    glassHeader: 'bg-black/80 backdrop-blur-2xl border-zinc-800',
    glassBorder: 'border-zinc-800',
    glassInput: 'bg-zinc-900/70 border-zinc-800 text-white placeholder-zinc-500 focus:border-zinc-600',
    textPrimary: 'text-white',
    textSecondary: 'text-zinc-400',
    accentText: 'text-white',
    accentBg: 'bg-white hover:bg-zinc-200 text-black font-semibold',
    accentBorder: 'border-zinc-700',
  },
};

interface ThemeContextType {
  currentTheme: GlassThemeId;
  themeConfig: ThemeConfig;
  setTheme: (theme: GlassThemeId) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentTheme, setCurrentThemeState] = useState<GlassThemeId>(() => {
    try {
      const stored = localStorage.getItem('beacon_glass_theme') as GlassThemeId;
      if (stored && GLASS_THEMES[stored]) {
        return stored;
      }
    } catch (_) {}
    return 'glass-dark';
  });

  const setTheme = (theme: GlassThemeId) => {
    if (!GLASS_THEMES[theme]) return;
    setCurrentThemeState(theme);
    try {
      localStorage.setItem('beacon_glass_theme', theme);
    } catch (_) {}
    document.documentElement.setAttribute('data-theme', theme);
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', currentTheme);
  }, [currentTheme]);

  const themeConfig = GLASS_THEMES[currentTheme] || GLASS_THEMES['glass-dark'];

  return (
    <ThemeContext.Provider
      value={{
        currentTheme,
        themeConfig,
        setTheme,
        isDark: themeConfig.isDark,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
