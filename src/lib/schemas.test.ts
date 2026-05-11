import { describe, it, expect } from 'vitest';
import { loginSchema } from './schemas';

describe('schemas', () => {
  describe('loginSchema', () => {
    it('should validate correct credentials', () => {
      const result = loginSchema.safeParse({ email: 'test@example.com', password: 'password123' });
      expect(result.success).toBe(true);
    });

    it('should fail on invalid email', () => {
      const result = loginSchema.safeParse({ email: 'invalid-email', password: 'password123' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Email inválido');
      }
    });

    it('should fail on short password', () => {
      const result = loginSchema.safeParse({ email: 'test@example.com', password: '123' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Password deve ter pelo menos 6 caracteres');
      }
    });
  });
});
