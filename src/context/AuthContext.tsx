import React, { createContext, useContext, useState, useEffect } from 'react';
import type { UserProfile, LocationVisibility, PhoneVisibility, ProfileVisibility } from '../types.ts';
import { api } from '../utils/api.ts';

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isLoading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  register: (data: { email: string; username: string; fullName: string; password: string; phoneNumber?: string; avatarUrl?: string }) => Promise<void>;
  logout: () => Promise<void>;
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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const savedUser = localStorage.getItem('beacon_user_profile');
      return savedUser ? (JSON.parse(savedUser) as UserProfile) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState<string | null>(api.getToken());
  // If we already have a cached user and token, don't block the UI with full-screen loader
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    const hasCachedUser = !!localStorage.getItem('beacon_user_profile');
    const hasToken = !!api.getToken();
    return !hasCachedUser && hasToken;
  });

  // Save user profile whenever it changes
  const persistUser = (u: UserProfile | null) => {
    setUser(u);
    if (u) {
      try {
        localStorage.setItem('beacon_user_profile', JSON.stringify(u));
        localStorage.setItem('beacon_last_logged_in_user', u.id);
      } catch (e) {
        console.warn('Failed to persist user profile', e);
      }
    } else {
      localStorage.removeItem('beacon_user_profile');
    }
  };

  // Initialize and verify token in background
  useEffect(() => {
    async function checkAuth() {
      const storedToken = api.getToken();
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      try {
        const data = await api.get<{ user: UserProfile }>('/api/auth/me');
        persistUser(data.user);
      } catch (err: any) {
        // Only clear token if the server explicitly rejected the credentials with 401
        const isExplicitAuthFailure =
          err?.status === 401 ||
          err?.message?.includes('401') ||
          err?.data?.error === 'Invalid or expired session' ||
          err?.data?.error === 'Missing authentication token';

        if (isExplicitAuthFailure) {
          console.warn('Session expired or invalidated by server, clearing session', err);
          api.setToken(null);
          setToken(null);
          persistUser(null);
        } else {
          // Network hiccup, offline mode, or temporary server reload: retain cached login
          console.warn('Server check encountered non-fatal issue, keeping offline cached session', err);
        }
      } finally {
        setIsLoading(false);
      }
    }

    checkAuth();
  }, []);

  const login = async (identifier: string, password: string) => {
    const res = await api.post<{ user: UserProfile; token: string }>('/api/auth/login', { identifier, password });
    api.setToken(res.token);
    setToken(res.token);
    persistUser(res.user);
  };

  const register = async (data: { email: string; username: string; fullName: string; password: string; phoneNumber?: string; avatarUrl?: string }) => {
    const res = await api.post<{ user: UserProfile; token: string }>('/api/auth/register', data);
    api.setToken(res.token);
    setToken(res.token);
    persistUser(res.user);
  };

  const logout = async () => {
    try {
      await api.post('/api/auth/logout');
    } catch {}
    api.setToken(null);
    setToken(null);
    persistUser(null);
  };

  const demoLogin = async () => {
    const res = await api.post<{ user: UserProfile; token: string }>('/api/auth/demo-login');
    api.setToken(res.token);
    setToken(res.token);
    persistUser(res.user);
  };

  const quickResetAndLogin = async (identifier: string, newPassword = 'password123') => {
    const res = await api.post<{ user: UserProfile; token: string }>('/api/auth/quick-reset', {
      identifier,
      newPassword,
    });
    api.setToken(res.token);
    setToken(res.token);
    persistUser(res.user);
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    const res = await api.put<{ user: UserProfile }>('/api/profile/update', updates);
    persistUser(res.user);
    return res.user;
  };

  const updatePrivacy = async (privacy: {
    locationVisibility: LocationVisibility;
    phoneVisibility: PhoneVisibility;
    profileVisibility: ProfileVisibility;
    showOnlineStatus: boolean;
  }) => {
    const res = await api.put<{ user: UserProfile }>('/api/privacy/update', privacy);
    persistUser(res.user);
    return res.user;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        register,
        logout,
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
