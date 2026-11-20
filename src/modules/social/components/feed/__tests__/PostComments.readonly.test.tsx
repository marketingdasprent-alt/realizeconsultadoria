import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const comments = [
  {
    id: 'c1',
    postId: 'p1',
    authorId: 'u2',
    authorName: 'Ana B',
    isMine: false,
    body: 'Boa!',
    createdAt: '2026-11-20T10:00:00Z',
    parentId: null,
  },
];
vi.mock('../../../hooks/useFeedComments', () => ({
  useFeedComments: vi.fn(() => ({ comments, isLoading: false, add: vi.fn(), remove: vi.fn() })),
}));
vi.mock('../../../hooks/useDirectory', () => ({ useDirectory: () => ({ colleagues: [] }) }));
vi.mock('@/modules/workspace/context/workspaceContext', () => ({
  useWorkspace: () => ({ user: { userId: 'u1', name: 'Eu' }, isPreview: false }),
}));
vi.mock('@/modules/workspace/components/UserAvatar', () => ({ UserAvatar: () => <span /> }));
vi.mock('@/modules/workspace/components/EmojiSuggestions', () => ({
  EmojiSuggestions: () => null,
}));
vi.mock('@/modules/workspace/hooks/useEmojiAutocomplete', () => ({
  useEmojiAutocomplete: () => ({
    suggestions: [],
    active: 0,
    pick: vi.fn(),
    setActive: vi.fn(),
    update: vi.fn(),
    close: vi.fn(),
    onKeyDown: () => false,
  }),
}));
vi.mock('@/modules/messenger/components/composer/MentionSuggestions', () => ({
  MentionSuggestions: () => null,
}));
vi.mock('@/modules/messenger/hooks/useMentions', () => ({
  useMentions: () => ({
    suggestions: [],
    active: 0,
    pick: vi.fn(),
    setActive: vi.fn(),
    update: vi.fn(),
    close: vi.fn(),
    onKeyDown: () => false,
    mentionedIn: () => [],
    reset: vi.fn(),
  }),
}));

import { useFeedComments } from '../../../hooks/useFeedComments';
import { PostComments } from '../PostComments';

describe('PostComments', () => {
  it('só leitura: mostra os comentários mas sem caixa para comentar nem Responder', () => {
    render(<PostComments postId="p1" readOnly companyName="Empresa B" />);
    expect(screen.getByText('Boa!')).toBeTruthy();
    expect(screen.queryByPlaceholderText(/Escreva um comentário/)).toBeNull();
    expect(screen.queryByLabelText('Comentar')).toBeNull();
    expect(screen.queryByText('Responder')).toBeNull();
    expect(useFeedComments).toHaveBeenCalledWith('p1', true, 'Empresa B');
  });

  it('normal: caixa para comentar e Responder', () => {
    render(<PostComments postId="p1" />);
    expect(screen.getByPlaceholderText(/Escreva um comentário/)).toBeTruthy();
    expect(screen.getByText('Responder')).toBeTruthy();
  });
});
