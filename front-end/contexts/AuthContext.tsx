
import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { User, Role } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<User | null>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true); // Start loading to check for stored session

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (!storedToken) { setLoading(false); return; }
    api.me().then(account => {
      setToken(storedToken);
      setUser(account);
    }).catch(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }).finally(() => setLoading(false));
  }, []);

const login = async (email: string, password: string): Promise<User | null> => {
  const { token: apiToken, user: apiUser } = await api.login(email, password);

  setToken(apiToken);
  setUser(apiUser);
  localStorage.setItem('token', apiToken);
  localStorage.setItem('user', JSON.stringify(apiUser));

  setLoading(false);
  return apiUser;
};


  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  if (loading) {
    // Optional: Render a loading spinner for the whole app on initial load
    return null;
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
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
