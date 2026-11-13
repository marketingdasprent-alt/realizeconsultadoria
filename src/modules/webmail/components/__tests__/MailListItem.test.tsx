import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MailListItem } from '../MailListItem';
import type { MailSummary } from '../../types';

const mail: MailSummary = {
  id: 'm1',
  accountId: 'a1',
  threadId: null,
  from: { name: 'Marta Lopes', email: 'marta@exemplo.pt' },
  to: [],
  subject: 'Reunião de resultados',
  snippet: 'Bom dia a todos',
  date: '2026-11-13T10:00:00Z',
  unread: false,
  starred: false,
  hasAttachments: false,
};

const setup = () => {
  const props = {
    onOpen: vi.fn(),
    onOpenWindow: vi.fn(),
    onSelect: vi.fn(),
    onToggleStar: vi.fn(),
    onTrash: vi.fn(),
  };
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MailListItem mail={mail} isActive={false} isSelected={false} selecting={false} {...props} />
    </QueryClientProvider>
  );
  return props;
};

describe('lista de emails: duplo clique', () => {
  it('abre o email numa janela própria', () => {
    const props = setup();
    fireEvent.doubleClick(screen.getByText('Reunião de resultados'));
    expect(props.onOpenWindow).toHaveBeenCalledWith(mail);
  });

  it('um clique só abre o email no painel (não abre janela)', () => {
    const props = setup();
    fireEvent.click(screen.getByText('Reunião de resultados'));
    expect(props.onOpen).toHaveBeenCalledWith(mail);
    expect(props.onOpenWindow).not.toHaveBeenCalled();
  });

  it('duplo clique na estrela, no lixo ou na seleção não abre janela', () => {
    const props = setup();
    for (const button of screen.getAllByRole('button').filter(b => b.tagName === 'BUTTON'))
      fireEvent.doubleClick(button);
    expect(props.onOpenWindow).not.toHaveBeenCalled();
  });
});
