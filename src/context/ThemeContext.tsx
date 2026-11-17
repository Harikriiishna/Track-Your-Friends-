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
    name: 'Beacon Neon Social',
    description: 'Deep cosmic violet (#0B081B) with electric purple (#8957FF) & magenta (#FF4FA3) gradients',
    tagline: 'Signature Dark Social Theme',
    appBg: 'bg-[#0B081B] text-[#F8F7FF]',
    glassPanel: 'bg-[#130F2B]/90 backdrop-blur-xl border-[#8957FF]/30 shadow-2xl',
    glassCard: 'bg-[#1B153A]/85 border-[#8957FF]/25 hover:border-[#FF4FA3]/50 shadow-xl transition-all',
    cardBg: 'bg-[#1B153A]/85 border-[#8957FF]/25 hover:border-[#FF4FA3]/50 shadow-xl transition-all',
    glassHeader: 'bg-[#0B081B]/95 backdrop-blur-xl border-[#8957FF]/25',
    glassBorder: 'border-[#8957FF]/25',
    glassInput: 'bg-[#130F2B] border-[#8957FF]/30 focus:border-[#00D9FF] text-[#F8F7FF] placeholder:text-[#A6A1C8]',
    textPrimary: 'text-[#F8F7FF]',
    textSecondary: 'text-[#A6A1C8]',
    textMuted: 'text-[#A6A1C8]',
    accentBg: 'bg-gradient-to-r from-[#8957FF] to-[#FF4FA3] hover:opacity-95 text-white shadow-lg shadow-[#8957FF]/30',
    accentText: 'text-[#00D9FF]',
    accentHex: '#8957FF',
    accentGlow: 'shadow-[0_0_24px_rgba(137,87,255,0.35)]',
    ambientGlow: 'from-[#8957FF]/20 via-[#FF4FA3]/10 to-transparent',
    previewColor: 'bg-[#8957FF]',
    previewGradient: 'bg-gradient-to-r from-[#8957FF] via-[#FF4FA3] to-[#FF8066]',
    isDark: true,
  },
  'glass-light': {
    id: 'glass-light',
    name: 'Daylight Social Crystal',
    description: 'Bright airy lavender-white (#F5F3FF) with vivid violet & pink accents for outdoor sunlight',
    tagline: 'High-Contrast Daylight Mode',
    appBg: 'bg-[#F5F3FF] text-[#161032]',
    glassPanel: 'bg-white/95 backdrop-blur-xl border-[#8957FF]/20 shadow-xl',
    glassCard: 'bg-white border-[#8957FF]/15 hover:border-[#8957FF]/40 shadow-md transition-all',
    cardBg: 'bg-white border-[#8957FF]/15 hover:border-[#8957FF]/40 shadow-md transition-all',
    glassHeader: 'bg-white/95 backdrop-blur-xl border-[#8957FF]/20',
    glassBorder: 'border-[#8957FF]/20',
    glassInput: 'bg-[#F5F3FF] border-[#8957FF]/25 focus:border-[#8957FF] text-[#161032] placeholder:text-[#655E8A]',
    textPrimary: 'text-[#161032]',
    textSecondary: 'text-[#655E8A]',
    textMuted: 'text-[#655E8A]',
    accentBg: 'bg-gradient-to-r from-[#8957FF] to-[#FF4FA3] text-white shadow-md',
    accentText: 'text-[#8957FF]',
    accentHex: '#8957FF',
    accentGlow: 'shadow-[0_8px_24px_rgba(137,87,255,0.2)]',
    ambientGlow: 'from-[#8957FF]/10 via-[#FF4FA3]/5 to-transparent',
    previewColor: 'bg-[#F5F3FF]',
    previewGradient: 'bg-gradient-to-r from-[#8957FF] to-[#397BFF]',
    isDark: false,
  },
  'glass-cyber': {
    id: 'glass-cyber',
    name: 'Cyber Aqua Pulse',
    description: 'Deep ocean slate with electric cyan (#00D9FF) & royal blue (#397BFF) telemetry glow',
    tagline: 'High-Precision Radar Aesthetic',
    appBg: 'bg-[#070B19] text-[#F0F7FF]',
    glassPanel: 'bg-[#0D152D]/90 backdrop-blur-xl border-[#00D9FF]/30 shadow-2xl',
    glassCard: 'bg-[#121D3D]/85 border-[#00D9FF]/25 hover:border-[#00D9FF]/50 shadow-xl transition-all',
    cardBg: 'bg-[#121D3D]/85 border-[#00D9FF]/25 hover:border-[#00D9FF]/50 shadow-xl transition-all',
    glassHeader: 'bg-[#070B19]/95 backdrop-blur-xl border-[#00D9FF]/25',
    glassBorder: 'border-[#00D9FF]/25',
    glassInput: 'bg-[#0D152D] border-[#00D9FF]/30 focus:border-[#00D9FF] text-[#F0F7FF] placeholder:text-[#8BA3C7]',
    textPrimary: 'text-[#F0F7FF]',
    textSecondary: 'text-[#8BA3C7]',
    textMuted: 'text-[#8BA3C7]',
    accentBg: 'bg-gradient-to-r from-[#397BFF] to-[#00D9FF] text-slate-950 font-bold shadow-lg shadow-[#00D9FF]/25',
    accentText: 'text-[#00D9FF]',
    accentHex: '#00D9FF',
    accentGlow: 'shadow-[0_0_24px_rgba(0,217,255,0.35)]',
    ambientGlow: 'from-[#00D9FF]/20 via-[#397BFF]/10 to-transparent',
    previewColor: 'bg-[#00D9FF]',
    previewGradient: 'bg-gradient-to-r from-[#397BFF] to-[#00D9FF]',
    isDark: true,
  },
  'glass-emerald': {
    id: 'glass-emerald',
    name: 'Aurora Mint Matrix',
    description: 'Rich midnight forest with luminous mint (#00D6A0) & aqua accents',
    tagline: 'Outdoor Trail & Expedition Mode',
    appBg: 'bg-[#061512] text-[#ECFDF5]',
    glassPanel: 'bg-[#0B241E]/90 backdrop-blur-xl border-[#00D6A0]/30 shadow-2xl',
    glassCard: 'bg-[#10332B]/85 border-[#00D6A0]/25 hover:border-[#00D6A0]/50 shadow-xl transition-all',
    cardBg: 'bg-[#10332B]/85 border-[#00D6A0]/25 hover:border-[#00D6A0]/50 shadow-xl transition-all',
    glassHeader: 'bg-[#061512]/95 backdrop-blur-xl border-[#00D6A0]/25',
    glassBorder: 'border-[#00D6A0]/25',
    glassInput: 'bg-[#0B241E] border-[#00D6A0]/30 focus:border-[#00D6A0] text-[#ECFDF5] placeholder:text-[#86EFAC]/70',
    textPrimary: 'text-[#ECFDF5]',
    textSecondary: 'text-[#A7F3D0]',
    textMuted: 'text-[#6EE7B7]',
    accentBg: 'bg-gradient-to-r from-[#00D6A0] to-[#00D9FF] text-slate-950 font-bold shadow-lg',
    accentText: 'text-[#00D6A0]',
    accentHex: '#00D6A0',
    accentGlow: 'shadow-[0_0_24px_rgba(0,214,160,0.35)]',
    ambientGlow: 'from-[#00D6A0]/20 to-transparent',
    previewColor: 'bg-[#00D6A0]',
    previewGradient: 'bg-gradient-to-r from-[#00D6A0] to-[#00D9FF]',
    isDark: true,
  },
  'glass-amber': {
    id: 'glass-amber',
    name: 'Sunset Coral Glow',
    description: 'Warm twilight plum with sunset pink (#FF4FA3), coral (#FF8066) & gold (#FFD166)',
    tagline: 'Warm Social Lounge Vibe',
    appBg: 'bg-[#160B18] text-[#FFF5F7]',
    glassPanel: 'bg-[#241128]/90 backdrop-blur-xl border-[#FF8066]/30 shadow-2xl',
    glassCard: 'bg-[#311736]/85 border-[#FF8066]/25 hover:border-[#FFD166]/50 shadow-xl transition-all',
    cardBg: 'bg-[#311736]/85 border-[#FF8066]/25 hover:border-[#FFD166]/50 shadow-xl transition-all',
    glassHeader: 'bg-[#160B18]/95 backdrop-blur-xl border-[#FF8066]/25',
    glassBorder: 'border-[#FF8066]/25',
    glassInput: 'bg-[#241128] border-[#FF8066]/30 focus:border-[#FFD166] text-[#FFF5F7] placeholder:text-[#FBB6CE]',
    textPrimary: 'text-[#FFF5F7]',
    textSecondary: 'text-[#FBB6CE]',
    textMuted: 'text-[#F687B3]',
    accentBg: 'bg-gradient-to-r from-[#FF4FA3] via-[#FF8066] to-[#FFD166] text-slate-950 font-bold shadow-lg',
    accentText: 'text-[#FFD166]',
    accentHex: '#FF8066',
    accentGlow: 'shadow-[0_0_24px_rgba(255,128,102,0.35)]',
    ambientGlow: 'from-[#FF4FA3]/20 via-[#FF8066]/10 to-transparent',
    previewColor: 'bg-[#FF8066]',
    previewGradient: 'bg-gradient-to-r from-[#FF4FA3] via-[#FF8066] to-[#FFD166]',
    isDark: true,
  },
  'glass-stealth': {
    id: 'glass-stealth',
    name: 'OLED Midnight Stealth',
    description: 'True pitch-black OLED power-saving surface with subtle violet & cyan highlights',
    tagline: 'Battery Saver OLED Mode',
    appBg: 'bg-[#030208] text-[#F8F7FF]',
    glassPanel: 'bg-[#0B081B]/95 backdrop-blur-xl border-white/15 shadow-2xl',
    glassCard: 'bg-[#110D26]/90 border-white/10 hover:border-[#8957FF]/40 shadow-xl transition-all',
    cardBg: 'bg-[#110D26]/90 border-white/10 hover:border-[#8957FF]/40 shadow-xl transition-all',
    glassHeader: 'bg-[#030208]/95 backdrop-blur-xl border-white/15',
    glassBorder: 'border-white/15',
    glassInput: 'bg-[#0B081B] border-white/15 focus:border-[#8957FF] text-[#F8F7FF] placeholder:text-slate-400',
    textPrimary: 'text-[#F8F7FF]',
    textSecondary: 'text-slate-300',
    textMuted: 'text-slate-400',
    accentBg: 'bg-gradient-to-r from-[#8957FF] to-[#397BFF] text-white shadow-lg',
    accentText: 'text-[#8957FF]',
    accentHex: '#8957FF',
    accentGlow: 'shadow-[0_0_20px_rgba(137,87,255,0.25)]',
    ambientGlow: 'from-[#8957FF]/10 to-transparent',
    previewColor: 'bg-[#110D26]',
    previewGradient: 'bg-gradient-to-r from-[#110D26] via-[#8957FF] to-[#00D9FF]',
    isDark: true,
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
  isLowPowerMode: boolean;
  setLowPowerMode: (val: boolean) => void;
  toggleLowPowerMode: () => void;
  isLowEndDeviceDetected: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = 'beacon_glass_theme_v1';
const LITE_STORAGE_KEY = 'beacon_lite_mode_v1';
export const LOW_POWER_STORAGE_KEY = 'beacon_low_power_mode_v1';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentTheme, setCurrentTheme] = useState<GlassThemeId>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as GlassThemeId | null;
      if (saved && GLASS_THEMES[saved]) {
        return saved;
      }
    } catch {}
    return 'glass-dark';
  });

  const [isLowPowerMode, setIsLowPowerModeState] = useState<boolean>(() => {
    try {
      const savedLowPower = localStorage.getItem(LOW_POWER_STORAGE_KEY);
      if (savedLowPower !== null) {
        return savedLowPower === 'true';
      }
      return localStorage.getItem(LITE_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, currentTheme);
    } catch {}
  }, [currentTheme]);

  const setLowPowerMode = (val: boolean) => {
    setIsLowPowerModeState(val);
    try {
      localStorage.setItem(LOW_POWER_STORAGE_KEY, String(val));
      localStorage.setItem(LITE_STORAGE_KEY, String(val));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('beacon:low-power-mode-changed', { detail: { enabled: val } })
        );
      }
    } catch {}
  };

  const toggleLowPowerMode = () => {
    setLowPowerMode(!isLowPowerMode);
  };

  const themeConfig = GLASS_THEMES[currentTheme] || GLASS_THEMES['glass-dark'];

  useEffect(() => {
    if (typeof document !== 'undefined') {
      if (themeConfig.isDark) {
        document.documentElement.classList.add('dark');
        document.documentElement.style.colorScheme = 'dark';
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.style.colorScheme = 'light';
      }
    }
  }, [themeConfig.isDark]);

  const toggleDarkLight = () => {
    setCurrentTheme((prev) => (GLASS_THEMES[prev]?.isDark ? 'glass-light' : 'glass-dark'));
  };

  const value: ThemeContextType = {
    currentTheme,
    themeConfig,
    setTheme: setCurrentTheme,
    toggleDarkLight,
    allThemes: Object.values(GLASS_THEMES),
    isLiteMode: isLowPowerMode,
    setLiteMode: setLowPowerMode,
    isLowPowerMode,
    setLowPowerMode,
    toggleLowPowerMode,
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
