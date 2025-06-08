import React, { createContext, useContext, useState, ReactNode } from 'react';
import { useRouter } from 'next/router';

interface Cadastro {
  id: number;
  usuario: string;
  password: string;
  Nome?: string;
  CPF?: string;
  Telefone?: string;
  Email?: string;
  Endereço?: string;
  Numero?: string;
  Complemento?: string;
}

const normalizeCadastro = (data: any): Cadastro => ({
  id: data.id,
  usuario: data.usuario,
  password: data.password,
  Nome: data.Nome || data.nome,
  CPF: data.CPF || data.cpf,
  Telefone: data.Telefone || data.telefone,
  Email: data.Email || data.email,
  Endereço: data.Endereço || data.endereco,
  Numero: data.Numero || data.numero,
  Complemento: data.Complemento || data.complemento,
});

interface AuthContextType {
  isAuthenticated: boolean;
  clientId: string | null;
  loggedUser: Cadastro | null;
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
  const [loggedUser, setLoggedUser] = useState<Cadastro | null>(null);
  const router = useRouter();

  const login = async (client: string, username: string, password: string) => {
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario: username, password }),
      });

      if (!res.ok) {
        alert('Invalid credentials');
        return;
      }

      const data = await res.json();
      setIsAuthenticated(true);
      setClientId(client);
      setLoggedUser(normalizeCadastro(data.user));
      if (router.pathname.includes('/admin')) {
        router.push(`/clients/${client}/admin`);
      } else {
        router.push(`/clients/${client}/home`);
      }
    } catch {
      alert('Erro ao fazer login');
    }
  };

  const logout = () => {
    setIsAuthenticated(false);
    setClientId(null);
    setLoggedUser(null);
    router.push('/');
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, clientId, loggedUser, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
