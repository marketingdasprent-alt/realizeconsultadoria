import { describe, it, expect, beforeEach, vi } from 'vitest';
import { authService } from '../authService';

// Mock do supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn(),
      resetPasswordForEmail: vi.fn(),
    },
  },
}));

import { supabase } from '@/integrations/supabase/client';

describe('authService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('login', () => {
    it('should successfully login with valid credentials', async () => {
      const mockSession = {
        user: { id: 'user-123', email: 'admin@example.com' },
        session: { access_token: 'token-123' },
      };

      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
        data: mockSession as any,
        error: null,
      });

      const result = await authService.login('admin@example.com', 'password123');

      expect(result.data).toEqual(mockSession);
      expect(result.error).toBeNull();
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'admin@example.com',
        password: 'password123',
      });
    });

    it('should trim and lowercase email', async () => {
      const mockSession = { user: { id: 'user-123' }, session: {} };

      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
        data: mockSession as any,
        error: null,
      });

      await authService.login('  ADMIN@EXAMPLE.COM  ', 'password123');

      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'admin@example.com',
        password: 'password123',
      });
    });

    it('should return error for invalid credentials', async () => {
      const mockError = new Error('Invalid credentials');

      vi.mocked(supabase.auth.signInWithPassword).mockRejectedValue(mockError);

      const result = await authService.login('admin@example.com', 'wrongpassword');

      expect(result.data).toBeNull();
      expect(result.error).toBeDefined();
    });

    it('should handle authentication errors', async () => {
      const mockError = new Error('Too many login attempts');

      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
        data: null,
        error: mockError as any,
      });

      const result = await authService.login('admin@example.com', 'password123');

      expect(result.error).toBeDefined();
    });
  });

  describe('logout', () => {
    it('should successfully logout', async () => {
      vi.mocked(supabase.auth.signOut).mockResolvedValue({ error: null });

      const result = await authService.logout();

      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
      expect(supabase.auth.signOut).toHaveBeenCalled();
    });

    it('should return error on logout failure', async () => {
      const mockError = new Error('Logout failed');

      vi.mocked(supabase.auth.signOut).mockRejectedValue(mockError);

      const result = await authService.logout();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('getSession', () => {
    it('should return current session', async () => {
      const mockSession = {
        user: { id: 'user-123', email: 'admin@example.com' },
        access_token: 'token-123',
      };

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: mockSession as any,
        error: null,
      });

      const result = await authService.getSession();

      expect(result.data).toEqual(mockSession);
      expect(result.error).toBeNull();
      expect(supabase.auth.getSession).toHaveBeenCalled();
    });

    it('should return null session when not authenticated', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null, user: null },
        error: null,
      });

      const result = await authService.getSession();

      expect(result.data).toBeDefined();
      expect(result.error).toBeNull();
    });

    it('should handle session retrieval errors', async () => {
      const mockError = new Error('Session error');

      vi.mocked(supabase.auth.getSession).mockRejectedValue(mockError);

      const result = await authService.getSession();

      expect(result.data).toBeNull();
      expect(result.error).toBeDefined();
    });
  });

  describe('resetPassword', () => {
    it('should send password reset email', async () => {
      // Em localhost, usa a origin local (dev)
      Object.defineProperty(window, 'location', {
        value: { origin: 'http://localhost:5173', hostname: 'localhost' },
        configurable: true,
      });

      vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValue({
        data: {},
        error: null,
      });

      const result = await authService.resetPassword('admin@example.com');

      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
      expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith('admin@example.com', {
        redirectTo: 'http://localhost:5173/auth/set-password',
      });
    });

    it('should return error when reset email fails', async () => {
      const mockError = new Error('Email service error');

      vi.mocked(supabase.auth.resetPasswordForEmail).mockRejectedValue(mockError);

      const result = await authService.resetPassword('nonexistent@example.com');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should always use the production URL outside localhost (never preview domains)', async () => {
      // Simula abertura a partir de um domínio de preview (ex.: Lovable)
      Object.defineProperty(window, 'location', {
        value: {
          origin: 'https://preview.lovableproject.com',
          hostname: 'preview.lovableproject.com',
        },
        configurable: true,
      });

      vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValue({
        data: {},
        error: null,
      });

      await authService.resetPassword('test@example.com');

      expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith('test@example.com', {
        redirectTo: 'https://realize.dasprent.pt/auth/set-password',
      });
    });
  });

  describe('error handling', () => {
    it('should handle all service errors consistently', async () => {
      const errors = [
        new Error('Network error'),
        new Error('Invalid input'),
        new Error('Server error'),
      ];

      for (const error of errors) {
        vi.mocked(supabase.auth.signInWithPassword).mockRejectedValueOnce(error);

        const result = await authService.login('test@example.com', 'password');

        expect(result.error).toBeDefined();
        expect(result.data).toBeNull();
      }
    });
  });
});
