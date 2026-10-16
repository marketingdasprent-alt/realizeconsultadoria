import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    storage: {
      from: () => ({
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://x.supabase.co/${path}` } }),
      }),
    },
  },
}));
vi.mock('@/modules/messenger/services/messengerService', () => ({
  messengerService: {
    getDirectory: vi.fn().mockResolvedValue({
      data: [{ user_id: 'u1', name: 'Thiago', avatar_path: 'u1/1.webp' }],
      error: null,
    }),
  },
}));
vi.mock('../../context/workspaceContext', () => ({
  useWorkspace: () => ({ isPreview: false }),
}));

import { UserAvatar } from '../UserAvatar';

describe('UserAvatar', () => {
  it('mostra a fotografia que vem no diretório', async () => {
    const client = new QueryClient();
    const { container } = render(
      <QueryClientProvider client={client}>
        <UserAvatar name="Thiago Sousa" userId="u1" />
      </QueryClientProvider>
    );
    expect(screen.getByText('TS')).toBeTruthy();
    await waitFor(() => expect(container.querySelector('img')).not.toBeNull());
    expect(container.querySelector('img')?.getAttribute('src')).toBe(
      'https://x.supabase.co/u1/1.webp'
    );
  });
});
