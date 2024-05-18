import React, { createContext, useContext, useState, ReactNode } from 'react';
import { useRouter } from 'next/router';

interface AuthContextType {
  isAuthenticated: boolean;
  clientId: string | null;
  login: (clientId: string, username: string, password: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);
  const router = useRouter();

  const login = (clientId: string, username: string, password: string) => {
    if (username === 'admin' && password === 'password') {
      setIsAuthenticated(true);
      setClientId(clientId);
      if (router.pathname.includes('/admin')) {
        router.push(`/clients/${clientId}/admin`);
      } else {
        router.push(`/clients/${clientId}/home`);
      }
    } else {
      alert('Invalid credentials');
    }
  };

  const logout = () => {
    setIsAuthenticated(false);
    setClientId(null);
    router.push('/');
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, clientId, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
