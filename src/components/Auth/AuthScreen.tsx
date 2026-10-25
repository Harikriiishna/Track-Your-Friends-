import React, { useState } from 'react';
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
  const { login, register, demoLogin, quickResetAndLogin } = useAuth();
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

  // Password reset fields
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetStep, setResetStep] = useState<'request' | 'confirm'>('request');
  const [successInfo, setSuccessInfo] = useState<string | null>(null);

  const [errorDetails, setErrorDetails] = useState<ErrorInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [quickActionLoading, setQuickActionLoading] = useState(false);

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

  // Instant demo sign-in
  const handleDemoSignIn = async () => {
    try {
      setQuickActionLoading(true);
      setErrorDetails(null);
      await demoLogin();
    } catch (err: any) {
      setErrorDetails({
        message: err.message || 'Demo access unavailable. Please create an account or sign in.',
        code: 'DEMO_LOGIN_FAILED',
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
      // Auto-trigger verification code request for seamless UX
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
      } catch (err) {
        // Just let user press request manually
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

  return (
    <div className="min-h-screen w-full bg-slate-950 flex flex-col justify-center items-center p-4 sm:p-6 text-slate-100">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative">
        {/* Brand Emblem */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20 mb-3">
            <Compass className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">Beacon Network</h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time GPS tracking, private room communications & emergency mesh
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex p-1 bg-slate-800 rounded-xl mb-4">
          <button
            type="button"
            onClick={() => {
              setAuthMode('login');
              setErrorDetails(null);
              setSuccessInfo(null);
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
              authMode === 'login' ? 'bg-slate-900 text-white shadow' : 'text-slate-400 hover:text-white'
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
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
              authMode === 'register' ? 'bg-slate-900 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Create Account
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
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
              authMode === 'reset' ? 'bg-slate-900 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Reset
          </button>
        </div>

        {/* Intelligent Contextual Error Card with Direct One-Click Actions */}
        {errorDetails && (
          <div className="mb-4 p-3.5 bg-rose-950/90 border border-rose-800/80 rounded-2xl text-xs space-y-2.5 animate-in fade-in duration-200">
            <div className="flex items-start gap-2 text-rose-200 font-medium">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 leading-snug">{errorDetails.message}</div>
            </div>

            {/* Smart Resolution Actions */}
            {isDuplicateAccountError && (
              <div className="pt-2 border-t border-rose-900/60 flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => handleSwitchToSignIn(errorDetails.email || email)}
                  className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-center flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Sign In to This Account</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchToReset(errorDetails.email || email)}
                  className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-blue-400" />
                  <span>Reset Password</span>
                </button>
              </div>
            )}

            {isPasswordError && (
              <div className="pt-2 border-t border-rose-900/60 flex flex-col gap-2">
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    disabled={quickActionLoading}
                    onClick={() => handleQuickResetToDefault(identifier)}
                    className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-center flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Quick Reset Password</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSwitchToReset(identifier)}
                    className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-blue-400" />
                    <span>Choose New Password</span>
                  </button>
                </div>
              </div>
            )}

            {isUserNotFoundError && (
              <div className="pt-2 border-t border-rose-900/60">
                <button
                  type="button"
                  onClick={() => handleSwitchToRegister(errorDetails.email || identifier)}
                  className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-center flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
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
          <div className="mb-4 p-3 bg-emerald-950/80 border border-emerald-800 text-emerald-200 rounded-xl text-xs font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successInfo}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {authMode === 'login' && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Username or Email
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    placeholder="Enter your username or email"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-slate-300">Password</label>
                  <button
                    type="button"
                    onClick={() => handleSwitchToReset(identifier)}
                    className="text-[11px] text-blue-400 hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </>
          )}

          {authMode === 'register' && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Alex Morgan"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Username</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. alexmorgan"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Phone (Optional)</label>
                  <input
                    type="tel"
                    placeholder="e.g. +1 555-0199"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    required
                    placeholder="e.g. alex@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Minimum 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
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
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Your Registered Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                    <input
                      type="email"
                      required
                      placeholder="e.g. user@example.com"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2">
                    A 6-digit verification code will be generated and pre-filled immediately for your convenience.
                  </p>

                  <div className="mt-3 p-3 bg-slate-800/70 border border-slate-700 rounded-xl flex items-center justify-between">
                    <div className="text-[11px] text-slate-300">
                      Need quick access right now?
                    </div>
                    <button
                      type="button"
                      disabled={quickActionLoading}
                      onClick={() => handleQuickResetToDefault(resetEmail)}
                      className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 underline cursor-pointer"
                    >
                      Reset Password
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Verification Code
                    </label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                      <input
                        type="text"
                        required
                        placeholder="6-digit code"
                        value={resetCode}
                        onChange={(e) => setResetCode(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      New Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                      <input
                        type="password"
                        required
                        placeholder="Minimum 6 characters"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {/* Remember me and session persistence guarantee */}
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-300">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded bg-slate-800 border-slate-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
              />
              <span className="font-medium">Stay signed in on this device</span>
            </label>
            <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Auto-saved
            </span>
          </div>

          <button
            type="submit"
            disabled={isLoading || quickActionLoading}
            className="w-full mt-3 py-3 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            {isLoading ? (
              'Processing...'
            ) : (
              <>
                <span>
                  {authMode === 'login'
                    ? 'Sign In to Network'
                    : authMode === 'register'
                    ? 'Create Protected Account'
                    : resetStep === 'request'
                    ? 'Generate Verification Code'
                    : 'Save New Password & Sign In'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Quick Demo Access Option */}
        <div className="mt-5 pt-4 border-t border-slate-800/80">
          <button
            type="button"
            disabled={quickActionLoading}
            onClick={handleDemoSignIn}
            className="w-full py-2.5 px-3 bg-slate-800/90 hover:bg-slate-700/90 active:scale-[0.99] border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white rounded-xl text-xs font-medium flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
          >
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            <span>⚡ Quick Demo Access</span>
          </button>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-center gap-2 text-[11px] text-slate-500">
          <Shield className="w-3.5 h-3.5 text-emerald-500" />
          <span>Real-time location privacy enforced by backend</span>
        </div>
      </div>
    </div>
  );
};
