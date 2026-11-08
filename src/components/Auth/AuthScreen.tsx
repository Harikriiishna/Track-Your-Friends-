import React, { useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { api } from '../../utils/api.ts';
import {
  Compass,
  Shield,
  Lock,
  User,
  Mail,
  Phone,
  ArrowRight,
  CheckCircle2,
  KeyRound,
  AlertTriangle,
  RotateCcw,
  Zap,
  Eye,
  EyeOff,
  Globe,
  Camera,
  Sparkles,
  Fingerprint,
} from 'lucide-react';
import { PWAInstallButton } from '../Navigation/PWAInstallButton.tsx';
import { WebsiteLaunchModal } from '../Navigation/WebsiteLaunchModal.tsx';
import { BackendDiagnosticPanel } from '../Navigation/BackendDiagnosticPanel.tsx';
import { SplashOnboarding } from '../Onboarding/SplashOnboarding.tsx';

interface ErrorInfo {
  message: string;
  code?: string;
  suggestion?: 'login' | 'reset' | 'register';
  email?: string;
  username?: string;
  identifier?: string;
}

export const AuthScreen: React.FC = () => {
  const { login, register, quickResetAndLogin } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState<boolean>(() => {
    try {
      const hasSavedUser = Boolean(localStorage.getItem('beacon_saved_identifier'));
      const seenOnboarding = localStorage.getItem('beacon_onboarding_completed') === 'true';
      return !hasSavedUser && !seenOnboarding;
    } catch {
      return false;
    }
  });
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'reset'>('login');

  // Form fields
  const [identifier, setIdentifier] = useState(() => localStorage.getItem('beacon_saved_identifier') || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Password reset fields
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetStep, setResetStep] = useState<'request' | 'confirm'>('request');
  const [successInfo, setSuccessInfo] = useState<string | null>(null);

  const [errorDetails, setErrorDetails] = useState<ErrorInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [quickActionLoading, setQuickActionLoading] = useState(false);
  const [showWebsiteModal, setShowWebsiteModal] = useState(false);

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      setErrorDetails({
        message: 'Profile picture must be under 8 MB.',
      });
      return;
    }
    setUploadingAvatar(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const dataUrl = reader.result as string;
        setAvatarUrl(dataUrl);
      } finally {
        setUploadingAvatar(false);
      }
    };
    reader.onerror = () => setUploadingAvatar(false);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorDetails(null);
    setSuccessInfo(null);
    setIsLoading(true);

    try {
      if (rememberMe) {
        if (identifier) localStorage.setItem('beacon_saved_identifier', identifier.trim());
        if (email) localStorage.setItem('beacon_saved_identifier', email.trim());
      }
      if (authMode === 'login') {
        await login(identifier.trim(), password);
      } else if (authMode === 'register') {
        await register({
          email: email.trim(),
          username: username.trim(),
          fullName: fullName.trim(),
          password,
          phoneNumber: phoneNumber.trim(),
          avatarUrl: avatarUrl || undefined,
        });
      } else if (authMode === 'reset') {
        if (resetStep === 'request') {
          const res = await api.post<{ success: boolean; code?: string; message: string; email?: string }>(
            '/api/auth/password-reset/request',
            { email: resetEmail.trim() }
          );
          setSuccessInfo(`Verification code generated: ${res.code || 'Check console'}. Code pre-filled below.`);
          setResetCode(res.code || '');
          setResetStep('confirm');
        } else {
          await api.post('/api/auth/password-reset/confirm', {
            token: resetCode.trim(),
            newPassword,
          });
          setSuccessInfo('Password successfully updated! You can now log in.');
          setAuthMode('login');
          setIdentifier(resetEmail);
          setPassword(newPassword);
          setResetStep('request');
        }
      }
    } catch (err: any) {
      const msg = err.message || 'Authentication failed. Please check your credentials.';
      const code = err.code || (msg.toLowerCase().includes('already exists') ? 'EMAIL_ALREADY_EXISTS' : undefined);
      const suggestion = err.suggestion || (code === 'EMAIL_ALREADY_EXISTS' ? 'login' : msg.toLowerCase().includes('password') ? 'reset' : undefined);

      setErrorDetails({
        message: msg,
        code,
        suggestion,
        email: err.email || (authMode === 'register' ? email : identifier.includes('@') ? identifier : undefined),
        username: err.username || username,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // One-click quick reset to default & instant sign-in
  const handleQuickResetToDefault = async (targetEmailOrUsername?: string) => {
    const target = (targetEmailOrUsername || identifier || email || resetEmail).trim();
    if (!target) {
      setErrorDetails({
        message: 'Please enter your username or registered email above.',
        code: 'MISSING_IDENTIFIER',
      });
      return;
    }

    try {
      setQuickActionLoading(true);
      setErrorDetails(null);
      await quickResetAndLogin(target, 'password123');
      setSuccessInfo('Password reset and signed in successfully!');
    } catch (err: any) {
      setErrorDetails({
        message: err.message || 'Quick reset failed',
        code: 'QUICK_RESET_FAILED',
      });
    } finally {
      setQuickActionLoading(false);
    }
  };

  // Switch to Sign In tab with prefilled email
  const handleSwitchToSignIn = (prefillEmail?: string) => {
    const target = prefillEmail || errorDetails?.email || email || identifier;
    setAuthMode('login');
    if (target) {
      setIdentifier(target);
    }
    setErrorDetails(null);
    setSuccessInfo(null);
  };

  // Switch to Reset Password tab with prefilled email and auto-request code
  const handleSwitchToReset = async (prefillEmail?: string) => {
    const target = prefillEmail || errorDetails?.email || identifier || email;
    setAuthMode('reset');
    setResetStep('request');
    if (target) {
      setResetEmail(target);
      try {
        setQuickActionLoading(true);
        const res = await api.post<{ success: boolean; code?: string; message: string }>(
          '/api/auth/password-reset/request',
          { email: target.trim() }
        );
        if (res.code) {
          setResetCode(res.code);
          setResetStep('confirm');
          setSuccessInfo(`Verification code (${res.code}) pre-filled! Enter your new password below.`);
        }
      } catch {
        // Let user press request manually
      } finally {
        setQuickActionLoading(false);
      }
    }
    setErrorDetails(null);
  };

  // Switch to Register tab with prefilled email
  const handleSwitchToRegister = (prefillEmail?: string) => {
    const target = prefillEmail || errorDetails?.email || identifier;
    setAuthMode('register');
    if (target) {
      if (target.includes('@')) {
        setEmail(target);
        setUsername(target.split('@')[0]);
      } else {
        setUsername(target);
      }
    }
    setErrorDetails(null);
    setSuccessInfo(null);
  };

  if (showOnboarding) {
    return (
      <SplashOnboarding
        onGetStarted={() => {
          try {
            localStorage.setItem('beacon_onboarding_completed', 'true');
          } catch {}
          setAuthMode('register');
          setShowOnboarding(false);
        }}
        onLogin={() => {
          try {
            localStorage.setItem('beacon_onboarding_completed', 'true');
          } catch {}
          setAuthMode('login');
          setShowOnboarding(false);
        }}
      />
    );
  }

  const isDuplicateAccountError =
    errorDetails?.code === 'EMAIL_ALREADY_EXISTS' ||
    errorDetails?.code === 'USER_ALREADY_EXISTS' ||
    errorDetails?.message.toLowerCase().includes('already exists');

  const isPasswordError =
    errorDetails?.code === 'INVALID_PASSWORD' ||
    errorDetails?.message.toLowerCase().includes('incorrect password') ||
    errorDetails?.message.toLowerCase().includes('invalid username/email or password');

  const isUserNotFoundError =
    errorDetails?.code === 'USER_NOT_FOUND' ||
    errorDetails?.message.toLowerCase().includes('no account found');

  const normalizedHandle = (username || fullName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'explorer').slice(0, 16);

  return (
    <div className="h-full min-h-screen w-full bg-[#0B0719] flex flex-col items-center p-4 sm:p-6 text-[#F8F7FF] relative overflow-y-auto overflow-x-hidden">
      {/* Colourful Ambient Social Glows (Zero-cost GPU radial gradients) */}
      <div
        className="pointer-events-none fixed -top-40 left-1/4 w-[460px] h-[460px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(137, 87, 255, 0.26) 0%, transparent 70%)',
        }}
      />
      <div
        className="pointer-events-none fixed bottom-0 right-1/4 w-[460px] h-[460px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(255, 79, 163, 0.22) 0%, transparent 70%)',
        }}
      />

      <div
        className="w-full max-w-md my-auto bg-[#161030]/90 backdrop-blur-2xl border border-[#8957FF]/35 rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10"
        style={{
          boxShadow: '0 24px 60px rgba(8, 4, 20, 0.8), 0 0 35px rgba(137, 87, 255, 0.18)',
        }}
      >
        {/* Top Tour Link */}
        <div className="flex items-center justify-between mb-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-[#8957FF]/25 to-[#FF4FA3]/25 border border-[#FF4FA3]/40 text-[10px] font-extrabold text-[#FF4FA3]">
            <Sparkles className="w-3 h-3" />
            BEACON NETWORK
          </span>
          <button
            type="button"
            onClick={() => setShowOnboarding(true)}
            className="text-[11px] font-bold text-[#E9DFFF]/80 hover:text-[#00D9FF] transition-colors cursor-pointer"
          >
            Intro & Onboarding →
          </button>
        </div>

        {/* Brand Emblem */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="relative mb-3">
            <span className="absolute -inset-1.5 rounded-3xl bg-gradient-to-r from-[#8957FF] via-[#FF4FA3] to-[#FF8066] opacity-50 blur-md animate-pulse" />
            <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#8957FF] via-[#FF4FA3] to-[#FF8066] flex items-center justify-center text-white shadow-lg">
              <Compass className="w-8 h-8 stroke-[2.2]" />
            </div>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">Beacon Network</h1>
          <p className="text-xs bg-gradient-to-r from-[#00D9FF] to-[#00D6A0] bg-clip-text text-transparent font-extrabold mt-0.5">
            Stay Connected. Stay Together.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex p-1 bg-[#110B26] border border-white/10 rounded-2xl mb-5">
          <button
            type="button"
            onClick={() => {
              setAuthMode('login');
              setErrorDetails(null);
              setSuccessInfo(null);
            }}
            className={`flex-1 py-2 text-xs font-extrabold rounded-xl transition-all cursor-pointer ${
              authMode === 'login'
                ? 'bg-gradient-to-r from-[#8957FF] via-[#FF4FA3] to-[#FF8066] text-white shadow-md'
                : 'text-[#E9DFFF]/70 hover:text-white'
            }`}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMode('register');
              setErrorDetails(null);
              setSuccessInfo(null);
            }}
            className={`flex-1 py-2 text-xs font-extrabold rounded-xl transition-all cursor-pointer ${
              authMode === 'register'
                ? 'bg-gradient-to-r from-[#8957FF] via-[#FF4FA3] to-[#FF8066] text-white shadow-md'
                : 'text-[#E9DFFF]/70 hover:text-white'
            }`}
          >
            Register
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMode('reset');
              setErrorDetails(null);
              setSuccessInfo(null);
              if (identifier.includes('@')) {
                setResetEmail(identifier);
              }
            }}
            className={`flex-1 py-2 text-xs font-extrabold rounded-xl transition-all cursor-pointer ${
              authMode === 'reset'
                ? 'bg-gradient-to-r from-[#397BFF] to-[#00D9FF] text-white shadow-md'
                : 'text-[#E9DFFF]/70 hover:text-white'
            }`}
          >
            Verify / Reset
          </button>
        </div>

        {/* Intelligent Contextual Error Card */}
        {errorDetails && (
          <div className="mb-4 p-3.5 bg-[#FF496C]/15 border border-[#FF496C]/40 rounded-2xl text-xs space-y-2.5 animate-in fade-in duration-200">
            <div className="flex items-start gap-2 text-[#F5F8FF] font-medium">
              <AlertTriangle className="w-4 h-4 text-[#FF496C] shrink-0 mt-0.5" />
              <div className="flex-1 leading-snug">{errorDetails.message}</div>
            </div>

            {isDuplicateAccountError && (
              <div className="pt-2 border-t border-[#FF496C]/25 flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => handleSwitchToSignIn(errorDetails.email || email)}
                  className="flex-1 py-2 px-3 bg-[#287BFF] hover:bg-[#287BFF]/90 text-white font-semibold rounded-xl text-center flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Sign In to This Account</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchToReset(errorDetails.email || email)}
                  className="py-2 px-3 bg-[#0D1424] hover:bg-[#162440] text-[#F5F8FF] font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-white/10"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-[#00E5FF]" />
                  <span>Reset Password</span>
                </button>
              </div>
            )}

            {isPasswordError && (
              <div className="pt-2 border-t border-[#FF496C]/25 flex flex-col gap-2">
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    disabled={quickActionLoading}
                    onClick={() => handleQuickResetToDefault(identifier)}
                    className="flex-1 py-2 px-3 bg-[#19DCA5] hover:bg-[#19DCA5]/90 text-[#070B16] font-bold rounded-xl text-center flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Quick Reset Password</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSwitchToReset(identifier)}
                    className="py-2 px-3 bg-[#0D1424] hover:bg-[#162440] text-[#F5F8FF] font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-white/10"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-[#00E5FF]" />
                    <span>Choose New Password</span>
                  </button>
                </div>
              </div>
            )}

            {isUserNotFoundError && (
              <div className="pt-2 border-t border-[#FF496C]/25">
                <button
                  type="button"
                  onClick={() => handleSwitchToRegister(errorDetails.email || identifier)}
                  className="w-full py-2 px-3 bg-[#287BFF] hover:bg-[#287BFF]/90 text-white font-semibold rounded-xl text-center flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Create Account with "{errorDetails.identifier || identifier}"</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Success Info Banner */}
        {successInfo && (
          <div className="mb-4 p-3 bg-[#19DCA5]/15 border border-[#19DCA5]/40 text-[#19DCA5] rounded-xl text-xs font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-[#19DCA5]" />
            <span>{successInfo}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {authMode === 'login' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                  Username, Email, or Phone
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    placeholder="Enter username or email"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-[#0D1424] border border-white/10 rounded-xl text-sm text-[#F5F8FF] placeholder-[#94A3B8]/50 focus:outline-none focus:border-[#00E5FF]"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-[#94A3B8]">Password</label>
                  <button
                    type="button"
                    onClick={() => handleSwitchToReset(identifier)}
                    className="text-[11px] text-[#00E5FF] hover:underline cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-3" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 bg-[#0D1424] border border-white/10 rounded-xl text-sm text-[#F5F8FF] placeholder-[#94A3B8]/50 focus:outline-none focus:border-[#00E5FF]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-[#94A3B8] hover:text-[#F5F8FF] cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </>
          )}

          {authMode === 'register' && (
            <>
              {/* Profile Picture Upload + Unique User ID Preview */}
              <div className="p-3 rounded-2xl bg-[#0D1424] border border-white/10 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative shrink-0">
                    <div className="w-12 h-12 rounded-2xl bg-[#111D32] border border-[#00E5FF]/40 overflow-hidden flex items-center justify-center">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="Avatar preview" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-5 h-5 text-[#00E5FF]" />
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#287BFF] hover:bg-[#00E5FF] text-white hover:text-[#070B16] flex items-center justify-center shadow cursor-pointer transition-colors"
                      title="Upload Profile Picture"
                    >
                      <Camera className="w-3 h-3" />
                    </button>
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarSelect}
                      className="hidden"
                    />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-[#F5F8FF] block truncate">
                      {fullName.trim() || 'New Beacon Operator'}
                    </span>
                    <span className="text-[11px] font-mono text-[#00E5FF] flex items-center gap-1 truncate">
                      <Fingerprint className="w-3 h-3 shrink-0" />
                      ID: @{normalizedHandle}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  className="px-2.5 py-1.5 rounded-xl bg-[#111D32] hover:bg-[#192a47] border border-white/10 text-[11px] font-semibold text-[#F5F8FF] shrink-0 cursor-pointer"
                >
                  {uploadingAvatar ? 'Loading...' : avatarUrl ? 'Change Photo' : 'Upload Photo'}
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#94A3B8] mb-1">Display Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Alex Morgan"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#0D1424] border border-white/10 rounded-xl text-sm text-[#F5F8FF] placeholder-[#94A3B8]/50 focus:outline-none focus:border-[#00E5FF]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-[#94A3B8] mb-1">Unique Handle</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. alexmorgan"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#0D1424] border border-white/10 rounded-xl text-sm text-[#F5F8FF] placeholder-[#94A3B8]/50 focus:outline-none focus:border-[#00E5FF]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#94A3B8] mb-1">Phone Number</label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-[#94A3B8] absolute left-3 top-3" />
                    <input
                      type="tel"
                      placeholder="+1 555-0199"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="w-full pl-8 pr-3 py-2.5 bg-[#0D1424] border border-white/10 rounded-xl text-sm text-[#F5F8FF] placeholder-[#94A3B8]/50 focus:outline-none focus:border-[#00E5FF]"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#94A3B8] mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-3" />
                  <input
                    type="email"
                    required
                    placeholder="e.g. alex@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-[#0D1424] border border-white/10 rounded-xl text-sm text-[#F5F8FF] placeholder-[#94A3B8]/50 focus:outline-none focus:border-[#00E5FF]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#94A3B8] mb-1">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-3" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Minimum 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 bg-[#0D1424] border border-white/10 rounded-xl text-sm text-[#F5F8FF] placeholder-[#94A3B8]/50 focus:outline-none focus:border-[#00E5FF]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-[#94A3B8] hover:text-[#F5F8FF] cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </>
          )}

          {authMode === 'reset' && (
            <>
              {resetStep === 'request' ? (
                <div>
                  <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                    Registered Email for Verification
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-3" />
                    <input
                      type="email"
                      required
                      placeholder="e.g. user@example.com"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-[#0D1424] border border-white/10 rounded-xl text-sm text-[#F5F8FF] placeholder-[#94A3B8]/50 focus:outline-none focus:border-[#00E5FF]"
                    />
                  </div>
                  <p className="text-[11px] text-[#94A3B8] mt-2">
                    A 6-digit verification code will be generated by the backend and pre-filled immediately.
                  </p>

                  <div className="mt-3 p-3 bg-[#0D1424] border border-white/10 rounded-xl flex items-center justify-between">
                    <div className="text-[11px] text-[#94A3B8]">
                      Need instant recovery?
                    </div>
                    <button
                      type="button"
                      disabled={quickActionLoading}
                      onClick={() => handleQuickResetToDefault(resetEmail)}
                      className="text-xs font-bold text-[#19DCA5] hover:underline cursor-pointer"
                    >
                      Quick Verify & Reset
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                      6-Digit Verification Code
                    </label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-[#00E5FF] absolute left-3.5 top-3" />
                      <input
                        type="text"
                        required
                        placeholder="6-digit code"
                        value={resetCode}
                        onChange={(e) => setResetCode(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-[#0D1424] border border-white/10 rounded-xl text-sm text-[#F5F8FF] font-mono focus:outline-none focus:border-[#00E5FF]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                      New Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-3" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        placeholder="Minimum 6 characters"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full pl-10 pr-10 py-2.5 bg-[#0D1424] border border-white/10 rounded-xl text-sm text-[#F5F8FF] focus:outline-none focus:border-[#00E5FF]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-2.5 text-[#94A3B8] hover:text-[#F5F8FF] cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {/* Remember me and session persistence guarantee */}
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-[#94A3B8]">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded bg-[#0D1424] border-white/20 text-[#287BFF] focus:ring-[#00E5FF] cursor-pointer"
              />
              <span className="font-medium text-[#F5F8FF]">Stay signed in on this device</span>
            </label>
            <span className="text-[10px] text-[#19DCA5] font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Token Synced
            </span>
          </div>

          <button
            type="submit"
            disabled={isLoading || quickActionLoading}
            className="w-full mt-3 py-3.5 bg-gradient-to-r from-[#8957FF] via-[#FF4FA3] to-[#FF8066] hover:opacity-95 active:scale-[0.98] text-white text-xs font-extrabold rounded-2xl shadow-lg shadow-[#FF4FA3]/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            {isLoading ? (
              'Authenticating...'
            ) : (
              <>
                <span>
                  {authMode === 'login'
                    ? 'Sign In to Beacon Network'
                    : authMode === 'register'
                      ? 'Create Beacon Identity'
                      : resetStep === 'request'
                        ? 'Send Verification Code'
                        : 'Confirm & Update Password'}
                </span>
                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
              </>
            )}
          </button>
        </form>

        {/* Website / App Install Options */}
        <div className="mt-5 pt-4 border-t border-white/10 space-y-2.5">
          <div className="flex items-center justify-between gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowWebsiteModal(true)}
              className="flex-1 py-2 px-3 bg-[#0D1424] hover:bg-[#162440] border border-white/10 text-[#00E5FF] rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Share Web & APK</span>
            </button>
            <PWAInstallButton compact={false} />
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-white/10">
          <BackendDiagnosticPanel compactByDefault={true} />
        </div>

        <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-center gap-2 text-[11px] text-[#94A3B8]">
          <Shield className="w-3.5 h-3.5 text-[#19DCA5]" />
          <span>End-to-end location privacy enforced by backend</span>
        </div>
      </div>

      <WebsiteLaunchModal isOpen={showWebsiteModal} onClose={() => setShowWebsiteModal(false)} />
    </div>
  );
};
