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
  }) => Promise<UserProfile>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(api.getToken());
  const [isLoading, setIsLoading] = useState(true);

  // Initialize and check token
  useEffect(() => {
    async function checkAuth() {
      const storedToken = api.getToken();
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      try {
        const data = await api.get<{ user: UserProfile }>('/api/auth/me');
        setUser(data.user);
      } catch (err) {
        console.warn('Session check failed, clearing token', err);
        api.setToken(null);
        setToken(null);
        setUser(null);
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
    setUser(res.user);
  };

  const register = async (data: { email: string; username: string; fullName: string; password: string; phoneNumber?: string; avatarUrl?: string }) => {
    const res = await api.post<{ user: UserProfile; token: string }>('/api/auth/register', data);
    api.setToken(res.token);
    setToken(res.token);
    setUser(res.user);
  };

  const logout = async () => {
    try {
      await api.post('/api/auth/logout');
    } catch {}
    api.setToken(null);
    setToken(null);
    setUser(null);
  };

  const demoLogin = async () => {
    const res = await api.post<{ user: UserProfile; token: string }>('/api/auth/demo-login');
    api.setToken(res.token);
    setToken(res.token);
    setUser(res.user);
  };

  const quickResetAndLogin = async (identifier: string, newPassword = 'password123') => {
    const res = await api.post<{ user: UserProfile; token: string }>('/api/auth/quick-reset', {
      identifier,
      newPassword,
    });
    api.setToken(res.token);
    setToken(res.token);
    setUser(res.user);
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    const res = await api.put<{ user: UserProfile }>('/api/profile/update', updates);
    setUser(res.user);
    return res.user;
  };

  const updatePrivacy = async (privacy: {
    locationVisibility: LocationVisibility;
    phoneVisibility: PhoneVisibility;
    profileVisibility: ProfileVisibility;
    showOnlineStatus: boolean;
  }) => {
    const res = await api.put<{ user: UserProfile }>('/api/privacy/update', privacy);
    setUser(res.user);
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
