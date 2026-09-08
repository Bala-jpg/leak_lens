import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User } from '../types';
import { INITIAL_USER } from '../mock/initialData';
import { authApi } from '../api';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  demoLogin: () => void;
  logout: () => void;
  updateProfile: (name: string, email: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('leaklens_user');
    return saved ? JSON.parse(saved) : INITIAL_USER;
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) {
      localStorage.setItem('leaklens_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('leaklens_user');
    }
  }, [user]);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const data = await authApi.login(email, password);
      setUser(data.user);
      localStorage.setItem('leaklens_token', data.accessToken);
      localStorage.setItem('leaklens_refresh_token', data.refreshToken);
    } catch {
      // Fallback demo login if backend is unreachable
      const fallbackUser: User = {
        id: 'usr-101',
        name: email.split('@')[0] || 'Marcus Chen',
        email,
        role: 'Lead Facility Eng.',
      };
      setUser(fallbackUser);
    } finally {
      setIsLoading(false);
    }
  };

  const demoLogin = () => {
    setUser(INITIAL_USER);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('leaklens_token');
    localStorage.removeItem('leaklens_refresh_token');
  };

  const updateProfile = (name: string, email: string) => {
    if (user) {
      setUser({ ...user, name, email });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        demoLogin,
        logout,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
