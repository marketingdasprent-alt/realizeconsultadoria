// src/contexts/AuthContext.tsx
// Contexto centralizado de autenticação

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { authService } from '@/modules/auth/services/authService';
import { accessService } from '@/modules/admin/services/accessService';
import { areaFor } from '@/lib/account-switch';
import { retryDelayMs } from '@/lib/retry';

export type UserRole = 'admin' | 'company_admin' | 'employee';

/** Resultado de ler o papel: `unavailable` = a BD não respondeu (não quer dizer "sem papel"). */
export interface RoleLookup {
  role: UserRole | null;
  unavailable: boolean;
}

const VALID_ROLES: readonly UserRole[] = ['admin', 'company_admin', 'employee'];

const normalizeRole = (raw: unknown): UserRole | null => {
  if (typeof raw !== 'string') return null;
  return (VALID_ROLES as readonly string[]).includes(raw) ? (raw as UserRole) : null;
};

// Papel guardado neste aparelho depois de confirmado: no arranque seguinte a app abre logo
// (sem esperar pelo pedido do papel) e confirma-o em segundo plano. Os dados continuam
// protegidos pelas regras da BD; se o papel mudou, a app corrige-se ao confirmar.
const roleCacheKey = (userId: string) => `rz.role.${userId}`;

const readCachedRole = (userId: string): UserRole | null => {
  try {
    return normalizeRole(localStorage.getItem(roleCacheKey(userId)));
  } catch {
    return null;
  }
};

const writeCachedRole = (userId: string, role: UserRole | null) => {
  try {
    if (role) localStorage.setItem(roleCacheKey(userId), role);
    else localStorage.removeItem(roleCacheKey(userId));
  } catch {
    // sem armazenamento (janela privada): só perde o arranque rápido
  }
};

/**
 * Na área do colaborador quem também é admin (na mesma conta) entra como colaborador; no
 * admin entra como admin. A área vem da página (/admin… ou /colaborador…) e, no login, do endereço.
 */
const isWorkspaceArea = (): boolean =>
  typeof window !== 'undefined' &&
  areaFor(window.location.pathname, window.location.hostname) === 'workspace';

export interface AuthUser extends User {
  role?: UserRole;
  permissions?: string[];
}

interface AuthContextType {
  user: AuthUser | null;
  role: UserRole | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  /**
   * A BD não respondeu ao ler o papel e a app está a tentar de novo com espera crescente
   * (2 s → 30 s). Quem já tinha o papel guardado neste aparelho continua dentro da app.
   */
  isServiceUnavailable: boolean;
  /** Resolve com o papel lido, ou com `unavailable` se a BD não respondeu. */
  login: (email: string, password: string) => Promise<RoleLookup>;
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
  const [isServiceUnavailable, setIsServiceUnavailable] = useState(false);
  // Monotonic counter that lets us discard role lookups whose result
  // arrives after a newer auth event has already updated the state.
  const lookupGenerationRef = useRef(0);
  // Utilizador cujo papel já foi lido: renovações do token (e o SIGNED_IN que o Supabase
  // volta a emitir ao regressar à app) não precisam de o ler outra vez.
  const resolvedUserIdRef = useRef<string | null>(null);
  // Nova tentativa marcada (BD em baixo) e para que utilizador: os eventos do Supabase desse
  // utilizador não a antecipam, senão a espera crescente não servia de nada.
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryingUserIdRef = useRef<string | null>(null);

  const cancelRetry = () => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    retryTimerRef.current = null;
    retryingUserIdRef.current = null;
  };

  const applySession = async (session: Session | null): Promise<RoleLookup> => {
    const generation = ++lookupGenerationRef.current;
    cancelRetry();

    if (!session?.user) {
      resolvedUserIdRef.current = null;
      setUser(null);
      setRole(null);
      setIsServiceUnavailable(false);
      return { role: null, unavailable: false };
    }

    // Na área do colaborador um "admin" guardado pode ser também colaborador: confirma-se.
    const stored = readCachedRole(session.user.id);
    const cached = stored === 'admin' && isWorkspaceArea() ? null : stored;
    if (cached) {
      resolvedUserIdRef.current = session.user.id;
      setUser({ ...session.user, role: cached } as AuthUser);
      setRole(cached);
      setError(null);
      void resolveRole(session, generation);
      return { role: cached, unavailable: false };
    }
    return resolveRole(session, generation);
  };

  /** Lê o papel na BD (e guarda-o para o próximo arranque). */
  const resolveRole = async (
    session: Session,
    generation: number,
    attempt = 0
  ): Promise<RoleLookup> => {
    const { data: rawRole, error: lookupError } = await accessService.getUserRole(session.user.id, {
      preferEmployee: isWorkspaceArea(),
    });
    const lookup: RoleLookup = { role: normalizeRole(rawRole), unavailable: !!lookupError };
    if (generation !== lookupGenerationRef.current) return lookup;

    if (lookupError) {
      // A BD não respondeu: não se sabe o papel, o que é diferente de "conta sem papel".
      // Não se apaga o papel guardado nem se tira o utilizador da app (mandá-lo para o login
      // é que punha a página de login e o ProtectedRoute em ciclo, a 21/10); tenta-se outra
      // vez com espera crescente.
      setIsServiceUnavailable(true);
      retryingUserIdRef.current = session.user.id;
      retryTimerRef.current = setTimeout(() => {
        retryTimerRef.current = null;
        void resolveRole(session, generation, attempt + 1);
      }, retryDelayMs(attempt));
      return lookup;
    }

    retryingUserIdRef.current = null;
    setIsServiceUnavailable(false);
    const normalized = lookup.role;
    writeCachedRole(session.user.id, normalized);
    if (!normalized) {
      resolvedUserIdRef.current = null;
      setUser(null);
      setRole(null);
      setError('Sua conta ainda não está habilitada. Contate o administrador.');
      return lookup;
    }

    resolvedUserIdRef.current = session.user.id;
    setUser({ ...session.user, role: normalized } as AuthUser);
    setRole(normalized);
    setError(null);
    return lookup;
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

  const login = async (email: string, password: string): Promise<RoleLookup> => {
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
      return await applySession(data?.session ?? null);
    } catch (err: unknown) {
      const errorMessage = (err instanceof Error && err.message) || 'Erro ao fazer login';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      setError(null);
      ++lookupGenerationRef.current;
      cancelRetry();
      setIsServiceUnavailable(false);
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
      if (
        (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') &&
        session?.user &&
        (session.user.id === resolvedUserIdRef.current ||
          session.user.id === retryingUserIdRef.current)
      )
        return;
      applySession(session);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
      cancelRetry();
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
        isServiceUnavailable,
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
