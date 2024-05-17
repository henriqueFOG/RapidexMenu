import React, { createContext, useState, useContext, ReactNode } from 'react';

interface AuthContextType {
  clientId: string | null;
  setClientId: (id: string | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [clientId, setClientId] = useState<string | null>(null);

  return (
    <AuthContext.Provider value={{ clientId, setClientId }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
