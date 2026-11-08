import React, { useState } from 'react';
import {
  Compass,
  MapPin,
  Users,
  Shield,
  Radio,
  ArrowRight,
  ChevronRight,
  Lock,
  Siren,
  Sparkles,
  LogIn,
} from 'lucide-react';

interface SplashOnboardingProps {
  onGetStarted: () => void;
  onLogin: () => void;
}

interface OnboardingSlide {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  metrics: { label: string; value: string; accent: string }[];
  features: string[];
  accentColor: string;
  secondaryColor: string;
  gradient: string;
  icon: React.ElementType;
}

const SLIDES: OnboardingSlide[] = [
  {
    id: 'realtime-location',
    badge: '01 / BEACON NETWORK LIVE MAP',
    title: 'Real-Time Location Sharing',
    subtitle:
      'Share your live spot with friends and family with colourful story-ring map pins, directional headings, and hardware-accelerated clustering across Android and Web.',
    metrics: [
      { label: 'GPS Precision', value: '±3m–15m', accent: '#00D9FF' },
      { label: 'Sync Latency', value: '< 150ms', accent: '#00D6A0' },
      { label: 'Privacy Control', value: '1-Tap Pause', accent: '#FF4FA3' },
    ],
    features: [
      'Instant 1-tap Location Sharing & Ghost Mode controls',
      'Live distance, speed & bearing calculation with friends',
      'Ephemeral 24-hour breadcrumb trails with instant purge',
    ],
    accentColor: '#FF4FA3',
    secondaryColor: '#8957FF',
    gradient: 'from-[#8957FF] via-[#FF4FA3] to-[#FF8066]',
    icon: MapPin,
  },
  {
    id: 'connected-friends',
    badge: '02 / BEACON NETWORK CIRCLE',
    title: 'Stay Connected With Friends',
    subtitle:
      'Connect with your inner circle using unique Beacon IDs. See live online rings, proximity distances, and chat with expressive gradient bubbles.',
    metrics: [
      { label: 'Identity', value: 'Unique @ID', accent: '#8957FF' },
      { label: 'Voice & Chat', value: 'Waveform HD', accent: '#00D9FF' },
      { label: 'Permissions', value: 'Granular RBAC', accent: '#FFD166' },
    ],
    features: [
      'Add friends via Unique User ID, @username, or email',
      'Approve permanent or 1-hour temporary location access',
      'Direct 1-to-1 messaging, voice notes, photos & live pins',
    ],
    accentColor: '#00D9FF',
    secondaryColor: '#397BFF',
    gradient: 'from-[#397BFF] to-[#00D9FF]',
    icon: Users,
  },
  {
    id: 'rooms-and-alerts',
    badge: '03 / ROOMS & SAFETY ALERTS',
    title: 'Private Rooms & Community Alerts',
    subtitle:
      'Create colourful rooms for your squad or family, hang out in live WebRTC voice lounges, or broadcast 5km Emergency SOS alerts.',
    metrics: [
      { label: 'SOS Broadcast', value: '5 km Radius', accent: '#FF4FA3' },
      { label: 'Private Rooms', value: 'Encrypted Key', accent: '#00D6A0' },
      { label: 'Universal Hub', value: 'Live Lounge', accent: '#FFD166' },
    ],
    features: [
      'Colourful private rooms with Admin & Member roles',
      'Saved place geofence alerts when friends arrive or leave',
      'One-tap Emergency SOS with live responder tracking link',
    ],
    accentColor: '#00D6A0',
    secondaryColor: '#00D9FF',
    gradient: 'from-[#00D6A0] to-[#00D9FF]',
    icon: Shield,
  },
];

export const SplashOnboarding: React.FC<SplashOnboardingProps> = ({
  onGetStarted,
  onLogin,
}) => {
  const [activeSlide, setActiveSlide] = useState(0);

  const slide = SLIDES[activeSlide];
  const SlideIcon = slide.icon;

  return (
    <div className="h-full min-h-screen w-full bg-[#0B0719] text-[#F8F7FF] flex flex-col justify-between relative overflow-y-auto overflow-x-hidden select-none">
      {/* Vibrant Ambient Social Blobs (Zero-cost GPU radial gradients) */}
      <div
        className="pointer-events-none fixed -top-32 left-1/4 w-[520px] h-[520px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(137, 87, 255, 0.26) 0%, transparent 70%)',
        }}
      />
      <div
        className="pointer-events-none fixed top-1/3 -right-24 w-[460px] h-[460px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(255, 79, 163, 0.22) 0%, transparent 70%)',
        }}
      />
      <div
        className="pointer-events-none fixed -bottom-32 left-10 w-[440px] h-[440px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(0, 217, 255, 0.18) 0%, transparent 70%)',
        }}
      />

      {/* Top Brand Bar */}
      <header className="relative z-10 w-full max-w-5xl mx-auto px-5 pt-6 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-11 h-11">
            <span className="absolute inset-0 rounded-2xl bg-[#FF4FA3]/30 animate-ping opacity-40" />
            <div className="relative w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#8957FF] via-[#FF4FA3] to-[#FF8066] flex items-center justify-center text-white shadow-lg shadow-[#8957FF]/30">
              <Compass className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-black tracking-tight text-white">
                BEACON NETWORK
              </span>
              <span className="hidden sm:inline-flex px-2.5 py-0.5 rounded-full bg-gradient-to-r from-[#8957FF]/25 to-[#FF4FA3]/25 border border-[#FF4FA3]/40 text-[10px] font-extrabold text-[#FF4FA3]">
                LIVE MESH
              </span>
            </div>
            <p className="text-xs text-[#E9DFFF]/75 font-medium">Stay Connected. Stay Together.</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onLogin}
          className="px-4 py-2 rounded-2xl bg-[#181134]/90 hover:bg-[#221848] border border-[#8957FF]/40 text-xs font-extrabold text-white flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-md"
        >
          <LogIn className="w-3.5 h-3.5 text-[#00D9FF]" />
          <span>Login</span>
        </button>
      </header>

      {/* Main Onboarding Showcase */}
      <main className="relative z-10 flex-1 flex flex-col justify-center w-full max-w-5xl mx-auto px-5 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Left Interactive Social Radar / Visual Hub */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center">
            <div className="relative w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center">
              {/* Outer Colourful Rings */}
              <div className="absolute inset-0 rounded-full border-2 border-[#8957FF]/30" />
              <div
                className="absolute inset-6 rounded-full border-2 border-dashed border-[#FF4FA3]/40 animate-spin"
                style={{ animationDuration: '26s' }}
              />
              <div className="absolute inset-12 rounded-full border-2 border-[#00D9FF]/30" />
              <div
                className="absolute inset-16 rounded-full animate-pulse"
                style={{
                  background: `radial-gradient(circle, ${slide.accentColor}30 0%, transparent 70%)`,
                }}
              />

              {/* Floating Social Badges */}
              <div className="absolute top-5 right-8 px-3 py-1 rounded-full bg-[#181134]/95 border border-[#00D6A0]/50 shadow-lg flex items-center gap-1.5 text-[10px] font-extrabold text-white">
                <span className="w-2 h-2 rounded-full bg-[#00D6A0] animate-ping" />
                <span>LIVE GPS</span>
              </div>
              <div className="absolute bottom-8 left-4 px-3 py-1 rounded-full bg-[#181134]/95 border border-[#8957FF]/50 shadow-lg flex items-center gap-1.5 text-[10px] font-extrabold text-[#E9DFFF]">
                <Lock className="w-3 h-3 text-[#8957FF]" />
                <span>PRIVATE CIRCLE</span>
              </div>
              <div className="absolute bottom-9 right-4 px-3 py-1 rounded-full bg-[#181134]/95 border border-[#FF4FA3]/50 shadow-lg flex items-center gap-1.5 text-[10px] font-extrabold text-[#FF4FA3]">
                <Siren className="w-3 h-3" />
                <span>5KM SOS</span>
              </div>

              {/* Center Glowing Social Core */}
              <div
                className={`relative w-24 h-24 rounded-[28px] bg-gradient-to-tr ${slide.gradient} p-[2px] shadow-2xl transition-all duration-300`}
                style={{
                  boxShadow: `0 12px 38px ${slide.accentColor}45`,
                }}
              >
                <div className="w-full h-full rounded-[26px] bg-[#130D2B] flex flex-col items-center justify-center">
                  <SlideIcon className="w-10 h-10 mb-1" style={{ color: slide.accentColor }} />
                  <span className="text-[9px] font-extrabold uppercase tracking-widest text-[#E9DFFF]/80">
                    STEP 0{activeSlide + 1}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Onboarding Content Card */}
          <div className="lg:col-span-7">
            <div
              className="rounded-3xl bg-[#161030]/90 backdrop-blur-2xl border border-[#8957FF]/35 p-6 sm:p-8 shadow-2xl space-y-6"
              style={{
                boxShadow: '0 24px 60px rgba(8, 4, 20, 0.75), 0 0 35px rgba(137, 87, 255, 0.18)',
              }}
            >
              {/* Slide Selector Pills */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span
                  className={`px-3 py-1 rounded-full text-[11px] font-extrabold tracking-wider uppercase bg-gradient-to-r ${slide.gradient} text-white shadow-sm`}
                >
                  {slide.badge}
                </span>

                <div className="flex items-center gap-2">
                  {SLIDES.map((s, idx) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setActiveSlide(idx)}
                      className={`h-2.5 rounded-full transition-all cursor-pointer ${
                        idx === activeSlide
                          ? 'w-8 bg-gradient-to-r from-[#8957FF] via-[#FF4FA3] to-[#FF8066]'
                          : 'w-2.5 bg-white/20 hover:bg-white/40'
                      }`}
                      aria-label={`View slide ${idx + 1}`}
                    />
                  ))}
                </div>
              </div>

              {/* Headline & Copy */}
              <div className="space-y-2.5">
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                  {slide.title}
                </h2>
                <p className="text-xs sm:text-sm text-[#E9DFFF]/80 leading-relaxed">
                  {slide.subtitle}
                </p>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-3 gap-2.5">
                {slide.metrics.map((m) => (
                  <div
                    key={m.label}
                    className="p-3 rounded-2xl bg-[#110B26]/90 border border-white/10"
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#E9DFFF]/65 block">
                      {m.label}
                    </span>
                    <span
                      className="text-xs sm:text-sm font-extrabold mt-0.5 block truncate"
                      style={{ color: m.accent }}
                    >
                      {m.value}
                    </span>
                  </div>
                ))}
              </div>

              {/* Key Capabilities List */}
              <div className="space-y-2 pt-1">
                {slide.features.map((feat) => (
                  <div
                    key={feat}
                    className="flex items-center gap-2.5 text-xs text-white/95 bg-[#110B26]/70 px-3.5 py-2.5 rounded-2xl border border-white/10"
                  >
                    <Sparkles className="w-4 h-4 shrink-0 text-[#FF4FA3]" />
                    <span className="font-medium">{feat}</span>
                  </div>
                ))}
              </div>

              {/* Onboarding Step Navigation & Primary CTAs */}
              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {SLIDES.map((s, idx) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setActiveSlide(idx)}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-extrabold transition-all cursor-pointer border ${
                        idx === activeSlide
                          ? 'bg-gradient-to-r from-[#8957FF] to-[#FF4FA3] border-transparent text-white shadow-sm'
                          : 'bg-[#110B26] border-white/10 text-[#E9DFFF]/70 hover:text-white'
                      }`}
                    >
                      0{idx + 1}
                    </button>
                  ))}
                  {activeSlide < SLIDES.length - 1 && (
                    <button
                      type="button"
                      onClick={() => setActiveSlide((prev) => (prev + 1) % SLIDES.length)}
                      className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-bold text-[#00D9FF] flex items-center gap-1 cursor-pointer"
                    >
                      <span>Next</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={onLogin}
                    className="flex-1 sm:flex-initial px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/20 text-xs font-extrabold text-white transition-all cursor-pointer active:scale-95"
                  >
                    Login
                  </button>
                  <button
                    type="button"
                    onClick={onGetStarted}
                    className="flex-1 sm:flex-initial px-6 py-3 rounded-2xl bg-gradient-to-r from-[#8957FF] via-[#FF4FA3] to-[#FF8066] hover:opacity-95 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#FF4FA3]/30 transition-all cursor-pointer active:scale-95"
                  >
                    <span>Get Started</span>
                    <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer Status Bar */}
      <footer className="relative z-10 w-full max-w-5xl mx-auto px-5 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-[#E9DFFF]/70 border-t border-white/10">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#00D6A0]" />
          <span>Unified Android APK & Web Cloud Synchronization Ready</span>
        </div>
        <span className="font-mono text-[10px] text-[#E9DFFF]/60">
          BEACON NETWORK · STAY CONNECTED. STAY TOGETHER.
        </span>
      </footer>
    </div>
  );
};
