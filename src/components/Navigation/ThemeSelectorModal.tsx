import React from 'react';
import { useTheme, GLASS_THEMES, GlassThemeId } from '../../context/ThemeContext.tsx';
import { X, Check, Palette, Sparkles, Moon, Sun } from 'lucide-react';

interface ThemeSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ThemeSelectorModal: React.FC<ThemeSelectorModalProps> = ({ isOpen, onClose }) => {
  const { currentTheme, setTheme, themeConfig } = useTheme();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div
        className={`w-full max-w-xl rounded-3xl p-6 ${themeConfig.glassPanel} border shadow-2xl relative overflow-hidden`}
      >
        {/* Ambient background glow inside modal */}
        <div
          className={`absolute -top-24 -right-24 w-72 h-72 rounded-full bg-gradient-to-br ${themeConfig.ambientGlow} blur-3xl pointer-events-none`}
        />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/15 flex items-center justify-center shadow-inner">
              <Palette className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <span>Glass Themes & Optics</span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-white/15 text-white font-semibold">
                  6 Themes
                </span>
              </h3>
              <p className="text-xs text-white/70">
                Switch between frosted crystal, obsidian, cyber neon, or forest glass
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-white/70 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Theme Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 my-5 max-h-[60vh] overflow-y-auto pr-1 relative z-10">
          {(Object.keys(GLASS_THEMES) as GlassThemeId[]).map((themeId) => {
            const t = GLASS_THEMES[themeId];
            const isSelected = currentTheme === themeId;

            return (
              <button
                key={themeId}
                onClick={() => setTheme(themeId)}
                className={`p-3.5 rounded-2xl border text-left transition-all duration-200 relative group overflow-hidden cursor-pointer ${
                  isSelected
                    ? 'ring-2 ring-white/80 border-white/40 shadow-lg scale-[1.02]'
                    : 'border-white/10 hover:border-white/25 hover:scale-[1.01]'
                }`}
              >
                {/* Visual Preview Swatch Bar */}
                <div
                  className={`h-16 w-full rounded-xl bg-gradient-to-r ${t.previewGradient} p-2.5 flex items-end justify-between border border-white/15 relative overflow-hidden shadow-inner mb-3`}
                >
                  {/* Miniature frosted glass card inside preview */}
                  <div className="px-2.5 py-1 rounded-lg bg-white/20 backdrop-blur-md border border-white/30 text-[10px] font-bold text-white shadow-sm flex items-center gap-1.5">
                    {t.isDark ? <Moon className="w-3 h-3" /> : <Sun className="w-3 h-3 text-amber-300" />}
                    <span>{t.isDark ? 'Dark Glass' : 'Light Glass'}</span>
                  </div>

                  <div
                    className="w-4 h-4 rounded-full border-2 border-white shadow-sm"
                    style={{ backgroundColor: t.accentHex }}
                  />
                </div>

                {/* Theme Titles and Descriptions */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-white text-sm tracking-tight flex items-center gap-1.5">
                      <span>{t.name}</span>
                      {isSelected && (
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      )}
                    </h4>
                    <p className="text-xs text-white/70 mt-0.5 leading-snug line-clamp-2">
                      {t.tagline}
                    </p>
                  </div>

                  {isSelected && (
                    <div className="w-6 h-6 rounded-full bg-white text-slate-950 flex items-center justify-center shrink-0 shadow-md">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Modal Footer */}
        <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs text-white/60 relative z-10">
          <span>Active: <strong className="text-white">{themeConfig.name}</strong></span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-white text-slate-950 hover:bg-slate-200 font-bold text-xs transition-colors shadow cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
