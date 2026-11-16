import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { NO_FILTER, toggleFilter } from '../../lib/listFilter';
import { MailFilterBar } from '../MailFilterBar';

describe('MailFilterBar', () => {
  it('mostra Todos, Não lidos, Com estrela e Com anexos, com "Todos" ativo sem filtros', () => {
    render(<MailFilterBar filter={NO_FILTER} onToggle={vi.fn()} onClear={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Todos' })).toHaveAttribute('aria-pressed', 'true');
    for (const name of ['Não lidos', 'Com estrela', 'Com anexos'])
      expect(screen.getByRole('button', { name })).toHaveAttribute('aria-pressed', 'false');
  });

  it('com filtros ligados "Todos" deixa de estar ativo e os ligados ficam marcados', () => {
    const filter = toggleFilter(toggleFilter(NO_FILTER, 'unread'), 'attachments');
    render(<MailFilterBar filter={filter} onToggle={vi.fn()} onClear={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Todos' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Não lidos' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByRole('button', { name: 'Com anexos' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByRole('button', { name: 'Com estrela' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });

  it('cada chip chama o seu filtro e "Todos" limpa', () => {
    const onToggle = vi.fn();
    const onClear = vi.fn();
    render(<MailFilterBar filter={NO_FILTER} onToggle={onToggle} onClear={onClear} />);
    fireEvent.click(screen.getByRole('button', { name: 'Com estrela' }));
    expect(onToggle).toHaveBeenCalledWith('starred');
    fireEvent.click(screen.getByRole('button', { name: 'Todos' }));
    expect(onClear).toHaveBeenCalled();
  });
});
