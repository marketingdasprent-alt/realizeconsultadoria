// src/contexts/AuthContext.tsx
// Contexto centralizado de autenticação

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { authService } from '@/modules/auth/services/authService';
import { accessService } from '@/modules/admin/services/accessService';

export type UserRole = 'admin' | 'company_admin' | 'employee';

export interface AuthUser extends User {
  role?: UserRole;
  permissions?: string[];
}

interface AuthContextType {
  user: AuthUser | null;
  role: UserRole | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  error: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Verificar role do usuário
  const fetchUserRole = async (userId: string): Promise<UserRole | null> => {
    const { role: userRole } = await accessService.getUserRole(userId);
    return userRole as UserRole;
  };

  // Verificar autenticação ao carregar
  const checkAuth = async () => {
    try {
      const {
        data: { session },
      } = await authService.getSession();

      if (session?.user) {
        const { role: userRole } = await accessService.getUserRole(session.user.id);

        if (!userRole) {
          // Usuário autenticado mas sem role: trate como acesso negado
          setUser(null);
          setRole(null);
          setError('Sua conta ainda não está habilitada. Contate o administrador.');
          return;
        }

        setUser({
          ...session.user,
          role: userRole,
        } as AuthUser);
        setRole(userRole);
      } else {
        setUser(null);
        setRole(null);
      }
    } catch (error) {
      console.error('Error checking auth:', error);
      setError('Erro ao verificar autenticação');
    } finally {
      setIsLoading(false);
    }
  };

  // Login
  const login = async (email: string, password: string) => {
    try {
      setError(null);
      setIsLoading(true);

      const { data, error: signInError } = await authService.login(email, password);

      if (signInError) {
        throw new Error(signInError.message);
      }

      if (data.user) {
        const userRole = await fetchUserRole(data.user.id);
        setUser({
          ...data.user,
          role: userRole || undefined,
        } as AuthUser);
        setRole(userRole);
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Erro ao fazer login';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Logout
  const logout = async () => {
    try {
      setError(null);
      await authService.logout();
      setUser(null);
      setRole(null);
    } catch (error: any) {
      setError('Erro ao fazer logout');
      console.error('Logout error:', error);
    }
  };

  // Limpar erro
  const clearError = () => setError(null);

  // Verificar autenticação ao carregar o contexto
  useEffect(() => {
    checkAuth();

    // Listener para mudanças de autenticação
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const userRole = await fetchUserRole(session.user.id);
        setUser({
          ...session.user,
          role: userRole || undefined,
        } as AuthUser);
        setRole(userRole);
      } else {
        setUser(null);
        setRole(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        isLoading,
        isAuthenticated,
        login,
        logout,
        checkAuth,
        error,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Hook para usar o contexto de autenticação
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};
