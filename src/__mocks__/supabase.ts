import { vi } from 'vitest';

export const supabase = {
  auth: {
    onAuthStateChange: vi.fn(() => ({
      data: {
        subscription: {
          unsubscribe: vi.fn(),
        },
      },
    })),
  },
};
