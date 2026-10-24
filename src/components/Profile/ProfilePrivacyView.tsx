import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import type { LocationShareRequest, LocationVisibility, PhoneVisibility, ProfileVisibility } from '../../types.ts';
import { api } from '../../utils/api.ts';
import {
  User,
  Shield,
  Eye,
  Phone,
  Camera,
  Check,
  Clock,
  Lock,
  LogOut,
  MapPin,
  X,
  UserCheck,
  Bell,
  Smartphone,
  Download,
  Palette,
  Sun,
  Moon,
  Terminal,
  Copy,
  Cpu,
  Compass,
  Sparkles,
} from 'lucide-react';
import { notifications } from '../../utils/notifications.ts';
import { PWAInstallButton } from '../Navigation/PWAInstallButton.tsx';
import { useToast } from '../../context/ToastContext.tsx';
import { useTheme, GLASS_THEMES, GlassThemeId } from '../../context/ThemeContext.tsx';
import { MARKER_COLORS, MEMBER_ICONS, getMemberIconEmoji } from '../../utils/markerStyles.ts';

export const ProfilePrivacyView: React.FC = () => {
  const { user, updateProfile, updatePrivacy, logout } = useAuth();
  const { currentTheme, setTheme, themeConfig } = useTheme();
  const toast = useToast();

  const [fullName, setFullName] = useState(user?.fullName || '');
  const [about, setAbout] = useState(user?.about || '');
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');

  // Marker customization states
  const [markerColor, setMarkerColor] = useState<string>(user?.markerColor || '#0ea5e9');
  const [markerIcon, setMarkerIcon] = useState<string>(user?.markerIcon || 'person');
  const [markerLabel, setMarkerLabel] = useState<string>(user?.markerLabel || '');

  // Privacy states
  const [locVis, setLocVis] = useState<LocationVisibility>(user?.privacy?.locationVisibility || 'room_members');
  const [phoneVis, setPhoneVis] = useState<PhoneVisibility>(user?.privacy?.phoneVisibility || 'room_members');
  const [profileVis, setProfileVis] = useState<ProfileVisibility>(user?.privacy?.profileVisibility || 'public');
  const [showOnline, setShowOnline] = useState<boolean>(user?.privacy?.showOnlineStatus ?? true);

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [shareRequests, setShareRequests] = useState<LocationShareRequest[]>([]);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    notifications.getPermission()
  );

  const handleRequestNotifications = async () => {
    const granted = await notifications.requestPermission();
    setNotificationPermission(granted ? 'granted' : 'denied');
    if (granted) {
      notifications.send('Beacon Alerts Enabled', {
        body: 'You will receive critical emergency alerts and location notifications.',
      });
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load incoming location sharing requests
  const loadRequests = async () => {
    try {
      const res = await api.get<{ requests: LocationShareRequest[] }>('/api/locations/requests');
      setShareRequests(res.requests);
    } catch (err) {
      console.error('Failed to load location share requests:', err);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  // Avatar file upload to backend
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const dataUrl = reader.result as string;
        const res = await api.uploadFile(dataUrl, `avatar-${Date.now()}.png`, file.type);
        setAvatarUrl(res.url);
        toast.success('Avatar uploaded');
      } catch (err: any) {
        toast.error('Failed to upload avatar image');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      await updateProfile({
        fullName,
        about,
        phoneNumber,
        avatarUrl,
        markerColor,
        markerIcon,
        markerLabel,
      });

      await updatePrivacy({
        locationVisibility: locVis,
        phoneVisibility: phoneVis,
        profileVisibility: profileVis,
        showOnlineStatus: showOnline,
      });

      setSaveSuccess(true);
      toast.success('Preferences saved');
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update profile settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRespondRequest = async (requestId: string, response: 'accepted' | 'temporary' | 'denied') => {
    try {
      const res = await api.post<{ request: LocationShareRequest }>('/api/locations/respond', {
        requestId,
        response,
      });
      setShareRequests((prev) => prev.map((r) => (r.id === requestId ? res.request : r)));
      toast.success(`Location request ${response}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update request');
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 md:p-6 space-y-6 max-w-4xl mx-auto w-full relative z-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`font-bold ${themeConfig.textPrimary} text-xl tracking-tight`}>
            Account, Privacy & Glass Optics
          </h2>
          <p className={`text-xs ${themeConfig.textSecondary}`}>
            Control your themes, identity, phone visibility, and real-time location sharing permissions
          </p>
        </div>
        <button
          onClick={logout}
          className="px-3.5 py-1.5 text-xs font-semibold text-rose-500 hover:bg-rose-500/10 rounded-xl flex items-center gap-1.5 transition-colors border border-rose-500/20 cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          Log Out
        </button>
      </div>

      {/* Glass Themes & Appearance Selector Card */}
      <div className={`${themeConfig.glassPanel} rounded-3xl border ${themeConfig.glassBorder} p-6 shadow-xl`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5" style={{ color: themeConfig.accentHex }} />
            <h3 className={`font-bold ${themeConfig.textPrimary} text-base`}>
              Glass Themes & UI Optics
            </h3>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-white/80 border border-white/15">
            6 Glass Themes
          </span>
        </div>
        <p className={`text-xs ${themeConfig.textSecondary} mb-4`}>
          Select your preferred frosted glass aesthetic. All panels, maps, menus, and discord channels update instantly.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {(Object.keys(GLASS_THEMES) as GlassThemeId[]).map((themeId) => {
            const t = GLASS_THEMES[themeId];
            const isSelected = currentTheme === themeId;

            return (
              <button
                key={themeId}
                type="button"
                onClick={() => setTheme(themeId)}
                className={`p-3 rounded-2xl border text-left transition-all relative overflow-hidden cursor-pointer ${
                  isSelected
                    ? 'ring-2 ring-white/90 border-white/50 shadow-lg scale-[1.02]'
                    : 'border-white/10 hover:border-white/25 hover:bg-white/5'
                }`}
              >
                {/* Visual Swatch */}
                <div
                  className={`h-14 w-full rounded-xl bg-gradient-to-r ${t.previewGradient} p-2 flex items-end justify-between border border-white/20 mb-2 relative overflow-hidden shadow-inner`}
                >
                  <span className="text-[10px] font-bold text-white px-2 py-0.5 rounded bg-black/40 backdrop-blur-md">
                    {t.name}
                  </span>
                  <div
                    className="w-3.5 h-3.5 rounded-full border-2 border-white shadow"
                    style={{ backgroundColor: t.accentHex }}
                  />
                </div>

                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-bold text-white block truncate">{t.name}</span>
                  {isSelected && (
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-white text-slate-900">
                      Active
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-white/60 line-clamp-1 mt-0.5 block">{t.tagline}</span>
              </button>
            );
          })}
        </div>
      </div>

      <form onSubmit={handleSaveProfile} className="space-y-6">
        {/* Profile Card */}
        <div className={`${themeConfig.glassPanel} rounded-3xl border ${themeConfig.glassBorder} p-6 shadow-xl`}>
          <h3 className={`font-bold ${themeConfig.textPrimary} text-sm mb-4 flex items-center gap-2`}>
            <User className="w-4 h-4" style={{ color: themeConfig.accentHex }} />
            Public Identity
          </h3>

          <div className="flex flex-col sm:flex-row items-center gap-6 mb-6">
            <div className="relative group">
              <img
                src={avatarUrl || user?.avatarUrl}
                alt="Avatar"
                className="w-24 h-24 rounded-full object-cover border-4 border-slate-100 shadow-md group-hover:opacity-90 transition-opacity"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 p-2 bg-slate-900 hover:bg-slate-800 text-white rounded-full shadow-lg transition-transform active:scale-95"
                title="Upload Photo"
              >
                <Camera className="w-4 h-4" />
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleAvatarChange}
                accept="image/*"
                className="hidden"
              />
            </div>

            <div className="space-y-1 text-center sm:text-left">
              <h4 className="font-bold text-slate-900 text-base">{user?.fullName}</h4>
              <p className="text-xs text-slate-500 font-mono">@{user?.username} · {user?.email}</p>
              <p className="text-xs text-slate-400">
                Uploaded avatar is stored persistently on the backend server.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
              <input
                type="tel"
                placeholder="+1 (555) 000-0000"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">About / Status</label>
              <input
                type="text"
                value={about}
                onChange={(e) => setAbout(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>
        </div>

        {/* Live Map Marker Personalization Card */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Palette className="w-4 h-4 text-sky-600" />
                Map Marker & Family Role Styling
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Customize your live map marker color, role icon, and label to help family members identify you visually.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-sky-50 text-sky-700 text-[10px] font-bold font-mono border border-sky-100 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-sky-500" />
              Live Visuals
            </span>
          </div>

          {/* Interactive Live Marker Preview on Dark Simulated Map Canvas */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-6 relative overflow-hidden shadow-inner">
            {/* Ambient Background Grid */}
            <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px] opacity-25 pointer-events-none" />

            <div className="relative z-10 flex flex-col items-center">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold mb-3">
                Live Map Appearance
              </span>

              {/* Sample Beacon Simulation */}
              <div className="relative flex items-center justify-center w-20 h-20">
                {/* Glowing Beam */}
                <div
                  className="absolute -top-4 w-24 h-24 pointer-events-none opacity-60 transition-transform duration-300"
                  style={{
                    background: `radial-gradient(circle at 50% 100%, ${markerColor}66 0%, ${markerColor}11 50%, transparent 75%)`,
                    clipPath: 'polygon(50% 100%, 15% 0%, 85% 0%)',
                  }}
                />

                {/* Pulsing Halo */}
                <div
                  className="absolute inset-2 rounded-full animate-ping opacity-30"
                  style={{ backgroundColor: markerColor }}
                />

                {/* Avatar Core */}
                <div
                  className="relative w-12 h-12 rounded-full border-2 border-white shadow-2xl overflow-hidden bg-slate-900 transition-all duration-300 ring-4"
                  style={{ borderColor: '#ffffff', outlineColor: markerColor, boxShadow: `0 0 20px ${markerColor}80` }}
                >
                  <img
                    src={avatarUrl || user?.avatarUrl}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Role / Family Icon Badge Overlay */}
                <div
                  className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-slate-900 border-2 border-white flex items-center justify-center text-xs shadow-lg"
                  title="Role Badge"
                >
                  <span>{getMemberIconEmoji(markerIcon)}</span>
                </div>

                {/* Bottom Identity Pill */}
                <div
                  className="absolute -bottom-3 px-2.5 py-0.5 rounded-full text-[10px] font-bold text-white shadow-lg whitespace-nowrap border border-white/20 flex items-center gap-1"
                  style={{ backgroundColor: markerColor }}
                >
                  <span>{getMemberIconEmoji(markerIcon)}</span>
                  <span>{markerLabel.trim() || fullName.split(' ')[0] || 'You'}</span>
                </div>
              </div>
            </div>

            <div className="relative z-10 max-w-sm space-y-2 text-center sm:text-left">
              <h4 className="font-bold text-white text-sm">
                {markerLabel.trim() ? `${markerLabel} (${fullName})` : fullName}
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                When you share location in rooms, peers will see your directional beacon pulsing with{' '}
                <span className="font-bold" style={{ color: markerColor }}>
                  {MARKER_COLORS.find((c) => c.hex.toLowerCase() === markerColor.toLowerCase())?.label || 'Custom Color'}
                </span>{' '}
                and the <span className="font-bold">{getMemberIconEmoji(markerIcon)} {MEMBER_ICONS.find((i) => i.id === markerIcon)?.label || 'Member'}</span> badge.
              </p>
              <div className="pt-1 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <span className="px-2 py-0.5 rounded-md bg-white/10 text-[10px] font-mono text-slate-300">
                  Hex: {markerColor}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-white/10 text-[10px] font-mono text-slate-300">
                  Role: {markerIcon}
                </span>
              </div>
            </div>
          </div>

          {/* Color Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 font-mono">
              1. Marker Accent Color
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {MARKER_COLORS.map((c) => {
                const isSelected = markerColor.toLowerCase() === c.hex.toLowerCase();
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setMarkerColor(c.hex)}
                    className={`p-2.5 rounded-2xl border text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                      isSelected
                        ? 'border-slate-900 bg-slate-50 ring-2 ring-slate-900 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/50'
                    }`}
                  >
                    <div
                      className="w-5 h-5 rounded-full border border-white shadow-sm flex items-center justify-center shrink-0"
                      style={{ backgroundColor: c.hex }}
                    >
                      {isSelected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                    </div>
                    <span className="text-xs font-semibold text-slate-800 truncate">{c.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Member / Family Identity Icon */}
          <div>
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 font-mono">
              2. Family Member & Role Icon
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {MEMBER_ICONS.map((icon) => {
                const isSelected = markerIcon === icon.id;
                return (
                  <button
                    key={icon.id}
                    type="button"
                    onClick={() => setMarkerIcon(icon.id)}
                    className={`p-2.5 rounded-2xl border flex items-center gap-2 transition-all cursor-pointer ${
                      isSelected
                        ? 'border-slate-900 bg-slate-900 text-white shadow-md ring-2 ring-slate-900/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-base shrink-0">{icon.emoji}</span>
                    <span className="text-xs font-semibold truncate">{icon.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Nickname / Marker Display Tag */}
          <div>
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1 font-mono">
              3. Marker Display Label / Nickname
            </label>
            <p className="text-[11px] text-slate-500 mb-2">
              Optional short text shown on your map pin (e.g. "Dad", "Mom", "Sam (Kid)", "Van #1").
            </p>
            <input
              type="text"
              maxLength={20}
              placeholder={`e.g. ${fullName.split(' ')[0] || 'Dad'}`}
              value={markerLabel}
              onChange={(e) => setMarkerLabel(e.target.value)}
              className="w-full max-w-md px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>
        </div>

        {/* Strict Privacy Governance Card (Product Spec Section 6 & 33) */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-5">
          <div>
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-600" />
              Privacy & Location Visibility Governance
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Every privacy setting below is strictly enforced by the server; unauthorized queries never receive coordinates.
            </p>
          </div>

          <div className="space-y-4">
            {/* Location Sharing Visibility */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  <span className="font-bold text-slate-900 text-xs">Live GPS Location Visibility</span>
                </div>
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  Server Enforced
                </span>
              </div>
              <p className="text-xs text-slate-500 mb-3">
                Decide who is permitted to view your map marker and real-time distance calculations.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { id: 'room_members', label: 'Room Members', desc: 'People in shared rooms' },
                  { id: 'emergency_only', label: 'Emergency Only', desc: 'Distress alerts only' },
                  { id: 'nobody', label: 'Nobody (Private)', desc: 'Completely off the map' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setLocVis(opt.id as LocationVisibility)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      locVis === opt.id
                        ? 'border-slate-900 bg-white ring-2 ring-slate-900/10 shadow-sm'
                        : 'border-slate-200 bg-white hover:bg-slate-100 text-slate-600'
                    }`}
                  >
                    <span className="font-bold text-xs block text-slate-900">{opt.label}</span>
                    <span className="text-[11px] text-slate-500 mt-0.5 block">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Phone Number Visibility */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-purple-600" />
                  <span className="font-bold text-slate-900 text-xs">Phone Number Visibility</span>
                </div>
              </div>
              <p className="text-xs text-slate-500 mb-3">
                Controls whether room members or distress responders can see your direct contact number.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { id: 'room_members', label: 'Room Members', desc: 'Visible to members' },
                  { id: 'everyone', label: 'Everyone', desc: 'Visible to community' },
                  { id: 'nobody', label: 'Nobody', desc: 'Hidden from profiles' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setPhoneVis(opt.id as PhoneVisibility)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      phoneVis === opt.id
                        ? 'border-slate-900 bg-white ring-2 ring-slate-900/10 shadow-sm'
                        : 'border-slate-200 bg-white hover:bg-slate-100 text-slate-600'
                    }`}
                  >
                    <span className="font-bold text-xs block text-slate-900">{opt.label}</span>
                    <span className="text-[11px] text-slate-500 mt-0.5 block">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Online Status Toggle */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-900 text-xs block">Show Online / Active Status</span>
                <span className="text-xs text-slate-500">
                  Allow other room members to see green active indicator
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={showOnline}
                  onChange={(e) => setShowOnline(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-slate-900"></div>
              </label>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between">
            {saveSuccess && (
              <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                <Check className="w-4 h-4" /> Preferences saved successfully
              </span>
            )}
            <button
              type="submit"
              disabled={isSaving}
              className="ml-auto px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-95"
            >
              {isSaving ? 'Saving...' : 'Save All Preferences'}
            </button>
          </div>
        </div>
      </form>

      {/* Location Share Requests Inbox (Section 27) */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
        <h3 className="font-bold text-slate-900 text-sm mb-1 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-blue-600" />
          Location Sharing Requests ({shareRequests.filter((r) => r.status === 'pending').length} Pending)
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          People requesting direct access to your live location. You can approve permanently, grant temporary 1-hour access, or decline.
        </p>

        {shareRequests.length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-2xl">
            No pending location sharing requests.
          </div>
        ) : (
          <div className="space-y-3">
            {shareRequests.map((req) => (
              <div
                key={req.id}
                className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={req.fromUserAvatar}
                    alt={req.fromUserName}
                    className="w-10 h-10 rounded-full object-cover border border-slate-200"
                  />
                  <div>
                    <span className="font-bold text-slate-900 text-sm block">
                      {req.fromUserName}
                    </span>
                    <span className="text-xs text-slate-500">
                      Requested location · Status: <strong>{req.status}</strong>
                    </span>
                  </div>
                </div>

                {req.status === 'pending' ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRespondRequest(req.id, 'accepted')}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl"
                    >
                      Allow
                    </button>
                    <button
                      onClick={() => handleRespondRequest(req.id, 'temporary')}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl"
                    >
                      Allow 1 Hour
                    </button>
                    <button
                      onClick={() => handleRespondRequest(req.id, 'denied')}
                      className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-xl"
                    >
                      Deny
                    </button>
                  </div>
                ) : (
                  <span className="px-3 py-1 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold">
                    {req.status === 'temporary' ? 'Active for 1hr' : req.status}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Push & System Notifications Card */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-500" />
              Emergency & Community Push Notifications
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md">
              Receive high-priority notifications for emergency SOS broadcasts, group reminders near saved places, and direct messages.
            </p>
            <div className="mt-2 text-xs font-mono text-slate-400">
              Current browser status: <span className="font-bold text-slate-700 uppercase">{notificationPermission}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {notificationPermission !== 'granted' ? (
              <button
                type="button"
                onClick={handleRequestNotifications}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-sm transition-colors active:scale-95"
              >
                Enable Notifications
              </button>
            ) : (
              <button
                type="button"
                onClick={() =>
                  notifications.notifyEmergency(
                    user?.fullName || 'Self',
                    'Test Beacon notification delivery check'
                  )
                }
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors"
              >
                Send Test Alert
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Progressive Web App / Mobile Installation Card */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-3xl p-6 shadow-md border border-slate-700">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 bg-white/10 rounded-2xl shrink-0">
              <Smartphone className="w-6 h-6 text-sky-400" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                Install Beacon on Your Device
              </h3>
              <p className="text-xs text-slate-300 mt-1 max-w-md leading-relaxed">
                Install as a full Progressive Web App on Android, iOS, or Desktop for standalone mode, offline cache access, and rapid home-screen launch.
              </p>
            </div>
          </div>

          <div className="shrink-0">
            <PWAInstallButton />
          </div>
        </div>
      </div>

      {/* Android Native APK Package & Compilation Card */}
      <div className={`${themeConfig.glassPanel} rounded-3xl p-6 border ${themeConfig.glassBorder} shadow-xl backdrop-blur-2xl space-y-4`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-2xl ${themeConfig.accentBg} text-white shadow-md`}>
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className={`font-bold text-sm ${themeConfig.textPrimary}`}>
                  Native Android APK Packaging
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black tracking-wide bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  CAPACITOR CONFIGURED
                </span>
              </div>
              <p className={`text-xs ${themeConfig.textSecondary} mt-0.5`}>
                Package ID: <span className="font-mono text-cyan-400">com.beacon.mesh</span> · App Name: <span className="font-bold">Beacon</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] font-mono text-emerald-400 bg-emerald-950/40 px-3 py-1.5 rounded-xl border border-emerald-500/30">
            <Shield className="w-3.5 h-3.5" />
            <span>Server Proxy Secured</span>
          </div>
        </div>

        <p className={`text-xs ${themeConfig.textSecondary} leading-relaxed`}>
          The standalone native Android project has been scaffolded under <code className="px-1.5 py-0.5 rounded bg-black/40 font-mono text-cyan-300">/android</code> with full permissions for GPS coordinates, microphone audio notes, and WebSocket mesh networking.
        </p>

        {/* Direct APK Download Button */}
        <a
          href="https://github.com/Harikrishna8118/Track-Your-Friends-/releases/latest/download/app-debug.apk"
          download
          className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-98 text-white font-bold text-xs flex items-center justify-center gap-2.5 shadow-lg shadow-emerald-900/30 transition-all cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>Download Latest Android APK (app-debug.apk)</span>
        </a>

        {/* Compile Pipeline Steps */}
        <div className="space-y-2 pt-1">
          <div className={`p-3 rounded-2xl ${themeConfig.glassCard} border ${themeConfig.glassBorder} flex items-center justify-between gap-3`}>
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] font-black flex items-center justify-center shrink-0">1</span>
              <div className="truncate">
                <p className={`text-xs font-semibold ${themeConfig.textPrimary}`}>Sync Web Assets to Native Android</p>
                <code className="text-[11px] text-cyan-300 font-mono truncate block">npm run cap:sync</code>
              </div>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText('npm run cap:sync');
                toast.success('Command copied: npm run cap:sync');
              }}
              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
              title="Copy Command"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className={`p-3 rounded-2xl ${themeConfig.glassCard} border ${themeConfig.glassBorder} flex items-center justify-between gap-3`}>
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] font-black flex items-center justify-center shrink-0">2</span>
              <div className="truncate">
                <p className={`text-xs font-semibold ${themeConfig.textPrimary}`}>Assemble Standalone Debug APK</p>
                <code className="text-[11px] text-cyan-300 font-mono truncate block">cd android && ./gradlew assembleDebug</code>
              </div>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText('cd android && ./gradlew assembleDebug');
                toast.success('Command copied: cd android && ./gradlew assembleDebug');
              }}
              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
              title="Copy Command"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className={`p-3 rounded-2xl ${themeConfig.glassCard} border ${themeConfig.glassBorder} flex items-center justify-between gap-3`}>
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] font-black flex items-center justify-center shrink-0">3</span>
              <div className="truncate">
                <p className={`text-xs font-semibold ${themeConfig.textPrimary}`}>Install on Physical Android Device via ADB</p>
                <code className="text-[11px] text-cyan-300 font-mono truncate block">adb install -r android/app/build/outputs/apk/debug/app-debug.apk</code>
              </div>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText('adb install -r android/app/build/outputs/apk/debug/app-debug.apk');
                toast.success('Command copied ADB install string');
              }}
              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
              title="Copy Command"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Output Location & Security Footnote */}
        <div className="mt-3 pt-3 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px]">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Terminal className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>Output Path:</span>
            <code className="text-cyan-300 font-mono truncate">android/app/build/outputs/apk/debug/app-debug.apk</code>
          </div>
          <span className="text-emerald-400 font-medium">✓ Zero plaintext keys in client APK</span>
        </div>
      </div>
    </div>
  );
};
