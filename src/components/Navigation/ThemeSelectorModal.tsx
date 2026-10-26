import React from 'react';
import { useTheme, GLASS_THEMES, GlassThemeId } from '../../context/ThemeContext.tsx';
import { X, Check, Palette, Zap, Moon, Sun } from 'lucide-react';

interface ThemeSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ThemeSelectorModal: React.FC<ThemeSelectorModalProps> = ({ isOpen, onClose }) => {
  const { currentTheme, setTheme, themeConfig, isLiteMode, setLiteMode, isLowEndDeviceDetected } = useTheme();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 animate-fade-smooth">
      <div
        className={`w-full max-w-xl rounded-3xl p-6 ${themeConfig.glassPanel} border shadow-2xl relative overflow-hidden animate-pop-in`}
      >
        {/* Ambient background glow inside modal (skipped in Lite Mode) */}
        {!isLiteMode && (
          <div
            className={`absolute -top-24 -right-24 w-72 h-72 rounded-full bg-gradient-to-br ${themeConfig.ambientGlow} blur-3xl pointer-events-none`}
          />
        )}

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center shadow-inner">
              <Palette className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <span>Themes & Performance</span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-white/15 text-white font-semibold">
                  6 Themes
                </span>
              </h3>
              <p className="text-xs text-white/70">
                Customize visual optics and low-end device hardware acceleration
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

        {/* Low-End Device / Lite Performance Mode Toggle */}
        <div className="mt-4 p-3.5 rounded-2xl border border-emerald-500/30 bg-emerald-950/40 flex items-center justify-between gap-3 relative z-10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0">
              <Zap className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white">Lite Mode (Low-End Device Boost)</span>
                {isLowEndDeviceDetected && (
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[9px] font-mono font-bold">
                    Auto-Detected
                  </span>
                )}
              </div>
              <p className="text-[11px] text-white/70 leading-snug mt-0.5">
                Disables heavy GPU blur, reduces RAM usage, and uses Canvas map rendering for 60fps on budget phones.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setLiteMode(!isLiteMode)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 cursor-pointer transition-colors ${
              isLiteMode
                ? 'bg-emerald-500 text-slate-950 shadow-sm'
                : 'bg-white/10 text-white hover:bg-white/20 border border-white/15'
            }`}
          >
            {isLiteMode ? 'Enabled' : 'Enable'}
          </button>
        </div>

        {/* Theme Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 my-4 max-h-[52vh] overflow-y-auto pr-1 relative z-10">
          {(Object.keys(GLASS_THEMES) as GlassThemeId[]).map((themeId) => {
            const t = GLASS_THEMES[themeId];
            const isSelected = currentTheme === themeId;

            return (
              <button
                key={themeId}
                onClick={() => setTheme(themeId)}
                className={`p-3.5 rounded-2xl border text-left transition-all duration-200 relative group overflow-hidden cursor-pointer ${
                  isSelected
                    ? 'ring-2 ring-white/80 border-white/40 shadow-lg scale-[1.01]'
                    : 'border-white/10 hover:border-white/25'
                }`}
              >
                {/* Visual Preview Swatch Bar */}
                <div
                  className={`h-14 w-full rounded-xl bg-gradient-to-r ${t.previewGradient} p-2.5 flex items-end justify-between border border-white/15 relative overflow-hidden shadow-inner mb-2.5`}
                >
                  <div className="px-2.5 py-1 rounded-lg bg-black/40 border border-white/30 text-[10px] font-bold text-white shadow-sm flex items-center gap-1.5">
                    {t.isDark ? <Moon className="w-3 h-3" /> : <Sun className="w-3 h-3 text-amber-300" />}
                    <span>{t.isDark ? 'Dark' : 'Light'}</span>
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
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
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
          <span>
            Active: <strong className="text-white">{themeConfig.name}</strong>
            {isLiteMode ? ' · Lite Mode ON' : ''}
          </span>
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
