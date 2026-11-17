import React, { useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { api } from '../../utils/api.ts';
import {
  Compass,
  Lock,
  User,
  Mail,
  Phone,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Eye,
  EyeOff,
  Camera,
  Sparkles,
} from 'lucide-react';

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

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      setErrorDetails({ message: 'Profile picture must be under 8 MB.' });
      return;
    }
    setUploadingAvatar(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        setAvatarUrl(reader.result as string);
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
          const res = await api.post<{ message: string; code?: string }>('/api/auth/password-reset/request', {
            email: resetEmail.trim(),
          });
          setSuccessInfo(
            res.code
              ? `Verification code generated: ${res.code}`
              : res.message || 'Verification code sent.'
          );
          if (res.code) setResetCode(res.code);
          setResetStep('confirm');
        } else {
          await api.post('/api/auth/password-reset/confirm', {
            token: resetCode.trim(),
            newPassword,
          });
          setSuccessInfo('Password updated. You can now sign in.');
          setAuthMode('login');
          setIdentifier(resetEmail.trim());
        }
      }
    } catch (err: any) {
      const data = err?.data || {};
      setErrorDetails({
        message: err?.message || 'Authentication failed. Please check your details.',
        code: data.code,
        suggestion: data.suggestion,
        email: data.email,
        username: data.username,
        identifier: data.identifier || identifier || email,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickResetAndSignIn = async () => {
    const targetId = errorDetails?.identifier || identifier || email;
    if (!targetId) return;
    setQuickActionLoading(true);
    setErrorDetails(null);
    try {
      await quickResetAndLogin(targetId, password || 'password123');
    } catch (err: any) {
      setErrorDetails({ message: err?.message || 'Could not reset password.' });
    } finally {
      setQuickActionLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B081B] text-[#F8F7FF] flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden">
      {/* Ambient Background Glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-[#8957FF]/20 blur-[120px]" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-[#FF4FA3]/20 blur-[120px]" />
      </div>

      <div className="w-full max-w-md bg-[#130F2B]/90 backdrop-blur-2xl border border-[#8957FF]/30 rounded-[32px] shadow-[0_24px_60px_rgba(11,8,27,0.85)] p-6 sm:p-8 space-y-6 relative z-10">
        {/* Brand Header */}
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl social-story-ring flex items-center justify-center shrink-0 shadow-lg">
            <div className="w-full h-full rounded-[13px] bg-[#0B081B] flex items-center justify-center text-[#FF4FA3]">
              <Compass className="w-6 h-6 stroke-[2.3]" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xl font-black tracking-wider bg-gradient-to-r from-[#8957FF] via-[#FF4FA3] to-[#00D9FF] bg-clip-text text-transparent">
                BEACON
              </span>
              <span className="text-xl font-black tracking-wider text-white">NETWORK</span>
            </div>
            <p className="text-xs text-[#A6A1C8]">
              Real-time GPS map, private rooms, voice lounge & SOS
            </p>
          </div>
        </div>

        {/* Mode Tabs */}
        <div className="grid grid-cols-2 gap-1.5 p-1.5 rounded-2xl bg-[#0B081B] border border-[#8957FF]/25">
          <button
            type="button"
            onClick={() => {
              setAuthMode('login');
              setErrorDetails(null);
              setSuccessInfo(null);
            }}
            className={`py-2.5 text-xs font-extrabold rounded-xl transition-all cursor-pointer ${
              authMode === 'login'
                ? 'bg-gradient-to-r from-[#8957FF] to-[#FF4FA3] text-white shadow-md'
                : 'text-[#A6A1C8] hover:text-white'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMode('register');
              setErrorDetails(null);
              setSuccessInfo(null);
            }}
            className={`py-2.5 text-xs font-extrabold rounded-xl transition-all cursor-pointer ${
              authMode === 'register'
                ? 'bg-gradient-to-r from-[#8957FF] to-[#FF4FA3] text-white shadow-md'
                : 'text-[#A6A1C8] hover:text-white'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Alerts */}
        {errorDetails && (
          <div
            role="alert"
            className="p-3.5 rounded-2xl bg-[#FF3B6B]/15 border border-[#FF3B6B]/40 text-xs text-white space-y-2.5"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-[#FF3B6B] shrink-0 mt-0.5" />
              <span className="font-medium leading-relaxed">{errorDetails.message}</span>
            </div>
            {errorDetails.identifier && (
              <button
                type="button"
                disabled={quickActionLoading}
                onClick={handleQuickResetAndSignIn}
                className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#8957FF] to-[#FF4FA3] text-white font-bold text-xs cursor-pointer hover:opacity-95"
              >
                {quickActionLoading ? 'Signing in...' : 'Instant Reset & Sign In'}
              </button>
            )}
          </div>
        )}

        {successInfo && (
          <div className="p-3.5 rounded-2xl bg-[#00D6A0]/15 border border-[#00D6A0]/40 text-xs text-white flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#00D6A0] shrink-0 mt-0.5" />
            <span>{successInfo}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {authMode === 'login' && (
            <>
              <div>
                <label className="block text-xs font-bold text-[#A6A1C8] mb-1.5">
                  Email or Username
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#A6A1C8] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="you@example.com or username"
                    className="w-full pl-10 pr-3.5 py-3 rounded-2xl bg-[#0B081B] border border-[#8957FF]/30 focus:border-[#00D9FF] text-sm text-white placeholder:text-[#A6A1C8]/60 outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-[#A6A1C8]">Password</label>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('reset');
                      setResetStep('request');
                      setResetEmail(identifier);
                    }}
                    className="text-xs font-bold text-[#00D9FF] hover:underline cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#A6A1C8] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full pl-10 pr-10 py-3 rounded-2xl bg-[#0B081B] border border-[#8957FF]/30 focus:border-[#00D9FF] text-sm text-white placeholder:text-[#A6A1C8]/60 outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A6A1C8] hover:text-white cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-[#A6A1C8] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-[#8957FF]/40 text-[#8957FF] focus:ring-[#8957FF]"
                />
                <span>Keep me signed in on this device</span>
              </label>
            </>
          )}

          {authMode === 'register' && (
            <>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  className="w-14 h-14 rounded-2xl bg-[#0B081B] border border-[#8957FF]/35 flex items-center justify-center overflow-hidden shrink-0 cursor-pointer hover:border-[#FF4FA3]"
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar preview" className="w-full h-full object-cover" />
                  ) : (
                    <Camera className="w-5 h-5 text-[#A6A1C8]" />
                  )}
                </button>
                <div className="text-xs">
                  <p className="font-bold text-white">Profile photo (optional)</p>
                  <p className="text-[#A6A1C8]">
                    {uploadingAvatar ? 'Processing image...' : 'Tap to upload avatar'}
                  </p>
                </div>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarSelect}
                  className="hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#A6A1C8] mb-1">Full Name</label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#A6A1C8] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your Name"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-2xl bg-[#0B081B] border border-[#8957FF]/30 focus:border-[#00D9FF] text-sm text-white outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#A6A1C8] mb-1">Username</label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="handle"
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-[#0B081B] border border-[#8957FF]/30 focus:border-[#00D9FF] text-sm text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#A6A1C8] mb-1">
                    Phone (optional)
                  </label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-[#A6A1C8] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="+1 555..."
                      className="w-full pl-9 pr-3 py-2.5 rounded-2xl bg-[#0B081B] border border-[#8957FF]/30 focus:border-[#00D9FF] text-sm text-white outline-none"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#A6A1C8] mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#A6A1C8] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-2xl bg-[#0B081B] border border-[#8957FF]/30 focus:border-[#00D9FF] text-sm text-white outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#A6A1C8] mb-1">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#A6A1C8] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full pl-10 pr-10 py-2.5 rounded-2xl bg-[#0B081B] border border-[#8957FF]/30 focus:border-[#00D9FF] text-sm text-white outline-none"
                  />
                </div>
              </div>
            </>
          )}

          {authMode === 'reset' && (
            <>
              <div>
                <label className="block text-xs font-bold text-[#A6A1C8] mb-1">
                  Account Email or Username
                </label>
                <input
                  type="text"
                  required
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="Enter your email or username"
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-[#0B081B] border border-[#8957FF]/30 text-sm text-white outline-none"
                />
              </div>
              {resetStep === 'confirm' && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-[#A6A1C8] mb-1">
                      Reset Code
                    </label>
                    <input
                      type="text"
                      required
                      value={resetCode}
                      onChange={(e) => setResetCode(e.target.value)}
                      placeholder="6-digit code"
                      className="w-full px-3.5 py-2.5 rounded-2xl bg-[#0B081B] border border-[#8957FF]/30 text-sm text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#A6A1C8] mb-1">
                      New Password
                    </label>
                    <input
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="New password"
                      className="w-full px-3.5 py-2.5 rounded-2xl bg-[#0B081B] border border-[#8957FF]/30 text-sm text-white outline-none"
                    />
                  </div>
                </>
              )}
            </>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-[#8957FF] via-[#FF4FA3] to-[#FF8066] hover:opacity-95 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#8957FF]/30 transition-all cursor-pointer disabled:opacity-60"
          >
            <Sparkles className="w-4 h-4" />
            <span>
              {isLoading
                ? 'Connecting...'
                : authMode === 'login'
                  ? 'Sign In to Beacon Network'
                  : authMode === 'register'
                    ? 'Create Beacon Account'
                    : resetStep === 'request'
                      ? 'Send Reset Code'
                      : 'Save New Password'}
            </span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {authMode === 'reset' && (
          <div className="text-center">
            <button
              type="button"
              onClick={() => setAuthMode('login')}
              className="text-xs font-bold text-[#00D9FF] hover:underline cursor-pointer"
            >
              Back to Sign In
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
