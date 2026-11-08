import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import type { UserProfile, LocationVisibility, PhoneVisibility, ProfileVisibility } from '../types.ts';
import { api } from '../utils/api.ts';
import { localBackend } from '../utils/localBackend.ts';
import { syncLogger } from '../config/env.ts';

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isLoading: boolean;
  isReauthenticating: boolean;
  lastTokenValidatedAt: string | null;
  validateTokenPersistence: (reason?: string) => Promise<boolean>;
  login: (identifier: string, password: string) => Promise<void>;
  register: (data: { email: string; username: string; fullName: string; password: string; phoneNumber?: string; avatarUrl?: string }) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  demoLogin: () => Promise<void>;
  quickResetAndLogin: (identifier: string, newPassword?: string) => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<UserProfile>;
  updatePrivacy: (privacy: {
    locationVisibility: LocationVisibility;
    phoneVisibility: PhoneVisibility;
    profileVisibility: ProfileVisibility;
    showOnlineStatus: boolean;
    locationSharingEnabled?: boolean;
    temporarySharingExpiry?: string | null;
  }) => Promise<UserProfile>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function readCachedUserProfile(): UserProfile | null {
  try {
    const savedUser = localStorage.getItem('beacon_user_profile');
    return savedUser ? (JSON.parse(savedUser) as UserProfile) : null;
  } catch {
    return null;
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(() => readCachedUserProfile());
  const [token, setToken] = useState<string | null>(() => api.getToken());
  const [isReauthenticating, setIsReauthenticating] = useState<boolean>(false);
  const [lastTokenValidatedAt, setLastTokenValidatedAt] = useState<string | null>(() => {
    try {
      return localStorage.getItem('beacon_token_validated_at');
    } catch {
      return null;
    }
  });

  // If we already have a cached user and token, don't block the UI with full-screen loader
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    const hasCachedUser = !!localStorage.getItem('beacon_user_profile');
    const hasToken = !!api.getToken();
    return !hasCachedUser && hasToken;
  });

  const userRef = useRef<UserProfile | null>(user);
  const tokenRef = useRef<string | null>(token);
  const isLoggingOutRef = useRef<boolean>(false);
  const inFlightValidationRef = useRef<Promise<boolean> | null>(null);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  const markTokenValidated = useCallback(() => {
    const now = new Date().toISOString();
    setLastTokenValidatedAt(now);
    try {
      localStorage.setItem('beacon_token_validated_at', now);
    } catch {
      // ignore storage error
    }
    return now;
  }, []);

  // Save user profile whenever it changes
  const persistUser = useCallback((u: UserProfile | null) => {
    userRef.current = u;
    setUser(u);
    if (u) {
      try {
        localStorage.setItem('beacon_user_profile', JSON.stringify(u));
        localStorage.setItem('beacon_last_logged_in_user', u.id);
      } catch (e) {
        console.warn('Failed to persist user profile', e);
      }
    } else {
      try {
        localStorage.removeItem('beacon_user_profile');
        localStorage.removeItem('beacon_token_validated_at');
      } catch {
        // ignore
      }
      setLastTokenValidatedAt(null);
    }
  }, []);

  /**
   * Token Persistence Validation Layer:
   * Forces a silent re-authentication & cross-platform state synchronization check
   * whenever the user is authenticated locally (Web or Android APK) and the backend returns 401
   * or when resuming across sessions.
   */
  const validateTokenPersistence = useCallback(
    async (reason = 'silent_reauth_check'): Promise<boolean> => {
      if (isLoggingOutRef.current) {
        return false;
      }

      if (inFlightValidationRef.current) {
        return inFlightValidationRef.current;
      }

      const validationPromise = (async (): Promise<boolean> => {
        const currentCachedUser = userRef.current || readCachedUserProfile();
        const currentToken = tokenRef.current || api.getToken();

        if (!currentCachedUser && !currentToken) {
          return false;
        }

        setIsReauthenticating(true);
        syncLogger.log('auth', 'info', 'token_persistence_validation_start', {
          reason,
          hasUser: Boolean(currentCachedUser?.id),
          hasToken: Boolean(currentToken),
        });

        try {
          const restored = await api.silentReauthenticate(currentCachedUser, currentToken);
          if (restored?.user && restored?.token) {
            api.setToken(restored.token);
            tokenRef.current = restored.token;
            setToken(restored.token);
            persistUser(restored.user);
            localBackend.syncUserSession(restored.user, restored.token, true);
            const validatedAt = markTokenValidated();

            if (typeof window !== 'undefined') {
              try {
                window.dispatchEvent(
                  new CustomEvent('beacon:session-synchronized', {
                    detail: {
                      user: restored.user,
                      token: restored.token,
                      reason,
                      validatedAt,
                    },
                  })
                );
              } catch {
                // ignore
              }
            }

            syncLogger.log('auth', 'info', 'token_persistence_validation_success', {
              reason,
              userId: restored.user.id,
              validatedAt,
            });
            return true;
          }

          // If silent re-authentication could not reach remote server but we have a valid local user profile,
          // keep the persisted session intact so offline/APK usage never drops the user to the login screen.
          if (currentCachedUser?.id) {
            const fallbackToken = currentToken || api.getToken();
            if (fallbackToken) {
              api.setToken(fallbackToken);
              tokenRef.current = fallbackToken;
              setToken(fallbackToken);
              localBackend.syncUserSession(currentCachedUser, fallbackToken, false);
            }
            persistUser(currentCachedUser);
            return true;
          }

          return false;
        } catch (err: any) {
          syncLogger.log('auth', 'warn', 'token_persistence_validation_error', {
            reason,
            error: err?.message || 'Unknown validation error',
          });
          return Boolean(currentCachedUser?.id);
        } finally {
          setIsReauthenticating(false);
          inFlightValidationRef.current = null;
        }
      })();

      inFlightValidationRef.current = validationPromise;
      return validationPromise;
    },
    [markTokenValidated, persistUser]
  );

  // Register 401 interceptor & cross-platform Web <-> Android APK synchronization listeners
  useEffect(() => {
    const unsubscribeUnauthorized = api.onUnauthorized(async ({ endpoint }) => {
      if (isLoggingOutRef.current) return false;
      const hasSession = Boolean(userRef.current || readCachedUserProfile() || tokenRef.current || api.getToken());
      if (!hasSession) return false;
      return validateTokenPersistence(`backend_401:${endpoint}`);
    });

    const handleVisibilityOrOnline = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return;
      }
      if (isLoggingOutRef.current) return;
      const activeUser = userRef.current || readCachedUserProfile();
      const activeToken = tokenRef.current || api.getToken();
      if (activeUser && activeToken) {
        void validateTokenPersistence('session_resume_sync');
      }
    };

    const handleStorageSync = (event: StorageEvent) => {
      if (event.key === 'beacon_token' || event.key === 'beacon_user_profile') {
        const nextUser = readCachedUserProfile();
        const nextToken = localStorage.getItem('beacon_token');
        if (nextUser && nextToken) {
          setToken(nextToken);
          setUser(nextUser);
          void validateTokenPersistence('cross_tab_storage_sync');
        } else if (!nextUser && !nextToken && !isLoggingOutRef.current) {
          setToken(null);
          setUser(null);
        }
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleVisibilityOrOnline);
      window.addEventListener('storage', handleStorageSync);
      document.addEventListener('visibilitychange', handleVisibilityOrOnline);
    }

    return () => {
      unsubscribeUnauthorized();
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleVisibilityOrOnline);
        window.removeEventListener('storage', handleStorageSync);
        document.removeEventListener('visibilitychange', handleVisibilityOrOnline);
      }
    };
  }, [validateTokenPersistence]);

  // Initialize and verify token in background on mount
  useEffect(() => {
    async function checkAuth() {
      const cachedProfile = readCachedUserProfile();
      const storedToken = api.getToken();

      if (!storedToken && !cachedProfile) {
        persistUser(null);
        setIsLoading(false);
        return;
      }

      if (storedToken) {
        setToken(storedToken);
      }

      try {
        const data = await api.get<{ user: UserProfile }>('/api/auth/me');
        const latestToken = api.getToken() || storedToken;
        if (latestToken) {
          api.setToken(latestToken);
          setToken(latestToken);
          localBackend.syncUserSession(data.user, latestToken, false);
        }
        persistUser(data.user);
        markTokenValidated();
      } catch (err: any) {
        const isExplicitAuthFailure =
          err?.status === 401 ||
          err?.message?.includes('401') ||
          err?.data?.error === 'Invalid or expired session' ||
          err?.data?.error === 'Missing authentication token';

        if (isExplicitAuthFailure) {
          // Force silent re-authentication check before ever clearing the user's session
          const restored = await validateTokenPersistence('initial_mount_401');
          if (!restored) {
            console.warn('Silent re-authentication confirmed no recoverable session, clearing session', err);
            api.setToken(null);
            setToken(null);
            persistUser(null);
          }
        } else {
          // Network hiccup, offline mode, or temporary server reload: retain cached login
          console.warn('Server check encountered non-fatal issue, keeping offline cached session', err);
        }
      } finally {
        setIsLoading(false);
      }
    }

    void checkAuth();
  }, [markTokenValidated, persistUser, validateTokenPersistence]);

  const login = async (identifier: string, password: string) => {
    isLoggingOutRef.current = false;
    const res = await api.post<{ user: UserProfile; token: string }>('/api/auth/login', { identifier, password });
    api.setToken(res.token);
    setToken(res.token);
    persistUser(res.user);
    localBackend.syncUserSession(res.user, res.token, true);
    markTokenValidated();
  };

  const register = async (data: { email: string; username: string; fullName: string; password: string; phoneNumber?: string; avatarUrl?: string }) => {
    isLoggingOutRef.current = false;
    const res = await api.post<{ user: UserProfile; token: string }>('/api/auth/register', data);
    api.setToken(res.token);
    setToken(res.token);
    persistUser(res.user);
    localBackend.syncUserSession(res.user, res.token, true);
    markTokenValidated();
  };

  const logout = async () => {
    isLoggingOutRef.current = true;
    try {
      await api.post('/api/auth/logout');
    } catch {
      // ignore logout network error
    } finally {
      api.setToken(null);
      setToken(null);
      persistUser(null);
      isLoggingOutRef.current = false;
    }
  };

  const deleteAccount = async () => {
    isLoggingOutRef.current = true;
    try {
      await api.delete('/api/profile/delete');
    } finally {
      api.setToken(null);
      setToken(null);
      persistUser(null);
      isLoggingOutRef.current = false;
    }
  };

  const demoLogin = async () => {
    isLoggingOutRef.current = false;
    const res = await api.post<{ user: UserProfile; token: string }>('/api/auth/demo-login');
    api.setToken(res.token);
    setToken(res.token);
    persistUser(res.user);
    localBackend.syncUserSession(res.user, res.token, true);
    markTokenValidated();
  };

  const quickResetAndLogin = async (identifier: string, newPassword = 'password123') => {
    isLoggingOutRef.current = false;
    const res = await api.post<{ user: UserProfile; token: string }>('/api/auth/quick-reset', {
      identifier,
      newPassword,
    });
    api.setToken(res.token);
    setToken(res.token);
    persistUser(res.user);
    localBackend.syncUserSession(res.user, res.token, true);
    markTokenValidated();
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    const res = await api.put<{ user: UserProfile }>('/api/profile/update', updates);
    persistUser(res.user);
    markTokenValidated();
    return res.user;
  };

  const updatePrivacy = async (privacy: {
    locationVisibility: LocationVisibility;
    phoneVisibility: PhoneVisibility;
    profileVisibility: ProfileVisibility;
    showOnlineStatus: boolean;
    locationSharingEnabled?: boolean;
    temporarySharingExpiry?: string | null;
  }) => {
    const res = await api.put<{ user: UserProfile }>('/api/privacy/update', privacy);
    persistUser(res.user);
    markTokenValidated();
    return res.user;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isReauthenticating,
        lastTokenValidatedAt,
        validateTokenPersistence,
        login,
        register,
        logout,
        deleteAccount,
        demoLogin,
        quickResetAndLogin,
        updateProfile,
        updatePrivacy,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
