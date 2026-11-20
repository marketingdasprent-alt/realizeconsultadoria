import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PermissionScopeToggle } from '../PermissionScopeToggle';

describe('PermissionScopeToggle', () => {
  it('tem nome acessível, marca a opção atual e muda com o teclado', async () => {
    const onChange = vi.fn();
    render(
      <PermissionScopeToggle
        label="Alcance de Editar colaboradores"
        value="all"
        onChange={onChange}
      />
    );
    const group = screen.getByRole('radiogroup', { name: 'Alcance de Editar colaboradores' });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Todos' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Só a minha equipa' })).toHaveAttribute(
      'aria-checked',
      'false'
    );

    const user = userEvent.setup();
    // Uma só paragem de Tab: a opção marcada.
    await user.tab();
    expect(screen.getByRole('radio', { name: 'Todos' })).toHaveFocus();
    await user.tab();
    expect(document.body).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole('radio', { name: 'Todos' })).toHaveFocus();
    // Setas mudam o valor e movem o foco, com volta ao início.
    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith('team');
    expect(screen.getByRole('radio', { name: 'Só a minha equipa' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(onChange).toHaveBeenLastCalledWith('all');
    expect(screen.getByRole('radio', { name: 'Todos' })).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(onChange).toHaveBeenLastCalledWith('team');
    await user.keyboard('{ArrowUp}');
    expect(onChange).toHaveBeenLastCalledWith('all');
    // Enter e Espaço continuam a escolher a opção com foco.
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenLastCalledWith('all');
    await user.keyboard('a');
    expect(onChange).toHaveBeenCalledTimes(5);
  });

  it('valor misto: nenhuma opção marcada; desativado não muda', async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <PermissionScopeToggle label="Alcance" value={null} onChange={onChange} />
    );
    screen.getAllByRole('radio').forEach(r => expect(r).toHaveAttribute('aria-checked', 'false'));
    // Sem valor, a paragem de Tab é a primeira opção.
    await userEvent.setup().tab();
    expect(screen.getByRole('radio', { name: 'Todos' })).toHaveFocus();
    rerender(<PermissionScopeToggle label="Alcance" value={null} disabled onChange={onChange} />);
    await userEvent.setup().click(screen.getByRole('radio', { name: 'Todos' }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
