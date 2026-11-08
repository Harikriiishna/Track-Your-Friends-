import React, { createContext, useContext, useState, useEffect } from 'react';

export type GlassThemeId =
  | 'glass-dark'
  | 'glass-light'
  | 'glass-cyber'
  | 'glass-emerald'
  | 'glass-amber'
  | 'glass-stealth';

export interface GlassThemeConfig {
  id: GlassThemeId;
  name: string;
  description: string;
  tagline: string;
  appBg: string;
  glassPanel: string;
  glassCard: string;
  cardBg: string;
  glassHeader: string;
  glassBorder: string;
  glassInput: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accentBg: string;
  accentText: string;
  accentHex: string;
  accentGlow: string;
  ambientGlow: string;
  previewColor: string;
  previewGradient: string;
  isDark: boolean;
}

export const GLASS_THEMES: Record<GlassThemeId, GlassThemeConfig> = {
  'glass-dark': {
    id: 'glass-dark',
    name: 'Beacon Midnight',
    description: 'Vibrant Purple, Hot Pink & Electric Blue on deep midnight velvet (#0B081B)',
    tagline: 'Beacon Network Dark Theme',
    appBg: 'bg-[#0B081B] bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#8957FF]/20 via-[#0B081B] to-[#130F2B]',
    glassPanel: 'bg-[#130F2B]/90 backdrop-blur-2xl border-[#8957FF]/25 shadow-[0_12px_36px_rgba(11,8,27,0.65)]',
    glassCard: 'bg-[#1B153A]/85 backdrop-blur-xl border-[#8957FF]/25 hover:border-[#FF4FA3]/50 transition-all',
    cardBg: 'bg-[#1B153A]/85 backdrop-blur-xl border-[#8957FF]/25 hover:border-[#FF4FA3]/50 transition-all',
    glassHeader: 'bg-[#0B081B]/90 backdrop-blur-2xl border-[#8957FF]/25',
    glassBorder: 'border-white/10',
    glassInput: 'bg-[#130F2B]/90 backdrop-blur-md border-[#8957FF]/35 focus:border-[#FF4FA3] text-[#F8F7FF]',
    textPrimary: 'text-[#F8F7FF]',
    textSecondary: 'text-[#A9A2D0]',
    textMuted: 'text-[#7E76A8]',
    accentBg: 'bg-gradient-to-r from-[#8957FF] via-[#FF4FA3] to-[#FF8066] hover:opacity-95 text-white shadow-[0_6px_20px_rgba(255,79,163,0.35)]',
    accentText: 'text-[#00D9FF]',
    accentHex: '#8957FF',
    accentGlow: 'shadow-purple-500/25',
    ambientGlow: 'from-[#8957FF]/20 via-[#FF4FA3]/15 to-transparent',
    previewColor: 'from-[#8957FF] via-[#FF4FA3] to-[#FF8066]',
    previewGradient: 'from-[#8957FF] via-[#FF4FA3] to-[#FF8066]',
    isDark: true,
  },
  'glass-light': {
    id: 'glass-light',
    name: 'Beacon Daylight',
    description: 'Clean daylight canvas with Lavender, Purple & Coral gradients',
    tagline: 'Beacon Network Light Theme',
    appBg: 'bg-[#F8F6FF] bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#E9DFFF]/80 via-[#F8F6FF] to-[#FFF0F7]',
    glassPanel: 'bg-white/92 backdrop-blur-2xl border-[#8957FF]/15 shadow-[0_10px_30px_rgba(137,87,255,0.08)]',
    glassCard: 'bg-white/95 backdrop-blur-xl border-[#8957FF]/15 hover:border-[#FF4FA3]/45 shadow-sm transition-all',
    cardBg: 'bg-white/95 backdrop-blur-xl border-[#8957FF]/15 hover:border-[#FF4FA3]/45 shadow-sm transition-all',
    glassHeader: 'bg-white/90 backdrop-blur-2xl border-[#8957FF]/15',
    glassBorder: 'border-[#8957FF]/15',
    glassInput: 'bg-white border-[#8957FF]/25 focus:border-[#8957FF] text-slate-900',
    textPrimary: 'text-slate-900',
    textSecondary: 'text-slate-600',
    textMuted: 'text-slate-400',
    accentBg: 'bg-gradient-to-r from-[#8957FF] via-[#FF4FA3] to-[#FF8066] hover:opacity-95 text-white shadow-[0_6px_18px_rgba(137,87,255,0.3)]',
    accentText: 'text-[#8957FF]',
    accentHex: '#8957FF',
    accentGlow: 'shadow-purple-500/20',
    ambientGlow: 'from-[#8957FF]/15 via-[#FF4FA3]/10 to-transparent',
    previewColor: 'from-[#8957FF] via-[#FF4FA3] to-[#397BFF]',
    previewGradient: 'from-[#8957FF] via-[#FF4FA3] to-[#397BFF]',
    isDark: false,
  },
  'glass-cyber': {
    id: 'glass-cyber',
    name: 'Sunset Pop',
    description: 'Hot Pink (#FF4FA3), Coral (#FF8066) & Sunshine Yellow (#FFD166) social glow',
    tagline: 'Hot Pink & Coral Vibes',
    appBg: 'bg-[#12071D] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#FF4FA3]/25 via-[#12071D] to-[#1D0B2B]',
    glassPanel: 'bg-[#1D0E2E]/90 backdrop-blur-2xl border-[#FF4FA3]/30 shadow-2xl',
    glassCard: 'bg-[#26123B]/80 backdrop-blur-xl border-[#FF4FA3]/25 hover:border-[#FF8066]/55',
    cardBg: 'bg-[#26123B]/80 backdrop-blur-xl border-[#FF4FA3]/25 hover:border-[#FF8066]/55',
    glassHeader: 'bg-[#12071D]/90 backdrop-blur-2xl border-[#FF4FA3]/30',
    glassBorder: 'border-[#FF4FA3]/20',
    glassInput: 'bg-[#180A26]/90 backdrop-blur-md border-[#FF4FA3]/35 focus:border-[#FF8066] text-white',
    textPrimary: 'text-[#FFF5FA]',
    textSecondary: 'text-[#E2B8D2]',
    textMuted: 'text-[#B388A3]',
    accentBg: 'bg-gradient-to-r from-[#FF4FA3] to-[#FF8066] hover:opacity-95 text-white shadow-[0_6px_20px_rgba(255,79,163,0.4)]',
    accentText: 'text-[#FF8066]',
    accentHex: '#FF4FA3',
    accentGlow: 'shadow-pink-500/30',
    ambientGlow: 'from-[#FF4FA3]/25 via-[#FF8066]/15 to-transparent',
    previewColor: 'from-[#FF4FA3] via-[#FF8066] to-[#FFD166]',
    previewGradient: 'from-[#FF4FA3] via-[#FF8066] to-[#FFD166]',
    isDark: true,
  },
  'glass-emerald': {
    id: 'glass-emerald',
    name: 'Mint & Aqua Wave',
    description: 'Mint Green (#00D6A0) & Aqua Cyan (#00D9FF) fresh location pulse',
    tagline: 'Fresh Mint & Aqua Cyan',
    appBg: 'bg-[#06151F] bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-[#00D6A0]/20 via-[#06151F] to-[#081E2B]',
    glassPanel: 'bg-[#0B2230]/90 backdrop-blur-2xl border-[#00D6A0]/30 shadow-2xl',
    glassCard: 'bg-[#102C3D]/80 backdrop-blur-xl border-[#00D6A0]/25 hover:border-[#00D9FF]/50',
    cardBg: 'bg-[#102C3D]/80 backdrop-blur-xl border-[#00D6A0]/25 hover:border-[#00D9FF]/50',
    glassHeader: 'bg-[#06151F]/90 backdrop-blur-2xl border-[#00D6A0]/25',
    glassBorder: 'border-[#00D6A0]/20',
    glassInput: 'bg-[#091C28]/90 backdrop-blur-md border-[#00D6A0]/35 focus:border-[#00D9FF] text-white',
    textPrimary: 'text-emerald-50',
    textSecondary: 'text-teal-200/75',
    textMuted: 'text-teal-400/60',
    accentBg: 'bg-gradient-to-r from-[#00D6A0] to-[#00D9FF] hover:opacity-95 text-slate-950 font-extrabold',
    accentText: 'text-[#00D6A0]',
    accentHex: '#00D6A0',
    accentGlow: 'shadow-emerald-500/25',
    ambientGlow: 'from-[#00D6A0]/20 via-[#00D9FF]/15 to-transparent',
    previewColor: 'from-[#00D6A0] to-[#00D9FF]',
    previewGradient: 'from-[#00D6A0] to-[#00D9FF]',
    isDark: true,
  },
  'glass-amber': {
    id: 'glass-amber',
    name: 'Electric Ocean',
    description: 'Electric Blue (#397BFF) & Aqua Cyan (#00D9FF) Telegram-inspired theme',
    tagline: 'Electric Blue & Cyan',
    appBg: 'bg-[#071024] bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#397BFF]/25 via-[#071024] to-[#0B1936]',
    glassPanel: 'bg-[#0E1B38]/90 backdrop-blur-2xl border-[#397BFF]/30 shadow-2xl',
    glassCard: 'bg-[#132448]/80 backdrop-blur-xl border-[#397BFF]/25 hover:border-[#00D9FF]/50',
    cardBg: 'bg-[#132448]/80 backdrop-blur-xl border-[#397BFF]/25 hover:border-[#00D9FF]/50',
    glassHeader: 'bg-[#071024]/90 backdrop-blur-2xl border-[#397BFF]/30',
    glassBorder: 'border-[#397BFF]/20',
    glassInput: 'bg-[#0B162E]/90 backdrop-blur-md border-[#397BFF]/35 focus:border-[#00D9FF] text-white',
    textPrimary: 'text-[#F5F9FF]',
    textSecondary: 'text-[#9BB5E8]',
    textMuted: 'text-[#6A88C2]',
    accentBg: 'bg-gradient-to-r from-[#397BFF] to-[#00D9FF] hover:opacity-95 text-white shadow-[0_6px_20px_rgba(57,123,255,0.35)]',
    accentText: 'text-[#00D9FF]',
    accentHex: '#397BFF',
    accentGlow: 'shadow-blue-500/25',
    ambientGlow: 'from-[#397BFF]/20 via-[#00D9FF]/15 to-transparent',
    previewColor: 'from-[#397BFF] to-[#00D9FF]',
    previewGradient: 'from-[#397BFF] to-[#00D9FF]',
    isDark: true,
  },
  'glass-stealth': {
    id: 'glass-stealth',
    name: 'Lavender Dream (Light)',
    description: 'Soft Lavender (#E9DFFF), Vibrant Purple (#8957FF) & Electric Blue (#397BFF)',
    tagline: 'Pastel Lavender & Electric Blue',
    appBg: 'bg-[#F3EEFF] bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-[#E9DFFF] via-[#F6F2FF] to-[#EBF3FF]',
    glassPanel: 'bg-white/90 backdrop-blur-2xl border-[#8957FF]/20 shadow-[0_10px_30px_rgba(137,87,255,0.1)]',
    glassCard: 'bg-white/95 backdrop-blur-xl border-[#8957FF]/20 hover:border-[#397BFF]/45 shadow-sm',
    cardBg: 'bg-white/95 backdrop-blur-xl border-[#8957FF]/20 hover:border-[#397BFF]/45 shadow-sm',
    glassHeader: 'bg-white/90 backdrop-blur-2xl border-[#8957FF]/20',
    glassBorder: 'border-[#8957FF]/20',
    glassInput: 'bg-white border-[#8957FF]/30 focus:border-[#397BFF] text-slate-900',
    textPrimary: 'text-slate-900',
    textSecondary: 'text-slate-600',
    textMuted: 'text-slate-400',
    accentBg: 'bg-gradient-to-r from-[#8957FF] to-[#397BFF] hover:opacity-95 text-white shadow-[0_6px_18px_rgba(137,87,255,0.3)]',
    accentText: 'text-[#8957FF]',
    accentHex: '#8957FF',
    accentGlow: 'shadow-indigo-500/20',
    ambientGlow: 'from-[#E9DFFF]/50 via-[#8957FF]/10 to-transparent',
    previewColor: 'from-[#8957FF] via-[#397BFF] to-[#00D9FF]',
    previewGradient: 'from-[#8957FF] via-[#397BFF] to-[#00D9FF]',
    isDark: false,
  },
};

interface ThemeContextType {
  currentTheme: GlassThemeId;
  themeConfig: GlassThemeConfig;
  setTheme: (id: GlassThemeId) => void;
  toggleDarkLight: () => void;
  allThemes: GlassThemeConfig[];
  isLiteMode: boolean;
  setLiteMode: (val: boolean) => void;
  isLowEndDeviceDetected: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = 'beacon_glass_theme_v1';
const LITE_STORAGE_KEY = 'beacon_lite_mode_v1';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentTheme, setCurrentTheme] = useState<GlassThemeId>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as GlassThemeId;
      if (saved && GLASS_THEMES[saved]) return saved;
    } catch {
      // ignore storage errors
    }
    return 'glass-dark';
  });

  const [isLiteMode, setIsLiteMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem(LITE_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, currentTheme);
    } catch {
      // ignore
    }
  }, [currentTheme]);

  const setLiteMode = (val: boolean) => {
    setIsLiteMode(val);
    try {
      localStorage.setItem(LITE_STORAGE_KEY, String(val));
    } catch {
      // ignore
    }
  };

  const themeConfig = GLASS_THEMES[currentTheme] || GLASS_THEMES['glass-dark'];

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', themeConfig.isDark);
      document.documentElement.style.colorScheme = themeConfig.isDark ? 'dark' : 'light';
    }
  }, [themeConfig.isDark]);

  const toggleDarkLight = () => {
    setCurrentTheme((prev) => {
      const curr = GLASS_THEMES[prev] || GLASS_THEMES['glass-dark'];
      return curr.isDark ? 'glass-light' : 'glass-dark';
    });
  };

  const value: ThemeContextType = {
    currentTheme,
    themeConfig,
    setTheme: setCurrentTheme,
    toggleDarkLight,
    allThemes: Object.values(GLASS_THEMES),
    isLiteMode,
    setLiteMode,
    isLowEndDeviceDetected: false,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
