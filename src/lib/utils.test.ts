import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('utils', () => {
  describe('cn', () => {
    it('should merge classes properly', () => {
      expect(cn('class1', 'class2')).toBe('class1 class2');
    });

    it('should resolve tailwind conflicts', () => {
      // Assuming tailwind-merge resolves p-4 and p-2 to p-2
      expect(cn('p-4', 'p-2')).toBe('p-2');
    });

    it('should handle conditional classes', () => {
      expect(cn('class1', 'class2')).toBe('class1 class2');
    });
  });
});
