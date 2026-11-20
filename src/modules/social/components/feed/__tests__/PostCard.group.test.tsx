import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const listPeople = vi.fn();

vi.mock('../../../services/feedService', () => ({
  feedService: { listPeople: (id: string) => listPeople(id) },
}));
vi.mock('../../../hooks/useDirectory', () => ({
  useDirectory: () => ({
    nameOf: (id: string | null) => (id === 'u-mine' ? 'Maria Silva' : 'Antigo colaborador'),
  }),
}));
vi.mock('@/modules/workspace/context/workspaceContext', () => ({
  useWorkspace: () => ({ isPreview: false, user: { userId: 'u1', name: 'Eu' } }),
}));
vi.mock('@/modules/workspace/components/UserAvatar', () => ({
  UserAvatar: ({ name }: { name: string }) => <span data-testid="avatar" data-name={name} />,
}));
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

const renderCard = (p: FeedPost, onReact = vi.fn()) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PostCard post={p} onReact={onReact} onDelete={vi.fn()} onHashtag={vi.fn()} />
    </QueryClientProvider>
  );
};

describe('PostCard — publicação de outra empresa do grupo', () => {
  const other = post({ isOtherCompany: true, companyId: 'c2', companyName: 'Empresa B' });

  beforeEach(() => {
    listPeople.mockReset();
  });

  it('mostra a etiqueta com o nome da empresa', () => {
    const { container } = renderCard(other);
    expect(container.querySelector('[data-company-badge]')?.textContent).toContain('Empresa B');
    expect(listPeople).not.toHaveBeenCalled();
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

  it('aniversário de empresa par mostra "Nome - Empresa" sem "Antigo colaborador"', async () => {
    listPeople.mockResolvedValue({
      data: [
        { user_id: 'u2', name: 'Beatriz Matias', company_id: 'c2', company_name: 'Empresa B' },
      ],
      error: null,
    });
    renderCard(
      post({
        id: 'p-bday',
        authorId: null,
        authorName: 'Realize IA',
        authorRole: 'Assistente da empresa',
        kind: 'birthday',
        subjectId: 'u2',
        subjectName: 'Antigo colaborador',
        isOtherCompany: true,
        companyId: 'c2',
        companyName: 'Empresa B',
      })
    );

    await waitFor(() => {
      expect(screen.getByText('Beatriz Matias - Empresa B 🎂')).toBeTruthy();
    });
    expect(listPeople).toHaveBeenCalledWith('p-bday');
    expect(screen.queryByText(/Antigo colaborador/)).toBeNull();
    expect(screen.getByTestId('avatar').getAttribute('data-name')).toBe(
      'Beatriz Matias - Empresa B'
    );
  });

  it('aniversário de empresa par sem resposta da BD cai no rótulo genérico', async () => {
    listPeople.mockResolvedValue({
      data: [],
      error: { code: '42883', message: 'does not exist' },
    });
    renderCard(
      post({
        id: 'p-bday-old',
        authorId: null,
        authorName: 'Realize IA',
        kind: 'birthday',
        subjectId: 'u2',
        subjectName: 'Antigo colaborador',
        isOtherCompany: true,
        companyId: 'c2',
        companyName: 'Empresa B',
      })
    );

    await waitFor(() => {
      expect(screen.getByText('Colaborador · Empresa B 🎂')).toBeTruthy();
    });
    expect(screen.queryByText(/Antigo colaborador/)).toBeNull();
  });

  it('aniversário sem subjectId não pede feed_post_people', () => {
    renderCard(
      post({
        id: 'p-bday-empty',
        kind: 'birthday',
        subjectId: null,
        subjectName: null,
        isOtherCompany: true,
        companyId: 'c2',
        companyName: 'Empresa B',
      })
    );
    expect(listPeople).not.toHaveBeenCalled();
  });
});

describe('PostCard — publicação da minha empresa', () => {
  beforeEach(() => {
    listPeople.mockReset();
  });

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

  it('aniversário da própria empresa mantém post.subjectName e não pede feed_post_people', () => {
    renderCard(
      post({
        id: 'p-bday-mine',
        kind: 'birthday',
        isOtherCompany: false,
        companyId: 'c1',
        companyName: 'Empresa A',
        subjectId: 'u-mine',
        subjectName: 'Maria Silva',
      })
    );
    expect(screen.getByText('Maria Silva 🎂')).toBeTruthy();
    expect(listPeople).not.toHaveBeenCalled();
  });

  it('tolera publicações sem os campos da empresa (base antiga)', () => {
    const { container } = renderCard(post());
    expect(container.querySelector('[data-company-badge]')).toBeNull();
    expect(screen.getByLabelText('Reagir')).toBeTruthy();
  });
});
