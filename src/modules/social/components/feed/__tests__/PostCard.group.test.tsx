import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

vi.mock('@/modules/workspace/components/UserAvatar', () => ({ UserAvatar: () => <span /> }));
vi.mock('../../RichText', () => ({ RichText: ({ text }: { text: string }) => <p>{text}</p> }));
vi.mock('../PostAttachments', () => ({ PostAttachments: () => null }));
vi.mock('../PostReactors', () => ({ PostReactors: () => null }));
vi.mock('../PostComments', () => ({
  PostComments: ({ readOnly }: { readOnly?: boolean }) => (
    <div data-testid="comments" data-readonly={String(!!readOnly)} />
  ),
}));

import { PostCard } from '../PostCard';
import type { FeedPost } from '../../../types';

const post = (overrides: Partial<FeedPost> = {}): FeedPost => ({
  id: 'p1',
  authorId: 'u2',
  authorName: 'Ana B',
  authorRole: 'Empresa B',
  isMine: false,
  body: 'Olá a todos',
  audience: 'company',
  department: null,
  attachments: [],
  createdAt: '2026-11-20T10:00:00Z',
  editedAt: null,
  commentCount: 2,
  reactions: [{ emoji: '👍', count: 2, mine: false }],
  kind: 'post',
  subjectId: null,
  ...overrides,
});

const renderCard = (p: FeedPost, onReact = vi.fn()) =>
  render(<PostCard post={p} onReact={onReact} onDelete={vi.fn()} onHashtag={vi.fn()} />);

describe('PostCard — publicação de outra empresa do grupo', () => {
  const other = post({ isOtherCompany: true, companyId: 'c2', companyName: 'Empresa B' });

  it('mostra a etiqueta com o nome da empresa', () => {
    const { container } = renderCard(other);
    expect(container.querySelector('[data-company-badge]')?.textContent).toContain('Empresa B');
  });

  it('é só leitura: sem botão de reagir e as reações não se clicam', () => {
    const onReact = vi.fn();
    renderCard(other, onReact);
    expect(screen.queryByLabelText('Reagir')).toBeNull();
    fireEvent.click(screen.getByText(/👍 2/));
    expect(onReact).not.toHaveBeenCalled();
  });

  it('os comentários abrem em só leitura', () => {
    renderCard(other);
    fireEvent.click(screen.getByText('2 comentários'));
    expect(screen.getByTestId('comments').getAttribute('data-readonly')).toBe('true');
  });

  it('sem comentários não oferece "Comentar"', () => {
    renderCard({ ...other, commentCount: 0, reactions: [] });
    expect(screen.queryByText('Comentar')).toBeNull();
  });

  it('sem opções de eliminar/editar mesmo que isMine viesse a verdadeiro', () => {
    renderCard({ ...other, isMine: true });
    expect(screen.queryByLabelText('Opções da publicação')).toBeNull();
  });
});

describe('PostCard — publicação da minha empresa', () => {
  it('sem etiqueta e com reagir e comentar como antes', () => {
    const onReact = vi.fn();
    const { container } = renderCard(
      post({ isOtherCompany: false, companyName: 'Empresa A' }),
      onReact
    );
    expect(container.querySelector('[data-company-badge]')).toBeNull();
    expect(screen.getByLabelText('Reagir')).toBeTruthy();
    fireEvent.click(screen.getByText(/👍 2/));
    expect(onReact).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('2 comentários'));
    expect(screen.getByTestId('comments').getAttribute('data-readonly')).toBe('false');
  });

  it('tolera publicações sem os campos da empresa (base antiga)', () => {
    const { container } = renderCard(post());
    expect(container.querySelector('[data-company-badge]')).toBeNull();
    expect(screen.getByLabelText('Reagir')).toBeTruthy();
  });
});
