import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useRealtime } from '../../context/RealtimeContext.tsx';
import { useTheme } from '../../context/ThemeContext.tsx';
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
  Camera,
  Palette,
  Sparkles,
  LogOut,
  Trash2,
  UserX,
  AlertTriangle,
  Copy,
  Smartphone,
  Download,
  ExternalLink,
  Sun,
  Moon,
  Users,
  Layers,
  MapPin,
} from 'lucide-react';

export const ProfilePrivacyView: React.FC = () => {
  const { user, updatePrivacy, updateProfile, logout } = useAuth();
  const { onlineUserIds, userLocations } = useRealtime();
  const { currentTheme, setTheme, allThemes, themeConfig, toggleDarkLight } = useTheme();
  const isDark = themeConfig.isDark;
  const toast = useToast();
  const avatarFileInputRef = useRef<HTMLInputElement>(null);

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
        `Deleted ${res.deletedCount || 0} location history records from server & cloud`
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
          toast.success('Profile photo updated! Click "Save Changes" to sync everywhere.');
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
        temporarySharingExpiry: null,
      });

      setSavedMsg('Profile & privacy settings saved across Web & Android!');
      toast.success('Profile & privacy settings updated!');
      setTimeout(() => setSavedMsg(null), 3000);
    } catch (err) {
      console.error('Error saving profile:', err);
      toast.error('Failed to save profile changes');
    } finally {
      setIsSaving(false);
    }
  };

  const cardClass = isDark
    ? 'bg-[#130F2B]/90 border-[#8957FF]/25 text-[#F8F7FF] shadow-xl'
    : 'bg-white border-[#8957FF]/15 text-slate-900 shadow-[0_10px_30px_rgba(137,87,255,0.07)]';

  const subCardClass = isDark
    ? 'bg-[#1B153A] border-white/10 text-[#F8F7FF]'
    : 'bg-[#F8F6FF] border-[#8957FF]/15 text-slate-900';

  const inputClass = isDark
    ? 'bg-[#0B081B] border-[#8957FF]/35 text-white placeholder-[#A9A2D0]/50 focus:border-[#FF4FA3]'
    : 'bg-white border-[#8957FF]/25 text-slate-900 placeholder-slate-400 focus:border-[#8957FF]';

  const totalConnectedFriends = Math.max(
    friendsCount,
    userLocations.filter((l) => l.userId !== user?.id).length
  );

  return (
    <div
      className={`flex flex-col h-full overflow-y-auto p-4 md:p-6 pb-28 max-w-4xl mx-auto w-full space-y-6 select-none transition-colors duration-300 ${
        isDark ? 'text-[#F8F7FF]' : 'text-slate-900'
      }`}
    >
      {/* 1. GRADIENT PROFILE COVER & LARGE PROFILE PHOTO CARD */}
      <div className={`rounded-[32px] border overflow-hidden ${cardClass}`}>
        {/* Vibrant Social Gradient Banner */}
        <div className="h-36 sm:h-44 bg-gradient-to-r from-[#8957FF] via-[#FF4FA3] to-[#FF8066] relative">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,209,102,0.35),transparent_55%)]" />
          <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
            {/* Quick Light / Dark Mode Switch */}
            <button
              type="button"
              onClick={toggleDarkLight}
              className="px-3.5 py-2 rounded-2xl bg-black/30 hover:bg-black/45 backdrop-blur-md border border-white/25 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-lg active:scale-95 transition-all"
            >
              {isDark ? (
                <>
                  <Sun className="w-4 h-4 text-[#FFD166]" />
                  <span>Light Mode</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-[#E9DFFF]" />
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
              className="px-3.5 py-2 rounded-2xl bg-black/30 hover:bg-rose-600/80 backdrop-blur-md border border-white/25 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-lg active:scale-95 transition-all"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* Overlapping Profile Avatar + Bio + Social Counters */}
        <div className="px-5 sm:px-7 pb-6 -mt-14 sm:-mt-16 relative space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="flex items-end gap-4">
              <div
                onClick={() => avatarFileInputRef.current?.click()}
                className="relative group cursor-pointer shrink-0"
                title="Tap to upload a new profile picture"
              >
                <div className="social-story-ring rounded-full p-1 shadow-2xl">
                  <img
                    src={avatarUrl || user?.avatarUrl}
                    alt={user?.fullName}
                    className={`w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover border-4 ${
                      isDark ? 'border-[#130F2B]' : 'border-white'
                    }`}
                  />
                </div>
                <div className="absolute inset-1 rounded-full bg-black/45 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <Camera className="w-6 h-6 text-white" />
                </div>
                <span className="absolute bottom-1.5 right-1.5 w-7 h-7 rounded-full bg-gradient-to-r from-[#8957FF] to-[#FF4FA3] text-white flex items-center justify-center border-2 border-[#0B081B] shadow-md">
                  <Camera className="w-3.5 h-3.5" />
                </span>
              </div>

              <div className="pb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                    {fullName || user?.fullName}
                  </h2>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                      sharingEnabled
                        ? 'bg-[#00D6A0]/20 text-[#00D6A0] border border-[#00D6A0]/40'
                        : 'bg-[#FFD166]/20 text-[#FFD166] border border-[#FFD166]/40'
                    }`}
                  >
                    {sharingEnabled ? '📍 Live GPS Active' : 'GPS Paused'}
                  </span>
                </div>
                <p className={`text-xs font-semibold ${isDark ? 'text-[#A9A2D0]' : 'text-slate-500'}`}>
                  @{user?.username} · {about || 'Sharing live spots & stories on Beacon'}
                </p>
              </div>
            </div>

            {/* Copy Unique User ID Pill (Uses User's Name) */}
            <button
              type="button"
              onClick={async () => {
                const nameId = user?.fullName || user?.username || user?.id;
                if (!nameId) return;
                try {
                  await navigator.clipboard.writeText(nameId);
                  toast.success(`Copied User ID: ${nameId}`);
                } catch {
                  toast.info(`User ID: ${nameId}`);
                }
              }}
              className="self-start sm:self-end px-3.5 py-2 rounded-2xl bg-gradient-to-r from-[#8957FF]/15 to-[#FF4FA3]/15 border border-[#8957FF]/35 text-xs font-mono font-extrabold text-[#FF4FA3] flex items-center gap-2 cursor-pointer hover:opacity-90"
            >
              <span>ID: {user?.fullName || user?.username || user?.id}</span>
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Beautiful Profile Information Cards (Friends Count, Active Rooms, Status) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            <div className={`p-3.5 rounded-2xl border ${subCardClass}`}>
              <div className="flex items-center gap-2 text-[#FF4FA3] mb-1">
                <Users className="w-4 h-4" />
                <span className="text-[10px] font-extrabold uppercase tracking-wider">
                  Friends
                </span>
              </div>
              <span className="text-xl font-extrabold block">{totalConnectedFriends}</span>
              <span className={`text-[11px] ${isDark ? 'text-[#A9A2D0]' : 'text-slate-500'}`}>
                {onlineUserIds.length} online now
              </span>
            </div>

            <div className={`p-3.5 rounded-2xl border ${subCardClass}`}>
              <div className="flex items-center gap-2 text-[#8957FF] mb-1">
                <Layers className="w-4 h-4" />
                <span className="text-[10px] font-extrabold uppercase tracking-wider">
                  Active Rooms
                </span>
              </div>
              <span className="text-xl font-extrabold block">{roomsCount}</span>
              <span className={`text-[11px] ${isDark ? 'text-[#A9A2D0]' : 'text-slate-500'}`}>
                Joined circles
              </span>
            </div>

            <div className={`p-3.5 rounded-2xl border ${subCardClass}`}>
              <div className="flex items-center gap-2 text-[#00D6A0] mb-1">
                <MapPin className="w-4 h-4" />
                <span className="text-[10px] font-extrabold uppercase tracking-wider">
                  Location Status
                </span>
              </div>
              <span className="text-sm font-extrabold block text-[#00D6A0]">
                {sharingEnabled ? 'Sharing Live' : 'Paused'}
              </span>
              <span className={`text-[11px] ${isDark ? 'text-[#A9A2D0]' : 'text-slate-500'}`}>
                Vis: {locationVis.replace('_', ' ')}
              </span>
            </div>

            <div className={`p-3.5 rounded-2xl border ${subCardClass}`}>
              <div className="flex items-center gap-2 text-[#397BFF] mb-1">
                <Sparkles className="w-4 h-4" />
                <span className="text-[10px] font-extrabold uppercase tracking-wider">
                  Personal Status
                </span>
              </div>
              <span className="text-xs font-extrabold block truncate">
                {about || 'Exploring live'}
              </span>
              <span className={`text-[11px] ${isDark ? 'text-[#A9A2D0]' : 'text-slate-500'}`}>
                {showOnline ? 'Online badge visible' : 'Stealth mode'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. COLOURFUL SOCIAL THEME & LIGHT/DARK SELECTOR */}
      <div className={`p-5 sm:p-6 rounded-[32px] border space-y-4 ${cardClass}`}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#8957FF] to-[#FF4FA3] flex items-center justify-center text-white shadow-sm">
              <Palette className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm">Beacon Network Themes (Light & Dark)</h3>
              <p className={`text-xs ${isDark ? 'text-[#A9A2D0]' : 'text-slate-500'}`}>
                Pick your favourite gradient aesthetic or switch between Daylight and Midnight modes
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={toggleDarkLight}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#8957FF] to-[#FF4FA3] text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            <span>Switch to {isDark ? 'Light' : 'Dark'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {allThemes.map((t) => {
            const isSelected = currentTheme === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setTheme(t.id);
                  toast.success(`Switched to ${t.name} theme`);
                }}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 relative overflow-hidden group ${
                  isSelected
                    ? 'border-[#FF4FA3] ring-2 ring-[#FF4FA3]/30 bg-gradient-to-br from-[#8957FF]/15 to-[#FF4FA3]/10'
                    : `${subCardClass} hover:border-[#8957FF]/50`
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-6 h-6 rounded-xl bg-gradient-to-tr ${t.previewColor} shadow-sm border border-white/30`}
                    />
                    <span className="font-extrabold text-xs">{t.name}</span>
                  </div>
                  {isSelected && (
                    <span className="w-5 h-5 rounded-full bg-gradient-to-r from-[#8957FF] to-[#FF4FA3] text-white flex items-center justify-center shadow">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </span>
                  )}
                </div>
                <p
                  className={`text-[11px] leading-snug ${
                    isDark ? 'text-[#A9A2D0]' : 'text-slate-500'
                  }`}
                >
                  {t.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. EDIT PROFILE & PRIVACY SETTINGS FORM */}
      <form onSubmit={handleSaveAll} className="space-y-6">
        <div className={`p-5 sm:p-6 rounded-[32px] border space-y-4 ${cardClass}`}>
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
              <label className="block text-xs font-extrabold mb-1">Display Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className={`w-full px-3.5 py-2.5 rounded-2xl border text-sm font-semibold focus:outline-none ${inputClass}`}
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold mb-1">Phone Number</label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+1 (555) 234-5678"
                className={`w-full px-3.5 py-2.5 rounded-2xl border text-sm font-semibold focus:outline-none ${inputClass}`}
              />
            </div>

            <div className="md:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-extrabold">Profile Photo URL or Upload</label>
                <button
                  type="button"
                  onClick={() => avatarFileInputRef.current?.click()}
                  className="text-xs font-extrabold text-[#FF4FA3] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>{isUploadingAvatar ? 'Processing...' : 'Upload from Device'}</span>
                </button>
              </div>
              <input
                type="url"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://images.unsplash.com/..."
                className={`w-full px-3.5 py-2.5 rounded-2xl border text-sm font-semibold focus:outline-none ${inputClass}`}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-extrabold mb-1">
                Personal Status / Bio
              </label>
              <input
                type="text"
                value={about}
                onChange={(e) => setAbout(e.target.value)}
                placeholder="Coffee lover ☕ · Sharing live location with family 📍"
                className={`w-full px-3.5 py-2.5 rounded-2xl border text-sm font-semibold focus:outline-none ${inputClass}`}
              />
            </div>
          </div>
        </div>

        {/* Privacy & Location Permissions Card */}
        <div className={`p-5 sm:p-6 rounded-[32px] border space-y-5 ${cardClass}`}>
          <h3 className="font-extrabold text-sm flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#00D6A0]" />
            <span>Beacon Network Privacy Controls</span>
          </h3>

          {/* Master Location Toggle */}
          <div className={`flex items-center justify-between p-4 rounded-2xl border ${subCardClass}`}>
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                  sharingEnabled
                    ? 'bg-[#00D6A0]/20 text-[#00D6A0]'
                    : 'bg-slate-500/20 text-slate-400'
                }`}
              >
                <Radio className="w-5 h-5" />
              </div>
              <div>
                <p className="font-extrabold text-sm">Real-Time Location Broadcasting</p>
                <p className={`text-xs ${isDark ? 'text-[#A9A2D0]' : 'text-slate-500'}`}>
                  Allow approved friends and rooms to see your live avatar on the map
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
              <div className="w-11 h-6 bg-slate-500/40 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00D6A0]" />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-extrabold mb-1.5 flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-[#8957FF]" />
                Who can see my live location?
              </label>
              <select
                value={locationVis}
                onChange={(e) => setLocationVis(e.target.value as any)}
                className={`w-full px-3.5 py-2.5 rounded-2xl border text-xs font-bold focus:outline-none ${inputClass}`}
              >
                <option value="everyone">Everyone on Beacon</option>
                <option value="room_members">Room Members Only (Recommended)</option>
                <option value="selected">Explicitly Approved Friends Only</option>
                <option value="nobody">Nobody (Stealth Mode)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-extrabold mb-1.5 flex items-center gap-1.5">
                <Phone className="w-4 h-4 text-[#FF4FA3]" />
                Who can see my phone number?
              </label>
              <select
                value={phoneVis}
                onChange={(e) => setPhoneVis(e.target.value as any)}
                className={`w-full px-3.5 py-2.5 rounded-2xl border text-xs font-bold focus:outline-none ${inputClass}`}
              >
                <option value="everyone">Everyone</option>
                <option value="room_members">Room Members Only</option>
                <option value="nobody">Nobody (Keep Private)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-extrabold mb-1.5 flex items-center gap-1.5">
                <User className="w-4 h-4 text-[#397BFF]" />
                Who can view my profile details?
              </label>
              <select
                value={profileVis}
                onChange={(e) => setProfileVis(e.target.value as any)}
                className={`w-full px-3.5 py-2.5 rounded-2xl border text-xs font-bold focus:outline-none ${inputClass}`}
              >
                <option value="everyone">Everyone</option>
                <option value="room_members">Room Members Only</option>
                <option value="nobody">Nobody</option>
              </select>
            </div>

            <div className={`flex items-center justify-between p-3.5 rounded-2xl border ${subCardClass}`}>
              <div>
                <p className="text-xs font-extrabold">Show Online Presence Indicator</p>
                <p className={`text-[11px] ${isDark ? 'text-[#A9A2D0]' : 'text-slate-500'}`}>
                  Display the Mint Green dot when you are active
                </p>
              </div>
              <input
                type="checkbox"
                checked={showOnline}
                onChange={(e) => setShowOnline(e.target.checked)}
                className="w-4 h-4 accent-[#00D6A0] rounded cursor-pointer"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          {savedMsg ? (
            <div className="flex items-center gap-1.5 text-[#00D6A0] text-xs font-extrabold">
              <Check className="w-4 h-4" />
              <span>{savedMsg}</span>
            </div>
          ) : (
            <div />
          )}

          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-3 bg-gradient-to-r from-[#8957FF] via-[#FF4FA3] to-[#FF8066] hover:opacity-95 text-white rounded-2xl text-xs font-extrabold flex items-center gap-2 shadow-[0_8px_24px_rgba(255,79,163,0.4)] transition-all cursor-pointer active:scale-95"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Saving...' : 'Save Profile & Privacy'}</span>
          </button>
        </div>
      </form>

      {/* 4. ANDROID APK & WEB CLOUD SYNCHRONIZATION CARD */}
      <div className={`p-5 sm:p-6 rounded-[32px] border space-y-4 ${cardClass}`}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#397BFF] to-[#00D9FF] text-white flex items-center justify-center shadow-sm">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm">Android APK & Web Cloud Sync</h3>
              <p className={`text-xs ${isDark ? 'text-[#A9A2D0]' : 'text-slate-500'}`}>
                Install the native Android APK to share live locations on the go
              </p>
            </div>
          </div>

          <a
            href="https://github.com/Harikrishna8118/Track-Your-Friends-/releases/latest/download/app-debug.apk"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#397BFF] to-[#00D9FF] text-white font-extrabold text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Android APK</span>
            <ExternalLink className="w-3 h-3 opacity-80" />
          </a>
        </div>
      </div>

      {/* 5. BLOCKED USERS & ACCOUNT DANGER ZONE */}
      <div className={`p-5 sm:p-6 rounded-[32px] border space-y-5 ${cardClass}`}>
        <div>
          <h3 className="font-extrabold text-sm flex items-center gap-2">
            <UserX className="w-4 h-4 text-[#FF4FA3]" />
            <span>Blocked Users ({blockedUsers.length})</span>
          </h3>
          {blockedUsers.length === 0 ? (
            <p className={`text-xs mt-1 ${isDark ? 'text-[#A9A2D0]' : 'text-slate-500'}`}>
              You haven't blocked any users.
            </p>
          ) : (
            <div className="space-y-2 mt-3">
              {blockedUsers.map((bu) => (
                <div
                  key={bu.id}
                  className={`flex items-center justify-between p-3 rounded-2xl border ${subCardClass}`}
                >
                  <div className="flex items-center gap-2.5">
                    <img
                      src={bu.avatarUrl}
                      alt={bu.fullName}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                    <div>
                      <span className="text-xs font-extrabold block">{bu.fullName}</span>
                      <span className={`text-[10px] ${isDark ? 'text-[#A9A2D0]' : 'text-slate-500'}`}>
                        @{bu.username}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleUnblockUser(bu.id, bu.fullName)}
                    className="px-3 py-1 bg-[#00D6A0]/15 text-[#00D6A0] rounded-xl text-xs font-extrabold cursor-pointer"
                  >
                    Unblock
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={`pt-4 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
          <div>
            <h4 className="font-extrabold text-xs">Purge Ephemeral Location History</h4>
            <p className={`text-[11px] ${isDark ? 'text-[#A9A2D0]' : 'text-slate-500'}`}>
              Delete all recorded breadcrumb trail coordinates older than your current live fix.
            </p>
          </div>
          <button
            type="button"
            onClick={handlePurgeLocationHistory}
            disabled={isPurgingHistory}
            className="px-4 py-2 bg-[#FFD166]/20 hover:bg-[#FFD166]/30 text-amber-600 dark:text-[#FFD166] border border-[#FFD166]/40 rounded-xl text-xs font-extrabold flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isPurgingHistory ? 'Purging...' : 'Purge History'}</span>
          </button>
        </div>

        <div className={`pt-4 border-t space-y-3 ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="font-extrabold text-xs text-[#FF4FA3] flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Permanently Delete Account</span>
              </h4>
              <p className={`text-[11px] ${isDark ? 'text-[#A9A2D0]' : 'text-slate-500'}`}>
                Removes your account, messages, saved places, and location history.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(!showDeleteConfirm)}
              className="px-4 py-2 bg-[#FF4FA3]/15 hover:bg-[#FF4FA3]/25 text-[#FF4FA3] border border-[#FF4FA3]/35 rounded-xl text-xs font-extrabold flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Account</span>
            </button>
          </div>

          {showDeleteConfirm && (
            <div className="p-4 rounded-2xl bg-[#FF4FA3]/10 border border-[#FF4FA3]/35 space-y-3">
              <p className="text-xs font-bold">
                Type <strong>DELETE</strong> below to permanently erase your account:
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="Type DELETE"
                  className={`flex-1 px-3 py-2 rounded-xl border text-xs font-mono uppercase ${inputClass}`}
                />
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={isDeletingAccount || deleteConfirmText.trim().toUpperCase() !== 'DELETE'}
                  className="px-4 py-2 bg-[#FF4FA3] text-white rounded-xl text-xs font-extrabold disabled:opacity-50 cursor-pointer"
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
