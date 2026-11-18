import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useTheme } from '../../context/ThemeContext.tsx';
import { useRealtime } from '../../context/RealtimeContext.tsx';
import { api } from '../../utils/api.ts';
import type { UserPrivacySettings, UserProfile, Room, LocationShareRequest } from '../../types.ts';
import { useToast } from '../../context/ToastContext.tsx';
import {
  Shield,
  Eye,
  Phone,
  User,
  Radio,
  Check,
  Save,
  Palette,
  Sparkles,
  Camera,
  LogOut,
  Trash2,
  UserX,
  AlertTriangle,
  Smartphone,
  Copy,
  Users,
  Layers,
  MapPin,
  Heart,
  Sun,
  Moon,
  BatteryCharging,
  Zap,
  Gauge,
} from 'lucide-react';
import { AppErrorsTrackerPanel } from '../Diagnostics/AppErrorsTrackerModal.tsx';

export const ProfilePrivacyView: React.FC = () => {
  const { user, updatePrivacy, updateProfile, logout } = useAuth();
  const {
    currentTheme,
    setTheme,
    allThemes,
    themeConfig,
    toggleDarkLight,
    isLowPowerMode,
    setLowPowerMode,
  } = useTheme();
  const { onlineUserIds, userLocations } = useRealtime();
  const toast = useToast();
  const avatarFileInputRef = useRef<HTMLInputElement>(null);
  const isLight = !themeConfig.isDark;

  const [locationVis, setLocationVis] = useState<UserPrivacySettings['locationVisibility']>(
    user?.privacy.locationVisibility || 'room_members'
  );
  const [phoneVis, setPhoneVis] = useState<UserPrivacySettings['phoneVisibility']>(
    user?.privacy.phoneVisibility || 'room_members'
  );
  const [profileVis, setProfileVis] = useState<UserPrivacySettings['profileVisibility']>(
    user?.privacy.profileVisibility || 'public'
  );
  const [showOnline, setShowOnline] = useState<boolean>(
    user?.privacy.showOnlineStatus ?? true
  );
  const [sharingEnabled, setSharingEnabled] = useState<boolean>(
    user?.privacy.locationSharingEnabled ?? true
  );

  // Profile fields
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
  const [about, setAbout] = useState(user?.about || '');

  // Social stats
  const [roomsCount, setRoomsCount] = useState<number>(1);
  const [friendsCount, setFriendsCount] = useState<number>(0);

  // Blocked users & danger zone state
  const [blockedUsers, setBlockedUsers] = useState<UserProfile[]>([]);
  const [isPurgingHistory, setIsPurgingHistory] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  useEffect(() => {
    if (!user || !api.getToken()) return;
    api
      .getBlockedUsers()
      .then((res) => setBlockedUsers(res.blockedUsers || []))
      .catch(() => {});

    api
      .get<{ rooms: Room[] }>('/api/rooms')
      .then((res) => {
        if (Array.isArray(res.rooms)) setRoomsCount(res.rooms.length);
      })
      .catch(() => {});

    api
      .get<{ requests: LocationShareRequest[] }>('/api/locations/requests')
      .then((res) => {
        if (Array.isArray(res.requests)) {
          const accepted = res.requests.filter(
            (r) => r.status === 'accepted' || r.status === 'temporary'
          );
          setFriendsCount(accepted.length);
        }
      })
      .catch(() => {});
  }, [user?.id]);

  const handleUnblockUser = async (targetUserId: string, name: string) => {
    try {
      await api.unblockUser(targetUserId);
      setBlockedUsers((prev) => prev.filter((u) => u.id !== targetUserId));
      toast.success(`Unblocked ${name}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to unblock user');
    }
  };

  const handlePurgeLocationHistory = async () => {
    setIsPurgingHistory(true);
    try {
      const res = await api.purgeLocationHistory();
      toast.success(
        `Deleted ${res.deletedCount || 0} location history breadcrumbs from server`
      );
    } catch (err: any) {
      toast.error(err.message || 'Failed to purge location history');
    } finally {
      setIsPurgingHistory(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText.trim().toUpperCase() !== 'DELETE') {
      toast.error('Please type DELETE to confirm account deletion');
      return;
    }
    setIsDeletingAccount(true);
    try {
      await api.deleteAccount();
      toast.success('Your account and all location history have been permanently deleted');
      await logout();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete account');
      setIsDeletingAccount(false);
    }
  };

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file (PNG, JPG, WEBP)');
      return;
    }

    setIsUploadingAvatar(true);
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 256;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setAvatarUrl(compressedDataUrl);
          toast.success('Profile photo updated! Click "Save Profile & Privacy" to sync.');
        }
        setIsUploadingAvatar(false);
      };
      img.onerror = () => {
        toast.error('Could not load selected image');
        setIsUploadingAvatar(false);
      };
      img.src = reader.result as string;
    };
    reader.onerror = () => {
      toast.error('Failed to read image file');
      setIsUploadingAvatar(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSavedMsg(null);
    try {
      await updateProfile({
        fullName,
        phoneNumber,
        avatarUrl,
        about,
      });

      await updatePrivacy({
        locationVisibility: locationVis,
        phoneVisibility: phoneVis,
        profileVisibility: profileVis,
        showOnlineStatus: showOnline,
        locationSharingEnabled: sharingEnabled,
      });

      setSavedMsg('Profile & privacy settings saved.');
      toast.success('Profile & privacy settings updated!');
      setTimeout(() => setSavedMsg(null), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const totalConnectedFriends = Math.max(
    friendsCount,
    userLocations.filter((l) => l.userId !== user?.id).length
  );

  return (
    <div
      className={`flex flex-col h-full overflow-y-auto p-4 md:p-6 pb-28 max-w-4xl mx-auto w-full space-y-6 ${themeConfig.textPrimary}`}
    >
      {/* 1. VIBRANT SOCIAL PROFILE HEADER CARD */}
      <div
        className={`rounded-3xl border overflow-hidden shadow-2xl ${
          isLight
            ? 'bg-white border-[#8957FF]/20'
            : 'bg-[#130F2B]/90 border-[#8957FF]/30 backdrop-blur-xl'
        }`}
      >
        {/* Gradient Profile Cover */}
        <div className="h-32 sm:h-40 bg-gradient-to-r from-[#8957FF] via-[#FF4FA3] to-[#00D9FF] relative">
          <div className="absolute inset-0 bg-black/15" />
          <div className="absolute top-3.5 right-4 flex items-center gap-2 flex-wrap justify-end">
            <button
              type="button"
              onClick={() => {
                const next = !isLowPowerMode;
                setLowPowerMode(next);
                toast.success(
                  next
                    ? 'Low Power Mode enabled — GPS & map refresh rates reduced for battery longevity'
                    : 'Standard Performance Mode restored — High-frequency GPS & 60 FPS map active'
                );
              }}
              className={`px-3 py-1.5 rounded-full backdrop-blur-md text-xs font-extrabold flex items-center gap-1.5 border cursor-pointer transition-all ${
                isLowPowerMode
                  ? 'bg-[#00D6A0]/90 text-slate-950 border-white/40 shadow-lg'
                  : 'bg-black/35 hover:bg-black/50 text-white border-white/25'
              }`}
              title="Toggle Low Power Mode (Battery Saver)"
            >
              <BatteryCharging className="w-3.5 h-3.5" />
              <span>{isLowPowerMode ? 'Low Power: ON' : 'Low Power Mode'}</span>
            </button>

            <button
              type="button"
              onClick={toggleDarkLight}
              className="px-3 py-1.5 rounded-full bg-black/35 hover:bg-black/50 backdrop-blur-md text-white text-xs font-extrabold flex items-center gap-1.5 border border-white/25 cursor-pointer"
            >
              {themeConfig.isDark ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-[#FFD166]" />
                  <span>Light Mode</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-[#00D9FF]" />
                  <span>Dark Mode</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={async () => {
                await logout();
                toast.info('Signed out of Beacon Network');
              }}
              className="px-3.5 py-1.5 rounded-full bg-[#FF3B6B] hover:bg-[#e11d48] text-white text-xs font-extrabold flex items-center gap-1.5 border border-white/30 shadow-lg cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* Profile Identity & Social Stats */}
        <div className="px-5 sm:px-7 pb-6 -mt-14 relative space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="flex items-end gap-4">
              <div
                onClick={() => avatarFileInputRef.current?.click()}
                className="relative group cursor-pointer shrink-0"
                title="Tap to upload a new profile picture"
              >
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full social-story-ring shadow-2xl">
                  <img
                    src={avatarUrl || user?.avatarUrl}
                    alt={user?.fullName}
                    className="w-full h-full rounded-full object-cover border-4 border-[#130F2B]"
                  />
                </div>
                <span className="absolute bottom-1 right-1 w-7 h-7 rounded-full bg-gradient-to-r from-[#8957FF] to-[#FF4FA3] text-white flex items-center justify-center border-2 border-[#130F2B] shadow-md">
                  <Camera className="w-3.5 h-3.5" />
                </span>
              </div>

              <div className="pb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                    {fullName || user?.fullName}
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#00D6A0]/15 text-[#00D6A0] border border-[#00D6A0]/30 text-[10px] font-extrabold uppercase tracking-wider">
                    {sharingEnabled ? 'Live GPS Active' : 'GPS Paused'}
                  </span>
                </div>
                <p className={`text-xs font-semibold ${themeConfig.textSecondary} mt-0.5`}>
                  @{user?.username} · {about || 'Exploring & staying connected on Beacon Network'}
                </p>
              </div>
            </div>

            {/* Handle / ID Copy Pill */}
            <div className="flex items-center gap-2 self-start sm:self-end flex-wrap">
              <button
                type="button"
                onClick={async () => {
                  const nameId = user?.fullName || user?.username || user?.id;
                  if (!nameId) return;
                  try {
                    await navigator.clipboard.writeText(nameId);
                    toast.success(`Copied Beacon ID: ${nameId}`);
                  } catch {
                    toast.info(`Beacon ID: ${nameId}`);
                  }
                }}
                className={`px-3.5 py-2 rounded-2xl border text-xs font-mono font-extrabold flex items-center gap-2 cursor-pointer transition-all ${
                  isLight
                    ? 'bg-[#F5F3FF] border-[#8957FF]/25 text-[#161032] hover:bg-[#8957FF]/10'
                    : 'bg-[#1B153A] border-[#8957FF]/35 text-white hover:border-[#00D9FF]/60'
                }`}
              >
                <span className="text-[#FF4FA3]">@{user?.username || user?.id}</span>
                <Copy className="w-3.5 h-3.5 text-[#00D9FF]" />
              </button>
            </div>
          </div>

          {/* 4 Social Activity Counters */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            <div
              className={`p-3.5 rounded-2xl border ${
                isLight ? 'bg-[#F5F3FF] border-[#8957FF]/15' : 'bg-[#1B153A]/75 border-[#8957FF]/25'
              }`}
            >
              <div className="flex items-center gap-1.5 text-[#00D6A0] mb-1">
                <Users className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-wider">Friends</span>
              </div>
              <span className="text-lg font-black block">{totalConnectedFriends}</span>
              <span className={`text-[11px] ${themeConfig.textMuted}`}>
                {onlineUserIds.length} online now
              </span>
            </div>

            <div
              className={`p-3.5 rounded-2xl border ${
                isLight ? 'bg-[#F5F3FF] border-[#8957FF]/15' : 'bg-[#1B153A]/75 border-[#8957FF]/25'
              }`}
            >
              <div className="flex items-center gap-1.5 text-[#8957FF] mb-1">
                <Layers className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-wider">Active Rooms</span>
              </div>
              <span className="text-lg font-black block">{roomsCount}</span>
              <span className={`text-[11px] ${themeConfig.textMuted}`}>Joined groups</span>
            </div>

            <div
              className={`p-3.5 rounded-2xl border ${
                isLight ? 'bg-[#F5F3FF] border-[#8957FF]/15' : 'bg-[#1B153A]/75 border-[#8957FF]/25'
              }`}
            >
              <div className="flex items-center gap-1.5 text-[#00D9FF] mb-1">
                <MapPin className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-wider">
                  Location Status
                </span>
              </div>
              <span className="text-lg font-black block">
                {sharingEnabled ? 'Live' : 'Hidden'}
              </span>
              <span className={`text-[11px] ${themeConfig.textMuted}`}>
                {locationVis.replace('_', ' ')}
              </span>
            </div>

            <div
              className={`p-3.5 rounded-2xl border ${
                isLight ? 'bg-[#F5F3FF] border-[#8957FF]/15' : 'bg-[#1B153A]/75 border-[#8957FF]/25'
              }`}
            >
              <div className="flex items-center gap-1.5 text-[#FF4FA3] mb-1">
                <Heart className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-wider">
                  Personal Status
                </span>
              </div>
              <span className="text-xs font-extrabold truncate block">
                {about || 'Connected & Exploring'}
              </span>
              <span className={`text-[11px] ${themeConfig.textMuted}`}>Public bio</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. COLOURFUL SOCIAL THEME SELECTOR */}
      <div
        className={`p-5 rounded-3xl border shadow-xl space-y-4 ${
          isLight ? 'bg-white border-[#8957FF]/15' : 'bg-[#130F2B]/85 border-[#8957FF]/25'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-[#8957FF] to-[#FF4FA3] text-white flex items-center justify-center shadow-md">
              <Palette className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm flex items-center gap-1.5">
                <span>Beacon Network Themes</span>
                <Sparkles className="w-3.5 h-3.5 text-[#FFD166]" />
              </h3>
              <p className={`text-xs ${themeConfig.textSecondary}`}>
                Switch between vibrant dark social themes or crisp daylight mode
              </p>
            </div>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-gradient-to-r from-[#8957FF] to-[#FF4FA3] text-white">
            {themeConfig.name}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {allThemes.map((t) => {
            const isSelected = currentTheme === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setTheme(t.id);
                  toast.success(`Theme switched to ${t.name}`);
                }}
                className={`p-3.5 rounded-2xl border text-left transition-all flex items-start gap-3 cursor-pointer ${
                  isSelected
                    ? isLight
                      ? 'bg-[#8957FF]/10 border-[#8957FF] ring-2 ring-[#8957FF]/30 shadow-md'
                      : 'bg-[#1B153A] border-[#FF4FA3] ring-2 ring-[#FF4FA3]/30 shadow-lg'
                    : isLight
                      ? 'bg-[#F5F3FF]/60 border-[#8957FF]/15 hover:bg-[#F5F3FF]'
                      : 'bg-[#1B153A]/50 border-white/10 hover:bg-[#1B153A]'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-xl shrink-0 ${t.previewGradient} shadow-md flex items-center justify-center border border-white/30`}
                >
                  {isSelected && <Check className="w-5 h-5 text-white drop-shadow" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-xs truncate">{t.name}</span>
                  </div>
                  <span className="text-[10px] font-semibold text-[#FF4FA3] block truncate">
                    {t.tagline}
                  </span>
                  <p className={`text-[11px] ${themeConfig.textMuted} line-clamp-2 mt-1 leading-snug`}>
                    {t.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2B. LOW POWER MODE & BATTERY LONGEVITY SETTINGS CARD */}
      <div
        data-testid="low-power-mode-settings-card"
        className={`p-5 sm:p-6 rounded-3xl border shadow-xl space-y-4 transition-all ${
          isLowPowerMode
            ? isLight
              ? 'bg-emerald-50/90 border-emerald-500/40 ring-1 ring-emerald-500/25'
              : 'bg-gradient-to-br from-[#0B241E]/95 via-[#130F2B]/90 to-[#111C2D]/95 border-[#00D6A0]/45 ring-1 ring-[#00D6A0]/25'
            : isLight
              ? 'bg-white border-[#8957FF]/15'
              : 'bg-[#130F2B]/85 border-[#8957FF]/25'
        }`}
      >
        <div className="flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row">
          <div className="flex items-start sm:items-center gap-3.5">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-md ${
                isLowPowerMode
                  ? 'bg-gradient-to-br from-[#00D6A0] to-[#00D9FF] text-slate-950'
                  : 'bg-gradient-to-br from-[#8957FF] to-[#397BFF] text-white'
              }`}
            >
              <BatteryCharging className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-extrabold text-sm sm:text-base">
                  Low Power Mode (Battery & Performance Saver)
                </h3>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                    isLowPowerMode
                      ? 'bg-[#00D6A0]/20 text-[#00D6A0] border-[#00D6A0]/40'
                      : 'bg-[#8957FF]/15 text-[#8957FF] border-[#8957FF]/30'
                  }`}
                >
                  {isLowPowerMode ? 'Battery Saver Active' : 'Standard High-Precision'}
                </span>
              </div>
              <p className={`text-xs ${themeConfig.textSecondary} mt-0.5`}>
                Reduces GPS location update frequency and lowers the live map refresh rate for cooler device performance and extended battery life.
              </p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer self-end sm:self-center shrink-0">
            <input
              type="checkbox"
              data-testid="low-power-mode-toggle"
              checked={isLowPowerMode}
              onChange={(e) => {
                const enabled = e.target.checked;
                setLowPowerMode(enabled);
                toast.success(
                  enabled
                    ? 'Low Power Mode enabled — GPS updates every 20s & Map refresh lowered to 0.2 Hz'
                    : 'Low Power Mode disabled — Real-time 6s GPS & 60 FPS map animations restored'
                );
              }}
              className="sr-only peer"
            />
            <div className="w-13 h-7 bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-6 peer-checked:after:border-white after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5.5 after:w-5.5 after:transition-all peer-checked:bg-[#00D6A0]" />
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div
            className={`p-3.5 rounded-2xl border ${
              isLight ? 'bg-[#F5F3FF]/80 border-[#8957FF]/15' : 'bg-[#1B153A]/65 border-white/10'
            }`}
          >
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#00D6A0]">
              <Radio className="w-3.5 h-3.5" />
              <span>GPS Update Frequency</span>
            </div>
            <p className="text-xs font-black mt-1">
              {isLowPowerMode
                ? 'Every 20s or ≥ 12m move'
                : 'Every 6s or ≥ 2.2m move'}
            </p>
            <p className={`text-[11px] ${themeConfig.textMuted} mt-0.5`}>
              {isLowPowerMode
                ? 'Eco geolocation watch (allows 20s cached fix & 15s hardware throttle)'
                : 'Continuous high-accuracy GPS lock (0s cache age)'}
            </p>
          </div>

          <div
            className={`p-3.5 rounded-2xl border ${
              isLight ? 'bg-[#F5F3FF]/80 border-[#8957FF]/15' : 'bg-[#1B153A]/65 border-white/10'
            }`}
          >
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#00D9FF]">
              <Gauge className="w-3.5 h-3.5" />
              <span>Map Refresh Rate</span>
            </div>
            <p className="text-xs font-black mt-1">
              {isLowPowerMode
                ? '0.2 Hz (Every 5s Batch)'
                : '60 FPS Smooth Interpolation'}
            </p>
            <p className={`text-[11px] ${themeConfig.textMuted} mt-0.5`}>
              {isLowPowerMode
                ? 'Snaps markers directly, pauses zoom animations & throttles compass to 1.5s'
                : 'Fluid marker glides, animated flyTo transitions & 220ms compass'}
            </p>
          </div>

          <div
            className={`p-3.5 rounded-2xl border ${
              isLight ? 'bg-[#F5F3FF]/80 border-[#8957FF]/15' : 'bg-[#1B153A]/65 border-white/10'
            }`}
          >
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#FF4FA3]">
              <Zap className="w-3.5 h-3.5" />
              <span>Background & CPU Load</span>
            </div>
            <p className="text-xs font-black mt-1">
              {isLowPowerMode
                ? '12s Sync · Minimal RAM'
                : '4s Sync · Instant Preload'}
            </p>
            <p className={`text-[11px] ${themeConfig.textMuted} mt-0.5`}>
              {isLowPowerMode
                ? 'Coalesces cloud updates (1.5s) and skips background tab pre-warming'
                : '150ms real-time cloud coalescing and idle tab chunk preloading'}
            </p>
          </div>
        </div>
      </div>

      {/* 3. EDIT PROFILE & PRIVACY SETTINGS FORM */}
      <form onSubmit={handleSaveAll} className="space-y-6">
        <div
          className={`p-6 rounded-3xl border shadow-xl space-y-4 ${
            isLight ? 'bg-white border-[#8957FF]/15' : 'bg-[#130F2B]/85 border-[#8957FF]/25'
          }`}
        >
          <h3 className="font-extrabold text-sm flex items-center gap-2">
            <User className="w-4 h-4 text-[#FF4FA3]" />
            <span>Edit Personal Profile</span>
          </h3>

          <input
            ref={avatarFileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarFileChange}
            className="hidden"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={`block text-xs font-bold ${themeConfig.textSecondary} mb-1`}>
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className={`w-full px-3.5 py-2.5 rounded-2xl border text-sm ${themeConfig.glassInput} focus:outline-none focus:ring-2 focus:ring-[#8957FF]`}
              />
            </div>

            <div>
              <label className={`block text-xs font-bold ${themeConfig.textSecondary} mb-1`}>
                Phone Number (For Direct Call & SOS)
              </label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+1 (555) 234-5678"
                className={`w-full px-3.5 py-2.5 rounded-2xl border text-sm ${themeConfig.glassInput} focus:outline-none focus:ring-2 focus:ring-[#8957FF]`}
              />
            </div>

            <div className="md:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className={`block text-xs font-bold ${themeConfig.textSecondary}`}>
                  Profile Photo (Upload from Gallery or Paste URL)
                </label>
                <button
                  type="button"
                  onClick={() => avatarFileInputRef.current?.click()}
                  className="text-xs font-bold text-[#FF4FA3] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>{isUploadingAvatar ? 'Processing...' : 'Choose Photo'}</span>
                </button>
              </div>
              <input
                type="url"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://..."
                className={`w-full px-3.5 py-2.5 rounded-2xl border text-sm ${themeConfig.glassInput} focus:outline-none focus:ring-2 focus:ring-[#8957FF]`}
              />
            </div>

            <div className="md:col-span-2">
              <label className={`block text-xs font-bold ${themeConfig.textSecondary} mb-1`}>
                Personal Status / Bio
              </label>
              <input
                type="text"
                value={about}
                onChange={(e) => setAbout(e.target.value)}
                placeholder="Heading to Downtown Coffee · Available on voice lounge"
                className={`w-full px-3.5 py-2.5 rounded-2xl border text-sm ${themeConfig.glassInput} focus:outline-none focus:ring-2 focus:ring-[#8957FF]`}
              />
            </div>
          </div>
        </div>

        {/* Privacy Controls */}
        <div
          className={`p-6 rounded-3xl border shadow-xl space-y-5 ${
            isLight ? 'bg-white border-[#8957FF]/15' : 'bg-[#130F2B]/85 border-[#8957FF]/25'
          }`}
        >
          <div className="flex items-center justify-between pb-3 border-b border-[#8957FF]/15">
            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 rounded-2xl ${
                  sharingEnabled
                    ? 'bg-[#00D6A0]/15 text-[#00D6A0]'
                    : 'bg-white/10 text-slate-400'
                }`}
              >
                <Radio className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm">Master Live Location Sharing</h3>
                <p className={`text-xs ${themeConfig.textSecondary}`}>
                  Instantly enable or pause broadcasting your real-time GPS coordinates
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={sharingEnabled}
                onChange={(e) => setSharingEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-12 h-6 bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00D6A0]"></div>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-extrabold mb-1.5 flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-[#00D9FF]" />
                Who can see my live location?
              </label>
              <select
                value={locationVis}
                onChange={(e) => setLocationVis(e.target.value as any)}
                className={`w-full px-3.5 py-2.5 rounded-2xl border text-xs font-semibold ${themeConfig.glassInput} focus:outline-none focus:ring-2 focus:ring-[#8957FF]`}
              >
                <option value="room_members" className="bg-[#130F2B] text-white">
                  Room Members Only (Default)
                </option>
                <option value="selected" className="bg-[#130F2B] text-white">
                  Approved Friends Only
                </option>
                <option value="emergency_only" className="bg-[#130F2B] text-white">
                  Emergency SOS Broadcasts Only
                </option>
                <option value="nobody" className="bg-[#130F2B] text-white">
                  Nobody (Ghost Mode)
                </option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-extrabold mb-1.5 flex items-center gap-1.5">
                <Phone className="w-4 h-4 text-[#00D6A0]" />
                Who can see my phone number?
              </label>
              <select
                value={phoneVis}
                onChange={(e) => setPhoneVis(e.target.value as any)}
                className={`w-full px-3.5 py-2.5 rounded-2xl border text-xs font-semibold ${themeConfig.glassInput} focus:outline-none focus:ring-2 focus:ring-[#8957FF]`}
              >
                <option value="everyone" className="bg-[#130F2B] text-white">
                  Everyone
                </option>
                <option value="room_members" className="bg-[#130F2B] text-white">
                  Room Members Only
                </option>
                <option value="nobody" className="bg-[#130F2B] text-white">
                  Nobody (Private)
                </option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-extrabold mb-1.5 flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-[#8957FF]" />
                Profile Visibility
              </label>
              <select
                value={profileVis}
                onChange={(e) => setProfileVis(e.target.value as any)}
                className={`w-full px-3.5 py-2.5 rounded-2xl border text-xs font-semibold ${themeConfig.glassInput} focus:outline-none focus:ring-2 focus:ring-[#8957FF]`}
              >
                <option value="public" className="bg-[#130F2B] text-white">
                  Public Directory
                </option>
                <option value="room_members" className="bg-[#130F2B] text-white">
                  Room Members Only
                </option>
                <option value="private" className="bg-[#130F2B] text-white">
                  Private
                </option>
              </select>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div>
                <h4 className="font-bold text-xs">Show Online Status</h4>
                <p className={`text-[11px] ${themeConfig.textSecondary}`}>
                  Let friends see when you are active
                </p>
              </div>
              <input
                type="checkbox"
                checked={showOnline}
                onChange={(e) => setShowOnline(e.target.checked)}
                className="w-4 h-4 accent-[#8957FF] rounded cursor-pointer"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          {savedMsg ? (
            <div className="flex items-center gap-1.5 text-[#00D6A0] text-xs font-bold">
              <Check className="w-4 h-4" />
              <span>{savedMsg}</span>
            </div>
          ) : (
            <div />
          )}

          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-3 bg-gradient-to-r from-[#8957FF] via-[#FF4FA3] to-[#FF8066] hover:opacity-95 text-white rounded-2xl text-xs font-extrabold flex items-center gap-2 shadow-xl transition-all cursor-pointer active:scale-95"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Saving...' : 'Save Profile & Privacy'}</span>
          </button>
        </div>
      </form>

      {/* 4. NATIVE ANDROID APK & CAPACITOR MOBILE BUILD CARD */}
      <div
        className={`p-6 rounded-3xl border shadow-xl space-y-3 ${
          isLight ? 'bg-white border-[#8957FF]/15' : 'bg-[#130F2B]/85 border-[#8957FF]/25'
        }`}
      >
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#00D6A0] to-[#00D9FF] text-slate-950 flex items-center justify-center shadow-md">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm">Android Mobile APK & PWA Support</h3>
              <p className={`text-xs ${themeConfig.textSecondary}`}>
                Install Beacon Network on your phone home screen or build the native Capacitor APK (`com.beacon.network`)
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full bg-[#00D6A0]/15 text-[#00D6A0] border border-[#00D6A0]/30 text-[10px] font-extrabold">
            Capacitor Ready
          </span>
        </div>
      </div>

      {/* 4B. APP ERRORS TRACKING CONSOLE (KitsunePie/AppErrorsTracking) */}
      <AppErrorsTrackerPanel isDark={themeConfig.isDark} />

      {/* 5. BLOCKED USERS, LOCATION HISTORY PURGE & ACCOUNT DELETION */}
      <div
        className={`p-6 rounded-3xl border shadow-xl space-y-5 ${
          isLight ? 'bg-white border-[#8957FF]/15' : 'bg-[#130F2B]/85 border-[#8957FF]/25'
        }`}
      >
        <div>
          <h3 className="font-extrabold text-sm flex items-center gap-2">
            <UserX className="w-4 h-4 text-[#FF8066]" />
            <span>Blocked Users ({blockedUsers.length})</span>
          </h3>
          {blockedUsers.length === 0 ? (
            <p className={`text-xs ${themeConfig.textMuted} mt-1`}>
              You have not blocked any users.
            </p>
          ) : (
            <div className="space-y-2 mt-3">
              {blockedUsers.map((bu) => (
                <div
                  key={bu.id}
                  className="flex items-center justify-between p-3 rounded-2xl border border-[#8957FF]/20 bg-[#1B153A]/50"
                >
                  <div className="flex items-center gap-2.5">
                    <img
                      src={bu.avatarUrl}
                      alt={bu.fullName}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                    <div>
                      <span className="text-xs font-bold block">{bu.fullName}</span>
                      <span className="text-[10px] text-[#A6A1C8]">@{bu.username}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleUnblockUser(bu.id, bu.fullName)}
                    className="px-3 py-1 bg-[#8957FF]/20 hover:bg-[#8957FF]/30 text-white rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Unblock
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-[#8957FF]/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="font-bold text-xs">Purge Ephemeral Location History</h4>
            <p className={`text-[11px] ${themeConfig.textSecondary}`}>
              Delete all recorded 24-hour breadcrumb trail coordinates from the server
            </p>
          </div>
          <button
            type="button"
            onClick={handlePurgeLocationHistory}
            disabled={isPurgingHistory}
            className="px-4 py-2 bg-[#FF8066]/15 hover:bg-[#FF8066]/25 text-[#FF8066] border border-[#FF8066]/30 rounded-2xl text-xs font-extrabold flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isPurgingHistory ? 'Purging...' : 'Purge Location History'}</span>
          </button>
        </div>

        <div className="pt-4 border-t border-[#8957FF]/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="font-bold text-xs">Account Session</h4>
            <p className={`text-[11px] ${themeConfig.textSecondary}`}>
              Sign out of your Beacon Network account on this device
            </p>
          </div>
          <button
            type="button"
            onClick={async () => {
              await logout();
              toast.info('Signed out of Beacon Network');
            }}
            className="px-4 py-2 bg-[#FF3B6B]/15 hover:bg-[#FF3B6B]/25 text-[#FF3B6B] border border-[#FF3B6B]/35 rounded-2xl text-xs font-extrabold flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Log Out of Account</span>
          </button>
        </div>

        <div className="pt-4 border-t border-[#8957FF]/15 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="font-bold text-xs text-[#FF3B6B] flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Permanently Delete Account</span>
              </h4>
              <p className={`text-[11px] ${themeConfig.textSecondary}`}>
                Removes your profile, messages, saved places, and location history
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(!showDeleteConfirm)}
              className="px-4 py-2 bg-[#FF3B6B]/15 hover:bg-[#FF3B6B]/25 text-[#FF3B6B] border border-[#FF3B6B]/30 rounded-2xl text-xs font-extrabold flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Account</span>
            </button>
          </div>

          {showDeleteConfirm && (
            <div className="p-4 rounded-2xl bg-[#FF3B6B]/10 border border-[#FF3B6B]/30 space-y-3">
              <p className="text-xs font-semibold text-[#FF3B6B]">
                Type <strong>DELETE</strong> below to permanently erase your account:
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="Type DELETE"
                  className={`flex-1 px-3 py-2 rounded-xl border text-xs font-mono uppercase ${themeConfig.glassInput}`}
                />
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={
                    isDeletingAccount || deleteConfirmText.trim().toUpperCase() !== 'DELETE'
                  }
                  className="px-4 py-2 bg-[#FF3B6B] text-white rounded-xl text-xs font-extrabold disabled:opacity-50 cursor-pointer"
                >
                  {isDeletingAccount ? 'Deleting...' : 'Confirm Delete'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
