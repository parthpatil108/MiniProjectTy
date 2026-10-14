import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { apiClient, setApiAuthToken, getApiAuthToken } from '../services/apiClient';

export type UserRole = 'Student' | 'Faculty_TPO' | 'Placement_Admin';

export interface UserProfile {
  user_id: string;
  name: string;
  email: string;
  role: UserRole;
  permissions: string[];
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<UserProfile>;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(getApiAuthToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchCurrentUser = useCallback(async () => {
    try {
      const data = await apiClient<UserProfile>('/api/v1/ui/me');
      setUser(data);
    } catch {
      setUser(null);
      setToken(null);
      setApiAuthToken(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) {
      fetchCurrentUser();
    } else {
      setIsLoading(false);
    }

    const handleSessionExpired = () => {
      setUser(null);
      setToken(null);
      setApiAuthToken(null);
    };

    window.addEventListener('apnileap-session-expired', handleSessionExpired);
    return () => {
      window.removeEventListener('apnileap-session-expired', handleSessionExpired);
    };
  }, [token, fetchCurrentUser]);

  const login = async (email: string, password: string): Promise<UserProfile> => {
    setIsLoading(true);
    try {
      const resp = await apiClient<{
        token: string;
        user_id: string;
        role: UserRole;
        name: string;
        email: string;
      }>('/api/v1/ui/session', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });

      setToken(resp.token);
      setApiAuthToken(resp.token);

      // Fetch fresh profile with permissions
      const profile = await apiClient<UserProfile>('/api/v1/ui/me');
      setUser(profile);
      return profile;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await apiClient('/api/v1/ui/session', { method: 'DELETE' });
    } catch {
      // ignore
    } finally {
      setUser(null);
      setToken(null);
      setApiAuthToken(null);
    }
  };

  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    return user.permissions?.includes(permission) || false;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        hasPermission,
        refreshProfile: fetchCurrentUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
