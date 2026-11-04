import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAdminPermissions } from '../useAdminPermissions';

// Mock do supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
    // Conta unificada: por omissão só a própria conta
    rpc: vi.fn(async (_fn: string, args: { _user_id: string }) => ({ data: [args._user_id] })),
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      then: vi.fn().mockReturnThis(),
      // Adicione outros métodos encadeáveis conforme necessário
    })),
  },
}));

import { supabase } from '@/integrations/supabase/client';

describe('useAdminPermissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with loading state', () => {
    const mockSession = { user: { id: 'user-123' } };

    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      then: vi.fn(cb => {
        cb({ data: null });
        return new Promise(resolve => resolve(null));
      }),
    };

    vi.mocked(supabase.auth.getSession).mockReturnValue(
      Promise.resolve({ data: { session: mockSession }, error: null }) as any
    );

    const { result } = renderHook(() => useAdminPermissions());
    expect(result.current.isLoading).toBe(true);
  });

  it.skip('should fetch admin permissions when session exists', async () => {
    const mockPermissions = [
      {
        module_key: 'employees',
        topic_key: null,
        can_view: true,
        can_edit: true,
        can_execute: false,
      },
      {
        module_key: 'companies',
        topic_key: null,
        can_view: true,
        can_edit: false,
        can_execute: false,
      },
    ];

    const mockSession = { user: { id: 'user-123' } };

    vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({
      data: { session: mockSession },
      error: null,
    } as any);

    const mockAdminGroupQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValueOnce({
        data: [
          {
            group_id: 'group-123',
            admin_groups: { is_super_admin: false, is_active: true },
          },
        ],
      }),
    };

    vi.mocked(supabase.from).mockReturnValueOnce(mockAdminGroupQuery as any);

    const { result } = renderHook(() => useAdminPermissions());
    await waitFor(
      () => {
        expect(result.current.isLoading).toBe(false);
      },
      { timeout: 3000 }
    );
  });

  it('should handle no session gracefully', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    } as any);

    const { result } = renderHook(() => useAdminPermissions());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.permissions).toEqual([]);
    expect(result.current.isSuperAdmin).toBe(false);
  });

  it('should identify super admin users', async () => {
    const mockSession = { user: { id: 'user-123' } };

    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: mockSession },
      error: null,
    } as any);

    const mockAdminGroupQuery = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({
        data: [
          {
            group_id: 'superadmin-group',
            admin_groups: { is_super_admin: true, is_active: true },
          },
        ],
      }),
    };

    vi.mocked(supabase.from).mockReturnValueOnce(mockAdminGroupQuery as any);

    const { result } = renderHook(() => useAdminPermissions());

    await waitFor(() => {
      expect(result.current.isSuperAdmin).toBe(true);
    });
  });

  it('conta de colaborador ligada a uma conta de admin herda os grupos dela', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: { id: 'colaborador-1' } } },
      error: null,
    } as any);
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: ['colaborador-1', 'admin-1'] } as any);
    const inGroups = vi.fn().mockResolvedValue({
      data: [{ group_id: 'g', admin_groups: { is_super_admin: true, is_active: true } }],
    });
    vi.mocked(supabase.from).mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      in: inGroups,
    } as any);

    const { result } = renderHook(() => useAdminPermissions());

    await waitFor(() => {
      expect(result.current.isSuperAdmin).toBe(true);
    });
    expect(inGroups).toHaveBeenCalledWith('user_id', ['colaborador-1', 'admin-1']);
  });

  it('should have canView method', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    } as any);

    const { result } = renderHook(() => useAdminPermissions());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(typeof result.current.canView).toBe('function');
  });

  it('should have canEdit method', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    } as any);

    const { result } = renderHook(() => useAdminPermissions());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(typeof result.current.canEdit).toBe('function');
  });

  it('should have canViewTopic method', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    } as any);

    const { result } = renderHook(() => useAdminPermissions());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(typeof result.current.canViewTopic).toBe('function');
  });

  it('should have canExecuteTopic method', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    } as any);

    const { result } = renderHook(() => useAdminPermissions());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(typeof result.current.canExecuteTopic).toBe('function');
  });

  it('should have refetch method', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    } as any);

    const { result } = renderHook(() => useAdminPermissions());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(typeof result.current.refetch).toBe('function');
  });

  it.skip('should handle errors gracefully', async () => {
    const mockError = new Error('Session error');

    vi.mocked(supabase.auth.getSession).mockRejectedValueOnce(mockError);

    const { result } = renderHook(() => useAdminPermissions());

    await waitFor(
      () => {
        expect(result.current.isLoading).toBe(false);
      },
      { timeout: 3000 }
    );

    expect(result.current.permissions).toEqual([]);
  });
});
