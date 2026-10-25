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
    ambientGlow: 'from-sky-500/10 via-indigo-500/5 to-transparent',
    glassPanel: 'bg-slate-900/80 backdrop-blur-md border-white/10 shadow-lg',
    glassCard: 'bg-slate-900/70 hover:bg-slate-800/80 backdrop-blur-sm border-white/10 hover:border-sky-400/30 transition-all shadow-md',
    glassHeader: 'bg-slate-950/85 backdrop-blur-md border-white/10',
    glassBorder: 'border-white/10',
    glassInput: 'bg-slate-900/80 border-white/15 text-white placeholder-slate-400 focus:border-sky-400',
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
    ambientGlow: 'from-blue-400/10 via-indigo-300/5 to-transparent',
    glassPanel: 'bg-white/85 backdrop-blur-md border-white/60 shadow-md',
    glassCard: 'bg-white/80 hover:bg-white/95 backdrop-blur-sm border-slate-200/70 hover:border-blue-400/50 transition-all shadow-sm',
    glassHeader: 'bg-white/90 backdrop-blur-md border-slate-200/80',
    glassBorder: 'border-slate-200/80',
    glassInput: 'bg-white/90 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-500',
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
    ambientGlow: 'from-fuchsia-600/15 via-purple-600/10 to-cyan-500/5',
    glassPanel: 'bg-[#150a24]/80 backdrop-blur-md border-fuchsia-500/20 shadow-lg',
    glassCard: 'bg-[#1a0e2d]/75 hover:bg-[#23123d]/85 backdrop-blur-sm border-fuchsia-500/20 hover:border-fuchsia-400/50 transition-all shadow-md',
    glassHeader: 'bg-[#0d0714]/85 backdrop-blur-md border-fuchsia-500/20',
    glassBorder: 'border-fuchsia-500/20',
    glassInput: 'bg-[#180c2b]/80 border-fuchsia-500/30 text-white placeholder-purple-300/50 focus:border-fuchsia-400',
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
    ambientGlow: 'from-emerald-500/15 via-teal-500/10 to-transparent',
    glassPanel: 'bg-[#092219]/80 backdrop-blur-md border-emerald-500/20 shadow-lg',
    glassCard: 'bg-[#0b281e]/75 hover:bg-[#10372a]/85 backdrop-blur-sm border-emerald-500/20 hover:border-emerald-400/50 transition-all shadow-md',
    glassHeader: 'bg-[#05130e]/85 backdrop-blur-md border-emerald-500/20',
    glassBorder: 'border-emerald-500/20',
    glassInput: 'bg-[#0a231a]/80 border-emerald-500/30 text-white placeholder-emerald-200/50 focus:border-emerald-400',
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
    ambientGlow: 'from-amber-500/15 via-orange-500/10 to-transparent',
    glassPanel: 'bg-[#22120a]/80 backdrop-blur-md border-amber-500/20 shadow-lg',
    glassCard: 'bg-[#29170d]/75 hover:bg-[#361e11]/85 backdrop-blur-sm border-amber-500/20 hover:border-amber-400/50 transition-all shadow-md',
    glassHeader: 'bg-[#140b07]/85 backdrop-blur-md border-amber-500/20',
    glassBorder: 'border-amber-500/20',
    glassInput: 'bg-[#23130a]/80 border-amber-500/30 text-white placeholder-amber-200/50 focus:border-amber-400',
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
    ambientGlow: 'from-zinc-700/5 via-zinc-800/5 to-transparent',
    glassPanel: 'bg-zinc-950/85 backdrop-blur-md border-zinc-800 shadow-xl',
    glassCard: 'bg-zinc-950/75 hover:bg-zinc-900/85 backdrop-blur-sm border-zinc-800 hover:border-zinc-700 transition-all shadow-md',
    glassHeader: 'bg-black/90 backdrop-blur-md border-zinc-800',
    glassBorder: 'border-zinc-800',
    glassInput: 'bg-zinc-900/80 border-zinc-800 text-white placeholder-zinc-500 focus:border-zinc-600',
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
