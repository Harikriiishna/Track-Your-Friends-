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
} from 'lucide-react';
import { notifications } from '../../utils/notifications.ts';
import { PWAInstallButton } from '../Navigation/PWAInstallButton.tsx';
import { useToast } from '../../context/ToastContext.tsx';
import { useTheme, GLASS_THEMES, GlassThemeId } from '../../context/ThemeContext.tsx';

export const ProfilePrivacyView: React.FC = () => {
  const { user, updateProfile, updatePrivacy, logout } = useAuth();
  const { currentTheme, setTheme, themeConfig } = useTheme();
  const toast = useToast();

  const [fullName, setFullName] = useState(user?.fullName || '');
  const [about, setAbout] = useState(user?.about || '');
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');

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
    </div>
  );
};
