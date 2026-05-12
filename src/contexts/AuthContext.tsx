// src/contexts/AuthContext.tsx
// Contexto centralizado de autenticação

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { authService } from '@/modules/auth/services/authService';
import { accessService } from '@/modules/admin/services/accessService';

export type UserRole = 'admin' | 'company_admin' | 'employee';

const VALID_ROLES: readonly UserRole[] = ['admin', 'company_admin', 'employee'];

const normalizeRole = (raw: unknown): UserRole | null => {
  if (typeof raw !== 'string') return null;
  return (VALID_ROLES as readonly string[]).includes(raw) ? (raw as UserRole) : null;
};

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
  // Monotonic counter that lets us discard role lookups whose result
  // arrives after a newer auth event has already updated the state.
  const lookupGenerationRef = useRef(0);

  const applySession = async (session: Session | null) => {
    const generation = ++lookupGenerationRef.current;

    if (!session?.user) {
      setUser(null);
      setRole(null);
      return;
    }

    const { role: rawRole } = await accessService.getUserRole(session.user.id);
    if (generation !== lookupGenerationRef.current) return;

    const normalized = normalizeRole(rawRole);
    if (!normalized) {
      setUser(null);
      setRole(null);
      setError('Sua conta ainda não está habilitada. Contate o administrador.');
      return;
    }

    setUser({ ...session.user, role: normalized } as AuthUser);
    setRole(normalized);
    setError(null);
  };

  const checkAuth = async () => {
    try {
      const { data } = await authService.getSession();
      await applySession(data?.session ?? null);
    } catch (err) {
      console.error('Error checking auth:', err);
      setError('Erro ao verificar autenticação');
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      setError(null);
      setIsLoading(true);

      const { data, error: signInError } = await authService.login(email, password);

      if (signInError) {
        throw new Error(signInError.message);
      }

      // Apply session synchronously so the caller can react to the role state
      // before navigating. onAuthStateChange will see SIGNED_IN but we ignore
      // it via the generation counter to avoid a duplicate role lookup.
      await applySession(data?.session ?? null);
    } catch (err: any) {
      const errorMessage = err.message || 'Erro ao fazer login';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      setError(null);
      await authService.logout();
      setUser(null);
      setRole(null);
    } catch (err) {
      setError('Erro ao fazer logout');
      console.error('Logout error:', err);
    }
  };

  const clearError = () => setError(null);

  useEffect(() => {
    let active = true;

    checkAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      // INITIAL_SESSION is already handled by checkAuth above — skipping it
      // prevents a race where two concurrent role lookups overwrite each other.
      if (event === 'INITIAL_SESSION') return;
      applySession(session);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
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
